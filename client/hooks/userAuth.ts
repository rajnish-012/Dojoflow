"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  clearAuthSession,
  logoutSession,
  setCurrentUser,
  type CurrentUser,
  AUTH_CHANGED_EVENT,
  SESSION_EXPIRED_EVENT,
} from "@/lib/current-user";

import { getCurrentUser, migrateLegacySession } from "@/lib/api";

type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated";

type UseAuthResult = {
  user: CurrentUser | null;
  status: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<CurrentUser | null>;
  logout: () => void;
};

/**
 * Central authentication state for the ForceStrike client.
 *
 * The backend remains the final authentication and
 * authorization boundary.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [status, setStatus] =
    useState<AuthStatus>("loading");

  /**
   * Load the authenticated user from /auth/me.
   */
  const refreshUser =
    useCallback(async () => {
      try {
        setStatus("loading");
        await migrateLegacySession();

        const currentUser =
          await getCurrentUser();

        setCurrentUser(currentUser);

        setUser(currentUser);
        setStatus("authenticated");

        return currentUser;
      } catch {
        /*
         * getCurrentUser() handles 401 responses.
         *
         * Other errors are treated as an
         * unauthenticated client state.
         */
        clearAuthSession(false);
        setUser(null);
        setStatus("unauthenticated");

        return null;
      }
    }, []);

  /**
   * Initial authentication check.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        await migrateLegacySession();
        setStatus("loading");

        const currentUser =
          await getCurrentUser();

        if (cancelled) {
          return;
        }

        setCurrentUser(currentUser);

        setUser(currentUser);
        setStatus("authenticated");
      } catch {
        if (cancelled) {
          return;
        }

        clearAuthSession(false);
        setUser(null);
        setStatus("unauthenticated");
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * IMPORTANT:
   *
   * Login and logout update the in-memory auth snapshot.
   *
   * Therefore we listen to our custom auth event.
   */
  useEffect(() => {
    const handleAuthChange =
      () => {
        refreshUser();
      };

    window.addEventListener(
      AUTH_CHANGED_EVENT,
      handleAuthChange,
    );

    return () => {
      window.removeEventListener(
        AUTH_CHANGED_EVENT,
        handleAuthChange,
      );
    };
  }, [refreshUser]);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearAuthSession(false);
      setUser(null);
      setStatus("unauthenticated");
      if (window.location.pathname !== "/login") window.location.assign("/login");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  /**
   * Logout.
   */
  const logout =
    useCallback(() => {
      void logoutSession();
      setUser(null);
      setStatus("unauthenticated");

      window.location.href =
        "/login";
    }, []);

  return {
    user,
    status,

    isLoading:
      status === "loading",

    isAuthenticated:
      status === "authenticated",

    refreshUser,
    logout,
  };
}

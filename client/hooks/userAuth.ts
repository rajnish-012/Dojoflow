"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  clearAuthSession,
  setCurrentUser,
  type CurrentUser,
  AUTH_CHANGED_EVENT,
} from "@/lib/current-user";

import { getCurrentUser } from "@/lib/api";

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
      const token =
        localStorage.getItem("token");

      if (!token) {
        setUser(null);
        setStatus("unauthenticated");

        return null;
      }

      try {
        setStatus("loading");

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
      const token =
        localStorage.getItem("token");

      if (!token) {
        if (!cancelled) {
          setUser(null);
          setStatus("unauthenticated");
        }

        return;
      }

      try {
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
   * Login and logout both modify localStorage.
   * localStorage changes in the same browser tab do NOT
   * trigger the normal "storage" event.
   *
   * Therefore we listen to our custom auth event.
   */
  useEffect(() => {
    const handleAuthChange =
      () => {
        const token =
          localStorage.getItem("token");

        if (!token) {
          setUser(null);
          setStatus("unauthenticated");

          return;
        }

        /*
         * A token has appeared or changed.
         *
         * Re-check /auth/me instead of trusting
         * localStorage alone.
         */
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

  /**
   * Logout.
   */
  const logout =
    useCallback(() => {
      clearAuthSession();

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
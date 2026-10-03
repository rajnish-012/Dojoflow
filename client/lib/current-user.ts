"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { getCurrentUser } from "@/lib/api";
import { fetchWithSession } from "@/lib/sessionFetch";

export type CurrentUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  branch?: string | null;
  branchName?: string | null;
  dataScope?: "ALL" | "BRANCH";
  permissions?: string[];
};

/** Return the default landing page for a signed-in account role. */
export function getRoleDashboardPath(role?: string | null) {
  return String(role || "").toUpperCase() === "STUDENT"
    ? "/student-dashboard"
    : "/dashboard";
}

export const USER_UPDATED_EVENT =
  "forcstrike:user-updated";

export const AUTH_CHANGED_EVENT =
  "forcstrike:auth-changed";
export const SESSION_EXPIRED_EVENT = "forcestrike:session-expired";

/**
 * Clear all client-side authentication state.
 */
export function clearAuthSession(emitAuthEvent = true) {
  if (typeof window === "undefined") {
    return;
  }

  currentUserSnapshot = null;

  sessionStorage.removeItem(
    "dojoflow.allowed-pages",
  );

  window.dispatchEvent(
    new Event(USER_UPDATED_EVENT),
  );

  if (emitAuthEvent) window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/**
 * Store the authenticated user.
 */
export function setCurrentUser(
  user: CurrentUser,
) {
  if (typeof window === "undefined") {
    return;
  }

  currentUserSnapshot = JSON.stringify(user);

  window.dispatchEvent(
    new Event(USER_UPDATED_EVENT),
  );
}

function subscribe(
  callback: () => void,
) {
  const handleStorage = () =>
    callback();

  const handleUserUpdated = () =>
    callback();

  window.addEventListener(
    "storage",
    handleStorage,
  );

  window.addEventListener(
    USER_UPDATED_EVENT,
    handleUserUpdated,
  );

  return () => {
    window.removeEventListener(
      "storage",
      handleStorage,
    );

    window.removeEventListener(
      USER_UPDATED_EVENT,
      handleUserUpdated,
    );
  };
}

let currentUserSnapshot: string | null = null;

function getSnapshot(): string | null { return currentUserSnapshot; }

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Returns the locally available authenticated user.
 *
 * With refresh: true, /auth/me is also called.
 */
export function useCurrentUser(
  options: {
    refresh?: boolean;
  } = {},
): CurrentUser | null {
  const {
    refresh = false,
  } = options;

  const raw =
    useSyncExternalStore(
      subscribe,
      getSnapshot,
      getServerSnapshot,
    );

  useEffect(() => {
    if (!refresh) {
      return;
    }

    let cancelled = false;

    getCurrentUser()
      .then((fresh) => {
        if (cancelled) {
          return;
        }

        setCurrentUser(fresh);
      })
      .catch(() => {
        /*
         * Do not immediately destroy cached UI state
         * for ordinary network failures.
         *
         * 401 is handled by getCurrentUser().
         */
      });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return useMemo(() => {
    if (!raw) {
      return null;
    }

    try {
      const parsed =
        JSON.parse(raw);

      if (
        parsed &&
        typeof parsed === "object"
      ) {
        return parsed as CurrentUser;
      }

      return null;
    } catch {
      return null;
    }
  }, [raw]);
}

export async function logoutSession() {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  try {
    await fetchWithSession(`${apiUrl}/auth/logout`, { method: "POST" });
  } catch {
    // Clear the local UI session even if the server is temporarily unreachable.
  } finally {
    clearAuthSession();
  }
}

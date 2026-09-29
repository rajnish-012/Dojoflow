"use client";

import {
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { getCurrentUser } from "@/lib/api";

export type CurrentUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  branch?: string | null;
  permissions?: string[];
};

/** Return the default landing page for a signed-in account role. */
export function getRoleDashboardPath(role?: string | null) {
  return String(role || "").toUpperCase() === "STUDENT"
    ? "/student-dashboard"
    : "/dashboard";
}

export const USER_KEYS = [
  "user",
  "dojoUser",
  "currentUser",
] as const;

export const USER_UPDATED_EVENT =
  "forcstrike:user-updated";

export const AUTH_CHANGED_EVENT =
  "forcstrike:auth-changed";

/**
 * Clear all client-side authentication state.
 */
export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  USER_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });

  localStorage.removeItem("token");

  sessionStorage.removeItem(
    "dojoflow.allowed-pages",
  );

  window.dispatchEvent(
    new Event(USER_UPDATED_EVENT),
  );

  window.dispatchEvent(
    new Event(AUTH_CHANGED_EVENT),
  );
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

  localStorage.setItem(
    "user",
    JSON.stringify(user),
  );

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

function getSnapshot(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  for (const key of USER_KEYS) {
    const value =
      localStorage.getItem(key);

    if (value) {
      return value;
    }
  }

  return null;
}

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

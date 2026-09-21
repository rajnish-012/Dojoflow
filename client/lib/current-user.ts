import { useEffect, useMemo, useSyncExternalStore } from "react";

import { getCurrentUser } from "@/lib/api";

export type CurrentUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  branch?: string | null;
};

const USER_KEYS = ["user", "dojoUser", "currentUser"];
const USER_UPDATED_EVENT = "dojoflow:user-updated";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(USER_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(USER_UPDATED_EVENT, callback);
  };
}

function getSnapshot(): string | null {
  for (const key of USER_KEYS) {
    const value = localStorage.getItem(key);

    if (value) return value;
  }

  return null;
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * The logged-in user. Returns null until the data is available.
 *
 * It shows what was saved at login straight away. With
 * { refresh: true } it also asks the server for the current name,
 * email and role, so a change made by the Super Admin shows up
 * without logging in again.
 */
export function useCurrentUser(
  options: { refresh?: boolean } = {},
): CurrentUser | null {
  const { refresh = false } = options;

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!refresh) return;

    let cancelled = false;

    getCurrentUser()
      .then((fresh) => {
        if (cancelled) return;

        const key =
          USER_KEYS.find((item) => localStorage.getItem(item)) || "user";

        let stored: CurrentUser = {};

        try {
          stored = JSON.parse(localStorage.getItem(key) || "{}");
        } catch {
          stored = {};
        }

        const merged = { ...stored, ...fresh };

        // Only write (and notify) when something really changed.
        if (JSON.stringify(merged) !== JSON.stringify(stored)) {
          localStorage.setItem(key, JSON.stringify(merged));
          window.dispatchEvent(new Event(USER_UPDATED_EVENT));
        }
      })
      .catch(() => {
        // Keep showing the saved user if the server cannot be reached.
      });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return useMemo(() => {
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      return parsed && typeof parsed === "object"
        ? (parsed as CurrentUser)
        : null;
    } catch {
      return null;
    }
  }, [raw]);
}
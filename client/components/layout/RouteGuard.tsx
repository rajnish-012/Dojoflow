"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getMyNavigation } from "@/lib/api";

type GuardState = {
  status: "loading" | "ready" | "error";
  hrefs: string[];
};

const CACHE_KEY = "dojoflow.allowed-pages";

/*
 * The pages this user may open are remembered for the browser tab, so
 * the next page load knows the answer straight away instead of waiting
 * for the server.
 */
function readCache(): string[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);

    if (!raw) return null;

    const saved = JSON.parse(raw);

    if (
      saved?.token === localStorage.getItem("token") &&
      Array.isArray(saved.hrefs)
    ) {
      return saved.hrefs;
    }
  } catch {
    // Ignore a broken cache.
  }

  return null;
}

function writeCache(hrefs: string[]) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        token: localStorage.getItem("token"),
        hrefs,
      }),
    );
  } catch {
    // Storage can be full or blocked. Nothing to do.
  }
}

/*
 * Stops a user from opening a page that is not in their menu by
 * typing the address. The pages a user may open are exactly the
 * modules the server returns for their role.
 *
 * While the answer is not known yet the page is shown at once, so
 * the page can start loading its own data in parallel. The API
 * still refuses anything the user may not do.
 */
export default function RouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [state, setState] = useState<GuardState>(() => {
    const cached = readCache();

    return cached
      ? { status: "ready", hrefs: cached }
      : { status: "loading", hrefs: [] };
  });

  // Bump this number to load the allowed pages again.
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMyNavigation()
      .then((modules) => {
        if (cancelled) return;

        const hrefs = modules.map((item) => item.href);

        writeCache(hrefs);

        setState({ status: "ready", hrefs });
      })
      .catch(() => {
        // If the menu cannot be loaded, do not block the page.
        if (cancelled) return;

        setState((previous) =>
          previous.status === "ready"
            ? previous
            : { status: "error", hrefs: [] },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    const refresh = () => setReload((count) => count + 1);

    window.addEventListener("dojoflow:navigation-updated", refresh);

    return () => {
      window.removeEventListener("dojoflow:navigation-updated", refresh);
    };
  }, []);

  const allowed =
    state.status !== "ready" ||
    state.hrefs.some(
      (href) => pathname === href || pathname.startsWith(`${href}/`),
    );

  const target = state.hrefs[0];

  useEffect(() => {
    if (state.status === "ready" && !allowed && target) {
      router.replace(target);
    }
  }, [state.status, allowed, target, router]);

  if (state.status === "ready" && state.hrefs.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-extrabold text-(--foreground)">
          No pages available
        </h1>

        <p className="mt-2 text-sm text-(--ink-muted)">
          Your account does not have access to any pages yet. Please contact
          your administrator.
        </p>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
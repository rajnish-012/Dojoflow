"use client";

import { useEffect, useMemo, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { getMyNavigation, type NavigationModule } from "@/lib/api";

import { useAuth } from "@/hooks/userAuth";

import { hasPermission, NAVIGATION_PERMISSIONS } from "@/lib/permissions";

/* =========================================================
   TYPES
========================================================= */

type GuardState = {
  status: "loading" | "ready" | "error";
  modules: NavigationModule[];
  key: string;
};

/* =========================================================
   CONSTANTS
========================================================= */

/* System routes intentionally omitted from navigation authorization. */
const SYSTEM_ROUTES = ["/unauthorized", "/notifications"];

/* =========================================================
   SYSTEM ROUTE CHECK
========================================================= */

function isSystemRoute(pathname: string) {
  return SYSTEM_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/* =========================================================
   PERMISSION FILTER
========================================================= */

function filterModulesByPermission(
  modules: NavigationModule[],
  user: {
    role?: string | null;
    permissions?: string[];
  } | null,
): NavigationModule[] {
  if (!user) {
    return [];
  }

  const role = String(user.role || "").toUpperCase();

  return modules.filter((module) => {
    /*
     * Student dashboard is restricted to students.
     */
    if (module.key === "student-dashboard") {
      return role === "STUDENT";
    }

    const requiredPermission = NAVIGATION_PERMISSIONS[module.key];

    /*
     * Unknown/custom modules are allowed
     * when the backend has already returned them.
     */
    if (!requiredPermission) {
      return true;
    }

    return hasPermission(user, requiredPermission);
  });
}

/* =========================================================
   LOADING SCREEN
========================================================= */

function GuardLoading() {
  return (
    <div
      className="
        flex
        min-h-[calc(100vh-72px)]
        items-center
        justify-center
        px-6
      "
    >
      <div
        className="
          flex
          flex-col
          items-center
          gap-4
          text-center
        "
      >
        <div
          className="
            h-8
            w-8
            animate-spin
            rounded-full
            border-2
            border-(--line)
            border-t-(--gold)
          "
          aria-hidden="true"
        />

        <div>
          <p
            className="
              text-sm
              font-bold
              text-(--foreground)
            "
          >
            Checking access...
          </p>

          <p
            className="
              mt-1
              text-xs
              text-(--ink-muted)
            "
          >
            Verifying your permissions.
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ROUTE GUARD
========================================================= */

export default function RouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const router = useRouter();

  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  /*
   * /unauthorized is a system page.
   *
   * It must not itself be protected by the navigation
   * permission check, otherwise an unauthorized user
   * would be redirected back to /unauthorized forever.
   */
  const systemRoute = isSystemRoute(pathname);

  const [state, setState] = useState<GuardState>({
    status: "loading",
    modules: [],
    key: "",
  });

  const [reload, setReload] = useState(0);

  const navigationKey = `${user?.id || ""}:${user?.role || ""}:${reload}`;

  /* =======================================================
     LOAD SERVER NAVIGATION
  ======================================================= */

  useEffect(() => {
    /*
     * System routes do not need navigation authorization.
     */
    if (systemRoute) {
      return;
    }

    /*
     * Do not call the navigation API before authentication
     * has been established.
     */
    if (authLoading || !isAuthenticated || !user) {
      return;
    }

    let cancelled = false;

    getMyNavigation()
      .then((modules) => {
        if (cancelled) {
          return;
        }

        setState({
          status: "ready",
          modules,
          key: navigationKey,
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setState({ status: "error", modules: [], key: navigationKey });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, user, reload, systemRoute, navigationKey]);

  /* =======================================================
     NAVIGATION UPDATE EVENT
  ======================================================= */

  useEffect(() => {
    const refresh = () => setReload((count) => count + 1);

    window.addEventListener("dojoflow:navigation-updated", refresh);

    return () => {
      window.removeEventListener("dojoflow:navigation-updated", refresh);
    };
  }, []);

  /* =======================================================
     FILTERED MODULES
  ======================================================= */

  const allowedModules = useMemo(() => {
    return filterModulesByPermission(state.modules, user);
  }, [state.modules, user]);

  /* =======================================================
     ALLOWED ROUTES
  ======================================================= */

  const allowedHrefs = useMemo(() => {
    return allowedModules.map((module) => module.href);
  }, [allowedModules]);

  /*
   * A route is allowed if:
   *
   * /students
   *
   * matches:
   *
   * /students
   * /students/123
   * /students/123/progress
   * /students/123/timeline
   */
  const allowed =
    systemRoute ||
    (state.status === "ready" &&
      state.key === navigationKey &&
      allowedHrefs.some(
        (href) => pathname === href || pathname.startsWith(`${href}/`),
      ));

  /* =======================================================
     UNAUTHORIZED REDIRECTION
  ======================================================= */

  useEffect(() => {
    /*
     * System pages must never redirect through
     * the normal navigation authorization flow.
     */
    if (systemRoute) {
      return;
    }

    /*
     * Don't redirect while authentication is still loading.
     */
    if (authLoading) {
      return;
    }

    /*
     * AppShell handles unauthenticated users.
     */
    if (!isAuthenticated || !user) {
      return;
    }

    /*
     * Don't make a routing decision until the backend
     * navigation response has been resolved.
     */
    if (state.status !== "ready" || state.key !== navigationKey) {
      return;
    }

    /*
     * No allowed pages at all.
     */
    if (allowedHrefs.length === 0) {
      router.replace("/unauthorized");

      return;
    }

    /*
     * Current page is not authorized.
     */
    if (!allowed) {
      router.replace("/unauthorized");
    }
  }, [
    authLoading,
    isAuthenticated,
    user,
    state.status,
    state.key,
    navigationKey,
    allowed,
    allowedHrefs.length,
    systemRoute,
    router,
  ]);

  /* =======================================================
     AUTH LOADING
  ======================================================= */

  if (authLoading) {
    return <GuardLoading />;
  }

  /* =======================================================
     AUTHENTICATION FAILED
  ======================================================= */

  if (!isAuthenticated || !user) {
    return null;
  }

  /* =======================================================
     SYSTEM PAGE
  ======================================================= */

  /*
   * IMPORTANT:
   *
   * Render /unauthorized normally once the user has
   * been authenticated. Do not require it to exist
   * inside the navigation modules.
   */
  if (systemRoute) {
    return <>{children}</>;
  }

  /* =======================================================
     NAVIGATION LOADING
  ======================================================= */

  if (state.status === "loading" || state.key !== navigationKey) {
    return <GuardLoading />;
  }

  /* =======================================================
     NAVIGATION ERROR
  ======================================================= */

  if (state.status === "error") {
    return (
      <div
        className="
          flex
          min-h-[calc(100vh-72px)]
          items-center
          justify-center
          px-6
        "
      >
        <div
          className="
            max-w-md
            text-center
          "
        >
          <h1
            className="
              text-xl
              font-extrabold
              text-(--foreground)
            "
          >
            Unable to verify access
          </h1>

          <p
            className="
              mt-2
              text-sm
              leading-6
              text-(--ink-muted)
            "
          >
            We could not load your navigation permissions. Please refresh the
            page or contact your administrator.
          </p>

          <button
            type="button"
            onClick={() => setReload((count) => count + 1)}
            className="
              mt-5
              rounded-xl
              bg-(--gold)
              px-4
              py-2.5
              text-sm
              font-bold
              text-(--sidebar-active-text)
              transition-opacity
              hover:opacity-90
            "
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     NO ACCESS
  ======================================================= */

  if (allowedModules.length === 0) {
    return null;
  }

  /* =======================================================
     UNAUTHORIZED CURRENT ROUTE
  ======================================================= */

  if (!allowed) {
    return null;
  }

  /* =======================================================
     AUTHORIZED
  ======================================================= */

  return <>{children}</>;
}

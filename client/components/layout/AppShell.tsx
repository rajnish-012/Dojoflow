"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import Sidebar from "./Sidebar";
import Header from "./Header";

/* =========================================================
   TYPES
   ========================================================= */

type AppShellProps = {
  children: React.ReactNode;
};

/* =========================================================
   PUBLIC ROUTES
   ========================================================= */

const publicRoutes = [
  "/",
  "/login",
  "/inquiry",
];

function isPublicPath(pathname: string) {
  return publicRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }

    return (
      pathname === route ||
      pathname.startsWith(`${route}/`)
    );
  });
}

/* =========================================================
   APPLICATION LOADING SCREEN
   ========================================================= */

function AppLoadingScreen() {
  return (
    <div
      className="
        flex
        min-h-screen
        items-center
        justify-center
        bg-(--background)
        text-(--foreground)
      "
    >
      <div
        className="
          flex
          flex-col
          items-center
          gap-5
        "
      >
        {/* Logo */}

        <div
          className="
            flex
            h-14
            w-14
            items-center
            justify-center
            rounded-2xl
            border
            border-(--line)
            bg-(--card)
            text-(--gold)
            shadow-[0_8px_30px_var(--shadow-color)]
            animate-pulse
          "
        >
          <span
            className="
              text-xl
              font-extrabold
              tracking-tight
            "
          >
            D
          </span>
        </div>

        {/* Loading text */}

        <div className="text-center">
          <p
            className="
              text-sm
              font-bold
              text-(--foreground)
            "
          >
            Loading DojoFlow
          </p>

          <p
            className="
              mt-1
              text-xs
              font-medium
              text-(--ink-muted)
            "
          >
            Preparing your workspace...
          </p>
        </div>

        {/* Loading indicator */}

        <div
          className="
            h-1
            w-24
            overflow-hidden
            rounded-full
            bg-(--line)
          "
        >
          <div
            className="
              h-full
              w-1/2
              rounded-full
              bg-(--gold)
              animate-[df-loading_1.2s_ease-in-out_infinite]
            "
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   APP SHELL
   ========================================================= */

export default function AppShell({
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [isCheckingAuth, setIsCheckingAuth] =
    useState(true);

  const [isAuthenticated, setIsAuthenticated] =
    useState(false);

  const isPublicRoute =
    isPublicPath(pathname);

  /* =======================================================
     AUTHENTICATION CHECK
     ======================================================= */

  useEffect(() => {
    /*
     * Public pages do not require authentication.
     */

    if (isPublicRoute) {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);

      return;
    }

    /*
     * Protected routes require both:
     * - token
     * - stored user
     */

    const token =
      localStorage.getItem("token");

    const storedUser =
      localStorage.getItem("user") ||
      localStorage.getItem("dojoUser") ||
      localStorage.getItem("currentUser");

    /*
     * Authentication failed.
     */

    if (!token || !storedUser) {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);

      router.replace("/login");

      return;
    }

    /*
     * Authentication successful.
     */

    setIsAuthenticated(true);
    setIsCheckingAuth(false);
  }, [isPublicRoute, router]);

  /* =======================================================
     CLOSE MOBILE SIDEBAR AFTER NAVIGATION
     ======================================================= */

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  /* =======================================================
     PUBLIC PAGE
     ======================================================= */

  if (isPublicRoute) {
    return <>{children}</>;
  }

  /* =======================================================
     AUTHENTICATION LOADING
     ======================================================= */

  if (isCheckingAuth) {
    return <AppLoadingScreen />;
  }

  /* =======================================================
     UNAUTHENTICATED
     ======================================================= */

  if (!isAuthenticated) {
    return null;
  }

  /* =======================================================
     PRIVATE APPLICATION
     ======================================================= */

  return (
    <div
      className="
        min-h-screen
        bg-(--background)
        text-(--foreground)
        transition-colors
        duration-300
      "
    >
      {/* ===================================================
          SIDEBAR
          =================================================== */}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        collapsed={sidebarCollapsed}
        onToggleCollapse={() =>
          setSidebarCollapsed(
            (previous) => !previous
          )
        }
      />

      {/* ===================================================
          MAIN APPLICATION AREA
          =================================================== */}

      <div
        className={[
          "df-app-shell",
          sidebarCollapsed
            ? "df-shell-collapsed"
            : "df-shell-expanded",
        ].join(" ")}
      >
        {/* =================================================
            HEADER
            ================================================= */}

        <Header
          onMenuClick={() =>
            setSidebarOpen(true)
          }
        />

        {/* =================================================
            PAGE CONTENT
            ================================================= */}

        <main
          className="
            min-h-[calc(100vh-72px)]
            bg-(--background)
            text-(--foreground)
            transition-colors
            duration-300
          "
        >
          {children}
        </main>
      </div>
    </div>
  );
}
"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import Sidebar from "./Sidebar";
import Header from "./Header";
import RouteGuard from "./RouteGuard";

import { useAuth } from "@/hooks/userAuth";
import { getRoleDashboardPath } from "@/lib/current-user";

import AcademyBrandProvider from "@/components/settings/AcademyBrandProvider";

type AppShellProps = {
  children: React.ReactNode;
};

const publicRoutes = [
  "/",
  "/login",
  "/inquiry",
];

function isPublicPath(
  pathname: string,
) {
  return publicRoutes.some(
    (route) => {
      if (route === "/") {
        return pathname === "/";
      }

      return (
        pathname === route ||
        pathname.startsWith(
          `${route}/`,
        )
      );
    },
  );
}

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
        <div
          className="
            flex
            h-14
            w-14
            items-center
            justify-center
            overflow-hidden
            rounded-2xl
            border
            border-(--line)
            bg-(--card)
            text-(--gold)
            shadow-[0_8px_30px_var(--shadow-color)]
            animate-pulse
          "
        >
          <img
            src="/logo.png"
            alt="DojoFlow"
            className="
              h-11
              w-11
              object-contain
            "
          />
        </div>

        <div className="text-center">
          <p
            className="
              text-sm
              font-black
              tracking-wide
              text-(--foreground)
            "
          >
            Loading DojoFlow
          </p>

          <p
            className="
              mt-1
              text-xs
              text-(--ink-muted)
            "
          >
            Preparing your workspace...
          </p>
        </div>

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

export default function AppShell({
  children,
}: AppShellProps) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const {
    isLoading,
    isAuthenticated,
    user,
  } = useAuth();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false);

  const isPublicRoute =
    isPublicPath(pathname);

  useEffect(() => {
    if (
      !isPublicRoute &&
      isLoading
    ) {
      return;
    }

    if (
      isPublicRoute &&
      pathname === "/login" &&
      isAuthenticated
    ) {
      router.replace(getRoleDashboardPath(user?.role));
    }
  }, [
    isPublicRoute,
    pathname,
    isAuthenticated,
    user?.role,
    isLoading,
    router,
  ]);

  useEffect(() => {
    if (isPublicRoute) {
      return;
    }

    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      const redirect =
        pathname &&
        pathname !== "/login"
          ? `?redirect=${encodeURIComponent(
              pathname,
            )}`
          : "";

      router.replace(
        `/login${redirect}`,
      );
    }
  }, [
    isPublicRoute,
    isLoading,
    isAuthenticated,
    pathname,
    router,
  ]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AcademyBrandProvider>
      <div
        className="
          min-h-screen
          bg-(--background)
          text-(--foreground)
          transition-colors
          duration-300
        "
      >
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() =>
            setSidebarOpen(false)
          }
          collapsed={
            sidebarCollapsed
          }
          onToggleCollapse={() =>
            setSidebarCollapsed(
              (previous) =>
                !previous,
            )
          }
        />

        <div
          className={[
            "df-app-shell",
            sidebarCollapsed
              ? "df-shell-collapsed"
              : "df-shell-expanded",
          ].join(" ")}
        >
          <Header
            onMenuClick={() =>
              setSidebarOpen(true)
            }
          />

          <main
            className="
              min-h-[calc(100vh-72px)]
              bg-(--background)
              text-(--foreground)
              transition-colors
              duration-300
            "
          >
            <RouteGuard>
              {children}
            </RouteGuard>
          </main>
        </div>
      </div>
    </AcademyBrandProvider>
  );
}

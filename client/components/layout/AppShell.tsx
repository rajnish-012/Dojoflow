"use client";

import { useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import Sidebar from "./Sidebar";
import Header from "./Header";
import RouteGuard from "./RouteGuard";

import { useAuth } from "@/hooks/userAuth";

import AcademyBrandProvider from "@/components/settings/AcademyBrandProvider";
import {
  AcademyLogo,
  useAcademyBrand,
} from "@/components/settings/AcademyBrandProvider";

type AppShellProps = {
  children: React.ReactNode;
};

const publicRoutes = [
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/inquiry",
  "/merchandise",
];

function isPublicPath(pathname: string) {
  return publicRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }

    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function AppLoadingScreen({ showBrand = true }: { showBrand?: boolean }) {
  const { settings } = useAcademyBrand();
  const academyName = settings.academyName.trim() || "Your Academy";

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
        {showBrand && (
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
            <AcademyLogo
              className="
              h-11
              w-11
              object-contain
            "
            />
          </div>
        )}

        <div className="text-center">
          {showBrand && (
            <p
              className="
              text-sm
              font-black
              tracking-wide
              text-(--foreground)
            "
            >
              Loading {academyName}
            </p>
          )}

          <p
            className="
              mt-1
              text-xs
              text-(--ink-muted)
            "
          >
            {showBrand && settings.tagline.trim()
              ? settings.tagline.trim()
              : "Preparing your workspace..."}
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

function AuthenticatedAppShell({ children }: AppShellProps) {
  const { initialized: academyBrandInitialized } = useAcademyBrand();
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [desktopSidebarLayout, setDesktopSidebarLayout] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const syncDesktopLayout = () => setDesktopSidebarLayout(desktopQuery.matches);

    syncDesktopLayout();
    desktopQuery.addEventListener("change", syncDesktopLayout);
    return () => desktopQuery.removeEventListener("change", syncDesktopLayout);
  }, []);

  const isSidebarCollapsed = sidebarCollapsed && desktopSidebarLayout;

  useEffect(() => {
    if (isLoading || isAuthenticated) {
      return;
    }

    const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${redirect}`);
  }, [isLoading, isAuthenticated, pathname, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSidebarOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!academyBrandInitialized) {
    return <AppLoadingScreen showBrand={false} />;
  }

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated) {
    return null;
  }

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
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((previous) => !previous)}
      />

      <div
        className={[
          "df-app-shell",
          isSidebarCollapsed ? "df-shell-collapsed" : "df-shell-expanded",
        ].join(" ")}
      >
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main
          className="
              min-h-[calc(100vh-72px)]
              bg-(--background)
              text-(--foreground)
              transition-colors
              duration-300
            "
        >
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
    </div>
  );
}

function AppShellContent({ children }: AppShellProps) {
  const pathname = usePathname();

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}

export default function AppShell(props: AppShellProps) {
  return (
    <AcademyBrandProvider>
      <AppShellContent {...props} />
    </AcademyBrandProvider>
  );
}

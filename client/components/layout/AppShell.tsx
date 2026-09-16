"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";

type AppShellProps = {
  children: React.ReactNode;
};

const publicRoutes = ["/", "/login", "/inquiry"];

function isPublicPath(pathname: string) {
  return publicRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }

    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function AppLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-[#101a33] text-[#d7a84b] shadow-lg">
          <span className="text-xl font-extrabold">D</span>
        </div>

        <div className="text-center">
          <p className="text-sm font-bold text-[#101a33]">
            Loading DojoFlow
          </p>

          <p className="mt-1 text-xs text-[#7b879b]">
            Preparing your workspace...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isPublicRoute = isPublicPath(pathname);

  /*
   * Authentication is checked when the application starts
   * and when the route changes to a protected route.
   *
   * The shell itself remains mounted after authentication.
   */
  useEffect(() => {
    if (isPublicRoute) {
      setIsCheckingAuth(false);
      setIsAuthenticated(false);
      return;
    }

    const token = localStorage.getItem("token");

    const storedUser =
      localStorage.getItem("user") ||
      localStorage.getItem("dojoUser") ||
      localStorage.getItem("currentUser");

    if (!token || !storedUser) {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
      router.replace("/login");
      return;
    }

    setIsAuthenticated(true);
    setIsCheckingAuth(false);
  }, [isPublicRoute, router]);

  /*
   * Close only the mobile sidebar after navigation.
   * This does not remount the Sidebar.
   */
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  /*
   * Public pages do not need the dashboard shell.
   */
  if (isPublicRoute) {
    return <>{children}</>;
  }

  /*
   * Show the loader only while the initial auth check is running.
   */
  if (isCheckingAuth) {
    return <AppLoadingScreen />;
  }

  /*
   * If authentication failed, the redirect will take the user
   * to the login page. Avoid rendering the private dashboard.
   */
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() =>
          setSidebarCollapsed((previous) => !previous)
        }
      />

      <div
        className={[
          "min-h-screen transition-[margin] duration-300 ease-in-out",
          sidebarCollapsed ? "md:ml-[84px]" : "md:ml-[260px]",
        ].join(" ")}
      >
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="min-h-[calc(100vh-76px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
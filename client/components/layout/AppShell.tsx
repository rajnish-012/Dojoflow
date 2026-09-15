"use client";

import React, { useEffect, useState } from "react";
import { Menu, Search, Bell, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

type UserRole =
  | "SUPER_ADMIN"
  | "BRANCH_ADMIN"
  | "COACH"
  | "STUDENT";

const publicRoutes = ["/", "/login", "/inquiry"];

const routePermissions: Record<string, UserRole[]> = {
  "/dashboard": ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  "/students": ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  "/plans": ["SUPER_ADMIN", "BRANCH_ADMIN"],
  "/branches": ["SUPER_ADMIN"],
  "/curriculum": ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  "/attendance": ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  "/performance": ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  "/inquiries": ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  "/settings": ["SUPER_ADMIN"],
  "/student-dashboard": ["STUDENT"],
};

function getRequiredRoles(pathname: string) {
  const matchedRoute = Object.keys(routePermissions).find((route) => {
    return pathname === route || pathname.startsWith(`${route}/`);
  });

  return matchedRoute ? routePermissions[matchedRoute] : null;
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] =
    useState(false);

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    if (isPublicRoute) {
      setIsCheckingAuth(false);
      return;
    }

    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      const userRole = user.role as UserRole;
      const requiredRoles = getRequiredRoles(pathname);

      if (
        requiredRoles &&
        !requiredRoles.includes(userRole)
      ) {
        if (userRole === "STUDENT") {
          router.replace("/student-dashboard");
        } else {
          router.replace("/dashboard");
        }

        return;
      }

      setIsCheckingAuth(false);
    } catch (error) {
      console.error("Authentication check failed:", error);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      router.replace("/login");
    }
  }, [pathname, router, isPublicRoute]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 md:hidden ${
          isMobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="relative h-full">
          <Sidebar />

          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Application Area */}
      <div className="min-h-screen md:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Search */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                placeholder="Search students, plans..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="ml-3 flex shrink-0 items-center gap-3 sm:gap-5">
            {/* Notification */}
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />

              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>

            <div className="hidden h-8 w-px bg-slate-200 sm:block" />

            {/* User Info */}
            <UserHeader />
          </div>
        </header>

        {/* Page Content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function UserHeader() {
  const [user, setUser] = useState<{
    name?: string;
    role?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    }
  }, []);

  const name = user?.name || "User";
  const role = user?.role || "";

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const formattedRole = role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white sm:h-10 sm:w-10">
        {initials || "U"}
      </div>

      <div className="hidden min-w-0 sm:block">
        <p className="max-w-32 truncate text-sm font-semibold text-slate-900">
          {name}
        </p>

        <p className="max-w-32 truncate text-xs text-slate-500">
          {formattedRole}
        </p>
      </div>

      <span className="hidden text-slate-400 sm:block">⌄</span>
    </div>
  );
}
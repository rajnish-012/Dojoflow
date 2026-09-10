"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import Sidebar from "./Sidebar";
import Header from "./Header";

type UserRole =
  | "SUPER_ADMIN"
  | "BRANCH_ADMIN"
  | "COACH"
  | "STUDENT";

type RoutePermission = {
  prefix: string;
  roles: UserRole[];
};

const routePermissions: RoutePermission[] = [
  {
    prefix: "/dashboard",
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    prefix: "/students",
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    prefix: "/plans",
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },
  {
    prefix: "/curriculum",
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    prefix: "/attendance",
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    prefix: "/performance",
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    prefix: "/settings",
    roles: ["SUPER_ADMIN"],
  },

  // Student portal
  {
    prefix: "/student-dashboard",
    roles: ["STUDENT"],
  },
];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // Public pages
  const isPublicPage = pathname === "/" || pathname === "/login";

  useEffect(() => {
    // Home page and login page are public
    if (isPublicPage) {
      setCheckingAuth(false);
      setAuthorized(true);
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setAuthorized(false);
      setCheckingAuth(false);
      router.replace("/login");
      return;
    }

    try {
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        localStorage.removeItem("token");
        setAuthorized(false);
        setCheckingAuth(false);
        router.replace("/login");
        return;
      }

      const user = JSON.parse(storedUser);
      const role = user.role as UserRole;

      // Find route restriction
      const matchedRoute = routePermissions.find(
        (route) =>
          pathname === route.prefix ||
          pathname.startsWith(`${route.prefix}/`)
      );

      // If this route has no special restriction,
      // allow authenticated users to access it.
      if (!matchedRoute) {
        setAuthorized(true);
        setCheckingAuth(false);
        return;
      }

      // Check whether user's role can access this route
      if (matchedRoute.roles.includes(role)) {
        setAuthorized(true);
        setCheckingAuth(false);
        return;
      }

      // User is authenticated but not authorized
      setAuthorized(false);
      setCheckingAuth(false);

      // Students should always go to their own portal
      if (role === "STUDENT") {
        router.replace("/student-dashboard");
      } else {
        router.replace("/dashboard");
      }
    } catch (error) {
      console.error(
        "Failed to check user authorization:",
        error
      );

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      setAuthorized(false);
      setCheckingAuth(false);

      router.replace("/login");
    }
  }, [isPublicPage, pathname, router]);

  // Public pages should never show
  // dashboard sidebar/header.
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Don't render protected pages until
  // authentication and authorization are checked.
  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

          <p className="mt-3 text-sm text-slate-500">
            Checking authorization...
          </p>
        </div>
      </div>
    );
  }

  // If the user is not authorized,
  // don't render the restricted page
  // while redirecting.
  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

          <p className="mt-3 text-sm text-slate-500">
            Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <div className="ml-64">
        <Header />

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
"use client";

import React from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  Settings,
  LogOut,
  UserCircle,
  ClipboardList,
  Building2,
  Trophy,
  X,
} from "lucide-react";

import { usePathname, useRouter } from "next/navigation";

type UserRole = "SUPER_ADMIN" | "BRANCH_ADMIN" | "COACH" | "STUDENT";

type MenuItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const managementMenu: Record<Exclude<UserRole, "STUDENT">, MenuItem[]> = {
  SUPER_ADMIN: [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Students",
      href: "/students",
      icon: Users,
    },
    {
      label: "Branches",
      href: "/branches",
      icon: Building2,
    },
    {
      label: "Inquiries",
      href: "/inquiries",
      icon: ClipboardList,
    },
    {
      label: "Plans",
      href: "/plans",
      icon: CreditCard,
    },
    {
      label: "Curriculum",
      href: "/curriculum",
      icon: BookOpen,
    },
    {
      label: "Attendance",
      href: "/attendance",
      icon: ClipboardCheck,
    },
    {
      label: "Performance",
      href: "/performance",
      icon: BarChart3,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ],

  BRANCH_ADMIN: [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Students",
      href: "/students",
      icon: Users,
    },
    {
      label: "Inquiries",
      href: "/inquiries",
      icon: ClipboardList,
    },
    {
      label: "Plans",
      href: "/plans",
      icon: CreditCard,
    },
    {
      label: "Curriculum",
      href: "/curriculum",
      icon: BookOpen,
    },
    {
      label: "Attendance",
      href: "/attendance",
      icon: ClipboardCheck,
    },
    {
      label: "Performance",
      href: "/performance",
      icon: BarChart3,
    },
  ],

  COACH: [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Students",
      href: "/students",
      icon: Users,
    },
    {
      label: "Inquiries",
      href: "/inquiries",
      icon: ClipboardList,
    },
    {
      label: "Curriculum",
      href: "/curriculum",
      icon: BookOpen,
    },
    {
      label: "Attendance",
      href: "/attendance",
      icon: ClipboardCheck,
    },
    {
      label: "Performance",
      href: "/performance",
      icon: BarChart3,
    },
  ],
};

const studentMenu: MenuItem[] = [
  {
    label: "My Dashboard",
    href: "/student-dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Profile",
    href: "/student-dashboard",
    icon: UserCircle,
  },
  {
    label: "My Progress",
    href: "/student-dashboard",
    icon: Trophy,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [userRole, setUserRole] = React.useState<UserRole | null>(null);

  const [userName, setUserName] = React.useState("");
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        return;
      }

      const user = JSON.parse(storedUser);

      setUserRole(user.role as UserRole);
      setUserName(user.name || user.fullName || "");
    } catch (error) {
      console.error("Failed to load sidebar user:", error);
    }
  }, []);

  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    router.replace("/login");
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsMobileOpen(false);
  };

  const isStudent = userRole === "STUDENT";

  const menuItems = isStudent
    ? studentMenu
    : userRole
      ? managementMenu[userRole]
      : [];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Menu Button */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open navigation menu"
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
      >
        <LayoutDashboard className="h-5 w-5" />
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:z-40 lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo Section */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 px-6">
          <button
            type="button"
            onClick={() =>
              handleNavigation(isStudent ? "/student-dashboard" : "/dashboard")
            }
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <Trophy className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                DojoFlow
              </h1>

              <p className="text-xs text-slate-500">Karate Academy</p>
            </div>
          </button>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isStudent ? "Student Portal" : "Management"}
          </p>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;

              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <button
                  key={`${item.label}-${item.href}`}
                  type="button"
                  onClick={() => handleNavigation(item.href)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />

                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Information */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                <UserCircle className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">
                  Logged in as
                </p>

                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {userName || (isStudent ? "Student" : "Administrator")}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {isStudent
                    ? "Student Account"
                    : userRole === "SUPER_ADMIN"
                      ? "Super Admin"
                      : userRole === "BRANCH_ADMIN"
                        ? "Branch Admin"
                        : "Coach"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <div className="shrink-0 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

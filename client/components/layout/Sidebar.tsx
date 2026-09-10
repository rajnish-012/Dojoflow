"use client";

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
  Trophy,
} from "lucide-react";

import { usePathname, useRouter } from "next/navigation";

type UserRole =
  | "SUPER_ADMIN"
  | "BRANCH_ADMIN"
  | "COACH"
  | "STUDENT";

type MenuItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const managementMenu: Record<
  Exclude<UserRole, "STUDENT">,
  MenuItem[]
> = {
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

  const [userRole, setUserRole] =
    React.useState<UserRole | null>(null);

  const [userName, setUserName] = React.useState("");

  React.useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        return;
      }

      const user = JSON.parse(storedUser);

      setUserRole(user.role as UserRole);
      setUserName(user.name || "");
    } catch (error) {
      console.error(
        "Failed to load sidebar user:",
        error
      );
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    router.replace("/login");
  };

  const isStudent = userRole === "STUDENT";

  const menuItems = isStudent
    ? studentMenu
    : userRole
      ? managementMenu[userRole]
      : [];

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-20 items-center border-b border-slate-200 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Trophy className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-lg font-bold text-slate-900">
              DojoFlow
            </h1>

            <p className="text-xs text-slate-500">
              Karate Academy
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {isStudent ? "Student Portal" : "Management"}
        </p>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <button
                key={`${item.label}-${item.href}`}
                onClick={() => router.push(item.href)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />

                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Student information */}
        {isStudent && (
          <div className="mt-8 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-400">
              Logged in as
            </p>

            <p className="mt-1 truncate text-sm font-semibold text-slate-900">
              {userName || "Student"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Student Account
            </p>
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="border-t border-slate-200 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-5 w-5" />

          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

// React is used for useState/useEffect above.
import React from "react";
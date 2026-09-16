"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  RefreshCw,
  X,
} from "lucide-react";

type UserRole = "SUPER_ADMIN" | "BRANCH_ADMIN" | "COACH" | "STUDENT" | string;

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
};

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    label: "Students",
    href: "/students",
    icon: Users,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    label: "Plans",
    href: "/plans",
    icon: ClipboardList,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },
  {
    label: "Curriculum",
    href: "/curriculum",
    icon: BookOpen,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    label: "Attendance",
    href: "/attendance",
    icon: CalendarCheck,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    label: "Performance",
    href: "/performance",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    label: "Makeups",
    href: "/makeups",
    icon: RefreshCw,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    label: "Inquiries",
    href: "/inquiries",
    icon: FileText,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },
  {
    label: "Branches",
    href: "/branches",
    icon: Trophy,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["SUPER_ADMIN"],
  },
];

const studentNavigationItems: NavigationItem[] = [
  {
    label: "My Dashboard",
    href: "/student-dashboard",
    icon: LayoutDashboard,
    roles: ["STUDENT"],
  },
];

function getStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedUser =
      localStorage.getItem("user") ||
      localStorage.getItem("dojoUser") ||
      localStorage.getItem("currentUser");

    if (!storedUser) {
      return null;
    }

    return JSON.parse(storedUser);
  } catch {
    return null;
  }
}

export default function Sidebar({
  isOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const user = getStoredUser();

  const role: UserRole = user?.role || "SUPER_ADMIN";
  const logoHref = role === "STUDENT" ? "/student-dashboard" : "/dashboard";

  const items = role === "STUDENT" ? studentNavigationItems : navigationItems;

  const visibleItems = items.filter((item) => {
    if (!item.roles || item.roles.length === 0) {
      return true;
    }

    return item.roles.includes(role);
  });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("dojoUser");
    localStorage.removeItem("currentUser");

    window.location.href = "/login";
  };

  const isActive = (href: string) => {
    if (href === "/dashboard" || href === "/student-dashboard") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#071126]/55 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={[
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/10 bg-[#0b142b] text-white shadow-2xl transition-all duration-300",
          collapsed ? "w-[84px]" : "w-[260px]",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        {/* Brand */}
        <div
          className={[
            "flex h-[76px] shrink-0 items-center border-b border-white/10",
            collapsed ? "justify-center px-3" : "justify-between px-5",
          ].join(" ")}
        >
          <Link
            href={logoHref}
            onClick={onClose}
            className={[
              "flex min-w-0 items-center",
              collapsed ? "justify-center" : "gap-3",
            ].join(" ")}
          >
            {/* Logo */}
            <div
              className={[
                "relative flex shrink-0 items-center justify-center overflow-hidden",
                collapsed ? "h-11 w-11" : "h-11 w-11",
              ].join(" ")}
            >
              <Image
                src="/logo.png"
                alt="DojoFlow Logo"
                width={44}
                height={44}
                priority
                className="h-full w-full object-contain"
              />
            </div>

            {/* Brand name */}
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-[17px] font-extrabold tracking-tight">
                  Dojo<span className="text-[#d7a84b]">Flow</span>
                </p>

                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Martial Arts OS
                </p>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>

        {/* Workspace label */}
        {!collapsed && (
          <div className="px-5 pb-2 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Workspace
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={[
                    "group relative flex items-center rounded-xl py-3 text-[13px] font-semibold",
                    collapsed ? "justify-center px-3" : "gap-3 px-3.5",
                    active
                      ? "bg-[#d7a84b] text-[#101a33] shadow-lg shadow-[#d7a84b]/10"
                      : "text-slate-300 hover:bg-white/[0.07] hover:text-white",
                  ].join(" ")}
                >
                  {active && (
                    <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#d7a84b]" />
                  )}

                  <Icon
                    size={18}
                    strokeWidth={active ? 2.5 : 2}
                    className={[
                      "shrink-0",
                      active
                        ? "text-[#101a33]"
                        : "text-slate-400 group-hover:text-[#d7a84b]",
                    ].join(" ")}
                  />

                  {!collapsed && <span className="truncate">{item.label}</span>}

                  {!collapsed && active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#101a33]" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/10 p-3">
          {!collapsed && (
            <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d7a84b]/15 text-[#d7a84b]">
                  <ShieldCheck size={17} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-white">
                    {user?.name || "Dojo Administrator"}
                  </p>

                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {String(role).replaceAll("_", " ")}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={[
              "group flex w-full items-center rounded-xl py-3 text-[13px] font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-300",
              collapsed ? "justify-center px-3" : "gap-3 px-3.5",
            ].join(" ")}
          >
            <LogOut size={18} className="shrink-0 group-hover:text-red-300" />

            {!collapsed && <span>Logout</span>}
          </button>

          {/* Collapse button - desktop only */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={[
                "mt-2 hidden w-full items-center rounded-xl py-3 text-[13px] font-semibold text-slate-500 hover:bg-white/[0.06] hover:text-white md:flex",
                collapsed ? "justify-center px-3" : "gap-3 px-3.5",
              ].join(" ")}
            >
              <ChevronLeft
                size={18}
                className={[
                  "shrink-0 transition-transform duration-300",
                  collapsed ? "rotate-180" : "",
                ].join(" ")}
              />

              {!collapsed && <span>Collapse sidebar</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

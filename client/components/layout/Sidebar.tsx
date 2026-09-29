"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ChevronLeft,
  LogOut,
  X,
} from "lucide-react";

import {
  getMyNavigation,
  type NavigationModule,
  getBranches,
} from "@/lib/api";

import {
  clearAuthSession,
  useCurrentUser,
} from "@/lib/current-user";

import {
  hasPermission,
  NAVIGATION_PERMISSIONS,
} from "@/lib/permissions";

import { getNavigationIcon } from "@/lib/navigation-icons";

import { useAcademyBrand } from "@/components/settings/AcademyBrandProvider";

/* =========================================================
   TYPES
========================================================= */

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

/* =========================================================
   CONSTANTS
========================================================= */

const SIDEBAR_WIDTH = {
  expanded: 260,
  collapsed: 84,
} as const;

/* =========================================================
   HELPERS
========================================================= */

function formatRole(role: string) {
  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

/**
 * Determines whether the authenticated user can see
 * a navigation module.
 *
 * The backend already filters modules by role.
 * This is an additional frontend permission check.
 */
function canSeeNavigationItem(
  user: ReturnType<typeof useCurrentUser>,
  item: NavigationModule,
): boolean {
  if (!user) {
    return false;
  }

  const role = String(
    user.role || "",
  ).toUpperCase();

  /*
   * Student dashboard is intentionally available only
   * to the STUDENT role.
   */
  if (item.key === "student-dashboard") {
    return role === "STUDENT";
  }

  /*
   * If this module has a known frontend permission,
   * require that permission.
   */
  const requiredPermission =
    NAVIGATION_PERMISSIONS[item.key];

  if (requiredPermission) {
    return hasPermission(
      user,
      requiredPermission,
    );
  }

  /*
   * Unknown/custom modules are already filtered by
   * the backend's /modules/navigation endpoint.
   *
   * We therefore keep them visible here rather than
   * accidentally hiding administrator-created modules.
   */
  return true;
}

/* =========================================================
   SIDEBAR
========================================================= */

export default function Sidebar({
  isOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();

  const user = useCurrentUser();

  const {
    settings: academySettings,
  } = useAcademyBrand();

  const role = String(
    user?.role || "",
  ).toUpperCase();

  const [branchName, setBranchName] =
    useState("");

  const logoHref =
    role === "STUDENT"
      ? "/student-dashboard"
      : "/dashboard";

  /* =======================================================
     BRANCH NAME
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    if (!user?.branch) {
      setBranchName("All Branches");
      return;
    }

    const branchValue =
      user.branch as unknown as
        | string
        | {
            _id?: string;
            name?: string;
          }
        | null
        | undefined;

    if (
      branchValue &&
      typeof branchValue === "object" &&
      branchValue.name
    ) {
      setBranchName(
        branchValue.name,
      );
      return;
    }

    const branchId =
      typeof branchValue === "string"
        ? branchValue
        : branchValue?._id;

    if (!branchId) {
      setBranchName("All Branches");
      return;
    }

    getBranches()
      .then((result) => {
        if (cancelled) {
          return;
        }

        const branches = Array.isArray(
          result?.branches,
        )
          ? result.branches
          : [];

        const branch =
          branches.find(
            (item: { _id?: string }) =>
              item._id === branchId,
          );

        setBranchName(
          branch?.name ||
            "Assigned Branch",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setBranchName(
            "Assigned Branch",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.branch]);

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const [navItems, setNavItems] =
    useState<NavigationModule[]>([]);

  const [navLoading, setNavLoading] =
    useState(true);

  const [navError, setNavError] =
    useState("");

  const [navReload, setNavReload] =
    useState(0);

  useEffect(() => {
    let cancelled = false;

    setNavLoading(true);
    setNavError("");

    getMyNavigation()
      .then((modules) => {
        if (cancelled) {
          return;
        }

        setNavItems(modules);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setNavError(
          error instanceof Error
            ? error.message
            : "Failed to load menu",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setNavLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navReload]);

  /*
   * The Modules page fires this event after changing
   * navigation configuration.
   */
  useEffect(() => {
    const reload = () =>
      setNavReload(
        (count) => count + 1,
      );

    window.addEventListener(
      "dojoflow:navigation-updated",
      reload,
    );

    return () => {
      window.removeEventListener(
        "dojoflow:navigation-updated",
        reload,
      );
    };
  }, []);

  /*
   * Apply the frontend permission layer.
   */
  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) =>
      canSeeNavigationItem(
        user,
        item,
      ),
    );
  }, [navItems, user]);

  /* =======================================================
     ACTIVE ROUTE
  ======================================================= */

  const isActive = (href: string) => {
    if (
      href === "/dashboard" ||
      href === "/student-dashboard"
    ) {
      return pathname === href;
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = () => {
    clearAuthSession();

    onClose?.();

    window.location.href = "/login";
  };

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const handleNavigation = () => {
    onClose?.();
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      {/* ===================================================
          MOBILE OVERLAY
      =================================================== */}

      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="
            fixed
            inset-0
            z-40
            cursor-default
            bg-black/40
            backdrop-blur-[2px]
            md:hidden
          "
        />
      )}

      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside
        aria-label="Main navigation"
        className={[
          "fixed left-0 top-0 z-50 flex h-screen flex-col",
          "border-r border-(--line)",
          "bg-(--sidebar-bg)",
          "text-(--sidebar-text)",
          "shadow-[10px_0_40px_rgba(15,23,42,0.08)]",
          "transition-[width,transform] duration-300 ease-out",
          isOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        style={{
          width: collapsed
            ? SIDEBAR_WIDTH.collapsed
            : SIDEBAR_WIDTH.expanded,
        }}
      >
        {/* =================================================
            BRAND HEADER
        ================================================= */}

        <div
          className={[
            "flex h-[72px] shrink-0 items-center",
            "border-b border-(--line)",
            collapsed
              ? "justify-center px-3"
              : "justify-between px-5",
          ].join(" ")}
        >
          <Link
            href={logoHref}
            onClick={handleNavigation}
            aria-label="Go to dashboard"
            className={[
              "flex min-w-0 items-center",
              "transition-opacity duration-200",
              "hover:opacity-90",
              collapsed
                ? "justify-center"
                : "gap-3",
            ].join(" ")}
          >
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                overflow-hidden
                rounded-xl
                border
                border-(--line)
                bg-(--sidebar-logo-bg)
                shadow-sm
              "
            >
              {academySettings.logoUrl ? (
                <img
                  src={
                    academySettings.logoUrl
                  }
                  alt={
                    academySettings.academyName
                  }
                  className="
                    h-full
                    w-full
                    object-contain
                    p-1
                  "
                />
              ) : (
                <Image
                  src="/logo.png"
                  alt={
                    academySettings.academyName ||
                    "DojoFlow"
                  }
                  width={40}
                  height={40}
                  priority
                  className="
                    h-full
                    w-full
                    object-contain
                  "
                />
              )}
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p
                  className="
                    truncate
                    text-[17px]
                    font-extrabold
                    tracking-tight
                    text-(--sidebar-text)
                  "
                >
                  {academySettings.academyName}
                </p>

                <p
                  className="
                    mt-0.5
                    truncate
                    text-[9px]
                    font-bold
                    uppercase
                    tracking-[0.18em]
                    text-(--sidebar-muted)
                  "
                >
                  {academySettings.tagline ||
                    "Academy Management"}
                </p>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            title="Close navigation"
            className="
              rounded-lg
              p-2
              text-(--sidebar-muted)
              transition-all
              duration-200
              hover:bg-(--sidebar-hover)
              hover:text-(--sidebar-text)
              active:scale-95
              md:hidden
            "
          >
            <X
              size={18}
              strokeWidth={2}
            />
          </button>
        </div>

        {/* =================================================
            WORKSPACE LABEL
        ================================================= */}

        {!collapsed && (
          <div className="px-5 pb-2 pt-6">
            <p
              className="
                text-[9px]
                font-bold
                uppercase
                tracking-[0.18em]
                text-(--sidebar-muted)
              "
            >
              Workspace
            </p>
          </div>
        )}

        {/* =================================================
            NAVIGATION
        ================================================= */}

        <nav
          aria-label="Primary"
          className="
            flex-1
            overflow-y-auto
            px-3
            py-3
            [scrollbar-width:thin]
          "
        >
          {navLoading && (
            <div
              aria-hidden="true"
              className="space-y-2"
            >
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  key={index}
                  className="
                    h-11
                    animate-pulse
                    rounded-xl
                    bg-(--sidebar-hover)
                  "
                />
              ))}
            </div>
          )}

          {!navLoading && navError && (
            <div
              className="
                rounded-xl
                border
                border-(--line)
                p-3
                text-center
              "
            >
              {!collapsed && (
                <p
                  className="
                    mb-2
                    text-[11px]
                    font-medium
                    text-(--sidebar-muted)
                  "
                >
                  {navError}
                </p>
              )}

              <button
                type="button"
                onClick={() =>
                  setNavReload(
                    (count) =>
                      count + 1,
                  )
                }
                className="
                  text-[11px]
                  font-bold
                  text-(--gold)
                  hover:underline
                "
              >
                Retry
              </button>
            </div>
          )}

          {!navLoading &&
            !navError &&
            visibleNavItems.length === 0 && (
              <div
                className="
                  rounded-xl
                  border
                  border-(--line)
                  p-3
                  text-center
                "
              >
                {!collapsed && (
                  <p
                    className="
                      text-[11px]
                      font-medium
                      leading-5
                      text-(--sidebar-muted)
                    "
                  >
                    No modules are available
                    for your account.
                  </p>
                )}
              </div>
            )}

          <div className="space-y-1">
            {visibleNavItems.map(
              (item) => {
                const Icon =
                  getNavigationIcon(
                    item.icon,
                  );

                const active =
                  isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={
                      handleNavigation
                    }
                    title={
                      collapsed
                        ? item.label
                        : undefined
                    }
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                    className={[
                      "group relative flex min-h-11",
                      "items-center rounded-xl",
                      "py-2.5 text-[13px] font-semibold",
                      "transition-all duration-200",
                      "focus-visible:outline-none",
                      "focus-visible:ring-2",
                      "focus-visible:ring-(--gold)",
                      collapsed
                        ? "justify-center px-3"
                        : "gap-3 px-3.5",

                      active
                        ? [
                            "bg-(--gold)",
                            "text-(--sidebar-active-text)",
                            "shadow-[0_6px_20px_rgba(0,0,0,0.12)]",
                          ].join(" ")
                        : [
                            "text-(--sidebar-text)",
                            "opacity-80",
                            "hover:bg-(--sidebar-hover)",
                            "hover:opacity-100",
                          ].join(" "),
                    ].join(" ")}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="
                          absolute
                          -left-3
                          top-1/2
                          h-5
                          w-0.5
                          -translate-y-1/2
                          rounded-r-full
                          bg-(--gold)
                        "
                      />
                    )}

                    <Icon
                      size={18}
                      strokeWidth={
                        active
                          ? 2.3
                          : 1.9
                      }
                      className={[
                        "shrink-0",
                        "transition-colors duration-200",
                        active
                          ? "text-(--sidebar-active-text)"
                          : [
                              "text-(--sidebar-muted)",
                              "group-hover:text-(--gold)",
                            ].join(" "),
                      ].join(" ")}
                    />

                    {!collapsed && (
                      <span className="truncate">
                        {item.label}
                      </span>
                    )}

                    {!collapsed &&
                      active && (
                        <span
                          aria-hidden="true"
                          className="
                            ml-auto
                            h-1.5
                            w-1.5
                            shrink-0
                            rounded-full
                            bg-(--sidebar-active-text)
                          "
                        />
                      )}
                  </Link>
                );
              },
            )}
          </div>
        </nav>

        {/* =================================================
            BOTTOM AREA
        ================================================= */}

        <div
          className="
            shrink-0
            border-t
            border-(--line)
            p-3
          "
        >
          {/* USER INFORMATION */}

          {!collapsed && (
            <div
              className="
                mb-3
                rounded-xl
                border
                border-(--line)
                bg-(--sidebar-user-bg)
                p-3
              "
            >
              <div className="flex items-center gap-3">
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-(--line)
                    bg-(--sidebar-avatar-bg)
                    text-[11px]
                    font-extrabold
                    text-(--gold)
                  "
                >
                  {user?.name
                    ?.trim()
                    ?.charAt(0)
                    ?.toUpperCase() ?? ""}
                </div>

                <div className="min-w-0">
                  {user ? (
                    <>
                      <p
                        className="
                          truncate
                          text-xs
                          font-bold
                          text-(--sidebar-text)
                        "
                      >
                        {user.name}
                      </p>

                      <p
                        className="
                          mt-0.5
                          truncate
                          text-[9px]
                          font-medium
                          uppercase
                          tracking-wide
                          text-(--sidebar-muted)
                        "
                      >
                        {role
                          ? formatRole(role)
                          : ""}
                      </p>

                      {branchName && (
                        <p
                          className="
                            mt-0.5
                            truncate
                            text-[9px]
                            font-semibold
                            text-(--gold)
                          "
                        >
                          {branchName}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className="
                          h-3
                          w-24
                          animate-pulse
                          rounded
                          bg-(--sidebar-hover)
                        "
                      />

                      <div
                        className="
                          mt-1.5
                          h-2.5
                          w-16
                          animate-pulse
                          rounded
                          bg-(--sidebar-hover)
                        "
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* LOGOUT */}

          <button
            type="button"
            onClick={handleLogout}
            title={
              collapsed
                ? "Logout"
                : undefined
            }
            aria-label="Logout"
            className={[
              "group flex min-h-11 w-full",
              "items-center rounded-xl",
              "py-2.5 text-[13px] font-semibold",
              "text-(--sidebar-muted)",
              "transition-all duration-200",
              "hover:bg-(--sidebar-danger-bg)",
              "hover:text-(--sidebar-danger)",
              "focus-visible:outline-none",
              "focus-visible:ring-2",
              "focus-visible:ring-(--gold)",
              collapsed
                ? "justify-center px-3"
                : "gap-3 px-3.5",
            ].join(" ")}
          >
            <LogOut
              size={18}
              strokeWidth={2}
              className="
                shrink-0
                transition-colors
                duration-200
                group-hover:text-(--sidebar-danger)
              "
            />

            {!collapsed && (
              <span>Logout</span>
            )}
          </button>

          {/* COLLAPSE */}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={
                onToggleCollapse
              }
              title={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
              aria-label={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
              className={[
                "mt-2 hidden min-h-11 w-full",
                "items-center rounded-xl",
                "py-2.5 text-[13px] font-semibold",
                "text-(--sidebar-muted)",
                "transition-all duration-200",
                "hover:bg-(--sidebar-hover)",
                "hover:text-(--sidebar-text)",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-(--gold)",
                "md:flex",
                collapsed
                  ? "justify-center px-3"
                  : "gap-3 px-3.5",
              ].join(" ")}
            >
              <ChevronLeft
                size={18}
                strokeWidth={2}
                className={[
                  "shrink-0",
                  "transition-transform duration-300",
                  collapsed
                    ? "rotate-180"
                    : "",
                ].join(" ")}
              />

              {!collapsed && (
                <span>
                  Collapse sidebar
                </span>
              )}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
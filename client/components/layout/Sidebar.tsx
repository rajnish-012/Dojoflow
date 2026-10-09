"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  Building2,
  ChevronDown,
  ChevronLeft,
  LogOut,
  X,
} from "lucide-react";

import { getMyNavigation, type NavigationModule, getBranches } from "@/lib/api";

import { clearAuthSession, useCurrentUser } from "@/lib/current-user";

import { hasPermission } from "@/lib/permissions";

import { getNavigationIcon } from "@/lib/navigation-icons";
import {
  getNavigationSectionLabel,
  getNavigationGroupId,
  NAVIGATION_GROUPS,
} from "@/lib/navigation-groups";

import {
  AcademyLogo,
  useAcademyBrand,
} from "@/components/settings/AcademyBrandProvider";

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
  expanded: 288,
  collapsed: 84,
} as const;

type NavigationGroup = {
  id: string;
  label: string;
  icon: typeof Building2;
  children: NavigationModule[];
};

type NavigationEntry = NavigationModule | NavigationGroup;

function isNavigationGroup(item: NavigationEntry): item is NavigationGroup {
  return "children" in item;
}

function matchesRoute(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/student-dashboard")
    return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* =========================================================
   HELPERS
========================================================= */

function formatRole(role: string) {
  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Determines whether the authenticated user can see.
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

  // /modules/navigation already filters role visibility. Recheck the
  // permission returned by that API without duplicating role rules here.
  return (
    !item.requiredPermission || hasPermission(user, item.requiredPermission)
  );
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const user = useCurrentUser();

  const { settings: academySettings } = useAcademyBrand();

  const role = String(user?.role || "").toUpperCase();

  const [resolvedBranchName, setResolvedBranchName] = useState("");
  const branchValue = user?.branch as unknown as
    | string
    | { _id?: string; name?: string }
    | null
    | undefined;
  const embeddedBranchName =
    branchValue && typeof branchValue === "object"
      ? branchValue.name
      : undefined;
  const branchName =
    user?.branchName ||
    embeddedBranchName ||
    (!user?.branch ? "All Branches" : resolvedBranchName || "Assigned Branch");

  const logoHref = role === "STUDENT" ? "/student-dashboard" : "/dashboard";

  /* =======================================================
     BRANCH NAME
  ======================================================= */

  useEffect(() => {
    let cancelled = false;
    if (user?.branchName || embeddedBranchName || !user?.branch) return;

    const branchId =
      typeof branchValue === "string" ? branchValue : branchValue?._id;

    if (!branchId) {
      return;
    }

    getBranches()
      .then((result) => {
        if (cancelled) {
          return;
        }

        const branches = Array.isArray(result?.branches) ? result.branches : [];

        const branch = branches.find(
          (item: { _id?: string }) => item._id === branchId,
        );

        setResolvedBranchName(branch?.name || "Assigned Branch");
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedBranchName("Assigned Branch");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.branch, user?.branchName, embeddedBranchName, branchValue]);

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const [navItems, setNavItems] = useState<NavigationModule[]>([]);

  const [navLoading, setNavLoading] = useState(true);

  const [navError, setNavError] = useState("");

  const [navReload, setNavReload] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMyNavigation()
      .then((modules) => {
        if (cancelled) {
          return;
        }

        setNavItems(modules);
        setNavError("");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setNavError(
          error instanceof Error ? error.message : "Failed to load menu",
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
    const reload = () => setNavReload((count) => count + 1);

    window.addEventListener("dojoflow:navigation-updated", reload);

    return () => {
      window.removeEventListener("dojoflow:navigation-updated", reload);
    };
  }, []);

  /*
   * Apply the frontend permission layer.
   */
  const visibleNavItems = useMemo(() => {
    const dynamicItems = navItems
      .filter((item) => canSeeNavigationItem(user, item))
      .filter(
        (item) =>
          !["settings", "academy-settings", "branding"].includes(item.key),
      );
    return dynamicItems;
  }, [navItems, user]);

  const navigationEntries = useMemo<NavigationEntry[]>(() => {
    const dashboardItems = visibleNavItems.filter((item) =>
      ["dashboard", "student-dashboard"].includes(item.key),
    );
    const groupedKeys = new Set<string>();
    const sectionOrder = (items: NavigationModule[], fallback: number) => {
      const saved = items.find((item) => Number.isFinite(item.sectionOrder))?.sectionOrder;
      return Number.isFinite(saved) ? Number(saved) : fallback;
    };
    const groups = NAVIGATION_GROUPS.flatMap((config, index) => {
      const children = visibleNavItems.filter(
      (item) => getNavigationGroupId(item) === config.id,
      );
      if (!children.length) return [];
      children.forEach((item) => groupedKeys.add(item.key));
      return [
        { id: config.id, label: config.label, icon: config.icon, children, sectionOrder: sectionOrder(children, (index + 1) * 10) },
      ];
    });
    const customGroupIds = [
      ...new Set(
        visibleNavItems
          .map((item) => getNavigationGroupId(item))
          .filter((id): id is string => Boolean(id?.startsWith("custom:"))),
      ),
    ];
    const customGroups = customGroupIds.flatMap((id) => {
      const children = visibleNavItems.filter(
        (item) => getNavigationGroupId(item) === id,
      );
      if (!children.length) return [];
      return [{
        id,
        label: getNavigationSectionLabel(children[0]),
        icon: Building2,
        children,
        sectionOrder: sectionOrder(children, 1000 + customGroupIds.indexOf(id)),
      }];
    });
    const ungrouped = visibleNavItems.filter(
      (item) => !dashboardItems.includes(item) && !groupedKeys.has(item.key),
    );
    customGroups.forEach((group) => group.children.forEach((item) => groupedKeys.add(item.key)));
    const looseItems = ungrouped.filter((item) => !groupedKeys.has(item.key));
    const sections: { order: number; entries: NavigationEntry[] }[] = [
      ...(dashboardItems.length ? [{ order: sectionOrder(dashboardItems, 0), entries: dashboardItems }] : []),
      ...groups.map((group) => ({ order: group.sectionOrder, entries: [group] })),
      ...customGroups.map((group) => ({ order: group.sectionOrder, entries: [group] })),
      ...(looseItems.length ? [{ order: sectionOrder(looseItems, 10000), entries: looseItems }] : []),
    ];
    return sections.sort((a, b) => a.order - b.order).flatMap((section) => section.entries);
  }, [visibleNavItems]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [collapsedAtRoute, setCollapsedAtRoute] = useState<{
    id: string;
    pathname: string;
  } | null>(null);
  const [collapsedFlyout, setCollapsedFlyout] = useState<string | null>(null);

  /* =======================================================
     ACTIVE ROUTE
  ======================================================= */

  const isActive = (href: string) => {
    return matchesRoute(pathname, href);
  };

  const activeGroupId = visibleNavItems.reduce<string | undefined>(
    (activeId, item) =>
      activeId ||
      (matchesRoute(pathname, item.href)
        ? getNavigationGroupId(item)
        : undefined),
    undefined,
  );

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
    setCollapsedFlyout(null);
  };

  const renderNavigationLink = (
    item: NavigationModule,
    nested = false,
    forceExpanded = false,
  ) => {
    const Icon = getNavigationIcon(item.icon);
    const itemLabel = item.key === "branch-schedules" ? "Training Availability" : item.label;
    const active = isActive(item.href);
    const compact = collapsed && !forceExpanded;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={handleNavigation}
        title={compact ? itemLabel : undefined}
        aria-current={active ? "page" : undefined}
        className={[
          "group relative flex min-h-11 items-center rounded-xl py-2 text-[13px] font-semibold transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gold)",
          compact
            ? "justify-center px-3"
            : nested
              ? "gap-2.5 px-3"
              : "gap-3 px-3.5",
          active
            ? "bg-(--gold) text-(--sidebar-active-text)"
            : "text-(--sidebar-text) opacity-80 hover:bg-(--sidebar-hover) hover:opacity-100",
        ].join(" ")}
      >
        {active && !compact && (
          <span
            aria-hidden="true"
            className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-(--gold)"
          />
        )}
        <Icon
          size={18}
          strokeWidth={active ? 2.3 : 1.9}
          className={
            active
              ? "shrink-0"
              : "shrink-0 text-(--sidebar-muted) group-hover:text-(--gold)"
          }
        />
        {!compact && <span className="truncate">{itemLabel}</span>}
        {!compact && active && (
          <span
            aria-hidden="true"
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-(--sidebar-active-text)"
          />
        )}
      </Link>
    );
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
            lg:hidden
          "
        />
      )}

      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside
        aria-label="Main navigation"
        className={[
          "df-sidebar-viewport fixed left-0 top-0 z-50 flex flex-col",
          "border-r border-(--line)",
          "bg-(--sidebar-bg)",
          "text-(--sidebar-text)",
          "shadow-none",
          "transition-[width,transform] duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        style={{
          width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded,
        }}
      >
        {/* =================================================
            BRAND HEADER
        ================================================= */}

        <div
          className={[
            "flex h-[76px] shrink-0 items-center",
            "border-b border-(--line)",
            collapsed ? "justify-center px-3" : "justify-between px-5",
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
              collapsed ? "justify-center" : "gap-3",
            ].join(" ")}
          >
            <div
              className="
                flex
                h-12
                w-12
                shrink-0
                items-center
                justify-center
                rounded-xl
                border border-(--line)
                bg-white
              "
            >
              <AcademyLogo className="h-9 w-9 object-contain p-0.5" />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p
                  className="
                    truncate
                    text-[15px]
                    font-bold
                    tracking-tight
                    leading-5
                    text-(--sidebar-text)
                  "
                  title={academySettings.academyName || "Your Academy"}
                >
                  {academySettings.academyName || "Your Academy"}
                </p>

                <p
                  className="
                    mt-0.5
                    line-clamp-2
                    whitespace-normal
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-[0.06em]
                    leading-3.5
                    text-(--sidebar-muted)
                  "
                  title={
                    academySettings.tagline ||
                    "Train with purpose. Manage with clarity."
                  }
                >
                  {academySettings.tagline ||
                    "Train with purpose. Manage with clarity."}
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
              lg:hidden
            "
          >
            <X size={18} strokeWidth={2} />
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
            <div aria-hidden="true" className="space-y-2">
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
                onClick={() => setNavReload((count) => count + 1)}
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

          {!navLoading && !navError && visibleNavItems.length === 0 && (
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
                  No modules are available for your account.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            {navigationEntries.map((entry) => {
              if (!isNavigationGroup(entry)) return renderNavigationLink(entry);
              const GroupIcon = entry.icon;
              const groupActive = entry.children.some((child) =>
                isActive(child.href),
              );
              const routeCollapsed =
                collapsedAtRoute?.id === entry.id &&
                collapsedAtRoute.pathname === pathname;
              const expanded = groupActive
                ? !routeCollapsed
                : expandedGroups[entry.id] === true;
              const flyoutOpen = collapsedFlyout === entry.id;
              const toggleGroup = () => {
                if (collapsed) {
                  setCollapsedFlyout((current) =>
                    current === entry.id ? null : entry.id,
                  );
                  return;
                }
                setExpandedGroups(expanded ? {} : { [entry.id]: true });
                if (expanded && groupActive) {
                  setCollapsedAtRoute({ id: entry.id, pathname });
                } else if (
                  !expanded &&
                  activeGroupId &&
                  activeGroupId !== entry.id
                ) {
                  setCollapsedAtRoute({ id: activeGroupId, pathname });
                } else {
                  setCollapsedAtRoute(null);
                }
              };

              return (
                <div
                  key={entry.id}
                  className="relative"
                  onMouseEnter={() => collapsed && setCollapsedFlyout(entry.id)}
                  onMouseLeave={() => collapsed && setCollapsedFlyout(null)}
                >
                  <button
                    type="button"
                    aria-expanded={collapsed ? flyoutOpen : expanded}
                    aria-controls={`sidebar-group-${entry.id}`}
                    aria-label={collapsed ? entry.label : undefined}
                    title={collapsed ? entry.label : undefined}
                    onClick={toggleGroup}
                    className={[
                      "group relative flex min-h-11 w-full items-center rounded-xl py-2.5 text-[13px] font-semibold transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gold)",
                      collapsed ? "justify-center px-3" : "gap-3 px-3.5",
                      groupActive
                        ? "bg-(--sidebar-hover) text-(--sidebar-text)"
                        : "text-(--sidebar-text) opacity-80 hover:bg-(--sidebar-hover) hover:opacity-100",
                    ].join(" ")}
                  >
                    <GroupIcon
                      size={18}
                      className={
                        groupActive
                          ? "shrink-0 text-(--gold)"
                          : "shrink-0 text-(--sidebar-muted) group-hover:text-(--gold)"
                      }
                    />
                    {!collapsed && (
                      <span className="truncate">{entry.label}</span>
                    )}
                    {!collapsed && (
                      <ChevronDown
                        size={15}
                        className={`ml-auto shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>

                  {(!collapsed || flyoutOpen) && (
                    <div
                      id={`sidebar-group-${entry.id}`}
                      aria-hidden={!collapsed && !expanded}
                      inert={!collapsed && !expanded}
                      onMouseEnter={() =>
                        collapsed && setCollapsedFlyout(entry.id)
                      }
                      onMouseLeave={() => collapsed && setCollapsedFlyout(null)}
                      className={[
                        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                        collapsed
                          ? "absolute left-full top-0 z-[60] ml-2 w-56 rounded-xl border border-(--line) bg-(--sidebar-bg) p-2 shadow-xl"
                          : expanded
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0",
                      ].join(" ")}
                    >
                      <div
                        className={
                          collapsed
                            ? "space-y-1"
                            : "min-h-0 space-y-1 overflow-hidden border-l border-(--line) ml-7 pl-2 pt-1"
                        }
                      >
                        {entry.children.map((child) =>
                          renderNavigationLink(child, true, collapsed),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
                  {user?.name?.trim()?.charAt(0)?.toUpperCase() ?? ""}
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
                        {role ? formatRole(role) : ""}
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
            title={collapsed ? "Logout" : undefined}
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
              collapsed ? "justify-center px-3" : "gap-3 px-3.5",
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

            {!collapsed && <span>Logout</span>}
          </button>

          {/* COLLAPSE */}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
                "lg:flex",
                collapsed ? "justify-center px-3" : "gap-3 px-3.5",
              ].join(" ")}
            >
              <ChevronLeft
                size={18}
                strokeWidth={2}
                className={[
                  "shrink-0",
                  "transition-transform duration-300",
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

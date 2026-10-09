"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Activity,
  CalendarCheck,
  Bell,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  UserRoundPlus,
  Settings,
  Sun,
  Trophy,
} from "lucide-react";

import { usePathname, useRouter } from "next/navigation";

import { useTheme } from "@/components/theme/ThemeProvider";

import { useCurrentUser, logoutSession } from "@/lib/current-user";

import { getBranches, getStudentById } from "@/lib/api";
import { getBranchSchedule } from "@/lib/branchScheduleApi";
import Breadcrumb, { type BreadcrumbItem } from "@/components/ui/Breadcrumb";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/notificationsApi";

type HeaderProps = {
  onMenuClick?: () => void;
  onProfileClick?: () => void;
};

const ROUTE_LABELS: Record<string, { section: string; page: string }> = {
  dashboard: { section: "Academy", page: "Dashboard" },
  students: { section: "Academy", page: "Students" },
  plans: { section: "Academy", page: "Plans" },
  curriculum: { section: "Academy", page: "Curriculum" },
  attendance: { section: "Academy", page: "Attendance" },
  performance: { section: "Academy", page: "Performance" },
  promotions: { section: "Academy", page: "Promotions" },
  "coach-assignments": {
    section: "Staff Management",
    page: "Coach Assignments",
  },
  inquiries: { section: "Operations", page: "Inquiries" },
  makeups: { section: "Operations", page: "Makeups" },
  holidays: { section: "Operations", page: "Holidays" },
  "branch-schedules": { section: "Operations", page: "Training Availability" },
  branches: { section: "Branch Management", page: "Branches" },
  roles: { section: "Administration", page: "Roles" },
  modules: { section: "Administration", page: "Modules" },
  users: { section: "Administration", page: "Users" },
  staff: { section: "Administration", page: "Staff" },
  reports: { section: "Insights", page: "Reports" },
  analytics: { section: "Insights", page: "Analytics" },
  settings: { section: "Settings", page: "Settings" },
};

function readableLabel(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getBreadcrumbItems(
  pathname: string,
  entityName: string,
): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const routeKey = segments[0] || "dashboard";
  if (routeKey === "settings" && segments[1]) {
    const settingsPages: Record<string, string> = {
      branding: "Academy Branding",
      staff: "Staff Management",
      maintenance: "Maintenance",
      email: "Email System",
    };
    const page = settingsPages[segments[1]] || readableLabel(segments[1]);
    return [{ label: "Settings", href: "/settings" }, { label: page }];
  }
  const route = ROUTE_LABELS[routeKey] || {
    section: "Workspace",
    page: readableLabel(routeKey),
  };
  const items: BreadcrumbItem[] = [
    { label: route.section },
    { label: route.page, href: `/${routeKey}` },
  ];

  if (routeKey === "students" && segments[1]) {
    items.push({ label: entityName || "Student details" });
    if (segments[2] === "progress") items.push({ label: "Progress" });
    if (segments[2] === "timeline") items.push({ label: "Training Timeline" });
  } else if (
    routeKey === "branches" &&
    segments[1] &&
    segments[2] === "schedule"
  ) {
    items.push({ label: entityName || "Branch details" });
    items.push({ label: "Weekly Schedule" });
  }

  return items;
}

export default function Header({ onMenuClick, onProfileClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [breadcrumbEntity, setBreadcrumbEntity] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const routeSegments = pathname.split("/").filter(Boolean);
  const dynamicKey = `${routeSegments[0] || ""}:${routeSegments[1] || ""}`;
  const breadcrumbEntityName =
    breadcrumbEntity?.key === dynamicKey ? breadcrumbEntity.name : "";
  const breadcrumbItems = getBreadcrumbItems(pathname, breadcrumbEntityName);

  const { theme, toggleTheme } = useTheme();

  // Real data of the logged-in user.
  const user = useCurrentUser({
    refresh: true,
  });

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationOwner, setNotificationOwner] = useState("");
  const [clockNow, setClockNow] = useState<number | null>(null);
  const visibleUnreadCount = notificationOwner === user?.id ? unreadCount : 0;
  const visibleNotificationItems = notificationOwner === user?.id ? notificationItems : [];

  const [branchName, setBranchName] = useState("");

  const branchValue = user?.branch as unknown as
    | string
    | { _id?: string; name?: string }
    | null
    | undefined;
  const branchId =
    typeof branchValue === "string" ? branchValue : branchValue?._id;
  const directBranchName =
    user?.branchName ||
    (branchValue && typeof branchValue === "object" ? branchValue.name : "");
  const visibleBranchName =
    directBranchName ||
    (branchId ? branchName || "Assigned Branch" : "All Branches");

  useEffect(() => {
    const [routeKey, entityId, routeDetail] = pathname
      .split("/")
      .filter(Boolean);
    if (!entityId || entityId === "new") return;

    let cancelled = false;
    const key = `${routeKey}:${entityId}`;
    if (routeKey === "students") {
      getStudentById(entityId)
        .then((result) => {
          const name = result?.student?.name || result?.name;
          if (!cancelled && name) setBreadcrumbEntity({ key, name });
        })
        .catch(() => undefined);
    } else if (routeKey === "branches" && routeDetail === "schedule") {
      getBranchSchedule(entityId)
        .then((result) => {
          const name = result?.branch?.name;
          if (!cancelled && name) setBreadcrumbEntity({ key, name });
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    if (directBranchName || !branchValue) return;

    if (!branchId) return;

    getBranches()
      .then((result) => {
        if (cancelled) {
          return;
        }

        const branches = Array.isArray(result?.branches) ? result.branches : [];

        const branch = branches.find(
          (item: { _id?: string }) => item._id === branchId,
        );

        setBranchName(branch?.name || "Assigned Branch");
      })
      .catch(() => {
        if (!cancelled) {
          setBranchName("Assigned Branch");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, branchValue, directBranchName]);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const refreshUnreadCount = useCallback(async (userId: string) => {
    try {
      const result = await getUnreadNotificationCount();
      setUnreadCount(result.unreadCount || 0);
      setNotificationOwner(userId);
    } catch {
      // Keep the last known count while the API is temporarily unavailable.
    }
  }, []);

  const loadRecentNotifications = useCallback(async (userId: string) => {
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const result = await getNotifications({ page: 1, limit: 6 });
      setNotificationItems(result.notifications || []);
      setUnreadCount(result.unreadCount || 0);
      setNotificationOwner(userId);
      setClockNow(Date.now());
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Unable to load notifications.");
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const initialRefresh = window.setTimeout(() => void refreshUnreadCount(userId), 0);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void refreshUnreadCount(userId);
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.clearTimeout(initialRefresh);
    };
  }, [refreshUnreadCount, user?.id]);

  /* =====================================================
     CLOSE PROFILE MENU WHEN CLICKING OUTSIDE
  ===================================================== */

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showProfileMenu || showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu, showNotifications]);

  /* =====================================================
     CLOSE PROFILE MENU WITH ESCAPE
  ===================================================== */

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    };

    if (showProfileMenu || showNotifications) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showProfileMenu, showNotifications]);

  const openNotifications = () => {
    if (!user?.id) return;
    const next = !showNotifications;
    setShowNotifications(next);
    setShowProfileMenu(false);
    if (next) {
      setClockNow(Date.now());
      void loadRecentNotifications(user.id);
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotificationItems((items) => items.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Unable to update notifications.");
    }
  };

  const openNotification = async (item: NotificationItem) => {
    try {
      if (!item.read) await markNotificationRead(item._id);
      setNotificationItems((items) => items.map((notification) => notification._id === item._id ? { ...notification, read: true } : notification));
      if (!item.read) setUnreadCount((count) => Math.max(0, count - 1));
      setShowNotifications(false);
      if (item.actionUrl?.startsWith("/") && !item.actionUrl.startsWith("//")) router.push(item.actionUrl);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Unable to open notification.");
    }
  };

  const formatNotificationTime = (value: string, now: number | null) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    if (now === null) return date.toLocaleString();
    const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days} day${days === 1 ? "" : "s"} ago` : date.toLocaleDateString();
  };

  const notificationIcon = (type: string) => {
    if (type.startsWith("ATTENDANCE")) return CalendarCheck;
    if (type.startsWith("MAKEUP")) return Clock3;
    if (type.startsWith("PROMOTION")) return Trophy;
    if (type === "INQUIRY_RECEIVED") return Megaphone;
    if (type === "STUDENT_CREATED" || type === "STUDENT_COMPLETED") return UserRoundPlus;
    if (type === "SYSTEM") return Activity;
    return CircleAlert;
  };

  /* =====================================================
     USER HELPERS
  ===================================================== */

  const getInitials = () => {
    const name = user?.name?.trim();

    if (!name) {
      return "";
    }

    const parts = name.split(/\s+/);

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  };

  const getRoleLabel = () => {
    if (!user?.role) {
      return "";
    }

    return String(user.role)
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const isSuperAdmin = String(user?.role || "").toLowerCase() === "super_admin";

  /* =====================================================
     LOGOUT
  ===================================================== */

  const handleLogout = () => {
    void logoutSession().finally(() => router.replace("/login"));
    setShowProfileMenu(false);
  };

  /* =====================================================
     SETTINGS
  ===================================================== */

  const handleSettingsClick = () => {
    setShowProfileMenu(false);
    router.push("/settings");
  };

  /* =====================================================
     PROFILE TOGGLE
  ===================================================== */

  const handleProfileToggle = () => {
    setShowProfileMenu((previous) => !previous);

    onProfileClick?.();
  };

  return (
    <header
      className="
        sticky
        top-0
        z-30
        flex
        h-[72px]
        items-center
        justify-between
        border-b
        border-(--line)
        bg-(--header-bg)
        px-4
        backdrop-blur-xl
        sm:px-6
        lg:px-7
      "
    >
      {/* =================================================
          LEFT SECTION
      ================================================= */}

      <div className="flex min-w-0 items-center gap-3">
        {/* -----------------------------------------------
            MOBILE MENU
        ----------------------------------------------- */}

        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          title="Open navigation"
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-[10px]
            border
            border-(--line)
            bg-(--card)
            text-(--ink-muted)
            shadow-sm
            transition-all
            duration-200
            hover:border-(--line-strong)
            hover:bg-(--hover-bg)
            hover:text-(--foreground)
            active:scale-95
            lg:hidden
          "
        >
          <Menu size={19} strokeWidth={2} />
        </button>

        <div className="min-w-0 flex-1">
          <Breadcrumb items={breadcrumbItems} />
        </div>
      </div>

      {/* =================================================
          RIGHT SECTION
      ================================================= */}

      <div className="flex items-center gap-2 sm:gap-3">
        {/* -----------------------------------------------
            THEME TOGGLE
        ----------------------------------------------- */}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === "light" ? "Switch to dark mode" : "Switch to light mode"
          }
          title={
            theme === "light" ? "Switch to dark mode" : "Switch to light mode"
          }
          className="
            group
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-[10px]
            border
            border-(--line)
            bg-(--card)
            text-(--ink-muted)
            shadow-sm
            transition-all
            duration-200
            hover:border-(--line-strong)
            hover:bg-(--hover-bg)
            hover:text-(--accent)
            active:scale-95
          "
        >
          {theme === "light" ? (
            <Moon
              size={18}
              strokeWidth={2}
              className="
                transition-transform
                duration-200
                group-hover:rotate-12
              "
            />
          ) : (
            <Sun
              size={18}
              strokeWidth={2}
              className="
                transition-transform
                duration-200
                group-hover:rotate-12
              "
            />
          )}
        </button>

        {/* -----------------------------------------------
            NOTIFICATIONS
        ----------------------------------------------- */}

        <div ref={notificationsRef} className="relative">
          <button
            type="button"
            onClick={openNotifications}
            aria-label={visibleUnreadCount ? `Notifications, ${visibleUnreadCount} unread` : "Notifications"}
            aria-expanded={showNotifications}
            aria-haspopup="dialog"
            disabled={!user?.id}
            title="Notifications"
            className="
            group
            relative
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-[10px]
            border
            border-(--line)
            bg-(--card)
            text-(--ink-muted)
            shadow-sm
            transition-all
            duration-200
            hover:border-(--line-strong)
            hover:bg-(--hover-bg)
            hover:text-(--foreground)
            active:scale-95
          "
          >
            <Bell
              size={18}
              strokeWidth={2}
              className="
              transition-transform
              duration-200
              group-hover:scale-105
            "
            />
            {visibleUnreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread notifications`}
                className="
              absolute
              -right-2
              -top-2
              flex
              min-h-5
              min-w-5
              items-center
              justify-center
              rounded-full
              bg-(--accent)
              px-1
              text-[10px]
              font-black
              text-white
              ring-2
              ring-(--card)
            "
              >
                {visibleUnreadCount > 99 ? "99+" : visibleUnreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <section
              role="dialog"
              aria-label="Notifications"
              className="fixed right-3 top-[84px] z-50 w-[calc(100vw-24px)] max-w-[360px] overflow-hidden rounded-2xl border border-(--line) bg-(--card) shadow-[0_18px_50px_var(--shadow-color)] sm:absolute sm:right-0 sm:top-[calc(100%+12px)] sm:w-[min(400px,calc(100vw-48px))] sm:max-w-none"
            >
              <div className="flex items-center justify-between gap-3 border-b border-(--line) px-4 py-3.5">
                <div>
                  <h2 className="text-sm font-extrabold text-(--foreground)">Notifications</h2>
                  <p className="mt-0.5 text-xs text-(--ink-muted)">{visibleUnreadCount ? `${visibleUnreadCount} unread` : "You're all caught up"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  disabled={!visibleUnreadCount}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-(--accent) hover:bg-(--accent-soft) disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCheck size={14} /> Mark all as read
                </button>
              </div>

              <div className="max-h-[min(calc(100dvh-220px),440px)] overflow-y-auto sm:max-h-[min(65vh,440px)]">
                {notificationsLoading ? (
                  <div className="space-y-3 p-4" aria-label="Loading notifications">
                    {[0, 1, 2].map((item) => <div key={item} className="h-[70px] animate-pulse rounded-xl bg-(--hover-bg)" />)}
                  </div>
                ) : notificationsError ? (
                  <div className="p-5 text-center">
                    <p className="text-sm font-semibold text-(--foreground)">Unable to load notifications.</p>
                    <p className="mt-1 text-xs text-(--ink-muted)">{notificationsError}</p>
                    <button type="button" onClick={() => user?.id && void loadRecentNotifications(user.id)} className="mt-3 rounded-lg px-3 py-2 text-xs font-bold text-(--accent) hover:bg-(--accent-soft)">Retry</button>
                  </div>
                ) : visibleNotificationItems.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-(--hover-bg) text-(--ink-muted)"><Bell size={19} /></span>
                    <p className="mt-3 text-sm font-bold text-(--foreground)">You&apos;re all caught up.</p>
                    <p className="mt-1 text-xs text-(--ink-muted)">New academy activity will appear here.</p>
                  </div>
                ) : (
                  visibleNotificationItems.map((item) => {
                    const Icon = notificationIcon(item.type);
                    const severityTone = item.severity === "ERROR" ? "text-(--danger) bg-(--danger-soft)" : item.severity === "WARNING" ? "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40" : item.severity === "SUCCESS" ? "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/40" : "text-(--accent) bg-(--accent-soft)";
                    return (
                      <button
                        type="button"
                        key={item._id}
                        onClick={() => void openNotification(item)}
                        className={`flex w-full items-start gap-3 border-b border-(--line) px-4 py-3.5 text-left transition hover:bg-(--hover-bg) ${item.read ? "" : "bg-(--accent-soft)/35"}`}
                      >
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${severityTone}`}><Icon size={17} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-bold text-(--foreground)">{item.title}</span>
                            {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-(--accent)" aria-label="Unread" />}
                          </span>
                          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-(--ink-muted)">{item.message}</span>
                          <span className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-(--ink-faint)"><Clock3 size={11} />{formatNotificationTime(item.createdAt, clockNow)}</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t border-(--line) p-2">
                <button type="button" onClick={() => { setShowNotifications(false); router.push("/notifications"); }} className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold text-(--accent) hover:bg-(--accent-soft)">
                  View all notifications <ExternalLink size={13} />
                </button>
              </div>
            </section>
          )}
        </div>

        {/* -----------------------------------------------
            PROFILE
        ----------------------------------------------- */}

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={handleProfileToggle}
            aria-expanded={showProfileMenu}
            aria-haspopup="menu"
            className="
              group
              flex
              items-center
              gap-2
              rounded-[10px]
              border
              border-transparent
              px-1.5
              py-1.5
              transition-all
              duration-200
              hover:border-(--line)
              hover:bg-(--hover-bg)
              sm:gap-3
              sm:px-2
            "
          >
            {/* Avatar */}

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
                bg-[#172033]
                text-[11px]
                font-extrabold
                text-(--accent)
                shadow-sm
                transition-all
                duration-200
                dark:bg-[#252c35]
                group-hover:border-(--line-strong)
              "
            >
              {getInitials()}
            </div>

            {/* User details */}

            <div
              className="
                hidden
                max-w-[150px]
                text-left
                sm:block
              "
            >
              {user ? (
                <>
                  <p
                    className="
                      truncate
                      text-xs
                      font-bold
                      text-(--foreground)
                    "
                  >
                    {user.name}
                  </p>

                  <p
                    className="
                      mt-0.5
                      truncate
                      text-[10px]
                      font-medium
                      text-(--ink-muted)
                    "
                  >
                    {getRoleLabel()}
                  </p>

                  {visibleBranchName && (
                    <p
                      className="
                        mt-0.5
                        truncate
                        text-[9px]
                        font-semibold
                        text-(--accent)
                      "
                    >
                      {visibleBranchName}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="h-3 w-20 animate-pulse rounded bg-(--line)" />

                  <div className="mt-1.5 h-2.5 w-14 animate-pulse rounded bg-(--line)" />
                </>
              )}
            </div>

            {/* Chevron */}

            <ChevronDown
              size={15}
              strokeWidth={2}
              className={[
                "hidden text-(--ink-muted) transition-transform duration-200 sm:block",
                showProfileMenu ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {/* =================================================
              PROFILE MENU
          ================================================= */}

          {showProfileMenu && (
            <div
              role="menu"
              aria-label="Account menu"
              className="
                absolute
                right-0
                top-[54px]
                z-50
                w-[260px]
                overflow-hidden
                rounded-2xl
                border
                border-(--line)
                bg-(--card)
                p-2
                text-(--foreground)
                shadow-[0_20px_60px_var(--shadow-color)]
                animate-df-fade-in
              "
            >
              {/* -------------------------------------------
                  USER INFORMATION
              ------------------------------------------- */}

              <div
                className="
                  mb-2
                  rounded-xl
                  border
                  border-(--line)
                  bg-(--hover-bg)
                  p-3
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-(--line)
                      bg-[#172033]
                      text-xs
                      font-extrabold
                      text-(--accent)
                      dark:bg-[#252c35]
                    "
                  >
                    {getInitials()}
                  </div>

                  <div className="min-w-0">
                    <p
                      className="
                        truncate
                        text-xs
                        font-bold
                        text-(--foreground)
                      "
                    >
                      {user?.name}
                    </p>

                    <p
                      className="
                        mt-0.5
                        truncate
                        text-[10px]
                        font-medium
                        text-(--ink-muted)
                      "
                    >
                      {user?.email}
                    </p>

                    {getRoleLabel() && (
                      <span
                        className="
                          mt-1.5
                          inline-flex
                          rounded-full
                          bg-(--accent-soft)
                          px-2
                          py-0.5
                          text-[9px]
                          font-bold
                          uppercase
                          tracking-wide
                          text-(--accent)
                        "
                      >
                        {getRoleLabel()}
                      </span>
                    )}

                    {visibleBranchName && (
                      <p
                        className="
                          mt-1.5
                          truncate
                          text-[9px]
                          font-semibold
                          text-(--accent)
                        "
                      >
                        {visibleBranchName}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* -------------------------------------------
                  ROLE
              ------------------------------------------- */}

              {isSuperAdmin && (
                <div
                  className="
                    mb-1
                    px-3
                    py-1.5
                  "
                >
                  <span
                    className="
                      text-[9px]
                      font-bold
                      uppercase
                      tracking-[0.12em]
                      text-(--ink-muted)
                    "
                  >
                    Account
                  </span>
                </div>
              )}

              {/* -------------------------------------------
                  SETTINGS
              ------------------------------------------- */}

              {isSuperAdmin && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSettingsClick}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-[10px]
                      px-3
                      py-2.5
                      text-left
                      text-xs
                      font-semibold
                      text-(--ink-muted)
                      transition-all
                      duration-150
                      hover:bg-(--hover-bg)
                      hover:text-(--foreground)
                    "
                  >
                    <span
                      className="
                        flex
                        h-8
                        w-8
                        items-center
                        justify-center
                        rounded-lg
                        bg-(--hover-bg)
                        text-(--ink-muted)
                      "
                    >
                      <Settings size={15} strokeWidth={2} />
                    </span>

                    <span>Account settings</span>
                  </button>

                  <div
                    className="
                      my-1.5
                      h-px
                      bg-(--line)
                    "
                  />
                </>
              )}

              {/* -------------------------------------------
                  LOGOUT
              ------------------------------------------- */}

              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-[10px]
                  px-3
                  py-2.5
                  text-left
                  text-xs
                  font-semibold
                  text-(--danger)
                  transition-all
                  duration-150
                  hover:bg-(--danger-soft)
                "
              >
                <span
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-lg
                    bg-(--danger-soft)
                    text-(--danger)
                  "
                >
                  <LogOut size={15} strokeWidth={2} />
                </span>

                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

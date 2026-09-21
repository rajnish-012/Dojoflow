"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useTheme } from "@/components/theme/ThemeProvider";
import { useCurrentUser } from "@/lib/current-user";

type HeaderProps = {
  onMenuClick?: () => void;
  onProfileClick?: () => void;
};

export default function Header({ onMenuClick, onProfileClick }: HeaderProps) {
  const router = useRouter();

  const { theme, toggleTheme } = useTheme();

  // Real data of the logged-in user (refreshed from the server).
  const user = useCurrentUser({ refresh: true });
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

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
    };

    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu]);

  /* =====================================================
     CLOSE PROFILE MENU WITH ESCAPE
     ===================================================== */

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showProfileMenu]);

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
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("dojoUser");
    localStorage.removeItem("currentUser");

    setShowProfileMenu(false);

    router.replace("/login");
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
        lg:px-8
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
            md:hidden
          "
        >
          <Menu size={19} strokeWidth={2} />
        </button>

        {/* -----------------------------------------------
            DESKTOP WORKSPACE TITLE
            ----------------------------------------------- */}

        <div className="hidden min-w-0 sm:block">
          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-(--accent)
            "
          >
            DojoFlow Workspace
          </p>

          <p
            className="
              mt-1
              truncate
              text-[13px]
              font-semibold
              text-(--foreground)
            "
          >
            Manage your academy with clarity
          </p>
        </div>

        {/* -----------------------------------------------
            MOBILE BRAND
            ----------------------------------------------- */}

        <div className="sm:hidden">
          <p
            className="
              text-[17px]
              font-extrabold
              tracking-tight
              text-(--foreground)
            "
          >
            Dojo
            <span className="text-(--accent)">Flow</span>
          </p>

          <p
            className="
              mt-0.5
              text-[10px]
              font-medium
              text-(--ink-muted)
            "
          >
            Academy workspace
          </p>
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

        <button
          type="button"
          aria-label="Notifications"
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

          {/* Notification dot */}
          <span
            aria-hidden="true"
            className="
              absolute
              right-[8px]
              top-[7px]
              h-[7px]
              w-[7px]
              rounded-full
              bg-(--accent)
              ring-2
              ring-(--card)
            "
          />
        </button>

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
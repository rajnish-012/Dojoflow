"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  Settings,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

type HeaderProps = {
  onMenuClick?: () => void;
  onProfileClick?: () => void;
};

type User = {
  name?: string;
  email?: string;
  role?: string;
};

export default function Header({
  onMenuClick,
  onProfileClick,
}: HeaderProps) {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    try {
      const storedUser =
        localStorage.getItem("user") ||
        localStorage.getItem("dojoUser") ||
        localStorage.getItem("currentUser");

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      setUser(null);
    }
  }, []);

  const getInitials = () => {
    const name = user?.name?.trim() || "Admin";

    return name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const getRoleLabel = () => {
    return String(user?.role || "SUPER_ADMIN")
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const isSuperAdmin =
    user?.role?.toLowerCase() === "super_admin";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("dojoUser");
    localStorage.removeItem("currentUser");

    setShowProfileMenu(false);
    router.replace("/login");
  };

  const handleSettingsClick = () => {
    setShowProfileMenu(false);
    router.push("/settings");
  };

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e8ecf3] bg-white/95 px-4 shadow-[0_4px_20px_rgba(16,26,51,0.03)] backdrop-blur-xl sm:px-6 lg:px-8">
      {/* Left section */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e5e9f1] bg-white text-[#526078] transition-all duration-200 hover:border-[#d7a84b] hover:bg-[#fffaf0] hover:text-[#101a33] active:scale-95 md:hidden"
        >
          <Menu size={20} strokeWidth={2.2} />
        </button>

        {/* Desktop branding */}
        <div className="hidden min-w-0 sm:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b17b20]">
            DojoFlow Workspace
          </p>

          <p className="mt-1 truncate text-sm font-semibold text-[#172033]">
            Manage your academy with clarity
          </p>
        </div>

        {/* Mobile branding */}
        <div className="sm:hidden">
          <p className="text-[17px] font-extrabold tracking-tight text-[#101a33]">
            Dojo
            <span className="text-[#d7a84b]">Flow</span>
          </p>

          <p className="mt-0.5 text-[10px] font-medium text-[#8b96a8]">
            Academy workspace
          </p>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e9f1] bg-white text-[#526078] transition-all duration-200 hover:border-[#d7a84b] hover:bg-[#fffaf0] hover:text-[#101a33] active:scale-95"
        >
          <Bell
            size={18}
            strokeWidth={2}
            className="transition-transform duration-200 group-hover:scale-105"
          />

          {/* Notification indicator */}
          <span className="absolute right-[9px] top-[8px] h-2 w-2 rounded-full bg-[#d7a84b] ring-2 ring-white" />
        </button>

        {/* Profile */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowProfileMenu((previous) => !previous);
              onProfileClick?.();
            }}
            aria-expanded={showProfileMenu}
            aria-haspopup="menu"
            className="group flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-1.5 transition-all duration-200 hover:border-[#e5e9f1] hover:bg-[#f8f9fc] sm:gap-3 sm:px-2"
          >
            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#101a33] text-xs font-extrabold text-[#d7a84b] shadow-sm ring-2 ring-[#f3f5f9] transition-all duration-200 group-hover:ring-[#f3e5c5]">
              {getInitials()}
            </div>

            {/* User information */}
            <div className="hidden max-w-[150px] text-left sm:block">
              <p className="truncate text-xs font-bold text-[#172033]">
                {user?.name || "Administrator"}
              </p>

              <p className="mt-0.5 truncate text-[10px] font-medium text-[#7b879b]">
                {getRoleLabel()}
              </p>
            </div>

            {/* Dropdown icon */}
            <ChevronDown
              size={15}
              className={[
                "hidden text-[#8b96a8] transition-transform duration-200 sm:block",
                showProfileMenu ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {showProfileMenu && (
            <>
              {/* Background overlay */}
              <button
                type="button"
                aria-label="Close profile menu"
                onClick={() => setShowProfileMenu(false)}
                className="fixed inset-0 z-40 cursor-default bg-transparent"
              />

              {/* Profile dropdown */}
              <div
                role="menu"
                className="absolute right-0 top-[54px] z-50 w-[250px] overflow-hidden rounded-2xl border border-[#e5e9f1] bg-white p-2 shadow-[0_18px_50px_rgba(16,26,51,0.12)]"
              >
                {/* User card */}
                <div className="mb-2 rounded-xl bg-[#f8f9fc] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#101a33] text-xs font-extrabold text-[#d7a84b]">
                      {getInitials()}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#172033]">
                        {user?.name || "Administrator"}
                      </p>

                      <p className="mt-0.5 truncate text-[10px] text-[#7b879b]">
                        {user?.email || "admin@dojoflow.com"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Account settings: super_admin only */}
                {isSuperAdmin && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSettingsClick}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#526078] transition-colors hover:bg-[#f8f9fc] hover:text-[#101a33]"
                    >
                      <Settings size={16} strokeWidth={2} />
                      Account settings
                    </button>

                    <div className="my-1.5 h-px bg-[#e8ecf3]" />
                  </>
                )}

                {/* Logout */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#c24141] transition-colors hover:bg-[#fff1f1]"
                >
                  <LogOut size={16} strokeWidth={2} />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
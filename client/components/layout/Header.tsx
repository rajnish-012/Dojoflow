"use client";

import {
  Bell,
  Search,
  ChevronDown,
} from "lucide-react";

import { useEffect, useState } from "react";

type Branch = {
  _id?: string;
  name?: string;
};

type User = {
  name?: string;
  email?: string;
  role?: string;
  branch?: Branch | string | null;
};

const API_URL = "http://localhost:5000/api";

export default function Header() {
  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const token =
          localStorage.getItem("token");

        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${API_URL}/auth/me`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to fetch current user",
          );
        }

        const currentUser = data.user;

        setUser(currentUser);

        // Keep localStorage synchronized with
        // the authenticated backend user.
        localStorage.setItem(
          "user",
          JSON.stringify(currentUser),
        );
      } catch (error) {
        console.error(
          "Failed to load current user:",
          error,
        );

        // Fallback to locally stored user
        // if the API request fails.
        try {
          const storedUser =
            localStorage.getItem("user");

          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        } catch (storageError) {
          console.error(
            "Failed to load stored user:",
            storageError,
          );
        }
      } finally {
        setLoading(false);
      }
    }

    loadCurrentUser();
  }, []);

  const displayName =
    user?.name ||
    user?.email?.split("@")[0] ||
    "Admin";

  const role = user?.role || "SUPER_ADMIN";

  const formattedRole = role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">
      {/* Search */}

      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          type="text"
          placeholder="Search students, plans..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
        />
      </div>

      {/* Right */}

      <div className="flex items-center gap-5">
        {/* Notifications */}

        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <Bell className="h-5 w-5" />

          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="h-8 w-px bg-slate-200" />

        {/* User */}

        <button
          type="button"
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            {loading ? "..." : initials || "AD"}
          </div>

          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold text-slate-900">
              {loading
                ? "Loading..."
                : displayName}
            </p>

            <p className="text-xs text-slate-500">
              {loading
                ? "..."
                : formattedRole}
            </p>
          </div>

          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </header>
  );
}
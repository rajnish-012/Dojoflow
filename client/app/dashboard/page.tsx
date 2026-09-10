"use client";

import { useEffect, useState } from "react";
import {
  Users,
  ClipboardCheck,
  Award,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";

import { getDashboard } from "@/lib/api";

type DashboardData = {
  students: {
    total: number;
    active: number;
    inactive: number;
    completed: number;
  };

  plans: {
    active: number;
  };

  attendance: {
    todayPresent: number;
    todayAbsent: number;
    pendingMakeups: number;
  };

  recentPerformance: {
    _id: string;

    student?: {
      _id: string;
      name: string;
      currentBelt?: string;
    } | null;

    skill: string;
    rating: number;
    remarks?: string;
  }[];
};

export default function DashboardPage() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await getDashboard();

        setDashboard(data.dashboard);
      } catch (error) {
        console.error(error);

        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading dashboard...
        </p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">
          {error || "Unable to load dashboard"}
        </p>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Students",
      value: dashboard.students.total.toString(),
      description: `${dashboard.students.active} active students`,
      icon: Users,
    },
    {
      title: "Today's Attendance",
      value:
        dashboard.attendance.todayPresent.toString(),
      description: `${dashboard.attendance.todayAbsent} absent today`,
      icon: ClipboardCheck,
    },
    {
      title: "Active Plans",
      value: dashboard.plans.active.toString(),
      description: "currently available",
      icon: Award,
    },
    {
      title: "Pending Makeups",
      value:
        dashboard.attendance.pendingMakeups.toString(),
      description: "classes requiring makeup",
      icon: AlertCircle,
    },
  ];

  const activeStudentPercentage =
    dashboard.students.total > 0
      ? Math.min(
          (dashboard.students.active /
            dashboard.students.total) *
            100,
          100,
        )
      : 0;

  const attendancePercentage =
    dashboard.students.active > 0
      ? Math.min(
          (dashboard.attendance.todayPresent /
            dashboard.students.active) *
            100,
          100,
        )
      : 0;

  const makeupPercentage =
    dashboard.students.active > 0
      ? Math.min(
          (dashboard.attendance.pendingMakeups /
            dashboard.students.active) *
            100,
          100,
        )
      : 0;

  return (
    <div className="space-y-8">
      {/* Page Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Good morning, Admin
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Here&apos;s what&apos;s happening at your academy
          today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  <Icon className="h-5 w-5 text-slate-700" />
                </div>

                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </div>

              <div className="mt-5">
                <p className="text-sm text-slate-500">
                  {stat.title}
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {stat.value}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {stat.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Training + Performance */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Performance */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="font-semibold text-slate-900">
                Recent Performance
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Latest student evaluations
              </p>
            </div>

            <a
              href="/performance"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              View performance
            </a>
          </div>

          <div className="divide-y divide-slate-100">
            {dashboard.recentPerformance.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-slate-500">
                  No performance records yet.
                </p>
              </div>
            ) : (
              dashboard.recentPerformance.map(
                (record) => {
                  const studentName =
                    record.student?.name ||
                    "Unknown Student";

                  const currentBelt =
                    record.student?.currentBelt ||
                    "Unknown Belt";

                  const initials = studentName
                    .split(" ")
                    .filter(Boolean)
                    .map((name) => name[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={record._id}
                      className="flex items-center justify-between px-6 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                          {initials || "?"}
                        </div>

                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {studentName}
                          </p>

                          <p className="text-xs text-slate-500">
                            {currentBelt} · {record.skill}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {record.rating}/5
                      </span>
                    </div>
                  );
                },
              )
            )}
          </div>
        </div>

        {/* Academy Overview */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Academy Overview
          </h2>

          <div className="mt-6 space-y-5">
            {/* Active Students */}
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Active Students
                </span>

                <span className="font-medium text-slate-900">
                  {dashboard.students.active}
                </span>
              </div>

              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{
                    width: `${activeStudentPercentage}%`,
                  }}
                />
              </div>
            </div>

            {/* Present Today */}
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Present Today
                </span>

                <span className="font-medium text-slate-900">
                  {dashboard.attendance.todayPresent}
                </span>
              </div>

              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{
                    width: `${attendancePercentage}%`,
                  }}
                />
              </div>
            </div>

            {/* Pending Makeups */}
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Pending Makeups
                </span>

                <span className="font-medium text-slate-900">
                  {dashboard.attendance.pendingMakeups}
                </span>
              </div>

              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{
                    width: `${makeupPercentage}%`,
                  }}
                />
              </div>
            </div>

            {/* Active Plans */}
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Active Plans
                </span>

                <span className="font-medium text-slate-900">
                  {dashboard.plans.active}
                </span>
              </div>

              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 w-full rounded-full bg-slate-900" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
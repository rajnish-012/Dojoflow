"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  ClipboardCheck,
  Award,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  UserCheck,
  UserX,
  CalendarDays,
  Activity,
  ChevronRight,
  ShieldCheck,
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

function getInitials(name?: string) {
  if (!name) return "ST";

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getRatingLabel(rating: number) {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 3.5) return "Good";
  if (rating >= 2.5) return "Average";
  return "Needs improvement";
}

export default function DashboardPage() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await getDashboard();

        // Keep the original backend response structure
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
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f5f7fb]">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#b67b1d]" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-[70vh] bg-[#f5f7fb] p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">
            {error || "Unable to load dashboard"}
          </p>
        </div>
      </div>
    );
  }

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

  const completedStudentPercentage =
    dashboard.students.total > 0
      ? Math.min(
          (dashboard.students.completed /
            dashboard.students.total) *
            100,
          100,
        )
      : 0;

  const inactiveStudentPercentage =
    dashboard.students.total > 0
      ? Math.min(
          (dashboard.students.inactive /
            dashboard.students.total) *
            100,
          100,
        )
      : 0;

  const stats = [
    {
      title: "Total Students",
      value: dashboard.students.total,
      description: `${dashboard.students.active} active students`,
      icon: Users,
      iconClass: "bg-[#eef3ff] text-[#496bb1]",
      href: "/students",
    },
    {
      title: "Today's Attendance",
      value: dashboard.attendance.todayPresent,
      description: `${dashboard.attendance.todayAbsent} absent today`,
      icon: ClipboardCheck,
      iconClass: "bg-[#edf8f1] text-[#32915b]",
      href: "/attendance",
    },
    {
      title: "Active Plans",
      value: dashboard.plans.active,
      description: "Currently available",
      icon: Award,
      iconClass: "bg-[#fff6e7] text-[#b67b1d]",
      href: "/plans",
    },
    {
      title: "Pending Makeups",
      value: dashboard.attendance.pendingMakeups,
      description: "Classes requiring makeup",
      icon: AlertCircle,
      iconClass: "bg-[#f3efff] text-[#7657b9]",
      href: "/attendance",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        {/* Page Header */}
        <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#b67b1d]">
              Academy overview
            </p>

            <h1 className="text-3xl font-black tracking-[-0.04em] text-[#101a33] sm:text-4xl">
              Welcome back,{" "}
              <span className="text-[#b67b1d]">Admin</span>
            </h1>

            <p className="mt-2 text-sm text-[#697386]">
              Here&apos;s what&apos;s happening at your academy today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/students"
              className="inline-flex items-center gap-2 rounded-xl border border-[#dfe5ed] bg-white px-4 py-2.5 text-sm font-bold text-[#34445d] shadow-sm transition hover:border-[#d7a84b] hover:text-[#a87418]"
            >
              <Users size={17} />

              <span className="hidden sm:inline">
                View students
              </span>

              <span className="sm:hidden">Students</span>
            </Link>

            <Link
              href="/students"
              className="inline-flex items-center gap-2 rounded-xl bg-[#101a33] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#1c2d52]"
            >
              <span className="text-lg leading-none">+</span>
              Add student
            </Link>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <Link
                href={stat.href}
                key={stat.title}
                className="group rounded-2xl border border-[#e4e9f0] bg-white p-5 shadow-[0_4px_18px_rgba(16,26,51,0.035)] transition duration-200 hover:-translate-y-1 hover:border-[#d7a84b] hover:shadow-[0_12px_30px_rgba(16,26,51,0.08)]"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconClass}`}
                  >
                    <Icon size={21} />
                  </div>

                  <ArrowUpRight
                    size={17}
                    className="text-[#b8c2d0] transition group-hover:translate-x-1 group-hover:text-[#b67b1d]"
                  />
                </div>

                <div className="mt-5">
                  <p className="text-sm font-medium text-[#697386]">
                    {stat.title}
                  </p>

                  <p className="mt-1 text-3xl font-black tracking-tight text-[#101a33]">
                    {stat.value}
                  </p>

                  <p className="mt-2 text-xs text-[#9aa5b5]">
                    {stat.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Main Dashboard Grid */}
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          {/* Student Overview */}
          <section className="h-fit self-start rounded-2xl border border-[#e4e9f0] bg-white p-5 shadow-[0_4px_18px_rgba(16,26,51,0.035)] sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b67b1d]">
                  Student overview
                </p>

                <h2 className="mt-2 text-xl font-black text-[#101a33]">
                  Academy population
                </h2>

                <p className="mt-1 text-sm text-[#697386]">
                  Current student enrollment and activity.
                </p>
              </div>

              <Link
                href="/students"
                className="hidden items-center gap-1 text-sm font-bold text-[#b67b1d] sm:inline-flex"
              >
                View students
                <ArrowRightIcon />
              </Link>
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1fr]">
              {/* Active Student Circle */}
              <div className="flex items-center gap-5 rounded-2xl bg-[#fafbfd] p-5">
                <div
                  className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(
                      #d7a84b 0% ${activeStudentPercentage}%,
                      #edf0f5 ${activeStudentPercentage}% 100%
                    )`,
                  }}
                >
                  <div className="absolute inset-[10px] flex items-center justify-center rounded-full bg-white">
                    <div className="text-center">
                      <p className="text-2xl font-black text-[#101a33]">
                        {Math.round(activeStudentPercentage)}%
                      </p>

                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9aa5b5]">
                        Active
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-[#34445d]">
                    Active students
                  </p>

                  <p className="mt-1 text-2xl font-black text-[#101a33]">
                    {dashboard.students.active}
                  </p>

                  <p className="mt-1 text-xs text-[#9aa5b5]">
                    Out of {dashboard.students.total} registered
                  </p>
                </div>
              </div>

              {/* Student Status */}
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#4b8fe8]" />

                      <span className="text-sm font-semibold text-[#697386]">
                        Active students
                      </span>
                    </div>

                    <span className="text-sm font-black text-[#34445d]">
                      {dashboard.students.active}
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-[#edf0f5]">
                    <div
                      className="h-2 rounded-full bg-[#4b8fe8] transition-all duration-500"
                      style={{
                        width: `${activeStudentPercentage}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#d7a84b]" />

                      <span className="text-sm font-semibold text-[#697386]">
                        Completed students
                      </span>
                    </div>

                    <span className="text-sm font-black text-[#34445d]">
                      {dashboard.students.completed}
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-[#edf0f5]">
                    <div
                      className="h-2 rounded-full bg-[#d7a84b] transition-all duration-500"
                      style={{
                        width: `${completedStudentPercentage}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#aab4c2]" />

                      <span className="text-sm font-semibold text-[#697386]">
                        Inactive students
                      </span>
                    </div>

                    <span className="text-sm font-black text-[#34445d]">
                      {dashboard.students.inactive}
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-[#edf0f5]">
                    <div
                      className="h-2 rounded-full bg-[#aab4c2] transition-all duration-500"
                      style={{
                        width: `${inactiveStudentPercentage}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Attendance Summary */}
          <section className="rounded-2xl border border-[#e4e9f0] bg-white p-5 shadow-[0_4px_18px_rgba(16,26,51,0.035)] sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b67b1d]">
                  Today&apos;s activity
                </p>

                <h2 className="mt-2 text-xl font-black text-[#101a33]">
                  Attendance summary
                </h2>

                <p className="mt-1 text-sm text-[#697386]">
                  Today&apos;s attendance status.
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf8f1] text-[#32915b]">
                <CalendarDays size={20} />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-5">
              {/* Attendance Progress Circle */}
              <div
                className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(
                    #32915b 0% ${attendancePercentage}%,
                    #edf0f5 ${attendancePercentage}% 100%
                  )`,
                }}
              >
                <div className="absolute inset-[9px] flex items-center justify-center rounded-full bg-white">
                  <div className="text-center">
                    <p className="text-xl font-black text-[#101a33]">
                      {Math.round(attendancePercentage)}%
                    </p>

                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#9aa5b5]">
                      Present
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-3xl font-black text-[#101a33]">
                  {dashboard.attendance.todayPresent}
                </p>

                <p className="mt-1 text-sm font-medium text-[#697386]">
                  Students present today
                </p>

                <p className="mt-1 text-xs text-[#9aa5b5]">
                  {dashboard.attendance.todayAbsent} absent today
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#edf8f1] p-3.5">
                <div className="flex items-center gap-2 text-[#32915b]">
                  <UserCheck size={17} />

                  <span className="text-xs font-bold">
                    Present
                  </span>
                </div>

                <p className="mt-2 text-xl font-black text-[#256b43]">
                  {dashboard.attendance.todayPresent}
                </p>
              </div>

              <div className="rounded-xl bg-[#fff1f1] p-3.5">
                <div className="flex items-center gap-2 text-[#d45b5b]">
                  <UserX size={17} />

                  <span className="text-xs font-bold">
                    Absent
                  </span>
                </div>

                <p className="mt-2 text-xl font-black text-[#a63f3f]">
                  {dashboard.attendance.todayAbsent}
                </p>
              </div>
            </div>

            <Link
              href="/attendance"
              className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-[#dfe5ed] px-4 py-3 text-sm font-bold text-[#34445d] transition hover:border-[#d7a84b] hover:text-[#a87418]"
            >
              Open attendance
              <ArrowRightIcon />
            </Link>
          </section>
        </div>

        {/* Bottom Grid */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          {/* Recent Performance */}
          <section className="rounded-2xl border border-[#e4e9f0] bg-white shadow-[0_4px_18px_rgba(16,26,51,0.035)]">
            <div className="flex items-start justify-between border-b border-[#edf0f4] px-5 py-5 sm:px-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b67b1d]">
                  Latest evaluations
                </p>

                <h2 className="mt-2 text-xl font-black text-[#101a33]">
                  Recent performance
                </h2>

                <p className="mt-1 text-sm text-[#697386]">
                  Latest student performance evaluations.
                </p>
              </div>

              <Link
                href="/performance"
                className="hidden items-center gap-1 text-sm font-bold text-[#b67b1d] sm:inline-flex"
              >
                View all
                <ArrowRightIcon />
              </Link>
            </div>

            {dashboard.recentPerformance.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f1f4f8] text-[#7b8ba3]">
                  <Activity size={23} />
                </div>

                <p className="mt-3 text-sm font-bold text-[#34445d]">
                  No performance records yet
                </p>

                <p className="mt-1 text-xs text-[#9aa5b5]">
                  Student evaluations will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#edf0f4]">
                {dashboard.recentPerformance
                  .slice(0, 5)
                  .map((record) => {
                    const studentName =
                      record.student?.name || "Unknown student";

                    return (
                      <div
                        key={record._id}
                        className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#fafbfd] sm:px-6"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#101a33] text-xs font-black text-[#d7a84b]">
                            {getInitials(studentName)}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#34445d]">
                              {studentName}
                            </p>

                            <p className="mt-1 truncate text-xs text-[#8c98a9]">
                              {record.student?.currentBelt ||
                                "White Belt"}{" "}
                              · {record.skill}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="rounded-full bg-[#f8efde] px-2.5 py-1 text-xs font-black text-[#a87418]">
                            {record.rating}/5
                          </span>

                          <p className="mt-1 hidden text-[10px] text-[#9aa5b5] sm:block">
                            {getRatingLabel(record.rating)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="border-t border-[#edf0f4] px-5 py-4 sm:hidden">
              <Link
                href="/performance"
                className="flex items-center justify-center gap-1 text-sm font-bold text-[#b67b1d]"
              >
                View all performance
                <ArrowRightIcon />
              </Link>
            </div>
          </section>

          {/* Operations Summary */}
          <section className="rounded-2xl border border-[#e4e9f0] bg-white p-5 shadow-[0_4px_18px_rgba(16,26,51,0.035)] sm:p-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b67b1d]">
                Quick summary
              </p>

              <h2 className="mt-2 text-xl font-black text-[#101a33]">
                Academy operations
              </h2>

              <p className="mt-1 text-sm text-[#697386]">
                Important numbers at a glance.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <Link
                href="/plans"
                className="group flex items-center justify-between rounded-xl bg-[#fafbfd] p-4 transition hover:bg-[#f5f7fb]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6e7] text-[#b67b1d]">
                    <Award size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#34445d]">
                      Active plans
                    </p>

                    <p className="mt-0.5 text-xs text-[#9aa5b5]">
                      Available training plans
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-[#101a33]">
                    {dashboard.plans.active}
                  </span>

                  <ChevronRight
                    size={17}
                    className="text-[#b8c2d0] transition group-hover:translate-x-1"
                  />
                </div>
              </Link>

              <Link
                href="/attendance"
                className="group flex items-center justify-between rounded-xl bg-[#fafbfd] p-4 transition hover:bg-[#f5f7fb]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3efff] text-[#7657b9]">
                    <AlertCircle size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#34445d]">
                      Pending makeups
                    </p>

                    <p className="mt-0.5 text-xs text-[#9aa5b5]">
                      Classes requiring attention
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-[#101a33]">
                    {dashboard.attendance.pendingMakeups}
                  </span>

                  <ChevronRight
                    size={17}
                    className="text-[#b8c2d0] transition group-hover:translate-x-1"
                  />
                </div>
              </Link>

              <div className="rounded-xl bg-[#fafbfd] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3ff] text-[#496bb1]">
                    <ShieldCheck size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#34445d]">
                      Student activity
                    </p>

                    <p className="mt-0.5 text-xs text-[#9aa5b5]">
                      Active students across academy
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2 rounded-full bg-[#e7ebf1]">
                  <div
                    className="h-2 rounded-full bg-[#4b8fe8] transition-all duration-500"
                    style={{
                      width: `${activeStudentPercentage}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-[#9aa5b5]">
                    Active
                  </span>

                  <span className="font-bold text-[#34445d]">
                    {Math.round(activeStudentPercentage)}%
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[#f0e2c7] bg-[#fffaf0] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8ebcf] text-[#a87418]">
                    <CheckCircle2 size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#34445d]">
                      Academy status
                    </p>

                    <p className="mt-0.5 text-xs text-[#9aa5b5]">
                      All systems are operational
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function ArrowRightIcon() {
  return <ArrowUpRight size={15} />;
}
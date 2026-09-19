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
import {
  Button,
  PageHeader,
  SummaryCard,
  Card,
  Badge,
  EmptyState,
  ErrorState,
  LoadingSpinner,
} from "@/components/ui";

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

function clampPercentage(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

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

function getRatingVariant(
  rating: number,
): "success" | "info" | "warning" | "danger" {
  if (rating >= 4.5) return "success";
  if (rating >= 3.5) return "info";
  if (rating >= 2.5) return "warning";
  return "danger";
}

function getRatingLabel(rating: number) {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 3.5) return "Good";
  if (rating >= 2.5) return "Average";
  return "Needs improvement";
}

function ProgressBar({
  value,
  className,
}: {
  value: number;
  className: string;
}) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-(--line)">
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${className}`}
        style={{ width: `${clampPercentage(value)}%` }}
      />
    </div>
  );
}

function ProgressCircle({
  percentage,
  label,
  color,
  size = "large",
}: {
  percentage: number;
  label: string;
  color: string;
  size?: "large" | "medium";
}) {
  const value = Math.round(clampPercentage(percentage));

  return (
    <div
      className={`
        relative flex shrink-0 items-center justify-center rounded-full
        ${size === "large" ? "h-28 w-28" : "h-24 w-24"}
      `}
      style={{
        background: `conic-gradient(
          ${color} 0% ${value}%,
          var(--line) ${value}% 100%
        )`,
      }}
    >
      <div
        className={`
          absolute flex items-center justify-center
          rounded-full bg-(--card)
          ${size === "large" ? "inset-[10px]" : "inset-[9px]"}
        `}
      >
        <div className="text-center">
          <p
            className={`
              font-black tracking-tight text-(--foreground)
              ${size === "large" ? "text-2xl" : "text-xl"}
            `}
          >
            {value}%
          </p>

          <p className="
            text-[9px] font-bold uppercase
            tracking-[0.08em] text-(--ink-muted)
          ">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getDashboard();
      setDashboard(data.dashboard);
    } catch (error) {
      console.error(error);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="
        min-h-[calc(100vh-76px)]
        bg-(--background)
        px-4 py-6 sm:px-6 lg:px-8 xl:px-10
      ">
        <div className="mx-auto max-w-[1500px]">
          <LoadingSpinner
            fullPage
            text="Preparing your academy overview..."
          />
        </div>
      </main>
    );
  }

  if (error || !dashboard) {
    return (
      <main className="
        min-h-[calc(100vh-76px)]
        bg-(--background)
        px-4 py-6 sm:px-6 lg:px-8 xl:px-10
      ">
        <div className="mx-auto max-w-[1500px]">
          <ErrorState
            title="Unable to load dashboard"
            message={
              error ||
              "No dashboard data was returned by the server."
            }
            action={
              <Button
                variant="outline"
                onClick={loadDashboard}
              >
                Try again
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const activeStudentPercentage =
    dashboard.students.total > 0
      ? (dashboard.students.active /
          dashboard.students.total) *
        100
      : 0;

  const completedStudentPercentage =
    dashboard.students.total > 0
      ? (dashboard.students.completed /
          dashboard.students.total) *
        100
      : 0;

  const inactiveStudentPercentage =
    dashboard.students.total > 0
      ? (dashboard.students.inactive /
          dashboard.students.total) *
        100
      : 0;

  const attendancePercentage =
    dashboard.students.active > 0
      ? (dashboard.attendance.todayPresent /
          dashboard.students.active) *
        100
      : 0;

  const stats = [
    {
      title: "Total Students",
      value: dashboard.students.total,
      subtitle: `${dashboard.students.active} active students`,
      icon: <Users size={20} />,
      href: "/students",
    },
    {
      title: "Today's Attendance",
      value: dashboard.attendance.todayPresent,
      subtitle: `${dashboard.attendance.todayAbsent} absent today`,
      icon: <ClipboardCheck size={20} />,
      href: "/attendance",
    },
    {
      title: "Active Plans",
      value: dashboard.plans.active,
      subtitle: "Currently available",
      icon: <Award size={20} />,
      href: "/plans",
    },
    {
      title: "Pending Makeups",
      value: dashboard.attendance.pendingMakeups,
      subtitle: "Classes requiring makeup",
      icon: <AlertCircle size={20} />,
      href: "/attendance",
    },
  ];

  return (
    <main className="
      min-h-[calc(100vh-76px)]
      bg-(--background)
      px-4 py-6 sm:px-6 lg:px-8 xl:px-10
    ">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader
          eyebrow="Academy overview"
          title="Welcome back, Admin"
          description="Here's what's happening at your academy today."
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = "/students";
                }}
              >
                <Users size={17} />
                <span className="hidden sm:inline">
                  View students
                </span>
                <span className="sm:hidden">Students</span>
              </Button>

              <Button
                variant="primary"
                onClick={() => {
                  window.location.href = "/students";
                }}
              >
                <span className="text-lg leading-none">+</span>
                Add student
              </Button>
            </>
          }
        />

        <div className="
          grid gap-4 sm:grid-cols-2 xl:grid-cols-4
        ">
          {stats.map((stat) => (
            <Link
              href={stat.href}
              key={stat.title}
              className="block"
            >
              <SummaryCard
                title={stat.title}
                value={stat.value}
                subtitle={stat.subtitle}
                icon={stat.icon}
                className="h-full cursor-pointer"
              />
            </Link>
          ))}
        </div>

        <div className="
          mt-6 grid items-start gap-6
          xl:grid-cols-[1.35fr_0.65fr]
        ">
          <Card padding="lg" className="h-fit">
            <div className="
              flex items-start justify-between gap-4
            ">
              <div>
                <p className="
                  text-[11px] font-black uppercase
                  tracking-[0.18em] text-(--accent)
                ">
                  Student overview
                </p>

                <h2 className="
                  mt-2 text-xl font-black text-(--foreground)
                ">
                  Academy population
                </h2>

                <p className="
                  mt-1 text-sm text-(--ink-muted)
                ">
                  Current student enrollment and activity.
                </p>
              </div>

              <Link
                href="/students"
                className="
                  hidden items-center gap-1 rounded-lg
                  px-2 py-1 text-sm font-bold
                  text-(--accent) transition
                  hover:bg-(--accent-soft)
                  sm:inline-flex
                "
              >
                View students
                <ArrowUpRight size={15} />
              </Link>
            </div>

            <div className="
              mt-7 grid gap-6 lg:grid-cols-2
            ">
              <div className="
                flex items-center gap-5
                rounded-2xl bg-(--surface) p-5
              ">
                <ProgressCircle
                  percentage={activeStudentPercentage}
                  label="Active"
                  color="var(--accent)"
                />

                <div>
                  <p className="
                    text-sm font-bold text-(--foreground-soft)
                  ">
                    Active students
                  </p>

                  <p className="
                    mt-1 text-2xl font-black text-(--foreground)
                  ">
                    {dashboard.students.active}
                  </p>

                  <p className="
                    mt-1 text-xs text-(--ink-muted)
                  ">
                    Out of {dashboard.students.total} registered
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="
                    mb-2 flex items-center justify-between gap-3
                  ">
                    <div className="flex items-center gap-2">
                      <span className="
                        h-2.5 w-2.5 rounded-full bg-(--blue)
                      " />
                      <span className="
                        text-sm font-semibold text-(--ink-muted)
                      ">
                        Active students
                      </span>
                    </div>

                    <span className="
                      text-sm font-black text-(--foreground-soft)
                    ">
                      {dashboard.students.active}
                    </span>
                  </div>

                  <ProgressBar
                    value={activeStudentPercentage}
                    className="bg-(--blue)"
                  />
                </div>

                <div>
                  <div className="
                    mb-2 flex items-center justify-between gap-3
                  ">
                    <div className="flex items-center gap-2">
                      <span className="
                        h-2.5 w-2.5 rounded-full bg-(--accent)
                      " />
                      <span className="
                        text-sm font-semibold text-(--ink-muted)
                      ">
                        Completed students
                      </span>
                    </div>

                    <span className="
                      text-sm font-black text-(--foreground-soft)
                    ">
                      {dashboard.students.completed}
                    </span>
                  </div>

                  <ProgressBar
                    value={completedStudentPercentage}
                    className="bg-(--accent)"
                  />
                </div>

                <div>
                  <div className="
                    mb-2 flex items-center justify-between gap-3
                  ">
                    <div className="flex items-center gap-2">
                      <span className="
                        h-2.5 w-2.5 rounded-full bg-(--ink-faint)
                      " />
                      <span className="
                        text-sm font-semibold text-(--ink-muted)
                      ">
                        Inactive students
                      </span>
                    </div>

                    <span className="
                      text-sm font-black text-(--foreground-soft)
                    ">
                      {dashboard.students.inactive}
                    </span>
                  </div>

                  <ProgressBar
                    value={inactiveStudentPercentage}
                    className="bg-(--ink-faint)"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <div className="
              flex items-start justify-between gap-4
            ">
              <div>
                <p className="
                  text-[11px] font-black uppercase
                  tracking-[0.18em] text-(--accent)
                ">
                  Today's activity
                </p>

                <h2 className="
                  mt-2 text-xl font-black text-(--foreground)
                ">
                  Attendance summary
                </h2>

                <p className="
                  mt-1 text-sm text-(--ink-muted)
                ">
                  Today's attendance status.
                </p>
              </div>

              <div className="
                flex h-10 w-10 shrink-0 items-center
                justify-center rounded-xl
                bg-(--success-soft) text-(--success)
              ">
                <CalendarDays size={20} />
              </div>
            </div>

            <div className="
              mt-6 flex items-center gap-5
            ">
              <ProgressCircle
                percentage={attendancePercentage}
                label="Present"
                color="var(--success)"
                size="medium"
              />

              <div>
                <p className="
                  text-3xl font-black text-(--foreground)
                ">
                  {dashboard.attendance.todayPresent}
                </p>

                <p className="
                  mt-1 text-sm font-medium text-(--ink-muted)
                ">
                  Students present today
                </p>

                <p className="
                  mt-1 text-xs text-(--ink-faint)
                ">
                  {dashboard.attendance.todayAbsent} absent today
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="
                rounded-xl bg-(--success-soft) p-3.5
              ">
                <div className="
                  flex items-center gap-2 text-(--success)
                ">
                  <UserCheck size={17} />
                  <span className="text-xs font-bold">
                    Present
                  </span>
                </div>

                <p className="
                  mt-2 text-xl font-black text-(--success-strong)
                ">
                  {dashboard.attendance.todayPresent}
                </p>
              </div>

              <div className="
                rounded-xl bg-(--danger-soft) p-3.5
              ">
                <div className="
                  flex items-center gap-2 text-(--danger)
                ">
                  <UserX size={17} />
                  <span className="text-xs font-bold">
                    Absent
                  </span>
                </div>

                <p className="
                  mt-2 text-xl font-black text-(--danger-strong)
                ">
                  {dashboard.attendance.todayAbsent}
                </p>
              </div>
            </div>

            <Link
              href="/attendance"
              className="
                mt-5 flex items-center justify-center gap-2
                rounded-xl border border-(--line)
                px-4 py-3 text-sm font-bold
                text-(--foreground-soft) transition
                hover:border-(--accent)
                hover:bg-(--accent-soft)
                hover:text-(--accent)
              "
            >
              Open attendance
              <ArrowUpRight size={15} />
            </Link>
          </Card>
        </div>

        <div className="
          mt-6 grid gap-6
          xl:grid-cols-[1.35fr_0.65fr]
        ">
          <Card padding="none" className="overflow-hidden">
            <div className="
              flex items-start justify-between gap-4
              border-b border-(--line)
              px-5 py-5 sm:px-6
            ">
              <div>
                <p className="
                  text-[11px] font-black uppercase
                  tracking-[0.18em] text-(--accent)
                ">
                  Latest evaluations
                </p>

                <h2 className="
                  mt-2 text-xl font-black text-(--foreground)
                ">
                  Recent performance
                </h2>

                <p className="
                  mt-1 text-sm text-(--ink-muted)
                ">
                  Latest student performance evaluations.
                </p>
              </div>

              <Link
                href="/performance"
                className="
                  hidden items-center gap-1 rounded-lg
                  px-2 py-1 text-sm font-bold
                  text-(--accent) transition
                  hover:bg-(--accent-soft)
                  sm:inline-flex
                "
              >
                View all
                <ArrowUpRight size={15} />
              </Link>
            </div>

            {dashboard.recentPerformance.length === 0 ? (
              <div className="p-5 sm:p-6">
                <EmptyState
                  title="No performance records yet"
                  description="
                    Student evaluations will appear here once instructors
                    start recording performance data.
                  "
                  icon={<Activity size={22} />}
                />
              </div>
            ) : (
              <div className="divide-y divide-(--line)">
                {dashboard.recentPerformance
                  .slice(0, 5)
                  .map((record) => {
                    const studentName =
                      record.student?.name ||
                      "Unknown student";

                    return (
                      <div
                        key={record._id}
                        className="
                          flex items-center justify-between
                          gap-4 px-5 py-4 transition
                          hover:bg-(--surface)
                          sm:px-6
                        "
                      >
                        <div className="
                          flex min-w-0 items-center gap-3
                        ">
                          <div className="
                            flex h-10 w-10 shrink-0
                            items-center justify-center
                            rounded-full
                            bg-(--sidebar-logo-bg)
                            text-xs font-black text-(--accent)
                          ">
                            {getInitials(studentName)}
                          </div>

                          <div className="min-w-0">
                            <p className="
                              truncate text-sm font-bold
                              text-(--foreground-soft)
                            ">
                              {studentName}
                            </p>

                            <p className="
                              mt-1 truncate text-xs
                              text-(--ink-muted)
                            ">
                              {record.student?.currentBelt ||
                                "White Belt"}{" "}
                              · {record.skill}
                            </p>
                          </div>
                        </div>

                        <div className="
                          shrink-0 text-right
                        ">
                          <Badge
                            variant={getRatingVariant(
                              record.rating,
                            )}
                          >
                            {record.rating}/5
                          </Badge>

                          <p className="
                            mt-1 hidden text-[10px]
                            text-(--ink-faint) sm:block
                          ">
                            {getRatingLabel(record.rating)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="
              border-t border-(--line)
              px-5 py-4 sm:hidden
            ">
              <Link
                href="/performance"
                className="
                  flex items-center justify-center gap-1
                  text-sm font-bold text-(--accent)
                "
              >
                View all performance
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </Card>

          <Card padding="lg">
            <div>
              <p className="
                text-[11px] font-black uppercase
                tracking-[0.18em] text-(--accent)
              ">
                Quick summary
              </p>

              <h2 className="
                mt-2 text-xl font-black text-(--foreground)
              ">
                Academy operations
              </h2>

              <p className="
                mt-1 text-sm text-(--ink-muted)
              ">
                Important numbers at a glance.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <Link
                href="/plans"
                className="
                  group flex items-center justify-between
                  rounded-xl bg-(--surface) p-4
                  transition hover:bg-(--surface-hover)
                "
              >
                <div className="flex items-center gap-3">
                  <div className="
                    flex h-10 w-10 items-center justify-center
                    rounded-xl bg-(--accent-soft) text-(--accent)
                  ">
                    <Award size={19} />
                  </div>

                  <div>
                    <p className="
                      text-sm font-bold text-(--foreground-soft)
                    ">
                      Active plans
                    </p>

                    <p className="
                      mt-0.5 text-xs text-(--ink-muted)
                    ">
                      Available training plans
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="
                    text-lg font-black text-(--foreground)
                  ">
                    {dashboard.plans.active}
                  </span>

                  <ChevronRight
                    size={17}
                    className="
                      text-(--ink-faint) transition
                      group-hover:translate-x-1
                      group-hover:text-(--accent)
                    "
                  />
                </div>
              </Link>

              <Link
                href="/attendance"
                className="
                  group flex items-center justify-between
                  rounded-xl bg-(--surface) p-4
                  transition hover:bg-(--surface-hover)
                "
              >
                <div className="flex items-center gap-3">
                  <div className="
                    flex h-10 w-10 items-center justify-center
                    rounded-xl bg-(--purple-soft) text-(--purple)
                  ">
                    <AlertCircle size={19} />
                  </div>

                  <div>
                    <p className="
                      text-sm font-bold text-(--foreground-soft)
                    ">
                      Pending makeups
                    </p>

                    <p className="
                      mt-0.5 text-xs text-(--ink-muted)
                    ">
                      Classes requiring attention
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="
                    text-lg font-black text-(--foreground)
                  ">
                    {dashboard.attendance.pendingMakeups}
                  </span>

                  <ChevronRight
                    size={17}
                    className="
                      text-(--ink-faint) transition
                      group-hover:translate-x-1
                      group-hover:text-(--purple)
                    "
                  />
                </div>
              </Link>

              <div className="
                rounded-xl bg-(--surface) p-4
              ">
                <div className="flex items-center gap-3">
                  <div className="
                    flex h-10 w-10 items-center justify-center
                    rounded-xl bg-(--blue-soft) text-(--blue)
                  ">
                    <ShieldCheck size={19} />
                  </div>

                  <div>
                    <p className="
                      text-sm font-bold text-(--foreground-soft)
                    ">
                      Student activity
                    </p>

                    <p className="
                      mt-0.5 text-xs text-(--ink-muted)
                    ">
                      Active students across academy
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <ProgressBar
                    value={activeStudentPercentage}
                    className="bg-(--blue)"
                  />
                </div>

                <div className="
                  mt-2 flex justify-between text-xs
                ">
                  <span className="text-(--ink-faint)">
                    Active
                  </span>

                  <span className="
                    font-bold text-(--foreground-soft)
                  ">
                    {Math.round(
                      clampPercentage(activeStudentPercentage),
                    )}
                    %
                  </span>
                </div>
              </div>

              <div className="
                rounded-xl border border-(--gold-border)
                bg-(--gold-soft) p-4
              ">
                <div className="flex items-center gap-3">
                  <div className="
                    flex h-10 w-10 items-center justify-center
                    rounded-xl bg-(--gold-muted) text-(--gold)
                  ">
                    <CheckCircle2 size={19} />
                  </div>

                  <div>
                    <p className="
                      text-sm font-bold text-(--foreground-soft)
                    ">
                      Academy status
                    </p>

                    <p className="
                      mt-0.5 text-xs text-(--ink-muted)
                    ">
                      All systems are operational
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

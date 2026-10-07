"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  Printer,
  School,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import { getDashboard } from "@/lib/api";
import { useAcademyBrand } from "@/components/settings/AcademyBrandProvider";
import {
  ComparisonList,
  ExecutiveLineChart,
} from "@/components/dashboard/ExecutiveCharts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  PageHeader,
  SummaryCard,
  TableHeading,
} from "@/components/ui";

type MetricRow = {
  name: string;
  count?: number;
  amount?: number;
  present?: number;
  total?: number;
  rate?: number;
};
type ExecutiveAnalytics = {
  dateRange: { from: string; to: string };
  kpis: {
    activeStudents: number;
    newStudents: number;
    admissions: number;
    trials: number;
    conversionRate: number | null;
    revenue: number | null;
    outstandingFees: number | null;
    attendanceRate: number;
    expiringMemberships: number;
    pendingMakeups: number;
  };
  studentAnalytics: {
    growth: { _id: string; count: number }[];
    activeInactive: MetricRow[];
    branches: MetricRow[];
    programs: MetricRow[];
  };
  financialAnalytics: {
    available: boolean;
    revenue: number | null;
    outstanding: number | null;
    monthlyRevenue: { _id: string; amount: number }[];
    branchRevenue: { name: string; amount: number }[];
    programRevenue: { name: string; amount: number }[];
    collectionOutstanding: { name: string; amount: number }[];
  };
  attendanceAnalytics: {
    present: number;
    absent: number;
    rateTrend: { month: string; rate: number }[];
    branches: MetricRow[];
    programs: MetricRow[];
    atRisk: {
      student: string;
      attendanceRate: number;
      lastAttended?: string;
      consecutiveAbsences: number;
    }[];
  };
  admissions: {
    available: boolean;
    leads?: number;
    contacted?: number;
    trials?: number;
    trialCompleted?: number;
    interested?: number;
    converted?: number;
    lost?: number;
    conversionRate?: number;
    funnel?: { name: string; count: number }[];
  };
  renewals: {
    expiring: number;
    expired: number;
    renewed: number;
    renewalRate: number;
  };
};
type DashboardData = {
  executive: ExecutiveAnalytics;
  students: {
    total: number;
    active: number;
    inactive: number;
    completed: number;
  };
  plans: { active: number };
  attendance: {
    todayPresent: number;
    todayAbsent: number;
    pendingMakeups: number;
  };
  recentPerformance: {
    _id: string;
    student?: { _id: string; name: string; currentBelt?: string } | null;
    skill: string;
    rating: number;
    remarks?: string;
  }[];
};

function indiaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function indiaYearStart() {
  return `${indiaToday().slice(0, 4)}-01-01`;
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--accent)">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-(--foreground)">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-(--ink-muted)">{description}</p>
      )}
    </div>
  );
}

function ProgressCircle({
  percentage,
  label,
  color,
  size = "medium",
}: {
  percentage: number;
  label: string;
  color: string;
  size?: "medium" | "large";
}) {
  const value = Math.min(100, Math.max(0, Math.round(percentage)));
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full ${size === "large" ? "h-35 w-35" : "h-28 w-28"}`}
      style={{
        background: `conic-gradient(${color} 0% ${value}%, var(--line) ${value}% 100%)`,
      }}
    >
      <div
        className={`absolute flex items-center justify-center rounded-full bg-(--card) ${size === "large" ? "inset-[10px]" : "inset-[9px]"}`}
      >
        <div className="text-center">
          <p
            className={`${size === "large" ? "text-2xl" : "text-xl"} font-black tracking-tight text-(--foreground)`}
          >
            {value}%
          </p>
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-(--ink-muted)">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { settings } = useAcademyBrand();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dateFrom, setDateFrom] = useState(indiaYearStart);
  const [dateTo, setDateTo] = useState(indiaToday);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const formatMoney = (value: number | null | undefined) => {
    if (value == null) return "Restricted";
    const currency = settings.currency.trim();
    try {
      return currency
        ? new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          }).format(value)
        : new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
            value,
          );
    } catch {
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0,
      }).format(value);
    }
  };
  const loadDashboard = async (from = dateFrom, to = dateTo) => {
    try {
      setLoading(true);
      setError("");
      const data = await getDashboard({ from, to });
      setDashboard(data.dashboard);
    } catch (loadError) {
      console.error(loadError);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    getDashboard({ from: indiaYearStart(), to: indiaToday() })
      .then((data) => {
        if (active) setDashboard(data.dashboard);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (active) setError("Failed to load dashboard data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const exportExecutive = () => {
    if (!dashboard) return;
    const executive = dashboard.executive;
    const rows = [
      ["Metric", "Value"],
      ["Active Students", String(executive.kpis.activeStudents)],
      ["New Students", String(executive.kpis.newStudents)],
      ["Admissions", String(executive.kpis.admissions)],
      [
        "Conversion Rate",
        executive.kpis.conversionRate == null
          ? "Restricted"
          : `${executive.kpis.conversionRate}%`,
      ],
      ["Revenue", formatMoney(executive.kpis.revenue)],
      ["Outstanding Fees", formatMoney(executive.kpis.outstandingFees)],
      ["Attendance Rate", `${executive.kpis.attendanceRate}%`],
      ["Expiring Memberships", String(executive.kpis.expiringMemberships)],
      ["Pending Makeups", String(executive.kpis.pendingMakeups)],
      ...(executive.admissions.funnel || []).map((item) => [
        `Admission funnel: ${item.name}`,
        String(item.count),
      ]),
      ...executive.attendanceAnalytics.atRisk.map((item) => [
        `At risk: ${item.student}`,
        `${item.attendanceRate}%; ${item.consecutiveAbsences} consecutive absences`,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `executive-dashboard-${dateFrom}-to-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !dashboard)
    return (
      <main className="df-page">
        <LoadingSpinner fullPage text="Preparing your academy overview..." />
      </main>
    );
  if ((error || !dashboard) && !dashboard)
    return (
      <main className="df-page">
        <ErrorState
          title="Unable to load dashboard"
          message={error || "No dashboard data was returned by the server."}
          action={
            <Button variant="outline" onClick={() => void loadDashboard()}>
              Try again
            </Button>
          }
        />
      </main>
    );
  if (!dashboard) return null;
  const executive = dashboard.executive;
  const primary = [
    {
      title: "Active Students",
      value: executive.kpis.activeStudents,
      subtitle: "Currently enrolled",
      icon: <Users size={16} />,
    },
    {
      title: "New Students",
      value: executive.kpis.newStudents,
      subtitle: "Selected period",
      icon: <UserCheck size={16} />,
    },
    {
      title: "Admissions",
      value: executive.kpis.admissions,
      subtitle: "Selected period",
      icon: <School size={16} />,
    },
    {
      title: "Conversion Rate",
      value:
        executive.kpis.conversionRate == null
          ? "Restricted"
          : `${executive.kpis.conversionRate}%`,
      subtitle: "Admission conversion",
      icon: <TrendingUp size={16} />,
    },
    {
      title: "Revenue",
      value: formatMoney(executive.kpis.revenue),
      subtitle: "Collected in period",
      icon: <Wallet size={16} />,
    },
  ];
  const branchNames = new Set([
    ...executive.studentAnalytics.branches.map((row) => row.name),
    ...executive.financialAnalytics.branchRevenue.map((row) => row.name),
    ...executive.attendanceAnalytics.branches.map((row) => row.name),
  ]);
  const programNames = new Set([
    ...executive.studentAnalytics.programs.map((row) => row.name),
    ...executive.financialAnalytics.programRevenue.map((row) => row.name),
    ...executive.attendanceAnalytics.programs.map((row) => row.name),
  ]);
  const findValue = (rows: MetricRow[], name: string, key: "count" | "rate") =>
    rows.find((row) => row.name === name)?.[key] ?? 0;
  const findAmount = (rows: { name: string; amount: number }[], name: string) =>
    rows.find((row) => row.name === name)?.amount ?? 0;
  const actionCount =
    executive.attendanceAnalytics.atRisk.length +
    executive.renewals.expiring +
    (executive.kpis.pendingMakeups > 0 ? 1 : 0) +
    (executive.kpis.outstandingFees && executive.kpis.outstandingFees > 0
      ? 1
      : 0);
  const activeStudentPercentage =
    dashboard.students.total > 0
      ? (dashboard.students.active / dashboard.students.total) * 100
      : 0;
  const completedStudentPercentage =
    dashboard.students.total > 0
      ? (dashboard.students.completed / dashboard.students.total) * 100
      : 0;
  const inactiveStudentPercentage =
    dashboard.students.total > 0
      ? (dashboard.students.inactive / dashboard.students.total) * 100
      : 0;
  const funnel = executive.admissions.funnel || [];
  const trendGrowth = executive.studentAnalytics.growth.map((row) => ({
    label: row._id,
    value: row.count,
  }));
  const attendanceTrend = executive.attendanceAnalytics.rateTrend.map(
    (row) => ({ label: row.month, value: row.rate }),
  );

  return (
    <div className="df-page reports-print-root space-y-7 print:space-y-5">
      <PageHeader
        eyebrow="Academy overview"
        title="Welcome back, Admin"
        description="Here's what's happening at your academy today."
        className="mb-0"
        actions={
          <div className="flex flex-wrap items-end gap-2 print:hidden">
            <label className="text-[11px] font-semibold text-(--ink-muted)">
              From
              <Input
                aria-label="Date range from"
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-1 w-36"
              />
            </label>
            <label className="text-[11px] font-semibold text-(--ink-muted)">
              To
              <Input
                aria-label="Date range to"
                type="date"
                value={dateTo}
                min={dateFrom}
                max={indiaToday()}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-1 w-36"
              />
            </label>
            <Button
              variant="primary"
              size="lg"
              onClick={() => void loadDashboard(dateFrom, dateTo)}
              loading={loading}
            >
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={exportExecutive}
              aria-label="Export dashboard CSV"
            >
              <Download size={18} />
              <span className="hidden xl:inline">Export</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              aria-label="Print dashboard"
            >
              <Printer size={18} />
              <span className="hidden xl:inline">Print</span>
            </Button>
          </div>
        }
      />
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-(--danger) bg-(--danger-soft) px-4 py-2 text-sm text-(--danger)"
        >
          {error} Showing the last successfully loaded data.
        </div>
      )}

      <section
        className="print:break-inside-avoid"
        aria-label="Executive summary"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {primary.map((item) => (
            <SummaryCard
              key={item.title}
              title={item.title}
              value={item.value}
              subtitle={item.subtitle}
              icon={item.icon}
            />
          ))}
        </div>
      </section>

      <section className="grid items-stretch gap-5 lg:grid-cols-2 print:break-inside-avoid">
        {/* Student Overview */}
        <Card padding="lg" className="h-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-(--accent)">
                Student overview
              </p>

              <h2 className="mt-2 text-xl font-black text-(--foreground)">
                Academy population
              </h2>

              <p className="mt-1 text-sm text-(--ink-muted)">
                Current student enrollment and activity.
              </p>
            </div>

            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--blue-soft) text-(--blue)">
              <School size={20} />
            </span>
          </div>

          <div className="mt-10 grid items-center gap-6 lg:grid-cols-1">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <ProgressCircle
                percentage={activeStudentPercentage}
                label="Active"
                color="var(--blue)"
                size="large"
              />

              <span className="text-xs text-(--ink-muted)">
                {dashboard.students.total.toLocaleString()} total students
              </span>
            </div>

            <div className="w-full space-y-5 pt-1">
              {[
                {
                  label: "Active students",
                  value: dashboard.students.active,
                  percentage: activeStudentPercentage,
                  color: "bg-(--blue)",
                },
                {
                  label: "Completed students",
                  value: dashboard.students.completed,
                  percentage: completedStudentPercentage,
                  color: "bg-(--accent)",
                },
                {
                  label: "Inactive students",
                  value: dashboard.students.inactive,
                  percentage: inactiveStudentPercentage,
                  color: "bg-(--ink-faint)",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-(--ink-muted)">
                      {item.label}
                    </span>

                    <span className="text-sm font-black text-(--foreground-soft)">
                      {item.value.toLocaleString()}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-(--line)">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, item.percentage),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/students"
              className="
          col-span-full
          mt-5 flex w-full items-center justify-center gap-2
          rounded-xl border border-(--line)
          px-4 py-3 text-sm font-bold
          text-(--foreground-soft)
          transition
          hover:border-(--accent)
          hover:bg-(--accent-soft)
          hover:text-(--accent)
        "
            >
              View students
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </Card>

        {/* Attendance Summary */}
        <Card padding="lg" className="h-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-(--accent)">
                Today&apos;s activity
              </p>

              <h2 className="mt-2 text-xl font-black text-(--foreground)">
                Attendance summary
              </h2>

              <p className="mt-1 text-sm text-(--ink-muted)">
                Regular attendance, excluding makeups.
              </p>
            </div>

            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--success-soft) text-(--success)">
              <CalendarDays size={20} />
            </span>
          </div>

          {/* Period overview */}
          <div className="mt-6 flex items-center gap-5">
            <ProgressCircle
              percentage={executive.kpis.attendanceRate}
              label="Period rate"
              color="var(--success)"
            />

            <div>
              <p className="text-3xl font-black text-(--foreground)">
                {executive.kpis.attendanceRate}%
              </p>

              <p className="mt-1 text-sm font-medium text-(--ink-muted)">
                Attendance rate for selected period
              </p>
            </div>
          </div>

          {/* Today's attendance */}
          <div className="mt-5 rounded-xl border border-(--line) bg-(--surface-soft) p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-(--ink-muted)">
                Today
              </p>

              <CalendarDays size={15} className="text-(--ink-muted)" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-(--success-soft) p-3.5">
                <div className="flex items-center gap-2 text-(--success)">
                  <UserCheck size={17} />

                  <span className="text-xs font-bold">Present today</span>
                </div>

                <p className="mt-2 text-xl font-black text-(--success-strong)">
                  {dashboard.attendance.todayPresent.toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl bg-(--danger-soft) p-3.5">
                <div className="flex items-center gap-2 text-(--danger)">
                  <UserX size={17} />

                  <span className="text-xs font-bold">Absent today</span>
                </div>

                <p className="mt-2 text-xl font-black text-(--danger-strong)">
                  {dashboard.attendance.todayAbsent.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Selected period attendance */}
          <div className="mt-4">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-(--ink-muted)">
              Selected period
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-(--success-soft) p-3.5">
                <div className="flex items-center gap-2 text-(--success)">
                  <UserCheck size={17} />

                  <span className="text-xs font-bold">Present</span>
                </div>

                <p className="mt-2 text-xl font-black text-(--success-strong)">
                  {executive.attendanceAnalytics.present.toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl bg-(--danger-soft) p-3.5">
                <div className="flex items-center gap-2 text-(--danger)">
                  <UserX size={17} />

                  <span className="text-xs font-bold">Absent</span>
                </div>

                <p className="mt-2 text-xl font-black text-(--danger-strong)">
                  {executive.attendanceAnalytics.absent.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/attendance"
            className="
        mt-5 flex items-center justify-center gap-2
        rounded-xl border border-(--line)
        px-4 py-3 text-sm font-bold
        text-(--foreground-soft)
        transition
        hover:border-(--accent)
        hover:bg-(--accent-soft)
        hover:text-(--accent)
        print:hidden
      "
          >
            Open attendance
            <ArrowUpRight size={15} />
          </Link>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(280px,1fr)] print:break-inside-avoid">
        <Card padding="lg" className="min-w-0">
          <SectionTitle
            eyebrow="Enrollment"
            title="Student growth"
            description="Students registered across the selected period."
          />
          <ExecutiveLineChart
            rows={trendGrowth}
            valueLabel="Registered students"
            format={(value) => Math.round(value).toLocaleString()}
            empty="Student growth will appear when registration records are available."
          />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-(--line) pt-3 text-xs text-(--ink-muted)">
            <span>
              <i className="mr-2 inline-block h-2 w-2 rounded-full bg-(--accent)" />
              Active {dashboard.students.active.toLocaleString()}
            </span>
            <span>
              <i className="mr-2 inline-block h-2 w-2 rounded-full bg-(--blue)" />
              Inactive {dashboard.students.inactive.toLocaleString()}
            </span>
            <span>
              <i className="mr-2 inline-block h-2 w-2 rounded-full bg-(--ink-faint)" />
              Completed {dashboard.students.completed.toLocaleString()}
            </span>
          </div>
        </Card>
        <Card padding="lg" className="min-w-0">
          <SectionTitle
            eyebrow="Overview"
            title="Academy health"
            description="Current operating signals."
          />
          <div className="divide-y divide-(--line)">
            {[
              {
                label: "Attendance",
                value: `${executive.kpis.attendanceRate}%`,
                icon: <ClipboardCheck size={16} />,
                href: "/reports/attendance-analytics",
                note: "Regular attendance",
              },
              {
                label: "Outstanding",
                value: formatMoney(executive.kpis.outstandingFees),
                icon: <Wallet size={16} />,
                href: "/fees",
                note: "Fees to collect",
              },
              {
                label: "Expiring",
                value: executive.kpis.expiringMemberships.toLocaleString(),
                icon: <CalendarDays size={16} />,
                href: "/memberships",
                note: "Memberships",
              },
              {
                label: "Pending makeups",
                value: executive.kpis.pendingMakeups.toLocaleString(),
                icon: <AlertCircle size={16} />,
                href: "/attendance",
                note: "Awaiting completion",
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-(--accent)"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="text-(--ink-muted)">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-(--foreground)">
                      {item.label}
                    </span>
                    <span className="block text-xs text-(--ink-muted)">
                      {item.note}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm font-bold text-(--foreground)">
                  {item.value}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(270px,1fr)] print:break-inside-avoid">
        <Card padding="lg" className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <SectionTitle
              eyebrow="Admissions"
              title="Admission funnel"
              description="Lead progression in the selected period."
            />
            {executive.admissions.available && (
              <Badge variant="info">
                {executive.admissions.conversionRate ?? 0}% conversion
              </Badge>
            )}
          </div>
          {!executive.admissions.available ? (
            <p className="rounded-lg bg-(--surface-muted) p-4 text-sm text-(--ink-muted)">
              Admission analytics require inquiry view permission.
            </p>
          ) : funnel.length ? (
            <div className="mx-auto max-w-3xl space-y-2">
              {funnel.map((stage, index) => {
                const max = Math.max(1, ...funnel.map((item) => item.count));
                const width = Math.max(18, (stage.count / max) * 100);
                return (
                  <div
                    key={`${stage.name}-${index}`}
                    className="flex items-center gap-3"
                  >
                    <span className="w-28 shrink-0 truncate text-xs font-medium text-(--ink-muted)">
                      {stage.name}
                    </span>
                    <div className="h-8 min-w-0 flex-1 overflow-hidden rounded-md bg-(--surface-muted)">
                      <div
                        className="flex h-full items-center rounded-md bg-(--accent) px-3 text-xs font-semibold text-white transition-all"
                        style={{
                          width: `${stage.count === 0 ? 0 : width}%`,
                          opacity: Math.max(0.45, 1 - index * 0.07),
                        }}
                      >
                        {stage.count > 0 ? stage.count.toLocaleString() : ""}
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-semibold text-(--foreground)">
                      {stage.count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No admissions in this period"
              description="Funnel stages appear when there are inquiry records."
              icon={<School size={20} />}
            />
          )}
        </Card>
        <Card padding="lg" className="min-w-0">
          <SectionTitle
            eyebrow="Retention"
            title="Renewal health"
            description="Membership activity."
          />
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "Expiring",
                value: executive.renewals.expiring,
                tone: "text-(--warning)",
              },
              {
                label: "Expired",
                value: executive.renewals.expired,
                tone: "text-(--danger)",
              },
              {
                label: "Renewed",
                value: executive.renewals.renewed,
                tone: "text-(--success)",
              },
              {
                label: "Renewal rate",
                value: `${executive.renewals.renewalRate}%`,
                tone: "text-(--foreground)",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-(--surface-muted) p-3"
              >
                <p className="text-xs text-(--ink-muted)">{item.label}</p>
                <p className={`mt-1 text-xl font-bold ${item.tone}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="print:break-inside-avoid">
        <Card padding="lg">
          <SectionTitle
            eyebrow="Finance"
            title="Financial performance"
            description="Collections and outstanding balance over time."
          />
          {executive.financialAnalytics.available ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(260px,0.9fr)]">
              <Card padding="lg" className="min-w-0">
                <ExecutiveLineChart
                  rows={executive.financialAnalytics.monthlyRevenue.map(
                    (row) => ({ label: row._id, value: row.amount }),
                  )}
                  valueLabel="Collected revenue"
                  format={formatMoney}
                  color="var(--success)"
                  empty="Revenue will appear when financial records are available."
                />
              </Card>
              <Card padding="lg" className="min-w-0">
                <h3 className="text-base font-semibold text-(--foreground)">
                  Collection vs outstanding
                </h3>
                <p className="mt-1 text-xs text-(--ink-muted)">
                  Values for the selected date range.
                </p>
                <div className="mt-5">
                  <ComparisonList
                    rows={executive.financialAnalytics.collectionOutstanding.map(
                      (row) => ({ name: row.name, value: row.amount }),
                    )}
                    format={formatMoney}
                    color="var(--success)"
                    empty="No collection comparison data."
                  />
                </div>
              </Card>
            </div>
          ) : (
            <Card>
              <p className="text-sm text-(--ink-muted)">
                Financial analytics require finance view permission.
              </p>
            </Card>
          )}
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)] print:break-inside-avoid">
        <Card className="min-w-0">
          <SectionTitle
            eyebrow="Participation"
            title="Attendance performance"
            description="Regular attendance trend; makeup sessions are excluded from attendance totals."
          />
          <div className="mb-2 flex flex-wrap gap-4 text-xs text-(--ink-muted)">
            <span>
              Present{" "}
              <strong className="ml-1 text-(--foreground)">
                {executive.attendanceAnalytics.present.toLocaleString()}
              </strong>
            </span>
            <span>
              Absent{" "}
              <strong className="ml-1 text-(--foreground)">
                {executive.attendanceAnalytics.absent.toLocaleString()}
              </strong>
            </span>
            <span>
              Current rate{" "}
              <strong className="ml-1 text-(--foreground)">
                {executive.kpis.attendanceRate}%
              </strong>
            </span>
            <span>
              Today{" "}
              <strong className="ml-1 text-(--foreground)">
                {dashboard.attendance.todayPresent} present /{" "}
                {dashboard.attendance.todayAbsent} absent
              </strong>
            </span>
          </div>
          {attendanceTrend.length >= 2 ? (
            <ExecutiveLineChart
              rows={attendanceTrend}
              valueLabel="Attendance rate"
              color="var(--blue)"
              domainMax={100}
              format={(value) => `${Math.round(value)}%`}
              empty="Attendance trends appear after attendance is recorded."
            />
          ) : (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex w-full max-w-md flex-col items-center">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(
              var(--blue) ${Math.min(
                100,
                Math.max(0, executive.kpis.attendanceRate),
              )}%,
              var(--line) 0
            )`,
                    }}
                  />
                  <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-(--surface)">
                    <span className="text-3xl font-black text-(--foreground)">
                      {executive.kpis.attendanceRate}%
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-(--ink-muted)">
                      Attendance
                    </span>
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-(--ink-muted)">
                  Attendance trend will appear when multiple periods are
                  available.
                </p>
              </div>
            </div>
          )}
        </Card>
        <Card padding="lg" className="min-w-0">
          <SectionTitle
            eyebrow="Comparison"
            title="Attendance by branch & program"
          />
          <div>
            <h3 className="mb-2 text-xs font-semibold text-(--foreground)">
              Branches
            </h3>
            <ComparisonList
              rows={executive.attendanceAnalytics.branches.map((row) => ({
                name: row.name,
                value: row.rate ?? 0,
              }))}
              format={(value) => `${value}%`}
              color="var(--blue)"
            />
          </div>
          <div className="mt-5 border-t border-(--line) pt-4">
            <h3 className="mb-2 text-xs font-semibold text-(--foreground)">
              Programs
            </h3>
            <ComparisonList
              rows={executive.attendanceAnalytics.programs.map((row) => ({
                name: row.name,
                value: row.rate ?? 0,
              }))}
              format={(value) => `${value}%`}
              color="var(--purple)"
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2 print:break-inside-avoid">
        <Card padding="lg" className="min-w-0">
          <SectionTitle
            eyebrow="Locations"
            title="Branch performance"
            description="Student enrollment, collected revenue, and regular attendance."
          />
          {branchNames.size ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-xs">
                <thead>
                  <tr className="border-b border-(--line) text-(--ink-muted)">
                    <TableHeading className="py-2 pl-0 pr-3">
                      Branch
                    </TableHeading>
                    <TableHeading align="right" className="px-3 py-2">
                      Students
                    </TableHeading>
                    <TableHeading align="right" className="px-3 py-2">
                      Revenue
                    </TableHeading>
                    <TableHeading align="right" className="py-2 pl-3 pr-0">
                      Attendance
                    </TableHeading>
                  </tr>
                </thead>
                <tbody>
                  {[...branchNames].map((name) => (
                    <tr
                      key={name}
                      className="border-b border-(--line) last:border-0"
                    >
                      <td className="py-3 pr-3 font-semibold text-(--foreground)">
                        {name}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {findValue(
                          executive.studentAnalytics.branches,
                          name,
                          "count",
                        ).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {executive.financialAnalytics.available
                          ? formatMoney(
                              findAmount(
                                executive.financialAnalytics.branchRevenue,
                                name,
                              ),
                            )
                          : "Restricted"}
                      </td>
                      <td className="pl-3 py-3 text-right">
                        {findValue(
                          executive.attendanceAnalytics.branches,
                          name,
                          "rate",
                        ).toLocaleString()}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-(--ink-muted)">
              No branch comparison data for this period.
            </p>
          )}
        </Card>
        <Card padding="lg" className="min-w-0">
          <SectionTitle
            eyebrow="Programs"
            title="Program performance"
            description="Enrollment distribution with available attendance and revenue context."
          />
          {programNames.size ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-xs">
                <thead>
                  <tr className="border-b border-(--line) text-(--ink-muted)">
                    <TableHeading className="py-2 pl-0 pr-3">
                      Program
                    </TableHeading>
                    <TableHeading align="right" className="px-3 py-2">
                      Students
                    </TableHeading>
                    <TableHeading align="right" className="px-3 py-2">
                      Revenue
                    </TableHeading>
                    <TableHeading align="right" className="py-2 pl-3 pr-0">
                      Attendance
                    </TableHeading>
                  </tr>
                </thead>
                <tbody>
                  {[...programNames].map((name) => (
                    <tr
                      key={name}
                      className="border-b border-(--line) last:border-0"
                    >
                      <td className="py-3 pr-3 font-semibold text-(--foreground)">
                        {name}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {findValue(
                          executive.studentAnalytics.programs,
                          name,
                          "count",
                        ).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {executive.financialAnalytics.available
                          ? formatMoney(
                              findAmount(
                                executive.financialAnalytics.programRevenue,
                                name,
                              ),
                            )
                          : "Restricted"}
                      </td>
                      <td className="pl-3 py-3 text-right">
                        {findValue(
                          executive.attendanceAnalytics.programs,
                          name,
                          "rate",
                        ).toLocaleString()}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-(--ink-muted)">
              No program comparison data for this period.
            </p>
          )}
          <div className="mt-4 border-t border-(--line) pt-4">
            <h3 className="mb-2 text-xs font-semibold text-(--foreground)">
              Student status
            </h3>
            <ComparisonList
              rows={executive.studentAnalytics.activeInactive.map((row) => ({
                name: row.name,
                value: row.count ?? 0,
              }))}
            />
          </div>
        </Card>
      </section>

      <section className="print:break-inside-avoid">
        <Card padding="lg">
          <SectionTitle
            eyebrow="Priorities"
            title="Action required"
            description="Items that may need follow-up."
          />

          {actionCount === 0 ? (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--success-soft) text-(--success)">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <p className="font-semibold text-(--foreground)">
                  Everything looks healthy
                </p>
                <p className="mt-0.5 text-sm text-(--ink-muted)">
                  No current attendance or renewal issues require attention.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {executive.attendanceAnalytics.atRisk.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">At-risk students</h3>
                    <Link
                      href="/reports/attendance-analytics"
                      className="text-xs font-semibold text-(--accent)"
                    >
                      Attendance report{" "}
                      <ArrowUpRight size={13} className="inline" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {executive.attendanceAnalytics.atRisk
                      .slice(0, 6)
                      .map((item) => (
                        <div
                          key={item.student}
                          className="flex items-center justify-between gap-3 rounded-lg bg-(--surface-muted) px-3 py-2"
                        >
                          <span className="min-w-0 truncate text-sm font-medium">
                            {item.student}
                          </span>
                          <span className="shrink-0 text-xs text-(--danger)">
                            {item.attendanceRate}% · {item.consecutiveAbsences}{" "}
                            absences
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="grid content-start gap-2 sm:grid-cols-2">
                {executive.renewals.expiring > 0 && (
                  <Link
                    href="/memberships"
                    className="rounded-lg border border-(--line) p-3 hover:border-(--accent)"
                  >
                    <p className="text-xs text-(--ink-muted)">
                      Expiring memberships
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {executive.renewals.expiring}
                    </p>
                  </Link>
                )}
                {executive.kpis.pendingMakeups > 0 && (
                  <Link
                    href="/attendance"
                    className="rounded-lg border border-(--line) p-3 hover:border-(--accent)"
                  >
                    <p className="text-xs text-(--ink-muted)">
                      Pending makeups
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {executive.kpis.pendingMakeups}
                    </p>
                  </Link>
                )}
                {executive.kpis.outstandingFees != null &&
                  executive.kpis.outstandingFees > 0 && (
                    <Link
                      href="/fees"
                      className="rounded-lg border border-(--line) p-3 hover:border-(--accent)"
                    >
                      <p className="text-xs text-(--ink-muted)">
                        Outstanding fees
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {formatMoney(executive.kpis.outstandingFees)}
                      </p>
                    </Link>
                  )}
              </div>
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)] print:break-inside-avoid">
        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-(--line) px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-(--accent)">
                Latest evaluations
              </p>
              <h2 className="mt-1 text-base font-semibold">
                Recent performance
              </h2>
            </div>
            <Link
              href="/performance"
              className="text-xs font-semibold text-(--accent)"
            >
              View all <ArrowUpRight size={13} className="inline" />
            </Link>
          </div>
          {dashboard.recentPerformance.length ? (
            <div className="divide-y divide-(--line)">
              {dashboard.recentPerformance.slice(0, 4).map((record) => {
                const student = record.student?.name || "Unknown student";
                return (
                  <div
                    key={record._id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--accent-soft) text-xs font-bold text-(--accent)">
                        {initials(student)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {student}
                        </span>
                        <span className="block truncate text-xs text-(--ink-muted)">
                          {record.student?.currentBelt || "White Belt"} ·{" "}
                          {record.skill}
                        </span>
                      </span>
                    </div>
                    <Badge
                      variant={
                        record.rating >= 4
                          ? "success"
                          : record.rating >= 3
                            ? "warning"
                            : "danger"
                      }
                    >
                      {record.rating}/5
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No recent evaluations"
                description="Student evaluations will appear here when recorded."
                icon={<Activity size={20} />}
              />
            </div>
          )}
        </Card>
        <Card padding="lg">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-(--accent)">
              Quick summary
            </p>
            <h2 className="mt-2 text-xl font-black text-(--foreground)">
              Academy operations
            </h2>
            <p className="mt-1 text-sm text-(--ink-muted)">
              Useful training and activity signals.
            </p>
          </div>
          <div className="mt-5 space-y-3">
            <Link
              href="/plans"
              className="group flex items-center justify-between rounded-xl bg-(--surface) p-3.5 transition hover:bg-(--surface-hover) print:hidden"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                  <School size={18} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-(--foreground-soft)">
                    Active plans
                  </span>
                  <span className="mt-0.5 block text-xs text-(--ink-muted)">
                    Available training plans
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2 text-lg font-black">
                {dashboard.plans.active}
                <ChevronRight
                  size={16}
                  className="text-(--ink-faint) transition group-hover:translate-x-1 group-hover:text-(--accent)"
                />
              </span>
            </Link>
            <Link
              href="/attendance"
              className="group flex items-center justify-between rounded-xl bg-(--surface) p-3.5 transition hover:bg-(--surface-hover) print:hidden"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--purple-soft) text-(--purple)">
                  <AlertCircle size={18} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-(--foreground-soft)">
                    Pending makeups
                  </span>
                  <span className="mt-0.5 block text-xs text-(--ink-muted)">
                    Classes requiring follow-up
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2 text-lg font-black">
                {dashboard.attendance.pendingMakeups}
                <ChevronRight
                  size={16}
                  className="text-(--ink-faint) transition group-hover:translate-x-1 group-hover:text-(--purple)"
                />
              </span>
            </Link>
            <div className="rounded-xl bg-(--surface) p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--blue-soft) text-(--blue)">
                  <Users size={18} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-(--foreground-soft)">
                    Student activity
                  </span>
                  <span className="mt-0.5 block text-xs text-(--ink-muted)">
                    Active students across the academy
                  </span>
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--line)">
                <div
                  className="h-full rounded-full bg-(--blue)"
                  style={{
                    width: `${Math.min(100, Math.max(0, activeStudentPercentage))}%`,
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs">
                <span className="text-(--ink-faint)">Active</span>
                <span className="font-bold text-(--foreground-soft)">
                  {Math.round(activeStudentPercentage)}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-(--gold-border) bg-(--gold-soft) p-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--gold-muted) text-(--gold)">
                <ShieldCheck size={18} />
              </span>
              <span>
                <span className="block text-sm font-bold text-(--foreground-soft)">
                  Academy status
                </span>
                <span className="mt-0.5 block text-xs text-(--ink-muted)">
                  All systems are operational
                </span>
              </span>
              <CheckCircle2
                size={16}
                className="ml-auto shrink-0 text-(--success)"
              />
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

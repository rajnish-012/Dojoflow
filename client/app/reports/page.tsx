"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  Users,
  UserRound,
  Printer,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSpinner,
  PageHeader,
  Select,
  SummaryCard,
  TableHeading,
} from "@/components/ui";

import {
  getAdmissionReports,
  getBeltReports,
  getBranchReports,
  getCoachReports,
  getReportBranches,
  getReportsSummary,
  getSkillCompletion,
  getTopPerformers,
  type AdmissionReports,
  type BeltReports,
  type BranchReport,
  type CoachReport,
  type ReportSummary,
  type SkillReport,
  type TopPerformer,
} from "@/lib/reportsApi";
import { useAcademyBrand } from "@/components/settings/AcademyBrandProvider";
import { AttendanceDistribution, AttendanceRateChart, MonthlyAttendanceChart } from "@/components/reports/ReportsCharts";

import { PERMISSIONS, useCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function currentYear() {
  return new Date().getFullYear();
}

function percentage(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function rating(value: number) {
  return `${Number(value || 0).toFixed(2)} / 5`;
}

function initials(name?: string) {
  if (!name) {
    return "FS";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/*
|--------------------------------------------------------------------------
| Shared Components
|--------------------------------------------------------------------------
*/

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="df-icon-box df-icon-box-sm">{icon}</div>

      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h2>

        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
        style={{
          width: `${safeValue}%`,
        }}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-sm font-bold text-[var(--text-primary)]">
      {initials(name)}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Analytics Chart Helpers
|--------------------------------------------------------------------------
*/

type ChartPoint = {
  label: string;
  value: number;
};

function buildLinePoints(values: number[], width: number, height: number, paddingX = 20, paddingY = 18) {
  if (!values.length) return [];
  const max = Math.max(1, ...values);
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : paddingX + (index / (values.length - 1)) * chartWidth,
    y: height - paddingY - (value / max) * chartHeight,
  }));
}

function createSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const start = points[index];
    const end = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    const lowY = Math.min(start.y, end.y);
    const highY = Math.max(start.y, end.y);
    const c1x = start.x + (end.x - previous.x) / 6;
    const c2x = end.x - (next.x - start.x) / 6;
    const c1y = Math.max(lowY, Math.min(highY, start.y + (end.y - previous.y) / 6));
    const c2y = Math.max(lowY, Math.min(highY, end.y - (next.y - start.y) / 6));
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  }
  return path;
}

function SingleLineChart({
  data,
  label,
  suffix = "",
}: {
  data: ChartPoint[];
  label: string;
  suffix?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-72 items-center justify-center">
        <EmptyState
          title="No trend data"
          description="There is not enough data to display this chart."
        />
      </div>
    );
  }

  const width = 900;
  const height = 300;
  const paddingX = 28;
  const paddingY = 38;

  const values = data.map((item) => Number(item.value) || 0);
  const maxValue = Math.max(1, ...values);

  const chartHeight = height - paddingY * 2;

  const points = buildLinePoints(
    values,
    width,
    height,
    paddingX,
    paddingY,
  );

  const linePath = createSmoothPath(points);

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${
          height - paddingY
        } L ${points[0].x} ${height - paddingY} Z`
      : "";

  const gridRows = 4;

  return (
    <div className="mt-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
          {label}
        </div>

        <span className="text-xs text-[var(--text-muted)]">
          Monthly activity
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-(--line) bg-(--surface-muted)/40 p-3 sm:p-5">
        <div className="relative h-[320px] min-w-[800px] w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
            aria-label={label}
          >
            {Array.from({ length: gridRows + 1 }).map((_, index) => {
              const y =
                paddingY + (index / gridRows) * chartHeight;

              const value = Math.round(
                maxValue - (index / gridRows) * maxValue,
              );

              return (
                <g key={`grid-${index}`}>
                  <line
                    x1={paddingX}
                    x2={width - paddingX}
                    y1={y}
                    y2={y}
                    stroke="var(--line)"
                    strokeWidth="1"
                    strokeDasharray="4 6"
                  />

                  <text
                    x={4}
                    y={y + 4}
                    fill="var(--text-muted)"
                    fontSize="11"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            {areaPath && (
              <path
                d={areaPath}
                fill="var(--accent)"
                opacity="0.08"
              />
            )}

            <path
              d={linePath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="report-chart-line"
            />

            {data.map((item, index) => {
              const point = points[index];

              if (!point) {
                return null;
              }

              return (
                <circle
                  key={item.label}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="var(--surface)"
                  stroke="var(--accent)"
                  strokeWidth="2"
                >
                  <title>
                    {item.label}: {item.value}
                    {suffix}
                  </title>
                </circle>
              );
            })}
          </svg>

          <div className="absolute bottom-0 left-0 right-0 grid px-6 text-center" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
            {data.map((item) => (
              <span
                key={item.label}
                className="truncate text-[10px] font-medium text-(--ink-muted) sm:text-xs"
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({
  data,
  label,
}: {
  data: ChartPoint[];
  label: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center">
        <EmptyState
          title="No chart data"
          description="No monthly data is available."
        />
      </div>
    );
  }

  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/40 p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
          {label}
        </div>

        <span className="text-xs text-[var(--text-muted)]">
          Monthly total
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
      <div className="grid h-64 min-w-[800px] items-end gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(42px, 1fr))` }}>
        {data.map((item) => {
          const height = (item.value / maxValue) * 100;

          return (
            <div
              key={item.label}
              className="group flex h-full min-w-0 flex-col items-center justify-end"
            >
              <div className="mb-2 min-h-4 text-[10px] font-semibold text-(--foreground)">
                {item.value}
              </div>

              <div className="flex h-44 w-full items-end justify-center">
                <div
                  className="w-full max-w-8 rounded-t-lg bg-(--accent) transition-[height,opacity] duration-700 ease-out group-hover:opacity-80"
                  style={{
                    height: `${Math.max(
                      item.value > 0 ? 5 : 0,
                      height,
                    )}%`,
                  }}
                  title={`${item.label}: ${item.value}`}
                />
              </div>

              <span className="mt-2 max-w-full truncate text-[9px] font-medium text-[var(--text-muted)] sm:text-[10px]">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Main Page
|--------------------------------------------------------------------------
*/

export default function ReportsPage() {
  const { settings: academySettings } = useAcademyBrand();
  const canViewReports = useCan(PERMISSIONS.REPORT_VIEW);

  const canExportReports = useCan(PERMISSIONS.REPORT_EXPORT);

  const [year, setYear] = useState(currentYear());

  const [branch, setBranch] = useState("");

  const [branches, setBranches] = useState<
    {
      _id: string;
      name: string;
      status?: string;
    }[]
  >([]);

  const [summary, setSummary] = useState<ReportSummary | null>(null);

  const [branchReports, setBranchReports] = useState<BranchReport[]>([]);

  const [coachReports, setCoachReports] = useState<CoachReport[]>([]);

  const [beltReports, setBeltReports] = useState<BeltReports | null>(null);

  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);

  const [skills, setSkills] = useState<SkillReport[]>([]);

  const [admissions, setAdmissions] =
    useState<AdmissionReports | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const needsAttentionThreshold = 75;

  /*
  |--------------------------------------------------------------------------
  | Load Reports
  |--------------------------------------------------------------------------
  */

  const loadReports = useCallback(
    async (refresh = false) => {
      await Promise.resolve();

      if (!canViewReports) {
        setLoading(false);
        return;
      }

      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const results = await Promise.allSettled([
          getReportsSummary(year, branch || undefined),
          getBranchReports(year, branch || undefined),
          getCoachReports(year, branch || undefined),
          getBeltReports(year, branch || undefined),
          getTopPerformers(year, branch || undefined),
          getSkillCompletion(year, branch || undefined),
          getAdmissionReports(year, branch || undefined),
        ]);
        const [summaryResult, branchesResult, coachesResult, beltsResult, topResult, skillsResult, admissionsResult] = results;
        setSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
        setBranchReports(branchesResult.status === "fulfilled" ? branchesResult.value : []);
        setCoachReports(coachesResult.status === "fulfilled" ? coachesResult.value : []);
        setBeltReports(beltsResult.status === "fulfilled" ? beltsResult.value : null);
        setTopPerformers(topResult.status === "fulfilled" ? topResult.value : []);
        setSkills(skillsResult.status === "fulfilled" ? skillsResult.value : []);
        setAdmissions(admissionsResult.status === "fulfilled" ? admissionsResult.value : null);
        const failures = results.flatMap((result) => result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : "A report section failed to load."] : []);
        setError(failures.length ? `${failures.length} report section(s) could not be loaded. ${failures[0]}` : "");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load reports.";
        if (refresh) {
          toast.error(message, "Reports refresh failed");
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canViewReports, year, branch],
  );

  /*
  |--------------------------------------------------------------------------
  | Branch Options
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!canViewReports) {
      return;
    }

    async function loadBranches() {
      try {
        const data = await getReportBranches();

        setBranches(data);
      } catch (err) {
        console.error("Failed to load report branches:", err);
      }
    }

    void loadBranches();
  }, [canViewReports]);

  /*
  |--------------------------------------------------------------------------
  | Load Analytics
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void loadReports();
    });

    return () => {
      cancelled = true;
    };
  }, [loadReports]);

  const printReport = useCallback(() => window.print(), []);

  useEffect(() => {
    const handlePrintShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "p") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      printReport();
    };
    window.addEventListener("keydown", handlePrintShortcut);
    return () => window.removeEventListener("keydown", handlePrintShortcut);
  }, [printReport]);

  /*
  |--------------------------------------------------------------------------
  | Derived Values
  |--------------------------------------------------------------------------
  */

  const averageBranchAttendance = useMemo(() => {
    if (!branchReports.length) {
      return 0;
    }

    return (
      branchReports.reduce(
        (sum, item) => sum + item.attendance.attendanceRate,
        0,
      ) / branchReports.length
    );
  }, [branchReports]);

  const admissionChartData = useMemo<ChartPoint[]>(() => {
    return (
      admissions?.monthly?.map((item) => ({
        label: item.month,
        value: item.count,
      })) || []
    );
  }, [admissions]);

  const promotionChartData = useMemo<ChartPoint[]>(() => {
    return (
      beltReports?.monthly?.map((item) => ({
        label: item.month,
        value: item.count,
      })) || []
    );
  }, [beltReports]);

  const latestAttendance = useMemo(() => {
    const trend = summary?.attendance.trend || [];

    if (!trend.length) {
      return null;
    }

    const latest = [...trend].reverse().find((item) => item.total > 0);
    if (!latest) return null;

    const total = latest.present + latest.absent;

    return {
      month: latest.month,
      rate: total > 0 ? (latest.present / total) * 100 : 0,
    };
  }, [summary]);

  const previousAttendance = useMemo(() => {
    const trend = summary?.attendance.trend || [];

    const previous = [...trend].reverse().find((item) => item.total > 0 && item.month !== latestAttendance?.month);
    if (!previous) return null;

    const total = previous.present + previous.absent;

    return total > 0 ? (previous.present / total) * 100 : 0;
  }, [summary, latestAttendance]);

  const attendanceChange = useMemo(() => {
    if (!latestAttendance || previousAttendance === null) {
      return null;
    }

    return latestAttendance.rate - previousAttendance;
  }, [latestAttendance, previousAttendance]);

  const latestAdmission = useMemo(() => {
    const data = admissions?.monthly || [];

    if (!data.length) {
      return null;
    }

    return data[data.length - 1];
  }, [admissions]);

  const maxPromotion = Math.max(
    1,
    ...(beltReports?.monthly.map((item) => item.count) || [1]),
  );

  /*
  |--------------------------------------------------------------------------
  | CSV Export
  |--------------------------------------------------------------------------
  */

  function exportCSV() {
    if (!canExportReports) {
      return;
    }

    const rows: string[][] = [];

    const academyName = academySettings.academyName.trim() || "Academy";
    rows.push([`${academyName} Reports`, "", "", ""]);

    rows.push([
      "Year",
      String(year),
      "Branch",
      branch
        ? branches.find((item) => item._id === branch)?.name || branch
        : "All Branches",
    ]);

    rows.push([]);

    rows.push(["OVERVIEW"]);

    rows.push(["Metric", "Value"]);

    if (summary) {
      rows.push([
        "Active Students",
        String(summary.overview.activeStudents),
      ]);

      rows.push([
        "Total Students",
        String(summary.overview.totalStudents),
      ]);

      rows.push([
        "New Admissions",
        String(summary.overview.newAdmissions),
      ]);

      rows.push([
        "Attendance Rate",
        percentage(summary.overview.averageAttendance),
      ]);

      rows.push([
        "Average Performance",
        rating(summary.overview.averagePerformance),
      ]);

      rows.push([
        "Belts Earned",
        String(summary.overview.beltsEarned),
      ]);

      rows.push([
        "Retention Rate",
        percentage(summary.overview.retentionRate),
      ]);
    }

    rows.push([]);

    rows.push(["TOP PERFORMERS"]);

    rows.push([
      "Student",
      "Belt",
      "Branch",
      "Performance Rating",
      "Attendance",
      "Evaluations",
      "Score",
    ]);

    topPerformers.forEach((item) => {
      rows.push([
        item.student.name,
        item.student.currentBelt || "",
        item.branch?.name || "",
        rating(item.averageRating),
        percentage(item.attendanceRate),
        String(item.evaluations),
        String(item.performanceScore),
      ]);
    });

    rows.push([]);

    rows.push(["BRANCH REPORTS"]);

    rows.push([
      "Branch",
      "Students",
      "Active",
      "New Admissions",
      "Attendance",
      "Performance",
      "Promotions",
      "Makeups Completed",
    ]);

    branchReports.forEach((item) => {
      rows.push([
        item.name,
        String(item.students.total),
        String(item.students.active),
        String(item.students.newAdmissions),
        percentage(item.attendance.attendanceRate),
        rating(item.performance.averageRating),
        String(item.promotions),
        String(item.makeups.completed),
      ]);
    });

    rows.push([]);

    rows.push(["COACH REPORTS"]);

    rows.push([
      "Coach",
      "Branch",
      "Attendance",
      "Performance",
      "Evaluations",
      "Students Evaluated",
    ]);

    coachReports.forEach((item) => {
      rows.push([
        item.name,
        item.branch?.name || "",
        percentage(item.attendance.attendanceRate),
        rating(item.performance.averageRating),
        String(item.performance.evaluations),
        String(item.studentsEvaluated),
      ]);
    });

    rows.push([]);

    rows.push(["BELT REPORTS"]);

    rows.push(["Belt", "Promotions"]);

    beltReports?.distribution.forEach((item) => {
      rows.push([item.belt, String(item.count)]);
    });

    rows.push([]);

    rows.push(["SKILL COMPLETION BY BELT"]);

    rows.push([
      "Belt",
      "Evaluations",
      "Completed",
      "Completion Rate",
      "Average Rating",
    ]);

    skills.forEach((item) => {
      rows.push([
        item.belt,
        String(item.totalEvaluations),
        String(item.totalCompleted),
        percentage(item.completionRate),
        rating(item.averageRating),
      ]);
    });

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const safe = value ?? "";

            return `"${String(safe).replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    const fileName = academyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "academy";
    link.download = `${fileName}-report-${year}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /*
  |--------------------------------------------------------------------------
  | No Report Permission
  |--------------------------------------------------------------------------
  */

  if (!canViewReports) {
    return (
      <div className="df-page">
        <PageHeader
          eyebrow="Authorization"
          title="Reports & Insights"
          description="You do not have permission to view reports."
        />

        <Card>
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Report access is not assigned
            </p>

            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Ask a SUPER_ADMIN to assign the
              <span className="mx-1 font-semibold">
                report.view
              </span>
              permission to your database role.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="df-page">
        <PageHeader
          eyebrow="Analytics"
          title="Reports & Insights"
          description="A complete view of academy performance, attendance, students, coaches, branches and belt progression."
        />

        <LoadingSpinner
          size="lg"
          text="Loading analytics..."
          fullPage
        />
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Error
  |--------------------------------------------------------------------------
  */

  if (error && !summary && !branchReports.length && !coachReports.length && !beltReports && !topPerformers.length && !skills.length && !admissions) {
    return (
      <div className="df-page">
        <PageHeader
          eyebrow="Analytics"
          title="Reports & Insights"
          description="A complete view of academy performance, attendance, students, coaches, branches and belt progression."
          actions={
            <Button
              variant="outline"
              onClick={() => loadReports(true)}
            >
              <RefreshCw size={16} />
              Retry
            </Button>
          }
        />

        <ErrorState
          title="Unable to load reports"
          message={error}
        />
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="df-page reports-print-root">
      <div className="reports-print-only mb-5 border-b border-black pb-4 text-black">
        <h1 className="text-2xl font-bold">{academySettings.academyName.trim() || "Academy"} — Reports &amp; Insights</h1>
        <p className="mt-1 text-sm">Reporting period: 1 Jan–31 Dec {year} · Branch: {branch ? branches.find((item) => item._id === branch)?.name || "Selected branch" : "All accessible branches"}</p>
        <p className="text-xs">Generated {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date())} (India Standard Time)</p>
      </div>
      <PageHeader
        eyebrow="Analytics"
        title="Reports & Insights"
        description="Review attendance, student progress, admissions, branches and academy performance in one place."
        actions={
          <div className="reports-print-hide flex flex-wrap gap-2">
            <Button variant="outline" onClick={printReport} title="Print report (Ctrl+P)">
              <Printer size={16} />
              Print
            </Button>
            {canExportReports && (
              <Button variant="outline" onClick={exportCSV}>
                <Download size={16} />
                Export CSV
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => loadReports(true)}
              loading={refreshing}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Filters */}

      <Card className="reports-print-hide">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Report Filters
            </p>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Select a reporting year and optionally narrow the
              analytics to one branch.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Year
              </span>

              <div className="relative">
                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />

                <Select
                  value={year}
                  onChange={(event) =>
                    setYear(Number(event.target.value))
                  }
                  className="min-w-[150px] pl-9"
                >
                  {Array.from(
                    {
                      length: 6,
                    },
                    (_, index) => currentYear() - index,
                  ).map((itemYear) => (
                    <option key={itemYear} value={itemYear}>
                      {itemYear}
                    </option>
                  ))}
                </Select>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Branch
              </span>

              <Select
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                className="min-w-[220px]"
              >
                <option value="">All Branches</option>

                {branches.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            {(year !== currentYear() || branch) && <Button variant="outline" onClick={() => { setYear(currentYear()); setBranch(""); }}><RotateCcw size={15} />Reset</Button>}
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-(--danger)/20 bg-(--danger-soft) px-4 py-3 text-sm text-(--danger)">
          {error}
        </div>
      )}

      {/* Overview */}

      <section>
        <div className="mb-4">
          <SectionTitle
            icon={<BarChart3 size={18} />}
            title="Overview"
            description={`Academy snapshot for ${year}.`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Active Students"
            value={summary?.overview.activeStudents ?? 0}
            subtitle={`${summary?.overview.totalStudents ?? 0} total students`}
            icon={<Users size={20} />}
          />

          <SummaryCard
            title="Average Attendance"
            value={percentage(
              summary?.overview.averageAttendance ?? 0,
            )}
            subtitle={`${summary?.attendance.present ?? 0} present records`}
            icon={<ClipboardCheck size={20} />}
          />

          <SummaryCard
            title="Performance Rating"
            value={rating(
              summary?.overview.averagePerformance ?? 0,
            )}
            subtitle={`${summary?.performance.evaluations ?? 0} evaluations`}
            icon={<TrendingUp size={20} />}
          />

          <SummaryCard
            title="Belts Earned"
            value={summary?.overview.beltsEarned ?? 0}
            subtitle={`Promotions during ${year}`}
            icon={<Award size={20} />}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatBox
            label="New Admissions"
            value={summary?.overview.newAdmissions ?? 0}
          />

          <StatBox
            label="Retention"
            value={percentage(
              summary?.overview.retentionRate ?? 0,
            )}
          />

          <StatBox
            label="Skill Completion"
            value={percentage(
              summary?.performance.skillCompletionRate ?? 0,
            )}
          />

          <StatBox
            label="Active Branches"
            value={summary?.overview.activeBranches ?? 0}
          />
        </div>
      </section>

      {/* Attendance Analytics */}

      <section>
        <Card>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <SectionTitle
              icon={<ClipboardCheck size={18} />}
              title="Attendance Analytics"
              description="Attendance rate, monthly attendance, absences and makeup activity."
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Current rate
                </p>

                <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                  {percentage(
                    summary?.attendance.attendanceRate ?? 0,
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Absence rate
                </p>

                <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                  {percentage(
                    summary?.attendance.absenceRate ?? 0,
                  )}
                </p>
              </div>

              <div className="hidden rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Latest month
                </p>

                <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                  {latestAttendance
                    ? percentage(latestAttendance.rate)
                    : "—"}
                </p>

                {attendanceChange !== null && (
                  <p
                    className={`mt-0.5 text-[11px] font-medium ${
                      attendanceChange >= 0
                        ? "text-[var(--success)]"
                        : "text-[var(--danger)]"
                    }`}
                  >
                    {attendanceChange >= 0 ? "+" : ""}
                    {attendanceChange.toFixed(1)}% vs previous
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
            <StatBox label="Total Attendance" value={summary?.attendance.total ?? 0} />
            <StatBox
              label="Present Records"
              value={summary?.attendance.present ?? 0}
            />

            <StatBox
              label="Absent Records"
              value={summary?.attendance.absent ?? 0}
            />
            <StatBox label="Attendance Rate" value={percentage(summary?.attendance.attendanceRate ?? 0)} />
            <StatBox label="Makeups Pending" value={summary?.makeups.pending ?? 0} />
            <StatBox label="Makeups Booked" value={summary?.makeups.booked ?? 0} />
            <StatBox label="Makeups Completed" value={summary?.makeups.completed ?? 0} />
            <StatBox
              label="Makeups Cancelled"
              value={summary?.makeups.cancelled ?? 0}
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
            <div className="min-w-0 rounded-xl border border-(--line) p-4"><h3 className="text-sm font-semibold">Monthly attendance</h3><MonthlyAttendanceChart data={summary?.attendance.trend || []} /></div>
            <div className="min-w-0 rounded-xl border border-(--line) p-4"><h3 className="text-sm font-semibold">Attendance distribution</h3><AttendanceDistribution present={summary?.attendance.present ?? 0} absent={summary?.attendance.absent ?? 0} /></div>
          </div>
          <div className="mt-5 rounded-xl border border-(--line) p-4"><h3 className="text-sm font-semibold">Monthly attendance rate</h3><AttendanceRateChart data={summary?.attendance.trend || []} /></div>
        </Card>
      </section>

      <section>
        <Card padding="none">
          <div className="border-b border-(--line) p-5"><SectionTitle icon={<Users size={18} />} title="Student Attendance Performance" description={`Regular attendance for ${year}, ordered from lowest attendance rate. Below ${needsAttentionThreshold}% needs attention.`} /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-(--line) bg-(--surface-muted) text-xs uppercase tracking-wide text-(--ink-muted)"><th className="px-5 py-3">Student</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Present</th><th className="px-4 py-3">Absent</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Pending makeup</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody>{(summary?.studentAttendance || []).length ? summary!.studentAttendance.map((student) => <tr key={student._id} className="border-b border-(--line) last:border-0"><td className="px-5 py-3 font-semibold"><Link className="text-(--accent) hover:underline" href={`/students/${student._id}`}>{student.name}</Link></td><td className="px-4 py-3">{student.branch?.name || "-"}</td><td className="px-4 py-3">{student.plan?.name || "-"}</td><td className="px-4 py-3">{student.present}</td><td className="px-4 py-3">{student.absent}</td><td className="px-4 py-3 font-semibold">{percentage(student.attendanceRate)}</td><td className="px-4 py-3">{student.pendingMakeup}</td><td className="px-4 py-3"><Badge variant={student.attendanceRate < needsAttentionThreshold ? "danger" : "success"}>{student.attendanceRate < needsAttentionThreshold ? "Needs attention" : "On track"}</Badge></td></tr>) : <tr><td className="px-5 py-10 text-center text-(--ink-muted)" colSpan={8}>No student attendance recorded for this period.</td></tr>}</tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Student Analytics */}

      <section>
        <Card>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <SectionTitle
              icon={<Users size={18} />}
              title="Student Analytics"
              description="Student growth, admissions and retention for the selected year."
            />

            {latestAdmission && (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Latest admissions
                </p>

                <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                  {latestAdmission.count}
                </p>

                <p className="text-[11px] text-[var(--text-muted)]">
                  {latestAdmission.month}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatBox
              label="Total Students"
              value={summary?.students.total ?? 0}
            />

            <StatBox
              label="Active"
              value={summary?.students.active ?? 0}
            />

            <StatBox
              label="Inactive"
              value={summary?.students.inactive ?? 0}
            />

            <StatBox
              label="Completed"
              value={summary?.students.completed ?? 0}
            />

            <StatBox
              label="Retention"
              value={percentage(
                summary?.students.retentionRate ?? 0,
              )}
            />
          </div>

          <SingleLineChart
            data={admissionChartData}
            label="New admissions"
          />
        </Card>
      </section>

      {/* Top Performers */}

      <section>
        <Card padding="none">
          <div className="px-6 py-5">
            <SectionTitle
              icon={<GraduationCap size={18} />}
              title="Top Performers"
              description="Students with the strongest combined performance rating and attendance metrics."
            />
          </div>

          {topPerformers.length === 0 ? (
            <div className="border-t border-[var(--line)] px-6 py-10">
              <EmptyState
                title="No performance data"
                description={`No performance evaluations were recorded for ${year}.`}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-y border-[var(--line)] bg-[var(--surface-muted)]">
                    <TableHeading>Student</TableHeading>
                    <TableHeading>Branch</TableHeading>
                    <TableHeading>Belt</TableHeading>
                    <TableHeading>Performance</TableHeading>
                    <TableHeading>Attendance</TableHeading>
                    <TableHeading>Skills Completed</TableHeading>
                    <TableHeading>Evaluations</TableHeading>
                    <TableHeading>Score</TableHeading>
                  </tr>
                </thead>

                <tbody>
                  {topPerformers.map((item, index) => (
                    <tr
                      key={item._id}
                      className="border-b border-[var(--line)] hover:bg-[var(--surface-muted)]"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar name={item.student.name} />

                          <div>
                            <p className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                              {item.student.name}
                            </p>

                            <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
                              #{index + 1}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-[15px] leading-5 text-[var(--text-secondary)]">
                        {item.branch?.name || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <Badge variant="info">
                          {item.student.currentBelt || "White"}
                        </Badge>
                      </td>

                      <td className="px-6 py-5 text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                        {rating(item.averageRating)}
                      </td>

                      <td className="px-6 py-5 text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                        {percentage(item.attendanceRate)}
                      </td>

                      <td className="px-6 py-5 text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                        {item.skillsCompleted}
                      </td>

                      <td className="px-6 py-5 text-[15px] leading-5 text-[var(--text-secondary)]">
                        {item.evaluations}
                      </td>

                      <td className="px-6 py-5">
                        <Badge variant="success">
                          {item.performanceScore.toFixed(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* Skill Completion */}

      <section>
        <Card>
          <SectionTitle
            icon={<CheckCircle2 size={18} />}
            title="Skill Completion by Belt"
            description="Skill mastery is counted from performance evaluations with a rating of 4 or 5."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {skills.length === 0 ? (
              <div className="lg:col-span-2">
                <EmptyState
                  title="No skill data"
                  description={`No performance skill evaluations are available for ${year}.`}
                />
              </div>
            ) : (
              skills.map((item) => (
                <div
                  key={item.belt}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {item.belt}
                      </h3>

                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {item.totalCompleted} of{" "}
                        {item.totalEvaluations} skill evaluations
                        at 4+
                      </p>
                    </div>

                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      {percentage(item.completionRate)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <ProgressBar value={item.completionRate} />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>Average rating</span>

                    <span className="font-semibold">
                      {rating(item.averageRating)}
                    </span>
                  </div>

                  {item.skills.length > 0 && (
                    <div className="mt-5 space-y-3">
                      {item.skills.map((skill) => (
                        <div key={skill.skill}>
                          <div className="mb-1 flex justify-between gap-3">
                            <div className="min-w-0">
                              <span className="block truncate text-xs text-[var(--text-secondary)]">{skill.skill}</span>
                              <span className="text-[10px] text-(--ink-muted)">{skill.completed} of {skill.evaluations} evaluations at 4+</span>
                            </div>

                            <span className="shrink-0 text-xs font-semibold text-[var(--text-primary)]">
                              {percentage(skill.completionRate)}
                            </span>
                          </div>

                          <ProgressBar
                            value={skill.completionRate}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      {/* Belt Analytics */}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle
            icon={<Award size={18} />}
            title="Belt Distribution"
            description="Promotions recorded by destination belt."
          />

          <div className="mt-6 space-y-4">
            {beltReports?.distribution.length ? (
              beltReports.distribution.map((item) => {
                const percent =
                  beltReports.totalPromotions > 0
                    ? (item.count /
                        beltReports.totalPromotions) *
                      100
                    : 0;

                return (
                  <div key={item.belt}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[var(--text-primary)]">
                        {item.belt}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          {percentage(percent)}
                        </span>

                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {item.count}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <ProgressBar value={percent} />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="No belt promotions"
                description={`No belt promotions were recorded in ${year}.`}
              />
            )}
          </div>

          {beltReports?.transitions.length ? (
            <div className="mt-7 border-t border-(--line) pt-5">
              <h3 className="text-sm font-semibold text-(--foreground)">Belt transitions</h3>
              <div className="mt-3 space-y-2">
                {beltReports.transitions.map((transition) => (
                  <div key={`${transition.from}-${transition.to}`} className="flex items-center justify-between gap-3 rounded-xl bg-(--surface-muted) px-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-(--ink-muted)">{transition.from} <span aria-hidden="true">→</span> {transition.to}</span>
                    <Badge variant="info">{transition.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <SectionTitle
              icon={<TrendingUp size={18} />}
              title="Promotion Trend"
              description={`Monthly belt promotions during ${year}.`}
            />

            {beltReports && (
              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-xs text-[var(--text-muted)]">
                  Total
                </p>

                <p className="text-xl font-bold text-[var(--text-primary)]">
                  {beltReports.totalPromotions}
                </p>
              </div>
            )}
          </div>

          <MiniBarChart
            data={promotionChartData}
            label="Monthly promotions"
          />

          {beltReports?.monthly?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {beltReports.monthly
                .filter((item) => item.count === maxPromotion)
                .slice(0, 1)
                .map((item) => (
                  <div
                    key={item.month}
                    className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-secondary)]"
                  >
                    Strongest month:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {item.month}
                    </span>{" "}
                    · {item.count} promotions
                  </div>
                ))}
            </div>
          ) : null}
        </Card>
      </section>

      {/* Branch Reports */}

      <section>
        <Card padding="none">
          <div className="px-6 py-5">
            <SectionTitle
              icon={<BarChart3 size={18} />}
              title="Branch Reports"
              description="Students, attendance, performance, promotions and makeups by branch."
            />
          </div>

          {branchReports.length === 0 ? (
            <div className="border-t border-[var(--line)] px-6 py-10">
              <EmptyState
                title="No branch data"
                description={`No branch analytics are available for ${year}.`}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-y border-[var(--line)] bg-[var(--surface-muted)]">
                    <TableHeading>Branch</TableHeading>
                    <TableHeading>Students</TableHeading>
                    <TableHeading>Admissions</TableHeading>
                    <TableHeading>Attendance</TableHeading>
                    <TableHeading>Performance</TableHeading>
                    <TableHeading>Promotions</TableHeading>
                    <TableHeading>Makeups</TableHeading>
                  </tr>
                </thead>

                <tbody>
                  {branchReports.map((item) => (
                    <tr
                      key={item._id}
                      className="border-b border-[var(--line)] hover:bg-[var(--surface-muted)]"
                    >
                      <td className="px-6 py-5">
                        <p className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                          {item.name}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                          {item.students.active}
                        </p>

                        <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
                          {item.students.inactive} inactive · {item.students.total} total
                        </p>
                      </td>

                      <td className="px-6 py-5 text-[15px] leading-5 text-[var(--text-secondary)]">
                        {item.students.newAdmissions}
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                          {percentage(
                            item.attendance.attendanceRate,
                          )}
                        </p>

                        <p className="mt-1 text-xs text-(--ink-muted)">
                          {item.attendance.present} present · {item.attendance.absent} absent · {item.attendance.total} records
                        </p>

                        <div className="mt-2 w-28">
                          <ProgressBar
                            value={item.attendance.attendanceRate}
                          />
                        </div>
                      </td>

                      <td className="px-6 py-5 text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                        <p>{rating(item.performance.averageRating)}</p>
                        <p className="mt-1 text-xs font-normal text-(--ink-muted)">{item.performance.evaluations} evaluations</p>
                      </td>

                      <td className="px-6 py-5">
                        <Badge variant="info">
                          {item.promotions}
                        </Badge>
                      </td>

                      <td className="px-6 py-5 text-[15px] leading-5 text-[var(--text-secondary)]">
                        <span>{item.makeups.completed} / {item.makeups.scheduled} completed</span>
                        <p className="mt-1 text-xs text-(--ink-muted)">{item.makeups.cancelled} cancelled</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-[var(--line)] px-6 py-4">
            <p className="text-xs text-[var(--text-muted)]">
              Average attendance across visible branches:{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {percentage(averageBranchAttendance)}
              </span>
            </p>
          </div>
        </Card>
      </section>

      {/* Coach Reports */}

      <section>
        <Card padding="none">
          <div className="px-6 py-5">
            <SectionTitle
              icon={<UserRound size={18} />}
              title="Coach Reports"
              description="Attendance activity, evaluations and students evaluated by coach."
            />
          </div>

          {coachReports.length === 0 ? (
            <div className="border-t border-[var(--line)] px-6 py-10">
              <EmptyState
                title="No coach data"
                description={`No coach analytics are available for ${year}.`}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-y border-[var(--line)] bg-[var(--surface-muted)]">
                    <TableHeading>Coach</TableHeading>
                    <TableHeading>Branch</TableHeading>
                    <TableHeading>Attendance</TableHeading>
                    <TableHeading>Performance</TableHeading>
                    <TableHeading>Evaluations</TableHeading>
                    <TableHeading>
                      Students Evaluated
                    </TableHeading>
                  </tr>
                </thead>

                <tbody>
                  {coachReports.map((item) => (
                    <tr
                      key={item._id}
                      className="border-b border-[var(--line)] hover:bg-[var(--surface-muted)]"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar name={item.name} />

                          <div>
                            <p className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                              {item.name}
                            </p>

                            <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
                              {item.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-[15px] leading-5 text-[var(--text-secondary)]">
                        {item.branch?.name || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                          {percentage(item.attendance.attendanceRate)}
                        </p>
                        <p className="mt-1 text-xs text-(--ink-muted)">
                          {item.attendance.present} present · {item.attendance.absent} absent of {item.attendance.total}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                        {rating(item.performance.averageRating)}
                      </td>

                      <td className="px-6 py-5 text-[15px] leading-5 text-[var(--text-secondary)]">
                        {item.performance.evaluations}
                      </td>

                      <td className="px-6 py-5">
                        <Badge variant="default">
                          {item.studentsEvaluated}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-[var(--line)] px-6 py-4">
            <p className="text-xs leading-5 text-[var(--text-muted)]">
              Coach analytics are based on attendance records
              marked by the coach and performance evaluations
              recorded by the coach.
            </p>
          </div>
        </Card>
      </section>

      {/* Admission Analytics */}

      <section>
        <Card>
          <SectionTitle
            icon={<TrendingUp size={18} />}
            title="Admission Analytics"
            description="New student admissions and inquiry pipeline."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox
              label="New Admissions"
              value={admissions?.newAdmissions ?? 0}
            />

            <StatBox
              label="New Inquiries"
              value={admissions?.pipeline.new ?? 0}
            />

            <StatBox
              label="Contacted"
              value={admissions?.pipeline.contacted ?? 0}
            />

            <StatBox
              label="Enrolled"
              value={admissions?.pipeline.enrolled ?? 0}
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <StatBox
              label="Closed"
              value={admissions?.pipeline.closed ?? 0}
            />

            <StatBox
              label="Pipeline Data"
              value={
                admissions?.pipelineAvailable
                  ? "Available"
                  : "Not available"
              }
            />
          </div>

          {!admissions?.pipelineAvailable && (
            <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--text-secondary)]">
              Inquiry pipeline statistics are unavailable from
              the current backend. Actual student admissions
              continue to use Student.joinDate.
            </div>
          )}
        </Card>
      </section>

    </div>
  );
}

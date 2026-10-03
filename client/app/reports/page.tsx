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
  TrendingDown,
  TrendingUp,
  Users,
  UserRound,
} from "lucide-react";

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

type DualChartPoint = {
  label: string;
  first: number;
  second: number;
};

function buildLinePoints(
  values: number[],
  width: number,
  height: number,
  paddingX = 20,
  paddingY = 18,
) {
  if (!values.length) {
    return [];
  }

  const max = Math.max(1, ...values);
  const min = 0;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  return values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : paddingX + (index / (values.length - 1)) * chartWidth;

    const normalized = (value - min) / Math.max(1, max - min);
    const y = height - paddingY - normalized * chartHeight;

    return {
      x,
      y,
    };
  });
}

function createSmoothPath(points: { x: number; y: number }[]) {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    const controlX = (previous.x + current.x) / 2;

    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

function AnalyticsLineChart({
  data,
  firstLabel,
  secondLabel,
  firstValues,
  secondValues,
}: {
  data: DualChartPoint[];
  firstLabel: string;
  secondLabel: string;
  firstValues: number[];
  secondValues: number[];
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
  const paddingY = 24;

  const allValues = [...firstValues, ...secondValues];
  const maxValue = Math.max(1, ...allValues);

  const chartHeight = height - paddingY * 2;

  const firstPoints = buildLinePoints(
    firstValues.map((value) => (value / maxValue) * 100),
    width,
    height,
    paddingX,
    paddingY,
  );

  const secondPoints = buildLinePoints(
    secondValues.map((value) => (value / maxValue) * 100),
    width,
    height,
    paddingX,
    paddingY,
  );

  const firstPath = createSmoothPath(firstPoints);
  const secondPath = createSmoothPath(secondPoints);

  const firstArea =
    firstPoints.length > 0
      ? `${firstPath} L ${firstPoints[firstPoints.length - 1].x} ${
          height - paddingY
        } L ${firstPoints[0].x} ${height - paddingY} Z`
      : "";

  const secondArea =
    secondPoints.length > 0
      ? `${secondPath} L ${secondPoints[secondPoints.length - 1].x} ${
          height - paddingY
        } L ${secondPoints[0].x} ${height - paddingY} Z`
      : "";

  const gridRows = 4;

  return (
    <div className="mt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            {firstLabel}
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
            {secondLabel}
          </div>
        </div>

        <span className="text-xs text-[var(--text-muted)]">
          Monthly activity
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/40 p-3 sm:p-5">
        <div className="relative h-[300px] w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${firstLabel} and ${secondLabel} trend`}
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

            {firstArea && (
              <path
                d={firstArea}
                fill="var(--accent)"
                opacity="0.07"
              />
            )}

            {secondArea && (
              <path
                d={secondArea}
                fill="var(--danger)"
                opacity="0.05"
              />
            )}

            <path
              d={firstPath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d={secondPath}
              fill="none"
              stroke="var(--danger)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />

            {data.map((item, index) => {
              const firstPoint = firstPoints[index];
              const secondPoint = secondPoints[index];

              if (!firstPoint || !secondPoint) {
                return null;
              }

              return (
                <g key={item.label}>
                  <circle
                    cx={firstPoint.x}
                    cy={firstPoint.y}
                    r="4"
                    fill="var(--surface)"
                    stroke="var(--accent)"
                    strokeWidth="2"
                  >
                    <title>
                      {item.label}: {firstLabel} {item.first}
                    </title>
                  </circle>

                  <circle
                    cx={secondPoint.x}
                    cy={secondPoint.y}
                    r="4"
                    fill="var(--surface)"
                    stroke="var(--danger)"
                    strokeWidth="2"
                  >
                    <title>
                      {item.label}: {secondLabel} {item.second}
                    </title>
                  </circle>
                </g>
              );
            })}
          </svg>

          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-6">
            {data.map((item) => (
              <span
                key={item.label}
                className="max-w-[60px] truncate text-[10px] font-medium text-[var(--text-muted)] sm:text-xs"
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
  const paddingY = 24;

  const values = data.map((item) => Number(item.value) || 0);
  const maxValue = Math.max(1, ...values);

  const chartWidth = width - paddingX * 2;
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

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/40 p-3 sm:p-5">
        <div className="relative h-[300px] w-full">
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

          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-6">
            {data.map((item) => (
              <span
                key={item.label}
                className="max-w-[60px] truncate text-[10px] font-medium text-[var(--text-muted)] sm:text-xs"
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

      <div className="grid h-64 grid-cols-12 items-end gap-1.5 sm:gap-3">
        {data.map((item) => {
          const height = (item.value / maxValue) * 100;

          return (
            <div
              key={item.label}
              className="group flex h-full min-w-0 flex-col items-center justify-end"
            >
              <div className="mb-2 min-h-4 text-[10px] font-semibold text-[var(--text-primary)] opacity-0 transition-opacity group-hover:opacity-100">
                {item.value}
              </div>

              <div className="flex h-44 w-full items-end justify-center">
                <div
                  className="w-full max-w-8 rounded-t-lg bg-[var(--accent)] transition-all duration-500 group-hover:opacity-80"
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
  );
}

/*
|--------------------------------------------------------------------------
| Main Page
|--------------------------------------------------------------------------
*/

export default function ReportsPage() {
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

  /*
  |--------------------------------------------------------------------------
  | Load Reports
  |--------------------------------------------------------------------------
  */

  const loadReports = useCallback(
    async (refresh = false) => {
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

        const [
          summaryData,
          branchesData,
          coachesData,
          beltsData,
          topData,
          skillData,
          admissionData,
        ] = await Promise.all([
          getReportsSummary(year, branch || undefined),
          getBranchReports(year, branch || undefined),
          getCoachReports(year, branch || undefined),
          getBeltReports(year, branch || undefined),
          getTopPerformers(year, branch || undefined),
          getSkillCompletion(year, branch || undefined),
          getAdmissionReports(year, branch || undefined),
        ]);

        setSummary(summaryData);
        setBranchReports(branchesData);
        setCoachReports(coachesData);
        setBeltReports(beltsData);
        setTopPerformers(topData);
        setSkills(skillData);
        setAdmissions(admissionData);
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
      setBranches([]);
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
    void loadReports();
  }, [loadReports]);

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

  const attendanceChartData = useMemo<DualChartPoint[]>(() => {
    return (
      summary?.attendance.trend?.map((item) => ({
        label: item.month,
        first: item.present,
        second: item.absent,
      })) || []
    );
  }, [summary]);

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

    const latest = trend[trend.length - 1];

    const total = latest.present + latest.absent;

    return {
      month: latest.month,
      rate: total > 0 ? (latest.present / total) * 100 : 0,
    };
  }, [summary]);

  const previousAttendance = useMemo(() => {
    const trend = summary?.attendance.trend || [];

    if (trend.length < 2) {
      return null;
    }

    const previous = trend[trend.length - 2];

    const total = previous.present + previous.absent;

    return total > 0 ? (previous.present / total) * 100 : 0;
  }, [summary]);

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

    rows.push(["ForceStrike Reports", "", "", ""]);

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

    link.download = `forcestrike-report-${year}.csv`;

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
          title="Reports & Analytics"
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
          title="Reports & Analytics"
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

  if (error && !summary) {
    return (
      <div className="df-page">
        <PageHeader
          eyebrow="Analytics"
          title="Reports & Analytics"
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
    <div className="df-page">
      <PageHeader
        eyebrow="Analytics"
        title="Reports & Analytics"
        description="A complete view of academy performance, attendance, students, coaches, branches and belt progression."
        actions={
          <div className="flex flex-wrap gap-2">
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

      <Card className="mb-6">
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
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-6 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
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

      <section className="mt-8">
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox
              label="Present Records"
              value={summary?.attendance.present ?? 0}
            />

            <StatBox
              label="Absent Records"
              value={summary?.attendance.absent ?? 0}
            />

            <StatBox
              label="Makeups Scheduled"
              value={summary?.makeups.scheduled ?? 0}
            />

            <StatBox
              label="Makeups Completed"
              value={summary?.makeups.completed ?? 0}
            />
          </div>

          {summary && summary.attendance.total > 0 && (
            <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Attendance breakdown</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Based on recorded attendance statuses for {year}.</p>
                </div>
                <span className="text-xs font-medium text-[var(--text-secondary)]">{summary.attendance.total.toLocaleString()} records</span>
              </div>
              <div
                className="mt-4 flex h-3 overflow-hidden rounded-full bg-[var(--line)]"
                role="img"
                aria-label={`${summary.attendance.present} present and ${summary.attendance.absent} absent attendance records`}
              >
                <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (summary.attendance.present / summary.attendance.total) * 100)}%` }} />
                <div className="h-full bg-[var(--danger)]" style={{ width: `${Math.min(100, (summary.attendance.absent / summary.attendance.total) * 100)}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]"><span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />Present <strong className="text-[var(--text-primary)]">{summary.attendance.present.toLocaleString()}</strong></span>
                <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]"><span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />Absent <strong className="text-[var(--text-primary)]">{summary.attendance.absent.toLocaleString()}</strong></span>
              </div>
            </div>
          )}

          <AnalyticsLineChart
            data={attendanceChartData}
            firstLabel="Present"
            secondLabel="Absent"
            firstValues={attendanceChartData.map(
              (item) => item.first,
            )}
            secondValues={attendanceChartData.map(
              (item) => item.second,
            )}
          />
        </Card>
      </section>

      {/* Student Analytics */}

      <section className="mt-8">
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="mt-8">
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

      <section className="mt-8">
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
                      {item.skills.slice(0, 5).map((skill) => (
                        <div key={skill.skill}>
                          <div className="mb-1 flex justify-between gap-3">
                            <span className="truncate text-xs text-[var(--text-secondary)]">
                              {skill.skill}
                            </span>

                            <span className="text-xs font-semibold text-[var(--text-primary)]">
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

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
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

      <section className="mt-8">
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
                          {item.students.total} total
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

                        <div className="mt-2 w-28">
                          <ProgressBar
                            value={item.attendance.attendanceRate}
                          />
                        </div>
                      </td>

                      <td className="px-6 py-5 text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                        {rating(item.performance.averageRating)}
                      </td>

                      <td className="px-6 py-5">
                        <Badge variant="info">
                          {item.promotions}
                        </Badge>
                      </td>

                      <td className="px-6 py-5 text-[15px] leading-5 text-[var(--text-secondary)]">
                        {item.makeups.completed} /{" "}
                        {item.makeups.scheduled}
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

      <section className="mt-8">
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

                      <td className="px-6 py-5 text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                        {percentage(
                          item.attendance.attendanceRate,
                        )}
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

      <section className="mt-8">
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

      {/* Footer Snapshot */}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Present"
          value={summary?.attendance.present ?? 0}
          subtitle="Attendance records"
          icon={<CheckCircle2 size={20} />}
        />

        <SummaryCard
          title="Absent"
          value={summary?.attendance.absent ?? 0}
          subtitle="Attendance records"
          icon={<TrendingDown size={20} />}
        />

        <SummaryCard
          title="Makeups Completed"
          value={summary?.makeups.completed ?? 0}
          subtitle="Completed missed classes"
          icon={<RefreshCw size={20} />}
        />

        <SummaryCard
          title="New Admissions"
          value={summary?.overview.newAdmissions ?? 0}
          subtitle={`Students joined in ${year}`}
          icon={<Users size={20} />}
        />
      </section>
    </div>
  );
}

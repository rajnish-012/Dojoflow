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
  SummaryCard,
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
    return "DF";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part[0]?.toUpperCase(),
    )
    .join("");
}

/*
|--------------------------------------------------------------------------
| Shared Internal Components
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
      <div className="df-icon-box df-icon-box-sm">
        {icon}
      </div>

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

function TableHeading({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </th>
  );
}

function ProgressBar({
  value,
}: {
  value: number;
}) {
  const safeValue = Math.min(
    100,
    Math.max(
      0,
      Number(value) || 0,
    ),
  );

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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function Avatar({
  name,
}: {
  name: string;
}) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-sm font-bold text-[var(--text-primary)]">
      {initials(name)}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Main Page
|--------------------------------------------------------------------------
*/

export default function ReportsPage() {
  const [year, setYear] =
    useState(currentYear());

  const [branch, setBranch] =
    useState("");

  const [branches, setBranches] =
    useState<
      {
        _id: string;
        name: string;
        status?: string;
      }[]
    >([]);

  const [summary, setSummary] =
    useState<ReportSummary | null>(
      null,
    );

  const [branchReports, setBranchReports] =
    useState<BranchReport[]>([]);

  const [coachReports, setCoachReports] =
    useState<CoachReport[]>([]);

  const [beltReports, setBeltReports] =
    useState<BeltReports | null>(
      null,
    );

  const [topPerformers, setTopPerformers] =
    useState<TopPerformer[]>([]);

  const [skills, setSkills] =
    useState<SkillReport[]>([]);

  const [admissions, setAdmissions] =
    useState<AdmissionReports | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | Load Reports
  |--------------------------------------------------------------------------
  */

  const loadReports = useCallback(
    async (refresh = false) => {
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
          getReportsSummary(
            year,
            branch || undefined,
          ),

          getBranchReports(
            year,
            branch || undefined,
          ),

          getCoachReports(
            year,
            branch || undefined,
          ),

          getBeltReports(
            year,
            branch || undefined,
          ),

          getTopPerformers(
            year,
            branch || undefined,
          ),

          getSkillCompletion(
            year,
            branch || undefined,
          ),

          getAdmissionReports(
            year,
            branch || undefined,
          ),
        ]);

        setSummary(summaryData);
        setBranchReports(
          branchesData,
        );
        setCoachReports(
          coachesData,
        );
        setBeltReports(
          beltsData,
        );
        setTopPerformers(
          topData,
        );
        setSkills(
          skillData,
        );
        setAdmissions(
          admissionData,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load reports.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [year, branch],
  );

  /*
  |--------------------------------------------------------------------------
  | Branch Options
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    async function loadBranches() {
      try {
        const data =
          await getReportBranches();

        setBranches(data);
      } catch (err) {
        console.error(
          "Failed to load report branches:",
          err,
        );
      }
    }

    loadBranches();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Load Analytics
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  /*
  |--------------------------------------------------------------------------
  | Derived Values
  |--------------------------------------------------------------------------
  */

  const averageBranchAttendance =
    useMemo(() => {
      if (!branchReports.length) {
        return 0;
      }

      return (
        branchReports.reduce(
          (sum, item) =>
            sum +
            item.attendance
              .attendanceRate,
          0,
        ) /
        branchReports.length
      );
    }, [branchReports]);

  const maxAttendanceTrend =
    Math.max(
      1,
      ...(summary?.attendance.trend.map(
        (item) =>
          Math.max(
            item.present,
            item.absent,
          ),
      ) || [1]),
    );

  const maxPromotion =
    Math.max(
      1,
      ...(beltReports?.monthly.map(
        (item) => item.count,
      ) || [1]),
    );

  const maxAdmissions =
    Math.max(
      1,
      ...(admissions?.monthly.map(
        (item) => item.count,
      ) || [1]),
    );

  /*
  |--------------------------------------------------------------------------
  | CSV Export
  |--------------------------------------------------------------------------
  */

  function exportCSV() {
    const rows: string[][] = [];

    rows.push([
      "DojoFlow Reports",
      "",
      "",
      "",
    ]);

    rows.push([
      "Year",
      String(year),
      "Branch",
      branch
        ? branches.find(
            (item) =>
              item._id === branch,
          )?.name || branch
        : "All Branches",
    ]);

    rows.push([]);

    rows.push([
      "OVERVIEW",
    ]);

    rows.push([
      "Metric",
      "Value",
    ]);

    if (summary) {
      rows.push([
        "Active Students",
        String(
          summary.overview
            .activeStudents,
        ),
      ]);

      rows.push([
        "Total Students",
        String(
          summary.overview
            .totalStudents,
        ),
      ]);

      rows.push([
        "New Admissions",
        String(
          summary.overview
            .newAdmissions,
        ),
      ]);

      rows.push([
        "Attendance Rate",
        percentage(
          summary.overview
            .averageAttendance,
        ),
      ]);

      rows.push([
        "Average Performance",
        rating(
          summary.overview
            .averagePerformance,
        ),
      ]);

      rows.push([
        "Belts Earned",
        String(
          summary.overview
            .beltsEarned,
        ),
      ]);

      rows.push([
        "Retention Rate",
        percentage(
          summary.overview
            .retentionRate,
        ),
      ]);
    }

    rows.push([]);

    rows.push([
      "TOP PERFORMERS",
    ]);

    rows.push([
      "Student",
      "Belt",
      "Branch",
      "Performance Rating",
      "Attendance",
      "Evaluations",
      "Score",
    ]);

    topPerformers.forEach(
      (item) => {
        rows.push([
          item.student.name,
          item.student.currentBelt ||
            "",
          item.branch?.name || "",
          rating(
            item.averageRating,
          ),
          percentage(
            item.attendanceRate,
          ),
          String(
            item.evaluations,
          ),
          String(
            item.performanceScore,
          ),
        ]);
      },
    );

    rows.push([]);

    rows.push([
      "BRANCH REPORTS",
    ]);

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

    branchReports.forEach(
      (item) => {
        rows.push([
          item.name,
          String(
            item.students.total,
          ),
          String(
            item.students.active,
          ),
          String(
            item.students
              .newAdmissions,
          ),
          percentage(
            item.attendance
              .attendanceRate,
          ),
          rating(
            item.performance
              .averageRating,
          ),
          String(
            item.promotions,
          ),
          String(
            item.makeups.completed,
          ),
        ]);
      },
    );

    rows.push([]);

    rows.push([
      "COACH REPORTS",
    ]);

    rows.push([
      "Coach",
      "Branch",
      "Attendance",
      "Performance",
      "Evaluations",
      "Students Evaluated",
    ]);

    coachReports.forEach(
      (item) => {
        rows.push([
          item.name,
          item.branch?.name || "",
          percentage(
            item.attendance
              .attendanceRate,
          ),
          rating(
            item.performance
              .averageRating,
          ),
          String(
            item.performance
              .evaluations,
          ),
          String(
            item.studentsEvaluated,
          ),
        ]);
      },
    );

    rows.push([]);

    rows.push([
      "BELT REPORTS",
    ]);

    rows.push([
      "Belt",
      "Promotions",
    ]);

    beltReports?.distribution.forEach(
      (item) => {
        rows.push([
          item.belt,
          String(item.count),
        ]);
      },
    );

    rows.push([]);

    rows.push([
      "SKILL COMPLETION BY BELT",
    ]);

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
        String(
          item.totalEvaluations,
        ),
        String(
          item.totalCompleted,
        ),
        percentage(
          item.completionRate,
        ),
        rating(
          item.averageRating,
        ),
      ]);
    });

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const safe =
              value ?? "";

            return `"${String(
              safe,
            ).replaceAll(
              '"',
              '""',
            )}"`;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = `dojoflow-report-${year}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(
      link,
    );

    URL.revokeObjectURL(url);
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
              onClick={() =>
                loadReports(true)
              }
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

  return (
    <div className="df-page">
      {/* ============================================================= */}
      {/* Header                                                        */}
      {/* ============================================================= */}

      <PageHeader
        eyebrow="Analytics"
        title="Reports & Analytics"
        description="A complete view of academy performance, attendance, students, coaches, branches and belt progression."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={exportCSV}
            >
              <Download size={16} />
              Export CSV
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                loadReports(true)
              }
              loading={refreshing}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* ============================================================= */}
      {/* Filters                                                       */}
      {/* ============================================================= */}

      <Card className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Report Filters
            </p>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Select a reporting year and optionally
              narrow the analytics to one branch.
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

                <select
                  value={year}
                  onChange={(event) =>
                    setYear(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                  className="df-input h-11 min-w-[150px] pl-9"
                >
                  {Array.from(
                    {
                      length: 6,
                    },
                    (_, index) =>
                      currentYear() -
                      index,
                  ).map(
                    (itemYear) => (
                      <option
                        key={itemYear}
                        value={itemYear}
                      >
                        {itemYear}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Branch
              </span>

              <select
                value={branch}
                onChange={(event) =>
                  setBranch(
                    event.target.value,
                  )
                }
                className="df-input h-11 min-w-[220px]"
              >
                <option value="">
                  All Branches
                </option>

                {branches.map(
                  (item) => (
                    <option
                      key={item._id}
                      value={item._id}
                    >
                      {item.name}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-6 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {/* ============================================================= */}
      {/* Overview                                                      */}
      {/* ============================================================= */}

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
            value={
              summary?.overview
                .activeStudents ?? 0
            }
            subtitle={`${summary?.overview.totalStudents ?? 0} total students`}
            icon={<Users size={20} />}
          />

          <SummaryCard
            title="Average Attendance"
            value={percentage(
              summary?.overview
                .averageAttendance ??
                0,
            )}
            subtitle={`${summary?.attendance.present ?? 0} present records`}
            icon={
              <ClipboardCheck
                size={20}
              />
            }
          />

          <SummaryCard
            title="Performance Rating"
            value={rating(
              summary?.overview
                .averagePerformance ??
                0,
            )}
            subtitle={`${summary?.performance.evaluations ?? 0} evaluations`}
            icon={
              <TrendingUp size={20} />
            }
          />

          <SummaryCard
            title="Belts Earned"
            value={
              summary?.overview
                .beltsEarned ?? 0
            }
            subtitle={`Promotions during ${year}`}
            icon={<Award size={20} />}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatBox
            label="New Admissions"
            value={
              summary?.overview
                .newAdmissions ?? 0
            }
          />

          <StatBox
            label="Retention"
            value={percentage(
              summary?.overview
                .retentionRate ?? 0,
            )}
          />

          <StatBox
            label="Skill Completion"
            value={percentage(
              summary?.performance
                .skillCompletionRate ??
                0,
            )}
          />

          <StatBox
            label="Active Branches"
            value={
              summary?.overview
                .activeBranches ?? 0
            }
          />
        </div>
      </section>

      {/* ============================================================= */}
      {/* Attendance Analytics                                          */}
      {/* ============================================================= */}

      <section className="mt-8">
        <Card>
          <SectionTitle
            icon={
              <ClipboardCheck
                size={18}
              />
            }
            title="Attendance Analytics"
            description="Attendance rate, monthly attendance, absences and makeup activity."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox
              label="Attendance Rate"
              value={percentage(
                summary?.attendance
                  .attendanceRate ??
                  0,
              )}
            />

            <StatBox
              label="Absence Rate"
              value={percentage(
                summary?.attendance
                  .absenceRate ??
                  0,
              )}
            />

            <StatBox
              label="Makeups Scheduled"
              value={
                summary?.makeups
                  .scheduled ?? 0
              }
            />

            <StatBox
              label="Makeups Completed"
              value={
                summary?.makeups
                  .completed ?? 0
              }
            />
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Attendance Trend
            </h3>

            <div className="mt-5 grid h-64 grid-cols-12 items-end gap-2">
              {summary?.attendance.trend.map(
                (item) => {
                  const presentHeight =
                    (item.present /
                      maxAttendanceTrend) *
                    100;

                  const absentHeight =
                    (item.absent /
                      maxAttendanceTrend) *
                    100;

                  return (
                    <div
                      key={item.month}
                      className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
                    >
                      <div className="flex h-48 w-full items-end justify-center gap-1">
                        <div
                          className="w-[42%] rounded-t-md bg-[var(--accent)] transition-all duration-500"
                          style={{
                            height: `${Math.max(
                              item.present
                                ? 5
                                : 0,
                              presentHeight,
                            )}%`,
                          }}
                          title={`${item.month}: ${item.present} present`}
                        />

                        <div
                          className="w-[42%] rounded-t-md bg-[var(--danger)]/70 transition-all duration-500"
                          style={{
                            height: `${Math.max(
                              item.absent
                                ? 5
                                : 0,
                              absentHeight,
                            )}%`,
                          }}
                          title={`${item.month}: ${item.absent} absent`}
                        />
                      </div>

                      <span className="text-[10px] text-[var(--text-muted)]">
                        {item.month}
                      </span>
                    </div>
                  );
                },
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-5 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                Present
              </span>

              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]/70" />
                Absent
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* ============================================================= */}
      {/* Student Analytics                                             */}
      {/* ============================================================= */}

      <section className="mt-8">
        <Card>
          <SectionTitle
            icon={<Users size={18} />}
            title="Student Analytics"
            description="Student growth, admissions and retention for the selected year."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox
              label="Total Students"
              value={
                summary?.students.total ??
                0
              }
            />

            <StatBox
              label="Active"
              value={
                summary?.students.active ??
                0
              }
            />

            <StatBox
              label="Inactive"
              value={
                summary?.students
                  .inactive ?? 0
              }
            />

            <StatBox
              label="Retention"
              value={percentage(
                summary?.students
                  .retentionRate ??
                  0,
              )}
            />
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-(--text-primary)">
              Student Growth / Admissions
            </h3>

            <div className="mt-5 grid grid-cols-12 items-end gap-2">
              {admissions?.monthly.map(
                (item) => {
                  const height =
                    (item.count /
                      maxAdmissions) *
                    100;

                  return (
                    <div
                      key={item.month}
                      className="flex min-w-0 flex-col items-center gap-2"
                    >
                      <div className="flex h-40 w-full items-end">
                        <div
                          className="w-full rounded-t-lg bg-accent transition-all duration-500"
                          style={{
                            height: `${Math.max(
                              item.count
                                ? 5
                                : 0,
                              height,
                            )}%`,
                          }}
                          title={`${item.month}: ${item.count} admissions`}
                        />
                      </div>

                      <span className="text-[10px] text-[var(--text-muted)]">
                        {item.month}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* ============================================================= */}
      {/* Top Performers                                                */}
      {/* ============================================================= */}

      <section className="mt-8">
        <Card padding="none">
          <div className="px-6 py-5">
            <SectionTitle
              icon={
                <GraduationCap
                  size={18}
                />
              }
              title="Top Performers"
              description="Students with the strongest combined performance rating and attendance metrics."
            />
          </div>

          {topPerformers.length ===
          0 ? (
            <div className="border-t border-[var(--border)] px-6 py-10">
              <EmptyState
                title="No performance data"
                description={`No performance evaluations were recorded for ${year}.`}
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-y border-[var(--border)] bg-[var(--surface-muted)]">
                      <TableHeading>
                        Student
                      </TableHeading>

                      <TableHeading>
                        Branch
                      </TableHeading>

                      <TableHeading>
                        Belt
                      </TableHeading>

                      <TableHeading>
                        Performance
                      </TableHeading>

                      <TableHeading>
                        Attendance
                      </TableHeading>

                      <TableHeading>
                        Evaluations
                      </TableHeading>

                      <TableHeading>
                        Score
                      </TableHeading>
                    </tr>
                  </thead>

                  <tbody>
                    {topPerformers.map(
                      (item, index) => (
                        <tr
                          key={item._id}
                          className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <Avatar
                                name={
                                  item
                                    .student
                                    .name
                                }
                              />

                              <div>
                                <p className="font-semibold text-[var(--text-primary)]">
                                  {item
                                    .student
                                    .name}
                                </p>

                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                  #{index +
                                    1}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5 text-sm text-[var(--text-secondary)]">
                            {item
                              .branch
                              ?.name ||
                              "—"}
                          </td>

                          <td className="px-6 py-5">
                            <Badge variant="info">
                              {item
                                .student
                                .currentBelt ||
                                "White"}
                            </Badge>
                          </td>

                          <td className="px-6 py-5 text-sm font-semibold text-[var(--text-primary)]">
                            {rating(
                              item.averageRating,
                            )}
                          </td>

                          <td className="px-6 py-5 text-sm font-semibold text-[var(--text-primary)]">
                            {percentage(
                              item.attendanceRate,
                            )}
                          </td>

                          <td className="px-6 py-5 text-sm text-[var(--text-secondary)]">
                            {item.evaluations}
                          </td>

                          <td className="px-6 py-5">
                            <Badge variant="success">
                              {item.performanceScore.toFixed(
                                1,
                              )}
                            </Badge>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 border-t border-[var(--border)] p-4 md:hidden">
                {topPerformers.map(
                  (item, index) => (
                    <div
                      key={item._id}
                      className="rounded-xl border border-[var(--border)] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={
                            item.student
                              .name
                          }
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-semibold text-[var(--text-primary)]">
                              {item
                                .student
                                .name}
                            </h3>

                            <Badge variant="info">
                              #{index + 1}
                            </Badge>
                          </div>

                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {item.branch
                              ?.name ||
                              "No branch"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <StatBox
                          label="Rating"
                          value={rating(
                            item.averageRating,
                          )}
                        />

                        <StatBox
                          label="Attendance"
                          value={percentage(
                            item.attendanceRate,
                          )}
                        />

                        <StatBox
                          label="Score"
                          value={item.performanceScore.toFixed(
                            1,
                          )}
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
        </Card>
      </section>

      {/* ============================================================= */}
      {/* Curriculum Analytics                                          */}
      {/* ============================================================= */}

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
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {item.belt}
                      </h3>

                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {item.totalCompleted} of{" "}
                        {item.totalEvaluations}{" "}
                        skill evaluations at
                        4+
                      </p>
                    </div>

                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      {percentage(
                        item.completionRate,
                      )}
                    </span>
                  </div>

                  <div className="mt-4">
                    <ProgressBar
                      value={
                        item.completionRate
                      }
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>
                      Average rating
                    </span>

                    <span className="font-semibold">
                      {rating(
                        item.averageRating,
                      )}
                    </span>
                  </div>

                  {item.skills.length >
                    0 && (
                    <div className="mt-5 space-y-3">
                      {item.skills
                        .slice(0, 5)
                        .map(
                          (
                            skill,
                          ) => (
                            <div
                              key={
                                skill.skill
                              }
                            >
                              <div className="mb-1 flex justify-between gap-3">
                                <span className="truncate text-xs text-[var(--text-secondary)]">
                                  {
                                    skill.skill
                                  }
                                </span>

                                <span className="text-xs font-semibold text-[var(--text-primary)]">
                                  {percentage(
                                    skill.completionRate,
                                  )}
                                </span>
                              </div>

                              <ProgressBar
                                value={
                                  skill.completionRate
                                }
                              />
                            </div>
                          ),
                        )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      {/* ============================================================= */}
      {/* Belt Analytics                                                */}
      {/* ============================================================= */}

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle
            icon={<Award size={18} />}
            title="Belt Distribution"
            description="Promotions recorded by destination belt."
          />

          <div className="mt-6 space-y-4">
            {beltReports?.distribution
              .length ? (
              beltReports.distribution.map(
                (item) => {
                  const percent =
                    beltReports.totalPromotions >
                    0
                      ? (item.count /
                          beltReports.totalPromotions) *
                        100
                      : 0;

                  return (
                    <div
                      key={item.belt}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-[var(--text-primary)]">
                          {item.belt}
                        </span>

                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {item.count}
                        </span>
                      </div>

                      <div className="mt-2">
                        <ProgressBar
                          value={
                            percent
                          }
                        />
                      </div>
                    </div>
                  );
                },
              )
            ) : (
              <EmptyState
                title="No belt promotions"
                description={`No belt promotions were recorded in ${year}.`}
              />
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle
            icon={<TrendingUp size={18} />}
            title="Promotion Trend"
            description={`Monthly belt promotions during ${year}.`}
          />

          <div className="mt-6 grid grid-cols-12 items-end gap-2">
            {beltReports?.monthly.map(
              (item) => {
                const height =
                  (item.count /
                    maxPromotion) *
                  100;

                return (
                  <div
                    key={item.month}
                    className="flex min-w-0 flex-col items-center gap-2"
                  >
                    <span className="text-[10px] font-semibold text-[var(--text-primary)]">
                      {item.count}
                    </span>

                    <div className="flex h-40 w-full items-end">
                      <div
                        className="w-full rounded-t-lg bg-[var(--accent)]"
                        style={{
                          height: `${Math.max(
                            item.count
                              ? 5
                              : 0,
                            height,
                          )}%`,
                        }}
                      />
                    </div>

                    <span className="text-[9px] text-[var(--text-muted)]">
                      {item.month}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </Card>
      </section>

      {/* ============================================================= */}
      {/* Branch Reports                                                */}
      {/* ============================================================= */}

      <section className="mt-8">
        <Card padding="none">
          <div className="px-6 py-5">
            <SectionTitle
              icon={
                <BarChart3
                  size={18}
                />
              }
              title="Branch Reports"
              description="Students, attendance, performance, promotions and makeups by branch."
            />
          </div>

          {branchReports.length ===
          0 ? (
            <div className="border-t border-[var(--border)] px-6 py-10">
              <EmptyState
                title="No branch data"
                description={`No branch analytics are available for ${year}.`}
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-y border-[var(--border)] bg-[var(--surface-muted)]">
                      <TableHeading>
                        Branch
                      </TableHeading>

                      <TableHeading>
                        Students
                      </TableHeading>

                      <TableHeading>
                        Admissions
                      </TableHeading>

                      <TableHeading>
                        Attendance
                      </TableHeading>

                      <TableHeading>
                        Performance
                      </TableHeading>

                      <TableHeading>
                        Promotions
                      </TableHeading>

                      <TableHeading>
                        Makeups
                      </TableHeading>
                    </tr>
                  </thead>

                  <tbody>
                    {branchReports.map(
                      (item) => (
                        <tr
                          key={item._id}
                          className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
                        >
                          <td className="px-6 py-5">
                            <p className="font-semibold text-[var(--text-primary)]">
                              {item.name}
                            </p>
                          </td>

                          <td className="px-6 py-5">
                            <p className="font-semibold text-[var(--text-primary)]">
                              {item.students.active}
                            </p>

                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {item.students.total}{" "}
                              total
                            </p>
                          </td>

                          <td className="px-6 py-5 text-sm text-[var(--text-secondary)]">
                            {
                              item
                                .students
                                .newAdmissions
                            }
                          </td>

                          <td className="px-6 py-5">
                            <p className="font-semibold text-[var(--text-primary)]">
                              {percentage(
                                item
                                  .attendance
                                  .attendanceRate,
                              )}
                            </p>

                            <div className="mt-2 w-28">
                              <ProgressBar
                                value={
                                  item
                                    .attendance
                                    .attendanceRate
                                }
                              />
                            </div>
                          </td>

                          <td className="px-6 py-5 text-sm font-semibold text-[var(--text-primary)]">
                            {rating(
                              item
                                .performance
                                .averageRating,
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <Badge variant="info">
                              {
                                item.promotions
                              }
                            </Badge>
                          </td>

                          <td className="px-6 py-5 text-sm text-[var(--text-secondary)]">
                            {
                              item
                                .makeups
                                .completed
                            }{" "}
                            /{" "}
                            {
                              item
                                .makeups
                                .scheduled
                            }
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 border-t border-[var(--border)] p-4 md:hidden">
                {branchReports.map(
                  (item) => (
                    <div
                      key={item._id}
                      className="rounded-xl border border-[var(--border)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-[var(--text-primary)]">
                            {item.name}
                          </h3>

                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {
                              item
                                .students
                                .active
                            }{" "}
                            active students
                          </p>
                        </div>

                        <Badge variant="info">
                          {
                            item.promotions
                          }{" "}
                          promotions
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <StatBox
                          label="Attendance"
                          value={percentage(
                            item
                              .attendance
                              .attendanceRate,
                          )}
                        />

                        <StatBox
                          label="Performance"
                          value={rating(
                            item
                              .performance
                              .averageRating,
                          )}
                        />

                        <StatBox
                          label="Admissions"
                          value={
                            item
                              .students
                              .newAdmissions
                          }
                        />

                        <StatBox
                          label="Makeups"
                          value={
                            item
                              .makeups
                              .completed
                          }
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}

          <div className="border-t border-[var(--border)] px-6 py-4">
            <p className="text-xs text-[var(--text-muted)]">
              Average attendance across visible
              branches:{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {percentage(
                  averageBranchAttendance,
                )}
              </span>
            </p>
          </div>
        </Card>
      </section>

      {/* ============================================================= */}
      {/* Coach Reports                                                 */}
      {/* ============================================================= */}

      <section className="mt-8">
        <Card padding="none">
          <div className="px-6 py-5">
            <SectionTitle
              icon={
                <UserRound
                  size={18}
                />
              }
              title="Coach Reports"
              description="Attendance activity, evaluations and students evaluated by coach."
            />
          </div>

          {coachReports.length ===
          0 ? (
            <div className="border-t border-[var(--border)] px-6 py-10">
              <EmptyState
                title="No coach data"
                description={`No coach analytics are available for ${year}.`}
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-y border-[var(--border)] bg-[var(--surface-muted)]">
                      <TableHeading>
                        Coach
                      </TableHeading>

                      <TableHeading>
                        Branch
                      </TableHeading>

                      <TableHeading>
                        Attendance
                      </TableHeading>

                      <TableHeading>
                        Performance
                      </TableHeading>

                      <TableHeading>
                        Evaluations
                      </TableHeading>

                      <TableHeading>
                        Students Evaluated
                      </TableHeading>
                    </tr>
                  </thead>

                  <tbody>
                    {coachReports.map(
                      (item) => (
                        <tr
                          key={item._id}
                          className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <Avatar
                                name={
                                  item.name
                                }
                              />

                              <div>
                                <p className="font-semibold text-[var(--text-primary)]">
                                  {item.name}
                                </p>

                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                  {
                                    item.email
                                  }
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5 text-sm text-[var(--text-secondary)]">
                            {item.branch
                              ?.name ||
                              "—"}
                          </td>

                          <td className="px-6 py-5 text-sm font-semibold text-[var(--text-primary)]">
                            {percentage(
                              item
                                .attendance
                                .attendanceRate,
                            )}
                          </td>

                          <td className="px-6 py-5 text-sm font-semibold text-[var(--text-primary)]">
                            {rating(
                              item
                                .performance
                                .averageRating,
                            )}
                          </td>

                          <td className="px-6 py-5 text-sm text-[var(--text-secondary)]">
                            {
                              item
                                .performance
                                .evaluations
                            }
                          </td>

                          <td className="px-6 py-5">
                            <Badge variant="default">
                              {
                                item.studentsEvaluated
                              }
                            </Badge>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 border-t border-[var(--border)] p-4 md:hidden">
                {coachReports.map(
                  (item) => (
                    <div
                      key={item._id}
                      className="rounded-xl border border-[var(--border)] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={
                            item.name
                          }
                        />

                        <div>
                          <h3 className="font-semibold text-[var(--text-primary)]">
                            {item.name}
                          </h3>

                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {item.branch
                              ?.name ||
                              "No branch"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <StatBox
                          label="Attendance"
                          value={percentage(
                            item
                              .attendance
                              .attendanceRate,
                          )}
                        />

                        <StatBox
                          label="Rating"
                          value={rating(
                            item
                              .performance
                              .averageRating,
                          )}
                        />

                        <StatBox
                          label="Evaluations"
                          value={
                            item
                              .performance
                              .evaluations
                          }
                        />

                        <StatBox
                          label="Students"
                          value={
                            item.studentsEvaluated
                          }
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}

          <div className="border-t border-[var(--border)] px-6 py-4">
            <p className="text-xs leading-5 text-[var(--text-muted)]">
              Coach analytics are based on attendance
              records marked by the coach and performance
              evaluations recorded by the coach. A dedicated
              assigned-students field is not currently part
              of the coach data model.
            </p>
          </div>
        </Card>
      </section>

      {/* ============================================================= */}
      {/* Admission Analytics                                           */}
      {/* ============================================================= */}

      <section className="mt-8">
        <Card>
          <SectionTitle
            icon={
              <TrendingUp size={18} />
            }
            title="Admission Analytics"
            description="New student admissions and inquiry pipeline."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox
              label="New Admissions"
              value={
                admissions?.newAdmissions ??
                0
              }
            />

            <StatBox
              label="New Inquiries"
              value={
                admissions?.pipeline.new ??
                0
              }
            />

            <StatBox
              label="Contacted"
              value={
                admissions?.pipeline
                  .contacted ?? 0
              }
            />

            <StatBox
              label="Enrolled"
              value={
                admissions?.pipeline
                  .enrolled ?? 0
              }
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <StatBox
              label="Closed"
              value={
                admissions?.pipeline
                  .closed ?? 0
              }
            />

            <StatBox
              label="Pipeline Data"
              value={
                admissions
                  ?.pipelineAvailable
                  ? "Available"
                  : "Not available"
              }
            />
          </div>

          {!admissions
            ?.pipelineAvailable && (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--text-secondary)]">
              Inquiry pipeline statistics are hidden
              because the current backend does not expose
              an Inquiry model. Actual student admissions
              continue to use Student.joinDate.
            </div>
          )}
        </Card>
      </section>

      {/* ============================================================= */}
      {/* Footer Snapshot                                               */}
      {/* ============================================================= */}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Present"
          value={
            summary?.attendance
              .present ?? 0
          }
          subtitle="Attendance records"
          icon={
            <CheckCircle2
              size={20}
            />
          }
        />

        <SummaryCard
          title="Absent"
          value={
            summary?.attendance
              .absent ?? 0
          }
          subtitle="Attendance records"
          icon={
            <TrendingDown
              size={20}
            />
          }
        />

        <SummaryCard
          title="Makeups Completed"
          value={
            summary?.makeups
              .completed ?? 0
          }
          subtitle="Completed missed classes"
          icon={
            <RefreshCw size={20} />
          }
        />

        <SummaryCard
          title="New Admissions"
          value={
            summary?.overview
              .newAdmissions ?? 0
          }
          subtitle={`Students joined in ${year}`}
          icon={
            <Users size={20} />
          }
        />
      </section>
    </div>
  );
}
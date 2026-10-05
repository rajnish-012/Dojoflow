"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Mail,
  RefreshCw,
  Star,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";

import {
  getStudentById,
  getStudentProgress,
  getStudentAttendance,
  getStudentPerformance,
} from "@/lib/api";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSpinner,
  SummaryCard,
  Select,
} from "@/components/ui";

type Student = {
  _id: string;
  name: string;
  age?: number;
  phone?: string;
  email?: string;
  currentBelt?: string;
  status?: string;
  joinDate?: string;

  plan?: {
    _id?: string;
    name?: string;
    duration?: number;
    durationUnit?: string;
    startingBelt?: string;
    curriculum?: CurriculumItem[];
    milestones?: Milestone[];
  } | null;
};

type AttendanceItem = {
  _id?: string;
  attendanceType?: "REGULAR" | "MAKEUP";
  sessionName?: string;
  sessionStartTime?: string;
  sessionEndTime?: string;
  date?: string;
  planDay?: number;
  curriculumTitle?: string;
  status?: string;
  makeupRequired?: boolean;
  makeupCompleted?: boolean;
  sessionTypeId?: string | { _id: string; name?: string } | null;
};

type MakeupItem = {
  _id?: string;
  status?: "SCHEDULED" | "COMPLETED" | "CANCELLED" | string;
  originalDate?: string;
  makeupDate?: string | null;
  planDay?: number;
  curriculumTitle?: string;
};

type PerformanceItem = {
  _id?: string;
  planDay?: number;
  curriculumTitle?: string;
  skill?: string;
  rating?: number | string;
  remarks?: string;
  evaluationDate?: string;
  sessionTypeId?: string | { _id: string; name?: string } | null;
};

type CurriculumItem = {
  day?: number;
  title?: string;
  description?: string;
  skill?: string;
};

type Milestone = {
  day?: number;
  belt?: string;
  skill?: string;
  description?: string;
};

type ProgressData = {
  currentBelt?: string;
  selectedProgram?: { _id?: string; name?: string } | string | null;
  tracks?: { program?: { _id?: string; name?: string } | string }[];
  currentTrainingDay?: number | string;
  completedDays?: number | string;
  totalCurriculumDays?: number | string;

  presentClasses?: number | string;
  absentClasses?: number | string;

  pendingMakeups?: number | string;
  unscheduledMakeups?: number | string;
  scheduledMakeups?: number | string;
  completedMakeups?: number | string;
  makeups?: MakeupItem[];

  averageRating?: number | string | null;

  currentCurriculum?: CurriculumItem | null;
  nextMilestone?: Milestone | null;
  achievedMilestone?: Milestone | null;

  attendance?: AttendanceItem[];
  performance?: PerformanceItem[];

  // Raw API shape is retained so the page can safely consume
  // both the current backend contract and older responses.
  training?: {
    currentTrainingDay?: number | string;
    completedDays?: number | string;
    totalCurriculumDays?: number | string;
    presentClasses?: number | string;
    absentClasses?: number | string;
    pendingMakeups?: number | string;
    unscheduledMakeups?: number | string;
    scheduledMakeups?: number | string;
    completedMakeups?: number | string;
  };
  performanceSummary?: {
    totalEvaluations?: number | string;
    averageRating?: number | string | null;
    latest?: PerformanceItem | null;
  };
  milestone?: {
    next?: Milestone | null;
    achieved?: Milestone | null;
  };
};

function numberValue(...values: unknown[]): number {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST"
  );
}

function formatDate(date?: string) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string) {
  if (!value) return "";
  const [rawHour, minute] = value.split(":");
  const hour = Number(rawHour);
  if (!Number.isInteger(hour) || !minute) return value;
  return `${String(hour % 12 || 12).padStart(2, "0")}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

function statusOf(status?: string) {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function extractArray<T = any>(source: any, keys: string[] = []): T[] {
  if (Array.isArray(source)) {
    return source;
  }

  for (const key of keys) {
    if (Array.isArray(source?.[key])) {
      return source[key];
    }
  }

  return [];
}

function unwrapProgress(response: any) {
  return (
    response?.progress ??
    response?.data?.progress ??
    response?.data ??
    response ??
    {}
  );
}

function normalizeAttendance(response: any): AttendanceItem[] {
  return extractArray<AttendanceItem>(response, [
    "attendance",
    "records",
    "items",
    "data",
  ]);
}

function normalizePerformance(response: any): PerformanceItem[] {
  return extractArray<PerformanceItem>(response, [
    "performance",
    "records",
    "items",
    "data",
  ]);
}

function normalizePerformanceFromProgress(
  progressResult: any,
): PerformanceItem[] {
  const performanceSource = progressResult?.performance;

  if (Array.isArray(performanceSource)) {
    return performanceSource;
  }

  const nested = extractArray<PerformanceItem>(performanceSource, [
    "performance",
    "records",
    "items",
    "data",
  ]);

  if (nested.length) {
    return nested;
  }

  if (performanceSource?.latest) {
    return [performanceSource.latest];
  }

  return [];
}

function normalizeCurriculum(source: any): CurriculumItem[] {
  if (Array.isArray(source)) return source;
  return extractArray<CurriculumItem>(source, [
    "curriculum",
    "lessons",
    "items",
    "data",
  ]);
}

function normalizeMilestones(source: any): Milestone[] {
  if (Array.isArray(source)) return source;
  return extractArray<Milestone>(source, ["milestones", "items", "data"]);
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="
        flex flex-col gap-4
        sm:flex-row sm:items-start
        sm:justify-between
      "
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="
            flex h-10 w-10 shrink-0
            items-center justify-center
            rounded-xl
            bg-(--accent-soft)
            text-(--accent)
          "
        >
          {icon}
        </div>

        <div className="min-w-0">
          {eyebrow && (
            <p
              className="
                text-[10px] font-black
                uppercase tracking-[0.16em]
                text-(--accent)
              "
            >
              {eyebrow}
            </p>
          )}

          <h2
            className="
              mt-1 text-lg font-black
              tracking-tight
              text-(--foreground)
              sm:text-xl
            "
          >
            {title}
          </h2>

          {description && (
            <p
              className="
                mt-1 text-sm
                text-(--ink-muted)
              "
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {action}
    </div>
  );
}

function MetricRow({
  icon,
  iconClassName,
  label,
  description,
  value,
}: {
  icon: ReactNode;
  iconClassName: string;
  label: string;
  description: string;
  value: number;
}) {
  return (
    <div
      className="
        flex items-center
        justify-between gap-4
        rounded-xl
        border border-(--line)
        bg-(--surface)
        p-4
        transition-colors
        hover:bg-(--hover-bg)
      "
    >
      <div
        className="
          flex min-w-0
          items-center gap-3
        "
      >
        <div
          className={`
            flex h-10 w-10 shrink-0
            items-center justify-center
            rounded-xl
            ${iconClassName}
          `}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p
            className="
              text-sm font-bold
              text-(--foreground-soft)
            "
          >
            {label}
          </p>

          <p
            className="
              mt-0.5 text-xs
              text-(--ink-faint)
            "
          >
            {description}
          </p>
        </div>
      </div>

      <span
        className="
          shrink-0 text-xl
          font-black
          text-(--foreground)
        "
      >
        {value}
      </span>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  valueClassName = "text-(--foreground)",
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div
      className="
        rounded-xl
        border border-(--line)
        bg-(--surface)
        p-4
      "
    >
      <p
        className="
          text-[10px] font-bold
          uppercase tracking-[0.1em]
          text-(--ink-faint)
        "
      >
        {label}
      </p>

      <p
        className={`
          mt-2 text-2xl
          font-black tracking-tight
          ${valueClassName}
        `}
      >
        {value}
      </p>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div
      className="
        flex items-center gap-1
      "
      aria-label={`${rating.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={17}
          className={
            star <= Math.round(rating)
              ? "fill-(--gold) text-(--gold)"
              : "text-(--line)"
          }
        />
      ))}
    </div>
  );
}

export default function StudentProgressPage() {
  const params = useParams();
  const router = useRouter();

  const studentId = String(params.id || "");

  const [student, setStudent] = useState<Student | null>(null);

  const [progress, setProgress] = useState<ProgressData | null>(null);

  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);

  const [performance, setPerformance] = useState<PerformanceItem[]>([]);

  const [selectedProgramId, setSelectedProgramId] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  async function loadProgress(programId = selectedProgramId) {
    if (!studentId) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [studentResponse, progressResponse] = await Promise.all([
        getStudentById(studentId),
        getStudentProgress(studentId, programId || undefined),
      ]);

      const studentResult =
        studentResponse?.student ??
        studentResponse?.data?.student ??
        studentResponse?.data ??
        studentResponse;

      const progressResult = unwrapProgress(progressResponse);

      const selectedProgram = progressResult?.selectedProgram;
      const resolvedProgramId = typeof selectedProgram === "object" ? selectedProgram?._id || "" : selectedProgram || programId;
      if (resolvedProgramId && resolvedProgramId !== selectedProgramId) setSelectedProgramId(resolvedProgramId);
      const hasCanonicalAttendance = Array.isArray(progressResult?.attendance);
      let attendanceResult: AttendanceItem[] = hasCanonicalAttendance
        ? progressResult.attendance
        : [];

      let performanceResult: PerformanceItem[] = [];

      if (!hasCanonicalAttendance) {
        try {
          attendanceResult = normalizeAttendance(
            await getStudentAttendance(studentId),
          );
        } catch (attendanceError) {
          console.error("Attendance API failed:", attendanceError);
        }
      }

      try {
        performanceResult = normalizePerformance(
          await getStudentPerformance(studentId),
        );
      } catch (performanceError) {
        console.error("Performance API failed:", performanceError);
      }

      if (!hasCanonicalAttendance && !attendanceResult.length) {
        attendanceResult = normalizeAttendance(progressResult?.attendance);

        if (!attendanceResult.length) {
          attendanceResult = normalizeAttendance(progressResult);
        }
      }

      if (!performanceResult.length) {
        performanceResult = normalizePerformanceFromProgress(progressResult);

        if (!performanceResult.length) {
          performanceResult = normalizePerformance(progressResult);
        }
      }

      const programKey = resolvedProgramId;
      const belongsToProgram = (item: { sessionTypeId?: string | { _id: string } | null }) => {
        const itemProgramId = typeof item.sessionTypeId === "object" ? item.sessionTypeId?._id : item.sessionTypeId;
        return !programKey || String(itemProgramId || "") === String(programKey);
      };
      attendanceResult = attendanceResult.filter(belongsToProgram);
      attendanceResult = attendanceResult.filter(
        (item) => item.attendanceType !== "MAKEUP",
      );
      performanceResult = performanceResult.filter(belongsToProgram);

      /*
       * The progress API returns the training and performance values
       * inside nested objects:
       *
       * progress.training.currentTrainingDay
       * progress.training.completedDays
       * progress.training.presentClasses
       * progress.performance.averageRating
       * progress.milestone.next
       *
       * Normalize that API contract into the flat shape used by this page.
       */
      const training = progressResult?.training ?? {};

      const performanceSummary = progressResult?.performance ?? {};

      const milestone = progressResult?.milestone ?? {};

      const normalized: ProgressData = {
        ...progressResult,

        currentTrainingDay: numberValue(
          training.currentTrainingDay,
          progressResult.currentTrainingDay,
          progressResult.trainingDay,
          progressResult.currentDay,
        ),

        completedDays: numberValue(
          training.completedDays,
          progressResult.completedDays,
        ),

        totalCurriculumDays: numberValue(
          training.totalCurriculumDays,
          progressResult.totalCurriculumDays,
          progressResult.curriculumDays,
        ),

        presentClasses: numberValue(
          training.presentClasses,
          progressResult.presentClasses,
          progressResult.present,
          progressResult.totalPresent,
        ),

        absentClasses: numberValue(
          training.absentClasses,
          progressResult.absentClasses,
          progressResult.absent,
          progressResult.totalAbsent,
        ),

        pendingMakeups: numberValue(
          training.pendingMakeups,
          progressResult.pendingMakeups,
        ),

        unscheduledMakeups: numberValue(
          training.unscheduledMakeups,
          progressResult.unscheduledMakeups,
        ),

        scheduledMakeups: numberValue(
          training.scheduledMakeups,
          progressResult.scheduledMakeups,
        ),

        completedMakeups: numberValue(
          training.completedMakeups,
          progressResult.completedMakeups,
        ),

        averageRating: numberValue(
          performanceSummary.averageRating,
          progressResult.averageRating,
          progressResult.avgRating,
          progressResult.averagePerformance,
        ),

        currentCurriculum: progressResult.currentCurriculum ?? null,

        nextMilestone: milestone.next ?? progressResult.nextMilestone ?? null,

        achievedMilestone:
          milestone.achieved ?? progressResult.achievedMilestone ?? null,

        attendance: attendanceResult,

        makeups: Array.isArray(progressResult?.makeups)
          ? progressResult.makeups
          : [],

        performance: performanceResult,

        performanceSummary: {
          totalEvaluations: performanceSummary.totalEvaluations,
          averageRating: performanceSummary.averageRating,
          latest: performanceSummary.latest ?? performanceResult[0] ?? null,
        },
      };

      setStudent(studentResult);
      setProgress(normalized);
      setAttendance(attendanceResult);
      setPerformance(performanceResult);
    } catch (loadError) {
      console.error("Failed to load student progress:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load student progress.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProgress("");
  }, [studentId]);

  const programOptions = useMemo(() => (progress?.tracks || []).map((track) => {
    const program = track.program;
    return typeof program === "object" && program?._id ? { id: program._id, name: program.name || "Training program" } : null;
  }).filter((item): item is { id: string; name: string } => Boolean(item)), [progress?.tracks]);

  const attendanceStats = useMemo(() => {
    const presentFromRecords = attendance.filter(
      (item) => item.attendanceType !== "MAKEUP" && statusOf(item.status) === "PRESENT",
    ).length;

    const absentFromRecords = attendance.filter(
      (item) => item.attendanceType !== "MAKEUP" && statusOf(item.status) === "ABSENT",
    ).length;

    const hasRecords = presentFromRecords + absentFromRecords > 0;

    const presentClasses = hasRecords
      ? presentFromRecords
      : numberValue(progress?.presentClasses);

    const absentClasses = hasRecords
      ? absentFromRecords
      : numberValue(progress?.absentClasses);

    const totalClasses = presentClasses + absentClasses;

    const attendancePercentage =
      totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

    return {
      presentClasses,
      absentClasses,
      totalClasses,
      attendancePercentage,
    };
  }, [attendance, progress]);

  const makeupStats = useMemo(() => {
    const records = progress?.makeups || [];
    const scheduledRecords = records.filter(
      (item) => statusOf(item.status) === "SCHEDULED",
    );
    const unscheduledFromRecords = scheduledRecords.filter(
      (item) => !item.makeupDate,
    ).length;
    const scheduledFromRecords = scheduledRecords.filter(
      (item) => Boolean(item.makeupDate),
    ).length;
    const completedFromRecords = records.filter(
      (item) => statusOf(item.status) === "COMPLETED",
    ).length;
    const pending = records.length
      ? scheduledRecords.length
      : numberValue(progress?.pendingMakeups);
    const unscheduled = records.length
      ? unscheduledFromRecords
      : numberValue(progress?.unscheduledMakeups);
    const scheduled = records.length
      ? scheduledFromRecords
      : numberValue(progress?.scheduledMakeups);
    const completed = records.length
      ? completedFromRecords
      : numberValue(progress?.completedMakeups);

    return {
      completed,
      pending,
      unscheduled,
      scheduled,
    };
  }, [progress]);

  const summary = useMemo(() => {
    /*
     * Use the backend's canonical progress values for training
     * progress. Attendance records are still used for the live
     * attendance percentage and makeup details.
     */

    const trainingDay = numberValue(progress?.currentTrainingDay);

    const completedDays = numberValue(progress?.completedDays);

    const totalCurriculumDays = numberValue(progress?.totalCurriculumDays);

    return {
      trainingDay,
      completedDays,
      totalCurriculumDays,
      attendancePercentage: attendanceStats.attendancePercentage,
    };
  }, [progress, attendanceStats.attendancePercentage]);

  const performanceSummary = (progress?.performanceSummary ||
    (progress as any)?.performance ||
    {}) as {
    totalEvaluations?: number | string;
    averageRating?: number | string | null;
    latest?: PerformanceItem | null;
  };

  const evaluationCount = useMemo(() => {
    if (performance.length) return performance.length;

    return numberValue(performanceSummary.totalEvaluations);
  }, [performance, performanceSummary.totalEvaluations]);

  const averageRating = useMemo(() => {
    const ratings = performance
      .map((item) => numberValue(item.rating))
      .filter((rating) => rating >= 1 && rating <= 5);

    if (ratings.length) {
      return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    }

    const raw = performanceSummary.averageRating;

    if (raw === null || raw === undefined || raw === "") {
      return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [performance, performanceSummary.averageRating]);

  const progressPercentage =
    summary.totalCurriculumDays > 0
      ? Math.min(
          100,
          Math.round(
            (summary.completedDays / summary.totalCurriculumDays) * 100,
          ),
        )
      : 0;

  const planCurriculum = normalizeCurriculum(student?.plan?.curriculum);

  const planMilestones = normalizeMilestones(student?.plan?.milestones);

  const currentCurriculum =
    progress?.currentCurriculum ??
    planCurriculum.find(
      (lesson) => numberValue(lesson.day) === summary.trainingDay + 1,
    ) ??
    null;

  const latestAttendanceWithCurriculum =
    attendance.find((record) => Boolean(record.curriculumTitle?.trim())) ??
    null;

  const curriculumToDisplay =
    currentCurriculum ??
    (latestAttendanceWithCurriculum
      ? {
          day: latestAttendanceWithCurriculum.planDay,
          title: latestAttendanceWithCurriculum.curriculumTitle,
          skill: undefined,
          description: undefined,
        }
      : null);

  const nextMilestone =
    progress?.nextMilestone ??
    planMilestones
      .filter((milestone) => numberValue(milestone.day) > summary.trainingDay)
      .sort((a, b) => numberValue(a.day) - numberValue(b.day))[0] ??
    null;

  const achievedMilestone =
    progress?.achievedMilestone ??
    planMilestones
      .filter((milestone) => numberValue(milestone.day) <= summary.trainingDay)
      .sort((a, b) => numberValue(b.day) - numberValue(a.day))[0] ??
    null;

  if (loading) {
    return (
      <main
        className="
          flex min-h-[calc(100vh-76px)]
          items-center justify-center
          bg-(--background)
          px-4
        "
      >
        <LoadingSpinner size="md" text="Loading student progress..." />
      </main>
    );
  }

  if (error || !student) {
    return (
      <main
        className="
          min-h-[calc(100vh-76px)]
          bg-(--background)
          px-4 py-6
          sm:px-6
          lg:px-8
        "
      >
        <div className="mx-auto max-w-[1500px]">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft size={17} />
            Back to Student
          </Button>

          <div className="mt-5">
            <ErrorState
              title="Unable to load progress"
              message={error || "Student could not be found."}
              action={
                <Button variant="outline" onClick={() => loadProgress()}>
                  Try again
                </Button>
              }
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        min-h-[calc(100vh-76px)]
        bg-(--background)
        px-4 py-6
        sm:px-6
        lg:px-8
        xl:px-10
      "
    >
      <div
        className="
          mx-auto max-w-[1500px]
          space-y-6
        "
      >
        {/* Page Navigation */}
        <div
          className="
            flex flex-wrap
            items-center
            justify-between gap-3
          "
        >
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft size={17} />
            Back to Student
          </Button>

          {programOptions.length > 0 && (
            <label className="flex items-center gap-3 text-sm font-semibold text-(--ink-muted)">
              Program
              <Select value={selectedProgramId} onChange={(event) => { setSelectedProgramId(event.target.value); void loadProgress(event.target.value); }}>
                {programOptions.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
              </Select>
            </label>
          )}

          <Button variant="outline" onClick={() => loadProgress()}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>

        {/* Student Header */}
        <Card padding="lg" className="overflow-hidden">
          <div
            className="
              flex flex-col gap-5
              md:flex-row
              md:items-center
              md:justify-between
            "
          >
            <div
              className="
                flex min-w-0
                items-center gap-4
              "
            >
              <div
                className="
                  flex h-16 w-16 shrink-0
                  items-center justify-center
                  rounded-2xl
                  border border-(--line)
                  bg-(--sidebar-logo-bg)
                  text-lg font-black
                  text-(--gold)
                  sm:h-20 sm:w-20
                  sm:text-2xl
                "
              >
                {getInitials(student.name)}
              </div>

              <div className="min-w-0">
                <div
                  className="
                    flex flex-wrap
                    items-center gap-2.5
                  "
                >
                  <h1
                    className="
                      truncate text-2xl
                      font-black
                      tracking-tight
                      text-(--foreground)
                      sm:text-3xl
                    "
                  >
                    {student.name}
                  </h1>

                  <Badge
                    variant={
                      statusOf(student.status) === "ACTIVE"
                        ? "success"
                        : "default"
                    }
                  >
                    {student.status || "ACTIVE"}
                  </Badge>
                </div>

                <p
                  className="
                    mt-2 text-sm
                    text-(--ink-muted)
                  "
                >
                  {progress?.currentBelt || student.currentBelt || "White Belt"}

                  {student.plan?.name ? ` • ${student.plan.name}` : ""}
                </p>

                <div
                  className="
                    mt-2 flex flex-wrap
                    items-center gap-x-4
                    gap-y-1.5
                    text-xs
                    text-(--ink-faint)
                  "
                >
                  {student.email && (
                    <span
                      className="
                        inline-flex
                        items-center gap-1.5
                      "
                    >
                      <Mail size={13} />
                      {student.email}
                    </span>
                  )}

                  {student.phone && <span>{student.phone}</span>}

                  {student.joinDate && (
                    <span
                      className="
                        inline-flex
                        items-center gap-1.5
                      "
                    >
                      <CalendarCheck size={13} />
                      Joined {formatDate(student.joinDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              className="
                shrink-0 rounded-2xl
                border border-(--line)
                bg-(--surface)
                px-5 py-4
              "
            >
              <p
                className="
                  text-[10px] font-black
                  uppercase
                  tracking-[0.14em]
                  text-(--ink-faint)
                "
              >
                Current Training Day
              </p>

              <p
                className="
                  mt-1 text-3xl font-black
                  tracking-tight
                  text-(--foreground)
                "
              >
                Day {progress?.currentTrainingDay ?? summary.trainingDay}
              </p>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div
          className="
            grid gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <SummaryCard
            title="Training Day"
            value={summary.trainingDay}
            subtitle="Regular attendance progression"
            icon={<Target size={20} />}
          />

          <SummaryCard
            title="Attendance"
            value={`${summary.attendancePercentage}%`}
            subtitle={`${attendanceStats.presentClasses} present · ${attendanceStats.absentClasses} absent`}
            icon={<CheckCircle2 size={20} />}
          />

          <SummaryCard
            title="Completed Days"
            value={`${summary.completedDays}/${summary.totalCurriculumDays}`}
            subtitle="Regular curriculum days only"
            icon={<CalendarCheck size={20} />}
          />

          <SummaryCard
            title="Open Makeups"
            value={makeupStats.pending}
            subtitle={`${makeupStats.unscheduled} need booking · ${makeupStats.scheduled} booked`}
            icon={<Clock3 size={20} />}
          />
        </div>

        {/* Main Progress */}
        <div
          className="
            grid gap-5
            lg:grid-cols-3
          "
        >
          <Card padding="lg" className="lg:col-span-2">
            <SectionHeading
              eyebrow="Development"
              title="Training Progress"
              description="
                Track completed curriculum days and
                overall training progression.
              "
              icon={<TrendingUp size={19} />}
            />

            <div className="mt-7">
              <div
                className="
                  flex items-end
                  justify-between gap-4
                "
              >
                <div>
                  <p
                    className="
                      text-[10px] font-black
                      uppercase
                      tracking-[0.14em]
                      text-(--ink-faint)
                    "
                  >
                    Completed Days
                  </p>

                  <p
                    className="
                      mt-2 text-4xl font-black
                      tracking-tight
                      text-(--foreground)
                    "
                  >
                    {summary.completedDays}
                  </p>
                </div>

                <p
                  className="
                    text-sm font-semibold
                    text-(--ink-muted)
                  "
                >
                  of {summary.totalCurriculumDays} days
                </p>
              </div>

              <div
                className="
                  mt-5 h-3
                  overflow-hidden
                  rounded-full
                  bg-(--line)
                "
              >
                <div
                  className="
                    h-full rounded-full
                    bg-(--accent)
                    transition-[width]
                    duration-700
                  "
                  style={{
                    width: `${progressPercentage}%`,
                  }}
                />
              </div>

              <div
                className="
                  mt-2 flex
                  items-center
                  justify-between
                  text-xs
                "
              >
                <span
                  className="
                    text-(--ink-faint)
                  "
                >
                  Curriculum progress
                </span>

                <span
                  className="
                    font-black
                    text-(--accent)
                  "
                >
                  {progressPercentage}%
                </span>
              </div>

              <div
                className="
                  mt-6 grid gap-3
                  sm:grid-cols-2
                  xl:grid-cols-5
                "
              >
                <MiniMetric
                  label="Present"
                  value={attendanceStats.presentClasses}
                  valueClassName="
                    text-(--green)
                  "
                />

                <MiniMetric
                  label="Absent"
                  value={attendanceStats.absentClasses}
                  valueClassName="
                    text-(--red)
                  "
                />

                <MiniMetric
                  label="Needs booking"
                  value={makeupStats.unscheduled}
                  valueClassName="
                    text-(--orange)
                  "
                />

                <MiniMetric
                  label="Booked makeups"
                  value={makeupStats.scheduled}
                  valueClassName="
                    text-(--blue)
                  "
                />

                <MiniMetric
                  label="Recovered"
                  value={makeupStats.completed}
                  valueClassName="
                    text-(--green)
                  "
                />
              </div>
            </div>
          </Card>

          {/* Rating */}
          <Card padding="lg">
            <SectionHeading
              eyebrow="Evaluation"
              title="Average Rating"
              description="Overall performance rating."
              icon={<Star size={19} />}
            />

            <div className="mt-7">
              <div
                className="
                  flex items-end gap-1
                "
              >
                <span
                  className="
                    text-5xl font-black
                    tracking-tight
                    text-(--foreground)
                  "
                >
                  {averageRating !== null ? averageRating.toFixed(1) : "—"}
                </span>

                <span
                  className="
                    mb-1 text-xl
                    font-semibold
                    text-(--ink-faint)
                  "
                >
                  /5
                </span>
              </div>

              <div className="mt-5">
                {averageRating !== null ? (
                  <StarRating rating={averageRating} />
                ) : (
                  <p className="text-sm text-(--ink-faint)">
                    No evaluations yet
                  </p>
                )}
              </div>

              <div
                className="
                  mt-6 rounded-xl
                  border border-(--line)
                  bg-(--surface)
                  p-4
                "
              >
                <p
                  className="
                    text-xs
                    text-(--ink-muted)
                  "
                >
                  Based on
                </p>

                <p
                  className="
                    mt-1 text-lg font-black
                    text-(--foreground)
                  "
                >
                  {performance.length} evaluation
                  {performance.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Attendance Breakdown */}
        <Card padding="lg">
          <SectionHeading
            eyebrow="Attendance"
            title="Attendance Overview"
            description="
              Each regular present or absent decision counts once per calendar day. Makeup recovery is tracked separately.
            "
            icon={<CalendarCheck size={19} />}
            action={
              <Badge variant="success">
                {attendanceStats.attendancePercentage}%
              </Badge>
            }
          />

          <div
            className="
              mt-5 grid gap-3
              md:grid-cols-2
              xl:grid-cols-5
            "
          >
            <MetricRow
              icon={<CheckCircle2 size={18} />}
              iconClassName="
                bg-(--green-soft)
                text-(--green)
              "
              label="Present Classes"
              description="Successfully attended"
              value={attendanceStats.presentClasses}
            />

            <MetricRow
              icon={<XCircle size={18} />}
              iconClassName="
                bg-(--red-soft)
                text-(--red)
              "
              label="Absent Classes"
              description="Missed training sessions"
              value={attendanceStats.absentClasses}
            />

            <MetricRow
              icon={<Clock3 size={18} />}
              iconClassName="
                bg-(--orange-soft)
                text-(--orange)
              "
              label="Needs Booking"
              description="No recovery date booked"
              value={makeupStats.unscheduled}
            />

            <MetricRow
              icon={<CalendarCheck size={18} />}
              iconClassName="
                bg-(--blue-soft)
                text-(--blue)
              "
              label="Booked Makeups"
              description="Recovery date scheduled"
              value={makeupStats.scheduled}
            />

            <MetricRow
              icon={<CheckCircle2 size={18} />}
              iconClassName="bg-(--green-soft) text-(--green)"
              label="Completed Makeups"
              description="Recovery session completed"
              value={makeupStats.completed}
            />
          </div>
        </Card>

        {/* Current Curriculum */}
        <Card padding="lg">
          <SectionHeading
            eyebrow="Learning Path"
            title={
              currentCurriculum
                ? "Current Curriculum"
                : "Latest Curriculum Record"
            }
            description="
              The student's current learning stage and skill focus.
            "
            icon={<GraduationCap size={19} />}
            action={
              curriculumToDisplay ? (
                <Badge variant="warning">Day {curriculumToDisplay.day}</Badge>
              ) : undefined
            }
          />

          {curriculumToDisplay ? (
            <div
              className="
                mt-5 grid gap-4
                lg:grid-cols-[1fr_300px]
              "
            >
              <div
                className="
                  rounded-2xl
                  border border-(--line)
                  bg-(--surface)
                  p-5
                "
              >
                <p
                  className="
                    text-[10px] font-black
                    uppercase
                    tracking-[0.14em]
                    text-(--accent)
                  "
                >
                  Day {curriculumToDisplay.day ?? summary.trainingDay}
                </p>

                <h3
                  className="
                    mt-2 text-xl
                    font-black
                    text-(--foreground)
                  "
                >
                  {curriculumToDisplay.title || "Training curriculum"}
                </h3>

                {curriculumToDisplay.description && (
                  <p
                    className="
                      mt-3 max-w-3xl
                      text-sm leading-6
                      text-(--ink-muted)
                    "
                  >
                    {curriculumToDisplay.description}
                  </p>
                )}

                {curriculumToDisplay.skill && (
                  <div
                    className="
                      mt-5 inline-flex
                      items-center gap-2
                      rounded-lg
                      bg-(--accent-soft)
                      px-3 py-2
                      text-(--accent)
                    "
                  >
                    <Award size={15} />

                    <span
                      className="
                        text-sm font-bold
                      "
                    >
                      {curriculumToDisplay.skill}
                    </span>
                  </div>
                )}
              </div>

              <div
                className="
                  rounded-2xl
                  border border-(--line)
                  bg-(--accent-soft)
                  p-5
                "
              >
                <p
                  className="
                    text-[10px] font-black
                    uppercase
                    tracking-[0.14em]
                    text-(--accent)
                  "
                >
                  Training Focus
                </p>

                <p
                  className="
                    mt-2 text-sm
                    font-semibold
                    leading-6
                    text-(--foreground-soft)
                  "
                >
                  Stay consistent with the current curriculum and focus on
                  mastering the assigned skills.
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              className="mt-5 min-h-[220px]"
              title="No current curriculum"
              description="
                Curriculum information will appear once
                training progress is recorded.
              "
              icon={<GraduationCap size={22} />}
            />
          )}
        </Card>

        {/* Belt Progression */}
        <Card padding="lg">
          <SectionHeading
            eyebrow="Achievement Path"
            title="Belt Progression"
            description="
              Track the student's current achievement path and upcoming milestone.
            "
            icon={<Award size={19} />}
          />

          {nextMilestone ? (
            <div className="mt-5">
              <div
                className="
                  rounded-2xl
                  border border-(--line)
                  bg-(--accent-soft)
                  p-5 sm:p-6
                "
              >
                <div
                  className="
                    flex flex-col gap-5
                    sm:flex-row
                    sm:items-center
                  "
                >
                  <div
                    className="
                      flex h-16 w-16
                      shrink-0
                      items-center
                      justify-center
                      rounded-2xl
                      bg-(--card)
                      text-(--accent)
                      shadow-sm
                    "
                  >
                    <Award size={28} />
                  </div>

                  <div>
                    <p
                      className="
                        text-[10px]
                        font-black
                        uppercase
                        tracking-[0.14em]
                        text-(--accent)
                      "
                    >
                      Next Milestone
                    </p>

                    <h3
                      className="
                        mt-1 text-2xl
                        font-black
                        text-(--foreground)
                      "
                    >
                      {nextMilestone.belt} Belt
                    </h3>

                    <p
                      className="
                        mt-1 text-xs
                        text-(--ink-muted)
                      "
                    >
                      Target Day {nextMilestone.day}
                    </p>
                  </div>
                </div>

                <div
                  className="
                    mt-5 rounded-xl
                    border border-(--line)
                    bg-(--card)
                    p-4
                  "
                >
                  <p
                    className="
                      text-sm font-bold
                      text-(--foreground-soft)
                    "
                  >
                    {nextMilestone.skill || "Milestone requirement"}
                  </p>

                  {nextMilestone.description && (
                    <p
                      className="
                        mt-2 text-sm
                        leading-6
                        text-(--ink-muted)
                      "
                    >
                      {nextMilestone.description}
                    </p>
                  )}
                </div>
              </div>

              {achievedMilestone && (
                <div
                  className="
                    mt-4 flex
                    items-center gap-3
                    rounded-xl
                    border border-(--green)/20
                    bg-(--green-soft)
                    p-4
                  "
                >
                  <CheckCircle2
                    size={20}
                    className="
                      shrink-0
                      text-(--green)
                    "
                  />

                  <div>
                    <p
                      className="
                        text-xs font-black
                        text-(--green)
                      "
                    >
                      Latest Achievement
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-(--foreground-soft)
                      "
                    >
                      {achievedMilestone.belt || "Achievement"} Belt
                      {achievedMilestone.skill
                        ? ` • ${achievedMilestone.skill}`
                        : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              className="mt-5 min-h-[240px]"
              title="No upcoming milestone"
              description="
                Belt progression details will appear as the
                student advances through the curriculum.
              "
              icon={<Award size={22} />}
            />
          )}
        </Card>

        {/* Detailed Records */}
        <div
          className="
            grid gap-5
            xl:grid-cols-2
          "
        >
          <div className="space-y-5">
            {/* Regular Attendance History */}
            <Card padding="lg">
            <SectionHeading
              eyebrow="Class Records"
              title="Regular Attendance"
              description="Present and absent decisions that drive curriculum progression."
              icon={<CalendarCheck size={19} />}
              action={
                <Badge variant="warning">{attendance.length} Records</Badge>
              }
            />

            {attendance.length ? (
              <div
                className="
                  mt-5 max-h-[420px]
                  space-y-2.5
                  overflow-y-auto pr-1
                "
              >
                {attendance.map((item, index) => {
                  const present = statusOf(item.status) === "PRESENT";

                  return (
                    <div
                      key={item._id || `${item.date}-${index}`}
                      className="
                          flex items-center
                          justify-between gap-3
                          rounded-xl
                          border border-(--line)
                          bg-(--surface)
                          p-3.5
                        "
                    >
                      <div
                        className="
                            flex min-w-0
                            items-center gap-3
                          "
                      >
                        <div
                          className={`
                              flex h-9 w-9
                              shrink-0
                              items-center
                              justify-center
                              rounded-lg
                              ${
                                present
                                  ? "bg-(--green-soft) text-(--green)"
                                  : "bg-(--red-soft) text-(--red)"
                              }
                            `}
                        >
                          {present ? (
                            <CheckCircle2 size={17} />
                          ) : (
                            <XCircle size={17} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p
                            className="
                                truncate
                                text-sm font-bold
                                text-(--foreground-soft)
                              "
                          >
                            {item.curriculumTitle ||
                              `Training Day ${item.planDay ?? "—"}`}
                          </p>

                          <p
                            className="
                                mt-1 text-xs
                                text-(--ink-faint)
                              "
                          >
                            {formatDate(item.date)}
                          </p>
                          {(item.sessionName || item.sessionStartTime || item.sessionEndTime) && (
                            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-(--accent)">
                              <Clock3 size={12} />
                              <span>
                                {item.sessionName || "Training session"}
                                {(item.sessionStartTime || item.sessionEndTime) && ` · ${formatTime(item.sessionStartTime)} – ${formatTime(item.sessionEndTime)}`}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className="
                            shrink-0 text-right
                          "
                      >
                        <p
                          className="
                              text-[10px]
                              font-black
                              uppercase
                              text-(--foreground-soft)
                            "
                        >
                          {statusOf(item.status) || "UNKNOWN"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                className="mt-5 min-h-[250px]"
                title="No attendance records"
                description="
                  Attendance records will appear after classes
                  are marked.
                "
                icon={<CalendarCheck size={22} />}
              />
            )}
            </Card>

            {/* Makeup Recovery History */}
            <Card padding="lg">
              <SectionHeading
                eyebrow="Recovery Sessions"
                title="Makeup History"
                description="Recovery sessions stay separate from regular attendance and curriculum progression."
                icon={<Clock3 size={19} />}
                action={
                  <Badge variant="info">
                    {(progress?.makeups || []).length} Records
                  </Badge>
                }
              />

              {(progress?.makeups || []).length ? (
                <div className="mt-5 max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                  {(progress?.makeups || []).map((item, index) => {
                    const state = statusOf(item.status);
                    const isCompleted = state === "COMPLETED";
                    const isCancelled = state === "CANCELLED";
                    const isBooked = state === "SCHEDULED" && Boolean(item.makeupDate);
                    const stateLabel = isCompleted
                      ? "COMPLETED"
                      : isCancelled
                        ? "CANCELLED"
                        : isBooked
                          ? "BOOKED"
                          : "NEEDS BOOKING";
                    const stateClass = isCompleted
                      ? "text-(--green)"
                      : isCancelled
                        ? "text-(--ink-faint)"
                        : isBooked
                          ? "text-(--blue)"
                          : "text-(--orange)";

                    return (
                      <div
                        key={item._id || `${item.originalDate}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-(--line) bg-(--surface) p-3.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isCompleted ? "bg-(--green-soft) text-(--green)" : isCancelled ? "bg-(--surface) text-(--ink-faint)" : isBooked ? "bg-(--blue-soft) text-(--blue)" : "bg-(--orange-soft) text-(--orange)"}`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 size={17} />
                            ) : isCancelled ? (
                              <XCircle size={17} />
                            ) : isBooked ? (
                              <CalendarCheck size={17} />
                            ) : (
                              <Clock3 size={17} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-(--foreground-soft)">
                              {item.curriculumTitle || `Training Day ${item.planDay ?? "—"}`}
                            </p>
                            <p className="mt-1 text-xs text-(--ink-faint)">
                              Missed {formatDate(item.originalDate)}
                              {item.makeupDate
                                ? ` · Recovery ${formatDate(item.makeupDate)}`
                                : " · No recovery date booked"}
                            </p>
                          </div>
                        </div>
                        <span className={`shrink-0 text-right text-[10px] font-black uppercase ${stateClass}`}>
                          {stateLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  className="mt-5 min-h-[180px]"
                  title="No makeup records"
                  description="An absence will create a recovery record here."
                  icon={<Clock3 size={22} />}
                />
              )}
            </Card>
          </div>

          {/* Performance History */}
          <Card padding="lg">
            <SectionHeading
              eyebrow="Evaluation History"
              title="Performance Records"
              icon={<Award size={19} />}
              action={<Badge variant="info">{evaluationCount} Reports</Badge>}
            />

            {performance.length ? (
              <div
                className="
                  mt-5 max-h-[420px]
                  space-y-2.5
                  overflow-y-auto pr-1
                "
              >
                {performance.map((item, index) => {
                  const rating = numberValue(item.rating);

                  return (
                    <div
                      key={item._id || `${item.evaluationDate}-${index}`}
                      className="
                          rounded-xl
                          border border-(--line)
                          bg-(--surface)
                          p-4
                        "
                    >
                      <div
                        className="
                            flex items-start
                            justify-between gap-4
                          "
                      >
                        <div className="min-w-0">
                          <p
                            className="
                                truncate
                                text-sm font-bold
                                text-(--foreground-soft)
                              "
                          >
                            {item.curriculumTitle ||
                              item.skill ||
                              `Evaluation ${index + 1}`}
                          </p>

                          <p
                            className="
                                mt-1 text-xs
                                text-(--ink-faint)
                              "
                          >
                            {formatDate(item.evaluationDate)}
                          </p>
                        </div>

                        <div
                          className="
                              shrink-0
                              text-right
                            "
                        >
                          <p
                            className="
                                text-sm font-black
                                text-(--foreground)
                              "
                          >
                            {rating.toFixed(1)}
                            /5
                          </p>

                          <div className="mt-1">
                            <StarRating rating={rating} />
                          </div>
                        </div>
                      </div>

                      {item.remarks && (
                        <div
                          className="
                              mt-3 rounded-lg
                              border
                              border-(--line)
                              bg-(--card)
                              p-3
                            "
                        >
                          <p
                            className="
                                text-sm
                                leading-5
                                text-(--ink-muted)
                              "
                          >
                            {item.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                className="mt-5 min-h-[250px]"
                title="No performance records"
                description="
                  Performance evaluations will appear after
                  an instructor submits them.
                "
                icon={<Award size={22} />}
              />
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

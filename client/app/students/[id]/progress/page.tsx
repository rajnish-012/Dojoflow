"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Mail,
  Star,
  Target,
  TrendingUp,
  UserRound,
  XCircle,
} from "lucide-react";

import {
  getStudentById,
  getStudentProgress,
  getStudentAttendance,
  getStudentPerformance,
} from "@/lib/api";

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
  } | null;
};

type AttendanceItem = {
  _id?: string;
  date?: string;
  planDay?: number;
  curriculumTitle?: string;
  status?: string;
  makeupRequired?: boolean;
  makeupCompleted?: boolean;
};

type PerformanceItem = {
  _id?: string;
  planDay?: number;
  curriculumTitle?: string;
  skill?: string;
  rating?: number | string;
  remarks?: string;
  evaluationDate?: string;
};

type CurriculumItem = {
  day?: number;
  title?: string;
  description?: string;
  skill?: string;
};

type ProgressData = {
  currentTrainingDay?: number | string;
  completedDays?: number | string;
  totalCurriculumDays?: number | string;
  presentClasses?: number | string;
  absentClasses?: number | string;
  pendingMakeups?: number | string;
  completedMakeups?: number | string;
  averageRating?: number | string;
  currentCurriculum?: CurriculumItem | null;
  nextMilestone?: any;
  achievedMilestone?: any;
  attendance?: AttendanceItem[];
  performance?: PerformanceItem[];
};

function numberValue(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST"
  );
}

function formatDate(date?: string) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusOf(status?: string) {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function extractArray<T = any>(source: any, keys: string[] = []): T[] {
  if (Array.isArray(source)) return source;

  for (const key of keys) {
    if (Array.isArray(source?.[key])) return source[key];
  }

  return [];
}

function unwrapProgress(response: any): any {
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

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {title}
          </p>
          <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div className={`rounded-2xl p-3 ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-500">{description}</p>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (studentId) loadProgress();
  }, [studentId]);

  async function loadProgress() {
    try {
      setLoading(true);
      setError("");

      const [studentResponse, progressResponse] = await Promise.all([
        getStudentById(studentId),
        getStudentProgress(studentId),
      ]);

      const studentResult =
        studentResponse?.student ??
        studentResponse?.data?.student ??
        studentResponse?.data ??
        studentResponse;

      const progressResult = unwrapProgress(progressResponse);

      let attendanceResult: AttendanceItem[] = [];
      let performanceResult: PerformanceItem[] = [];

      try {
        attendanceResult = normalizeAttendance(
          await getStudentAttendance(studentId),
        );
      } catch (err) {
        console.error("Attendance API failed:", err);
      }

      try {
        performanceResult = normalizePerformance(
          await getStudentPerformance(studentId),
        );
      } catch (err) {
        console.error("Performance API failed:", err);
      }

      // Some backend versions return these arrays inside the progress response.
      if (!attendanceResult.length) {
        attendanceResult = normalizeAttendance(progressResult?.attendance);
        if (!attendanceResult.length) {
          attendanceResult = normalizeAttendance(progressResult);
        }
      }

      if (!performanceResult.length) {
        performanceResult = normalizePerformance(progressResult?.performance);
        if (!performanceResult.length) {
          performanceResult = normalizePerformance(progressResult);
        }
      }

      const normalized: ProgressData = {
        ...progressResult,
        currentTrainingDay: numberValue(
          progressResult.currentTrainingDay,
          progressResult.trainingDay,
          progressResult.currentDay,
        ),
        completedDays: numberValue(progressResult.completedDays),
        totalCurriculumDays: numberValue(
          progressResult.totalCurriculumDays,
          progressResult.curriculumDays,
        ),
        presentClasses: numberValue(
          progressResult.presentClasses,
          progressResult.present,
          progressResult.totalPresent,
        ),
        absentClasses: numberValue(
          progressResult.absentClasses,
          progressResult.absent,
          progressResult.totalAbsent,
        ),
        pendingMakeups: numberValue(progressResult.pendingMakeups),
        completedMakeups: numberValue(progressResult.completedMakeups),
        averageRating: numberValue(
          progressResult.averageRating,
          progressResult.avgRating,
          progressResult.averagePerformance,
        ),
        attendance: attendanceResult,
        performance: performanceResult,
      };

      setStudent(studentResult);
      setProgress(normalized);
      setAttendance(attendanceResult);
      setPerformance(performanceResult);
    } catch (err) {
      console.error("Failed to load student progress:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load student progress",
      );
    } finally {
      setLoading(false);
    }
  }

  const attendanceStats = useMemo(() => {
    const presentFromRecords = attendance.filter(
      (item) => statusOf(item.status) === "PRESENT",
    ).length;

    const absentFromRecords = attendance.filter(
      (item) => statusOf(item.status) === "ABSENT",
    ).length;

    const hasAttendanceRecords = presentFromRecords + absentFromRecords > 0;

    const presentClasses = hasAttendanceRecords
      ? presentFromRecords
      : numberValue(progress?.presentClasses);

    const absentClasses = hasAttendanceRecords
      ? absentFromRecords
      : numberValue(progress?.absentClasses);

    const totalClasses = presentClasses + absentClasses;

    return {
      presentClasses,
      absentClasses,
      totalClasses,
      attendancePercentage:
        totalClasses > 0
          ? Math.round((presentClasses / totalClasses) * 100)
          : 0,
    };
  }, [attendance, progress]);

  const summary = useMemo(() => {
    const completedMakeupsFromRecords = attendance.filter(
      (item) => item.makeupRequired === true && item.makeupCompleted === true,
    ).length;

    const pendingMakeupsFromRecords = attendance.filter(
      (item) => item.makeupRequired === true && item.makeupCompleted !== true,
    ).length;

    const completedMakeups =
      completedMakeupsFromRecords > 0
        ? completedMakeupsFromRecords
        : numberValue(progress?.completedMakeups);

    const pendingMakeups =
      pendingMakeupsFromRecords > 0
        ? pendingMakeupsFromRecords
        : numberValue(progress?.pendingMakeups);

    // Required business rules:
    // Training Day = present + absent
    // Attendance = present / (present + absent)
    // Completed Days = present + completed makeups
    // Curriculum Days = present + absent
    const trainingDay = attendanceStats.totalClasses;
    const completedDays = attendanceStats.presentClasses + completedMakeups;
    const totalCurriculumDays = trainingDay;

    return {
      trainingDay,
      attendancePercentage: attendanceStats.attendancePercentage,
      completedDays,
      totalCurriculumDays,
      completedMakeups,
      pendingMakeups,
    };
  }, [attendance, progress, attendanceStats]);

  const averageRating = useMemo(() => {
    const ratings = performance
      .map((item) => numberValue(item.rating))
      .filter((rating) => rating > 0);

    if (ratings.length) {
      return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    }

    return numberValue(progress?.averageRating);
  }, [performance, progress]);

  const currentCurriculum = progress?.currentCurriculum;
  const progressPercentage =
    summary.totalCurriculumDays > 0
      ? Math.min(
          100,
          Math.round(
            (summary.completedDays / summary.totalCurriculumDays) * 100,
          ),
        )
      : 0;

  function renderStars(rating: number) {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={
              star <= Math.round(rating)
                ? "fill-amber-400 text-amber-400"
                : "text-slate-200"
            }
            size={18}
          />
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb]">
        <div className="flex items-center gap-3 text-slate-600">
          <Clock className="h-5 w-5 animate-spin text-orange-500" />
          Loading student progress...
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] p-6">
        <button
          onClick={() => router.back()}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Student
        </button>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "Student not found"}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Student
          </button>

          <button
            onClick={loadProgress}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-orange-300 hover:text-orange-600"
          >
            Refresh
          </button>
        </div>

        <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-50 text-2xl font-bold text-orange-600">
                {getInitials(student.name)}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">
                    {student.name}
                  </h1>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {student.status || "ACTIVE"}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  {student.currentBelt || "White Belt"}
                  {student.plan?.name ? ` • ${student.plan.name}` : ""}
                </p>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                  {student.email && (
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {student.email}
                    </span>
                  )}
                  {student.phone && <span>{student.phone}</span>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Current Training Day
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-950">
                Day {summary.trainingDay}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Training Day"
            value={summary.trainingDay}
            description="Present + absent classes"
            icon={Target}
            iconClass="bg-orange-50 text-orange-600"
          />

          <SummaryCard
            title="Attendance"
            value={`${summary.attendancePercentage}%`}
            description={`${Math.round(
              (summary.attendancePercentage / 100) * summary.trainingDay,
            )} present of ${summary.trainingDay} classes`}
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Completed Days"
            value={`${summary.completedDays}/${summary.totalCurriculumDays}`}
            description={`${summary.completedMakeups} completed makeups included`}
            icon={CalendarCheck}
            iconClass="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Pending Makeups"
            value={summary.pendingMakeups}
            description="Classes requiring attention"
            icon={XCircle}
            iconClass="bg-red-50 text-red-600"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Training Progress
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Your completed training days and curriculum progress
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-orange-500" />
            </div>

            <div className="mt-7 flex items-end justify-between">
              <div>
                <p className="text-sm text-slate-500">Completed Days</p>
                <p className="mt-1 text-4xl font-bold text-slate-950">
                  {summary.completedDays}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                of {summary.totalCurriculumDays} days
              </p>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Present</p>
                <p className="mt-2 text-2xl font-bold text-emerald-600">
                  {summary.completedDays || 0}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Absent</p>
                <p className="mt-2 text-2xl font-bold text-red-500">
                  {summary.totalCurriculumDays - summary.completedDays}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Completed Makeups</p>
                <p className="mt-2 text-2xl font-bold text-blue-600">
                  {summary.completedMakeups}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Pending Makeups</p>
                <p className="mt-2 text-2xl font-bold text-red-500">
                  {summary.pendingMakeups}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-amber-50 p-3">
                <Star className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Average Rating
                </h2>
                <p className="text-sm text-slate-500">Overall performance</p>
              </div>
            </div>

            <div className="mt-8 flex items-end gap-1">
              <p className="text-5xl font-bold text-slate-950">
                {averageRating.toFixed(1)}
              </p>
              <p className="mb-1 text-xl font-semibold text-slate-400">/5</p>
            </div>

            <div className="mt-5">{renderStars(averageRating)}</div>

            <p className="mt-5 text-sm text-slate-500">
              Based on {performance.length} performance evaluation
              {performance.length === 1 ? "" : "s"}.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-orange-500" />
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Current Curriculum
              </h2>
              <p className="text-sm text-slate-500">
                The student&apos;s current learning step
              </p>
            </div>
          </div>

          {currentCurriculum ? (
            <div className="mt-5 rounded-xl bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-500">
                Day {currentCurriculum.day ?? summary.trainingDay}
              </p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">
                {currentCurriculum.title || "Current training curriculum"}
              </h3>
              {currentCurriculum.description && (
                <p className="mt-2 text-sm text-slate-500">
                  {currentCurriculum.description}
                </p>
              )}
              {currentCurriculum.skill && (
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  Skill: {currentCurriculum.skill}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
              No current curriculum data available.
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">
              Attendance Records
            </h2>

            <div className="mt-5 space-y-3">
              {attendance.length ? (
                attendance.map((item, index) => (
                  <div
                    key={item._id || `${item.date}-${index}`}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">
                        {item.curriculumTitle ||
                          `Training Day ${item.planDay ?? "—"}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(item.date)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        statusOf(item.status) === "PRESENT"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {statusOf(item.status) || "UNKNOWN"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                  No attendance records found.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">
              Performance Records
            </h2>

            <div className="mt-5 space-y-3">
              {performance.length ? (
                performance.map((item, index) => (
                  <div
                    key={item._id || `${item.evaluationDate}-${index}`}
                    className="rounded-xl bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {item.curriculumTitle ||
                            item.skill ||
                            `Evaluation ${index + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(item.evaluationDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-950">
                          {numberValue(item.rating).toFixed(1)}/5
                        </p>
                        {renderStars(numberValue(item.rating))}
                      </div>
                    </div>
                    {item.remarks && (
                      <p className="mt-3 text-sm text-slate-600">
                        {item.remarks}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                  No performance records found.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

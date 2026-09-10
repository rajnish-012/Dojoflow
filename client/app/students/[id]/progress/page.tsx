"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Star,
  Target,
  TrendingUp,
  UserRound,
  XCircle,
} from "lucide-react";

import {
  getStudentById,
  getStudentProgress,
} from "@/lib/api";

type Student = {
  _id: string;
  name: string;
  age: number;
  phone: string;
  email?: string;
  currentBelt?: string;
  status?: string;
  plan?: {
    _id: string;
    name: string;
    price?: number;
    duration?: number;
    durationUnit?: string;
  };
};

type CurriculumItem = {
  day: number;
  title: string;
  description?: string;
  skill?: string;
};

type PerformanceItem = {
  _id: string;
  planDay: number;
  curriculumTitle: string;
  skill: string;
  rating: number;
  remarks?: string;
  evaluationDate?: string;
};

type AttendanceItem = {
  _id: string;
  date: string;
  planDay: number;
  curriculumTitle: string;
  status: "PRESENT" | "ABSENT";
  makeupRequired?: boolean;
  makeupCompleted?: boolean;
};

type Milestone = {
  day: number;
  belt: string;
  skill: string;
  description?: string;
};

type ProgressData = {
  currentTrainingDay: number;
  completedDays: number;
  totalCurriculumDays: number;

  presentClasses: number;
  absentClasses: number;

  pendingMakeups: number;
  completedMakeups: number;

  currentCurriculum?: CurriculumItem | null;

  nextMilestone?: Milestone | null;
  achievedMilestone?: Milestone | null;

  averageRating: number;

  performance: PerformanceItem[];
  attendance: AttendanceItem[];
};

export default function StudentProgressPage() {
  const params = useParams();
  const router = useRouter();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (studentId) {
      loadProgress();
    }
  }, [studentId]);

  async function loadProgress() {
    try {
      setLoading(true);
      setError("");

      const [studentData, progressData] = await Promise.all([
        getStudentById(studentId),
        getStudentProgress(studentId),
      ]);

      const studentResult =
        studentData.student || studentData;

      const progressResult: any =
        progressData.progress || progressData;

      /*
       * Normalize performance and attendance.
       *
       * Depending on the backend response, these can sometimes
       * arrive as arrays or nested objects. We always convert
       * them into arrays before rendering.
       */

      let performanceData: PerformanceItem[] = [];

      if (Array.isArray(progressResult.performance)) {
        performanceData = progressResult.performance;
      } else if (
        Array.isArray(progressResult.performance?.performance)
      ) {
        performanceData =
          progressResult.performance.performance;
      } else if (
        Array.isArray(progressResult.performance?.records)
      ) {
        performanceData =
          progressResult.performance.records;
      } else if (
        Array.isArray(progressResult.performance?.data)
      ) {
        performanceData =
          progressResult.performance.data;
      }

      let attendanceData: AttendanceItem[] = [];

      if (Array.isArray(progressResult.attendance)) {
        attendanceData = progressResult.attendance;
      } else if (
        Array.isArray(progressResult.attendance?.attendance)
      ) {
        attendanceData =
          progressResult.attendance.attendance;
      } else if (
        Array.isArray(progressResult.attendance?.records)
      ) {
        attendanceData =
          progressResult.attendance.records;
      } else if (
        Array.isArray(progressResult.attendance?.data)
      ) {
        attendanceData =
          progressResult.attendance.data;
      }

      const normalizedProgress: ProgressData = {
        ...progressResult,

        currentTrainingDay:
          Number(progressResult.currentTrainingDay) || 0,

        completedDays:
          Number(progressResult.completedDays) || 0,

        totalCurriculumDays:
          Number(progressResult.totalCurriculumDays) || 0,

        presentClasses:
          Number(progressResult.presentClasses) || 0,

        absentClasses:
          Number(progressResult.absentClasses) || 0,

        pendingMakeups:
          Number(progressResult.pendingMakeups) || 0,

        completedMakeups:
          Number(progressResult.completedMakeups) || 0,

        averageRating:
          Number(progressResult.averageRating) || 0,

        performance: performanceData,

        attendance: attendanceData,
      };

      setStudent(studentResult);
      setProgress(normalizedProgress);
    } catch (err: any) {
      setError(
        err.message || "Failed to load student progress"
      );
    } finally {
      setLoading(false);
    }
  }

  const curriculumPercentage = useMemo(() => {
    if (!progress?.totalCurriculumDays) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (progress.completedDays /
          progress.totalCurriculumDays) *
          100
      )
    );
  }, [progress]);

  const attendanceTotal = useMemo(() => {
    if (!progress) {
      return 0;
    }

    return (
      progress.presentClasses +
      progress.absentClasses
    );
  }, [progress]);

  const attendancePercentage = useMemo(() => {
    if (!attendanceTotal || !progress) {
      return 0;
    }

    return Math.round(
      (progress.presentClasses / attendanceTotal) * 100
    );
  }, [progress, attendanceTotal]);

  function renderStars(rating: number) {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={17}
            fill={
              star <= rating
                ? "currentColor"
                : "none"
            }
            className={
              star <= rating
                ? "text-yellow-500"
                : "text-gray-300"
            }
          />
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">
          Loading student progress...
        </div>
      </div>
    );
  }

  if (error || !student || !progress) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={17} />
          Back
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error ||
            "Student progress could not be loaded."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={17} />
          Back to Student
        </button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200">
              <UserRound
                size={25}
                className="text-gray-600"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {student.name}
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                {student.plan?.name || "No plan"} •{" "}
                {student.currentBelt || "White"} Belt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
              Day {progress.currentTrainingDay}
            </span>

            <span
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                student.status === "ACTIVE"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {student.status || "ACTIVE"}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Training Progress */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Training Progress
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                Day {progress.currentTrainingDay}
              </p>
            </div>

            <div className="rounded-lg bg-gray-100 p-2.5">
              <TrendingUp
                size={21}
                className="text-gray-600"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            {progress.completedDays} of{" "}
            {progress.totalCurriculumDays} curriculum days
          </p>
        </div>

        {/* Attendance */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Attendance
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                {attendancePercentage}%
              </p>
            </div>

            <div className="rounded-lg bg-green-50 p-2.5">
              <CalendarCheck
                size={21}
                className="text-green-600"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            {progress.presentClasses} present •{" "}
            {progress.absentClasses} absent
          </p>
        </div>

        {/* Performance */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Avg. Performance
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                {progress.averageRating.toFixed(1)}
                <span className="text-sm font-normal text-gray-400">
                  {" "}
                  / 5
                </span>
              </p>
            </div>

            <div className="rounded-lg bg-yellow-50 p-2.5">
              <Star
                size={21}
                className="text-yellow-500"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Based on performance evaluations
          </p>
        </div>

        {/* Makeups */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Pending Makeups
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                {progress.pendingMakeups}
              </p>
            </div>

            <div className="rounded-lg bg-red-50 p-2.5">
              <Clock
                size={21}
                className="text-red-500"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            {progress.completedMakeups} completed
          </p>
        </div>
      </div>

      {/* Curriculum Progress */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Curriculum */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Curriculum Progress
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Student's progress through the training plan.
              </p>
            </div>

            <GraduationCap
              size={22}
              className="text-gray-500"
            />
          </div>

          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Completed curriculum
            </span>

            <span className="font-semibold text-gray-900">
              {curriculumPercentage}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gray-900 transition-all"
              style={{
                width: `${curriculumPercentage}%`,
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">
                Completed Days
              </p>

              <p className="mt-1 text-xl font-bold text-gray-900">
                {progress.completedDays}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">
                Total Days
              </p>

              <p className="mt-1 text-xl font-bold text-gray-900">
                {progress.totalCurriculumDays}
              </p>
            </div>
          </div>
        </div>

        {/* Current Curriculum */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-gray-100 p-2.5">
              <Target
                size={21}
                className="text-gray-600"
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Current Training
              </h2>

              <p className="text-sm text-gray-500">
                Current curriculum milestone
              </p>
            </div>
          </div>

          {progress.currentCurriculum ? (
            <div className="rounded-xl bg-gray-50 p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                  Day {progress.currentCurriculum.day}
                </span>

                {progress.currentCurriculum.skill && (
                  <span className="text-xs text-gray-500">
                    {progress.currentCurriculum.skill}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-semibold text-gray-900">
                {progress.currentCurriculum.title}
              </h3>

              {progress.currentCurriculum.description && (
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {progress.currentCurriculum.description}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 p-5 text-sm text-gray-500">
              No current curriculum available.
            </div>
          )}
        </div>
      </div>

      {/* Belt Progression */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-gray-100 p-2.5">
            <Award
              size={21}
              className="text-gray-600"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Belt Progression
            </h2>

            <p className="text-sm text-gray-500">
              Track the student's next belt milestone.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Current Belt */}
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Current Belt
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <Award
                  size={23}
                  className="text-gray-600"
                />
              </div>

              <div>
                <p className="text-xl font-bold text-gray-900">
                  {student.currentBelt || "White"}
                </p>

                <p className="text-xs text-gray-500">
                  Current level
                </p>
              </div>
            </div>
          </div>

          {/* Next Milestone */}
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Next Milestone
            </p>

            {progress.nextMilestone ? (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-gray-900">
                    {progress.nextMilestone.belt}
                  </p>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    Day {progress.nextMilestone.day}
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium text-gray-700">
                  {progress.nextMilestone.skill}
                </p>

                {progress.nextMilestone.description && (
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {progress.nextMilestone.description}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                No upcoming milestone defined.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Attendance History */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Attendance History
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Recent attendance records.
            </p>
          </div>

          <CalendarCheck
            size={21}
            className="text-gray-500"
          />
        </div>

        {!Array.isArray(progress.attendance) ||
        progress.attendance.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            No attendance records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Date
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Day
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Curriculum
                  </th>

                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>

                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Makeup
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {progress.attendance.map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(
                        item.date
                      ).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-700">
                      Day {item.planDay}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.curriculumTitle}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {item.status === "PRESENT" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                          <CheckCircle2 size={13} />
                          Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          <XCircle size={13} />
                          Absent
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {item.makeupRequired ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.makeupCompleted
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {item.makeupCompleted
                            ? "Completed"
                            : "Required"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Performance History */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Performance History
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Student skill evaluations and coach feedback.
            </p>
          </div>

          <Star
            size={21}
            className="text-gray-500"
          />
        </div>

        {!Array.isArray(progress.performance) ||
        progress.performance.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            No performance evaluations found.
          </div>
        ) : (
          <div className="space-y-4">
            {progress.performance.map((item) => (
              <div
                key={item._id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        Day {item.planDay}
                      </span>

                      <span className="text-sm font-semibold text-gray-900">
                        {item.curriculumTitle}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-500">
                      Skill: {item.skill}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderStars(item.rating)}

                    <span className="text-sm font-semibold text-gray-700">
                      {item.rating}/5
                    </span>
                  </div>
                </div>

                {item.remarks && (
                  <div className="mt-4 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">
                      Coach Remarks
                    </p>

                    <p className="mt-1 text-sm text-gray-700">
                      {item.remarks}
                    </p>
                  </div>
                )}

                {item.evaluationDate && (
                  <p className="mt-3 text-xs text-gray-400">
                    Evaluated on{" "}
                    {new Date(
                      item.evaluationDate
                    ).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
  XCircle,
  ArrowUpRight,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// ======================================================
// TYPES
// ======================================================

type Student = {
  _id: string;
  name: string;
  age?: number;
  phone?: string;
  email?: string;
  currentBelt?: string;
  belt?: string;
  status?: string;
  joinDate?: string;
  branch?: {
    _id?: string;
    name?: string;
    address?: string;
  } | null;
  plan?: {
    _id?: string;
    name?: string;
    price?: number;
    duration?: number;
    durationUnit?: string;
    classesPerWeek?: number;
    startingBelt?: string;
    progressReports?: string;
    curriculum?: CurriculumItem[];
    milestones?: MilestoneItem[];
  } | null;
};

type CurriculumItem = {
  day?: number;
  title?: string;
  belt?: string;
  skill?: string;
  description?: string;
};

type MilestoneItem = {
  day?: number;
  title?: string;
  belt?: string;
  skill?: string;
  description?: string;
};

type AttendanceRecord = {
  _id: string;
  student?: string | { _id?: string; name?: string };
  date: string;
  planDay?: number;
  curriculumTitle?: string;
  status?: string;
  remarks?: string;
  makeupRequired?: boolean;
  makeupCompleted?: boolean;
};

type PerformanceRecord = {
  _id: string;
  student?: string | { _id?: string; name?: string };
  planDay?: number;
  curriculumTitle?: string;
  skill?: string;
  rating?: number;
  remarks?: string;
  evaluationDate?: string;
  createdAt?: string;
  evaluatedBy?: {
    _id?: string;
    name?: string;
    email?: string;
  } | null;
};

// ======================================================
// HELPERS
// ======================================================

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem("token") || "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const token = getToken();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch data");
  }

  return data;
}

function formatDate(date?: string) {
  if (!date) {
    return "Not available";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStudentName(student: Student | null) {
  return student?.name || "Student";
}

function getAttendanceStatus(status?: string) {
  return String(status || "").toUpperCase();
}

function getInitials(name?: string) {
  if (!name) {
    return "ST";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getSafeRating(rating?: number) {
  if (typeof rating !== "number" || Number.isNaN(rating)) {
    return 0;
  }

  return Math.max(0, Math.min(5, rating));
}

function getRatingPercentage(rating?: number) {
  return (getSafeRating(rating) / 5) * 100;
}

// ======================================================
// SHARED COMPONENTS
// ======================================================

function SectionHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon: ElementType;
  action?: string;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff4e8]">
          <Icon className="h-5 w-5 text-[#f97316]" />
        </div>

        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-950 sm:text-xl">
            {title}
          </h2>

          <p className="mt-1 text-sm leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      {action && (
        <span className="hidden shrink-0 text-sm font-semibold text-[#f97316] sm:block">
          {action}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  message,
  description,
}: {
  message: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] px-4 py-9 text-center sm:px-6">
      <p className="text-sm font-semibold text-slate-600">{message}</p>

      {description && (
        <p className="mt-2 text-xs leading-5 text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string;
  description: string;
  icon: ElementType;
  iconClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e3e8f0] bg-white p-5 shadow-[0_3px_12px_rgba(15,23,42,0.025)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-2 truncate text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {value}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${iconClassName}`}
        >
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </div>
  );
}

// ======================================================
// ATTENDANCE SECTION
// ======================================================

function AttendanceSection({
  attendance,
}: {
  attendance: AttendanceRecord[];
}) {
  const recentAttendance = attendance.slice(0, 5);

  return (
    <section className="rounded-2xl border border-[#e3e8f0] bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.025)] sm:p-6">
      <SectionHeader
        title="Recent Attendance"
        description="Your latest training attendance records"
        icon={CalendarDays}
        action="Attendance"
      />

      {recentAttendance.length === 0 ? (
        <EmptyState
          message="No attendance records available yet."
          description="Your attendance will appear here after your coach marks a class."
        />
      ) : (
        <div className="space-y-3">
          {recentAttendance.map((record) => {
            const isPresent =
              getAttendanceStatus(record.status) === "PRESENT";

            return (
              <div
                key={record._id}
                className="flex flex-col gap-3 rounded-xl border border-[#e7ebf1] bg-[#fbfcfe] p-4 transition hover:border-[#d7dee9] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      isPresent
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {isPresent ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatDate(record.date)}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                      {record.planDay !== undefined && (
                        <span>Day {record.planDay}</span>
                      )}

                      {record.curriculumTitle && (
                        <>
                          <span>•</span>

                          <span className="truncate">
                            {record.curriculumTitle}
                          </span>
                        </>
                      )}
                    </div>

                    {record.remarks && (
                      <p className="mt-1 text-xs text-slate-500">
                        {record.remarks}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`self-start rounded-full px-3 py-1 text-xs font-bold sm:self-auto ${
                    isPresent
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {isPresent ? "PRESENT" : "ABSENT"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ======================================================
// PERFORMANCE SECTION
// ======================================================

function RatingStars({ rating }: { rating?: number }) {
  const safeRating = Math.round(getSafeRating(rating));

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={
            star <= safeRating ? "text-amber-400" : "text-slate-300"
          }
        >
          ★
        </span>
      ))}
    </div>
  );
}

function PerformanceSection({
  performance,
}: {
  performance: PerformanceRecord[];
}) {
  const latestPerformance = performance[0];
  const previousPerformance = performance.slice(1, 5);

  if (!latestPerformance) {
    return (
      <section className="rounded-2xl border border-[#e3e8f0] bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.025)] sm:p-6">
        <SectionHeader
          title="Performance Evaluation"
          description="Your latest skill evaluation and coach feedback"
          icon={BarChart3}
        />

        <EmptyState
          message="No performance evaluation available yet."
          description="Your coach can add an evaluation after your training session."
        />
      </section>
    );
  }

  const rating = getSafeRating(latestPerformance.rating);
  const ratingPercentage = getRatingPercentage(
    latestPerformance.rating,
  );

  return (
    <section className="rounded-2xl border border-[#e3e8f0] bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.025)] sm:p-6">
      <SectionHeader
        title="Performance Evaluation"
        description="Your latest skill evaluation and coach feedback"
        icon={BarChart3}
        action="Latest Evaluation"
      />

      <div className="space-y-5">
        {/* Latest evaluation summary */}
        <div className="rounded-2xl bg-[#101828] p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-slate-400">
                Latest Evaluation
              </p>

              <h3 className="mt-2 break-words text-xl font-bold sm:text-2xl">
                {latestPerformance.curriculumTitle ||
                  "Karate Training Evaluation"}
              </h3>

              {latestPerformance.skill && (
                <p className="mt-2 text-sm text-slate-300">
                  Skill: {latestPerformance.skill}
                </p>
              )}

              {latestPerformance.planDay !== undefined && (
                <p className="mt-1 text-sm text-slate-400">
                  Training Day: {latestPerformance.planDay}
                </p>
              )}
            </div>

            <div className="shrink-0 sm:text-right">
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Rating
              </p>

              <p className="mt-1 text-4xl font-bold">
                {rating}
                <span className="text-lg font-medium text-slate-400">
                  /5
                </span>
              </p>

              <div className="mt-2 sm:flex sm:justify-end">
                <RatingStars rating={rating} />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Performance rating
              </span>

              <span className="font-semibold text-slate-200">
                {rating}/5
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-[#f97316] transition-all"
                style={{ width: `${ratingPercentage}%` }}
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Evaluated on{" "}
            {formatDate(
              latestPerformance.evaluationDate ||
                latestPerformance.createdAt,
            )}
          </p>
        </div>

        {/* Evaluation details */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e3e8f0] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Curriculum
            </p>

            <p className="mt-2 break-words text-sm font-semibold text-slate-900">
              {latestPerformance.curriculumTitle || "Not specified"}
            </p>
          </div>

          <div className="rounded-xl border border-[#e3e8f0] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Skill Evaluated
            </p>

            <p className="mt-2 break-words text-sm font-semibold text-slate-900">
              {latestPerformance.skill || "Not specified"}
            </p>
          </div>
        </div>

        {/* Coach remarks */}
        {latestPerformance.remarks && (
          <div className="rounded-xl border border-[#e3e8f0] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Coach Remarks
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {latestPerformance.remarks}
            </p>
          </div>
        )}

        {/* Evaluated by */}
        {latestPerformance.evaluatedBy?.name && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#f97316]" />
            Evaluated by {latestPerformance.evaluatedBy.name}
          </div>
        )}

        {/* Previous evaluations */}
        {previousPerformance.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-900">
              Previous Evaluations
            </h3>

            <div className="space-y-3">
              {previousPerformance.map((record) => (
                <div
                  key={record._id}
                  className="flex flex-col gap-3 rounded-xl bg-[#f7f9fc] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {record.skill ||
                        record.curriculumTitle ||
                        "Training Evaluation"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(
                        record.evaluationDate || record.createdAt,
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <RatingStars rating={record.rating} />

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {getSafeRating(record.rating)}/5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ======================================================
// PROFILE SECTION
// ======================================================

function ProfileSection({
  student,
}: {
  student: Student | null;
}) {
  return (
    <section className="rounded-2xl border border-[#e3e8f0] bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.025)] sm:p-6">
      <SectionHeader
        title="My Profile"
        description="Your registered academy information"
        icon={UserRound}
      />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#101828] text-xl font-bold text-white">
          {getInitials(student?.name)}
        </div>

        <div className="min-w-0">
          <h3 className="break-words text-xl font-bold text-slate-950">
            {student?.name || "Not available"}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Student account
          </p>

          {student?.status && (
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                student.status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {student.status}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f9fc]">
            <Phone className="h-4 w-4 text-slate-500" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Phone
            </p>

            <p className="mt-1 break-words text-sm font-medium text-slate-800">
              {student?.phone || "Not available"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f9fc]">
            <Mail className="h-4 w-4 text-slate-500" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Email
            </p>

            <p className="mt-1 break-words text-sm font-medium text-slate-800">
              {student?.email || "Not available"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f9fc]">
            <UserRound className="h-4 w-4 text-slate-500" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Age
            </p>

            <p className="mt-1 text-sm font-medium text-slate-800">
              {student?.age ?? "Not available"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f9fc]">
            <CalendarDays className="h-4 w-4 text-slate-500" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Joining Date
            </p>

            <p className="mt-1 text-sm font-medium text-slate-800">
              {formatDate(student?.joinDate)}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f9fc]">
            <Award className="h-4 w-4 text-slate-500" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Current Belt
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              {student?.currentBelt || student?.belt || "Beginner"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f9fc]">
            <ArrowUpRight className="h-4 w-4 text-slate-500" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Branch
            </p>

            <p className="mt-1 break-words text-sm font-medium text-slate-800">
              {student?.branch?.name || "Not available"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ======================================================
// PLAN SECTION
// ======================================================

function PlanSection({
  student,
}: {
  student: Student | null;
}) {
  const plan = student?.plan;

  return (
    <section className="rounded-2xl border border-[#e3e8f0] bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.025)] sm:p-6">
      <SectionHeader
        title="Training Plan"
        description="Your currently assigned academy plan"
        icon={Award}
      />

      {!plan ? (
        <EmptyState
          message="No training plan assigned yet."
          description="Please contact your academy administrator."
        />
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#101828] p-5 text-white sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-400">Current Plan</p>

                <h3 className="mt-2 break-words text-2xl font-bold">
                  {plan.name || "Training Plan"}
                </h3>
              </div>

              <Award className="h-7 w-7 shrink-0 text-[#f97316]" />
            </div>

            {plan.price !== undefined && (
              <p className="mt-4 text-sm text-slate-300">
                ₹{plan.price}

                {plan.duration && (
                  <span>
                    {" "}
                    / {plan.duration}{" "}
                    {plan.durationUnit === "MONTHS"
                      ? "months"
                      : "days"}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e3e8f0] p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Starting Belt
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {plan.startingBelt || "Not specified"}
              </p>
            </div>

            <div className="rounded-xl border border-[#e3e8f0] p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Classes Per Week
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {plan.classesPerWeek ?? "Not specified"}
              </p>
            </div>

            <div className="rounded-xl border border-[#e3e8f0] p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Curriculum
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {plan.curriculum?.length || 0} training days
              </p>
            </div>

            <div className="rounded-xl border border-[#e3e8f0] p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Milestones
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {plan.milestones?.length || 0}
              </p>
            </div>
          </div>

          {plan.curriculum && plan.curriculum.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Curriculum Preview
                </h3>

                <span className="text-xs font-medium text-slate-400">
                  {plan.curriculum.length} days
                </span>
              </div>

              <div className="space-y-3">
                {plan.curriculum.slice(0, 4).map((item, index) => (
                  <div
                    key={`${item.day || index}-${item.title || index}`}
                    className="flex items-start gap-3 rounded-xl bg-[#f7f9fc] p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700">
                      {item.day || index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {item.title ||
                          item.skill ||
                          "Training Session"}
                      </p>

                      {item.description && (
                        <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {plan.curriculum.length > 4 && (
                <p className="mt-3 text-xs text-slate-400">
                  +{plan.curriculum.length - 4} more training days
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ======================================================
// MAIN DASHBOARD
// ======================================================

export default function StudentDashboard() {
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [performance, setPerformance] = useState<PerformanceRecord[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const [
          studentResponse,
          attendanceResponse,
          performanceResponse,
        ] = await Promise.all([
          fetchJson<{ student?: Student }>(
            `${API_URL}/students/me`,
          ),

          fetchJson<{ attendance?: AttendanceRecord[] }>(
            `${API_URL}/attendance/me`,
          ),

          fetchJson<{ performance?: PerformanceRecord[] }>(
            `${API_URL}/performance/me`,
          ),
        ]);

        setStudent(studentResponse.student || null);
        setAttendance(attendanceResponse.attendance || []);
        setPerformance(performanceResponse.performance || []);
      } catch (dashboardError) {
        console.error("Student dashboard error:", dashboardError);

        setError(
          dashboardError instanceof Error
            ? dashboardError.message
            : "Unable to load your dashboard.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const attendanceStats = useMemo(() => {
    const presentCount = attendance.filter(
      (record) =>
        getAttendanceStatus(record.status) === "PRESENT",
    ).length;

    const absentCount = attendance.filter(
      (record) =>
        getAttendanceStatus(record.status) === "ABSENT",
    ).length;

    const totalCount = attendance.length;

    const percentage =
      totalCount > 0
        ? Math.round((presentCount / totalCount) * 100)
        : 0;

    return {
      presentCount,
      absentCount,
      totalCount,
      percentage,
    };
  }, [attendance]);

  const currentBelt =
    student?.currentBelt || student?.belt || "Beginner";

  const latestPerformance = performance[0];

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f5f7fb] px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[#e3e8f0] bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[#f97316]" />
          <span>Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f5f7fb] px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>

          <p className="mt-4 font-semibold text-red-700">{error}</p>

          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-[#101828] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#f97316]"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
              <Users size={16}/>
              Student Portal
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Welcome back, {getStudentName(student)}
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Track your karate training, attendance, and performance.
            </p>
          </div>

          <div className="flex w-fit items-center gap-3 rounded-2xl border border-[#e3e8f0] bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4e8]">
              <Award className="h-5 w-5 text-[#f97316]" />
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Current Belt
              </p>

              <p className="mt-0.5 text-sm font-bold text-slate-900">
                {currentBelt}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Current Belt"
            value={currentBelt}
            description="Your current karate rank"
            icon={Award}
            iconClassName="bg-[#fff4e8] text-[#f97316]"
          />

          <StatCard
            title="Attendance"
            value={`${attendanceStats.percentage}%`}
            description={`${attendanceStats.presentCount} present out of ${attendanceStats.totalCount}`}
            icon={CalendarDays}
            iconClassName="bg-emerald-100 text-emerald-600"
          />

          <StatCard
            title="Training Sessions"
            value={attendanceStats.totalCount.toString()}
            description={`${attendanceStats.absentCount} absent`}
            icon={Clock3}
            iconClassName="bg-blue-100 text-blue-600"
          />

          <StatCard
            title="Latest Rating"
            value={
              latestPerformance
                ? `${getSafeRating(latestPerformance.rating)}/5`
                : "—"
            }
            description={
              latestPerformance
                ? "Latest performance evaluation"
                : "No evaluation available"
            }
            icon={BarChart3}
            iconClassName="bg-purple-100 text-purple-600"
          />
        </div>

        {/* Attendance and Performance */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <AttendanceSection attendance={attendance} />

          <PerformanceSection performance={performance} />
        </div>

        {/* Profile and Plan */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <ProfileSection student={student} />

          <PlanSection student={student} />
        </div>
      </div>
    </main>
  );
}
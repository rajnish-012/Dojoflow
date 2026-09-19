"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  XCircle,
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
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error("Authentication required. Please log in again.");
  }

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
  if (!date) return "Not available";

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
  if (!name) return "ST";

  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "ST"
  );
}

function getSafeRating(rating?: number) {
  if (typeof rating !== "number" || Number.isNaN(rating)) return 0;
  return Math.max(0, Math.min(5, rating));
}

function getRatingPercentage(rating?: number) {
  return (getSafeRating(rating) / 5) * 100;
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
    <Card padding="md">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
            <CalendarDays size={19} />
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-(--foreground)">
              Recent Attendance
            </h2>

            <p className="mt-1 text-sm text-(--ink-muted)">
              Your latest training attendance records
            </p>
          </div>
        </div>

        <Badge variant="neutral">Latest 5</Badge>
      </div>

      {recentAttendance.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={25} />}
          title="No attendance records yet"
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
                className="
                  flex
                  flex-col
                  gap-3
                  rounded-xl
                  border
                  border-(--line)
                  bg-(--surface)
                  p-4
                  transition-all
                  duration-200
                  hover:-translate-y-0.5
                "
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={[
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        isPresent
                          ? "bg-(--green-soft) text-(--green)"
                          : "bg-(--danger-soft) text-(--danger)",
                      ].join(" ")}
                    >
                      {isPresent ? (
                        <CheckCircle2 size={19} />
                      ) : (
                        <XCircle size={19} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-(--foreground)">
                        {formatDate(record.date)}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-(--ink-muted)">
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
                    </div>
                  </div>

                  <Badge variant={isPresent ? "success" : "danger"}>
                    {isPresent ? "Present" : "Absent"}
                  </Badge>
                </div>

                {record.remarks && (
                  <p className="border-t border-(--line) pt-3 text-xs leading-5 text-(--ink-muted)">
                    {record.remarks}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ======================================================
// PERFORMANCE SECTION
// ======================================================

function RatingStars({ rating }: { rating?: number }) {
  const safeRating = Math.round(getSafeRating(rating));

  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating ${safeRating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={
            star <= safeRating
              ? "text-(--gold)"
              : "text-(--ink-faint)"
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

  return (
    <Card padding="md">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
            <BarChart3 size={19} />
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-(--foreground)">
              Performance Evaluation
            </h2>

            <p className="mt-1 text-sm text-(--ink-muted)">
              Your latest skill evaluation and coach feedback
            </p>
          </div>
        </div>

        {latestPerformance && (
          <Badge variant="neutral">Latest</Badge>
        )}
      </div>

      {!latestPerformance ? (
        <EmptyState
          icon={<BarChart3 size={25} />}
          title="No performance evaluation yet"
          description="Your coach can add an evaluation after your training session."
        />
      ) : (
        <div className="space-y-5">
          <div
            className="
              overflow-hidden
              rounded-2xl
              border
              border-(--dark-card-border)
              bg-(--dark-card)
              p-5
              text-white
              sm:p-6
            "
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--dark-muted)">
                  Latest Evaluation
                </p>

                <h3 className="mt-2 break-words text-xl font-extrabold sm:text-2xl">
                  {latestPerformance.curriculumTitle ||
                    "Karate Training Evaluation"}
                </h3>

                {latestPerformance.skill && (
                  <p className="mt-2 text-sm text-(--dark-text)">
                    Skill: {latestPerformance.skill}
                  </p>
                )}

                {latestPerformance.planDay !== undefined && (
                  <p className="mt-1 text-sm text-(--dark-muted)">
                    Training Day: {latestPerformance.planDay}
                  </p>
                )}
              </div>

              <div className="shrink-0 sm:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--dark-muted)">
                  Rating
                </p>

                <p className="mt-1 text-4xl font-extrabold">
                  {getSafeRating(latestPerformance.rating)}
                  <span className="text-lg font-medium text-(--dark-muted)">
                    /5
                  </span>
                </p>

                <div className="mt-2 sm:flex sm:justify-end">
                  <RatingStars rating={latestPerformance.rating} />
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-(--dark-muted)">
                  Performance rating
                </span>

                <span className="font-semibold text-(--dark-text)">
                  {getSafeRating(latestPerformance.rating)}/5
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-(--dark-track)">
                <div
                  className="h-full rounded-full bg-(--gold) transition-all duration-500"
                  style={{
                    width: `${getRatingPercentage(
                      latestPerformance.rating,
                    )}%`,
                  }}
                />
              </div>
            </div>

            <p className="mt-4 text-xs text-(--dark-muted)">
              Evaluated on{" "}
              {formatDate(
                latestPerformance.evaluationDate ||
                  latestPerformance.createdAt,
              )}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox
              label="Curriculum"
              value={
                latestPerformance.curriculumTitle || "Not specified"
              }
            />

            <InfoBox
              label="Skill Evaluated"
              value={latestPerformance.skill || "Not specified"}
            />
          </div>

          {latestPerformance.remarks && (
            <InfoBox
              label="Coach Remarks"
              value={latestPerformance.remarks}
              multiline
            />
          )}

          {latestPerformance.evaluatedBy?.name && (
            <div className="flex items-center gap-2 text-xs font-medium text-(--ink-muted)">
              <ShieldCheck size={16} className="text-(--accent)" />
              Evaluated by {latestPerformance.evaluatedBy.name}
            </div>
          )}

          {previousPerformance.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-extrabold text-(--foreground)">
                Previous Evaluations
              </h3>

              <div className="space-y-2.5">
                {previousPerformance.map((record) => (
                  <div
                    key={record._id}
                    className="
                      flex
                      flex-col
                      gap-3
                      rounded-xl
                      border
                      border-(--line)
                      bg-(--surface)
                      p-4
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                    "
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-(--foreground)">
                        {record.skill ||
                          record.curriculumTitle ||
                          "Training Evaluation"}
                      </p>

                      <p className="mt-1 text-xs text-(--ink-muted)">
                        {formatDate(
                          record.evaluationDate || record.createdAt,
                        )}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <RatingStars rating={record.rating} />

                      <Badge variant="neutral">
                        {getSafeRating(record.rating)}/5
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
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
    <Card padding="md">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
          <UserRound size={19} />
        </div>

        <div>
          <h2 className="text-lg font-extrabold text-(--foreground)">
            My Profile
          </h2>

          <p className="mt-1 text-sm text-(--ink-muted)">
            Your registered academy information
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-(--dark-card) text-xl font-extrabold text-white">
          {getInitials(student?.name)}
        </div>

        <div className="min-w-0">
          <h3 className="break-words text-xl font-extrabold text-(--foreground)">
            {student?.name || "Not available"}
          </h3>

          <p className="mt-1 text-sm text-(--ink-muted)">
            Student account
          </p>

          {student?.status && (
            <div className="mt-3">
              <Badge
                variant={
                  String(student.status).toUpperCase() === "ACTIVE"
                    ? "success"
                    : "neutral"
                }
              >
                {student.status}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ProfileInfo
          icon={<Phone size={16} />}
          label="Phone"
          value={student?.phone || "Not available"}
        />

        <ProfileInfo
          icon={<Mail size={16} />}
          label="Email"
          value={student?.email || "Not available"}
        />

        <ProfileInfo
          icon={<UserRound size={16} />}
          label="Age"
          value={student?.age ?? "Not available"}
        />

        <ProfileInfo
          icon={<CalendarDays size={16} />}
          label="Joining Date"
          value={formatDate(student?.joinDate)}
        />

        <ProfileInfo
          icon={<Award size={16} />}
          label="Current Belt"
          value={student?.currentBelt || student?.belt || "Beginner"}
        />

        <ProfileInfo
          icon={<ArrowUpRight size={16} />}
          label="Branch"
          value={student?.branch?.name || "Not available"}
        />
      </div>
    </Card>
  );
}

function ProfileInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-(--line) p-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--surface) text-(--ink-muted)">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-semibold text-(--foreground)">
          {value}
        </p>
      </div>
    </div>
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
    <Card padding="md">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
          <Award size={19} />
        </div>

        <div>
          <h2 className="text-lg font-extrabold text-(--foreground)">
            Training Plan
          </h2>

          <p className="mt-1 text-sm text-(--ink-muted)">
            Your currently assigned academy plan
          </p>
        </div>
      </div>

      {!plan ? (
        <EmptyState
          icon={<Award size={25} />}
          title="No training plan assigned"
          description="Please contact your academy administrator."
        />
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-(--dark-card) p-5 text-white sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--dark-muted)">
                  Current Plan
                </p>

                <h3 className="mt-2 break-words text-2xl font-extrabold">
                  {plan.name || "Training Plan"}
                </h3>
              </div>

              <Award
                size={27}
                className="shrink-0 text-(--gold)"
              />
            </div>

            {plan.price !== undefined && (
              <p className="mt-4 text-sm text-(--dark-text)">
                ₹{plan.price}

                {plan.duration && (
                  <span>
                    {" "}
                    / {plan.duration}{" "}
                    {String(plan.durationUnit).toUpperCase() ===
                    "MONTHS"
                      ? "months"
                      : "days"}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox
              label="Starting Belt"
              value={plan.startingBelt || "Not specified"}
            />

            <InfoBox
              label="Classes Per Week"
              value={plan.classesPerWeek ?? "Not specified"}
            />

            <InfoBox
              label="Curriculum"
              value={`${plan.curriculum?.length || 0} training days`}
            />

            <InfoBox
              label="Milestones"
              value={`${plan.milestones?.length || 0}`}
            />
          </div>

          {plan.curriculum && plan.curriculum.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-extrabold text-(--foreground)">
                  Curriculum Preview
                </h3>

                <span className="text-xs font-medium text-(--ink-faint)">
                  {plan.curriculum.length} days
                </span>
              </div>

              <div className="space-y-2.5">
                {plan.curriculum.slice(0, 4).map((item, index) => (
                  <div
                    key={`${item.day || index}-${item.title || index}`}
                    className="flex items-start gap-3 rounded-xl border border-(--line) bg-(--surface) p-3.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--card) text-xs font-extrabold text-(--foreground)">
                      {item.day || index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-(--foreground)">
                        {item.title ||
                          item.skill ||
                          "Training Session"}
                      </p>

                      {item.description && (
                        <p className="mt-1 break-words text-xs leading-5 text-(--ink-muted)">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {plan.curriculum.length > 4 && (
                <p className="mt-3 text-xs font-medium text-(--ink-faint)">
                  +{plan.curriculum.length - 4} more training days
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function InfoBox({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | number;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-xl border border-(--line) p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
        {label}
      </p>

      <p
        className={[
          "mt-2 break-words text-sm font-semibold text-(--foreground)",
          multiline ? "leading-6 font-medium" : "",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

// ======================================================
// MAIN STUDENT DASHBOARD
// ======================================================

export default function StudentDashboard() {
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(
    [],
  );
  const [performance, setPerformance] = useState<PerformanceRecord[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

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

      const message =
        dashboardError instanceof Error
          ? dashboardError.message
          : "Unable to load your dashboard.";

      if (
        message.toLowerCase().includes("authentication") ||
        message.toLowerCase().includes("unauthorized") ||
        message.toLowerCase().includes("token")
      ) {
        window.location.href = "/login";
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
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
      <div className="min-h-[70vh] bg-(--background) px-4 py-8 text-(--foreground) transition-colors duration-300 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[480px] max-w-[1440px] items-center justify-center">
          <LoadingSpinner text="Loading your dashboard..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] bg-(--background) px-4 py-8 text-(--foreground) transition-colors duration-300 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[480px] max-w-[1440px] items-center justify-center">
          <div className="w-full max-w-lg">
            <ErrorState
              title="Unable to load your dashboard"
              message={error}
              action={
                <Button
                  variant="primary"
                  onClick={() => void loadDashboard(true)}
                  loading={refreshing}
                >
                  <RefreshCw size={17} />
                  Try again
                </Button>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        min-h-screen
        bg-(--background)
        px-4
        py-6
        text-(--foreground)
        transition-colors
        duration-300
        sm:px-6
        lg:px-8
      "
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <PageHeader
          eyebrow="Student Portal"
          title={`Welcome back, ${getStudentName(student)}`}
          description="Track your karate training, attendance, and performance."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </Button>

              <div
                className="
                  flex
                  items-center
                  gap-3
                  rounded-xl
                  border
                  border-(--line)
                  bg-(--card)
                  px-3
                  py-2.5
                  shadow-[0_4px_18px_var(--shadow-color)]
                "
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--accent-soft) text-(--accent)">
                  <Award size={18} />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                    Current Belt
                  </p>

                  <p className="mt-0.5 text-sm font-extrabold text-(--foreground)">
                    {currentBelt}
                  </p>
                </div>
              </div>
            </div>
          }
        />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Current Belt"
            value={currentBelt}
            subtitle="Your current karate rank"
            icon={<Award size={20} />}
          />

          <SummaryCard
            title="Attendance"
            value={`${attendanceStats.percentage}%`}
            subtitle={`${attendanceStats.presentCount} present out of ${attendanceStats.totalCount}`}
            icon={<CalendarDays size={20} />}
          />

          <SummaryCard
            title="Training Sessions"
            value={attendanceStats.totalCount}
            subtitle={`${attendanceStats.absentCount} absent`}
            icon={<Clock3 size={20} />}
          />

          <SummaryCard
            title="Latest Rating"
            value={
              latestPerformance
                ? `${getSafeRating(latestPerformance.rating)}/5`
                : "—"
            }
            subtitle={
              latestPerformance
                ? "Latest performance evaluation"
                : "No evaluation available"
            }
            icon={<BarChart3 size={20} />}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AttendanceSection attendance={attendance} />
          <PerformanceSection performance={performance} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <ProfileSection student={student} />
          <PlanSection student={student} />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-(--line) pt-4">
          <p className="text-xs font-medium text-(--ink-faint)">
            DojoFlow Student Portal
          </p>

          <p className="text-xs text-(--ink-faint)">
            Training progress at a glance
          </p>
        </div>
      </div>
    </div>
  );
}

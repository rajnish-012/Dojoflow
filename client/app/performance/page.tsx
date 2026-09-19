"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Award,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  Search,
  Star,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  PageHeader,
  Select,
  SummaryCard,
} from "@/components/ui";

import {
  getPlans,
  getStudentAttendance,
  getStudents,
} from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

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
  };
};

type CurriculumItem = {
  day: number;
  title: string;
  description?: string;
  skill?: string;
};

type Plan = {
  _id: string;
  name: string;
  curriculum?: CurriculumItem[];
};

type PerformanceRecord = {
  _id: string;
  student?: {
    _id: string;
    name: string;
  };
  planDay: number;
  curriculumTitle: string;
  skill: string;
  rating: number;
  remarks?: string;
  evaluationDate?: string;
};

type AttendanceRecord = {
  planDay: number;
  status: "PRESENT" | "ABSENT";
};

export default function PerformancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<
    AttendanceRecord[]
  >([]);

  const [selectedStudent, setSelectedStudent] =
    useState("");
  const [selectedDay, setSelectedDay] = useState(1);
  const [rating, setRating] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingAttendance, setLoadingAttendance] =
    useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  // Fetch the selected student's attendance history so we can
  // gate evaluation to days they were actually marked present.
  useEffect(() => {
    if (!selectedStudent) {
      setStudentAttendance([]);
      return;
    }

    let cancelled = false;

    async function loadStudentAttendance(
      studentId: string,
    ) {
      try {
        setLoadingAttendance(true);

        const data = await getStudentAttendance(
          studentId,
        );

        const history: AttendanceRecord[] =
          Array.isArray(data?.attendance)
            ? data.attendance
            : [];

        if (!cancelled) {
          setStudentAttendance(history);
        }
      } catch (attendanceError) {
        console.error(
          "Failed to load student's attendance history:",
          attendanceError,
        );

        if (!cancelled) {
          setStudentAttendance([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingAttendance(false);
        }
      }
    }

    void loadStudentAttendance(selectedStudent);

    return () => {
      cancelled = true;
    };
  }, [selectedStudent]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [studentData, planData] =
        await Promise.all([
          getStudents(),
          getPlans(),
        ]);

      setStudents(
        Array.isArray(studentData?.students)
          ? studentData.students
          : [],
      );

      setPlans(
        Array.isArray(planData?.plans)
          ? planData.plans
          : [],
      );

      await loadPerformance();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load performance data.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPerformance() {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch(
      `${API_URL}/performance`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    if (response.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to load performance.",
      );
    }

    setRecords(
      Array.isArray(data.performance)
        ? data.performance
        : [],
    );
  }

  const activeStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          student.status !== "INACTIVE" &&
          student.status !== "COMPLETED",
      ),
    [students],
  );

  const selectedStudentData = useMemo(
    () =>
      students.find(
        (student) =>
          student._id === selectedStudent,
      ) ?? null,
    [students, selectedStudent],
  );

  const selectedCurriculum = useMemo(() => {
    if (!selectedStudentData) return null;

    const planId =
      selectedStudentData.plan?._id;

    if (!planId) return null;

    const plan = plans.find(
      (item) => item._id === planId,
    );

    return (
      plan?.curriculum?.find(
        (item) => item.day === selectedDay,
      ) ?? null
    );
  }, [
    selectedStudentData,
    plans,
    selectedDay,
  ]);

  const selectedDayAttendance = useMemo(
    () =>
      studentAttendance.find(
        (record) => record.planDay === selectedDay,
      ) ?? null,
    [studentAttendance, selectedDay],
  );

  const canEvaluateSelectedDay =
    selectedDayAttendance?.status === "PRESENT";

  const filteredRecords = useMemo(() => {
    const searchText = search
      .toLowerCase()
      .trim();

    return records.filter((record) => {
      if (
        selectedStudent &&
        record.student?._id !== selectedStudent
      ) {
        return false;
      }

      if (
        !selectedStudent &&
        searchText &&
        !record.student?.name
          ?.toLowerCase()
          .includes(searchText)
      ) {
        return false;
      }

      return true;
    });
  }, [
    records,
    selectedStudent,
    search,
  ]);

  const averageRating = useMemo(() => {
    if (!filteredRecords.length) return "—";

    const total = filteredRecords.reduce(
      (sum, record) =>
        sum + Number(record.rating || 0),
      0,
    );

    return `${(
      total / filteredRecords.length
    ).toFixed(1)}/5`;
  }, [filteredRecords]);

  const excellentRecords =
    filteredRecords.filter(
      (record) => Number(record.rating) >= 4,
    ).length;

  const needsAttentionRecords =
    filteredRecords.filter(
      (record) => Number(record.rating) <= 2,
    ).length;

  function getNextTrainingDayForStudent(
    studentId: string,
  ) {
    const studentRecords = records.filter(
      (record) => record.student?._id === studentId,
    );

    if (!studentRecords.length) return 1;

    const highestDay = studentRecords.reduce(
      (max, record) =>
        Math.max(max, Number(record.planDay) || 0),
      0,
    );

    return highestDay + 1;
  }

  function handleStudentChange(
    value: string,
  ) {
    setSelectedStudent(value);
    setSelectedDay(
      value
        ? getNextTrainingDayForStudent(value)
        : 1,
    );
    setRating(0);
    setRemarks("");
    setSuccess("");
    setError("");
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedStudent) {
      setError("Please select a student.");
      return;
    }

    if (!selectedCurriculum) {
      setError(
        `No curriculum found for Day ${selectedDay} for this student's plan.`,
      );
      return;
    }

    if (loadingAttendance) {
      setError(
        "Still checking this student's attendance — please wait a moment.",
      );
      return;
    }

    if (!canEvaluateSelectedDay) {
      setError(
        selectedDayAttendance
          ? `${selectedStudentData?.name ?? "This student"} was marked absent for Day ${selectedDay} and cannot be evaluated for that day.`
          : `Attendance has not been marked for Day ${selectedDay} yet. Mark attendance before submitting an evaluation.`,
      );
      return;
    }

    if (rating < 1 || rating > 5) {
      setError(
        "Please select a rating from 1 to 5.",
      );
      return;
    }

    const token =
      localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `${API_URL}/performance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            student: selectedStudent,
            planDay: selectedDay,
            curriculumTitle:
              selectedCurriculum.title,
            skill:
              selectedCurriculum.skill ||
              selectedCurriculum.title,
            rating,
            remarks: remarks.trim(),
            evaluationDate:
              new Date().toLocaleDateString(
                "en-CA",
              ),
          }),
        },
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to submit performance.",
        );
      }

      setSuccess(
        `Performance evaluation submitted for ${selectedStudentData?.name ?? "student"}.`,
      );

      setRating(0);
      setRemarks("");
      setSelectedDay(
        (currentDay) => currentDay + 1,
      );

      await loadPerformance();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit performance evaluation.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderStars(
    currentRating: number,
    interactive = false,
  ) {
    return (
      <div
        className="flex items-center gap-0.5"
        aria-label={
          !interactive
            ? `${currentRating} out of 5 stars`
            : undefined
        }
      >
        {[1, 2, 3, 4, 5].map(
          (star) => (
            <button
              key={star}
              type={
                interactive
                  ? "button"
                  : undefined
              }
              onClick={
                interactive
                  ? () => setRating(star)
                  : undefined
              }
              disabled={!interactive}
              className={[
                interactive
                  ? "rounded-lg p-1 transition hover:bg-(--hover-bg)"
                  : "cursor-default p-0.5",
                "disabled:opacity-100",
              ].join(" ")}
              aria-label={
                interactive
                  ? `Rate ${star} out of 5`
                  : undefined
              }
            >
              <Star
                size={
                  interactive ? 21 : 17
                }
                fill={
                  star <= currentRating
                    ? "currentColor"
                    : "none"
                }
                className={
                  star <= currentRating
                    ? "text-(--gold)"
                    : "text-(--line-strong)"
                }
              />
            </button>
          ),
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="df-page">
        <Card className="min-h-[360px]">
          <LoadingSpinner
            size="lg"
            text="Loading performance data..."
            fullPage
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="df-page">
      <PageHeader
        eyebrow="Academy Management"
        title="Performance"
        description="Evaluate student skills and track training performance."
        actions={
          <div className="flex items-center gap-2 rounded-2xl border border-(--line) bg-(--card) px-4 py-3 shadow-[0_8px_28px_var(--shadow-color)]">
            <Award
              size={18}
              className="text-(--gold)"
            />
            <span className="text-sm font-bold text-(--foreground)">
              {records.length} total evaluations
            </span>
          </div>
        }
      />

      {(error || success) && (
        <div className="space-y-3">
          {error && (
            <ErrorState
              title="Performance action failed"
              message={error}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setError("")
                  }
                >
                  <X size={15} />
                  Dismiss
                </Button>
              }
            />
          )}

          {success && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-(--green-soft) bg-(--green-soft) px-4 py-3 text-sm font-semibold text-(--green)">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={17} />
                {success}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSuccess("")}
              >
                <X size={15} />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Evaluations"
          value={filteredRecords.length}
          subtitle="Evaluations shown"
          icon={<ChartNoAxesCombined size={19} />}
        />

        <SummaryCard
          title="Average Rating"
          value={averageRating}
          subtitle="Average performance rating"
          icon={<Star size={19} />}
        />

        <SummaryCard
          title="Strong Evaluations"
          value={excellentRecords}
          subtitle="Ratings from 4 to 5"
          icon={<CheckCircle2 size={19} />}
        />

        <SummaryCard
          title="Needs Attention"
          value={needsAttentionRecords}
          subtitle="Ratings from 1 to 2"
          icon={<Users size={19} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-(--line) px-6 py-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-(--accent) text-(--background)">
              <Award size={21} />
            </div>

            <h2 className="text-xl font-extrabold tracking-tight text-(--foreground)">
              New Evaluation
            </h2>

            <p className="mt-2 text-sm leading-6 text-(--ink-muted)">
              Record a student's performance for
              a training day.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 px-6 py-6"
          >
            <Field label="Student" required>
              <Select
                value={selectedStudent}
                onChange={(event) =>
                  handleStudentChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select student
                </option>

                {activeStudents.map(
                  (student) => (
                    <option
                      key={student._id}
                      value={student._id}
                    >
                      {student.name}
                    </option>
                  ),
                )}
              </Select>
            </Field>

            <Field label="Training Day" required>
              <Select
                value={selectedDay}
                onChange={(event) => {
                  setSelectedDay(
                    Number(
                      event.target.value,
                    ),
                  );
                  setRating(0);
                  setRemarks("");
                  setSuccess("");
                  setError("");
                }}
              >
                {Array.from(
                  { length: 100 },
                  (_, index) => (
                    <option
                      key={index + 1}
                      value={index + 1}
                    >
                      Day {index + 1}
                    </option>
                  ),
                )}
              </Select>
            </Field>

            <div className="rounded-2xl border border-(--line) bg-(--surface) p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-(--card) p-2 text-(--gold) shadow-sm">
                  <CalendarDays size={18} />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-(--ink-faint)">
                    Curriculum
                  </p>

                  <p className="mt-1 text-sm font-extrabold text-(--foreground)">
                    {selectedCurriculum?.title ||
                      (selectedStudent
                        ? "No curriculum for this day"
                        : "Select a student")}
                  </p>

                  {selectedCurriculum?.description && (
                    <p className="mt-1.5 text-xs leading-5 text-(--ink-muted)">
                      {selectedCurriculum.description}
                    </p>
                  )}

                  {selectedCurriculum?.skill && (
                    <Badge
                      variant="default"
                      className="mt-2"
                    >
                      {selectedCurriculum.skill}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {selectedStudent &&
              !loadingAttendance &&
              !canEvaluateSelectedDay && (
                <div className="flex items-start gap-3 rounded-2xl border border-(--danger)/25 bg-(--danger-soft) p-4">
                  <AlertCircle
                    size={17}
                    className="mt-0.5 shrink-0 text-(--danger)"
                  />
                  <p className="text-sm font-medium text-(--danger)">
                    {selectedDayAttendance
                      ? `${selectedStudentData?.name ?? "This student"} was marked absent for Day ${selectedDay}. Only students present for a day can be evaluated.`
                      : `Attendance for Day ${selectedDay} hasn't been marked yet. Mark attendance first before evaluating this day.`}
                  </p>
                </div>
              )}

            <Field label="Rating" required>
              <div className="flex items-center gap-3 rounded-2xl border border-(--line) bg-(--surface) px-3 py-2">
                {renderStars(
                  rating,
                  true,
                )}

                <span className="border-l border-(--line) pl-3 text-sm font-semibold text-(--ink-muted)">
                  {rating === 0
                    ? "Not rated"
                    : `${rating} / 5`}
                </span>
              </div>
            </Field>

            <Field label="Remarks">
              <textarea
                value={remarks}
                onChange={(event) =>
                  setRemarks(
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="Add feedback about the student's performance..."
                className="df-field min-h-28 w-full resize-none"
              />
            </Field>

            <Button
              type="submit"
              variant="secondary"
              size="lg"
              loading={saving}
              disabled={
                Boolean(selectedStudent) &&
                (loadingAttendance ||
                  !canEvaluateSelectedDay)
              }
              className="w-full"
            >
              <Award size={17} />
              Submit Evaluation
            </Button>
          </form>
        </Card>

        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col justify-between gap-4 border-b border-(--line) px-6 py-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-(--foreground)">
                Performance History
              </h2>

              <p className="mt-1.5 text-sm text-(--ink-muted)">
                {selectedStudent
                  ? "Evaluations for the selected student."
                  : "Recent student evaluations."}
              </p>
            </div>

            <div className="relative w-full md:w-64">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--ink-faint)"
              />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search students..."
                className="pl-10"
                aria-label="Search performance records"
              />
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {filteredRecords.length === 0 ? (
              <EmptyState
                title="No evaluations found"
                description={
                  selectedStudent
                    ? "This student has no performance evaluations yet."
                    : search
                      ? "No performance records match your search."
                      : "Submit an evaluation to see it here."
                }
                icon={<Award size={23} />}
              />
            ) : (
              <div className="space-y-3">
                {filteredRecords.map(
                  (record) => (
                    <PerformanceRecordCard
                      key={record._id}
                      record={record}
                      renderStars={renderStars}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PerformanceRecordCard({
  record,
  renderStars,
}: {
  record: PerformanceRecord;
  renderStars: (
    rating: number,
    interactive?: boolean,
  ) => ReactNode;
}) {
  const ratingValue = Number(
    record.rating || 0,
  );

  return (
    <div className="rounded-2xl border border-(--line) bg-(--card) p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-(--gold) hover:shadow-[0_12px_32px_var(--shadow-color)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--blue-soft) text-(--blue)">
            <UserRound size={19} />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-extrabold text-(--foreground)">
              {record.student?.name ||
                "Unknown Student"}
            </h3>

            <p className="mt-1 text-xs text-(--ink-muted)">
              Day {record.planDay ?? "—"}
              <span className="mx-2 text-(--ink-faint)">
                •
              </span>
              {record.curriculumTitle ||
                "Curriculum not specified"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1 md:items-end">
          {renderStars(ratingValue)}

          <span className="text-xs font-bold text-(--ink-muted)">
            {ratingValue}/5
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {record.skill && (
          <Badge variant="default">
            {record.skill}
          </Badge>
        )}

        {record.evaluationDate && (
          <span className="rounded-full border border-(--line) bg-(--surface) px-3 py-1 text-[10px] font-semibold text-(--ink-muted)">
            {formatDate(
              record.evaluationDate,
            )}
          </span>
        )}
      </div>

      {record.remarks && (
        <div className="mt-4 rounded-xl border border-(--line) bg-(--surface) p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-(--ink-faint)">
            Coach Remarks
          </p>

          <p className="mt-1.5 text-sm leading-6 text-(--foreground-soft)">
            {record.remarks}
          </p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-extrabold text-(--foreground-soft)">
        {label}
        {required && (
          <span className="ml-1 text-(--danger)">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function formatDate(date?: string) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}
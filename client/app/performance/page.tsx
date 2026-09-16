"use client";

import { useEffect, useMemo, useState } from "react";
import {
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

import { getStudents, getPlans } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

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
  curriculum: CurriculumItem[];
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

export default function PerformancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);

  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedDay, setSelectedDay] = useState(1);
  const [rating, setRating] = useState(0);
  const [remarks, setRemarks] = useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [studentData, planData] = await Promise.all([
        getStudents(),
        getPlans(),
      ]);

      setStudents(studentData.students || []);
      setPlans(planData.plans || []);

      await loadPerformance();
    } catch (err: any) {
      setError(err.message || "Failed to load performance data");
    } finally {
      setLoading(false);
    }
  }

  async function loadPerformance() {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/performance`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load performance");
    }

    setRecords(data.performance || []);
  }

  const selectedStudentData = useMemo(() => {
    return students.find(
      (student) => student._id === selectedStudent,
    );
  }, [students, selectedStudent]);

  const selectedCurriculum = useMemo(() => {
    if (!selectedStudentData) return null;

    const planId =
      typeof selectedStudentData.plan === "object"
        ? selectedStudentData.plan?._id
        : "";

    const plan = plans.find((item) => item._id === planId);

    if (!plan) return null;

    return (
      plan.curriculum?.find(
        (item) => item.day === selectedDay,
      ) || null
    );
  }, [selectedStudentData, plans, selectedDay]);

  const filteredRecords = useMemo(() => {
    const searchText = search.toLowerCase().trim();

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
  }, [records, selectedStudent, search]);

  const averageRating = useMemo(() => {
    if (filteredRecords.length === 0) return "0.0";

    const total = filteredRecords.reduce(
      (sum, record) => sum + record.rating,
      0,
    );

    return (total / filteredRecords.length).toFixed(1);
  }, [filteredRecords]);

  const excellentRecords = filteredRecords.filter(
    (record) => record.rating >= 4,
  ).length;

  const needsAttentionRecords = filteredRecords.filter(
    (record) => record.rating <= 2,
  ).length;

  function handleStudentChange(value: string) {
    setSelectedStudent(value);
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

    if (rating < 1 || rating > 5) {
      setError("Please select a rating from 1 to 5.");
      return;
    }

    try {
      setSaving(true);

      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/performance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student: selectedStudent,
          planDay: selectedDay,
          curriculumTitle: selectedCurriculum.title,
          skill:
            selectedCurriculum.skill ||
            selectedCurriculum.title,
          rating,
          remarks: remarks.trim(),
          evaluationDate: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to submit performance",
        );
      }

      setSuccess(
        `Performance evaluation submitted for ${selectedStudentData?.name}.`,
      );

      setRating(0);
      setRemarks("");

      await loadPerformance();
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to submit performance evaluation",
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
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? "button" : undefined}
            onClick={
              interactive
                ? () => setRating(star)
                : undefined
            }
            className={
              interactive
                ? "rounded-md p-1 transition hover:bg-[#f1f4f8]"
                : "p-0.5"
            }
            aria-label={
              interactive
                ? `Rate ${star} out of 5`
                : undefined
            }
          >
            <Star
              size={interactive ? 22 : 17}
              fill={
                star <= currentRating
                  ? "currentColor"
                  : "none"
              }
              className={
                star <= currentRating
                  ? "text-[#d99a22]"
                  : "text-[#d7dee8]"
              }
            />
          </button>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb]">
        <div className="flex items-center gap-3 text-sm text-[#697386]">
          <Clock3
            size={18}
            className="animate-spin text-[#ff4d00]"
          />
          Loading performance data...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* =====================================================
            PAGE HEADER
        ====================================================== */}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
              <ChartNoAxesCombined size={16} />
              Academy Management
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Performance
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Evaluate student skills and track training
              performance.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-[#e1e7ef] bg-white px-4 py-3 text-sm font-semibold text-[#697386] shadow-sm lg:self-auto">
            <Award
              size={18}
              className="text-[#b67b1d]"
            />
            <span>
              {records.length} total evaluations
            </span>
          </div>
        </div>

        {/* =====================================================
            ALERT MESSAGES
        ====================================================== */}
        {error && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-md p-1 transition hover:bg-red-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={17} />
              <span>{success}</span>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="rounded-md p-1 transition hover:bg-emerald-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* =====================================================
            SUMMARY CARDS
        ====================================================== */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Evaluations"
            value={filteredRecords.length}
            description="Evaluations shown"
            icon={ChartNoAxesCombined}
            iconClass="bg-[#edf3ff] text-[#4774c8]"
            label="All records"
          />

          <SummaryCard
            title="Average Rating"
            value={averageRating}
            suffix="/ 5"
            description="Average performance rating"
            icon={Star}
            iconClass="bg-[#fff6e8] text-[#c78316]"
            label="Average"
          />

          <SummaryCard
            title="Strong Evaluations"
            value={excellentRecords}
            description="Ratings from 4 to 5"
            icon={CheckCircle2}
            iconClass="bg-[#edf9f2] text-[#29945d]"
            label="Rating 4–5"
          />

          <SummaryCard
            title="Needs Attention"
            value={needsAttentionRecords}
            description="Ratings from 1 to 2"
            icon={Users}
            iconClass="bg-[#f3edff] text-[#8055c9]"
            label="Rating 1–2"
          />
        </div>

        {/* =====================================================
            MAIN CONTENT
        ====================================================== */}
        <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
          {/* =================================================
              EVALUATION FORM
          ================================================== */}
          <section className="rounded-2xl border border-[#e4e9f0] bg-white shadow-[0_4px_18px_rgba(16,26,51,0.035)]">
            <div className="border-b border-[#edf0f4] px-6 py-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#101a33] text-white">
                <Award size={21} />
              </div>

              <h2 className="text-xl font-bold tracking-tight text-[#071126]">
                New Evaluation
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#697386]">
                Record a student's performance for a
                training day.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 px-6 py-6"
            >
              {/* Student */}
              <div>
                <label className="mb-2 block text-sm font-bold text-[#34445d]">
                  Student
                </label>

                <select
                  value={selectedStudent}
                  onChange={(event) =>
                    handleStudentChange(event.target.value)
                  }
                  className="h-12 w-full rounded-xl border border-[#e1e7ef] bg-[#fafbfd] px-4 text-sm text-[#34445d] outline-none transition focus:border-[#d9a63d] focus:bg-white focus:ring-4 focus:ring-[#d9a63d]/10"
                >
                  <option value="">
                    Select student
                  </option>

                  {students
                    .filter(
                      (student) =>
                        student.status !== "INACTIVE" &&
                        student.status !== "COMPLETED",
                    )
                    .map((student) => (
                      <option
                        key={student._id}
                        value={student._id}
                      >
                        {student.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Training Day */}
              <div>
                <label className="mb-2 block text-sm font-bold text-[#34445d]">
                  Training Day
                </label>

                <select
                  value={selectedDay}
                  onChange={(event) => {
                    setSelectedDay(
                      Number(event.target.value),
                    );
                    setRating(0);
                    setRemarks("");
                    setSuccess("");
                    setError("");
                  }}
                  className="h-12 w-full rounded-xl border border-[#e1e7ef] bg-[#fafbfd] px-4 text-sm text-[#34445d] outline-none transition focus:border-[#d9a63d] focus:bg-white focus:ring-4 focus:ring-[#d9a63d]/10"
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
                </select>
              </div>

              {/* Curriculum Preview */}
              <div className="rounded-xl border border-[#e4e9f0] bg-[#fafbfd] p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white p-2 text-[#b67b1d] shadow-sm">
                    <CalendarDays size={18} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#9aa5b5]">
                      Curriculum
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#101a33]">
                      {selectedCurriculum?.title ||
                        "Select a student"}
                    </p>

                    {selectedCurriculum?.description && (
                      <p className="mt-1.5 text-xs leading-5 text-[#697386]">
                        {selectedCurriculum.description}
                      </p>
                    )}

                    {selectedCurriculum?.skill && (
                      <p className="mt-2 text-xs font-semibold text-[#697386]">
                        Skill: {selectedCurriculum.skill}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div>
                <label className="mb-2 block text-sm font-bold text-[#34445d]">
                  Rating
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-[#e1e7ef] bg-[#fafbfd] px-3 py-2">
                  {renderStars(rating, true)}

                  <span className="border-l border-[#e1e7ef] pl-3 text-sm font-medium text-[#697386]">
                    {rating === 0
                      ? "Not rated"
                      : `${rating} / 5`}
                  </span>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="mb-2 block text-sm font-bold text-[#34445d]">
                  Remarks
                </label>

                <textarea
                  value={remarks}
                  onChange={(event) =>
                    setRemarks(event.target.value)
                  }
                  rows={4}
                  placeholder="Add feedback about the student's performance..."
                  className="w-full resize-none rounded-xl border border-[#e1e7ef] bg-[#fafbfd] px-4 py-3 text-sm text-[#34445d] outline-none transition placeholder:text-[#9aa5b5] focus:border-[#d9a63d] focus:bg-white focus:ring-4 focus:ring-[#d9a63d]/10"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#050a1c] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:bg-[#b67b1d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && (
                  <Clock3
                    size={17}
                    className="animate-spin"
                  />
                )}

                {saving
                  ? "Submitting..."
                  : "Submit Evaluation"}
              </button>
            </form>
          </section>

          {/* =================================================
              PERFORMANCE HISTORY
          ================================================== */}
          <section className="overflow-hidden rounded-2xl border border-[#e4e9f0] bg-white shadow-[0_4px_18px_rgba(16,26,51,0.035)]">
            <div className="flex flex-col justify-between gap-5 border-b border-[#edf0f4] px-6 py-6 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#071126]">
                  Performance History
                </h2>

                <p className="mt-2 text-sm text-[#697386]">
                  {selectedStudent
                    ? "Evaluations for selected student."
                    : "Recent student evaluations."}
                </p>
              </div>

              <div className="relative w-full md:w-64">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa5b5]"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search students..."
                  className="h-12 w-full rounded-xl border border-[#e1e7ef] bg-[#fafbfd] pl-10 pr-3 text-sm text-[#34445d] outline-none transition placeholder:text-[#9aa5b5] focus:border-[#d9a63d] focus:bg-white focus:ring-4 focus:ring-[#d9a63d]/10"
                />
              </div>
            </div>

            <div className="p-6">
              {filteredRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d9e0e9] bg-[#fafbfd] px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3ff] text-[#4774c8]">
                    <Award size={28} />
                  </div>

                  <h3 className="mt-4 font-bold text-[#34445d]">
                    No evaluations found
                  </h3>

                  <p className="mt-1 text-sm text-[#9aa5b5]">
                    Submit an evaluation to see it here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecords.map((record) => (
                    <div
                      key={record._id}
                      className="rounded-2xl border border-[#e4e9f0] bg-white p-5 transition hover:border-[#d9a63d] hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3ff] text-[#4774c8]">
                            <UserRound size={19} />
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate font-bold text-[#101a33]">
                              {record.student?.name ||
                                "Unknown Student"}
                            </h3>

                            <p className="mt-1 text-sm text-[#697386]">
                              Day {record.planDay}
                              <span className="mx-2 text-[#cbd3df]">
                                •
                              </span>
                              {record.curriculumTitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-1 md:items-end">
                          {renderStars(record.rating)}

                          <span className="text-xs font-bold text-[#697386]">
                            {record.rating}/5
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#f1f4f8] px-3 py-1 text-xs font-bold text-[#697386]">
                          {record.skill}
                        </span>

                        {record.evaluationDate && (
                          <span className="rounded-full bg-[#fafbfd] px-3 py-1 text-xs text-[#8c98a9] ring-1 ring-inset ring-[#e1e7ef]">
                            {formatDate(
                              record.evaluationDate,
                            )}
                          </span>
                        )}
                      </div>

                      {record.remarks && (
                        <div className="mt-4 rounded-xl border border-[#edf0f4] bg-[#fafbfd] p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#9aa5b5]">
                            Coach Remarks
                          </p>

                          <p className="mt-1.5 text-sm leading-6 text-[#697386]">
                            {record.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  title,
  value,
  suffix,
  description,
  icon: Icon,
  iconClass,
  label,
}: {
  title: string;
  value: number | string;
  suffix?: string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <Icon size={20} />
        </div>

        <span className="text-xs font-medium text-slate-400">
          {label}
        </span>
      </div>

      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-950">
        {value}

        {suffix && (
          <span className="ml-1 text-base font-medium text-[#3f4c60]">
            {suffix}
          </span>
        )}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   DATE FORMATTER
============================================================ */

function formatDate(date?: string) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
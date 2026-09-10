"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Clock,
  Search,
  Star,
  UserRound,
} from "lucide-react";

import { getStudents, getPlans } from "@/lib/api";

const API_URL = "http://localhost:5000/api";

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
    try {
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
    } catch (err: any) {
      throw err;
    }
  }

  const activeStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(search.toLowerCase()) ||
        student.phone?.includes(search);

      return (
        student.status !== "INACTIVE" &&
        student.status !== "COMPLETED" &&
        matchesSearch
      );
    });
  }, [students, search]);

  const selectedStudentData = useMemo(() => {
    return students.find((student) => student._id === selectedStudent);
  }, [students, selectedStudent]);

  const selectedCurriculum = useMemo(() => {
    if (!selectedStudentData) return null;

    const planId =
      typeof selectedStudentData.plan === "object"
        ? selectedStudentData.plan?._id
        : "";

    const plan = plans.find((item) => item._id === planId);

    if (!plan) return null;

    return plan.curriculum?.find((item) => item.day === selectedDay) || null;
  }, [selectedStudentData, plans, selectedDay]);

  const studentRecords = useMemo(() => {
    if (!selectedStudent) return records;

    return records.filter((record) => record.student?._id === selectedStudent);
  }, [records, selectedStudent]);

  function handleStudentChange(value: string) {
    setSelectedStudent(value);
    setRating(0);
    setRemarks("");
    setSuccess("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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
          skill: selectedCurriculum.skill || selectedCurriculum.title,
          rating,
          remarks: remarks.trim(),
          evaluationDate: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit performance");
      }

      setSuccess(
        `Performance evaluation submitted for ${selectedStudentData?.name}.`,
      );

      setRating(0);
      setRemarks("");

      await loadPerformance();
    } catch (err: any) {
      setError(err.message || "Failed to submit performance evaluation");
    } finally {
      setSaving(false);
    }
  }

  function renderStars(currentRating: number, interactive = false) {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => setRating(star) : undefined}
            className={interactive ? "rounded p-1 hover:bg-gray-100" : "p-1"}
          >
            <Star
              size={20}
              fill={star <= currentRating ? "currentColor" : "none"}
              className={
                star <= currentRating ? "text-yellow-500" : "text-gray-300"
              }
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Performance</h1>

        <p className="mt-1 text-sm text-gray-500">
          Evaluate student skills and track training performance.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        {/* Evaluation Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              New Evaluation
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Record a student's performance for a training day.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Student */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Student
              </label>

              <select
                value={selectedStudent}
                onChange={(e) => handleStudentChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
              >
                <option value="">Select student</option>

                {students
                  .filter(
                    (student) =>
                      student.status !== "INACTIVE" &&
                      student.status !== "COMPLETED",
                  )
                  .map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Day */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Training Day
              </label>

              <select
                value={selectedDay}
                onChange={(e) => {
                  setSelectedDay(Number(e.target.value));
                  setRating(0);
                  setRemarks("");
                  setSuccess("");
                  setError("");
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
              >
                {Array.from({ length: 100 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Day {index + 1}
                  </option>
                ))}
              </select>
            </div>

            {/* Curriculum */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <CalendarDays size={19} className="mt-0.5 text-gray-500" />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Curriculum
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedCurriculum?.title || "Select a student"}
                  </p>

                  {selectedCurriculum?.description && (
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedCurriculum.description}
                    </p>
                  )}

                  {selectedCurriculum?.skill && (
                    <p className="mt-2 text-xs font-medium text-gray-600">
                      Skill: {selectedCurriculum.skill}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Rating
              </label>

              <div className="flex items-center gap-2">
                {renderStars(rating, true)}

                <span className="ml-2 text-sm text-gray-500">
                  {rating === 0 ? "Not rated" : `${rating} / 5`}
                </span>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Remarks
              </label>

              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={4}
                placeholder="Add feedback about the student's performance..."
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Clock size={17} className="animate-spin" />}

              {saving ? "Submitting..." : "Submit Evaluation"}
            </button>
          </form>
        </div>

        {/* Performance History */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Performance History
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {selectedStudent
                  ? "Evaluations for selected student."
                  : "Recent student evaluations."}
              </p>
            </div>

            <div className="relative w-full md:w-64">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-black"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading performance...
            </div>
          ) : studentRecords.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
              <Award size={38} className="mx-auto mb-3 text-gray-400" />

              <h3 className="font-semibold text-gray-800">
                No evaluations found
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Submit an evaluation to see it here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {studentRecords
                .filter((record) =>
                  selectedStudent
                    ? true
                    : record.student?.name
                        ?.toLowerCase()
                        .includes(search.toLowerCase()),
                )
                .map((record) => (
                  <div
                    key={record._id}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                          <UserRound size={18} className="text-gray-500" />
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {record.student?.name || "Unknown Student"}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            Day {record.planDay} • {record.curriculumTitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-1 md:items-end">
                        {renderStars(record.rating)}

                        <span className="text-xs text-gray-500">
                          {record.rating}/5
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {record.skill}
                      </span>

                      {record.evaluationDate && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                          {new Date(record.evaluationDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {record.remarks && (
                      <div className="mt-4 rounded-lg bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-500">
                          Coach Remarks
                        </p>

                        <p className="mt-1 text-sm text-gray-700">
                          {record.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

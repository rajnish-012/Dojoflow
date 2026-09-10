"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Mail,
  Pencil,
  Phone,
  Target,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import {
  getStudentById,
  getStudentProgress,
  getPlans,
  updateStudent,
} from "@/lib/api";

type Student = {
  _id: string;
  name: string;
  age: number;
  phone: string;
  email?: string;

  branch?: {
    _id: string;
    name: string;
    address?: string;
  } | null;

  plan?: {
    _id: string;
    name: string;
    price: number;
    duration: number;
    durationUnit: string;
    classesPerWeek: number;
  } | null;

  currentBelt: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  joinDate: string;
};

type Progress = {
  currentTrainingDay: number;
  completedDays: number;
  totalCurriculumDays: number;
  presentClasses: number;
  absentClasses: number;
  pendingMakeups: number;
  completedMakeups: number;

  currentCurriculum?: {
    day: number;
    title: string;
    description?: string;
    skill?: string;
  } | null;

  nextMilestone?: {
    day: number;
    belt: string;
    skill: string;
    description?: string;
  } | null;

  achievedMilestone?: {
    day: number;
    belt: string;
    skill: string;
    description?: string;
  } | null;

  averageRating: number;
};

export default function StudentDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [plans, setPlans] = useState<
    {
      _id: string;
      name: string;
      price: number;
    }[]
  >([]);

  const [editForm, setEditForm] = useState({
    name: "",
    age: "",
    phone: "",
    email: "",
    plan: "",
    currentBelt: "",
    status: "ACTIVE" as
      | "ACTIVE"
      | "INACTIVE"
      | "COMPLETED",
  });

  useEffect(() => {
    const loadStudent = async () => {
      try {
        const [studentData, progressData] =
          await Promise.all([
            getStudentById(studentId),
            getStudentProgress(studentId),
          ]);

        setStudent(studentData.student);
        setProgress(progressData.progress);
      } catch (error) {
        console.error(error);
        setError("Failed to load student details");
      } finally {
        setLoading(false);
      }
    };

    if (studentId) {
      loadStudent();
    }
  }, [studentId]);

  const openEditModal = async () => {
    if (!student) return;

    setEditError("");

    setEditForm({
      name: student.name,
      age: String(student.age),
      phone: student.phone,
      email: student.email || "",
      plan: student.plan?._id || "",
      currentBelt: student.currentBelt,
      status: student.status,
    });

    try {
      const data = await getPlans();

      setPlans(data.plans || []);
      setShowEditModal(true);
    } catch (error) {
      console.error(error);

      setEditError("Failed to load plans");
      setShowEditModal(true);
    }
  };

  const closeEditModal = () => {
    if (saving) return;

    setShowEditModal(false);
    setEditError("");
  };

  const handleEditChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = event.target;

    setEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleEditSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !editForm.name.trim() ||
      !editForm.age ||
      !editForm.phone.trim() ||
      !editForm.plan
    ) {
      setEditError("Please fill all required fields.");
      return;
    }

    try {
      setSaving(true);
      setEditError("");

      await updateStudent(studentId, {
        name: editForm.name.trim(),
        age: Number(editForm.age),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        plan: editForm.plan,
        currentBelt: editForm.currentBelt,
        status: editForm.status,
      });

      const [studentData, progressData] =
        await Promise.all([
          getStudentById(studentId),
          getStudentProgress(studentId),
        ]);

      setStudent(studentData.student);
      setProgress(progressData.progress);

      setShowEditModal(false);
    } catch (error) {
      console.error(error);

      setEditError(
        error instanceof Error
          ? error.message
          : "Failed to update student",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading student details...
        </p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push("/students")}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            {error || "Student not found"}
          </p>
        </div>
      </div>
    );
  }

  const progressPercentage =
    progress && progress.totalCurriculumDays > 0
      ? Math.min(
          (progress.completedDays /
            progress.totalCurriculumDays) *
            100,
          100,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push("/students")}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Students
      </button>

      {/* Student Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700">
              {student.name
                .split(" ")
                .map((name) => name[0])
                .join("")
                .slice(0, 2)}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  {student.name}
                </h1>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    student.status === "ACTIVE"
                      ? "bg-green-50 text-green-700"
                      : student.status === "COMPLETED"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {student.status}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Age {student.age} ·{" "}
                {student.currentBelt} Belt
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3">
              <Award className="h-5 w-5 text-slate-600" />

              <div>
                <p className="text-xs text-slate-400">
                  Current Belt
                </p>

                <p className="text-sm font-semibold text-slate-900">
                  {student.currentBelt}
                </p>
              </div>
            </div>

            {/* View Progress */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/students/${studentId}/progress`,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Target className="h-4 w-4" />
              View Progress
            </button>

            {/* Edit */}
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Personal Information */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Personal Information
          </h2>

          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-slate-400" />

              <div>
                <p className="text-xs text-slate-400">
                  Phone
                </p>

                <p className="text-sm text-slate-700">
                  {student.phone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-400" />

              <div>
                <p className="text-xs text-slate-400">
                  Email
                </p>

                <p className="text-sm text-slate-700">
                  {student.email || "No email"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <UserRound className="h-4 w-4 text-slate-400" />

              <div>
                <p className="text-xs text-slate-400">
                  Branch
                </p>

                <p className="text-sm text-slate-700">
                  {student.branch?.name || "No branch"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CalendarCheck className="h-4 w-4 text-slate-400" />

              <div>
                <p className="text-xs text-slate-400">
                  Join Date
                </p>

                <p className="text-sm text-slate-700">
                  {new Date(
                    student.joinDate,
                  ).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Training Plan
          </h2>

          {student.plan ? (
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs text-slate-400">
                  Plan
                </p>

                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {student.plan.name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">
                    Price
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    ₹{student.plan.price}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">
                    Duration
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {student.plan.duration}{" "}
                    {student.plan.durationUnit.toLowerCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="h-4 w-4 text-slate-400" />
                {student.plan.classesPerWeek} classes per week
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              No training plan assigned.
            </p>
          )}
        </div>

        {/* Progress Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">
              Training Progress
            </h2>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/students/${studentId}/progress`,
                )
              }
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              View Details →
            </button>
          </div>

          {progress && (
            <div className="mt-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-400">
                    Current Training Day
                  </p>

                  <p className="mt-1 text-3xl font-bold text-slate-900">
                    {progress.currentTrainingDay}
                  </p>
                </div>

                <p className="text-sm text-slate-500">
                  {progress.completedDays}/
                  {progress.totalCurriculumDays} days
                </p>
              </div>

              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{
                    width: `${progressPercentage}%`,
                  }}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">
                    Present
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {progress.presentClasses}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">
                    Absent
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {progress.absentClasses}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">
                    Pending Makeups
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {progress.pendingMakeups}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">
                    Avg. Rating
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {progress.averageRating}/5
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Curriculum */}
      {progress?.currentCurriculum && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <Target className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Current Curriculum
              </h2>

              <p className="text-xs text-slate-500">
                Day {progress.currentCurriculum.day}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-5">
            <h3 className="text-lg font-semibold text-slate-900">
              {progress.currentCurriculum.title}
            </h3>

            {progress.currentCurriculum.description && (
              <p className="mt-2 text-sm text-slate-500">
                {progress.currentCurriculum.description}
              </p>
            )}

            {progress.currentCurriculum.skill && (
              <p className="mt-3 text-sm font-medium text-slate-700">
                Skill: {progress.currentCurriculum.skill}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Attendance + Milestone */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Attendance Summary
          </h2>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />

                <span className="text-sm text-slate-600">
                  Present Classes
                </span>
              </div>

              <span className="font-semibold text-slate-900">
                {progress?.presentClasses ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-500" />

                <span className="text-sm text-slate-600">
                  Absent Classes
                </span>
              </div>

              <span className="font-semibold text-slate-900">
                {progress?.absentClasses ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-500" />

                <span className="text-sm text-slate-600">
                  Pending Makeups
                </span>
              </div>

              <span className="font-semibold text-slate-900">
                {progress?.pendingMakeups ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Milestone */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Belt Progression
          </h2>

          {progress?.nextMilestone ? (
            <div className="mt-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                  <Award className="h-5 w-5 text-slate-700" />
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Next Milestone · Day{" "}
                    {progress.nextMilestone.day}
                  </p>

                  <p className="text-lg font-semibold text-slate-900">
                    {progress.nextMilestone.belt} Belt
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">
                  {progress.nextMilestone.skill}
                </p>

                {progress.nextMilestone.description && (
                  <p className="mt-1 text-xs text-slate-500">
                    {progress.nextMilestone.description}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              No upcoming milestone.
            </p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Edit Student
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Update student information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleEditSubmit}
              className="space-y-5 p-6"
            >
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">
                    {editError}
                  </p>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                {/* Name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Name *
                  </label>

                  <input
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                    placeholder="Student name"
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Age *
                  </label>

                  <input
                    name="age"
                    type="number"
                    min="1"
                    value={editForm.age}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                    placeholder="Age"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone *
                  </label>

                  <input
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                    placeholder="Phone number"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <input
                    name="email"
                    type="email"
                    value={editForm.email}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                    placeholder="Email address"
                  />
                </div>

                {/* Plan */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Training Plan *
                  </label>

                  <select
                    name="plan"
                    value={editForm.plan}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">
                      Select a plan
                    </option>

                    {plans.map((plan) => (
                      <option
                        key={plan._id}
                        value={plan._id}
                      >
                        {plan.name} — ₹{plan.price}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Belt */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Current Belt
                  </label>

                  <select
                    name="currentBelt"
                    value={editForm.currentBelt}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="White">White</option>
                    <option value="Yellow">Yellow</option>
                    <option value="Orange">Orange</option>
                    <option value="Green">Green</option>
                    <option value="Blue">Blue</option>
                    <option value="Purple">Purple</option>
                    <option value="Brown">Brown</option>
                    <option value="Black">Black</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="ACTIVE">
                      Active
                    </option>

                    <option value="INACTIVE">
                      Inactive
                    </option>

                    <option value="COMPLETED">
                      Completed
                    </option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && (
                    <Clock className="h-4 w-4 animate-spin" />
                  )}

                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
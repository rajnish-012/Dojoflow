"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Target,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";

import {
  getStudentById,
  getStudentProgress,
  getStudentAttendance,
  getStudentPerformance,
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

type AttendanceRecord = {
  _id: string;
  status: string;
  date: string;
  planDay?: number;
  curriculumTitle?: string;
  makeupRequired?: boolean;
  makeupCompleted?: boolean;
};

type PerformanceRecord = {
  _id: string;
  rating?: number;
  score?: number;
  marks?: number;
  performanceRating?: number;
  evaluationRating?: number;
  remarks?: string;
  evaluationDate?: string;
};

type EditForm = {
  name: string;
  age: string;
  phone: string;
  email: string;
  plan: string;
  currentBelt: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  password: string;
};

const inputClassName =
  "w-full rounded-xl border border-[#dce3eb] bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10";

const cardClassName =
  "rounded-2xl border border-[#e3e8ef] bg-white shadow-[0_3px_12px_rgba(15,23,42,0.025)]";

function extractRecords(response: any, keys: string[]): any[] {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
  }

  if (response?.data && response.data !== response) {
    return extractRecords(response.data, keys);
  }

  if (response?.result && response.result !== response) {
    return extractRecords(response.result, keys);
  }

  return [];
}

function getRating(record: PerformanceRecord): number {
  const value =
    record.rating ??
    record.score ??
    record.marks ??
    record.performanceRating ??
    record.evaluationRating;

  const rating = Number(value);
  return Number.isFinite(rating) ? rating : 0;
}

function calculateAverageRating(records: PerformanceRecord[]): number {
  const ratings = records
    .map(getRating)
    .filter((rating) => rating > 0);

  if (ratings.length === 0) return 0;

  return Math.round(
    (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10
  ) / 10;
}

export default function StudentDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [performance, setPerformance] = useState<PerformanceRecord[]>([]);

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

  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    age: "",
    phone: "",
    email: "",
    plan: "",
    currentBelt: "",
    status: "ACTIVE",
    password: "",
  });

  useEffect(() => {
    const loadStudent = async () => {
      try {
        setLoading(true);
        setError("");

        const studentData = await getStudentById(studentId);
        const progressData = await getStudentProgress(studentId);

        setStudent(studentData.student);
        setProgress(progressData.progress);

        try {
          const attendanceData = await getStudentAttendance(studentId);
          const attendanceRecords = extractRecords(attendanceData, [
            "attendance",
            "records",
            "items",
          ]);
          setAttendance(attendanceRecords);
        } catch (attendanceError) {
          console.error("Failed to load attendance:", attendanceError);
          setAttendance([]);
        }

        try {
          const performanceData = await getStudentPerformance(studentId);
          const performanceRecords = extractRecords(performanceData, [
            "performance",
            "records",
            "items",
          ]);
          setPerformance(performanceRecords);
        } catch (performanceError) {
          console.error("Failed to load performance:", performanceError);
          setPerformance([]);
        }
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
      name: student.name || "",
      age: String(student.age || ""),
      phone: student.phone || "",
      email: student.email || "",
      plan: student.plan?._id || "",
      currentBelt: student.currentBelt || "White",
      status: student.status || "ACTIVE",
      password: "",
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
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;

    setEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleEditSubmit = async (
  event: FormEvent<HTMLFormElement>,
) => {
  event.preventDefault();

  setEditError("");

  if (
    !editForm.name.trim() ||
    !editForm.age ||
    !editForm.phone.trim() ||
    !editForm.plan
  ) {
    setEditError("Please fill all required fields.");
    return;
  }

  if (Number(editForm.age) < 1) {
    setEditError("Age must be greater than zero.");
    return;
  }

  if (
    editForm.password.trim() &&
    editForm.password.trim().length < 6
  ) {
    setEditError("New password must be at least 6 characters.");
    return;
  }

  try {
    setSaving(true);

    await updateStudent(studentId, {
      name: editForm.name.trim(),
      age: Number(editForm.age),
      phone: editForm.phone.trim(),
      email: editForm.email.trim() || undefined,
      plan: editForm.plan,
      currentBelt: editForm.currentBelt,
      status: editForm.status,
      password: editForm.password.trim() || undefined,
    });

    const studentData = await getStudentById(studentId);
    const progressData = await getStudentProgress(studentId);

    setStudent(studentData.student);
    setProgress(progressData.progress);

    try {
      const attendanceData = await getStudentAttendance(studentId);
      const attendanceRecords = extractRecords(attendanceData, [
        "attendance",
        "records",
        "items",
      ]);
      setAttendance(attendanceRecords);
    } catch (attendanceError) {
      console.error("Failed to refresh attendance:", attendanceError);
      setAttendance([]);
    }

    try {
      const performanceData = await getStudentPerformance(studentId);
      const performanceRecords = extractRecords(performanceData, [
        "performance",
        "records",
        "items",
      ]);
      setPerformance(performanceRecords);
    } catch (performanceError) {
      console.error("Failed to refresh performance:", performanceError);
      setPerformance([]);
    }

    setShowEditModal(false);
    setEditError("");
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const getStatusStyles = (status: Student["status"]) => {
    if (status === "ACTIVE") {
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    }

    if (status === "COMPLETED") {
      return "bg-blue-50 text-blue-700 border-blue-100";
    }

    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  if (loading) {
    return (
      <div className="flex min-h-[550px] items-center justify-center bg-[#f5f7fb]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-orange-500" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            Loading student details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen space-y-5 bg-[#f5f7fb] p-5 sm:p-8">
        <button
          type="button"
          onClick={() => router.push("/students")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </button>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">{error || "Student not found"}</p>
        </div>
      </div>
    );
  }

  // Use progress API values when available. If the progress endpoint returns
  // empty/zero values, calculate the summary from attendance records so the
  // dashboard still displays real data.
  const presentFromAttendance = attendance.filter(
    (record) => String(record.status).toUpperCase() === "PRESENT"
  ).length;

  const absentFromAttendance = attendance.filter(
    (record) => String(record.status).toUpperCase() === "ABSENT"
  ).length;

  const pendingMakeupsFromAttendance = attendance.filter(
    (record) => record.makeupRequired && !record.makeupCompleted
  ).length;

  const completedMakeupsFromAttendance = attendance.filter(
    (record) => record.makeupRequired && record.makeupCompleted
  ).length;

  // Attendance summary calculations:
  // Training Day = total present classes + total absent classes
  // Attendance = present classes / (present classes + absent classes) * 100
  // Completed Days = present classes + completed makeups
  // Curriculum Days = present classes + absent classes

  const apiPresentClasses = progress?.presentClasses ?? 0;
  const apiAbsentClasses = progress?.absentClasses ?? 0;

  // If the progress endpoint returns default zero values, use the
  // attendance records as the source of truth.
  const hasApiAttendanceData =
    apiPresentClasses + apiAbsentClasses > 0;

  const presentClasses = hasApiAttendanceData
    ? apiPresentClasses
    : presentFromAttendance;

  const absentClasses = hasApiAttendanceData
    ? apiAbsentClasses
    : absentFromAttendance;

  const pendingMakeups =
    progress?.pendingMakeups !== undefined
      ? progress.pendingMakeups
      : pendingMakeupsFromAttendance;

  const completedMakeups =
    progress?.completedMakeups !== undefined
      ? progress.completedMakeups
      : completedMakeupsFromAttendance;

  // Total classes attended or missed.
  const totalAttendanceClasses = presentClasses + absentClasses;

  // Card 1: Training Day
  const trainingDay = totalAttendanceClasses;

  // Card 2: Attendance percentage
  const attendancePercentage =
    totalAttendanceClasses > 0
      ? Math.round((presentClasses / totalAttendanceClasses) * 100)
      : 0;

  // Card 3: N of M curriculum days
  // N = present classes + completed makeups
  // M = present classes + absent classes
  const completedDays = presentClasses + completedMakeups;
  const totalCurriculumDays = totalAttendanceClasses;

  const apiAverageRating = Number(
    progress?.averageRating ?? 0
  );

  const calculatedAverageRating = calculateAverageRating(performance);

  const averageRating =
    Number.isFinite(apiAverageRating) && apiAverageRating > 0
      ? apiAverageRating
      : calculatedAverageRating;

  const progressPercentage =
    totalCurriculumDays > 0
      ? Math.min((completedDays / totalCurriculumDays) * 100, 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Page Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/students")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-orange-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Students
          </button>

          <div className="hidden items-center gap-2 text-xs font-medium text-slate-400 sm:flex">
            <span>Students</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-600">{student.name}</span>
          </div>
        </div>

        {/* Student Hero Section */}
        <section className={`${cardClassName} overflow-hidden`}>
          <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />

          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-xl font-bold text-orange-600 ring-8 ring-orange-50/60 sm:h-20 sm:w-20 sm:text-2xl">
                  {getInitials(student.name)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                      {student.name}
                    </h1>

                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide ${getStatusStyles(
                        student.status,
                      )}`}
                    >
                      {student.status}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span>Age {student.age}</span>
                    <span className="text-slate-300">•</span>
                    <span>{student.currentBelt} Belt</span>
                    {student.branch?.name && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>{student.branch.name}</span>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Joined {formatDate(student.joinDate)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3 rounded-xl border border-[#e3e8ef] bg-[#f8fafc] px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                    <Award className="h-5 w-5 text-orange-600" />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Current Belt
                    </p>

                    <p className="mt-0.5 text-sm font-bold text-slate-950">
                      {student.currentBelt}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/students/${studentId}/progress`)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-500"
                >
                  <Target className="h-4 w-4" />
                  View Progress
                </button>

                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dce3eb] bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Student
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Overview Statistics */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${cardClassName} p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Training Day
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {trainingDay}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Current curriculum day
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                <Target className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className={`${cardClassName} p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Attendance
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {attendancePercentage}%
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Overall attendance rate
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className={`${cardClassName} p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Completed Days
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {completedDays}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Of {totalCurriculumDays || 0} curriculum days
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <CalendarCheck className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className={`${cardClassName} p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Pending Makeups
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {pendingMakeups}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Classes requiring attention
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Information Grid */}
        <div className="grid gap-5 xl:grid-cols-12">
          {/* Personal Information */}
          <section className={`${cardClassName} p-5 sm:p-6 xl:col-span-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-500">
                  Profile
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Personal Information
                </h2>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
                <UserRound className="h-5 w-5 text-slate-500" />
              </div>
            </div>

            <div className="mt-6 divide-y divide-slate-100">
              <div className="flex items-start gap-3 py-4 first:pt-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                  <Phone className="h-4 w-4 text-slate-500" />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Phone Number
                  </p>

                  <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                    {student.phone}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Email Address
                  </p>

                  <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                    {student.email || "No email added"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                  <Users className="h-4 w-4 text-slate-500" />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Branch
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {student.branch?.name || "No branch assigned"}
                  </p>

                  {student.branch?.address && (
                    <p className="mt-1 text-xs text-slate-400">
                      {student.branch.address}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 py-4 last:pb-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                  <CalendarCheck className="h-4 w-4 text-slate-500" />
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Joining Date
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {formatDate(student.joinDate)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Training Plan */}
          <section className={`${cardClassName} p-5 sm:p-6 xl:col-span-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-500">
                  Subscription
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Training Plan
                </h2>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                <ShieldCheck className="h-5 w-5 text-orange-600" />
              </div>
            </div>

            {student.plan ? (
              <div className="mt-6">
                <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-300">
                        Current Plan
                      </p>

                      <h3 className="mt-2 text-xl font-bold">
                        {student.plan.name}
                      </h3>
                    </div>

                    <div className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-300">
                      Active Plan
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-slate-400">Price</p>
                      <p className="mt-1 text-lg font-bold">
                        ₹{student.plan.price}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-slate-400">Duration</p>
                      <p className="mt-1 text-lg font-bold">
                        {student.plan.duration}{" "}
                        {student.plan.durationUnit.toLowerCase()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#e3e8ef] bg-[#f8fafc] p-4">
                    <p className="text-xs font-medium text-slate-400">
                      Classes Per Week
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {student.plan.classesPerWeek}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#e3e8ef] bg-[#f8fafc] p-4">
                    <p className="text-xs font-medium text-slate-400">
                      Plan Status
                    </p>

                    <p className="mt-1 text-lg font-bold text-emerald-600">
                      Active
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 text-sm font-semibold text-slate-600">
                  No training plan assigned
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Assign a plan to start tracking the student&apos;s training.
                </p>
              </div>
            )}
          </section>

          {/* Training Progress */}
          <section className={`${cardClassName} p-5 sm:p-6 xl:col-span-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-500">
                  Performance
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Training Progress
                </h2>
              </div>

              <button
                type="button"
                onClick={() => router.push(`/students/${studentId}/progress`)}
                className="text-xs font-bold text-orange-600 transition hover:text-orange-700"
              >
                View Details →
              </button>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Current Training Day
                  </p>

                  <p className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
                    { completedDays || 0}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-medium text-slate-400">
                    Completed
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {completedDays}/{totalCurriculumDays || 0} days
                  </p>
                </div>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
                  style={{
                    width: `${progressPercentage}%`,
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Progress</span>
                <span className="font-semibold text-orange-600">
                  {Math.round(progressPercentage)}%
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#e3e8ef] bg-[#f8fafc] p-3.5">
                  <p className="text-xs font-medium text-slate-400">Present</p>

                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {presentClasses}
                  </p>
                </div>

                <div className="rounded-xl border border-[#e3e8ef] bg-[#f8fafc] p-3.5">
                  <p className="text-xs font-medium text-slate-400">Absent</p>

                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {absentClasses}
                  </p>
                </div>

                <div className="rounded-xl border border-[#e3e8ef] bg-[#f8fafc] p-3.5">
                  <p className="text-xs font-medium text-slate-400">Makeups</p>

                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {pendingMakeups}
                  </p>
                </div>

                <div className="rounded-xl border border-[#e3e8ef] bg-[#f8fafc] p-3.5">
                  <p className="text-xs font-medium text-slate-400">Rating</p>

                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {averageRating.toFixed(1)}
                    <span className="text-sm font-medium text-slate-400">
                      /5
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Current Curriculum */}
        <section className={`${cardClassName} p-5 sm:p-6`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50">
                <Target className="h-5 w-5 text-orange-600" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-500">
                  Learning Path
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Current Curriculum
                </h2>
              </div>
            </div>

            {progress?.currentCurriculum && (
              <span className="w-fit rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">
                Day {progress.currentCurriculum.day}
              </span>
            )}
          </div>

          {progress?.currentCurriculum ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
              <div className="rounded-2xl border border-[#e3e8ef] bg-[#f8fafc] p-5">
                <h3 className="text-xl font-bold text-slate-950">
                  {progress.currentCurriculum.title}
                </h3>

                {progress.currentCurriculum.description && (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                    {progress.currentCurriculum.description}
                  </p>
                )}

                {progress.currentCurriculum.skill && (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2">
                    <Award className="h-4 w-4 text-orange-600" />

                    <span className="text-sm font-bold text-orange-700">
                      {progress.currentCurriculum.skill}
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-orange-600">
                  Next Focus
                </p>

                <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                  Continue practicing the current curriculum skills
                  consistently.
                </p>

                <button
                  type="button"
                  onClick={() => router.push(`/students/${studentId}/progress`)}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-orange-700 hover:text-orange-800"
                >
                  Open full progress
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Target className="mx-auto h-9 w-9 text-slate-300" />

              <p className="mt-3 text-sm font-semibold text-slate-600">
                No current curriculum available
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Curriculum information will appear once training progress is
                recorded.
              </p>
            </div>
          )}
        </section>

        {/* Attendance and Belt Progression */}
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Attendance Summary */}
          <section className={`${cardClassName} p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-500">
                  Class Records
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Attendance Summary
                </h2>
              </div>

              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                  Attendance
                </p>

                <p className="text-lg font-bold text-emerald-700">
                  {attendancePercentage}%
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-[#e3e8ef] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Present Classes
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Successfully attended
                    </p>
                  </div>
                </div>

                <span className="text-xl font-bold text-slate-950">
                  {presentClasses}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#e3e8ef] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                    <XCircle className="h-5 w-5 text-red-500" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Absent Classes
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Missed training sessions
                    </p>
                  </div>
                </div>

                <span className="text-xl font-bold text-slate-950">
                  {absentClasses}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#e3e8ef] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Pending Makeups
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Classes still to be completed
                    </p>
                  </div>
                </div>

                <span className="text-xl font-bold text-slate-950">
                  {pendingMakeups}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#e3e8ef] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Completed Makeups
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Previously recovered classes
                    </p>
                  </div>
                </div>

                <span className="text-xl font-bold text-slate-950">
                  {completedMakeups}
                </span>
              </div>
            </div>
          </section>

          {/* Belt Progression */}
          <section className={`${cardClassName} p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-500">
                  Achievement Path
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Belt Progression
                </h2>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                <Award className="h-5 w-5 text-orange-600" />
              </div>
            </div>

            {progress?.nextMilestone ? (
              <div className="mt-6">
                <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Award className="h-7 w-7 text-orange-500" />
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-orange-600">
                        Next Milestone
                      </p>

                      <h3 className="mt-1 text-xl font-bold text-slate-950">
                        {progress.nextMilestone.belt} Belt
                      </h3>

                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Target Day {progress.nextMilestone.day}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-orange-100 bg-white/70 p-4">
                    <p className="text-sm font-bold text-slate-800">
                      {progress.nextMilestone.skill}
                    </p>

                    {progress.nextMilestone.description && (
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {progress.nextMilestone.description}
                      </p>
                    )}
                  </div>
                </div>

                {progress.achievedMilestone && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />

                    <div>
                      <p className="text-xs font-bold text-emerald-700">
                        Latest Achievement
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {progress.achievedMilestone.belt} Belt
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <Award className="mx-auto h-9 w-9 text-slate-300" />

                <p className="mt-3 text-sm font-semibold text-slate-600">
                  No upcoming milestone
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Belt progression details will appear as the student advances
                  through the curriculum.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

        {/* Detailed Attendance and Performance Records */}
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Attendance Records */}
          <section className={`${cardClassName} p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-500">
                  Recent Records
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Attendance Records
                </h2>
              </div>

              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                {attendance.length} Records
              </span>
            </div>

            {attendance.length > 0 ? (
              <div className="mt-5 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {attendance.map((record) => {
                  const isPresent =
                    record.status.toUpperCase() === "PRESENT";

                  return (
                    <div
                      key={record._id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e8ef] bg-[#f8fafc] p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isPresent ? "bg-emerald-50" : "bg-red-50"
                          }`}
                        >
                          {isPresent ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {record.curriculumTitle ||
                              `Training Day ${record.planDay ?? "-"}`}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {record.date
                              ? formatDate(record.date)
                              : "Date unavailable"}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`text-xs font-bold ${
                            isPresent ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {record.status}
                        </p>

                        {record.makeupRequired && (
                          <p className="mt-1 text-[10px] font-semibold text-amber-600">
                            {record.makeupCompleted
                              ? "Makeup Completed"
                              : "Makeup Pending"}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <CalendarCheck className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 text-sm font-semibold text-slate-600">
                  No attendance records found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Attendance records will appear after classes are marked.
                </p>
              </div>
            )}
          </section>

          {/* Performance Records */}
          <section className={`${cardClassName} p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-500">
                  Evaluation History
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Performance Records
                </h2>
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {performance.length} Reports
              </span>
            </div>

            {performance.length > 0 ? (
              <div className="mt-5 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {performance.map((record) => (
                  <div
                    key={record._id}
                    className="rounded-xl border border-[#e3e8ef] bg-[#f8fafc] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Performance Evaluation
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {record.evaluationDate
                            ? formatDate(record.evaluationDate)
                            : "Date unavailable"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-orange-50 px-3 py-1.5">
                        <span className="text-sm font-bold text-orange-700">
                          {record.rating ?? 0}/5
                        </span>
                      </div>
                    </div>

                    {record.remarks && (
                      <p className="mt-3 rounded-lg border border-slate-100 bg-white p-3 text-sm leading-5 text-slate-600">
                        {record.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <Award className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 text-sm font-semibold text-slate-600">
                  No performance records found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Performance evaluations will appear after an instructor submits them.
                </p>
              </div>
            )}
          </section>
        </div>

      {/* Edit Student Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px]">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e3e8ef] bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e3e8ef] bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-500">
                  Student Management
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Edit Student
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Update profile, plan, belt, and account information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={saving}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-6 p-5 sm:p-6">
              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                  <p className="text-sm font-medium text-red-700">
                    {editError}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Basic Information
                </p>

                <div className="grid gap-5 md:grid-cols-2">
                  {/* Name */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Name <span className="text-orange-500">*</span>
                    </label>

                    <input
                      name="name"
                      value={editForm.name}
                      onChange={handleEditChange}
                      className={inputClassName}
                      placeholder="Student name"
                    />
                  </div>

                  {/* Age */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Age <span className="text-orange-500">*</span>
                    </label>

                    <input
                      name="age"
                      type="number"
                      min="1"
                      value={editForm.age}
                      onChange={handleEditChange}
                      className={inputClassName}
                      placeholder="Age"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Phone <span className="text-orange-500">*</span>
                    </label>

                    <input
                      name="phone"
                      value={editForm.phone}
                      onChange={handleEditChange}
                      className={inputClassName}
                      placeholder="Phone number"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Email
                    </label>

                    <input
                      name="email"
                      type="email"
                      value={editForm.email}
                      onChange={handleEditChange}
                      className={inputClassName}
                      placeholder="Email address"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Training Details
                </p>

                <div className="grid gap-5 md:grid-cols-2">
                  {/* Plan */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Training Plan <span className="text-orange-500">*</span>
                    </label>

                    <select
                      name="plan"
                      value={editForm.plan}
                      onChange={handleEditChange}
                      className={inputClassName}
                    >
                      <option value="">Select a plan</option>

                      {plans.map((plan) => (
                        <option key={plan._id} value={plan._id}>
                          {plan.name} — ₹{plan.price}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Belt */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Current Belt
                    </label>

                    <select
                      name="currentBelt"
                      value={editForm.currentBelt}
                      onChange={handleEditChange}
                      className={inputClassName}
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
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Status
                    </label>

                    <select
                      name="status"
                      value={editForm.status}
                      onChange={handleEditChange}
                      className={inputClassName}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Account Security
                </p>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    New Login Password{" "}
                    <span className="text-xs font-normal text-slate-400">
                      Optional
                    </span>
                  </label>

                  <input
                    name="password"
                    type="password"
                    minLength={6}
                    value={editForm.password}
                    onChange={handleEditChange}
                    className={inputClassName}
                    placeholder="Leave blank to keep current password"
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Enter a password only if you want to change the
                    student&apos;s login password. Minimum 6 characters.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col-reverse gap-3 border-t border-[#e3e8ef] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="rounded-xl border border-[#dce3eb] px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <Clock className="h-4 w-4 animate-spin" />}

                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

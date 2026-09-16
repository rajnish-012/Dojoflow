"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  X,
  XCircle,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

type Student = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  currentBelt?: string;
  registrationDate?: string;
  branch?: {
    _id: string;
    name: string;
  } | null;
  plan?: {
    _id: string;
    name: string;
  } | null;
};

type AttendanceRecord = {
  _id: string;
  student:
    | {
        _id: string;
        name: string;
      }
    | string;
  date: string;
  planDay: number;
  curriculumTitle?: string;
  status: "PRESENT" | "ABSENT";
  makeupRequired: boolean;
  makeupCompleted: boolean;
};

type AttendanceForm = {
  student: string;
  curriculumTitle: string;
  status: "PRESENT" | "ABSENT";
  makeupRequired: boolean;
};

function formatDate(date?: string) {
  if (!date) {
    return "—";
  }

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

function getStudentName(
  student: AttendanceRecord["student"],
) {
  if (typeof student === "object" && student !== null) {
    return student.name;
  }

  return "Unknown Student";
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST"
  );
}

function calculateTrainingDay(
  registrationDate?: string,
  selectedDate?: string,
) {
  if (!registrationDate || !selectedDate) {
    return null;
  }

  const joiningDate = new Date(
    `${registrationDate.slice(0, 10)}T00:00:00`,
  );

  const attendanceDate = new Date(
    `${selectedDate}T00:00:00`,
  );

  if (
    Number.isNaN(joiningDate.getTime()) ||
    Number.isNaN(attendanceDate.getTime())
  ) {
    return null;
  }

  const differenceInMilliseconds =
    attendanceDate.getTime() - joiningDate.getTime();

  const differenceInDays = Math.floor(
    differenceInMilliseconds /
      (1000 * 60 * 60 * 24),
  );

  if (differenceInDays < 0) {
    return null;
  }

  return differenceInDays + 1;
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
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_4px_18px_rgba(16,26,51,0.035)]">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <span className="text-sm font-medium text-slate-400">
          DojoFlow
        </span>
      </div>

      <div className="mt-5">
        <p className="text-sm text-slate-500">
          {title}
        </p>

        <p className="mt-1 text-2xl font-bold text-slate-900">
          {value}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<
    AttendanceRecord[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedDate, setSelectedDate] = useState(
    new Date().toLocaleDateString("en-CA"),
  );

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<AttendanceForm>({
    student: "",
    curriculumTitle: "",
    status: "PRESENT",
    makeupRequired: false,
  });

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  async function loadData(showRefreshLoader = false) {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const studentsUrl = `${API_URL}/students`;
      const attendanceUrl = `${API_URL}/attendance?date=${encodeURIComponent(
        selectedDate,
      )}`;

      const [studentResponse, attendanceResponse] =
        await Promise.all([
          fetch(studentsUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(attendanceUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

      if (studentResponse.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }

      if (attendanceResponse.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }

      if (!studentResponse.ok) {
        throw new Error(
          `Failed to load students: ${studentResponse.status}`,
        );
      }

      if (!attendanceResponse.ok) {
        throw new Error(
          `Failed to load attendance: ${attendanceResponse.status}`,
        );
      }

      const studentsData = await studentResponse.json();
      const attendanceData =
        await attendanceResponse.json();

      setStudents(
        studentsData.students ||
          studentsData.data ||
          [],
      );

      setAttendance(
        attendanceData.attendance ||
          attendanceData.records ||
          attendanceData.data ||
          [],
      );
    } catch (loadError) {
      console.error("Attendance loading error:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load attendance data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleDateChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setSelectedDate(event.target.value);
  }

  function handleFormChange(
    event:
      | ChangeEvent<HTMLSelectElement>
      | ChangeEvent<HTMLInputElement>,
  ) {
    const { name, value, type } = event.target;

    if (type === "checkbox") {
      const checked = (
        event.target as HTMLInputElement
      ).checked;

      setForm((previous) => ({
        ...previous,
        [name]: checked,
      }));

      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setFormError("");
    setSuccess("");

    if (!form.student) {
      setFormError("Please select a student.");
      return;
    }

    if (
      form.status === "ABSENT" &&
      !form.makeupRequired
    ) {
      const confirmed = window.confirm(
        "This student is absent. Do you want to continue without scheduling a makeup class?",
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setSaving(true);

      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(
        `${API_URL}/attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            student: form.student,
            date: selectedDate,
            curriculumTitle: form.curriculumTitle,
            status: form.status,
            makeupRequired:
              form.status === "ABSENT"
                ? form.makeupRequired
                : false,
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
          data.message || "Failed to mark attendance.",
        );
      }

      setSuccess(
        data.message ||
          "Attendance marked successfully.",
      );

      setForm({
        student: "",
        curriculumTitle: "",
        status: "PRESENT",
        makeupRequired: false,
      });

      setShowForm(false);

      await loadData();
    } catch (submitError) {
      console.error("Attendance submit error:", submitError);

      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to mark attendance.",
      );
    } finally {
      setSaving(false);
    }
  }

  const presentCount = useMemo(() => {
    return attendance.filter(
      (record) => record.status === "PRESENT",
    ).length;
  }, [attendance]);

  const absentCount = useMemo(() => {
    return attendance.filter(
      (record) => record.status === "ABSENT",
    ).length;
  }, [attendance]);

  const pendingMakeupCount = useMemo(() => {
    return attendance.filter(
      (record) =>
        record.status === "ABSENT" &&
        record.makeupRequired &&
        !record.makeupCompleted,
    ).length;
  }, [attendance]);

  const selectedStudent = students.find(
    (student) => student._id === form.student,
  );

  const selectedTrainingDay = calculateTrainingDay(
    selectedStudent?.registrationDate,
    selectedDate,
  );

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading attendance...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
              <ClipboardCheck className="h-4 w-4" />
              Academy Management
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Attendance
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Track student attendance and manage missed-class makeups.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormError("");
              setShowForm(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-5 w-5" />
            Mark Attendance
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <p className="text-sm text-emerald-700">
                {success}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="text-emerald-600 hover:text-emerald-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Date Selector */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <CalendarDays className="h-6 w-6" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Attendance Date
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select a date to view or manage attendance.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label
                htmlFor="attendance-date"
                className="text-sm font-medium text-slate-500"
              >
                Selected date
              </label>

              <input
                id="attendance-date"
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />

              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  className={
                    refreshing ? "animate-spin" : ""
                  }
                  size={18}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Marked"
            value={attendance.length}
            description="Attendance records for this date"
            icon={Users}
            iconClass="bg-slate-100 text-slate-700"
          />

          <SummaryCard
            title="Present"
            value={presentCount}
            description="Students present today"
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Absent"
            value={absentCount}
            description="Students absent today"
            icon={XCircle}
            iconClass="bg-red-50 text-red-600"
          />

          <SummaryCard
            title="Pending Makeups"
            value={pendingMakeupCount}
            description="Absences requiring makeup classes"
            icon={Clock3}
            iconClass="bg-amber-50 text-amber-600"
          />
        </div>

        {/* Main Content */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Attendance Records */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-orange-600">
                  Recent Records
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Attendance Records
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Records for {formatDate(selectedDate)}
                </p>
              </div>

              <span className="w-fit rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">
                {attendance.length} Records
              </span>
            </div>

            {attendance.length > 0 ? (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-[700px] w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Student
                      </th>

                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Training Day
                      </th>

                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Curriculum
                      </th>

                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>

                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Makeup
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {attendance.map((record) => {
                      const studentName = getStudentName(
                        record.student,
                      );

                      const isPresent =
                        record.status === "PRESENT";

                      return (
                        <tr
                          key={record._id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                                {getInitials(studentName)}
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {studentName}
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  {formatDate(record.date)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-sm text-slate-600">
                            Day {record.planDay ?? "—"}
                          </td>

                          <td className="max-w-[180px] px-4 py-4 text-sm text-slate-600">
                            <span className="block truncate">
                              {record.curriculumTitle || "—"}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                                isPresent
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {isPresent ? (
                                <CheckCircle2 size={14} />
                              ) : (
                                <XCircle size={14} />
                              )}

                              {isPresent
                                ? "Present"
                                : "Absent"}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            {record.makeupRequired ? (
                              <span
                                className={`text-xs font-semibold ${
                                  record.makeupCompleted
                                    ? "text-emerald-600"
                                    : "text-amber-600"
                                }`}
                              >
                                {record.makeupCompleted
                                  ? "Completed"
                                  : "Pending"}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                <CalendarDays className="mx-auto h-9 w-9 text-slate-300" />

                <p className="mt-3 text-sm font-semibold text-slate-600">
                  No attendance records found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Attendance records will appear after classes are marked.
                </p>
              </div>
            )}
          </div>

          {/* Daily Overview */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Daily Overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Attendance summary for the selected date
              </p>
            </div>

            <div className="mt-8 flex justify-center">
              <div
                className="relative flex h-44 w-44 items-center justify-center rounded-full"
                style={{
                  background:
                    attendance.length > 0
                      ? `conic-gradient(#16a34a ${
                          (presentCount /
                            attendance.length) *
                          100
                        }%, #e2e8f0 0)`
                      : "#e2e8f0",
                }}
              >
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-3xl font-bold text-slate-900">
                    {attendance.length > 0
                      ? Math.round(
                          (presentCount /
                            attendance.length) *
                            100,
                        )
                      : 0}
                    %
                  </span>

                  <span className="mt-1 text-sm text-slate-500">
                    Present
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-600">
                    Present
                  </span>
                </div>

                <span className="text-sm font-semibold text-slate-900">
                  {presentCount}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-sm text-slate-600">
                    Absent
                  </span>
                </div>

                <span className="text-sm font-semibold text-slate-900">
                  {absentCount}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-sm text-slate-600">
                    Pending Makeups
                  </span>
                </div>

                <span className="text-sm font-semibold text-slate-900">
                  {pendingMakeupCount}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <span className="text-sm text-slate-600">
                  Total Marked
                </span>

                <span className="text-sm font-semibold text-slate-900">
                  {attendance.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mark Attendance Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Mark Attendance
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {formatDate(selectedDate)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="student"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Student
                </label>

                <select
                  id="student"
                  name="student"
                  value={form.student}
                  onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                >
                  <option value="">
                    Select student
                  </option>

                  {students.map((student) => (
                    <option
                      key={student._id}
                      value={student._id}
                    >
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTrainingDay && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white p-2 text-slate-600">
                      <CalendarDays size={18} />
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Calculated Training Day
                      </p>

                      <p className="text-sm font-bold text-slate-900">
                        Day {selectedTrainingDay}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="curriculumTitle"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Curriculum
                </label>

                <input
                  id="curriculumTitle"
                  name="curriculumTitle"
                  type="text"
                  value={form.curriculumTitle}
                  onChange={handleFormChange}
                  placeholder="Enter curriculum title"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Status
                </label>

                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                >
                  <option value="PRESENT">
                    Present
                  </option>

                  <option value="ABSENT">
                    Absent
                  </option>
                </select>
              </div>

              {form.status === "ABSENT" && (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <input
                    type="checkbox"
                    name="makeupRequired"
                    checked={form.makeupRequired}
                    onChange={handleFormChange}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-amber-800">
                      Require makeup class
                    </span>

                    <span className="mt-1 block text-xs text-amber-700">
                      Schedule a makeup class for this absence.
                    </span>
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : "Save Attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
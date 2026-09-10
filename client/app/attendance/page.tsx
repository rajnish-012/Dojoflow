"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  X,
  Users,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

type Student = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  currentBelt?: string;
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
  planDay: string;
  curriculumTitle: string;
  status: "PRESENT" | "ABSENT";
  makeupRequired: boolean;
};

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<
    AttendanceRecord[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [selectedDate, setSelectedDate] =
    useState(
      new Date().toISOString().split("T")[0],
    );

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] =
    useState<AttendanceForm>({
      student: "",
      planDay: "1",
      curriculumTitle: "",
      status: "PRESENT",
      makeupRequired: false,
    });

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const [studentsResponse, attendanceResponse] =
        await Promise.all([
          fetch(`${API_URL}/students`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),

          fetch(
            `${API_URL}/attendance?date=${selectedDate}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          ),
        ]);

      const studentsData =
        await studentsResponse.json();

      const attendanceData =
        await attendanceResponse.json();

      if (!studentsResponse.ok) {
        throw new Error(
          studentsData.message ||
            "Failed to load students",
        );
      }

      if (!attendanceResponse.ok) {
        throw new Error(
          attendanceData.message ||
            "Failed to load attendance",
        );
      }

      setStudents(
        studentsData.students || [],
      );

      setAttendance(
        attendanceData.attendance ||
          attendanceData.records ||
          [],
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance",
      );
    } finally {
      setLoading(false);
    }
  }

  function openForm() {
    setFormError("");

    setForm({
      student: "",
      planDay: "1",
      curriculumTitle: "",
      status: "PRESENT",
      makeupRequired: false,
    });

    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setFormError("");
  }

  function handleFormChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleStatusChange(
    status: "PRESENT" | "ABSENT",
  ) {
    setForm((current) => ({
      ...current,
      status,
      makeupRequired:
        status === "ABSENT"
          ? current.makeupRequired
          : false,
    }));
  }

  function handleMakeupChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    setForm((current) => ({
      ...current,
      makeupRequired: event.target.checked,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError("");

    if (!form.student) {
      setFormError(
        "Please select a student.",
      );
      return;
    }

    if (!form.planDay) {
      setFormError(
        "Please enter the training day.",
      );
      return;
    }

    try {
      setSaving(true);

      const token =
        localStorage.getItem("token");

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
            planDay: Number(form.planDay),
            curriculumTitle:
              form.curriculumTitle.trim(),
            status: form.status,
            makeupRequired:
              form.makeupRequired,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to mark attendance",
        );
      }

      setShowForm(false);

      await loadData();
    } catch (err) {
      console.error(err);

      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to mark attendance",
      );
    } finally {
      setSaving(false);
    }
  }

  const presentCount = useMemo(
    () =>
      attendance.filter(
        (record) =>
          record.status === "PRESENT",
      ).length,
    [attendance],
  );

  const absentCount = useMemo(
    () =>
      attendance.filter(
        (record) =>
          record.status === "ABSENT",
      ).length,
    [attendance],
  );

  const makeupCount = useMemo(
    () =>
      attendance.filter(
        (record) =>
          record.makeupRequired &&
          !record.makeupCompleted,
      ).length,
    [attendance],
  );

  const markedStudentIds = useMemo(() => {
    return new Set(
      attendance.map((record) =>
        typeof record.student === "string"
          ? record.student
          : record.student?._id,
      ),
    );
  }, [attendance]);

  const availableStudents = students.filter(
    (student) =>
      !markedStudentIds.has(student._id),
  );

  function getStudentName(
    record: AttendanceRecord,
  ) {
    if (
      typeof record.student === "object" &&
      record.student
    ) {
      return record.student.name;
    }

    const student = students.find(
      (item) =>
        item._id === record.student,
    );

    return student?.name || "Unknown Student";
  }

  function formatDate(date: string) {
    return new Date(
      `${date}T00:00:00`,
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

          <p className="mt-3 text-sm text-slate-500">
            Loading attendance...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Attendance
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Track student attendance and missed-class
            makeups.
          </p>
        </div>

        <button
          type="button"
          onClick={openForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <ClipboardCheck className="h-4 w-4" />
          Mark Attendance
        </button>
      </div>

      {/* Error */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />

          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      {/* Date */}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Attendance Date
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Select the date for which you want to
            manage attendance.
          </p>
        </div>

        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            type="date"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(
                event.target.value,
              )
            }
            className="rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-slate-900"
          />
        </div>
      </div>

      {/* Stats */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <Users className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Total Marked
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {attendance.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <Check className="h-5 w-5 text-green-600" />
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Present
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {presentCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <X className="h-5 w-5 text-red-600" />
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Absent
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {absentCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Pending Makeups
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {makeupCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="font-semibold text-slate-900">
            Attendance Records
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {formatDate(selectedDate)}
          </p>
        </div>

        {attendance.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-slate-300" />

            <p className="mt-3 text-sm font-medium text-slate-700">
              No attendance marked
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Start by marking attendance for a student.
            </p>

            <button
              type="button"
              onClick={openForm}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Mark Attendance
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Student
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Training Day
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Curriculum
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Makeup
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {attendance.map((record) => {
                  const studentName =
                    getStudentName(record);

                  const initials = studentName
                    .split(" ")
                    .filter(Boolean)
                    .map(
                      (part) => part[0],
                    )
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={record._id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                            {initials || "ST"}
                          </div>

                          <span className="text-sm font-semibold text-slate-900">
                            {studentName}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">
                          Day {record.planDay}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {record.curriculumTitle ||
                            "—"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {record.status ===
                        "PRESENT" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                            <Check className="h-3.5 w-3.5" />
                            Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                            <X className="h-3.5 w-3.5" />
                            Absent
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {record.makeupRequired ? (
                          record.makeupCompleted ? (
                            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                              Completed
                            </span>
                          ) : (
                            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                              Required
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">
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
        )}
      </div>

      {/* Mark Attendance Modal */}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Header */}

            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Mark Attendance
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {formatDate(selectedDate)}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {/* Error */}

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">
                    {formError}
                  </p>
                </div>
              )}

              {/* Student */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Student *
                </label>

                <select
                  name="student"
                  value={form.student}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                >
                  <option value="">
                    Select student
                  </option>

                  {availableStudents.map(
                    (student) => (
                      <option
                        key={student._id}
                        value={student._id}
                      >
                        {student.name}
                      </option>
                    ),
                  )}
                </select>

                {availableStudents.length ===
                  0 && (
                  <p className="mt-1.5 text-xs text-orange-600">
                    All students already have
                    attendance marked for this date.
                  </p>
                )}
              </div>

              {/* Training Day */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Training Day *
                </label>

                <input
                  name="planDay"
                  type="number"
                  min="1"
                  value={form.planDay}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                />
              </div>

              {/* Curriculum */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Curriculum Title
                </label>

                <input
                  name="curriculumTitle"
                  value={form.curriculumTitle}
                  onChange={handleFormChange}
                  placeholder="e.g. Basic Stances & Punches"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                />
              </div>

              {/* Status */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Status *
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleStatusChange(
                        "PRESENT",
                      )
                    }
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      form.status ===
                      "PRESENT"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    Present
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleStatusChange(
                        "ABSENT",
                      )
                    }
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      form.status ===
                      "ABSENT"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <X className="h-4 w-4" />
                    Absent
                  </button>
                </div>
              </div>

              {/* Makeup */}

              {form.status ===
                "ABSENT" && (
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <input
                    type="checkbox"
                    checked={
                      form.makeupRequired
                    }
                    onChange={
                      handleMakeupChange
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />

                  <div>
                    <p className="text-sm font-medium text-orange-800">
                      Makeup class required
                    </p>

                    <p className="mt-0.5 text-xs text-orange-600">
                      Mark this absence for a future
                      makeup session.
                    </p>
                  </div>
                </label>
              )}

              {/* Footer */}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    availableStudents.length ===
                      0
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-4 w-4" />
                      Mark Attendance
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
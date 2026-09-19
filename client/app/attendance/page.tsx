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
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Plus,
  RefreshCw,
  Users,
  X,
  XCircle,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
} from "@/components/ui";

import { getStudentAttendance } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

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
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStudentName(
  student: AttendanceRecord["student"],
) {
  if (
    typeof student === "object" &&
    student !== null
  ) {
    return student.name || "Unknown Student";
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

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>(
    [],
  );
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

  const [studentTrainingDay, setStudentTrainingDay] =
    useState<number | null>(null);
  const [loadingTrainingDay, setLoadingTrainingDay] =
    useState(false);

  useEffect(() => {
    void loadData();
  }, [selectedDate]);

  // The next training day for a student is whatever comes
  // after their highest already-marked planDay — not a
  // function of the calendar date being viewed. Fetch their
  // real history whenever the selected student changes.
  useEffect(() => {
    if (!form.student) {
      setStudentTrainingDay(null);
      setLoadingTrainingDay(false);
      return;
    }

    let cancelled = false;

    async function loadNextTrainingDay(studentId: string) {
      try {
        setLoadingTrainingDay(true);

        const data = await getStudentAttendance(studentId);

        const history: AttendanceRecord[] = Array.isArray(
          data?.attendance,
        )
          ? data.attendance
          : [];

        const highestMarkedDay = history.reduce(
          (max, record) =>
            Math.max(max, Number(record.planDay) || 0),
          0,
        );

        if (!cancelled) {
          setStudentTrainingDay(highestMarkedDay + 1);
        }
      } catch (trainingDayError) {
        console.error(
          "Failed to load student's attendance history:",
          trainingDayError,
        );

        if (!cancelled) {
          setStudentTrainingDay(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingTrainingDay(false);
        }
      }
    }

    void loadNextTrainingDay(form.student);

    return () => {
      cancelled = true;
    };
  }, [form.student]);

  async function loadData(
    showRefreshLoader = false,
  ) {
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

      const [studentResponse, attendanceResponse] =
        await Promise.all([
          fetch(`${API_URL}/students`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(
            `${API_URL}/attendance?date=${encodeURIComponent(
              selectedDate,
            )}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          ),
        ]);

      if (
        studentResponse.status === 401 ||
        attendanceResponse.status === 401
      ) {
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

      const studentsData =
        await studentResponse.json();
      const attendanceData =
        await attendanceResponse.json();

      setStudents(
        Array.isArray(studentsData?.students)
          ? studentsData.students
          : Array.isArray(studentsData?.data)
            ? studentsData.data
            : [],
      );

      setAttendance(
        Array.isArray(attendanceData?.attendance)
          ? attendanceData.attendance
          : Array.isArray(attendanceData?.records)
            ? attendanceData.records
            : Array.isArray(attendanceData?.data)
              ? attendanceData.data
              : [],
      );
    } catch (loadError) {
      console.error(
        "Attendance loading error:",
        loadError,
      );

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
      setForm((previous) => ({
        ...previous,
        [name]: (
          event.target as HTMLInputElement
        ).checked,
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError("");
    setSuccess("");

    if (!form.student) {
      setFormError("Please select a student.");
      return;
    }

    if (!form.curriculumTitle.trim()) {
      setFormError(
        "Please enter the curriculum for this training day.",
      );
      return;
    }

    if (loadingTrainingDay) {
      setFormError(
        "Still checking this student's training history — please wait a moment.",
      );
      return;
    }

    if (!studentTrainingDay) {
      setFormError(
        "Training day could not be determined for this student.",
      );
      return;
    }

    if (
      form.status === "ABSENT" &&
      !form.makeupRequired
    ) {
      const confirmed = window.confirm(
        "This student is absent. Do you want to continue without scheduling a makeup class?",
      );

      if (!confirmed) return;
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
            planDay: studentTrainingDay,
            curriculumTitle:
              form.curriculumTitle,
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
          data?.message ||
            "Failed to mark attendance.",
        );
      }

      setSuccess(
        data?.message ||
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
      console.error(
        "Attendance submit error:",
        submitError,
      );

      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to mark attendance.",
      );
    } finally {
      setSaving(false);
    }
  }

  const presentCount = useMemo(
    () =>
      attendance.filter(
        (record) => record.status === "PRESENT",
      ).length,
    [attendance],
  );

  const absentCount = useMemo(
    () =>
      attendance.filter(
        (record) => record.status === "ABSENT",
      ).length,
    [attendance],
  );

  const pendingMakeupCount = useMemo(
    () =>
      attendance.filter(
        (record) =>
          record.status === "ABSENT" &&
          record.makeupRequired &&
          !record.makeupCompleted,
      ).length,
    [attendance],
  );

  const attendancePercentage =
    attendance.length > 0
      ? Math.round(
          (presentCount / attendance.length) * 100,
        )
      : 0;

  const selectedStudent = students.find(
    (student) => student._id === form.student,
  );

  const markedStudentIds = useMemo(
    () =>
      new Set(
        attendance.map((record) =>
          typeof record.student === "object" &&
          record.student !== null
            ? record.student._id
            : record.student,
        ),
      ),
    [attendance],
  );

  const availableStudents = useMemo(
    () =>
      students.filter((student) => {
        if (markedStudentIds.has(student._id)) {
          return false;
        }

        if (!student.registrationDate) {
          return true;
        }

        const registration = new Date(
          `${student.registrationDate.slice(0, 10)}T00:00:00`,
        );
        const attendanceDate = new Date(
          `${selectedDate}T00:00:00`,
        );

        if (
          Number.isNaN(registration.getTime()) ||
          Number.isNaN(attendanceDate.getTime())
        ) {
          return true;
        }

        return registration <= attendanceDate;
      }),
    [students, markedStudentIds, selectedDate],
  );

  if (loading) {
    return (
      <div className="df-page">
        <Card className="min-h-[420px]">
          <LoadingSpinner
            size="lg"
            text="Loading attendance..."
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
        title="Attendance"
        description="Track daily student attendance, training days, and missed-class makeups."
        actions={
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setFormError("");
              setShowForm(true);
            }}
          >
            <Plus size={17} />
            Mark Attendance
          </Button>
        }
      />

      {error && (
        <div className="mb-5">
          <ErrorState
            title="Attendance data could not be loaded"
            message={error}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void loadData(true)
                }
              >
                <RefreshCw size={15} />
                Try Again
              </Button>
            }
          />
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-(--green)/25 bg-(--green-soft) px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--green-soft) text-(--green)">
              <CheckCircle2 size={18} />
            </div>
            <p className="text-sm font-semibold text-(--green)">
              {success}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="rounded-lg p-1.5 text-(--green) transition hover:bg-(--green)/10"
            aria-label="Dismiss success message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <Card padding="md">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-(--accent)">
              <CalendarDays size={22} />
            </div>

            <div>
              <h2 className="text-base font-extrabold text-(--foreground)">
                Attendance Date
              </h2>
              <p className="mt-1 text-sm text-(--ink-muted)">
                Select a date to view or manage
                attendance.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label
              htmlFor="attendance-date"
              className="text-xs font-bold uppercase tracking-wide text-(--ink-muted)"
            >
              Selected date
            </label>

            <Input
              id="attendance-date"
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="h-11 sm:w-48"
            />

            <Button
              variant="outline"
              size="md"
              onClick={() =>
                void loadData(true)
              }
              disabled={refreshing}
              aria-label="Refresh attendance"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
              <span className="hidden sm:inline">
                Refresh
              </span>
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Marked"
          value={attendance.length}
          subtitle="Records for selected date"
          icon={<Users size={19} />}
        />

        <SummaryCard
          title="Present"
          value={presentCount}
          subtitle="Students present today"
          icon={<CheckCircle2 size={19} />}
        />

        <SummaryCard
          title="Absent"
          value={absentCount}
          subtitle="Students absent today"
          icon={<XCircle size={19} />}
        />

        <SummaryCard
          title="Pending Makeups"
          value={pendingMakeupCount}
          subtitle="Absences needing attention"
          icon={<Clock3 size={19} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-(--line) px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-(--accent)">
                  Daily records
                </p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-(--foreground)">
                  Attendance Records
                </h2>
                <p className="mt-1 text-sm text-(--ink-muted)">
                  {formatDate(selectedDate)}
                </p>
              </div>

              <Badge variant="default">
                {attendance.length}{" "}
                {attendance.length === 1
                  ? "Record"
                  : "Records"}
              </Badge>
            </div>
          </div>

          {attendance.length === 0 ? (
            <EmptyState
              title="No attendance records"
              description="There are no attendance records for the selected date. Mark attendance to create the first record."
              icon={<CalendarDays size={24} />}
              className="py-20"
            />
          ) : (
            <AttendanceTable
              attendance={attendance}
            />
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
              <ClipboardCheck size={18} />
            </div>

            <div>
              <h2 className="text-base font-extrabold text-(--foreground)">
                Daily Overview
              </h2>
              <p className="mt-1 text-xs text-(--ink-muted)">
                Selected date summary
              </p>
            </div>
          </div>

          <div className="mt-7 flex justify-center">
            <AttendanceRing
              percentage={attendancePercentage}
            />
          </div>

          <div className="mt-7 space-y-3">
            <OverviewRow
              label="Present"
              value={presentCount}
              dotClass="bg-(--green)"
            />
            <OverviewRow
              label="Absent"
              value={absentCount}
              dotClass="bg-(--red)"
            />
            <OverviewRow
              label="Pending Makeups"
              value={pendingMakeupCount}
              dotClass="bg-(--orange)"
            />
            <div className="border-t border-(--line) pt-3">
              <OverviewRow
                label="Total Marked"
                value={attendance.length}
                dotClass="bg-(--accent)"
              />
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={showForm}
        onClose={() => {
          if (!saving) {
            setShowForm(false);
            setFormError("");
          }
        }}
        title="Mark Attendance"
        description={`Create an attendance record for ${formatDate(
          selectedDate,
        )}.`}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setFormError("");
              }}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              type="submit"
              form="attendance-form"
              loading={saving}
              disabled={loadingTrainingDay}
            >
              Save Attendance
            </Button>
          </div>
        }
      >
        <form
          id="attendance-form"
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {formError && (
            <div className="flex items-start gap-3 rounded-xl border border-(--red)/25 bg-(--red-soft) p-3.5">
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0 text-(--red)"
              />
              <p className="text-sm font-semibold text-(--red)">
                {formError}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="student"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-(--foreground-soft)"
            >
              Student
            </label>

            <Select
              id="student"
              name="student"
              value={form.student}
              onChange={handleFormChange}
              disabled={availableStudents.length === 0}
            >
              <option value="">
                {availableStudents.length === 0
                  ? "No eligible students for this date"
                  : "Select student"}
              </option>

              {availableStudents.map(
                (student) => (
                  <option
                    key={student._id}
                    value={student._id}
                  >
                    {student.name}
                    {student.plan?.name
                      ? ` • ${student.plan.name}`
                      : ""}
                  </option>
                ),
              )}
            </Select>
          </div>

          {selectedStudent && (
            <StudentContext
              student={selectedStudent}
              trainingDay={studentTrainingDay}
              loading={loadingTrainingDay}
            />
          )}

          <div>
            <label
              htmlFor="curriculumTitle"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-(--foreground-soft)"
            >
              Curriculum
              <span className="ml-1 text-(--danger)">
                *
              </span>
            </label>

            <Input
              id="curriculumTitle"
              name="curriculumTitle"
              value={form.curriculumTitle}
              onChange={handleFormChange}
              placeholder="e.g. Warm-up + Basic Stance"
              required
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-(--foreground-soft)"
            >
              Attendance Status
            </label>

            <Select
              id="status"
              name="status"
              value={form.status}
              onChange={handleFormChange}
            >
              <option value="PRESENT">
                Present
              </option>
              <option value="ABSENT">
                Absent
              </option>
            </Select>
          </div>

          {form.status === "ABSENT" && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--orange)/25 bg-(--orange-soft) p-4">
              <input
                type="checkbox"
                name="makeupRequired"
                checked={form.makeupRequired}
                onChange={handleFormChange}
                className="mt-0.5 h-4 w-4 rounded border-(--line-strong) accent-(--orange)"
              />

              <span>
                <span className="block text-sm font-bold text-(--foreground)">
                  Require makeup class
                </span>
                <span className="mt-1 block text-xs leading-5 text-(--ink-muted)">
                  Schedule this missed class for
                  makeup training.
                </span>
              </span>
            </label>
          )}
        </form>
      </Modal>
    </div>
  );
}

function AttendanceTable({
  attendance,
}: {
  attendance: AttendanceRecord[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="border-b border-(--line) bg-(--surface)">
            <TableHead>Student</TableHead>
            <TableHead>Training Day</TableHead>
            <TableHead>Curriculum</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Makeup</TableHead>
          </tr>
        </thead>

        <tbody>
          {attendance.map((record) => {
            const studentName =
              getStudentName(record.student);
            const isPresent =
              record.status === "PRESENT";

            return (
              <tr
                key={record._id}
                className="border-b border-(--line) last:border-b-0 transition-colors hover:bg-(--hover-bg)"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--accent-soft) text-xs font-extrabold text-(--accent)">
                      {getInitials(
                        studentName,
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-(--foreground)">
                        {studentName}
                      </p>
                      <p className="mt-0.5 text-xs text-(--ink-muted)">
                        {formatDate(record.date)}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4 text-sm font-semibold text-(--foreground-soft)">
                  Day {record.planDay ?? "—"}
                </td>

                <td className="max-w-[230px] px-4 py-4">
                  <span className="block truncate text-sm text-(--ink-muted)">
                    {record.curriculumTitle ||
                      "No curriculum recorded"}
                  </span>
                </td>

                <td className="px-4 py-4">
                  {isPresent ? (
                    <Badge variant="success">
                      <CheckCircle2 size={13} />
                      Present
                    </Badge>
                  ) : (
                    <Badge variant="danger">
                      <XCircle size={13} />
                      Absent
                    </Badge>
                  )}
                </td>

                <td className="px-4 py-4">
                  {!record.makeupRequired ? (
                    <span className="text-sm text-(--ink-faint)">
                      —
                    </span>
                  ) : record.makeupCompleted ? (
                    <Badge variant="success">
                      Completed
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      Pending
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableHead({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-(--ink-muted)">
      {children}
    </th>
  );
}

function AttendanceRing({
  percentage,
}: {
  percentage: number;
}) {
  return (
    <div
      className="relative flex h-44 w-44 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--green) ${percentage}%, var(--line) 0)`,
      }}
    >
      <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border border-(--line) bg-(--card)">
        <span className="text-3xl font-extrabold tracking-tight text-(--foreground)">
          {percentage}%
        </span>
        <span className="mt-1 text-xs font-semibold text-(--ink-muted)">
          Present
        </span>
      </div>
    </div>
  );
}

function OverviewRow({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <span
          className={`h-2.5 w-2.5 rounded-full ${dotClass}`}
        />
        <span className="text-sm text-(--foreground-soft)">
          {label}
        </span>
      </div>

      <span className="text-sm font-extrabold text-(--foreground)">
        {value}
      </span>
    </div>
  );
}

function StudentContext({
  student,
  trainingDay,
  loading,
}: {
  student: Student;
  trainingDay: number | null;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-(--line) bg-(--surface) p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-sm font-extrabold text-(--accent)">
          {getInitials(student.name)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-(--foreground)">
            {student.name}
          </p>

          <p className="mt-0.5 truncate text-xs text-(--ink-muted)">
            {student.plan?.name ||
              "No plan assigned"}
            {student.currentBelt
              ? ` • ${student.currentBelt}`
              : ""}
          </p>
        </div>

        {loading ? (
          <Badge variant="default">
            Checking...
          </Badge>
        ) : (
          trainingDay && (
            <Badge variant="default">
              Day {trainingDay}
            </Badge>
          )
        )}
      </div>
    </div>
  );
}
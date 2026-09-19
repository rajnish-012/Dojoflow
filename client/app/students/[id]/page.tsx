"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Target,
  UserRound,
  Users,
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

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  SummaryCard,
  Select,
} from "@/components/ui";

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

type PlanOption = {
  _id: string;
  name: string;
  price: number;
};

type EditForm = {
  name: string;
  age: string;
  phone: string;
  email: string;
  plan: string;
  currentBelt: string;
  status: Student["status"];
  password: string;
};

const initialEditForm: EditForm = {
  name: "",
  age: "",
  phone: "",
  email: "",
  plan: "",
  currentBelt: "",
  status: "ACTIVE",
  password: "",
};

function extractRecords(
  response: unknown,
  keys: string[],
): any[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    response &&
    typeof response === "object"
  ) {
    const value =
      response as Record<string, any>;

    for (const key of keys) {
      if (Array.isArray(value[key])) {
        return value[key];
      }
    }

    if (
      value.data &&
      value.data !== response
    ) {
      return extractRecords(
        value.data,
        keys,
      );
    }

    if (
      value.result &&
      value.result !== response
    ) {
      return extractRecords(
        value.result,
        keys,
      );
    }
  }

  return [];
}

function getRating(
  record: PerformanceRecord,
) {
  const value =
    record.rating ??
    record.score ??
    record.marks ??
    record.performanceRating ??
    record.evaluationRating;

  const rating = Number(value);

  return Number.isFinite(rating)
    ? rating
    : 0;
}

function calculateAverageRating(
  records: PerformanceRecord[],
) {
  const ratings = records
    .map(getRating)
    .filter((rating) => rating > 0);

  if (!ratings.length) {
    return 0;
  }

  return Math.round(
    (ratings.reduce(
      (sum, rating) => sum + rating,
      0,
    ) /
      ratings.length) *
      10,
  ) / 10;
}

function formatDate(date?: string) {
  if (!date) {
    return "—";
  }

  const parsedDate = new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
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

function getInitials(name?: string) {
  if (!name) {
    return "ST";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getStatusVariant(
  status: Student["status"],
) {
  if (status === "ACTIVE") {
    return "success" as const;
  }

  if (status === "COMPLETED") {
    return "info" as const;
  }

  return "default" as const;
}

function getStatusLabel(
  status: Student["status"],
) {
  if (status === "ACTIVE") {
    return "Active";
  }

  if (status === "COMPLETED") {
    return "Completed";
  }

  return "Inactive";
}

function SectionHeading({
  eyebrow,
  title,
  icon,
  action,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="
            flex h-10 w-10 shrink-0
            items-center justify-center
            rounded-xl
            bg-(--accent-soft)
            text-(--accent)
          "
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p
            className="
              text-[10px] font-black
              uppercase tracking-[0.16em]
              text-(--accent)
            "
          >
            {eyebrow}
          </p>

          <h2
            className="
              mt-1 text-lg font-extrabold
              tracking-tight
              text-(--foreground)
            "
          >
            {title}
          </h2>
        </div>
      </div>

      {action}
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div
      className="
        flex items-start gap-3
        border-b border-(--line)
        py-4 last:border-b-0
      "
    >
      <div
        className="
          flex h-9 w-9 shrink-0
          items-center justify-center
          rounded-lg
          bg-(--surface)
          text-(--ink-muted)
        "
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p
          className="
            text-[10px] font-black
            uppercase tracking-[0.12em]
            text-(--ink-faint)
          "
        >
          {label}
        </p>

        <p
          className="
            mt-1 break-words text-sm
            font-semibold
            text-(--foreground-soft)
          "
        >
          {value}
        </p>

        {description && (
          <p
            className="
              mt-1 text-xs leading-5
              text-(--ink-muted)
            "
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  valueClassName = "text-(--foreground)",
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div
      className="
        rounded-xl
        border border-(--line)
        bg-(--surface)
        p-3.5
      "
    >
      <p
        className="
          text-[10px] font-bold
          uppercase tracking-[0.1em]
          text-(--ink-faint)
        "
      >
        {label}
      </p>

      <p
        className={`
          mt-1 text-lg font-black
          ${valueClassName}
        `}
      >
        {value}
      </p>
    </div>
  );
}

function RecordStat({
  icon,
  iconClass,
  label,
  description,
  value,
}: {
  icon: ReactNode;
  iconClass: string;
  label: string;
  description: string;
  value: number;
}) {
  return (
    <div
      className="
        flex items-center
        justify-between gap-3
        rounded-xl
        border border-(--line)
        bg-(--surface)
        p-3.5
      "
    >
      <div
        className="
          flex min-w-0
          items-center gap-3
        "
      >
        <div
          className={`
            flex h-9 w-9 shrink-0
            items-center justify-center
            rounded-lg
            ${iconClass}
          `}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p
            className="
              text-sm font-bold
              text-(--foreground-soft)
            "
          >
            {label}
          </p>

          <p
            className="
              mt-0.5 text-xs
              text-(--ink-faint)
            "
          >
            {description}
          </p>
        </div>
      </div>

      <span
        className="
          text-xl font-black
          text-(--foreground)
        "
      >
        {value}
      </span>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div
        className="
          mb-4 flex items-center gap-3
        "
      >
        <span
          className="
            h-5 w-1 rounded-full
            bg-(--accent)
          "
        />

        <h3
          className="
            text-[10px] font-black
            uppercase tracking-[0.16em]
            text-(--ink-muted)
          "
        >
          {title}
        </h3>
      </div>

      <div
        className="
          grid gap-5
          sm:grid-cols-2
        "
      >
        {children}
      </div>
    </section>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        className="
          mb-2 flex items-center
          justify-between gap-3
        "
      >
        <label
          htmlFor={htmlFor}
          className="
            text-xs font-bold
            text-(--foreground-soft)
          "
        >
          {label}

          {required && (
            <span
              className="
                ml-1 text-(--danger)
              "
            >
              *
            </span>
          )}
        </label>

        {hint && (
          <span
            className="
              text-[10px]
              text-(--ink-faint)
            "
          >
            {hint}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

export default function StudentDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const studentId = String(
    params.id || "",
  );

  const [student, setStudent] =
    useState<Student | null>(null);

  const [progress, setProgress] =
    useState<Progress | null>(null);

  const [attendance, setAttendance] =
    useState<AttendanceRecord[]>([]);

  const [performance, setPerformance] =
    useState<PerformanceRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [editError, setEditError] =
    useState("");

  const [plans, setPlans] =
    useState<PlanOption[]>([]);

  const [editForm, setEditForm] =
    useState<EditForm>(initialEditForm);

  const loadStudent = async () => {
    if (!studentId) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [
        studentData,
        progressData,
      ] = await Promise.all([
        getStudentById(studentId),
        getStudentProgress(studentId),
      ]);

      setStudent(studentData.student);
      setProgress(progressData.progress);

      const [
        attendanceResult,
        performanceResult,
      ] = await Promise.allSettled([
        getStudentAttendance(studentId),
        getStudentPerformance(studentId),
      ]);

      if (
        attendanceResult.status ===
        "fulfilled"
      ) {
        setAttendance(
          extractRecords(
            attendanceResult.value,
            [
              "attendance",
              "records",
              "items",
            ],
          ),
        );
      } else {
        console.error(
          "Failed to load attendance:",
          attendanceResult.reason,
        );

        setAttendance([]);
      }

      if (
        performanceResult.status ===
        "fulfilled"
      ) {
        setPerformance(
          extractRecords(
            performanceResult.value,
            [
              "performance",
              "records",
              "items",
            ],
          ),
        );
      } else {
        console.error(
          "Failed to load performance:",
          performanceResult.reason,
        );

        setPerformance([]);
      }
    } catch (loadError) {
      console.error(loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load student details.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudent();
  }, [studentId]);

  const openEditModal = async () => {
    if (!student) {
      return;
    }

    setEditError("");

    setEditForm({
      name: student.name || "",
      age: String(student.age || ""),
      phone: student.phone || "",
      email: student.email || "",
      plan: student.plan?._id || "",
      currentBelt:
        student.currentBelt || "White",
      status:
        student.status || "ACTIVE",
      password: "",
    });

    setShowEditModal(true);

    try {
      const data = await getPlans();

      setPlans(data.plans || []);
    } catch (planError) {
      console.error(planError);

      setEditError(
        "Unable to load training plans. Please try again.",
      );
    }
  };

  const closeEditModal = () => {
    if (saving) {
      return;
    }

    setShowEditModal(false);
    setEditError("");
  };

  const handleEditChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) => {
    const {
      name,
      value,
    } = event.target;

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
      setEditError(
        "Please fill all required fields.",
      );

      return;
    }

    if (Number(editForm.age) < 1) {
      setEditError(
        "Age must be greater than zero.",
      );

      return;
    }

    if (
      editForm.password.trim() &&
      editForm.password.trim().length < 6
    ) {
      setEditError(
        "New password must be at least 6 characters.",
      );

      return;
    }

    try {
      setSaving(true);

      await updateStudent(
        studentId,
        {
          name: editForm.name.trim(),
          age: Number(editForm.age),
          phone: editForm.phone.trim(),
          email:
            editForm.email.trim() ||
            undefined,
          plan: editForm.plan,
          currentBelt:
            editForm.currentBelt,
          status: editForm.status,
          password:
            editForm.password.trim() ||
            undefined,
        },
      );

      await loadStudent();

      setShowEditModal(false);
      setEditError("");
    } catch (updateError) {
      console.error(updateError);

      setEditError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update student.",
      );
    } finally {
      setSaving(false);
    }
  };

  const attendanceStats =
    useMemo(() => {
      const presentFromRecords =
        attendance.filter(
          (record) =>
            String(record.status)
              .toUpperCase() ===
            "PRESENT",
        ).length;

      const absentFromRecords =
        attendance.filter(
          (record) =>
            String(record.status)
              .toUpperCase() ===
            "ABSENT",
        ).length;

      const pendingFromRecords =
        attendance.filter(
          (record) =>
            record.makeupRequired &&
            !record.makeupCompleted,
        ).length;

      const completedFromRecords =
        attendance.filter(
          (record) =>
            record.makeupRequired &&
            record.makeupCompleted,
        ).length;

      const apiPresent =
        progress?.presentClasses ?? 0;

      const apiAbsent =
        progress?.absentClasses ?? 0;

      const hasApiAttendance =
        apiPresent + apiAbsent > 0;

      const present =
        hasApiAttendance
          ? apiPresent
          : presentFromRecords;

      const absent =
        hasApiAttendance
          ? apiAbsent
          : absentFromRecords;

      const pending =
        progress?.pendingMakeups ??
        pendingFromRecords;

      const completed =
        progress?.completedMakeups ??
        completedFromRecords;

      const total =
        present + absent;

      const attendanceRate =
        total > 0
          ? Math.round(
              (present / total) * 100,
            )
          : 0;

      const completedDays =
        present + completed;

      const totalDays =
        progress?.totalCurriculumDays ||
        total;

      const progressPercent =
        totalDays > 0
          ? Math.min(
              (completedDays / totalDays) *
                100,
              100,
            )
          : 0;

      return {
        present,
        absent,
        pending,
        completed,
        total,
        attendanceRate,
        completedDays,
        totalDays,
        progressPercent,
      };
    }, [
      attendance,
      progress,
    ]);

  const avgRating = useMemo(() => {
    const apiRating = Number(
      progress?.averageRating ?? 0,
    );

    if (
      Number.isFinite(apiRating) &&
      apiRating > 0
    ) {
      return apiRating;
    }

    return calculateAverageRating(
      performance,
    );
  }, [
    performance,
    progress?.averageRating,
  ]);

  if (loading) {
    return (
      <main
        className="
          flex min-h-[calc(100vh-76px)]
          items-center justify-center
          bg-(--background)
          px-4
        "
      >
        <LoadingSpinner
          size="md"
          text="Loading student details..."
        />
      </main>
    );
  }

  if (error || !student) {
    return (
      <main
        className="
          min-h-[calc(100vh-76px)]
          bg-(--background)
          px-4 py-6
          sm:px-6
          lg:px-8
        "
      >
        <div className="mx-auto max-w-[1500px]">
          <Button
            variant="ghost"
            onClick={() =>
              router.push("/students")
            }
          >
            <ArrowLeft size={17} />
            Back to Students
          </Button>

          <div className="mt-5">
            <ErrorState
              title="Unable to load student"
              message={
                error ||
                "Student could not be found."
              }
              action={
                <Button
                  variant="outline"
                  onClick={loadStudent}
                >
                  Try again
                </Button>
              }
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        min-h-[calc(100vh-76px)]
        bg-(--background)
        px-4 py-6
        sm:px-6
        lg:px-8
        xl:px-10
      "
    >
      <div
        className="
          mx-auto max-w-[1500px]
          space-y-6
        "
      >
        {/* Navigation */}
        <div
          className="
            flex flex-wrap
            items-center justify-between
            gap-3
          "
        >
          <Button
            variant="ghost"
            onClick={() =>
              router.push("/students")
            }
          >
            <ArrowLeft size={17} />
            Back to Students
          </Button>

          <div
            className="
              hidden items-center gap-2
              text-xs font-medium
              text-(--ink-faint)
              sm:flex
            "
          >
            <span>Students</span>

            <ChevronRight size={14} />

            <span
              className="
                font-semibold
                text-(--ink-muted)
              "
            >
              {student.name}
            </span>
          </div>
        </div>

        {/* Student Hero */}
        <Card
          padding="none"
          className="overflow-hidden"
        >
          <div
            className="
              h-1
              bg-gradient-to-r
              from-(--gold)
              via-(--accent)
              to-(--gold)
            "
          />

          <div className="p-5 sm:p-7">
            <div
              className="
                flex flex-col gap-6
                xl:flex-row
                xl:items-center
                xl:justify-between
              "
            >
              <div
                className="
                  flex min-w-0
                  items-center gap-4
                  sm:gap-5
                "
              >
                <div
                  className="
                    flex h-16 w-16 shrink-0
                    items-center justify-center
                    rounded-2xl
                    border border-(--line)
                    bg-(--sidebar-logo-bg)
                    text-lg font-black
                    text-(--gold)
                    shadow-sm
                    sm:h-20 sm:w-20
                    sm:text-2xl
                  "
                >
                  {getInitials(
                    student.name,
                  )}
                </div>

                <div className="min-w-0">
                  <div
                    className="
                      flex flex-wrap
                      items-center gap-2.5
                    "
                  >
                    <h1
                      className="
                        text-2xl font-black
                        tracking-tight
                        text-(--foreground)
                        sm:text-3xl
                      "
                    >
                      {student.name}
                    </h1>

                    <Badge
                      variant={getStatusVariant(
                        student.status,
                      )}
                    >
                      {getStatusLabel(
                        student.status,
                      )}
                    </Badge>
                  </div>

                  <div
                    className="
                      mt-2 flex flex-wrap
                      items-center
                      gap-x-3 gap-y-1
                      text-sm
                      text-(--ink-muted)
                    "
                  >
                    <span>
                      Age {student.age}
                    </span>

                    <span>•</span>

                    <span>
                      {student.currentBelt} Belt
                    </span>

                    {student.branch?.name && (
                      <>
                        <span>•</span>

                        <span>
                          {student.branch.name}
                        </span>
                      </>
                    )}
                  </div>

                  <p
                    className="
                      mt-2 flex items-center
                      gap-1.5 text-xs
                      text-(--ink-faint)
                    "
                  >
                    <CalendarCheck size={14} />
                    Joined{" "}
                    {formatDate(
                      student.joinDate,
                    )}
                  </p>
                </div>
              </div>

              <div
                className="
                  flex flex-col gap-3
                  sm:flex-row
                "
              >
                <div
                  className="
                    flex items-center gap-3
                    rounded-xl
                    border border-(--line)
                    bg-(--surface)
                    px-4 py-3
                  "
                >
                  <div
                    className="
                      flex h-10 w-10
                      items-center justify-center
                      rounded-xl
                      bg-(--accent-soft)
                      text-(--accent)
                    "
                  >
                    <Award size={19} />
                  </div>

                  <div>
                    <p
                      className="
                        text-[9px] font-black
                        uppercase
                        tracking-[0.12em]
                        text-(--ink-faint)
                      "
                    >
                      Current Belt
                    </p>

                    <p
                      className="
                        mt-0.5 text-sm font-bold
                        text-(--foreground)
                      "
                    >
                      {student.currentBelt}
                    </p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  onClick={() =>
                    router.push(
                      `/students/${studentId}/progress`,
                    )
                  }
                >
                  <Target size={17} />
                  View Progress
                </Button>

                <Button
                  variant="outline"
                  onClick={openEditModal}
                >
                  <Pencil size={16} />
                  Edit Student
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Summary */}
        <div
          className="
            grid gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <SummaryCard
            title="Training Day"
            value={
              progress?.currentTrainingDay ??
              attendanceStats.total
            }
            subtitle="Current curriculum day"
            icon={<Target size={20} />}
          />

          <SummaryCard
            title="Attendance"
            value={`${attendanceStats.attendanceRate}%`}
            subtitle="Overall attendance rate"
            icon={
              <CheckCircle2 size={20} />
            }
          />

          <SummaryCard
            title="Completed Days"
            value={
              attendanceStats.completedDays
            }
            subtitle={`Of ${attendanceStats.totalDays} curriculum days`}
            icon={
              <CalendarCheck size={20} />
            }
          />

          <SummaryCard
            title="Pending Makeups"
            value={
              attendanceStats.pending
            }
            subtitle="Classes requiring attention"
            icon={<Clock3 size={20} />}
          />
        </div>

        {/* Profile / Plan / Progress */}
        <div
          className="
            grid gap-5
            xl:grid-cols-12
          "
        >
          <Card
            padding="lg"
            className="xl:col-span-4"
          >
            <SectionHeading
              eyebrow="Profile"
              title="Personal Information"
              icon={
                <UserRound size={19} />
              }
            />

            <div className="mt-4">
              <DetailItem
                icon={<Phone size={16} />}
                label="Phone Number"
                value={student.phone}
              />

              <DetailItem
                icon={<Mail size={16} />}
                label="Email Address"
                value={
                  student.email ||
                  "No email added"
                }
              />

              <DetailItem
                icon={<Users size={16} />}
                label="Branch"
                value={
                  student.branch?.name ||
                  "No branch assigned"
                }
                description={
                  student.branch?.address
                }
              />

              <DetailItem
                icon={
                  <CalendarCheck
                    size={16}
                  />
                }
                label="Joining Date"
                value={formatDate(
                  student.joinDate,
                )}
              />
            </div>
          </Card>

          <Card
            padding="lg"
            className="xl:col-span-4"
          >
            <SectionHeading
              eyebrow="Subscription"
              title="Training Plan"
              icon={
                <ShieldCheck size={19} />
              }
            />

            {student.plan ? (
              <div className="mt-5">
                <div
                  className="
                    rounded-2xl
                    border
                    border-(--sidebar-line)
                    bg-(--sidebar-bg)
                    p-5
                    text-(--sidebar-text)
                  "
                >
                  <div
                    className="
                      flex items-start
                      justify-between gap-3
                    "
                  >
                    <div>
                      <p
                        className="
                          text-[10px] font-bold
                          uppercase
                          tracking-[0.12em]
                          text-(--sidebar-muted)
                        "
                      >
                        Current Plan
                      </p>

                      <h3
                        className="
                          mt-2 text-xl
                          font-black
                        "
                      >
                        {student.plan.name}
                      </h3>
                    </div>

                    <Badge variant="success">
                      Active
                    </Badge>
                  </div>

                  <div
                    className="
                      mt-6 grid grid-cols-2
                      gap-3
                    "
                  >
                    <PlanMetric
                      label="Price"
                      value={`₹${student.plan.price}`}
                    />

                    <PlanMetric
                      label="Duration"
                      value={`${student.plan.duration} ${student.plan.durationUnit.toLowerCase()}`}
                    />
                  </div>
                </div>

                <div
                  className="
                    mt-3 grid grid-cols-2
                    gap-3
                  "
                >
                  <MiniMetric
                    label="Classes / Week"
                    value={
                      student.plan
                        .classesPerWeek
                    }
                  />

                  <MiniMetric
                    label="Plan Status"
                    value="Active"
                    valueClassName="
                      text-(--green)
                    "
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                className="mt-5 min-h-[250px]"
                title="No training plan"
                description="
                  Assign a training plan to begin
                  tracking this student's training.
                "
                icon={
                  <ShieldCheck size={22} />
                }
              />
            )}
          </Card>

          <Card
            padding="lg"
            className="xl:col-span-4"
          >
            <SectionHeading
              eyebrow="Performance"
              title="Training Progress"
              icon={<Target size={19} />}
              action={
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/students/${studentId}/progress`,
                    )
                  }
                  className="
                    text-xs font-bold
                    text-(--accent)
                    transition-colors
                    hover:text-(--accent-hover)
                  "
                >
                  Details{" "}
                  <ArrowUpRight
                    size={13}
                    className="ml-0.5 inline"
                  />
                </button>
              }
            />

            <div className="mt-5">
              <div
                className="
                  flex items-end
                  justify-between gap-4
                "
              >
                <div>
                  <p
                    className="
                      text-[10px] font-black
                      uppercase
                      tracking-[0.12em]
                      text-(--ink-faint)
                    "
                  >
                    Current Training Day
                  </p>

                  <p
                    className="
                      mt-2 text-4xl font-black
                      tracking-tight
                      text-(--foreground)
                    "
                  >
                    {progress?.currentTrainingDay ??
                      attendanceStats.completedDays}
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className="
                      text-xs
                      text-(--ink-muted)
                    "
                  >
                    Curriculum
                  </p>

                  <p
                    className="
                      mt-1 text-sm font-bold
                      text-(--foreground-soft)
                    "
                  >
                    {
                      attendanceStats.completedDays
                    }
                    /
                    {
                      attendanceStats.totalDays
                    }
                  </p>
                </div>
              </div>

              <div
                className="
                  mt-5 h-2.5
                  overflow-hidden
                  rounded-full
                  bg-(--line)
                "
              >
                <div
                  className="
                    h-full rounded-full
                    bg-(--accent)
                    transition-[width]
                    duration-700
                  "
                  style={{
                    width: `${attendanceStats.progressPercent}%`,
                  }}
                />
              </div>

              <div
                className="
                  mt-2 flex justify-between
                  text-xs
                "
              >
                <span
                  className="
                    text-(--ink-faint)
                  "
                >
                  Progress
                </span>

                <span
                  className="
                    font-bold
                    text-(--accent)
                  "
                >
                  {Math.round(
                    attendanceStats.progressPercent,
                  )}
                  %
                </span>
              </div>

              <div
                className="
                  mt-5 grid grid-cols-2
                  gap-3
                "
              >
                <MiniMetric
                  label="Present"
                  value={
                    attendanceStats.present
                  }
                />

                <MiniMetric
                  label="Absent"
                  value={
                    attendanceStats.absent
                  }
                />

                <MiniMetric
                  label="Makeups"
                  value={
                    attendanceStats.pending
                  }
                />

                <MiniMetric
                  label="Rating"
                  value={`${avgRating.toFixed(1)}/5`}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Current Curriculum */}
        <Card padding="lg">
          <SectionHeading
            eyebrow="Learning Path"
            title="Current Curriculum"
            icon={<Target size={19} />}
            action={
              progress?.currentCurriculum ? (
                <Badge variant="warning">
                  Day{" "}
                  {
                    progress
                      .currentCurriculum
                      .day
                  }
                </Badge>
              ) : undefined
            }
          />

          {progress?.currentCurriculum ? (
            <div
              className="
                mt-5 grid gap-4
                lg:grid-cols-[1fr_280px]
              "
            >
              <div
                className="
                  rounded-2xl
                  border border-(--line)
                  bg-(--surface)
                  p-5
                "
              >
                <h3
                  className="
                    text-xl font-extrabold
                    text-(--foreground)
                  "
                >
                  {
                    progress
                      .currentCurriculum
                      .title
                  }
                </h3>

                {progress
                  .currentCurriculum
                  .description && (
                  <p
                    className="
                      mt-3 max-w-3xl
                      text-sm leading-6
                      text-(--ink-muted)
                    "
                  >
                    {
                      progress
                        .currentCurriculum
                        .description
                    }
                  </p>
                )}

                {progress
                  .currentCurriculum
                  .skill && (
                  <div
                    className="
                      mt-5 inline-flex
                      items-center gap-2
                      rounded-lg
                      bg-(--accent-soft)
                      px-3 py-2
                      text-(--accent)
                    "
                  >
                    <Award size={15} />

                    <span className="text-sm font-bold">
                      {
                        progress
                          .currentCurriculum
                          .skill
                      }
                    </span>
                  </div>
                )}
              </div>

              <div
                className="
                  rounded-2xl
                  border border-(--line)
                  bg-(--accent-soft)
                  p-5
                "
              >
                <p
                  className="
                    text-[10px] font-black
                    uppercase
                    tracking-[0.14em]
                    text-(--accent)
                  "
                >
                  Next Focus
                </p>

                <p
                  className="
                    mt-2 text-sm font-semibold
                    leading-6
                    text-(--foreground-soft)
                  "
                >
                  Continue practicing the
                  current curriculum skills
                  consistently.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/students/${studentId}/progress`,
                    )
                  }
                  className="
                    mt-4 inline-flex
                    items-center gap-1
                    text-xs font-bold
                    text-(--accent)
                  "
                >
                  Open full progress
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              className="mt-5 min-h-[220px]"
              title="No current curriculum"
              description="
                Curriculum information will appear
                once training progress is recorded.
              "
              icon={<Target size={22} />}
            />
          )}
        </Card>

        {/* Attendance + Belt */}
        <div
          className="
            grid gap-5
            xl:grid-cols-2
          "
        >
          <Card padding="lg">
            <SectionHeading
              eyebrow="Class Records"
              title="Attendance Summary"
              icon={
                <CalendarCheck size={19} />
              }
              action={
                <Badge variant="success">
                  {
                    attendanceStats.attendanceRate
                  }
                  %
                </Badge>
              }
            />

            <div className="mt-5 space-y-3">
              <RecordStat
                icon={
                  <CheckCircle2 size={18} />
                }
                iconClass="
                  bg-(--green-soft)
                  text-(--green)
                "
                label="Present Classes"
                description="Successfully attended"
                value={
                  attendanceStats.present
                }
              />

              <RecordStat
                icon={<XCircle size={18} />}
                iconClass="
                  bg-(--red-soft)
                  text-(--red)
                "
                label="Absent Classes"
                description="Missed training sessions"
                value={
                  attendanceStats.absent
                }
              />

              <RecordStat
                icon={<Clock3 size={18} />}
                iconClass="
                  bg-(--orange-soft)
                  text-(--orange)
                "
                label="Pending Makeups"
                description="Classes still to be completed"
                value={
                  attendanceStats.pending
                }
              />

              <RecordStat
                icon={
                  <CheckCircle2 size={18} />
                }
                iconClass="
                  bg-(--blue-soft)
                  text-(--blue)
                "
                label="Completed Makeups"
                description="Previously recovered classes"
                value={
                  attendanceStats.completed
                }
              />
            </div>
          </Card>

          <Card padding="lg">
            <SectionHeading
              eyebrow="Achievement Path"
              title="Belt Progression"
              icon={<Award size={19} />}
            />

            {progress?.nextMilestone ? (
              <div className="mt-5">
                <div
                  className="
                    rounded-2xl
                    border border-(--line)
                    bg-(--accent-soft)
                    p-5
                  "
                >
                  <div
                    className="
                      flex items-center gap-4
                    "
                  >
                    <div
                      className="
                        flex h-14 w-14 shrink-0
                        items-center justify-center
                        rounded-2xl
                        bg-(--card)
                        text-(--accent)
                        shadow-sm
                      "
                    >
                      <Award size={25} />
                    </div>

                    <div>
                      <p
                        className="
                          text-[10px] font-black
                          uppercase
                          tracking-[0.12em]
                          text-(--accent)
                        "
                      >
                        Next Milestone
                      </p>

                      <h3
                        className="
                          mt-1 text-xl font-black
                          text-(--foreground)
                        "
                      >
                        {
                          progress
                            .nextMilestone
                            .belt
                        }{" "}
                        Belt
                      </h3>

                      <p
                        className="
                          mt-1 text-xs
                          text-(--ink-muted)
                        "
                      >
                        Target Day{" "}
                        {
                          progress
                            .nextMilestone
                            .day
                        }
                      </p>
                    </div>
                  </div>

                  <div
                    className="
                      mt-5 rounded-xl
                      border border-(--line)
                      bg-(--card)
                      p-4
                    "
                  >
                    <p
                      className="
                        text-sm font-bold
                        text-(--foreground-soft)
                      "
                    >
                      {
                        progress
                          .nextMilestone
                          .skill
                      }
                    </p>

                    {progress
                      .nextMilestone
                      .description && (
                      <p
                        className="
                          mt-2 text-xs
                          leading-5
                          text-(--ink-muted)
                        "
                      >
                        {
                          progress
                            .nextMilestone
                            .description
                        }
                      </p>
                    )}
                  </div>
                </div>

                {progress.achievedMilestone && (
                  <div
                    className="
                      mt-4 flex items-center
                      gap-3 rounded-xl
                      border border-(--green)/20
                      bg-(--green-soft)
                      p-4
                    "
                  >
                    <CheckCircle2
                      size={19}
                      className="
                        shrink-0
                        text-(--green)
                      "
                    />

                    <div>
                      <p
                        className="
                          text-xs font-bold
                          text-(--green)
                        "
                      >
                        Latest Achievement
                      </p>

                      <p
                        className="
                          mt-1 text-sm font-semibold
                          text-(--foreground-soft)
                        "
                      >
                        {
                          progress
                            .achievedMilestone
                            .belt
                        }{" "}
                        Belt
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                className="mt-5 min-h-[250px]"
                title="No upcoming milestone"
                description="
                  Belt progression details will
                  appear as the student advances.
                "
                icon={<Award size={22} />}
              />
            )}
          </Card>
        </div>

        {/* Attendance / Performance History */}
        <div
          className="
            grid gap-5
            xl:grid-cols-2
          "
        >
          <Card padding="lg">
            <SectionHeading
              eyebrow="Recent Records"
              title="Attendance Records"
              icon={
                <CalendarCheck size={19} />
              }
              action={
                <Badge variant="warning">
                  {attendance.length} Records
                </Badge>
              }
            />

            {attendance.length ? (
              <div
                className="
                  mt-5 max-h-[390px]
                  space-y-2.5
                  overflow-y-auto pr-1
                "
              >
                {attendance.map(
                  (record) => {
                    const present =
                      String(
                        record.status,
                      ).toUpperCase() ===
                      "PRESENT";

                    return (
                      <div
                        key={record._id}
                        className="
                          flex items-center
                          justify-between gap-3
                          rounded-xl
                          border border-(--line)
                          bg-(--surface)
                          p-3.5
                          transition-colors
                          hover:bg-(--hover-bg)
                        "
                      >
                        <div
                          className="
                            flex min-w-0
                            items-center gap-3
                          "
                        >
                          <div
                            className={`
                              flex h-9 w-9 shrink-0
                              items-center
                              justify-center
                              rounded-lg
                              ${
                                present
                                  ? "bg-(--green-soft) text-(--green)"
                                  : "bg-(--red-soft) text-(--red)"
                              }
                            `}
                          >
                            {present ? (
                              <CheckCircle2
                                size={17}
                              />
                            ) : (
                              <XCircle
                                size={17}
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p
                              className="
                                truncate text-sm
                                font-bold
                                text-(--foreground-soft)
                              "
                            >
                              {
                                record
                                  .curriculumTitle ||
                                `Training Day ${
                                  record.planDay ??
                                  "-"
                                }`
                              }
                            </p>

                            <p
                              className="
                                mt-1 text-xs
                                text-(--ink-faint)
                              "
                            >
                              {formatDate(
                                record.date,
                              )}
                            </p>
                          </div>
                        </div>

                        <div
                          className="
                            shrink-0 text-right
                          "
                        >
                          <p
                            className="
                              text-[10px] font-black
                              uppercase
                              text-(--foreground-soft)
                            "
                          >
                            {record.status}
                          </p>

                          {record.makeupRequired && (
                            <p
                              className="
                                mt-1 text-[10px]
                                font-bold
                                text-(--orange)
                              "
                            >
                              {record.makeupCompleted
                                ? "Makeup completed"
                                : "Makeup pending"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            ) : (
              <EmptyState
                className="mt-5 min-h-[250px]"
                title="No attendance records"
                description="
                  Attendance records will appear
                  after classes are marked.
                "
                icon={
                  <CalendarCheck size={22} />
                }
              />
            )}
          </Card>

          <Card padding="lg">
            <SectionHeading
              eyebrow="Evaluation History"
              title="Performance Records"
              icon={<Award size={19} />}
              action={
                <Badge variant="info">
                  {performance.length} Reports
                </Badge>
              }
            />

            {performance.length ? (
              <div
                className="
                  mt-5 max-h-[390px]
                  space-y-2.5
                  overflow-y-auto pr-1
                "
              >
                {performance.map(
                  (record) => (
                    <div
                      key={record._id}
                      className="
                        rounded-xl
                        border border-(--line)
                        bg-(--surface)
                        p-4
                      "
                    >
                      <div
                        className="
                          flex items-center
                          justify-between gap-3
                        "
                      >
                        <div>
                          <p
                            className="
                              text-sm font-bold
                              text-(--foreground-soft)
                            "
                          >
                            Performance Evaluation
                          </p>

                          <p
                            className="
                              mt-1 text-xs
                              text-(--ink-faint)
                            "
                          >
                            {formatDate(
                              record.evaluationDate,
                            )}
                          </p>
                        </div>

                        <div
                          className="
                            rounded-lg
                            bg-(--accent-soft)
                            px-3 py-1.5
                            text-sm font-black
                            text-(--accent)
                          "
                        >
                          {getRating(
                            record,
                          ).toFixed(1)}
                          /5
                        </div>
                      </div>

                      {record.remarks && (
                        <p
                          className="
                            mt-3 rounded-lg
                            border border-(--line)
                            bg-(--card)
                            p-3 text-sm
                            leading-5
                            text-(--ink-muted)
                          "
                        >
                          {record.remarks}
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            ) : (
              <EmptyState
                className="mt-5 min-h-[250px]"
                title="No performance records"
                description="
                  Performance evaluations will appear
                  after an instructor submits them.
                "
                icon={<Award size={22} />}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Edit Student Modal */}
      <Modal
        open={showEditModal}
        onClose={closeEditModal}
        title="Edit Student"
        description="
          Update profile, training plan, belt and account information.
        "
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={closeEditModal}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="edit-student-form"
              variant="primary"
              loading={saving}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <form
          id="edit-student-form"
          onSubmit={handleEditSubmit}
          className="space-y-7"
        >
          {editError && (
            <div
              className="
                rounded-xl
                border border-(--danger)/20
                bg-(--danger-soft)
                px-4 py-3
              "
            >
              <p
                className="
                  text-sm font-semibold
                  text-(--danger)
                "
              >
                {editError}
              </p>
            </div>
          )}

          <FormSection title="Basic Information">
            <FormField
              label="Full name"
              htmlFor="edit-name"
              required
            >
              <Input
                id="edit-name"
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                placeholder="Student name"
                autoComplete="name"
                required
              />
            </FormField>

            <FormField
              label="Age"
              htmlFor="edit-age"
              required
            >
              <Input
                id="edit-age"
                name="age"
                type="number"
                min="1"
                value={editForm.age}
                onChange={handleEditChange}
                placeholder="Age"
                required
              />
            </FormField>

            <FormField
              label="Phone number"
              htmlFor="edit-phone"
              required
            >
              <Input
                id="edit-phone"
                name="phone"
                value={editForm.phone}
                onChange={handleEditChange}
                placeholder="Phone number"
                autoComplete="tel"
                required
              />
            </FormField>

            <FormField
              label="Email address"
              htmlFor="edit-email"
            >
              <Input
                id="edit-email"
                name="email"
                type="email"
                value={editForm.email}
                onChange={handleEditChange}
                placeholder="Email address"
                autoComplete="email"
              />
            </FormField>
          </FormSection>

          <FormSection title="Training Details">
            <FormField
              label="Training plan"
              htmlFor="edit-plan"
              required
            >
              <Select
                id="edit-plan"
                name="plan"
                value={editForm.plan}
                onChange={handleEditChange}
                required
              >
                <option value="">
                  Select a plan
                </option>

                {plans.map((plan) => (
                  <option
                    key={plan._id}
                    value={plan._id}
                  >
                    {plan.name} — ₹
                    {plan.price}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Current belt"
              htmlFor="edit-belt"
            >
              <Select
                id="edit-belt"
                name="currentBelt"
                value={
                  editForm.currentBelt
                }
                onChange={handleEditChange}
              >
                <option value="White">
                  White
                </option>
                <option value="Yellow">
                  Yellow
                </option>
                <option value="Orange">
                  Orange
                </option>
                <option value="Green">
                  Green
                </option>
                <option value="Blue">
                  Blue
                </option>
                <option value="Purple">
                  Purple
                </option>
                <option value="Brown">
                  Brown
                </option>
                <option value="Black">
                  Black
                </option>
              </Select>
            </FormField>

            <FormField
              label="Student status"
              htmlFor="edit-status"
            >
              <Select
                id="edit-status"
                name="status"
                value={editForm.status}
                onChange={handleEditChange}
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
              </Select>
            </FormField>
          </FormSection>

          <FormSection title="Account Security">
            <FormField
              label="New login password"
              htmlFor="edit-password"
              hint="Optional · minimum 6 characters"
            >
              <Input
                id="edit-password"
                name="password"
                type="password"
                minLength={6}
                value={editForm.password}
                onChange={handleEditChange}
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
              />
            </FormField>
          </FormSection>
        </form>
      </Modal>
    </main>
  );
}

function PlanMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="
        rounded-xl
        border border-(--sidebar-line)
        bg-white/5
        p-3
      "
    >
      <p
        className="
          text-[10px] font-medium
          text-(--sidebar-muted)
        "
      >
        {label}
      </p>

      <p className="mt-1 text-lg font-black">
        {value}
      </p>
    </div>
  );
}
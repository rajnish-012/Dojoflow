"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { getStudents, getBranches, getPlans, createStudent } from "@/lib/api";

import { useCan } from "@/lib/permissions";

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

type Student = {
  _id: string;
  name: string;
  age: number;
  phone: string;
  email?: string;
  branch?: {
    _id: string;
    name: string;
  } | null;
  plan?: {
    _id: string;
    name: string;
  } | null;
  currentBelt: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  joinDate: string;
};

type Branch = {
  _id: string;
  name: string;
};

type Plan = {
  _id: string;
  name: string;
  price: number;
  duration: number;
  durationUnit: "MONTHS" | "DAYS";
};

type FormData = {
  name: string;
  age: string;
  phone: string;
  email: string;
  loginEmail: string;
  loginPassword: string;
  branch: string;
  plan: string;
};

type FieldErrors = {
  age?: string;
  phone?: string;
  email?: string;
  loginEmail?: string;
};

const initialForm: FormData = {
  name: "",
  age: "",
  phone: "",
  email: "",
  loginEmail: "",
  loginPassword: "",
  branch: "",
  plan: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9]{10}$/;

export default function StudentsPage() {
  const canCreateStudent = useCan("student.create");
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getStudents();
      setStudents(data.students || []);
    } catch (error) {
      console.error(error);
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  const loadFormData = async () => {
    try {
      const [branchData, planData] = await Promise.all([
        getBranches(),
        getPlans(),
      ]);

      setBranches(branchData.branches || []);
      setPlans(planData.plans || []);
    } catch (error) {
      console.error(error);
      setFormError("Failed to load branches or plans.");
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const openModal = async () => {
    setForm(initialForm);
    setFormError("");
    setFieldErrors({});
    setShowModal(true);

    await loadFormData();
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setForm(initialForm);
    setFormError("");
    setFieldErrors({});
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleDigitsOnlyChange =
    (field: "age" | "phone") =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const digitsOnly = event.target.value.replace(/\D/g, "");

      setForm((current) => ({
        ...current,
        [field]: digitsOnly,
      }));
    };

  const handleAgeBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const value = event.target.value.trim();

    if (!value) {
      setFieldErrors((current) => ({ ...current, age: undefined }));
      return;
    }

    const numericAge = Number(value);
    const isValid =
      Number.isInteger(numericAge) && numericAge >= 1 && numericAge <= 100;

    setFieldErrors((current) => ({
      ...current,
      age: isValid ? undefined : "Age must be between 1 and 100.",
    }));
  };

  const handlePhoneBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const value = event.target.value.trim();

    if (!value) {
      setFieldErrors((current) => ({ ...current, phone: undefined }));
      return;
    }

    setFieldErrors((current) => ({
      ...current,
      phone: PHONE_PATTERN.test(value)
        ? undefined
        : "Phone number must be exactly 10 digits.",
    }));
  };

  const handlePersonalEmailBlur = (
    event: React.FocusEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value.trim();

    if (!value) {
      setFieldErrors((current) => ({ ...current, email: undefined }));
      return;
    }

    setFieldErrors((current) => ({
      ...current,
      email: EMAIL_PATTERN.test(value)
        ? undefined
        : "Please enter a valid email address.",
    }));
  };

  const handleLoginEmailBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const value = event.target.value.trim();

    if (!value) {
      setFieldErrors((current) => ({
        ...current,
        loginEmail: undefined,
      }));
      return;
    }

    setFieldErrors((current) => ({
      ...current,
      loginEmail: EMAIL_PATTERN.test(value)
        ? undefined
        : "Please enter a valid email address.",
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    const trimmedEmail = form.email.trim();
    const trimmedLoginEmail = form.loginEmail.trim();

    if (
      !trimmedName ||
      !form.age ||
      !trimmedPhone ||
      !trimmedLoginEmail ||
      !form.loginPassword.trim() ||
      !form.branch ||
      !form.plan
    ) {
      setFormError("Please fill all required fields.");
      return;
    }

    const numericAge = Number(form.age);

    if (!Number.isInteger(numericAge) || numericAge < 1 || numericAge > 100) {
      setFormError("Please enter a valid age between 1 and 100.");
      return;
    }

    if (!PHONE_PATTERN.test(trimmedPhone)) {
      setFormError(
        "Please enter a valid 10-digit phone number (numbers only).",
      );
      return;
    }

    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      setFormError("Please enter a valid personal email address.");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedLoginEmail)) {
      setFormError("Please enter a valid login email address.");
      return;
    }

    if (form.loginPassword.length < 6) {
      setFormError("Login password must be at least 6 characters.");
      return;
    }

    try {
      setSaving(true);

      await createStudent({
        name: trimmedName,
        age: numericAge,
        phone: trimmedPhone,
        email: trimmedEmail,
        loginEmail: trimmedLoginEmail,
        loginPassword: form.loginPassword,
        branch: form.branch,
        plan: form.plan,
      });

      setShowModal(false);
      setForm(initialForm);
      setFieldErrors({});

      await loadStudents();
    } catch (error) {
      console.error(error);

      setFormError(
        error instanceof Error ? error.message : "Failed to create student.",
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return students;

    return students.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.phone?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query) ||
        student.plan?.name?.toLowerCase().includes(query) ||
        student.branch?.name?.toLowerCase().includes(query) ||
        student.currentBelt?.toLowerCase().includes(query)
      );
    });
  }, [students, search]);

  const activeStudents = students.filter(
    (student) => student.status === "ACTIVE",
  ).length;

  const completedStudents = students.filter(
    (student) => student.status === "COMPLETED",
  ).length;

  const inactiveStudents = students.filter(
    (student) => student.status === "INACTIVE",
  ).length;

  return (
    <main>
      <div className="df-page">
        <PageHeader
          eyebrow="Academy management"
          title="Students"
          description="
            Manage student profiles, enrollment, training plans,
            branches and academy access.
          "
          actions={
            canCreateStudent ? (
              <Button variant="primary" size="lg" onClick={openModal}>
                <Plus size={18} />
                Add student
              </Button>
            ) : undefined
          }
        />

        <StudentSummary
          total={students.length}
          active={activeStudents}
          completed={completedStudents}
          inactive={inactiveStudents}
        />

        <Card padding="none" className="mt-6 overflow-hidden">
          <div
            className="
            flex flex-col justify-between gap-5
            border-b border-(--line)
            px-5 py-5
            sm:px-6
            lg:flex-row lg:items-center
          "
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className="
                  flex h-9 w-9 items-center justify-center
                  rounded-xl bg-(--accent-soft)
                  text-(--accent)
                "
                >
                  <Users size={18} />
                </div>

                <div>
                  <h2
                    className="
                    text-xl font-extrabold tracking-tight
                    text-(--foreground)
                  "
                  >
                    All students
                  </h2>

                  <p
                    className="
                    mt-0.5 text-xs text-(--ink-muted)
                    sm:text-sm
                  "
                  >
                    View and manage every student in your academy.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative w-full lg:w-[340px]">
              <Search
                size={17}
                aria-hidden="true"
                className="
                  pointer-events-none absolute left-3.5
                  top-1/2 -translate-y-1/2
                  text-(--ink-faint)
                "
              />

              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students..."
                aria-label="Search students"
                className="h-11 pl-10"
              />

              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setSearch("")}
                  className="
                    absolute right-2.5 top-1/2
                    flex h-7 w-7 -translate-y-1/2
                    items-center justify-center
                    rounded-lg text-(--ink-faint)
                    transition hover:bg-(--hover-bg)
                    hover:text-(--foreground)
                  "
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          <StudentsContent
            loading={loading}
            error={error}
            students={filteredStudents}
            totalStudents={students.length}
            onRetry={loadStudents}
          />

          {!loading && !error && filteredStudents.length > 0 && (
            <div
              className="
                border-t border-(--line)
                px-5 py-4
                sm:px-6
              "
            >
              <p
                className="
                  text-xs font-medium text-(--ink-faint)
                "
              >
                Showing {filteredStudents.length} of {students.length} students
              </p>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={showModal}
        onClose={closeModal}
        title="Add student"
        description="
          Create a student profile and academy login account.
        "
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>

            <Button
              type="submit"
              form="add-student-form"
              variant="primary"
              loading={saving}
            >
              <Plus size={17} />
              Create student
            </Button>
          </>
        }
      >
        <form
          id="add-student-form"
          onSubmit={handleSubmit}
          className="space-y-7"
        >
          {formError && (
            <div
              className="
              rounded-xl border border-(--danger)/20
              bg-(--danger-soft) px-4 py-3
            "
            >
              <p
                className="
                text-sm font-semibold text-(--danger)
              "
              >
                {formError}
              </p>
            </div>
          )}

          <StudentFormSection title="Personal information">
            <FormField label="Full name" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter student name"
                autoComplete="name"
                required
              />
            </FormField>

            <FormField
              label="Age"
              htmlFor="age"
              required
              error={fieldErrors.age}
            >
              <Input
                id="age"
                name="age"
                type="text"
                inputMode="numeric"
                maxLength={3}
                value={form.age}
                onChange={handleDigitsOnlyChange("age")}
                onBlur={handleAgeBlur}
                placeholder="Enter age"
                required
              />
            </FormField>

            <FormField
              label="Phone number"
              htmlFor="phone"
              required
              error={fieldErrors.phone}
            >
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                value={form.phone}
                onChange={handleDigitsOnlyChange("phone")}
                onBlur={handlePhoneBlur}
                placeholder="10-digit phone number"
                autoComplete="tel"
                required
              />
            </FormField>

            <FormField
              label="Personal email"
              htmlFor="email"
              error={fieldErrors.email}
            >
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handlePersonalEmailBlur}
                placeholder="Optional email"
                autoComplete="email"
              />
            </FormField>
          </StudentFormSection>

          <StudentFormSection title="Student login account">
            <FormField
              label="Login email"
              htmlFor="loginEmail"
              required
              error={fieldErrors.loginEmail}
            >
              <Input
                id="loginEmail"
                name="loginEmail"
                type="email"
                value={form.loginEmail}
                onChange={handleChange}
                onBlur={handleLoginEmailBlur}
                placeholder="student@example.com"
                autoComplete="username"
                required
              />
            </FormField>

            <FormField
              label="Login password"
              htmlFor="loginPassword"
              required
              hint="Minimum 6 characters"
            >
              <Input
                id="loginPassword"
                name="loginPassword"
                type="password"
                value={form.loginPassword}
                onChange={handleChange}
                placeholder="Create a password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </FormField>
          </StudentFormSection>

          <StudentFormSection title="Academy information">
            <FormField label="Branch" htmlFor="branch" required>
              <Select
                id="branch"
                name="branch"
                value={form.branch}
                onChange={handleChange}
                required
              >
                <option value="">Select branch</option>

                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Training plan" htmlFor="plan" required>
              <Select
                id="plan"
                name="plan"
                value={form.plan}
                onChange={handleChange}
                required
              >
                <option value="">Select training plan</option>

                {plans.map((plan) => (
                  <option key={plan._id} value={plan._id}>
                    {plan.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </StudentFormSection>
        </form>
      </Modal>
    </main>
  );
}

function StudentSummary({
  total,
  active,
  completed,
  inactive,
}: {
  total: number;
  active: number;
  completed: number;
  inactive: number;
}) {
  return (
    <div
      className="
      grid gap-4
      sm:grid-cols-2
      xl:grid-cols-4
    "
    >
      <SummaryCard
        title="Total Students"
        value={total}
        subtitle="Registered students"
        icon={<Users size={20} />}
      />

      <SummaryCard
        title="Active Students"
        value={active}
        subtitle="Currently enrolled"
        icon={<CheckCircle2 size={20} />}
      />

      <SummaryCard
        title="Completed"
        value={completed}
        subtitle="Training completed"
        icon={<GraduationCap size={20} />}
      />

      <SummaryCard
        title="Inactive"
        value={inactive}
        subtitle="Currently inactive"
        icon={<Clock3 size={20} />}
      />
    </div>
  );
}

function StudentsContent({
  loading,
  error,
  students,
  totalStudents,
  onRetry,
}: {
  loading: boolean;
  error: string;
  students: Student[];
  totalStudents: number;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div
        className="
        flex min-h-[320px]
        items-center justify-center
        px-5 py-12
      "
      >
        <LoadingSpinner size="md" text="Loading students..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 sm:p-6">
        <ErrorState
          title="Unable to load students"
          message={error}
          action={
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <StudentTable students={students} />
      </div>

      <div className="space-y-3 p-4 md:hidden">
        <StudentMobileList students={students} totalStudents={totalStudents} />
      </div>
    </>
  );
}

function StudentTable({ students }: { students: Student[] }) {
  return (
    <table className="w-full min-w-[1050px]">
      <thead
        className="
        border-b border-(--line)
        bg-(--surface)
      "
      >
        <tr>
          <TableHeading>Student</TableHeading>
          <TableHeading>Contact</TableHeading>
          <TableHeading>Plan / Branch</TableHeading>
          <TableHeading>Belt</TableHeading>
          <TableHeading>Status</TableHeading>
          <TableHeading>Joined</TableHeading>
          <TableHeading align="right">Action</TableHeading>
        </tr>
      </thead>

      <tbody className="divide-y divide-(--line)">
        {students.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-6 py-8">
              <EmptyState
                title="No students found"
                description="
                  Try changing your search or add a new student.
                "
                icon={<UserRound size={22} />}
              />
            </td>
          </tr>
        ) : (
          students.map((student) => (
            <StudentTableRow key={student._id} student={student} />
          ))
        )}
      </tbody>
    </table>
  );
}

function StudentTableRow({ student }: { student: Student }) {
  return (
    <tr
      className="
      group transition-colors duration-200
      hover:bg-(--surface)
    "
    >
      <td className="px-6 py-5">
        <Link
          href={`/students/${student._id}`}
          className="flex items-center gap-3"
        >
          <StudentAvatar name={student.name} />

          <div className="min-w-0">
            <p
              className="
              truncate text-sm font-bold
              text-(--foreground-soft)
              transition-colors
              group-hover:text-(--accent)
            "
            >
              {student.name}
            </p>

            <p
              className="
              mt-1 text-xs text-(--ink-muted)
            "
            >
              Age {student.age}
            </p>
          </div>
        </Link>
      </td>

      <td className="px-6 py-5">
        <p
          className="
          text-sm font-medium
          text-(--foreground-soft)
        "
        >
          {student.phone}
        </p>

        <p
          className="
          mt-1 max-w-[220px] truncate
          text-xs text-(--ink-muted)
        "
        >
          {student.email || "No email"}
        </p>
      </td>

      <td className="px-6 py-5">
        <p
          className="
          text-sm font-medium
          text-(--foreground-soft)
        "
        >
          {student.plan?.name || "No plan"}
        </p>

        <p
          className="
          mt-1 text-xs text-(--ink-muted)
        "
        >
          {student.branch?.name || "No branch"}
        </p>
      </td>

      <td className="px-6 py-5">
        <Badge variant="warning">{student.currentBelt || "White Belt"}</Badge>
      </td>

      <td className="px-6 py-5">
        <StatusBadge status={student.status} />
      </td>

      <td
        className="
        whitespace-nowrap px-6 py-5
        text-sm text-(--ink-muted)
      "
      >
        {formatDate(student.joinDate)}
      </td>

      <td className="px-6 py-5 text-right">
        <Link
          href={`/students/${student._id}`}
          className="
            inline-flex items-center gap-1
            rounded-lg px-2 py-1
            text-sm font-bold
            text-(--accent)
            transition-colors
            hover:bg-(--accent-soft)
          "
        >
          View
          <ArrowUpRight size={15} />
        </Link>
      </td>
    </tr>
  );
}

function StudentMobileList({
  students,
  totalStudents,
}: {
  students: Student[];
  totalStudents: number;
}) {
  if (students.length === 0) {
    return (
      <EmptyState
        title="No students found"
        description={
          totalStudents === 0
            ? "No students have been added yet."
            : "Try changing your search."
        }
        icon={<UserRound size={22} />}
      />
    );
  }

  return (
    <>
      {students.map((student) => (
        <Link
          key={student._id}
          href={`/students/${student._id}`}
          className="
            group block rounded-2xl
            border border-(--line)
            bg-(--surface)
            p-4 transition-all duration-200
            hover:-translate-y-0.5
            hover:border-(--line-strong)
            hover:bg-(--card)
            hover:shadow-[0_8px_25px_var(--shadow-color)]
          "
        >
          <div
            className="
            flex items-start
            justify-between gap-3
          "
          >
            <div className="flex min-w-0 items-center gap-3">
              <StudentAvatar name={student.name} />

              <div className="min-w-0">
                <p
                  className="
                  truncate text-sm font-bold
                  text-(--foreground-soft)
                  group-hover:text-(--accent)
                "
                >
                  {student.name}
                </p>

                <p
                  className="
                  mt-1 text-xs text-(--ink-muted)
                "
                >
                  Age {student.age}
                </p>
              </div>
            </div>

            <StatusBadge status={student.status} />
          </div>

          <div
            className="
            mt-4 grid grid-cols-2 gap-x-4 gap-y-4
            border-t border-(--line)
            pt-4
          "
          >
            <MobileDetail label="Contact" value={student.phone} />

            <MobileDetail
              label="Belt"
              value={student.currentBelt || "White Belt"}
            />

            <MobileDetail
              label="Plan"
              value={student.plan?.name || "No plan"}
            />

            <MobileDetail
              label="Branch"
              value={student.branch?.name || "No branch"}
            />
          </div>

          <div
            className="
            mt-4 flex items-center
            justify-between gap-3
            border-t border-(--line)
            pt-4
          "
          >
            <span
              className="
              text-xs text-(--ink-faint)
            "
            >
              Joined {formatDate(student.joinDate)}
            </span>

            <span
              className="
              inline-flex items-center gap-1
              text-sm font-bold
              text-(--accent)
            "
            >
              View
              <ArrowUpRight size={15} />
            </span>
          </div>
        </Link>
      ))}
    </>
  );
}

function StatusBadge({ status }: { status: Student["status"] }) {
  const config = {
    ACTIVE: {
      label: "Active",
      variant: "success" as const,
    },
    COMPLETED: {
      label: "Completed",
      variant: "info" as const,
    },
    INACTIVE: {
      label: "Inactive",
      variant: "default" as const,
    },
  };

  const current = config[status];

  return <Badge variant={current.variant}>{current.label}</Badge>;
}

function StudentAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="
      flex h-10 w-10 shrink-0
      items-center justify-center
      rounded-full
      border border-(--line)
      bg-(--sidebar-logo-bg)
      text-xs font-black
      text-(--gold)
    "
    >
      {initials || "ST"}
    </div>
  );
}

function TableHeading({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`
        px-6 py-4
        text-[10px] font-black
        uppercase tracking-[0.16em]
        text-(--ink-faint)
        ${align === "right" ? "text-right" : "text-left"}
      `}
    >
      {children}
    </th>
  );
}

function MobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p
        className="
        text-[9px] font-black uppercase
        tracking-[0.12em]
        text-(--ink-faint)
      "
      >
        {label}
      </p>

      <p
        className="
        mt-1 truncate text-sm font-medium
        text-(--foreground-soft)
      "
      >
        {value}
      </p>
    </div>
  );
}

function StudentFormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
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
          text-[11px] font-black
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
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
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
            text-[10px] text-(--ink-faint)
          "
          >
            {hint}
          </span>
        )}
      </div>

      {children}

      {error && (
        <p className="mt-1.5 text-xs font-medium text-(--danger)">{error}</p>
      )}
    </div>
  );
}

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

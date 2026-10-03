"use client";
import { toast } from "@/lib/toast";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Plus,
  Search,
  RefreshCw,
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
  DataFilters,
  DataSort,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
  TableHeading,
  TablePagination,
  type ActiveFilter,
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
  currentBelt?: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  joinDate: string;
};

type Branch = {
  _id: string;
  name: string;
  isActive?: boolean;
};

type CurriculumItem = {
  day: number;
  title: string;
  description: string;
  skill: string;
};

type MilestoneItem = {
  day: number;
  belt: string;
  skill: string;
  description: string;
};

type Plan = {
  _id: string;
  name: string;
  isActive?: boolean;
  price: number;
  duration: number;
  durationUnit: "MONTHS" | "DAYS";
  classesPerWeek?: number;
  startingBelt?: string;
  curriculum?: CurriculumItem[];
  programs?: { program?: { _id?: string; name?: string } | string; curriculum?: CurriculumItem[] }[];
  milestones?: MilestoneItem[];
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
  joinDate: string;
};

type FieldErrors = {
  age?: string;
  phone?: string;
  email?: string;
  loginEmail?: string;
};

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function getTodayDate() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const initialForm: FormData = {
  name: "",
  age: "",
  phone: "",
  email: "",
  loginEmail: "",
  loginPassword: "",
  branch: "",
  plan: "",
  joinDate: getTodayDate(),
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
  const [branchFilter, setBranchFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [beltFilter, setBeltFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [joinFrom, setJoinFrom] = useState("");
  const [joinTo, setJoinTo] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 1,
  });
  const [sort, setSort] = useState("createdAt-desc");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan._id === form.plan) || null,
    [plans, form.plan],
  );

  const loadStudents = useCallback(
    async (page = 1, limit = pagination.limit) => {
      try {
        setLoading(true);
        setError("");

        const data = await getStudents({
          search: search.trim() || undefined,
          branch: branchFilter || undefined,
          plan: planFilter || undefined,
          belt: beltFilter || undefined,
          status: statusFilter || undefined,
          joinFrom: joinFrom || undefined,
          joinTo: joinTo || undefined,
          page,
          limit,
          sortBy: sort.split("-")[0],
          sortOrder: sort.endsWith("-asc") ? "asc" : "desc",
        });
        setStudents(data.students || []);
        setPagination(
          data.pagination || {
            page,
            limit,
            total: data.students?.length || 0,
            pages: 1,
          },
        );
      } catch (error) {
        console.error(error);
        setError("Failed to load students.");
      } finally {
        setLoading(false);
      }
    },
    [
      beltFilter,
      branchFilter,
      joinFrom,
      joinTo,
      pagination.limit,
      planFilter,
      search,
      sort,
      statusFilter,
    ],
  );

  const loadFormData = async () => {
    try {
      const [branchData, planData] = await Promise.all([
        getBranches(),
        getPlans(),
      ]);

      setBranches(
        (branchData.branches || []).filter(
          (branch) => branch.isActive !== false,
        ),
      );
      setPlans(
        (planData.plans || []).filter((plan: Plan) => plan.isActive !== false),
      );
    } catch (error) {
      console.error(error);
      setFormError("Failed to load branches or plans.");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadStudents(1),
      search ? 250 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [loadStudents, search]);

  useEffect(() => {
    void loadFormData();
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
      Number.isInteger(numericAge) && numericAge >= 1 && numericAge <= 120;

    setFieldErrors((current) => ({
      ...current,
      age: isValid ? undefined : "Age must be between 1 and 120.",
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
    if (saving) return;
    setFormError("");

    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    const trimmedEmail = form.email.trim();
    const trimmedLoginEmail = form.loginEmail.trim().toLowerCase();

    if (
      !trimmedName ||
      !form.age ||
      !trimmedPhone ||
      !trimmedLoginEmail ||
      !form.loginPassword ||
      !form.branch ||
      !form.plan ||
      !form.joinDate
    ) {
      setFormError("Please fill all required fields.");
      return;
    }

    const numericAge = Number(form.age);

    if (!Number.isInteger(numericAge) || numericAge < 1 || numericAge > 120) {
      setFormError("Please enter a valid age between 1 and 120.");
      return;
    }

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setFormError("Student name must contain between 2 and 100 characters.");
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

    if (
      !OBJECT_ID_PATTERN.test(form.branch) ||
      !branches.some((branch) => branch._id === form.branch)
    ) {
      setFormError("Please select a valid branch.");
      return;
    }

    if (
      !OBJECT_ID_PATTERN.test(form.plan) ||
      !plans.some((plan) => plan._id === form.plan)
    ) {
      setFormError("Please select a valid training plan.");
      return;
    }

    const joinDate = form.joinDate.trim();
    if (!isValidDateKey(joinDate)) {
      setFormError("Please enter a valid join date.");
      return;
    }
    if (joinDate > getTodayDate()) {
      setFormError("Join date cannot be in the future.");
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
        joinDate,
      });

      setShowModal(false);
      setForm(initialForm);
      setFieldErrors({});

      await loadStudents(1);
      toast.success("Student created successfully.");
    } catch (error) {
      console.error(error);

      toast.error(error instanceof Error ? error.message : "Failed to create student.");
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students;

  const belts = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...students.map((student) => student.currentBelt),
            beltFilter,
          ].filter((belt): belt is string => Boolean(belt)),
        ),
      ).sort(),
    [beltFilter, students],
  );
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    const branch = branches.find((item) => item._id === branchFilter);
    const plan = plans.find((item) => item._id === planFilter);
    if (branch)
      filters.push({
        id: "branch",
        label: branch.name,
        onClear: () => setBranchFilter(""),
      });
    if (plan)
      filters.push({
        id: "plan",
        label: plan.name,
        onClear: () => setPlanFilter(""),
      });
    if (beltFilter)
      filters.push({
        id: "belt",
        label: beltFilter,
        onClear: () => setBeltFilter(""),
      });
    if (statusFilter)
      filters.push({
        id: "status",
        label: statusFilter,
        onClear: () => setStatusFilter(""),
      });
    if (joinFrom)
      filters.push({
        id: "join-from",
        label: `From ${joinFrom}`,
        onClear: () => setJoinFrom(""),
      });
    if (joinTo)
      filters.push({
        id: "join-to",
        label: `To ${joinTo}`,
        onClear: () => setJoinTo(""),
      });
    return filters;
  }, [
    beltFilter,
    branchFilter,
    branches,
    joinFrom,
    joinTo,
    planFilter,
    plans,
    statusFilter,
  ]);

  const clearStudentFilters = () => {
    setBranchFilter("");
    setPlanFilter("");
    setBeltFilter("");
    setStatusFilter("");
    setJoinFrom("");
    setJoinTo("");
  };

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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void loadStudents(pagination.page)}
                disabled={loading}
              >
                <RefreshCw
                  size={17}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </Button>

              {canCreateStudent && (
                <Button variant="primary" size="lg" onClick={openModal}>
                  <Plus size={18} />
                  Add student
                </Button>
              )}
            </div>
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

            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-start">
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

              <DataFilters
                activeFilters={activeFilters}
                onClearAll={clearStudentFilters}
              >
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Branch
                  <Select
                    value={branchFilter}
                    onChange={(event) => setBranchFilter(event.target.value)}
                  >
                    <option value="">All branches</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Training plan
                  <Select
                    value={planFilter}
                    onChange={(event) => setPlanFilter(event.target.value)}
                  >
                    <option value="">All plans</option>
                    {plans.map((plan) => (
                      <option key={plan._id} value={plan._id}>
                        {plan.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Current belt
                  <Select
                    value={beltFilter}
                    onChange={(event) => setBeltFilter(event.target.value)}
                  >
                    <option value="">All belts</option>
                    {belts.map((belt) => (
                      <option key={belt} value={belt}>
                        {belt}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Status
                  <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="COMPLETED">Completed</option>
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Joined from
                  <Input
                    type="date"
                    value={joinFrom}
                    onChange={(event) => setJoinFrom(event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Joined to
                  <Input
                    type="date"
                    value={joinTo}
                    onChange={(event) => setJoinTo(event.target.value)}
                  />
                </label>
              </DataFilters>
              <DataSort
                value={sort}
                onChange={setSort}
                options={[
                  { value: "createdAt-desc", label: "Newest first" },
                  { value: "createdAt-asc", label: "Oldest first" },
                  { value: "name-asc", label: "Name: A to Z" },
                  { value: "name-desc", label: "Name: Z to A" },
                  { value: "joinDate-desc", label: "Join date: newest" },
                  { value: "joinDate-asc", label: "Join date: oldest" },
                ]}
              />
            </div>
          </div>

          <StudentsContent
            loading={loading}
            error={error}
            students={filteredStudents}
            totalStudents={pagination.total}
            onRetry={loadStudents}
          />

          {!loading && !error && (
            <TablePagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              visibleItems={filteredStudents.length}
              pageSize={pagination.limit}
              entityLabel="students"
              onPrevious={() => void loadStudents(pagination.page - 1)}
              onNext={() => void loadStudents(pagination.page + 1)}
              onPageSizeChange={(pageSize) => void loadStudents(1, pageSize)}
            />
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

                {branches
                  .filter((branch) => branch?._id && branch.name)
                  .map((branch) => (
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

            <FormField label="Join date" htmlFor="joinDate" required>
              <Input
                id="joinDate"
                name="joinDate"
                type="date"
                value={form.joinDate}
                max={getTodayDate()}
                onChange={handleChange}
                required
              />
            </FormField>
          </StudentFormSection>

          {selectedPlan && form.joinDate && (
            <AdmissionTimelinePreview
              plan={selectedPlan}
              joinDate={form.joinDate}
            />
          )}
        </form>
      </Modal>
    </main>
  );
}

function AdmissionTimelinePreview({
  plan,
  joinDate,
}: {
  plan: Plan;
  joinDate: string;
}) {
  const primaryProgram = plan.programs?.[0];
  const programCurriculum = primaryProgram?.curriculum?.length
    ? primaryProgram.curriculum
    : plan.curriculum || [];
  const curriculum = [...programCurriculum].sort(
    (a, b) => Number(a.day) - Number(b.day),
  );

  const milestones = [...(plan.milestones || [])].sort(
    (a, b) => Number(a.day) - Number(b.day),
  );

  const milestoneMap = new Map(
    milestones.map((item) => [Number(item.day), item]),
  );

  const previewDays = new Set<number>();

  curriculum.slice(0, 8).forEach((item) => {
    previewDays.add(Number(item.day));
  });

  milestones.forEach((item) => {
    previewDays.add(Number(item.day));
  });

  const timeline = Array.from(previewDays)
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      curriculum: curriculum.find((item) => Number(item.day) === day),
      milestone: milestoneMap.get(day),
    }));

  const formatTimelineDate = (day: number) => {
    const baseDate = new Date(`${joinDate}T00:00:00`);

    if (Number.isNaN(baseDate.getTime())) {
      return "—";
    }

    baseDate.setDate(baseDate.getDate() + day - 1);

    return baseDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const firstMilestone = milestones[0] || null;

  return (
    <Card
      padding="none"
      className="
        overflow-hidden
        border-(--accent)/25
        bg-(--accent-soft)/30
      "
    >
      <div
        className="
          flex flex-col gap-4
          border-b border-(--line)
          p-5 sm:p-6
          lg:flex-row lg:items-center
          lg:justify-between
        "
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="
              flex h-10 w-10 shrink-0
              items-center justify-center
              rounded-xl
              bg-(--accent-soft)
              text-(--accent)
            "
          >
            <CalendarDays size={19} />
          </div>

          <div className="min-w-0">
            <p
              className="
                text-[10px] font-black
                uppercase tracking-[0.16em]
                text-(--accent)
              "
            >
              Admission preview
            </p>

            <h3
              className="
                mt-1 text-base font-extrabold
                text-(--foreground)
              "
            >
              Training timeline
            </h3>
            {primaryProgram && (
              <p className="mt-1 text-sm text-(--ink-muted)">
                {typeof primaryProgram.program === "object" ? primaryProgram.program.name : "Program"} curriculum
              </p>
            )}

            <p
              className="
                mt-1 text-xs leading-5
                text-(--ink-muted)
              "
            >
              Dates are calculated from the selected join date using the
              plan&apos;s curriculum and belt milestones.
            </p>
          </div>
        </div>

        <div
          className="
            shrink-0 rounded-xl
            border border-(--line)
            bg-(--surface)
            px-4 py-3
          "
        >
          <p
            className="
              text-[10px] font-black uppercase
              tracking-[0.14em]
              text-(--ink-faint)
            "
          >
            Starting belt
          </p>

          <p
            className="
              mt-1 text-sm font-bold
              text-(--foreground)
            "
          >
            {plan.startingBelt || "White"}
          </p>
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="p-6">
          <p className="text-sm font-medium text-(--ink-muted)">
            This plan has no curriculum or milestones configured yet.
          </p>
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="space-y-3">
            {timeline.map((item) => {
              const isMilestone = Boolean(item.milestone);

              return (
                <div
                  key={item.day}
                  className="
                    flex items-start gap-3
                    rounded-xl
                    border border-(--line)
                    bg-(--surface)
                    p-4
                  "
                >
                  <div
                    className={`
                      mt-0.5 flex h-9 w-9 shrink-0
                      items-center justify-center
                      rounded-full text-xs font-black
                      ${
                        isMilestone
                          ? "bg-(--accent-soft) text-(--accent)"
                          : "bg-(--surface-muted) text-(--ink-muted)"
                      }
                    `}
                  >
                    {item.day}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className="
                        flex flex-col gap-1
                        sm:flex-row sm:items-center
                        sm:justify-between
                      "
                    >
                      <div>
                        <p className="text-sm font-bold text-(--foreground)">
                          {item.curriculum?.title ||
                            item.milestone?.belt ||
                            `Training Day ${item.day}`}
                        </p>

                        {item.curriculum?.skill && (
                          <p className="mt-0.5 text-xs text-(--ink-muted)">
                            {item.curriculum.skill}
                          </p>
                        )}
                      </div>

                      <span
                        className="
                          inline-flex shrink-0
                          items-center gap-1.5
                          text-xs font-semibold
                          text-(--ink-muted)
                        "
                      >
                        <CalendarDays size={13} />
                        {formatTimelineDate(item.day)}
                      </span>
                    </div>

                    {item.curriculum?.description && (
                      <p className="mt-2 text-xs leading-5 text-(--ink-muted)">
                        {item.curriculum.description}
                      </p>
                    )}

                    {isMilestone && item.milestone && (
                      <div
                        className="
                          mt-3 inline-flex
                          flex-wrap items-center gap-2
                          rounded-lg
                          bg-(--accent-soft)
                          px-3 py-2
                        "
                      >
                        <GraduationCap size={14} className="text-(--accent)" />

                        <span className="text-xs font-bold text-(--accent)">
                          {item.milestone.belt} Belt milestone
                        </span>

                        {item.milestone.skill && (
                          <span className="text-xs text-(--ink-muted)">
                            • {item.milestone.skill}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="
              mt-4 flex flex-col gap-2
              rounded-xl
              border border-(--line)
              bg-(--surface-muted)
              px-4 py-3
              sm:flex-row sm:items-center
              sm:justify-between
            "
          >
            <p className="text-xs font-medium text-(--ink-muted)">
              Showing the first curriculum days and all configured belt
              milestones.
            </p>

            {firstMilestone && (
              <p className="shrink-0 text-xs font-bold text-(--accent)">
                First belt milestone: Day {firstMilestone.day}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
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
              truncate text-[15px] font-semibold leading-5
              text-(--foreground-soft)
              transition-colors
              group-hover:text-(--accent)
            "
            >
              {student.name}
            </p>

            <p
              className="
              mt-1 text-sm leading-5 text-(--ink-muted)
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
          text-[15px] font-medium leading-5
          text-(--foreground-soft)
        "
        >
          {student.phone}
        </p>

        <p
          className="
          mt-1 max-w-[220px] truncate
          text-sm leading-5 text-(--ink-muted)
        "
        >
          {student.email || "No email"}
        </p>
      </td>

      <td className="px-6 py-5">
        <p
          className="
          text-[15px] font-medium leading-5
          text-(--foreground-soft)
        "
        >
          {student.plan?.name || "No plan"}
        </p>

        <p
          className="
          mt-1 text-sm leading-5 text-(--ink-muted)
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
        text-[15px] leading-5 text-(--foreground-soft)
      "
      >
        {formatDate(student.joinDate)}
      </td>

      <td className="px-6 py-5 text-right">
        <IconButton
          href={`/students/${student._id}`}
          label={`View ${student.name}`}
          title={`View ${student.name}`}
        >
          <ArrowUpRight size={16} />
        </IconButton>
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

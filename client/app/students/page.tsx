"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Loader2,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  getStudents,
  getBranches,
  getPlans,
  createStudent,
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

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
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
      setError("Failed to load students");
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
      setFormError("Failed to load branches or plans");
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const openModal = async () => {
    setForm(initialForm);
    setFormError("");
    setShowModal(true);

    await loadFormData();
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setForm(initialForm);
    setFormError("");
  };

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setFormError("");

    if (
      !form.name.trim() ||
      !form.age ||
      !form.phone.trim() ||
      !form.loginEmail.trim() ||
      !form.loginPassword.trim() ||
      !form.branch ||
      !form.plan
    ) {
      setFormError("Please fill all required fields.");
      return;
    }

    if (Number(form.age) <= 0) {
      setFormError("Please enter a valid age.");
      return;
    }

    if (form.loginPassword.length < 6) {
      setFormError(
        "Login password must be at least 6 characters.",
      );
      return;
    }

    try {
      setSaving(true);

      await createStudent({
        name: form.name.trim(),
        age: Number(form.age),
        phone: form.phone.trim(),
        email: form.email.trim(),
        loginEmail: form.loginEmail.trim(),
        loginPassword: form.loginPassword,
        branch: form.branch,
        plan: form.plan,
      });

      setShowModal(false);
      setForm(initialForm);

      await loadStudents();
    } catch (error) {
      console.error(error);

      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to create student",
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
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
              <Users size={16}/>
              Academy Management
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Students
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Manage student profiles, enrollment, plans and academy
              access.
            </p>
          </div>

          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-orange-600"
          >
            <Plus size={21} />
            Add student
          </button>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Students"
            value={students.length}
            description="Registered students"
            icon={Users}
            iconClass="bg-[#edf3ff] text-[#4774c8]"
          />

          <SummaryCard
            title="Active Students"
            value={activeStudents}
            description="Currently enrolled"
            icon={CheckCircle2}
            iconClass="bg-[#edf9f2] text-[#29945d]"
          />

          <SummaryCard
            title="Completed"
            value={completedStudents}
            description="Training completed"
            icon={GraduationCap}
            iconClass="bg-[#fff6e8] text-[#c78316]"
          />

          <SummaryCard
            title="Inactive"
            value={inactiveStudents}
            description="Currently inactive"
            icon={Clock3}
            iconClass="bg-[#f3edff] text-[#8055c9]"
          />
        </div>

        {/* Students Directory */}
        <section className="overflow-hidden rounded-2xl border border-[#e4e9f0] bg-white shadow-[0_4px_18px_rgba(16,26,51,0.035)]">
          <div className="flex flex-col justify-between gap-5 border-b border-[#edf0f4] px-7 py-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-[25px] font-bold tracking-[-0.03em] text-[#071126]">
                All students
              </h2>

              <p className="mt-2 text-[16px] text-[#60708a]">
                View and manage every student in your academy.
              </p>
            </div>

            <div className="relative w-full sm:w-[325px]">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9aa5b5]"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search students..."
                className="h-12 w-full rounded-xl border border-[#dfe6ef] bg-[#fafbfd] pl-11 pr-4 text-sm text-[#34445d] outline-none transition placeholder:text-[#9aa5b5] focus:border-[#d9a63d] focus:bg-white focus:ring-4 focus:ring-[#d9a63d]/10"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-[#697386]">
                <Loader2
                  size={19}
                  className="animate-spin text-[#ff4d00]"
                />
                Loading students...
              </div>
            </div>
          ) : error ? (
            <div className="p-7">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-700">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={loadStudents}
                  className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1100px]">
                  <thead className="border-b border-[#edf0f4] bg-[#fafbfd]">
                    <tr>
                      <TableHeading>Student</TableHeading>
                      <TableHeading>Contact</TableHeading>
                      <TableHeading>Plan / Branch</TableHeading>
                      <TableHeading>Belt</TableHeading>
                      <TableHeading>Status</TableHeading>
                      <TableHeading>Joined</TableHeading>
                      <TableHeading align="right">
                        Action
                      </TableHeading>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#edf0f4]">
                    {filteredStudents.length === 0 ? (
                      <EmptyTableState />
                    ) : (
                      filteredStudents.map((student) => (
                        <tr
                          key={student._id}
                          className="group transition hover:bg-[#fbfcfe]"
                        >
                          <td className="px-7 py-5">
                            <Link
                              href={`/students/${student._id}`}
                              className="flex items-center gap-3"
                            >
                              <StudentAvatar
                                name={student.name}
                              />

                              <div>
                                <p className="text-sm font-bold text-[#101a33] transition group-hover:text-[#b67b1d]">
                                  {student.name}
                                </p>

                                <p className="mt-1 text-xs text-[#8c98a9]">
                                  Age {student.age}
                                </p>
                              </div>
                            </Link>
                          </td>

                          <td className="px-7 py-5">
                            <p className="text-sm text-[#34445d]">
                              {student.phone}
                            </p>

                            <p className="mt-1 max-w-[220px] truncate text-xs text-[#9aa5b5]">
                              {student.email || "No email"}
                            </p>
                          </td>

                          <td className="px-7 py-5">
                            <p className="text-sm text-[#34445d]">
                              {student.plan?.name || "No plan"}
                            </p>

                            <p className="mt-1 text-xs text-[#9aa5b5]">
                              {student.branch?.name || "No branch"}
                            </p>
                          </td>

                          <td className="px-7 py-5">
                            <span className="inline-flex rounded-full bg-[#fff5df] px-3 py-1 text-xs font-bold text-[#b67b1d]">
                              {student.currentBelt}
                            </span>
                          </td>

                          <td className="px-7 py-5">
                            <StatusBadge
                              status={student.status}
                            />
                          </td>

                          <td className="px-7 py-5 text-sm text-[#697386]">
                            {formatDate(student.joinDate)}
                          </td>

                          <td className="px-7 py-5 text-right">
                            <Link
                              href={`/students/${student._id}`}
                              className="inline-flex items-center gap-1 text-sm font-bold text-[#b67b1d] transition hover:text-[#8d5d10]"
                            >
                              View
                              <ArrowUpRight size={15} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-4 p-5 md:hidden">
                {filteredStudents.length === 0 ? (
                  <EmptyMobileState />
                ) : (
                  filteredStudents.map((student) => (
                    <Link
                      key={student._id}
                      href={`/students/${student._id}`}
                      className="block rounded-2xl border border-[#e4e9f0] bg-white p-4 transition hover:border-[#d9a63d] hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            name={student.name}
                          />

                          <div>
                            <p className="text-sm font-bold text-[#101a33]">
                              {student.name}
                            </p>

                            <p className="mt-1 text-xs text-[#8c98a9]">
                              Age {student.age}
                            </p>
                          </div>
                        </div>

                        <StatusBadge
                          status={student.status}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#edf0f4] pt-4">
                        <MobileDetail
                          label="Contact"
                          value={student.phone}
                        />

                        <MobileDetail
                          label="Belt"
                          value={student.currentBelt}
                        />

                        <MobileDetail
                          label="Plan"
                          value={
                            student.plan?.name || "No plan"
                          }
                        />

                        <MobileDetail
                          label="Branch"
                          value={
                            student.branch?.name || "No branch"
                          }
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[#edf0f4] pt-4">
                        <span className="text-xs text-[#9aa5b5]">
                          Joined {formatDate(student.joinDate)}
                        </span>

                        <span className="inline-flex items-center gap-1 text-sm font-bold text-[#b67b1d]">
                          View
                          <ArrowUpRight size={15} />
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </>
          )}

          {!loading &&
            !error &&
            filteredStudents.length > 0 && (
              <div className="border-t border-[#edf0f4] px-7 py-4">
                <p className="text-xs text-[#9aa5b5]">
                  Showing {filteredStudents.length} of{" "}
                  {students.length} students
                </p>
              </div>
            )}
        </section>
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101a33]/45 p-4 backdrop-blur-[2px]"
          onClick={closeModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#e4e9f0] bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-start justify-between border-b border-[#edf0f4] px-7 py-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff4d00]">
                  New admission
                </p>

                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#071126]">
                  Add student
                </h2>

                <p className="mt-2 text-sm text-[#60708a]">
                  Create a student profile and login account.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl p-2 text-[#9aa5b5] transition hover:bg-[#f1f4f8] hover:text-[#34445d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-7 px-7 py-7">
                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">
                      {formError}
                    </p>
                  </div>
                )}

                <div>
                  <p className="mb-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#8c98a9]">
                    Personal information
                  </p>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput
                      label="Full name"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Enter student name"
                      required
                    />

                    <FormInput
                      label="Age"
                      name="age"
                      type="number"
                      value={form.age}
                      onChange={handleChange}
                      placeholder="Enter age"
                      required
                    />

                    <FormInput
                      label="Phone number"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="Enter phone number"
                      required
                    />

                    <FormInput
                      label="Personal email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Optional email"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#8c98a9]">
                    Student login account
                  </p>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput
                      label="Login email"
                      name="loginEmail"
                      type="email"
                      value={form.loginEmail}
                      onChange={handleChange}
                      placeholder="student@example.com"
                      required
                    />

                    <FormInput
                      label="Login password"
                      name="loginPassword"
                      type="password"
                      value={form.loginPassword}
                      onChange={handleChange}
                      placeholder="Minimum 6 characters"
                      required
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#8c98a9]">
                    Academy information
                  </p>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormSelect
                      label="Branch"
                      name="branch"
                      value={form.branch}
                      onChange={handleChange}
                      required
                    >
                      <option value="">
                        Select branch
                      </option>

                      {branches.map((branch) => (
                        <option
                          key={branch._id}
                          value={branch._id}
                        >
                          {branch.name}
                        </option>
                      ))}
                    </FormSelect>

                    <FormSelect
                      label="Training plan"
                      name="plan"
                      value={form.plan}
                      onChange={handleChange}
                      required
                    >
                      <option value="">
                        Select training plan
                      </option>

                      {plans.map((plan) => (
                        <option
                          key={plan._id}
                          value={plan._id}
                        >
                          {plan.name}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#edf0f4] px-7 py-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-[#e1e7ef] px-5 py-3 text-sm font-bold text-[#697386] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#050a1c] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#17213d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      Create student
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-[#d7a84b] hover:shadow-[0_12px_30px_rgba(16,26,51,0.08)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <Icon size={20} />
        </div>

        <span className="text-xs font-medium text-slate-400">
          DojoFlow
        </span>
      </div>

      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
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
      className={`px-7 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#8c98a9] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StudentAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#101a33] text-xs font-black text-[#e1b44c]">
      {initials}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Student["status"];
}) {
  const styles = {
    ACTIVE: "bg-[#ecfaf3] text-[#16804b]",
    COMPLETED: "bg-[#edf3ff] text-[#4774c8]",
    INACTIVE: "bg-[#f1f3f6] text-[#697386]",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function EmptyTableState() {
  return (
    <tr>
      <td colSpan={7} className="px-7 py-16 text-center">
        <UserRound className="mx-auto h-9 w-9 text-[#cbd3df]" />

        <p className="mt-4 text-sm font-bold text-[#34445d]">
          No students found
        </p>

        <p className="mt-1 text-xs text-[#9aa5b5]">
          Try changing your search.
        </p>
      </td>
    </tr>
  );
}

function EmptyMobileState() {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9e0e9] bg-[#fafbfd] px-5 py-12 text-center">
      <UserRound className="mx-auto h-9 w-9 text-[#cbd3df]" />

      <p className="mt-4 text-sm font-bold text-[#34445d]">
        No students found
      </p>

      <p className="mt-1 text-xs text-[#9aa5b5]">
        Try changing your search.
      </p>
    </div>
  );
}

function MobileDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9aa5b5]">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-medium text-[#34445d]">
        {value}
      </p>
    </div>
  );
}

function FormInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-bold text-[#34445d]"
      >
        {label}

        {required && (
          <span className="ml-1 text-[#c78316]">*</span>
        )}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="h-12 w-full rounded-xl border border-[#e1e7ef] bg-[#fafbfd] px-4 text-sm text-[#34445d] outline-none transition placeholder:text-[#9aa5b5] focus:border-[#d9a63d] focus:bg-white focus:ring-4 focus:ring-[#d9a63d]/10"
      />
    </div>
  );
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  children,
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-bold text-[#34445d]"
      >
        {label}

        {required && (
          <span className="ml-1 text-[#c78316]">*</span>
        )}
      </label>

      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="h-12 w-full rounded-xl border border-[#e1e7ef] bg-[#fafbfd] px-4 text-sm text-[#34445d] outline-none transition focus:border-[#d9a63d] focus:bg-white focus:ring-4 focus:ring-[#d9a63d]/10"
      >
        {children}
      </select>
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
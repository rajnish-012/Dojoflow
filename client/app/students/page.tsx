"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, UserRound, X } from "lucide-react";

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
    setFormError("");
    setForm(initialForm);
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
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
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
      !form.branch ||
      !form.plan
    ) {
      setFormError("Please fill all required fields.");
      return;
    }

    if (!form.loginEmail.trim()) {
      setFormError("Student login email is required.");
      return;
    }

    if (form.loginPassword.length < 6) {
      setFormError(
        "Student login password must be at least 6 characters.",
      );
      return;
    }

    try {
      setSaving(true);

      await createStudent({
        name: form.name.trim(),
        age: Number(form.age),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
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

  const filteredStudents = students.filter((student) => {
    const searchText = search.toLowerCase();

    return (
      student.name.toLowerCase().includes(searchText) ||
      student.phone.includes(searchText) ||
      student.email?.toLowerCase().includes(searchText)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Students
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage your academy students and their training details.
          </p>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add Student
        </button>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Students */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            Loading students...
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Student
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Plan
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Belt
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Joined
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <UserRound className="mx-auto h-8 w-8 text-slate-300" />

                      <p className="mt-3 text-sm font-medium text-slate-700">
                        No students found
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Try changing your search.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <Link
                      key={student._id}
                      href={`/students/${student._id}`}
                      className="contents"
                    >
                      <tr className="cursor-pointer hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                              {student.name
                                .split(" ")
                                .map((name) => name[0])
                                .join("")
                                .slice(0, 2)}
                            </div>

                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {student.name}
                              </p>

                              <p className="text-xs text-slate-500">
                                Age {student.age}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-700">
                            {student.phone}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {student.email || "No email"}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-700">
                            {student.plan?.name || "No plan"}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {student.branch?.name || "No branch"}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            {student.currentBelt}
                          </span>
                        </td>

                        <td className="px-6 py-4">
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
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500">
                          {new Date(
                            student.joinDate,
                          ).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </td>
                      </tr>
                    </Link>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && (
        <p className="text-xs text-slate-400">
          Showing {filteredStudents.length} of{" "}
          {students.length} students
        </p>
      )}

      {/* Add Student Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Add Student
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Create a new student admission and login account.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-6 py-6">
                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-700">
                      {formError}
                    </p>
                  </div>
                )}

                {/* Personal Information */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Personal Information
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Name{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Enter student name"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Age{" "}
                          <span className="text-red-500">*</span>
                        </label>

                        <input
                          name="age"
                          type="number"
                          min="1"
                          value={form.age}
                          onChange={handleChange}
                          placeholder="Age"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Phone{" "}
                          <span className="text-red-500">*</span>
                        </label>

                        <input
                          name="phone"
                          value={form.phone}
                          onChange={handleChange}
                          placeholder="Phone number"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Contact Email
                      </label>

                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="student@example.com"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Login Information */}
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Student Login
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Login Email{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <input
                        name="loginEmail"
                        type="email"
                        value={form.loginEmail}
                        onChange={handleChange}
                        placeholder="student.login@example.com"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                      />

                      <p className="mt-1 text-xs text-slate-400">
                        This email will be used to log into the student portal.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Login Password{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <input
                        name="loginPassword"
                        type="password"
                        minLength={6}
                        value={form.loginPassword}
                        onChange={handleChange}
                        placeholder="Minimum 6 characters"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                      />

                      <p className="mt-1 text-xs text-slate-400">
                        Give this password to the student securely.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Academy Information */}
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Academy Information
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Branch{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <select
                        name="branch"
                        value={form.branch}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
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
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Plan{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <select
                        name="plan"
                        value={form.plan}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="">
                          Select plan
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
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
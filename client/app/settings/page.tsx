"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  Trash2,
  Users,
  ShieldCheck,
  GraduationCap,
  Building2,
  X,
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

type Branch = {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
};

type StaffUser = {
  _id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "BRANCH_ADMIN" | "COACH";
  branch?: Branch | null;
  createdAt?: string;
};

type FormData = {
  name: string;
  email: string;
  password: string;
  role: "BRANCH_ADMIN" | "COACH";
  branch: string;
};

export default function StaffManagementPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    role: "COACH",
    branch: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const [usersResponse, branchesResponse] =
        await Promise.all([
          fetch(`${API_URL}/users`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),

          fetch(`${API_URL}/branches`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

      const usersData = await usersResponse.json();
      const branchesData = await branchesResponse.json();

      if (!usersResponse.ok) {
        throw new Error(
          usersData.message ||
            "Failed to load staff users",
        );
      }

      if (!branchesResponse.ok) {
        throw new Error(
          branchesData.message ||
            "Failed to load branches",
        );
      }

      setUsers(usersData.users || []);
      setBranches(branchesData.branches || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load staff management",
      );
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    setFormError("");

    setForm({
      name: "",
      email: "",
      password: "",
      role: "COACH",
      branch: "",
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setFormError("");
  }

  function handleChange(
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

  async function handleCreateUser(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError("");

    if (!form.name.trim()) {
      setFormError("Please enter the staff member's name.");
      return;
    }

    if (!form.email.trim()) {
      setFormError("Please enter an email address.");
      return;
    }

    if (form.password.length < 6) {
      setFormError(
        "Password must contain at least 6 characters.",
      );
      return;
    }

    if (!form.branch) {
      setFormError(
        "Please select a branch for this staff member.",
      );
      return;
    }

    try {
      setSaving(true);

      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          branch: form.branch,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create staff user",
        );
      }

      setUsers((current) => [
        data.user,
        ...current,
      ]);

      setShowModal(false);

      setForm({
        name: "",
        email: "",
        password: "",
        role: "COACH",
        branch: "",
      });
    } catch (err) {
      console.error(err);

      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to create staff user",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(user: StaffUser) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.name}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(
        `${API_URL}/users/${user._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to delete staff user",
        );
      }

      setUsers((current) =>
        current.filter(
          (item) => item._id !== user._id,
        ),
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete staff user",
      );
    }
  }

  function getRoleLabel(role: StaffUser["role"]) {
    switch (role) {
      case "SUPER_ADMIN":
        return "Super Admin";

      case "BRANCH_ADMIN":
        return "Branch Admin";

      case "COACH":
        return "Coach";

      default:
        return role;
    }
  }

  function getRoleIcon(role: StaffUser["role"]) {
    if (role === "SUPER_ADMIN") {
      return ShieldCheck;
    }

    if (role === "BRANCH_ADMIN") {
      return Building2;
    }

    return GraduationCap;
  }

  function getRoleBadgeClass(
    role: StaffUser["role"],
  ) {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-50 text-purple-700";

      case "BRANCH_ADMIN":
        return "bg-blue-50 text-blue-700";

      case "COACH":
        return "bg-green-50 text-green-700";

      default:
        return "bg-slate-100 text-slate-600";
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading staff management...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Staff Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Create and manage academy staff accounts and
            their roles.
          </p>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <Users className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Total Staff
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {users.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <GraduationCap className="h-5 w-5 text-green-600" />
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Coaches
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {
                  users.filter(
                    (user) => user.role === "COACH",
                  ).length
                }
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Branch Admins
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {
                  users.filter(
                    (user) =>
                      user.role === "BRANCH_ADMIN",
                  ).length
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="font-semibold text-slate-900">
            Staff Accounts
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Users who can access the DojoFlow management
            system.
          </p>
        </div>

        {users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300" />

            <p className="mt-3 text-sm font-medium text-slate-700">
              No staff accounts found
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Create your first staff account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Staff
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Branch
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const RoleIcon = getRoleIcon(
                    user.role,
                  );

                  const initials = user.name
                    .split(" ")
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={user._id}
                      className="transition hover:bg-slate-50"
                    >
                      {/* Staff */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                            {initials || "U"}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {user.name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getRoleBadgeClass(
                            user.role,
                          )}`}
                        >
                          <RoleIcon className="h-3.5 w-3.5" />

                          {getRoleLabel(user.role)}
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />

                          <span className="text-sm text-slate-700">
                            {user.branch?.name ||
                              "All Branches"}
                          </span>
                        </div>
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500">
                          {user.createdAt
                            ? new Date(
                                user.createdAt,
                              ).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                        </span>
                      </td>

                      {/* Delete */}
                      <td className="px-6 py-4 text-right">
                        {user.role !== "SUPER_ADMIN" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteUser(user)
                            }
                            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete staff user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Add Staff User
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Create a login account for academy staff.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateUser}
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

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Full Name *
                </label>

                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Rahul Kumar"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email *
                </label>

                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="rahul@dojoflow.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Temporary Password *
                </label>

                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  The staff member will use this password
                  to sign in.
                </p>
              </div>

              {/* Role */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Role *
                </label>

                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                >
                  <option value="COACH">
                    Coach
                  </option>

                  <option value="BRANCH_ADMIN">
                    Branch Admin
                  </option>
                </select>

                <p className="mt-1.5 text-xs text-slate-400">
                  Super Admin accounts cannot be created
                  here.
                </p>
              </div>

              {/* Branch */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Branch *
                </label>

                <select
                  name="branch"
                  value={form.branch}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                >
                  <option value="">
                    Select a branch
                  </option>

                  {branches
                    .filter(
                      (branch) =>
                        branch.isActive !== false,
                    )
                    .map((branch) => (
                      <option
                        key={branch._id}
                        value={branch._id}
                      >
                        {branch.name}
                      </option>
                    ))}
                </select>

                {branches.length === 0 && (
                  <p className="mt-1.5 text-xs text-red-500">
                    No active branches available.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Create User
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
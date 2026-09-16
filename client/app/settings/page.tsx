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
  Pencil,
  Settings,
  Loader2,
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

const emptyForm: FormData = {
  name: "",
  email: "",
  password: "",
  role: "COACH",
  branch: "",
};

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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#34445d]">
        {label}
      </label>

      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-[#dfe5ed] bg-white px-4 text-sm text-[#101a33] outline-none transition placeholder:text-[#a0aabd] focus:border-[#d7a84b] focus:ring-4 focus:ring-[#d7a84b]/10"
      />
    </div>
  );
}

export default function StaffManagementPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [editingUser, setEditingUser] =
    useState<StaffUser | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);

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
          usersData.message || "Failed to load staff users",
        );
      }

      if (!branchesResponse.ok) {
        throw new Error(
          branchesData.message || "Failed to load branches",
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
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setFormError("");
    setForm({ ...emptyForm });
  }

  function openEditModal(user: StaffUser) {
    if (user.role === "SUPER_ADMIN") return;

    setEditingUser(user);

    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role as "BRANCH_ADMIN" | "COACH",
      branch: user.branch?._id || "",
    });

    setEditError("");
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (updating) return;

    setShowEditModal(false);
    setEditingUser(null);
    setEditError("");
    setForm({ ...emptyForm });
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

      setUsers((current) => [data.user, ...current]);
      closeModal();
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

  async function handleUpdateUser(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setEditError("");

    if (!editingUser) return;

    if (!form.name.trim()) {
      setEditError("Please enter the staff member's name.");
      return;
    }

    if (!form.email.trim()) {
      setEditError("Please enter an email address.");
      return;
    }

    if (!form.branch) {
      setEditError(
        "Please select a branch for this staff member.",
      );
      return;
    }

    if (
      form.password.trim() &&
      form.password.trim().length < 6
    ) {
      setEditError(
        "New password must contain at least 6 characters.",
      );
      return;
    }

    try {
      setUpdating(true);

      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(
        `${API_URL}/users/${editingUser._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
            branch: form.branch,
            password: form.password.trim() || undefined,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update staff user",
        );
      }

      setUsers((current) =>
        current.map((user) =>
          user._id === editingUser._id
            ? data.user
            : user,
        ),
      );

      closeEditModal();
    } catch (err) {
      console.error(err);

      setEditError(
        err instanceof Error
          ? err.message
          : "Failed to update staff user",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteUser(user: StaffUser) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.name}?`,
    );

    if (!confirmed) return;

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
        current.filter((item) => item._id !== user._id),
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
    if (role === "SUPER_ADMIN") return ShieldCheck;
    if (role === "BRANCH_ADMIN") return Building2;
    return GraduationCap;
  }

  function getRoleBadgeClass(role: StaffUser["role"]) {
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

  const coaches = users.filter(
    (user) => user.role === "COACH",
  ).length;

  const branchAdmins = users.filter(
    (user) => user.role === "BRANCH_ADMIN",
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Loader2
              size={18}
              className="animate-spin text-orange-600"
            />
            Loading staff management...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
                <Settings size={16} />
                Academy Management
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                Staff Management
              </h1>

              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Create and manage academy staff accounts,
                roles, and branch access.
              </p>
            </div>

            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-orange-600"
            >
              <UserPlus size={20} />
              Add User
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              title="Total Staff"
              value={users.length}
              description="All staff accounts"
              icon={Users}
              iconClass="bg-[#edf3ff] text-[#4774c8]"
            />

            <SummaryCard
              title="Coaches"
              value={coaches}
              description="Academy coaching staff"
              icon={GraduationCap}
              iconClass="bg-[#edf9f2] text-[#29945d]"
            />

            <SummaryCard
              title="Branch Admins"
              value={branchAdmins}
              description="Branch management accounts"
              icon={Building2}
              iconClass="bg-[#fff6e8] text-[#c78316]"
            />
          </div>

          {/* Staff Table */}
          <section className="overflow-hidden rounded-2xl border border-[#e4e9f0] bg-white shadow-[0_4px_18px_rgba(16,26,51,0.035)]">
            <div className="flex flex-col justify-between gap-3 border-b border-[#e4e9f0] px-5 py-5 sm:flex-row sm:items-center sm:px-7">
              <div>
                <h2 className="text-lg font-black tracking-tight text-[#101a33]">
                  Staff Accounts
                </h2>

                <p className="mt-1 text-sm text-[#697386]">
                  Users who can access the DojoFlow management
                  system.
                </p>
              </div>

              <span className="w-fit rounded-full bg-[#f1f4f8] px-3 py-1.5 text-xs font-semibold text-[#697386]">
                {users.length} accounts
              </span>
            </div>

            {users.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Users className="mx-auto h-10 w-10 text-[#cbd3df]" />

                <p className="mt-3 text-sm font-semibold text-[#34445d]">
                  No staff accounts found
                </p>

                <p className="mt-1 text-xs text-[#9aa5b5]">
                  Create your first staff account.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px]">
                  <thead className="border-b border-[#e4e9f0] bg-[#fbfcfe]">
                    <tr>
                      <th className="px-7 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#8b98aa]">
                        Staff
                      </th>

                      <th className="px-7 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#8b98aa]">
                        Role
                      </th>

                      <th className="px-7 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#8b98aa]">
                        Branch
                      </th>

                      <th className="px-7 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#8b98aa]">
                        Created
                      </th>

                      <th className="px-7 py-4 text-right text-xs font-bold uppercase tracking-wide text-[#8b98aa]">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#edf0f4]">
                    {users.map((user) => {
                      const RoleIcon = getRoleIcon(user.role);

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
                          className="transition hover:bg-[#fbfcfe]"
                        >
                          <td className="px-7 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#edf3ff] text-sm font-bold text-[#4774c8]">
                                {initials || "U"}
                              </div>

                              <div>
                                <p className="text-sm font-bold text-[#101a33]">
                                  {user.name}
                                </p>

                                <p className="mt-0.5 text-xs text-[#8b98aa]">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-7 py-5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${getRoleBadgeClass(
                                user.role,
                              )}`}
                            >
                              <RoleIcon size={14} />
                              {getRoleLabel(user.role)}
                            </span>
                          </td>

                          <td className="px-7 py-5">
                            <div className="flex items-center gap-2">
                              <Building2
                                size={16}
                                className="text-[#9aa5b5]"
                              />

                              <span className="text-sm font-medium text-[#34445d]">
                                {user.branch?.name ||
                                  "All Branches"}
                              </span>
                            </div>
                          </td>

                          <td className="px-7 py-5">
                            <span className="text-sm text-[#697386]">
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

                          <td className="px-7 py-5 text-right">
                            {user.role !== "SUPER_ADMIN" && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditModal(user)
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#9aa5b5] transition hover:bg-[#edf3ff] hover:text-[#4774c8]"
                                  title="Edit staff user"
                                >
                                  <Pencil size={16} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteUser(user)
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#9aa5b5] transition hover:bg-red-50 hover:text-red-600"
                                  title="Delete staff user"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e4e9f0] bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[#e4e9f0] bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-black text-[#101a33]">
                  Add Staff User
                </h2>

                <p className="mt-1 text-xs text-[#8b98aa]">
                  Create a login account for academy staff.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl p-2 text-[#9aa5b5] transition hover:bg-[#f1f4f8] hover:text-[#101a33]"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={handleCreateUser}
              className="space-y-5 p-6"
            >
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">
                    {formError}
                  </p>
                </div>
              )}

              <InputField
                label="Full Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Rahul Kumar"
              />

              <InputField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="rahul@dojoflow.com"
              />

              <InputField
                label="Temporary Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
              />

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#34445d]">
                  Role
                </label>

                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-[#dfe5ed] bg-white px-4 text-sm text-[#34445d] outline-none transition focus:border-[#d7a84b] focus:ring-4 focus:ring-[#d7a84b]/10"
                >
                  <option value="COACH">Coach</option>
                  <option value="BRANCH_ADMIN">
                    Branch Admin
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#34445d]">
                  Branch
                </label>

                <select
                  name="branch"
                  value={form.branch}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-[#dfe5ed] bg-white px-4 text-sm text-[#34445d] outline-none transition focus:border-[#d7a84b] focus:ring-4 focus:ring-[#d7a84b]/10"
                >
                  <option value="">Select a branch</option>

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
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e4e9f0] pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-[#dfe5ed] px-5 py-2.5 text-sm font-semibold text-[#697386] transition hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <UserPlus size={16} />
                  )}

                  {saving ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e4e9f0] bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[#e4e9f0] bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-black text-[#101a33]">
                  Edit Staff User
                </h2>

                <p className="mt-1 text-xs text-[#8b98aa]">
                  Update staff account information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={updating}
                className="rounded-xl p-2 text-[#9aa5b5] transition hover:bg-[#f1f4f8] hover:text-[#101a33]"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateUser}
              className="space-y-5 p-6"
            >
              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">
                    {editError}
                  </p>
                </div>
              )}

              <InputField
                label="Full Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Rahul Kumar"
              />

              <InputField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="rahul@dojoflow.com"
              />

              <InputField
                label="New Password (Optional)"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current password"
              />

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#34445d]">
                  Role
                </label>

                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-[#dfe5ed] bg-white px-4 text-sm text-[#34445d] outline-none transition focus:border-[#d7a84b] focus:ring-4 focus:ring-[#d7a84b]/10"
                >
                  <option value="COACH">Coach</option>
                  <option value="BRANCH_ADMIN">
                    Branch Admin
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#34445d]">
                  Branch
                </label>

                <select
                  name="branch"
                  value={form.branch}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-[#dfe5ed] bg-white px-4 text-sm text-[#34445d] outline-none transition focus:border-[#d7a84b] focus:ring-4 focus:ring-[#d7a84b]/10"
                >
                  <option value="">Select a branch</option>

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
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e4e9f0] pt-5">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={updating}
                  className="rounded-xl border border-[#dfe5ed] px-5 py-2.5 text-sm font-semibold text-[#697386] transition hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updating}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {updating && (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  )}

                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
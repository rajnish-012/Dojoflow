"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  GraduationCap,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
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

import { getRoles, type RoleRecord } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  role: string;
  branch?: Branch | null;
  createdAt?: string;
};

type FormData = {
  name: string;
  email: string;
  password: string;
  role: string;
  branch: string;
};

const emptyForm: FormData = {
  name: "",
  email: "",
  password: "",
  role: "COACH",
  branch: "",
};

function getRoleLabel(role: string, roles: RoleRecord[] = []) {
  const found = roles.find((item) => item.key === role);

  if (found) return found.name;

  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getRoleVariant(
  role: StaffUser["role"],
): "success" | "info" | "warning" | "neutral" {
  switch (role) {
    case "SUPER_ADMIN":
      return "warning";
    case "BRANCH_ADMIN":
      return "info";
    case "COACH":
      return "success";
    default:
      return "neutral";
  }
}

function getRoleIcon(role: StaffUser["role"]) {
  if (role === "SUPER_ADMIN") return ShieldCheck;
  if (role === "BRANCH_ADMIN") return Building2;
  return GraduationCap;
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function StaffManagementPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [emailFieldError, setEmailFieldError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.isActive !== false),
    [branches],
  );

  // Super Admin and Student are never given from this page.
  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (role) => role.key !== "SUPER_ADMIN" && role.key !== "STUDENT",
      ),
    [roles],
  );

  // Branch-only roles must be given a branch.
  function roleNeedsBranch(key: string) {
    const role = roles.find((item) => item.key === key);

    return role ? role.dataScope === "BRANCH" : true;
  }

  const coaches = useMemo(
    () => users.filter((user) => user.role === "COACH").length,
    [users],
  );

  const branchAdmins = useMemo(
    () => users.filter((user) => user.role === "BRANCH_ADMIN").length,
    [users],
  );

  async function loadData(refresh = false) {
    try {
      if (refresh) {
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

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [usersResponse, branchesResponse, rolesList] = await Promise.all([
        fetch(`${API_URL}/users`, { headers }),
        fetch(`${API_URL}/branches`, { headers }),
        getRoles(),
      ]);

      const usersData = await usersResponse.json();
      const branchesData = await branchesResponse.json();

      if (!usersResponse.ok) {
        throw new Error(usersData.message || "Failed to load staff users.");
      }

      if (!branchesResponse.ok) {
        throw new Error(branchesData.message || "Failed to load branches.");
      }

      setUsers(usersData.users || []);
      setBranches(branchesData.branches || []);
      setRoles(rolesList);
    } catch (caughtError) {
      console.error(caughtError);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load staff management.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function openModal() {
    setForm({ ...emptyForm });
    setFormError("");
    setEmailFieldError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setFormError("");
    setEmailFieldError("");
    setForm({ ...emptyForm });
  }

  function openEditModal(user: StaffUser) {
    if (user.role === "SUPER_ADMIN") return;

    setEditingUser(user);

    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role,
      branch: user.branch?._id || "",
    });

    setEditError("");
    setEmailFieldError("");
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (updating) return;

    setShowEditModal(false);
    setEditingUser(null);
    setEditError("");
    setEmailFieldError("");
    setForm({ ...emptyForm });
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleEmailBlur(event: React.FocusEvent<HTMLInputElement>) {
    const value = event.target.value.trim();

    if (!value) {
      setEmailFieldError("");
      return;
    }

    setEmailFieldError(
      EMAIL_PATTERN.test(value) ? "" : "Please enter a valid email address.",
    );
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password;
    const branch = form.branch;

    if (!name) {
      setFormError("Please enter the staff member's name.");
      return;
    }

    if (!email) {
      setFormError("Please enter an email address.");
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setFormError("Password must contain at least 6 characters.");
      return;
    }

    if (!branch && roleNeedsBranch(form.role)) {
      setFormError("Please select a branch for this staff member.");
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
          name,
          email,
          password,
          role: form.role,
          branch,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create staff user.");
      }

      setUsers((current) => [data.user, ...current]);
      setShowModal(false);
      setForm({ ...emptyForm });
      setFormError("");
      setEmailFieldError("");
    } catch (caughtError) {
      console.error(caughtError);

      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create staff user.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError("");

    if (!editingUser) return;

    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password.trim();

    if (!name) {
      setEditError("Please enter the staff member's name.");
      return;
    }

    if (!email) {
      setEditError("Please enter an email address.");
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setEditError("Please enter a valid email address.");
      return;
    }

    if (!form.branch && roleNeedsBranch(form.role)) {
      setEditError("Please select a branch for this staff member.");
      return;
    }

    if (password && password.length < 6) {
      setEditError("New password must contain at least 6 characters.");
      return;
    }

    try {
      setUpdating(true);

      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(`${API_URL}/users/${editingUser._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          email,
          role: form.role,
          branch: form.branch,
          password: password || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update staff user.");
      }

      setUsers((current) =>
        current.map((user) =>
          user._id === editingUser._id ? data.user : user,
        ),
      );

      setShowEditModal(false);
      setEditingUser(null);
      setEditError("");
      setEmailFieldError("");
      setForm({ ...emptyForm });
    } catch (caughtError) {
      console.error(caughtError);

      setEditError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update staff user.",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteUser(user: StaffUser) {
    if (user.role === "SUPER_ADMIN") return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.name}?`,
    );

    if (!confirmed) return;

    try {
      setError("");

      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(`${API_URL}/users/${user._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete staff user.");
      }

      setUsers((current) => current.filter((item) => item._id !== user._id));
    } catch (caughtError) {
      console.error(caughtError);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete staff user.",
      );
    }
  }

  if (loading) {
    return (
      <div
        className="
          min-h-screen
          bg-(--background)
          px-4
          py-6
          text-(--foreground)
          transition-colors
          duration-300
          sm:px-6
          lg:px-8
        "
      >
        <div className="mx-auto flex min-h-[480px] max-w-[1440px] items-center justify-center">
          <LoadingSpinner text="Loading staff management..." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="df-page">
        <PageHeader
          eyebrow="Academy Management"
          title="Staff Management"
          description="Create and manage academy staff accounts, roles, and branch access."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void loadData(true)}
                disabled={refreshing}
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </Button>

              <Button variant="primary" onClick={openModal}>
                <UserPlus size={18} />
                Add User
              </Button>
            </div>
          }
        />

        {error && (
          <div className="mb-6">
            <ErrorState
              title="Staff management error"
              message={error}
              action={
                <Button
                  variant="outline"
                  onClick={() => void loadData(true)}
                  disabled={refreshing}
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Try again
                </Button>
              }
            />
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            title="Total Staff"
            value={users.length}
            subtitle="All staff accounts"
            icon={<Users size={20} />}
          />

          <SummaryCard
            title="Coaches"
            value={coaches}
            subtitle="Academy coaching staff"
            icon={<GraduationCap size={20} />}
          />

          <SummaryCard
            title="Branch Admins"
            value={branchAdmins}
            subtitle="Branch management accounts"
            icon={<Building2 size={20} />}
          />
        </div>

        <Card padding="none">
          <div
            className="
              flex
              flex-col
              gap-4
              border-b
              border-(--line)
              px-5
              py-5
              sm:px-6
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-tight text-(--foreground)">
                  Staff Accounts
                </h2>

                <Badge variant="neutral">{users.length}</Badge>
              </div>

              <p className="mt-1 text-sm text-(--ink-muted)">
                Users who can access the DojoFlow management system.
              </p>
            </div>

            <div
              className="
                rounded-xl
                border
                border-(--line)
                bg-(--surface)
                px-3.5
                py-2
                text-xs
                font-semibold
                text-(--ink-muted)
              "
            >
              {users.length} accounts
            </div>
          </div>

          {users.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Users size={26} />}
                title="No staff accounts found"
                description="Create your first staff account to give your academy team access."
                action={
                  <Button variant="primary" onClick={openModal}>
                    <UserPlus size={17} />
                    Add Staff User
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px]">
                <thead className="border-b border-(--line) bg-(--surface)">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Staff
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Branch
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Created
                    </th>
                    <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-(--line)">
                  {users.map((user) => {
                    const RoleIcon = getRoleIcon(user.role);

                    return (
                      <tr
                        key={user._id}
                        className="
                          transition-colors
                          duration-150
                          hover:bg-(--hover-bg)
                        "
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div
                              className="
                                flex
                                h-11
                                w-11
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                bg-(--accent-soft)
                                text-sm
                                font-extrabold
                                text-(--accent)
                              "
                            >
                              {getInitials(user.name)}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-(--foreground)">
                                {user.name}
                              </p>

                              <p className="mt-0.5 truncate text-xs text-(--ink-muted)">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <Badge variant={getRoleVariant(user.role)}>
                            <RoleIcon size={14} />
                            {getRoleLabel(user.role, roles)}
                          </Badge>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <Building2
                              size={16}
                              className="shrink-0 text-(--ink-faint)"
                            />

                            <span className="text-sm font-medium text-(--ink-muted)">
                              {user.branch?.name || "All Branches"}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <span className="text-sm text-(--ink-muted)">
                            {formatDate(user.createdAt)}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-right">
                          {user.role !== "SUPER_ADMIN" && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(user)}
                                title="Edit staff user"
                                aria-label={`Edit ${user.name}`}
                              >
                                <Pencil size={16} />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleDeleteUser(user)}
                                title="Delete staff user"
                                aria-label={`Delete ${user.name}`}
                                className="text-(--danger) hover:bg-(--danger-soft)"
                              >
                                <Trash2 size={16} />
                              </Button>
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
        </Card>

        <p className="mt-4 text-xs text-(--ink-faint)">
          {activeBranches.length} active branch
          {activeBranches.length === 1 ? "" : "es"} available for staff
          assignment.
        </p>
      </div>

      <Modal
        open={showModal}
        onClose={closeModal}
        title="Add Staff User"
        description="Create a login account for academy staff."
        size="xl"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="create-staff-form"
              variant="primary"
              loading={saving}
            >
              <UserPlus size={16} />
              Create User
            </Button>
          </>
        }
      >
        <form
          id="create-staff-form"
          onSubmit={handleCreateUser}
          className="space-y-5"
        >
          {formError && (
            <FormAlert message={formError} onClose={() => setFormError("")} />
          )}

          <StaffFormFields
            form={form}
            branches={activeBranches}
            roles={assignableRoles}
            onChange={handleChange}
            onEmailBlur={handleEmailBlur}
            emailError={emailFieldError}
            passwordLabel="Temporary Password"
            passwordPlaceholder="Minimum 6 characters"
          />
        </form>
      </Modal>

      <Modal
        open={showEditModal}
        onClose={closeEditModal}
        title="Edit Staff User"
        description="Update staff account information."
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeEditModal}
              disabled={updating}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="edit-staff-form"
              variant="primary"
              loading={updating}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <form
          id="edit-staff-form"
          onSubmit={handleUpdateUser}
          className="space-y-5"
        >
          {editError && (
            <FormAlert message={editError} onClose={() => setEditError("")} />
          )}

          <StaffFormFields
            form={form}
            branches={activeBranches}
            roles={assignableRoles}
            onChange={handleChange}
            onEmailBlur={handleEmailBlur}
            emailError={emailFieldError}
            passwordLabel="New Password (Optional)"
            passwordPlaceholder="Leave blank to keep current password"
          />
        </form>
      </Modal>
    </div>
  );
}

function FormAlert({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className="
        flex
        items-start
        justify-between
        gap-3
        rounded-xl
        border
        border-(--danger-border)
        bg-(--danger-soft)
        px-4
        py-3
        text-sm
        text-(--danger)
      "
    >
      <p>{message}</p>

      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-lg p-1 transition hover:bg-(--danger-soft)"
        aria-label="Close error"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function StaffFormFields({
  form,
  branches,
  roles,
  onChange,
  onEmailBlur,
  emailError,
  passwordLabel,
  passwordPlaceholder,
}: {
  form: FormData;
  branches: Branch[];
  roles: RoleRecord[];
  onChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onEmailBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  emailError: string;
  passwordLabel: string;
  passwordPlaceholder: string;
}) {
  const selectedRole = roles.find((role) => role.key === form.role);

  const branchRequired = selectedRole
    ? selectedRole.dataScope === "BRANCH"
    : true;

  return (
    <>
      <div>
        <label
          htmlFor="staff-name"
          className="mb-2 block text-sm font-semibold text-(--foreground)"
        >
          Full Name
        </label>

        <Input
          id="staff-name"
          name="name"
          value={form.name}
          onChange={onChange}
          placeholder="Rahul Kumar"
          required
        />
      </div>

      <div>
        <label
          htmlFor="staff-email"
          className="mb-2 block text-sm font-semibold text-(--foreground)"
        >
          Email
        </label>

        <Input
          id="staff-email"
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          onBlur={onEmailBlur}
          placeholder="rahul@dojoflow.com"
          required
        />

        {emailError && (
          <p className="mt-1.5 text-xs font-medium text-(--danger)">
            {emailError}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="staff-password"
          className="mb-2 block text-sm font-semibold text-(--foreground)"
        >
          {passwordLabel}
        </label>

        <Input
          id="staff-password"
          name="password"
          type="password"
          value={form.password}
          onChange={onChange}
          placeholder={passwordPlaceholder}
          required={passwordLabel === "Temporary Password"}
        />
      </div>

      <div>
        <label
          htmlFor="staff-role"
          className="mb-2 block text-sm font-semibold text-(--foreground)"
        >
          Role
        </label>

        <Select
          id="staff-role"
          name="role"
          value={form.role}
          onChange={onChange}
        >
          {roles.map((role) => (
            <option key={role.key} value={role.key}>
              {role.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label
          htmlFor="staff-branch"
          className="mb-2 block text-sm font-semibold text-(--foreground)"
        >
          {branchRequired ? "Branch" : "Branch (optional)"}
        </label>

        <Select
          id="staff-branch"
          name="branch"
          value={form.branch}
          onChange={onChange}
        >
          <option value="">
            {branchRequired ? "Select a branch" : "All branches"}
          </option>

          {branches.map((branch) => (
            <option key={branch._id} value={branch._id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}
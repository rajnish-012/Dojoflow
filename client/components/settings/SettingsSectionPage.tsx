"use client";

import { fetchWithSession } from "@/lib/sessionFetch";
import { confirmAction, toast } from "@/lib/toast";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  CopyButton,
  DataTableSection,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
  TablePagination,
  TableHeading,
} from "@/components/ui";

import { getRoles, type RoleRecord } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

import AcademyBranding from "@/components/settings/AcademyBranding";
import MaintenancePanel from "@/components/settings/MaintenancePanel";
import InternationalPhoneInput, {
  isValidPhoneNumber,
} from "@/components/ui/InternationalPhoneInput";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SettingsSection = "branding" | "staff" | "maintenance";

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
  phone?: string;
  role: string;
  branch?: Branch | null;
  createdAt?: string;
};

type FormData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  branch: string;
};

const emptyForm: FormData = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "",
  branch: "",
};

function getRoleLabel(role: string, roles: RoleRecord[] = []) {
  const found = roles.find((item) => item.key === role);

  if (found) {
    return found.name;
  }

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
  if (role === "SUPER_ADMIN") {
    return ShieldCheck;
  }

  if (role === "BRANCH_ADMIN") {
    return Building2;
  }

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
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SettingsSectionPage({
  section,
}: {
  section: SettingsSection;
}) {
  const currentUser = useCurrentUser({ refresh: true });
  const canViewStaff = hasPermission(currentUser, PERMISSIONS.USER_VIEW);
  const canCreateStaff = hasPermission(currentUser, PERMISSIONS.USER_CREATE);
  const canUpdateStaff = hasPermission(currentUser, PERMISSIONS.USER_UPDATE);
  const canDeleteStaff = hasPermission(currentUser, PERMISSIONS.USER_DELETE);
  const canViewBranches = hasPermission(currentUser, PERMISSIONS.BRANCH_VIEW);
  const canViewRoles = hasPermission(currentUser, PERMISSIONS.ROLE_VIEW);
  const canViewBranding = hasPermission(currentUser, PERMISSIONS.SETTINGS_VIEW);
  const canViewMaintenance = hasPermission(
    currentUser,
    PERMISSIONS.MAINTENANCE_VIEW,
  );
  const isBranchScoped = currentUser?.dataScope === "BRANCH";

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(25);
  const usersTotalPages = Math.max(1, Math.ceil(users.length / usersPageSize));
  const usersCurrentPage = Math.min(usersPage, usersTotalPages);
  const visibleUsers = users.slice((usersCurrentPage - 1) * usersPageSize, usersCurrentPage * usersPageSize);

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

  /*
   * ========================================================
   * NORMALIZED BRANCHES
   * ========================================================
   *
   * Protect the <option> list from duplicate branch IDs
   * returned by the API.
   */
  const normalizedBranches = useMemo(() => {
    const seen = new Set<string>();
    const result: Branch[] = [];

    for (const branch of branches) {
      if (!branch || !branch._id || seen.has(branch._id)) {
        continue;
      }

      seen.add(branch._id);
      result.push(branch);
    }

    return result;
  }, [branches]);

  const activeBranches = useMemo(
    () => normalizedBranches.filter((branch) => branch.isActive !== false),
    [normalizedBranches],
  );

  /*
   * ========================================================
   * DATABASE ROLES
   * ========================================================
   *
   * Roles come entirely from MongoDB.
   *
   * SUPER_ADMIN and STUDENT are deliberately excluded
   * because this form creates normal staff accounts.
   */
  const assignableRoles = useMemo(() => {
    const seen = new Set<string>();
    const result: RoleRecord[] = [];

    for (const role of roles) {
      if (!role || !role.key || seen.has(role.key)) {
        continue;
      }

      if (
        role.key === "SUPER_ADMIN" ||
        role.key === "STUDENT" ||
        (isBranchScoped && role.dataScope !== "BRANCH")
      ) {
        continue;
      }

      if (
        !Array.isArray(role.permissions) ||
        !role.permissions.every((permission) =>
          hasPermission(currentUser, permission),
        )
      ) {
        continue;
      }

      seen.add(role.key);
      result.push(role);
    }

    return result;
  }, [roles, isBranchScoped, currentUser]);

  const coaches = useMemo(
    () => users.filter((user) => user.role === "COACH").length,
    [users],
  );

  const branchAdmins = useMemo(
    () => users.filter((user) => user.role === "BRANCH_ADMIN").length,
    [users],
  );

  /*
   * ========================================================
   * ROLE / BRANCH RULES
   * ========================================================
   */

  function roleNeedsBranch(key: string) {
    const role = roles.find((item) => item.key === key);

    return role ? role.dataScope === "BRANCH" : true;
  }

  function getDefaultStaffRole() {
    return assignableRoles[0]?.key || "";
  }

  /*
   * ========================================================
   * LOAD DATA
   * ========================================================
   */

  const loadData = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const headers = {
          "Content-Type": "application/json",
        };

        const [usersResult, branchesResult, rolesList] = await Promise.all([
          canViewStaff
            ? fetchWithSession(`${API_URL}/users`, {
                headers,
                cache: "no-store",
              })
            : Promise.resolve(null),
          canViewBranches
            ? fetchWithSession(`${API_URL}/branches`, {
                headers,
                cache: "no-store",
              })
            : Promise.resolve(null),
          canViewRoles ? getRoles() : Promise.resolve([] as RoleRecord[]),
        ]);

        const usersData = usersResult
          ? await usersResult.json()
          : { users: [] };
        const branchesData = branchesResult
          ? await branchesResult.json()
          : { branches: [] };

        if (usersResult && !usersResult.ok) {
          throw new Error(usersData.message || "Failed to load staff users.");
        }

        if (branchesResult && !branchesResult.ok) {
          throw new Error(branchesData.message || "Failed to load branches.");
        }

        setUsers(
          Array.isArray(usersData?.users)
            ? usersData.users
            : Array.isArray(usersData?.data?.users)
              ? usersData.data.users
              : [],
        );

        /*
         * Branch API compatibility:
         *
         * Supported response shapes:
         * 1. { branches: [...] }
         * 2. { data: { branches: [...] } }
         * 3. { data: [...] }
         * 4. [...]
         */
        const rawBranches = Array.isArray(branchesData?.branches)
          ? branchesData.branches
          : Array.isArray(branchesData?.data?.branches)
            ? branchesData.data.branches
            : Array.isArray(branchesData?.data)
              ? branchesData.data
              : Array.isArray(branchesData)
                ? branchesData
                : [];

        const normalizedBranches: Branch[] = rawBranches
          .map((branch: unknown) => {
            if (!branch || typeof branch !== "object") {
              return null;
            }

            const item = branch as {
              _id?: string | number;
              id?: string | number;
              name?: string;
              address?: string;
              phone?: string;
              isActive?: boolean;
            };

            const branchId = item._id ?? item.id;

            const branchName = String(item.name ?? "").trim();

            if (!branchId || !branchName) {
              return null;
            }

            return {
              _id: String(branchId),
              name: branchName,
              address: item.address,
              phone: item.phone,
              isActive: item.isActive !== false,
            };
          })
          .filter((branch: Branch | null): branch is Branch => Boolean(branch));

        /*
         * Remove duplicate branch IDs so the
         * native <select> never receives duplicate
         * option keys.
         */
        const uniqueBranches = Array.from(
          new Map(
            normalizedBranches.map((branch) => [branch._id, branch]),
          ).values(),
        );

        console.log("[Settings] Loaded branches:", uniqueBranches);

        setBranches(uniqueBranches);
        setRoles(Array.isArray(rolesList) ? rolesList : []);
      } catch (caughtError) {
        console.error("[Settings] Load error:", caughtError);

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load staff management.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canViewBranches, canViewRoles, canViewStaff],
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void loadData();
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser, loadData]);

  /*
   * ========================================================
   * ADD STAFF
   * ========================================================
   */

  function openModal() {
    if (!canCreateStaff) {
      return;
    }

    setForm({
      ...emptyForm,
      role: getDefaultStaffRole(),
    });

    setFormError("");
    setEmailFieldError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setFormError("");
    setEmailFieldError("");

    setForm({
      ...emptyForm,
      role: getDefaultStaffRole(),
    });
  }

  /*
   * ========================================================
   * EDIT STAFF
   * ========================================================
   */

  function openEditModal(user: StaffUser) {
    if (!canUpdateStaff || user.role === "SUPER_ADMIN") {
      return;
    }

    setEditingUser(user);

    setForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      password: "",
      role: user.role,
      branch: user.branch?._id || "",
    });

    setEditError("");
    setEmailFieldError("");
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (updating) {
      return;
    }

    setShowEditModal(false);
    setEditingUser(null);
    setEditError("");
    setEmailFieldError("");

    setForm({
      ...emptyForm,
      role: getDefaultStaffRole(),
    });
  }

  /*
   * ========================================================
   * FORM HANDLERS
   * ========================================================
   */

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

  /*
   * ========================================================
   * CREATE USER
   * ========================================================
   */

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");

    if (!canCreateStaff) {
      toast.error("You do not have permission to perform this action.");
      return;
    }

    const name = form.name.trim();

    const email = form.email.trim();

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

    if (!isValidPhoneNumber(form.phone, "IN")) {
      setFormError("Enter a valid phone number with its country code.");
      return;
    }

    if (!form.role) {
      setFormError("Please select a staff role.");
      return;
    }

    if (!branch && roleNeedsBranch(form.role)) {
      setFormError("Please select a branch for this staff member.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetchWithSession(`${API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone: form.phone,
          role: form.role,
          branch,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create staff user.");
      }

      if (data.user) {
        setUsers((current) => {
          const exists = current.some((user) => user._id === data.user._id);

          if (exists) {
            return current.map((user) =>
              user._id === data.user._id ? data.user : user,
            );
          }

          return [data.user, ...current];
        });
      }

      setShowModal(false);
      toast.success(data.activationEmailSent === false ? "Staff user saved. Activation email could not be sent." : "Staff user saved and activation email sent.");

      setForm({
        ...emptyForm,
        role: getDefaultStaffRole(),
      });

      setFormError("");
      setEmailFieldError("");
    } catch (caughtError) {
      console.error(caughtError);

      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create staff user.",
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ========================================================
   * UPDATE USER
   * ========================================================
   */

  async function handleUpdateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setEditError("");

    if (!editingUser) {
      return;
    }

    if (!canUpdateStaff) {
      toast.error("You do not have permission to perform this action.");
      return;
    }

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

    if (!isValidPhoneNumber(form.phone, "IN")) {
      setEditError("Enter a valid phone number with its country code.");
      return;
    }

    if (!form.role) {
      setEditError("Please select a staff role.");
      return;
    }

    if (!form.branch && roleNeedsBranch(form.role)) {
      setEditError("Please select a branch for this staff member.");
      return;
    }

    if (password && password.length < 12) {
      setEditError("New password must contain at least 12 characters.");
      return;
    }

    try {
      setUpdating(true);

      const response = await fetchWithSession(
        `${API_URL}/users/${editingUser._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            phone: form.phone,
            role: form.role,
            branch: form.branch,
            password: password || undefined,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update staff user.");
      }

      if (data.user) {
        setUsers((current) =>
          current.map((user) =>
            user._id === editingUser._id ? data.user : user,
          ),
        );
      }

      setShowEditModal(false);
      setEditingUser(null);
      toast.success("Staff user updated successfully.");
      setEditError("");
      setEmailFieldError("");

      setForm({
        ...emptyForm,
        role: getDefaultStaffRole(),
      });
    } catch (caughtError) {
      console.error(caughtError);

      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update staff user.",
      );
    } finally {
      setUpdating(false);
    }
  }

  /*
   * ========================================================
   * DELETE / DEACTIVATE USER
   * ========================================================
   */

  async function handleDeleteUser(user: StaffUser) {
    if (!canDeleteStaff || user.role === "SUPER_ADMIN") {
      return;
    }

    const confirmed = await confirmAction({
      title: "Deactivate staff user?",
      message: `Deactivate ${user.name}? They will no longer be able to sign in.`,
      confirmLabel: "Deactivate",
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response = await fetchWithSession(`${API_URL}/users/${user._id}`, {
        method: "DELETE",
        headers: {},
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to deactivate staff user.");
      }

      setUsers((current) => current.filter((item) => item._id !== user._id));
      toast.success(`${user.name} was deactivated.`);
    } catch (caughtError) {
      console.error(caughtError);
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to deactivate staff user.",
      );
    }
  }

  /*
   * ========================================================
   * LOADING
   * ========================================================
   */

  if (loading) {
    return (
      <div
        className="
          min-h-screen
          bg-(--background)
          px-4 py-6
          text-(--foreground)
          sm:px-6 lg:px-8
        "
      >
        <div
          className="
            mx-auto flex min-h-[520px]
            max-w-[1440px]
            items-center justify-center
          "
        >
          <LoadingSpinner text="Loading academy settings..." />
        </div>
      </div>
    );
  }

  /*
   * ========================================================
   * PAGE
   * ========================================================
   */

  return (
    <div className="df-page">
      {section === "branding" && (
        <section className="space-y-6">
          <PageHeader
            eyebrow="Workspace Settings"
            title="Academy Branding"
            description="Manage your academy identity, logo, colors, contact details, and regional settings."
          />
          {canViewBranding ? (
            <AcademyBranding />
          ) : (
            <ErrorState
              title="Academy branding is unavailable"
              message="Your role does not include permission to view academy settings."
            />
          )}
        </section>
      )}

      {section === "maintenance" && (
        <section className="space-y-6">
          <PageHeader
            eyebrow="Workspace Settings"
            title="Maintenance"
            description="Review system health and manage operational maintenance controls."
          />
          {canViewMaintenance ? (
            <MaintenancePanel />
          ) : (
            <ErrorState
              title="Maintenance is unavailable"
              message="Your role does not include permission to view maintenance controls."
            />
          )}
        </section>
      )}

      {section === "staff" && !canViewStaff && (
        <section>
          <ErrorState
            title="Staff management is unavailable"
            message="Your role does not include permission to view staff accounts."
          />
        </section>
      )}

      {section === "staff" && canViewStaff && (
        <section>
          <div
            className="
              mb-6 flex flex-col
              gap-4
              lg:flex-row
              lg:items-end
              lg:justify-between
            "
          >
            <PageHeader
              eyebrow="Academy Management"
              title="Staff Management"
              description="Create and manage academy staff accounts, roles, and branch access."
            />

            <div className="flex flex-wrap gap-2">
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

              <Button
                variant="primary"
                onClick={openModal}
                disabled={!canCreateStaff || assignableRoles.length === 0}
              >
                <UserPlus size={18} />
                Add User
              </Button>
            </div>
          </div>

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

          {assignableRoles.length === 0 && !error && (
            <div
              className="
                  mb-6 rounded-2xl
                  border border-(--line)
                  bg-(--surface-muted)
                  px-5 py-4
                "
            >
              <p
                className="
                    text-sm font-semibold
                    text-(--foreground)
                  "
              >
                No staff roles are available.
              </p>

              <p
                className="
                    mt-1 text-xs
                    text-(--ink-muted)
                  "
              >
                Create a custom staff role from the Roles management page before
                creating a staff account.
              </p>
            </div>
          )}

          <div
            className="
              mb-6 grid gap-4
              sm:grid-cols-2
              xl:grid-cols-3
            "
          >
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

          <DataTableSection title="Staff Accounts" description="Users who can access the DojoFlow management system." icon={<Users size={18} />} toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{users.length} accounts</Badge>
              <div
                className="
                  rounded-xl border
                  border-(--line)
                  bg-(--surface-muted)
                  px-3.5 py-2
                  text-xs font-semibold
                  text-(--ink-muted)
                "
              >
                {activeBranches.length} active branch
                {activeBranches.length === 1 ? "" : "es"}
              </div>
            </div>
          }>

            {users.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Users size={26} />}
                  title="No staff accounts found"
                  description="Create your first staff account to give your academy team access."
                  action={
                    <Button
                      variant="primary"
                      onClick={openModal}
                      disabled={!canCreateStaff || assignableRoles.length === 0}
                    >
                      <UserPlus size={17} />
                      Add Staff User
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="
                    w-full min-w-[880px]
                  "
                >
                  <thead
                    className="
                      border-b
                      border-(--line)
                      bg-(--surface)
                    "
                  >
                    <tr>
                      <TableHeading>Staff</TableHeading>

                      <TableHeading>Role</TableHeading>

                      <TableHeading>Branch</TableHeading>

                      <TableHeading>Created</TableHeading>

                      <TableHeading align="right">Actions</TableHeading>
                    </tr>
                  </thead>

                  <tbody
                    className="
                      divide-y divide-(--line)
                    "
                  >
                    {visibleUsers.map((user) => {
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
                                    flex h-11 w-11
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-(--accent-soft)
                                    text-sm font-extrabold
                                    text-(--accent)
                                  "
                              >
                                {getInitials(user.name)}
                              </div>

                              <div className="min-w-0">
                                <p
                                  className="
                                      truncate
                                      text-sm font-bold
                                      text-(--foreground)
                                    "
                                >
                                  {user.name}
                                </p>

                                <div className="mt-0.5 flex items-center gap-1.5"><p className="truncate text-xs text-(--ink-muted)">{user.email}</p><CopyButton value={user.email} label={`${user.name}'s email address`} /></div>
                                {user.phone ? <div className="mt-0.5 flex items-center gap-1.5"><p className="truncate text-xs text-(--ink-muted)">{user.phone}</p><CopyButton value={user.phone} label={`${user.name}'s phone number`} /></div> : <p className="mt-0.5 truncate text-xs text-(--ink-muted)">No phone number</p>}
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
                                className="
                                    shrink-0
                                    text-(--ink-faint)
                                  "
                              />

                              <span
                                className="
                                    text-sm font-medium
                                    text-(--ink-muted)
                                  "
                              >
                                {user.branch?.name || "All Branches"}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className="
                                  text-sm
                                  text-(--ink-muted)
                                "
                            >
                              {formatDate(user.createdAt)}
                            </span>
                          </td>

                          <td className="px-6 py-5 text-right">
                            {user.role !== "SUPER_ADMIN" &&
                              (canUpdateStaff || canDeleteStaff) && (
                                <div
                                  className="
                                    flex items-center
                                    justify-end gap-2
                                  "
                                >
                                  {canUpdateStaff && (
                                    <IconButton
                                      label={`Edit ${user.name}`}
                                      onClick={() => openEditModal(user)}
                                      title="Edit staff user"
                                    >
                                      <Pencil size={16} />
                                    </IconButton>
                                  )}

                                  {canDeleteStaff && (
                                    <IconButton
                                      variant="danger"
                                      label={`Deactivate ${user.name}`}
                                      onClick={() =>
                                        void handleDeleteUser(user)
                                      }
                                      title="Deactivate staff user"
                                    >
                                      <Trash2 size={16} />
                                    </IconButton>
                                  )}
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
            <TablePagination
              currentPage={usersCurrentPage}
              totalPages={usersTotalPages}
              totalItems={users.length}
              visibleItems={visibleUsers.length}
              pageSize={usersPageSize}
              entityLabel="staff accounts"
              onPrevious={() => setUsersPage((value) => Math.max(1, value - 1))}
              onNext={() => setUsersPage((value) => Math.min(usersTotalPages, value + 1))}
              onPageSizeChange={(value) => { setUsersPageSize(value); setUsersPage(1); }}
            />
          </DataTableSection>

          <p
            className="
              mt-4 text-xs
              text-(--ink-faint)
            "
          >
            {activeBranches.length} active branch
            {activeBranches.length === 1 ? "" : "es"} available for staff
            assignment.
          </p>
        </section>
      )}

      <Modal
        open={showModal}
        onClose={closeModal}
        title="Add Staff User"
        description="Create a staff account. The staff member will receive an email to set their own password."
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
              disabled={!canCreateStaff || assignableRoles.length === 0}
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
            onPhoneChange={(phone) =>
              setForm((current) => ({ ...current, phone }))
            }
            showPassword={false}
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
          <div
            className="
              flex w-full
              flex-col-reverse gap-2
              sm:flex-row
              sm:justify-end
            "
          >
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
              disabled={!canUpdateStaff}
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
            onPhoneChange={(phone) =>
              setForm((current) => ({ ...current, phone }))
            }
            passwordLabel="New Password (Optional)"
            passwordPlaceholder="Leave blank to keep current password"
            showPassword
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
        flex items-start
        justify-between gap-3
        rounded-xl
        border border-(--danger-border)
        bg-(--danger-soft)
        px-4 py-3
        text-sm text-(--danger)
      "
    >
      <p>{message}</p>

      <button
        type="button"
        onClick={onClose}
        className="
          shrink-0 rounded-lg p-1
          transition
          hover:bg-(--danger-soft)
        "
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
  onPhoneChange,
  passwordLabel = "",
  passwordPlaceholder = "",
  showPassword = true,
}: {
  form: FormData;
  branches: Branch[];
  roles: RoleRecord[];
  onChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onEmailBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  emailError: string;
  onPhoneChange: (phone: string) => void;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  showPassword?: boolean;
}) {
  const selectedRole = roles.find((role) => role.key === form.role);

  const branchRequired = selectedRole
    ? selectedRole.dataScope === "BRANCH"
    : true;

  /*
   * Defensive deduplication inside the
   * component itself.
   *
   * This guarantees that even if a future caller passes
   * duplicate roles/branches, React will never receive
   * duplicate option keys.
   */
  const uniqueRoles = useMemo(() => {
    const seen = new Set<string>();

    return roles.filter((role) => {
      if (!role?.key || seen.has(role.key)) {
        return false;
      }

      seen.add(role.key);
      return true;
    });
  }, [roles]);

  const uniqueBranches = useMemo(() => {
    const seen = new Set<string>();

    return branches.filter((branch) => {
      if (!branch?._id || seen.has(branch._id)) {
        return false;
      }

      seen.add(branch._id);
      return true;
    });
  }, [branches]);

  return (
    <>
      <div>
        <label
          htmlFor="staff-name"
          className="
            mb-2 block text-sm
            font-semibold
            text-(--foreground)
          "
        >
          Full Name
        </label>

        <Input
          id="staff-name"
          name="name"
          value={form.name}
          onChange={onChange}
          placeholder="Enter staff name"
          required
        />
      </div>

      <div>
        <label
          htmlFor="staff-email"
          className="
            mb-2 block text-sm
            font-semibold
            text-(--foreground)
          "
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
          placeholder="staff@example.com"
          required
        />

        {emailError && (
          <p
            className="
              mt-1.5 text-xs
              font-medium
              text-(--danger)
            "
          >
            {emailError}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="staff-phone"
          className="mb-2 block text-sm font-semibold text-(--foreground)"
        >
          Phone Number
        </label>
        <InternationalPhoneInput
          id="staff-phone"
          value={form.phone}
          onChange={onPhoneChange}
          required
        />
      </div>

      {showPassword ? <div>
        <label
          htmlFor="staff-password"
          className="
            mb-2 block text-sm
            font-semibold
            text-(--foreground)
          "
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
      </div> : null}

      <div>
        <label
          htmlFor="staff-role"
          className="
            mb-2 block text-sm
            font-semibold
            text-(--foreground)
          "
        >
          Role
        </label>

        <Select
          id="staff-role"
          name="role"
          value={form.role}
          onChange={onChange}
          required
        >
          {uniqueRoles.length === 0 ? (
            <option value="">No staff roles available</option>
          ) : (
            uniqueRoles.map((role) => (
              <option key={`role-${role.key}`} value={role.key}>
                {role.name}
              </option>
            ))
          )}
        </Select>

        {uniqueRoles.length === 0 && (
          <p
            className="
              mt-1.5 text-xs
              text-(--ink-muted)
            "
          >
            Create a staff role from the Roles page first.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="staff-branch"
          className="
            mb-2 block text-sm
            font-semibold
            text-(--foreground)
          "
        >
          {branchRequired ? "Branch" : "Branch (optional)"}
        </label>

        <Select
          id="staff-branch"
          name="branch"
          value={form.branch}
          onChange={onChange}
          required={branchRequired}
        >
          <option value="">
            {branchRequired ? "Select a branch" : "All branches"}
          </option>

          {uniqueBranches.map((branch) => (
            <option key={`branch-${branch._id}`} value={branch._id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}

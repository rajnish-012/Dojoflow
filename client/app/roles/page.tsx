"use client";
import { confirmAction, toast } from "@/lib/toast";

import { useEffect, useMemo, useState } from "react";
import {
Check,
ChevronDown,
ChevronUp,
Pencil,
Plus,
ShieldCheck,
Trash2,
} from "lucide-react";

import {
Badge,
Button,
Card,
EmptyState,
ErrorState,
IconButton,
Input,
LoadingSpinner,
Modal,
PageHeader,
Select,
Textarea,
} from "@/components/ui";

import {
createRole,
deleteRole,
getRolePermissions,
getModules,
getRoles,
updateRole,
type DataScope,
type RoleRecord,
type ManagedModule,
} from "@/lib/api";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/current-user";

/* =========================================================
TYPES
========================================================= */

type RoleForm = {
id: string | null;
key: string;
name: string;
description: string;
dataScope: DataScope;
isSystem: boolean;
permissions: string[];
};

type PermissionGroup = {
key: string;
label: string;
permissions: string[];
};

/* =========================================================
CONSTANTS
========================================================= */

const EMPTY_FORM: RoleForm = {
id: null,
key: "",
name: "",
description: "",
dataScope: "BRANCH",
isSystem: false,
permissions: [],
};

const SCOPE_LABEL: Record<DataScope, string> = {
BRANCH: "Own branch only",
ALL: "All branches",
};

/**

* Permission labels shown in the UI.
*
* The actual permission value remains the backend/database
* permission string.
  */
  const PERMISSION_LABELS: Record<string, string> = {
  "dashboard.view": "View dashboard",

"student.view": "View students",
"student.create": "Create students",
"student.update": "Update students",
"student.delete": "Delete students",

"coach_assignment.view": "View coach assignments",
"coach_assignment.manage": "Manage coach assignments",

"plan.view": "View plans",
"plan.manage": "Manage plans",

"curriculum.view": "View curriculum",
"curriculum.manage": "Manage curriculum",

"attendance.view": "View attendance",
"attendance.manage": "Manage attendance",

"holiday.view": "View holidays",
"holiday.manage": "Manage holidays",

"branch_schedule.view": "View branch schedules",
"branch_schedule.manage": "Manage branch schedules",

"performance.view": "View performance",
"performance.manage": "Manage performance",

"makeup.view": "View makeups",
"makeup.manage": "Manage makeups",

"promotion.view": "View promotions",
"promotion.manage": "Manage promotions",

"report.view": "View reports",
"report.export": "Export reports",

"inquiry.view": "View inquiries",
"inquiry.update": "Update inquiries",

"branch.view": "View branches",
"branch.manage": "Manage branches",

"user.view": "View users",
"user.create": "Create users",
"user.update": "Update users",
"user.delete": "Deactivate users",

"role.view": "View roles",
"role.manage": "Manage roles",

"module.view": "View modules",
"module.manage": "Manage modules",

"settings.view": "View settings",
"settings.manage": "Manage settings",

"website.view": "View website content",
"website.manage": "Manage website content",

};

const PERMISSION_MODULE_KEYS: Record<string, string> = {
  "dashboard.view": "dashboard",
  "student.view": "students", "student.create": "students", "student.update": "students", "student.delete": "students",
  "coach_assignment.view": "coach-assignments", "coach_assignment.manage": "coach-assignments",
  "plan.view": "plans", "plan.manage": "plans",
  "curriculum.view": "curriculum", "curriculum.manage": "curriculum",
  "attendance.view": "attendance", "attendance.manage": "attendance",
  "holiday.view": "holidays", "holiday.manage": "holidays",
  "branch_schedule.view": "branch-schedules", "branch_schedule.manage": "branch-schedules",
  "performance.view": "performance", "performance.manage": "performance",
  "makeup.view": "makeups", "makeup.manage": "makeups",
  "promotion.view": "promotions", "promotion.manage": "promotions",
  "report.view": "reports", "report.export": "reports",
  "inquiry.view": "inquiries", "inquiry.update": "inquiries",
  "branch.view": "branches", "branch.manage": "branches",
  "user.view": "settings", "user.create": "settings", "user.update": "settings", "user.delete": "settings",
  "role.view": "roles", "role.manage": "roles",
  "module.view": "modules", "module.manage": "modules",
  "settings.view": "settings", "settings.manage": "settings",
  "website.view": "website-homepage", "website.manage": "website-homepage",
};

const PERMISSION_GROUPS: PermissionGroup[] = [
{
key: "dashboard",
label: "Dashboard",
permissions: ["dashboard.view"],
},
{
key: "students",
label: "Students",
permissions: [
"student.view",
"student.create",
"student.update",
"student.delete",
],
},
{
key: "coach-assignments",
label: "Coach Assignments",
permissions: [
"coach_assignment.view",
"coach_assignment.manage",
],
},
{
key: "plans",
label: "Plans",
permissions: [
"plan.view",
"plan.manage",
],
},
{
key: "curriculum",
label: "Curriculum",
permissions: [
"curriculum.view",
"curriculum.manage",
],
},
{
key: "attendance",
label: "Attendance",
permissions: [
"attendance.view",
"attendance.manage",
],
},
{
key: "holidays",
label: "Holidays",
permissions: ["holiday.view", "holiday.manage"],
},
{
key: "branch-schedules",
label: "Branch Schedules",
permissions: [
"branch_schedule.view",
"branch_schedule.manage",
],
},
{
key: "performance",
label: "Performance",
permissions: [
"performance.view",
"performance.manage",
],
},
{
key: "makeups",
label: "Makeups",
permissions: [
"makeup.view",
"makeup.manage",
],
},
{
key: "promotions",
label: "Promotions",
permissions: [
"promotion.view",
"promotion.manage",
],
},
{
key: "reports",
label: "Reports",
permissions: [
"report.view",
"report.export",
],
},
{
key: "inquiries",
label: "Inquiries",
permissions: [
"inquiry.view",
"inquiry.update",
],
},
{
key: "branches",
label: "Branches",
permissions: [
"branch.view",
"branch.manage",
],
},
{
key: "users",
label: "Users / Staff",
permissions: [
"user.view",
"user.create",
"user.update",
"user.delete",
],
},
{
key: "roles",
label: "Roles",
permissions: [
"role.view",
"role.manage",
],
},
{
key: "modules",
label: "Modules",
permissions: [
"module.view",
"module.manage",
],
},
{
key: "settings",
label: "Settings",
permissions: [
"settings.view",
"settings.manage",
],
},
{
key: "website",
label: "Website Content",
permissions: ["website.view", "website.manage"],
},
];

/* =========================================================
HELPERS
========================================================= */

function getPermissionLabel(
permission: string,
) {
return (
PERMISSION_LABELS[permission] ||
permission
.split(".")
.map(
(part) =>
part.charAt(0).toUpperCase() +
part.slice(1),
)
.join(" ")
);
}

function getPermissionGroup(
permission: string,
) {
return (
PERMISSION_GROUPS.find((group) =>
group.permissions.includes(
permission,
)
)?.label || "Other"
);
}

/**

* Build groups from the actual database permission
* catalog.
*
* This means an older/newer permission that exists in
* the backend is not silently discarded.
  */
  function buildPermissionGroups(
  permissions: string[],
  ): PermissionGroup[] {
  const known = new Set<string>();

const groups =
PERMISSION_GROUPS.map(
(group) => {
const available =
group.permissions.filter(
(permission) =>
permissions.includes(
permission,
),
);

 
    available.forEach(
      (permission) =>
        known.add(permission),
    );

    return {
      ...group,
      permissions:
        available,
    };
  },
).filter(
  (group) =>
    group.permissions.length > 0,
);
 

const unknown =
permissions.filter(
(permission) =>
!known.has(permission),
);

if (unknown.length > 0) {
groups.push({
key: "other",
label: "Other",
permissions: unknown,
});
}

return groups;
}

/* =========================================================
PERMISSION GROUP COMPONENT
========================================================= */

function PermissionGroupCard({
group,
selectedPermissions,
disabled,
canTogglePermission,
isModuleVisible,
onToggle,
onToggleGroup,
}: {
group: PermissionGroup;
selectedPermissions: string[];
disabled: boolean;
canTogglePermission: (permission: string) => boolean;
isModuleVisible: (permission: string) => boolean;
onToggle: (
permission: string,
) => void;
onToggleGroup: (
group: PermissionGroup,
) => void;
}) {
const selectedCount =
group.permissions.filter(
(permission) =>
selectedPermissions.includes(
permission,
),
).length;

const manageablePermissions = group.permissions.filter(canTogglePermission);
const allSelected =
  manageablePermissions.length > 0 &&
  manageablePermissions.every((permission) =>
    selectedPermissions.includes(permission),
  );

const partiallySelected =
selectedCount > 0 &&
!allSelected;

return ( <div className="rounded-2xl border border-(--line) bg-(--surface)"> <div className="flex flex-col gap-3 border-b border-(--line) px-4 py-4 sm:flex-row sm:items-center sm:justify-between"> <div> <div className="flex items-center gap-2"> <h4 className="text-sm font-extrabold text-(--foreground)">
{group.label} </h4>

 
        <Badge variant="neutral">
          {selectedCount}/
          {group.permissions.length}
        </Badge>
      </div>

      <p className="mt-1 text-xs text-(--ink-muted)">
        Choose permissions only for modules enabled in this role’s sidebar.
      </p>
    </div>

    <button
      type="button"
      disabled={disabled || manageablePermissions.length === 0}
      onClick={() =>
        onToggleGroup(group)
      }
      className="
        inline-flex items-center
        justify-center rounded-lg
        border border-(--line)
        px-3 py-1.5 text-xs
        font-bold
        text-(--foreground)
        transition
        hover:bg-(--hover-bg)
        disabled:cursor-not-allowed
        disabled:opacity-50
      "
    >
      {allSelected
        ? "Clear all"
        : partiallySelected
          ? "Select all"
          : "Select all"}
    </button>
  </div>

  <div className="grid gap-2 p-4 sm:grid-cols-2">
    {group.permissions.map(
      (permission) => {
        const checked =
          selectedPermissions.includes(
            permission,
          );

        return (
          <label
            key={permission}
            className={`
              flex cursor-pointer
              items-start gap-3
              rounded-xl border
              px-3 py-3
              transition
              ${
                checked
                  ? "border-(--accent)/30 bg-(--accent-soft)"
                  : "border-(--line) hover:bg-(--hover-bg)"
              }
              ${
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : ""
              }
            `}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled || !canTogglePermission(permission)}
              onChange={() =>
                onToggle(
                  permission,
                )
              }
              className="
                mt-0.5 h-4 w-4
                shrink-0
                accent-(--accent)
              "
            />

            <span className="min-w-0">
              <span className="block text-sm font-semibold text-(--foreground)">
                {getPermissionLabel(
                  permission,
                )}
              </span>

              <span className="mt-0.5 block break-all text-[11px] text-(--ink-faint)">
                {permission}
              </span>
              {!isModuleVisible(permission) && !checked && (
                <span className="mt-1 block text-[11px] font-medium text-amber-700">
                  Enable this module for the role in Modules first.
                </span>
              )}
            </span>
          </label>
        );
      },
    )}
  </div>
</div>
 

);
}

/* =========================================================
PAGE
========================================================= */

export default function RolesPage() {
const currentUser = useCurrentUser();
const canViewRoles = useCan(PERMISSIONS.ROLE_VIEW);
const canManageRoles = useCan(PERMISSIONS.ROLE_MANAGE);
const [roles, setRoles] =
useState<RoleRecord[]>([]);
const [modules, setModules] = useState<ManagedModule[]>([]);

const [permissionCatalog, setPermissionCatalog] =
useState<string[]>([]);

const [loading, setLoading] =
useState(true);

const [permissionsLoading, setPermissionsLoading] =
useState(true);

const [error, setError] =
useState("");


const [busy, setBusy] =
useState(false);

const [reloadKey, setReloadKey] =
useState(0);

const [modalOpen, setModalOpen] =
useState(false);

const [form, setForm] =
useState<RoleForm>(
EMPTY_FORM,
);

const [formError, setFormError] =
useState("");

const [expandedGroups, setExpandedGroups] =
useState<Record<string, boolean>>(
{},
);

/* -------------------------------------------------------
PERMISSION GROUPS
------------------------------------------------------- */

const permissionGroups =
useMemo(
() =>
buildPermissionGroups(
permissionCatalog,
),
[permissionCatalog],
);

const roleKeyForForm = (candidate: RoleForm) => candidate.key || candidate.name
  .trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const isModuleVisibleForRole = (permission: string, candidate = form) => {
  if (roleKeyForForm(candidate) === "SUPER_ADMIN") return true;
  const key = PERMISSION_MODULE_KEYS[permission];
  const moduleDoc = key === "website-homepage"
    ? modules.find((item) => item.href === "/website/homepage")
    : modules.find((item) => item.key === key);
  if (!moduleDoc || !moduleDoc.isActive) return false;
  const allowedRoles = moduleDoc.allowedRoles || [];
  return allowedRoles.length === 0 || allowedRoles.includes(roleKeyForForm(candidate));
};

const canGrantPermission = (permission: string) =>
  hasPermission(currentUser, permission) && isModuleVisibleForRole(permission);

const canTogglePermission = (permission: string) =>
  canGrantPermission(permission) || form.permissions.includes(permission);

const isPermissionLocked = (candidate: RoleForm) =>
  candidate.key === "SUPER_ADMIN";

const canManageRoleForm = (candidate: RoleForm) => {
  if (!canManageRoles) return false;
  if (candidate.isSystem) return true;

  const scopeAllowed =
    String(currentUser?.role || "").toUpperCase() === "SUPER_ADMIN" ||
    currentUser?.dataScope === "ALL" ||
    candidate.dataScope === "BRANCH";

  return (
    scopeAllowed &&
    candidate.permissions.every((permission) => hasPermission(currentUser, permission))
  );
};

/* -------------------------------------------------------
LOAD
------------------------------------------------------- */

useEffect(() => {
let cancelled = false;

if (!canViewRoles) {
  return () => {
    cancelled = true;
  };
}

 
setLoading(true);
setPermissionsLoading(true);
setError("");

Promise.all([
  getRoles(),
  getRolePermissions(),
  getModules(),
])
  .then(
    ([
      rolesData,
      permissionsData,
      modulesData,
    ]) => {
      if (cancelled) {
        return;
      }

      setRoles(rolesData);
      setPermissionCatalog(
        permissionsData,
      );
      setModules(modulesData);

      setError("");
    },
  )
  .catch((err) => {
    if (cancelled) {
      return;
    }

    setError(
      err instanceof Error
        ? err.message
        : "Failed to load role management",
    );
  })
  .finally(() => {
    if (cancelled) {
      return;
    }

    setLoading(false);
    setPermissionsLoading(
      false,
    );
  });

return () => {
  cancelled = true;
};
 

}, [reloadKey, canViewRoles]);

const refresh = () =>
setReloadKey(
(count) => count + 1,
);

/* -------------------------------------------------------
FORM ACTIONS
------------------------------------------------------- */

const openCreate = () => {
if (!canManageRoles) return;
setFormError("");

 
setForm({
  ...EMPTY_FORM,
  permissions: [],
});

setExpandedGroups(
  Object.fromEntries(
    permissionGroups.map(
      (group) => [
        group.key,
        true,
      ],
    ),
  ),
);

setModalOpen(true);
 

};

const openEdit = (
role: RoleRecord,
) => {
setFormError("");

 
setForm({
  id: role._id,
  key: role.key,
  name: role.name,
  description:
    role.description || "",
  dataScope:
    role.dataScope,
  isSystem:
    role.isSystem,
  permissions:
    Array.isArray(
      role.permissions,
    )
      ? [...role.permissions]
      : [],
});

setExpandedGroups(
  Object.fromEntries(
    permissionGroups.map(
      (group) => [
        group.key,
        true,
      ],
    ),
  ),
);

setModalOpen(true);
 

};

const closeModal = () => {
if (busy) {
return;
}

 
setModalOpen(false);
setFormError("");
 

};

const togglePermission = (
permission: string,
) => {
 if (isPermissionLocked(form) || !canManageRoleForm(form)) {
return;
}

 
setForm((current) => {
  const exists =
    current.permissions.includes(
      permission,
    );

  if (!exists && !canGrantPermission(permission)) return current;

  return {
    ...current,
    permissions: exists
      ? current.permissions.filter(
          (item) =>
            item !==
            permission,
        )
      : [
          ...current.permissions,
          permission,
        ],
  };
});
 

};

const togglePermissionGroup = (
group: PermissionGroup,
) => {
 if (isPermissionLocked(form) || !canManageRoleForm(form)) {
return;
}

const manageablePermissions = group.permissions.filter(canTogglePermission);
if (manageablePermissions.length === 0) return;

 
const allSelected =
  manageablePermissions.every(
    (permission) =>
      form.permissions.includes(
        permission,
      ),
  );

setForm((current) => {
  if (allSelected) {
    return {
      ...current,
      permissions:
        current.permissions.filter(
          (permission) =>
            !manageablePermissions.includes(
              permission,
            ),
        ),
    };
  }

  return {
    ...current,
    permissions:
      Array.from(
        new Set([
          ...current.permissions,
          ...manageablePermissions,
        ]),
      ),
  };
});
 

};

const toggleGroupExpanded = (
key: string,
) => {
setExpandedGroups(
(current) => ({
...current,
[key]:
!current[key],
}),
);
};

const selectAllPermissions = () => {
 if (isPermissionLocked(form) || !canManageRoleForm(form)) {
return;
}

 
setForm((current) => ({
  ...current,
  permissions:
    Array.from(
      new Set([
        ...current.permissions,
        ...permissionCatalog.filter(canGrantPermission),
      ]),
    ),
}));
 

};

const clearAllPermissions = () => {
 if (isPermissionLocked(form) || !canManageRoleForm(form)) {
return;
}

 
setForm((current) => ({
  ...current,
  permissions: [],
}));
 

};

/* -------------------------------------------------------
SAVE
------------------------------------------------------- */

const handleSave = async () => {
 if (!canManageRoleForm(form)) return;
setFormError("");

 
const name =
  form.name.trim();

if (!name) {
  setFormError(
    "Role name is required.",
  );
  return;
}

if (
  name.length > 40
) {
  setFormError(
    "Role name must be 40 characters or less.",
  );
  return;
}

if (isPermissionLocked(form)) {
  return;
}

if (
  !permissionCatalog.length
) {
  setFormError(
    "The permission catalog could not be loaded. Please refresh and try again.",
  );
  return;
}

try {
  setBusy(true);

  if (form.id) {
    await updateRole(
      form.id,
      {
        name,
        description:
          form.description,
        ...(form.isSystem ? {} : { dataScope: form.dataScope }),
        permissions:
          form.permissions,
      },
    );

    toast.success("Role and permissions updated successfully.");
  } else {
    await createRole({
      name,
      description:
        form.description,
      dataScope:
        form.dataScope,
      permissions:
        form.permissions,
    });

    toast.success("Custom role created successfully.");
  }

  setModalOpen(false);
  refresh();
} catch (err) {
  toast.error(err instanceof Error ? err.message : "Failed to save role.");
} finally {
  setBusy(false);
}
 

};

/* -------------------------------------------------------
DELETE
------------------------------------------------------- */

const handleDelete = async (
role: RoleRecord,
) => {
if (!canManageRoles) return;
if (role.isSystem) {
return;
}

 
if (
  role.userCount > 0
) {
  toast.warning(`The "${role.name}" role is assigned to ${role.userCount} user(s). Change their roles before deleting it.`);
  return;
}

if (!(await confirmAction({ title: "Delete role?", message: `Delete the "${role.name}" role?`, confirmLabel: "Delete role", destructive: true }))) {
  return;
}

try {
  setBusy(true);

  await deleteRole(
    role._id,
  );

  toast.success("Role deleted successfully.");

  refresh();
} catch (err) {
  toast.error(err instanceof Error ? err.message : "Failed to delete role.");
} finally {
  setBusy(false);
}
 

};

/* -------------------------------------------------------
RENDER
------------------------------------------------------- */

if (!canViewRoles) {
  return <div className="df-page"><PageHeader eyebrow="Academy Management" title="Roles & Permissions" description="You do not have permission to view roles." /></div>;
}

return ( <div> <div className="df-page">
<PageHeader
eyebrow="Academy Management"
title="Roles & Permissions"
description="Create custom staff roles and control exactly which parts of ForceStrike they can access."
actions={canManageRoles ? (
<Button
leftIcon={ <Plus size={16} />
}
onClick={openCreate}
disabled={
permissionsLoading
}
>
Add Role
</Button>
) : undefined}
/>

 
    {loading ||
    permissionsLoading ? (
      <div className="flex min-h-64 items-center justify-center">
        <LoadingSpinner text="Loading roles and permissions..." />
      </div>
    ) : error ? (
      <ErrorState
        message={error}
        action={
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              refresh();
            }}
          >
            Try again
          </Button>
        }
      />
    ) : roles.length ===
      0 ? (
      <EmptyState
        icon={
          <ShieldCheck
            size={26}
          />
        }
        title="No roles yet"
        description="Add a role to get started."
      />
    ) : (
      <Card padding="none">
        <div className="flex flex-col gap-4 border-b border-(--line) px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold tracking-tight text-(--foreground)">
                All Roles
              </h2>

              <Badge variant="neutral">
                {roles.length}
              </Badge>
            </div>

            <p className="mt-1 text-sm text-(--ink-muted)">
              Built-in roles and database-backed custom roles.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2 text-xs font-semibold text-(--ink-muted)">
              {
                roles.filter(
                  (role) =>
                    !role.isSystem,
                ).length
              }{" "}
              custom
            </div>

            <div className="rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2 text-xs font-semibold text-(--ink-muted)">
              {
                permissionCatalog.length
              }{" "}
              permissions
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-(--line) bg-(--surface)">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                  Role
                </th>

                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                  Description
                </th>

                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                  Data access
                </th>

                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                  Permissions
                </th>

                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                  Users
                </th>

                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                  Type
                </th>

                <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-(--line)">
              {roles.map(
                (role) => (
                  <tr
                    key={
                      role._id
                    }
                    className="transition-colors duration-150 hover:bg-(--hover-bg)"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--accent-soft) text-(--accent)">
                          <ShieldCheck
                            size={
                              18
                            }
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-(--foreground)">
                            {
                              role.name
                            }
                          </p>

                          <p className="mt-0.5 truncate text-xs text-(--ink-muted)">
                            {
                              role.key
                            }
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="max-w-xs px-6 py-5 text-sm text-(--ink-muted)">
                      {
                        role.description ||
                        "—"
                      }
                    </td>

                    <td className="px-6 py-5">
                      <Badge
                        variant={
                          role.dataScope ===
                          "ALL"
                            ? "warning"
                            : "info"
                        }
                      >
                        {
                          SCOPE_LABEL[
                            role
                              .dataScope
                          ]
                        }
                      </Badge>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-(--foreground)">
                          {
                            role
                              .permissions
                              ?.length ||
                            0
                          }{" "}
                          assigned
                        </span>

                        <span className="text-xs text-(--ink-faint)">
                          {
                            role
                              .isSystem
                              ? "Protected system permissions"
                              : "Custom permission set"
                          }
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-sm font-semibold text-(--foreground)">
                      {
                        role.userCount
                      }
                    </td>

                    <td className="px-6 py-5">
                      <Badge
                        variant={
                          role.isSystem
                            ? "neutral"
                            : "success"
                        }
                      >
                        {
                          role.isSystem
                            ? "Built-in"
                            : "Custom"
                        }
                      </Badge>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                        <IconButton
                          label={
                            role.isSystem
                              ? role.key === "SUPER_ADMIN"
                                ? `View ${role.name} permissions`
                                : `Configure ${role.name} permissions`
                              : `Edit ${role.name}`
                          }
                          onClick={() =>
                            openEdit(
                              role,
                            )
                          }
                          disabled={
                            busy
                          }
                          title={
                            role.isSystem
                              ? role.key === "SUPER_ADMIN"
                                ? "View protected full-access role"
                                : "Configure built-in role permissions"
                              : "Edit role"
                          }
                        >
                          <Pencil
                            size={
                              16
                            }
                          />
                        </IconButton>

                        {canManageRoles && !role.isSystem && (
                          <IconButton
                            variant="danger"
                            label={`Delete ${role.name}`}
                            onClick={() =>
                              void handleDelete(
                                role,
                              )
                            }
                            disabled={
                              busy ||
                              role.userCount >
                                0
                            }
                            title={
                              role.userCount >
                              0
                                ? "Change assigned users before deleting"
                                : "Delete role"
                            }
                          >
                            <Trash2
                              size={
                                16
                              }
                            />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </Card>
    )}
  </div>

  <Modal
    open={modalOpen}
    onClose={closeModal}
    title={
      form.id
        ? form.isSystem
          ? "Role Permissions"
          : "Edit Custom Role"
        : "Create Custom Role"
    }
    description={
      form.isSystem
        ? form.key === "SUPER_ADMIN"
          ? "Super Admin is the protected full-access role. Its permissions always include the entire catalog."
          : "Built-in role permissions can be configured. Its role identity and data scope remain protected."
        : "Define the role's branch scope and exact database-backed permissions."
    }
    size="xl"
    footer={
      <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={closeModal}
          disabled={busy}
        >
          Close
        </Button>

        {canManageRoleForm(form) && !isPermissionLocked(form) && (
          <Button
            type="button"
            variant="primary"
            onClick={() =>
              void handleSave()
            }
            loading={busy}
          >
            {form.id
              ? "Save Changes"
              : "Create Role"}
          </Button>
        )}

      </div>
    }
  >
    <div className="space-y-6">
      {formError && (
        <div className="rounded-xl border border-(--danger-border) bg-(--danger-soft) px-4 py-3 text-sm font-medium text-(--danger)">
          {formError}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="role-name"
            className="mb-2 block text-sm font-semibold text-(--foreground)"
          >
            Role Name
          </label>

          <Input
            id="role-name"
            value={form.name}
            onChange={(
              event,
            ) =>
              setForm(
                (
                  current,
                ) => ({
                  ...current,
                  name: event
                    .target
                    .value,
                }),
              )
            }
            placeholder="e.g. Front Desk"
            disabled={
              busy || !canManageRoleForm(form) || form.isSystem
            }
          />
        </div>

        <div>
          <label
            htmlFor="role-scope"
            className="mb-2 block text-sm font-semibold text-(--foreground)"
          >
            Data Access
          </label>

          <Select
            id="role-scope"
            value={
              form.dataScope
            }
            onChange={(
              event,
            ) =>
              setForm(
                (
                  current,
                ) => ({
                  ...current,
                  dataScope:
                    event
                      .target
                      .value as DataScope,
                }),
              )
            }
            disabled={
            busy || !canManageRoleForm(form) ||
              form.isSystem
            }
          >
            <option value="BRANCH">
              Own branch only
            </option>

            <option
              value="ALL"
              disabled={
                currentUser?.dataScope !== "ALL" &&
                String(currentUser?.role || "").toUpperCase() !== "SUPER_ADMIN"
              }
            >
              All branches
            </option>
          </Select>

          <p className="mt-1.5 text-xs text-(--ink-faint)">
            {
              SCOPE_LABEL[
                form.dataScope
              ]
            }
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="role-description"
          className="mb-2 block text-sm font-semibold text-(--foreground)"
        >
          Description
        </label>

        <Textarea
          id="role-description"
          value={
            form.description
          }
          onChange={(
            event,
          ) =>
            setForm(
              (
                current,
              ) => ({
                ...current,
                description:
                  event
                    .target
                    .value,
              }),
            )
          }
          disabled={
            busy || !canManageRoleForm(form)
          }
          maxLength={200}
          rows={3}
          placeholder="Describe what this role is responsible for."
          className="
            resize-y
            placeholder:text-(--ink-faint)
            focus:border-(--accent)
            focus:ring-2
            focus:ring-(--accent)/15
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        />
      </div>

      <div className="rounded-2xl border border-(--line) bg-(--surface) p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-(--foreground)">
                Permissions
              </h3>

              <Badge variant="neutral">
                {
                  form.permissions
                    .length
                }{" "}
                selected
              </Badge>
            </div>

            <p className="mt-1 text-xs text-(--ink-muted)">
              Permissions are stored on the database role and enforced by the backend.
            </p>
          </div>

          {canManageRoleForm(form) && !isPermissionLocked(form) && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={
                  selectAllPermissions
                }
                disabled={
                  busy ||
                  !permissionCatalog.length
                }
              >
                Select all
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={
                  clearAllPermissions
                }
                disabled={
                  busy ||
                  !form.permissions
                    .length
                }
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </div>

      {form.isSystem && (
        <div className="rounded-xl border border-(--line) bg-(--card) px-4 py-3">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={18}
              className="mt-0.5 shrink-0 text-(--accent)"
            />

            <div>
              <p className="text-sm font-bold text-(--foreground)">
                Built-in role configuration
              </p>

              <p className="mt-1 text-xs leading-5 text-(--ink-muted)">
                Permissions can be assigned to built-in roles. Super Admin remains protected with full access; built-in role names and data scopes cannot be changed.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {permissionGroups.map(
          (group) => {
            const expanded =
              expandedGroups[
                group.key
              ] !== false;

            return (
              <div
                key={
                  group.key
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleGroupExpanded(
                      group.key,
                    )
                  }
                  className="
                    mb-2 flex w-full
                    items-center
                    justify-between
                    rounded-xl
                    px-2 py-2
                    text-left
                    hover:bg-(--hover-bg)
                  "
                >
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-(--ink-muted)">
                    {getPermissionGroup(
                      group
                        .permissions[0] ||
                        group.label,
                    )}
                  </span>

                  {expanded ? (
                    <ChevronUp
                      size={
                        16
                      }
                      className="text-(--ink-faint)"
                    />
                  ) : (
                    <ChevronDown
                      size={
                        16
                      }
                      className="text-(--ink-faint)"
                    />
                  )}
                </button>

                {expanded && (
                  <PermissionGroupCard
                    group={
                      group
                    }
                    selectedPermissions={
                      form.permissions
                    }
                    disabled={
                      isPermissionLocked(form) || !canManageRoleForm(form) ||
                      busy
                    }
                    canTogglePermission={canTogglePermission}
                    isModuleVisible={isModuleVisibleForRole}
                    onToggle={
                      togglePermission
                    }
                    onToggleGroup={
                      togglePermissionGroup
                    }
                  />
                )}
              </div>
            );
          },
        )}
      </div>

      {form.permissions.length >
        0 && (
        <div className="rounded-xl border border-(--accent)/20 bg-(--accent-soft) px-4 py-3">
          <div className="flex items-start gap-3">
            <Check
              size={18}
              className="mt-0.5 shrink-0 text-(--accent)"
            />

            <div>
              <p className="text-sm font-bold text-(--foreground)">
                {
                  form.permissions
                    .length
                }{" "}
                permission
                {form.permissions
                  .length ===
                1
                  ? ""
                  : "s"}{" "}
                selected
              </p>

              <p className="mt-1 text-xs text-(--ink-muted)">
                The backend will use this role's database permission set when authorizing API requests.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  </Modal>
</div>
 

);
}

"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";

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
} from "@/components/ui";

import {
  createRole,
  deleteRole,
  getRoles,
  updateRole,
  type DataScope,
  type RoleRecord,
} from "@/lib/api";

/* =========================================================
   CONSTANTS
   ========================================================= */

type RoleForm = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  dataScope: DataScope;
  isSystem: boolean;
};

const EMPTY_FORM: RoleForm = {
  id: null,
  key: "",
  name: "",
  description: "",
  dataScope: "BRANCH",
  isSystem: false,
};

const SCOPE_LABEL: Record<DataScope, string> = {
  BRANCH: "Own branch only",
  ALL: "All branches",
};

/* =========================================================
   PAGE
   ========================================================= */

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  /* -------------------------------------------------------
     LOAD
     ------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    getRoles()
      .then((data) => {
        if (cancelled) return;

        setRoles(data);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : "Failed to load roles");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = () => setReloadKey((count) => count + 1);

  /* -------------------------------------------------------
     ACTIONS
     ------------------------------------------------------- */

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (role: RoleRecord) => {
    setForm({
      id: role._id,
      key: role.key,
      name: role.name,
      description: role.description || "",
      dataScope: role.dataScope,
      isSystem: role.isSystem,
    });
    setFormError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Role name is required");
      return;
    }

    try {
      setBusy(true);

      if (form.id) {
        await updateRole(form.id, {
          name: form.name,
          description: form.description,
          dataScope: form.isSystem ? undefined : form.dataScope,
        });

        setNotice("Role updated");
      } else {
        await createRole({
          name: form.name,
          description: form.description,
          dataScope: form.dataScope,
        });

        setNotice("Role created");
      }

      setModalOpen(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (role: RoleRecord) => {
    if (!window.confirm(`Delete the "${role.name}" role?`)) {
      return;
    }

    try {
      setBusy(true);
      setNotice("");

      await deleteRole(role._id);

      setNotice("Role deleted");
      refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------
     RENDER
     ------------------------------------------------------- */

  return (
    <div>
      <div className="df-page">
        <PageHeader
          eyebrow="Academy Management"
          title="Roles"
          description="Create staff roles and control whether they can access one branch or all branches in Settings."
          actions={
            <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
              Add Role
            </Button>
          }
        />

        {notice && (
          <div className="mb-4 rounded-xl border border-(--line) bg-(--card) px-4 py-3 text-sm font-medium text-(--foreground)">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoadingSpinner text="Loading roles..." />
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
        ) : roles.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={26} />}
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

                  <Badge variant="neutral">{roles.length}</Badge>
                </div>

                <p className="mt-1 text-sm text-(--ink-muted)">
                  Built-in roles and the custom roles you created.
                </p>
              </div>

              <div className="rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2 text-xs font-semibold text-(--ink-muted)">
                {roles.filter((role) => !role.isSystem).length} custom
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px]">
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
                  {roles.map((role) => (
                    <tr
                      key={role._id}
                      className="transition-colors duration-150 hover:bg-(--hover-bg)"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--accent-soft) text-(--accent)">
                            <ShieldCheck size={18} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-(--foreground)">
                              {role.name}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-(--ink-muted)">
                              {role.key}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="max-w-xs px-6 py-5 text-sm text-(--ink-muted)">
                        {role.description || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <Badge
                          variant={
                            role.dataScope === "ALL" ? "warning" : "info"
                          }
                        >
                          {SCOPE_LABEL[role.dataScope]}
                        </Badge>
                      </td>

                      <td className="px-6 py-5 text-sm font-semibold text-(--foreground)">
                        {role.userCount}
                      </td>

                      <td className="px-6 py-5">
                        <Badge variant={role.isSystem ? "neutral" : "success"}>
                          {role.isSystem ? "Built-in" : "Custom"}
                        </Badge>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(role)}
                            disabled={busy}
                            title="Edit role"
                            aria-label={`Edit ${role.name}`}
                          >
                            <Pencil size={16} />
                          </Button>

                          {!role.isSystem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleDelete(role)}
                              disabled={busy}
                              title="Delete role"
                              aria-label={`Delete ${role.name}`}
                              className="text-(--danger) hover:bg-(--danger-soft)"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ===================================================
          ADD / EDIT MODAL
          =================================================== */}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "Edit Role" : "Add Role"}
        description={
          form.isSystem
            ? "Built-in role: you can rename it, but its data access is fixed and it cannot be deleted."
            : "Give the role a name and choose how much data it can see."
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>

            <Button loading={busy} onClick={() => void handleSave()}>
              {form.id ? "Save Changes" : "Create Role"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p
              role="alert"
              className="rounded-xl bg-(--danger-soft) px-3 py-2 text-xs font-semibold text-(--danger)"
            >
              {formError}
            </p>
          )}

          <div>
            <label
              htmlFor="role-name"
              className="mb-2 block text-xs font-extrabold text-(--foreground-soft)"
            >
              Role name
            </label>

            <Input
              id="role-name"
              value={form.name}
              placeholder="Front Desk"
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
            />

            {form.key && (
              <p className="mt-1.5 text-[11px] text-(--ink-muted)">
                Key: {form.key}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="role-description"
              className="mb-2 block text-xs font-extrabold text-(--foreground-soft)"
            >
              Description (optional)
            </label>

            <Input
              id="role-description"
              value={form.description}
              placeholder="Handles enquiries and attendance"
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label
              htmlFor="role-scope"
              className="mb-2 block text-xs font-extrabold text-(--foreground-soft)"
            >
              Data access
            </label>

            <Select
              id="role-scope"
              value={form.dataScope}
              disabled={form.isSystem}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  dataScope: event.target.value as DataScope,
                }))
              }
            >
              <option value="BRANCH">Own branch only</option>
              <option value="ALL">All branches</option>
            </Select>

            <p className="mt-1.5 text-[11px] text-(--ink-muted)">
              {form.dataScope === "BRANCH"
                ? "People with this role only see the students and records of the branch they are assigned to."
                : "People with this role see the data of every branch."}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
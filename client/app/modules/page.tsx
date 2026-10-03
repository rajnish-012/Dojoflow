"use client";
import { confirmAction, toast } from "@/lib/toast";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  LayoutGrid,
  Pencil,
  Plus,
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
} from "@/components/ui";

import {
  createModule,
  deleteModule,
  getModules,
  getRoles,
  notifyNavigationChanged,
  reorderModules,
  updateModule,
  type ManagedModule,
} from "@/lib/api";

import {
  NAVIGATION_ICONS,
  NAVIGATION_ICON_NAMES,
  getNavigationIcon,
} from "@/lib/navigation-icons";
import { PERMISSIONS, useCan } from "@/lib/permissions";

/* =========================================================
   CONSTANTS
   ========================================================= */

const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "BRANCH_ADMIN", label: "Branch Admin" },
  { value: "COACH", label: "Coach" },
  { value: "STUDENT", label: "Student" },
];

type ModuleForm = {
  id: string | null;
  key: string;
  label: string;
  href: string;
  icon: string;
  allowedRoles: string[];
  isSystem: boolean;
};

const EMPTY_FORM: ModuleForm = {
  id: null,
  key: "",
  label: "",
  href: "/",
  icon: "LayoutGrid",
  allowedRoles: ["SUPER_ADMIN"],
  isSystem: false,
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LOCKED_MODULE_KEYS = ["modules", "roles"];

function roleLabel(value: string, options: { value: string; label: string }[]) {
  return options.find((role) => role.value === value)?.label || value;
}

/* =========================================================
   PAGE
   ========================================================= */

export default function ModulesPage() {
  const canViewModules = useCan(PERMISSIONS.MODULE_VIEW);
  const canManageModules = useCan(PERMISSIONS.MODULE_MANAGE);

  const [modules, setModules] = useState<ManagedModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Roles come from the database (Roles page).
  const [roleOptions, setRoleOptions] = useState(ROLE_OPTIONS);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ModuleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  /* -------------------------------------------------------
     LOAD
     ------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    if (!canViewModules) {
      return () => {
        cancelled = true;
      };
    }

    getModules()
      .then((data) => {
        if (cancelled) return;

        setModules(data);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : "Failed to load modules");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, canViewModules]);

  useEffect(() => {
    let cancelled = false;

    getRoles()
      .then((list) => {
        if (cancelled) return;

        setRoleOptions(
          list.map((role) => ({
            value: role.key,
            label: role.name,
          })),
        );
      })
      .catch(() => {
        // Keep the built-in list if roles cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const sorted = useMemo(
    () =>
      [...modules].sort(
        (a, b) => a.order - b.order || a.label.localeCompare(b.label),
      ),
    [modules],
  );

  const refresh = () => {
    setReloadKey((count) => count + 1);
    notifyNavigationChanged();
  };

  /* -------------------------------------------------------
     ACTIONS
     ------------------------------------------------------- */

  const openCreate = () => {
    if (!canManageModules) return;
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: ManagedModule) => {
    if (!canManageModules) return;
    setForm({
      id: item._id,
      key: item.key,
      label: item.label,
      href: item.href,
      icon: item.icon,
      allowedRoles: item.allowedRoles,
      isSystem: item.isSystem,
    });
    setFormError("");
    setModalOpen(true);
  };

  const toggleRole = (role: string) => {
    setForm((previous) => ({
      ...previous,
      allowedRoles: previous.allowedRoles.includes(role)
        ? previous.allowedRoles.filter((item) => item !== role)
        : [...previous.allowedRoles, role],
    }));
  };

  const handleSave = async () => {
    if (!canManageModules) return;
    setFormError("");

    if (!form.label.trim()) {
      setFormError("Label is required");
      return;
    }

    try {
      setBusy(true);

      if (form.id) {
        await updateModule(form.id, {
          label: form.label,
          href: form.isSystem ? undefined : form.href,
          icon: form.icon,
          allowedRoles: form.allowedRoles,
        });

        toast.success("Module updated successfully.");
      } else {
        await createModule({
          key: form.key.trim() || slugify(form.label),
          label: form.label,
          href: form.href,
          icon: form.icon,
          allowedRoles: form.allowedRoles,
        });

        toast.success("Module created successfully.");
      }

      setModalOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save module.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (item: ManagedModule) => {
    if (!canManageModules) return;
    try {
      setBusy(true);

      await updateModule(item._id, {
        isActive: !item.isActive,
      });

      toast.success(
        item.isActive
          ? `${item.label} is now hidden`
          : `${item.label} is now visible`,
      );

      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update module.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: ManagedModule) => {
    if (!canManageModules) return;
    if (!(await confirmAction({ title: "Delete module?", message: `Delete the "${item.label}" module? This only removes it from the sidebar list.`, confirmLabel: "Delete module", destructive: true }))) {
      return;
    }

    try {
      setBusy(true);

      await deleteModule(item._id);

      toast.success("Module deleted successfully.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete module.");
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!canManageModules) return;
    const target = index + direction;

    if (target < 0 || target >= sorted.length) return;

    const next = [...sorted];
    [next[index], next[target]] = [next[target], next[index]];

    const items = next.map((item, position) => ({
      id: item._id,
      order: (position + 1) * 10,
    }));

    try {
      setBusy(true);

      await reorderModules(items);

      toast.success("Navigation order saved.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder modules.");
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------
     RENDER
     ------------------------------------------------------- */

  const PreviewIcon = NAVIGATION_ICONS[form.icon] ?? LayoutGrid;

  if (!canViewModules) {
    return (
      <div className="df-page">
        <PageHeader
          eyebrow="Authorization"
          title="Modules"
          description="Your role does not include permission to view modules."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="df-page">
        <PageHeader
          eyebrow="Academy Management"
          title="Modules"
          description="Control which pages appear in the sidebar, their order, and which roles can see them."
          actions={canManageModules ? (
              <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
                Add Module
              </Button>
          ) : undefined}
        />


        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoadingSpinner text="Loading modules..." />
          </div>
        ) : error ? (
          <ErrorState
            message={error}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  setReloadKey((count) => count + 1);
                }}
              >
                Try again
              </Button>
            }
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid size={26} />}
            title="No modules yet"
            description="Add your first module to build the sidebar."
          />
        ) : (
          <Card padding="none">
            <div className="flex flex-col gap-4 border-b border-(--line) px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold tracking-tight text-(--foreground)">
                    Sidebar Modules
                  </h2>

                  <Badge variant="neutral">{sorted.length}</Badge>
                </div>

                <p className="mt-1 text-sm text-(--ink-muted)">
                  Pages that appear in the sidebar, in the order shown here.
                </p>
              </div>

              <div className="rounded-xl border border-(--line) bg-(--surface) px-3.5 py-2 text-xs font-semibold text-(--ink-muted)">
                {sorted.filter((item) => item.isActive).length} visible
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px]">
                <thead className="border-b border-(--line) bg-(--surface)">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Order
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Module
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Route
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Visible to
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-(--ink-faint)">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-(--line)">
                  {sorted.map((item, index) => {
                    const Icon = getNavigationIcon(item.icon);

                    return (
                      <tr
                        key={item._id}
                        className="transition-colors duration-150 hover:bg-(--hover-bg)"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <IconButton
                              label={`Move ${item.label} up`}
                              title="Move up"
                              disabled={busy || index === 0}
                              onClick={() => void handleMove(index, -1)}
                            >
                              <ArrowUp size={16} />
                            </IconButton>

                            <IconButton
                              label={`Move ${item.label} down`}
                              title="Move down"
                              disabled={busy || index === sorted.length - 1}
                              onClick={() => void handleMove(index, 1)}
                            >
                              <ArrowDown size={16} />
                            </IconButton>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--accent-soft) text-(--accent)">
                              <Icon size={18} />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-(--foreground)">
                                {item.label}
                              </p>

                              <p className="mt-0.5 truncate text-xs text-(--ink-muted)">
                                {item.key}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5 text-sm text-(--ink-muted)">
                          {item.href}
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex flex-wrap gap-1.5">
                            {item.allowedRoles.length === 0 ? (
                              <span className="text-xs text-(--ink-muted)">
                                Nobody
                              </span>
                            ) : (
                              item.allowedRoles.map((role) => (
                                <Badge key={role} variant="neutral">
                                  {roleLabel(role, roleOptions)}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge
                              variant={item.isActive ? "success" : "warning"}
                            >
                              {item.isActive ? "Visible" : "Hidden"}
                            </Badge>

                            {item.isSystem && (
                              <Badge variant="info">System</Badge>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-5 text-right">
                          {canManageModules && <div className="flex items-center justify-end gap-2">
                            {!item.isSystem && (
                              <IconButton
                                label={
                                  item.isActive
                                    ? `Hide ${item.label}`
                                    : `Show ${item.label}`
                                }
                                disabled={busy}
                                onClick={() => void handleToggleActive(item)}
                                title={
                                  item.isActive ? "Hide module" : "Show module"
                                }
                              >
                                {item.isActive ? (
                                  <EyeOff size={16} />
                                ) : (
                                  <Eye size={16} />
                                )}
                              </IconButton>
                            )}

                            <IconButton
                              label={`Edit ${item.label}`}
                              disabled={busy}
                              onClick={() => openEdit(item)}
                              title="Edit module"
                            >
                              <Pencil size={16} />
                            </IconButton>

                            {!item.isSystem && (
                              <IconButton
                                variant="danger"
                                label={`Delete ${item.label}`}
                                disabled={busy}
                                onClick={() => void handleDelete(item)}
                                title="Delete module"
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            )}
                          </div>}
                        </td>
                      </tr>
                    );
                  })}
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
        title={form.id ? "Edit Module" : "Add Module"}
        description={
          form.isSystem
            ? "System module: the route is fixed and it cannot be hidden or deleted."
            : "A module points to a page that already exists in the app."
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

            {canManageModules && (
              <Button loading={busy} onClick={() => void handleSave()}>
                {form.id ? "Save Changes" : "Create Module"}
              </Button>
            )}
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
              htmlFor="module-label"
              className="mb-2 block text-xs font-extrabold text-(--foreground-soft)"
            >
              Label
            </label>

            <Input
              id="module-label"
              value={form.label}
              placeholder="Reports"
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  label: event.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="module-href"
                className="mb-2 block text-xs font-extrabold text-(--foreground-soft)"
              >
                Route
              </label>

              <Input
                id="module-href"
                value={form.href}
                disabled={form.isSystem}
                placeholder="/reports"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    href: event.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label
                htmlFor="module-key"
                className="mb-2 block text-xs font-extrabold text-(--foreground-soft)"
              >
                Key
              </label>

              <Input
                id="module-key"
                value={form.key}
                disabled={Boolean(form.id)}
                placeholder="auto from label"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    key: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="module-icon"
              className="mb-2 block text-xs font-extrabold text-(--foreground-soft)"
            >
              Icon
            </label>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                <PreviewIcon size={19} />
              </div>

              <Select
                id="module-icon"
                value={form.icon}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    icon: event.target.value,
                  }))
                }
              >
                {NAVIGATION_ICON_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-extrabold text-(--foreground-soft)">
              Visible to
            </p>

            <p className="mb-2 text-[11px] text-(--ink-muted)">
              This only controls the sidebar link. What a role can do inside the
              page is set separately.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {roleOptions.map((role) => {
                const locked =
                  LOCKED_MODULE_KEYS.includes(form.key) &&
                  role.value === "SUPER_ADMIN";

                return (
                  <label
                    key={role.value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-(--line) px-3 py-2.5 text-sm font-semibold text-(--foreground)"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-(--accent)"
                      disabled={locked}
                      checked={locked || form.allowedRoles.includes(role.value)}
                      onChange={() => toggleRole(role.value)}
                    />

                    {role.label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

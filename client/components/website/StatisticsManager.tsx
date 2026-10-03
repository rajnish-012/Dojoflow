"use client";
import { toast } from "@/lib/toast";

import {
  useEffect,
  useState,
} from "react";

import {
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  createWebsiteStatistic,
  deleteWebsiteStatistic,
  getWebsiteStatistics,
  updateWebsiteStatistic,
  type WebsiteStatistic,
} from "@/lib/websiteApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmationDialog,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal as AppModal,
  Textarea,
} from "@/components/ui";


type StatisticForm = {
  label: string;
  value: string;
  suffix: string;
  description: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
};


const emptyForm: StatisticForm = {
  label: "",
  value: "",
  suffix: "",
  description: "",
  icon: "",
  sortOrder: "0",
  isActive: true,
};


function statisticToForm(
  item: WebsiteStatistic,
): StatisticForm {
  return {
    label: item.label || "",
    value: item.value || "",
    suffix: item.suffix || "",
    description:
      item.description || "",
    icon: item.icon || "",
    sortOrder: String(
      item.sortOrder ?? 0,
    ),
    isActive:
      item.isActive !== false,
  };
}


export default function StatisticsManager() {
  const canManage = useCan(PERMISSIONS.WEBSITE_MANAGE);
  const [statistics, setStatistics] =
    useState<WebsiteStatistic[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [editing, setEditing] =
    useState<WebsiteStatistic | null>(
      null,
    );
  const [deleting, setDeleting] = useState<WebsiteStatistic | null>(null);

  const [form, setForm] =
    useState<StatisticForm>(emptyForm);


  async function loadStatistics() {
    try {
      setLoading(true);
      setError("");

      setStatistics(
        await getWebsiteStatistics(),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load statistics.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadStatistics();
  }, []);


  function openCreate() {
    if (!canManage) return;
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }


  function openEdit(
    statistic: WebsiteStatistic,
  ) {
    setEditing(statistic);
    setForm(
      statisticToForm(statistic),
    );
    setError("");
    setShowModal(true);
  }


  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  }


  async function handleSave(
    event: React.FormEvent,
  ) {
    event.preventDefault();
    if (!canManage) return;

    if (!form.label.trim()) {
      setError(
        "Statistic label is required.",
      );
      return;
    }

    if (!form.value.trim()) {
      setError(
        "Statistic value is required.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        label: form.label.trim(),
        value: form.value.trim(),
        suffix: form.suffix.trim(),
        description:
          form.description.trim(),
        icon: form.icon.trim(),
        sortOrder:
          Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };

      if (editing) {
        await updateWebsiteStatistic(
          editing._id,
          payload,
        );
      } else {
        await createWebsiteStatistic(
          payload,
        );
      }

      await loadStatistics();
      closeModal();
      toast.success(editing ? "Statistic updated." : "Statistic created.");
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save statistic.",
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleDelete(
    item: WebsiteStatistic,
  ) {
    if (!canManage) return;
    try {
      setError("");

      await deleteWebsiteStatistic(
        item._id,
      );

      await loadStatistics();
      toast.success("Statistic deleted.");
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete statistic.",
      );
    }
  }


  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
            Statistics
          </p>

          <h2 className="mt-1 text-xl font-black text-(--foreground)">
            Homepage numbers
          </h2>

          <p className="mt-1 text-sm text-(--ink-muted)">
            Manage the metrics displayed on
            the ForceStrike website.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadStatistics()} loading={loading}>
            <RefreshCw
              size={15}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </Button>

          {canManage && <Button onClick={openCreate}>
            <Plus size={16} />
            Add Statistic
          </Button>}
        </div>
      </div>

      {error && (
        <ErrorState message={error} className="py-5" />
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(
            (item) => (
              <Card key={item} className="h-36 animate-pulse">&nbsp;</Card>
            ),
          )}
        </div>
      ) : statistics.length === 0 ? (
        canManage ? (
          <EmptyState
            text="No statistics added yet."
            onClick={openCreate}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-(--line) p-8 text-center text-sm text-(--ink-muted)">
            No statistics have been added yet.
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statistics.map((item) => (
            <Card
              key={item._id}
              className="p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                  <span className="text-sm font-black">
                    {item.icon ||
                      "#"}
                  </span>
                </div>

                  <Badge variant={item.isActive ? "success" : "neutral"}>
                  {item.isActive
                    ? "ACTIVE"
                    : "HIDDEN"}
                  </Badge>
              </div>

              <div className="mt-5">
                <div className="text-3xl font-black text-(--foreground)">
                  {item.value}
                  {item.suffix}
                </div>

                <div className="mt-1 font-bold text-(--foreground)">
                  {item.label}
                </div>

                {item.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-(--ink-muted)">
                    {item.description}
                  </p>
                )}
              </div>

              {canManage && <div className="mt-5 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(item)}>
                  <Edit3
                    size={13}
                    className="mr-1 inline"
                  />
                  Edit
                </Button>

                <Button size="sm" variant="danger" onClick={() => setDeleting(item)} aria-label={`Delete ${item.label}`}>
                  <Trash2 size={14} />
                </Button>
              </div>}
            </Card>
          ))}
        </div>
      )}

      {showModal && canManage && (
        <AppModal
          open={showModal}
          title={
            editing
              ? "Edit Statistic"
              : "Create Statistic"
          }
          onClose={closeModal}
          footer={<><Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button><Button type="submit" form="statistic-form" loading={saving}>{editing ? "Save Changes" : "Create Statistic"}</Button></>}
        >
          <form id="statistic-form"
            onSubmit={handleSave}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Label"
                required
                value={form.label}
                onChange={(value) =>
                  setForm({
                    ...form,
                    label: value,
                  })
                }
                placeholder="Students Trained"
              />

              <Field
                label="Value"
                required
                value={form.value}
                onChange={(value) =>
                  setForm({
                    ...form,
                    value,
                  })
                }
                placeholder="500"
              />

              <Field
                label="Suffix"
                value={form.suffix}
                onChange={(value) =>
                  setForm({
                    ...form,
                    suffix: value,
                  })
                }
                placeholder="+"
              />

              <Field
                label="Icon"
                value={form.icon}
                onChange={(value) =>
                  setForm({
                    ...form,
                    icon: value,
                  })
                }
                placeholder="Users"
              />

              <Field
                label="Sort order"
                type="number"
                value={form.sortOrder}
                onChange={(value) =>
                  setForm({
                    ...form,
                    sortOrder: value,
                  })
                }
              />

              <label className="flex items-center gap-3 pt-6">
                <Checkbox
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isActive:
                        event.target
                          .checked,
                    })
                  }
                  className="h-4 w-4"
                />

                <span className="text-sm font-bold">
                  Active on website
                </span>
              </label>
            </div>

            <TextArea
              label="Description"
              value={form.description}
              onChange={(value) =>
                setForm({
                  ...form,
                  description: value,
                })
              }
            />

            {error && <p className="text-sm font-medium text-(--danger)">{error}</p>}
          </form>
        </AppModal>
      )}
      <ConfirmationDialog
        open={Boolean(deleting)}
        title="Delete statistic?"
        description={deleting ? `Delete “${deleting.label}”? This cannot be undone.` : ""}
        confirmLabel="Delete statistic"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void handleDelete(deleting).finally(() => setDeleting(null));
        }}
      />
    </section>
  );
}


function EmptyState({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-(--line-strong) bg-(--card) p-10 text-center">
      <p className="text-sm font-bold text-(--foreground)">
        {text}
      </p>

      <Button className="mt-4" onClick={onClick}>
        Add Statistic
      </Button>
    </div>
  );
}


function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold">
        {label}
        {required && (
          <span className="text-red-500">
            {" "}
            *
          </span>
        )}
      </span>

      <Input
        type={type}
        required={required}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
      />
    </label>
  );
}


function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold">
        {label}
      </span>

      <Textarea
        rows={3}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import {
  createWebsiteStatistic,
  deleteWebsiteStatistic,
  getWebsiteStatistics,
  updateWebsiteStatistic,
  type WebsiteStatistic,
} from "@/lib/websiteApi";


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
    } catch (caughtError) {
      setError(
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
    if (
      !window.confirm(
        `Delete "${item.label}"?`,
      )
    ) {
      return;
    }

    try {
      setError("");

      await deleteWebsiteStatistic(
        item._id,
      );

      await loadStatistics();
    } catch (caughtError) {
      setError(
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
          <button
            type="button"
            onClick={() =>
              void loadStatistics()
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-(--line) bg-(--card) px-3 text-sm font-semibold"
          >
            <RefreshCw
              size={15}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-(--accent) px-4 text-sm font-bold text-(--accent-contrast)"
          >
            <Plus size={16} />
            Add Statistic
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-2xl border border-(--line) bg-(--card)"
              />
            ),
          )}
        </div>
      ) : statistics.length === 0 ? (
        <EmptyState
          text="No statistics added yet."
          onClick={openCreate}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statistics.map((item) => (
            <article
              key={item._id}
              className="rounded-2xl border border-(--line) bg-(--card) p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                  <span className="text-sm font-black">
                    {item.icon ||
                      "#"}
                  </span>
                </div>

                <span
                  className={[
                    "rounded-full px-2 py-1 text-[10px] font-bold",
                    item.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500",
                  ].join(" ")}
                >
                  {item.isActive
                    ? "ACTIVE"
                    : "HIDDEN"}
                </span>
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

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openEdit(item)
                  }
                  className="flex-1 rounded-lg border border-(--line) py-2 text-xs font-bold"
                >
                  <Edit3
                    size={13}
                    className="mr-1 inline"
                  />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleDelete(
                      item,
                    )
                  }
                  className="rounded-lg border border-red-200 px-3 py-2 text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={
            editing
              ? "Edit Statistic"
              : "Create Statistic"
          }
          onClose={closeModal}
        >
          <form
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
                <input
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

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-(--line) px-4 py-2.5 text-sm font-bold"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-(--accent) px-5 py-2.5 text-sm font-bold text-(--accent-contrast)"
              >
                {saving
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Create Statistic"}
              </button>
            </div>
          </form>
        </Modal>
      )}
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

      <button
        type="button"
        onClick={onClick}
        className="mt-4 rounded-xl bg-(--accent) px-4 py-2 text-sm font-bold text-(--accent-contrast)"
      >
        Add Statistic
      </button>
    </div>
  );
}


function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-(--line) bg-(--card) p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-black">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-(--hover-bg)"
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
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

      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-(--line) bg-(--background) px-3 text-sm outline-none focus:border-(--accent)"
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

      <textarea
        rows={3}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-(--line) bg-(--background) px-3 py-2.5 text-sm outline-none focus:border-(--accent)"
      />
    </label>
  );
}
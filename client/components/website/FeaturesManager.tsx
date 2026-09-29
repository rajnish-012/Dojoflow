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
  createWebsiteFeature,
  deleteWebsiteFeature,
  getWebsiteFeatures,
  updateWebsiteFeature,
  type WebsiteFeature,
} from "@/lib/websiteApi";


type FeatureForm = {
  title: string;
  description: string;
  icon: string;
  image: string;
  linkText: string;
  linkUrl: string;
  sortOrder: string;
  isActive: boolean;
};


const emptyForm: FeatureForm = {
  title: "",
  description: "",
  icon: "",
  image: "",
  linkText: "",
  linkUrl: "",
  sortOrder: "0",
  isActive: true,
};


function toForm(
  item: WebsiteFeature,
): FeatureForm {
  return {
    title: item.title || "",
    description:
      item.description || "",
    icon: item.icon || "",
    image: item.image || "",
    linkText: item.linkText || "",
    linkUrl: item.linkUrl || "",
    sortOrder: String(
      item.sortOrder ?? 0,
    ),
    isActive:
      item.isActive !== false,
  };
}


export default function FeaturesManager() {
  const [features, setFeatures] =
    useState<WebsiteFeature[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [editing, setEditing] =
    useState<WebsiteFeature | null>(
      null,
    );

  const [showModal, setShowModal] =
    useState(false);

  const [form, setForm] =
    useState<FeatureForm>(emptyForm);


  async function loadFeatures() {
    try {
      setLoading(true);
      setError("");

      setFeatures(
        await getWebsiteFeatures(),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load features.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadFeatures();
  }, []);


  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }


  function openEdit(
    item: WebsiteFeature,
  ) {
    setEditing(item);
    setForm(toForm(item));
    setError("");
    setShowModal(true);
  }


  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditing(null);
  }


  async function handleSave(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError(
        "Feature title is required.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        title: form.title.trim(),
        description:
          form.description.trim(),
        icon: form.icon.trim(),
        image: form.image.trim(),
        linkText:
          form.linkText.trim(),
        linkUrl:
          form.linkUrl.trim(),
        sortOrder:
          Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };

      if (editing) {
        await updateWebsiteFeature(
          editing._id,
          payload,
        );
      } else {
        await createWebsiteFeature(
          payload,
        );
      }

      await loadFeatures();
      closeModal();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save feature.",
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleDelete(
    item: WebsiteFeature,
  ) {
    if (
      !window.confirm(
        `Delete "${item.title}"?`,
      )
    ) {
      return;
    }

    try {
      await deleteWebsiteFeature(
        item._id,
      );

      await loadFeatures();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete feature.",
      );
    }
  }


  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
            Features
          </p>

          <h2 className="mt-1 text-xl font-black">
            Homepage features
          </h2>

          <p className="mt-1 text-sm text-(--ink-muted)">
            Manage the benefits and highlights
            shown on ForceStrike.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void loadFeatures()
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-(--line) px-3 text-sm font-bold"
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
            Add Feature
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(
            (item) => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-2xl border border-(--line) bg-(--card)"
              />
            ),
          )}
        </div>
      ) : features.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--line-strong) p-10 text-center">
          <p className="font-bold">
            No features added yet.
          </p>

          <button
            type="button"
            onClick={openCreate}
            className="mt-4 rounded-xl bg-(--accent) px-4 py-2 text-sm font-bold text-(--accent-contrast)"
          >
            Add Feature
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((item) => (
            <article
              key={item._id}
              className="overflow-hidden rounded-2xl border border-(--line) bg-(--card) shadow-sm"
            >
              {item.image && (
                <div className="h-36 overflow-hidden bg-(--sidebar-bg)">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--accent-soft) text-sm font-black text-(--accent)">
                    {item.icon ||
                      "F"}
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

                <h3 className="mt-4 font-black">
                  {item.title}
                </h3>

                <p className="mt-2 line-clamp-3 text-sm leading-6 text-(--ink-muted)">
                  {item.description ||
                    "No description."}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-(--ink-muted)">
                    Order #
                    {item.sortOrder ?? 0}
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openEdit(item)
                      }
                      className="rounded-lg border border-(--line) px-3 py-2 text-xs font-bold"
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
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-(--line) bg-(--card) p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {editing
                  ? "Edit Feature"
                  : "Create Feature"}
              </h3>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 hover:bg-(--hover-bg)"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Title"
                  required
                  value={form.title}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      title: value,
                    })
                  }
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
                  placeholder="Shield"
                />

                <Field
                  label="Image URL"
                  value={form.image}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      image: value,
                    })
                  }
                  placeholder="https://..."
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

                <Field
                  label="Link text"
                  value={form.linkText}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      linkText: value,
                    })
                  }
                />

                <Field
                  label="Link URL"
                  value={form.linkUrl}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      linkUrl: value,
                    })
                  }
                />
              </div>

              <label>
                <span className="mb-1.5 block text-xs font-bold">
                  Description
                </span>

                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description:
                        event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-(--line) bg-(--background) px-3 py-2.5 text-sm outline-none focus:border-(--accent)"
                />
              </label>

              <label className="flex items-center gap-3">
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

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
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
                      : "Create Feature"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
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
        value={value}
        required={required}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-(--line) bg-(--background) px-3 text-sm outline-none focus:border-(--accent)"
      />
    </label>
  );
}
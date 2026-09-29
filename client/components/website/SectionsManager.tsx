"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Edit3,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";

import {
  getWebsiteSections,
  saveWebsiteSection,
  type WebsiteSection,
} from "@/lib/websiteApi";


type SectionForm = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  content: string;
  image: string;
  secondaryImage: string;
  ctaText: string;
  ctaUrl: string;
  highlights: string;
  sortOrder: string;
  isPublished: boolean;
};


const emptyForm: SectionForm = {
  key: "",
  title: "",
  subtitle: "",
  description: "",
  content: "",
  image: "",
  secondaryImage: "",
  ctaText: "",
  ctaUrl: "",
  highlights: "",
  sortOrder: "0",
  isPublished: true,
};


function toForm(
  item: WebsiteSection,
): SectionForm {
  return {
    key: item.key || "",
    title: item.title || "",
    subtitle: item.subtitle || "",
    description:
      item.description || "",
    content: item.content || "",
    image: item.image || "",
    secondaryImage:
      item.secondaryImage || "",
    ctaText: item.ctaText || "",
    ctaUrl: item.ctaUrl || "",
    highlights:
      item.highlights?.join("\n") || "",
    sortOrder: String(
      item.sortOrder ?? 0,
    ),
    isPublished:
      item.isPublished !== false,
  };
}


export default function SectionsManager() {
  const [sections, setSections] =
    useState<WebsiteSection[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [editing, setEditing] =
    useState<WebsiteSection | null>(
      null,
    );

  const [form, setForm] =
    useState<SectionForm>(emptyForm);


  async function loadSections() {
    try {
      setLoading(true);
      setError("");

      setSections(
        await getWebsiteSections(),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load sections.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadSections();
  }, []);


  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }


  function openEdit(
    section: WebsiteSection,
  ) {
    setEditing(section);
    setForm(toForm(section));
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

    if (!form.key.trim()) {
      setError(
        "Section key is required.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        key: form.key.trim(),
        title: form.title.trim(),
        subtitle:
          form.subtitle.trim(),
        description:
          form.description.trim(),
        content: form.content.trim(),
        image: form.image.trim(),
        secondaryImage:
          form.secondaryImage.trim(),
        ctaText: form.ctaText.trim(),
        ctaUrl: form.ctaUrl.trim(),
        highlights:
          form.highlights
            .split("\n")
            .map((item) =>
              item.trim(),
            )
            .filter(Boolean),
        sortOrder:
          Number(form.sortOrder) || 0,
        isPublished:
          form.isPublished,
      };

      await saveWebsiteSection(
        payload,
      );

      await loadSections();
      closeModal();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save section.",
      );
    } finally {
      setSaving(false);
    }
  }


  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
            Sections
          </p>

          <h2 className="mt-1 text-xl font-black">
            Homepage content sections
          </h2>

          <p className="mt-1 text-sm text-(--ink-muted)">
            Manage the major content blocks of
            the ForceStrike homepage.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void loadSections()
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
            Add Section
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(
            (item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl border border-(--line) bg-(--card)"
              />
            ),
          )}
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--line-strong) p-10 text-center">
          <p className="font-bold">
            No homepage sections yet.
          </p>

          <button
            type="button"
            onClick={openCreate}
            className="mt-4 rounded-xl bg-(--accent) px-4 py-2 text-sm font-bold text-(--accent-contrast)"
          >
            Add Section
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => (
            <article
              key={section._id}
              className="rounded-2xl border border-(--line) bg-(--card) p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-xs font-black uppercase text-(--accent)">
                    {section.key
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black">
                        {section.title ||
                          section.key}
                      </h3>

                      <span className="rounded-full bg-(--background) px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-(--ink-muted)">
                        {section.key}
                      </span>

                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[10px] font-bold",
                          section.isPublished
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500",
                        ].join(" ")}
                      >
                        {section.isPublished
                          ? "PUBLISHED"
                          : "DRAFT"}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-sm text-(--ink-muted)">
                      {section.description ||
                        section.subtitle ||
                        "No description."}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="mr-1 text-xs text-(--ink-muted)">
                    #{section.sortOrder ??
                      0}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      openEdit(section)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-(--line) px-3 py-2 text-xs font-bold"
                  >
                    <Edit3 size={13} />
                    Edit
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-(--line) bg-(--card) p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-(--accent)">
                  Homepage Section
                </p>

                <h3 className="text-lg font-black">
                  {editing
                    ? "Edit Section"
                    : "Create Section"}
                </h3>
              </div>

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
                  label="Section key"
                  required
                  value={form.key}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      key: value,
                    })
                  }
                  placeholder="about"
                />

                <Field
                  label="Title"
                  value={form.title}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      title: value,
                    })
                  }
                />

                <Field
                  label="Subtitle"
                  value={form.subtitle}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      subtitle: value,
                    })
                  }
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
                  label="Secondary image URL"
                  value={
                    form.secondaryImage
                  }
                  onChange={(value) =>
                    setForm({
                      ...form,
                      secondaryImage:
                        value,
                    })
                  }
                  placeholder="https://..."
                />

                <Field
                  label="CTA text"
                  value={form.ctaText}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      ctaText: value,
                    })
                  }
                />

                <Field
                  label="CTA URL"
                  value={form.ctaUrl}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      ctaUrl: value,
                    })
                  }
                />
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

              <TextArea
                label="Content"
                value={form.content}
                onChange={(value) =>
                  setForm({
                    ...form,
                    content: value,
                  })
                }
              />

              <TextArea
                label="Highlights"
                value={form.highlights}
                onChange={(value) =>
                  setForm({
                    ...form,
                    highlights: value,
                  })
                }
                placeholder={
                  "First highlight\nSecond highlight\nThird highlight"
                }
              />

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isPublished:
                        event.target
                          .checked,
                    })
                  }
                  className="h-4 w-4"
                />

                <span className="text-sm font-bold">
                  Publish section
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
                      : "Create Section"}
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold">
        {label}
      </span>

      <textarea
        rows={4}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-(--line) bg-(--background) px-3 py-2.5 text-sm outline-none focus:border-(--accent)"
      />
    </label>
  );
}
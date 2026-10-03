"use client";
import { confirmAction, toast } from "@/lib/toast";

import {
  useEffect,
  useState,
} from "react";

import {
  Edit3,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import {
  createWebsiteHero,
  deleteWebsiteHero,
  getWebsiteHeroes,
  updateWebsiteHero,
  type WebsiteHero,
} from "@/lib/websiteApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";


type HeroForm = {
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  image: string;
  mobileImage: string;
  primaryButtonText: string;
  primaryButtonUrl: string;
  secondaryButtonText: string;
  secondaryButtonUrl: string;
  sortOrder: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
};


const emptyForm: HeroForm = {
  title: "",
  subtitle: "",
  description: "",
  badge: "",
  image: "",
  mobileImage: "",
  primaryButtonText: "",
  primaryButtonUrl: "",
  secondaryButtonText: "",
  secondaryButtonUrl: "",
  sortOrder: "0",
  isActive: true,
  startDate: "",
  endDate: "",
};


function heroToForm(
  hero: WebsiteHero,
): HeroForm {
  return {
    title: hero.title || "",
    subtitle: hero.subtitle || "",
    description: hero.description || "",
    badge: hero.badge || "",
    image: hero.image || "",
    mobileImage: hero.mobileImage || "",
    primaryButtonText:
      hero.primaryButtonText || "",
    primaryButtonUrl:
      hero.primaryButtonUrl || "",
    secondaryButtonText:
      hero.secondaryButtonText || "",
    secondaryButtonUrl:
      hero.secondaryButtonUrl || "",
    sortOrder: String(
      hero.sortOrder ?? 0,
    ),
    isActive:
      hero.isActive !== false,
    startDate: hero.startDate
      ? hero.startDate.slice(0, 10)
      : "",
    endDate: hero.endDate
      ? hero.endDate.slice(0, 10)
      : "",
  };
}


export default function HeroManager() {
  const canManage = useCan(PERMISSIONS.WEBSITE_MANAGE);
  const [heroes, setHeroes] = useState<
    WebsiteHero[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [editingHero, setEditingHero] =
    useState<WebsiteHero | null>(null);

  const [form, setForm] =
    useState<HeroForm>(emptyForm);


  async function loadHeroes() {
    try {
      setLoading(true);
      setError("");

      const data =
        await getWebsiteHeroes();

      setHeroes(data || []);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load heroes.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadHeroes();
  }, []);


  function openCreate() {
    if (!canManage) return;
    setEditingHero(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }


  function openEdit(
    hero: WebsiteHero,
  ) {
    if (!canManage) return;
    setEditingHero(hero);
    setForm(heroToForm(hero));
    setError("");
    setShowModal(true);
  }


  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingHero(null);
    setForm(emptyForm);
  }


  function updateField(
    field: keyof HeroForm,
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }


  async function handleSave(
    event: React.FormEvent,
  ) {
    event.preventDefault();
    if (!canManage) return;

    if (!form.title.trim()) {
      setError(
        "Hero title is required.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        title: form.title.trim(),
        subtitle:
          form.subtitle.trim(),
        description:
          form.description.trim(),
        badge: form.badge.trim(),
        image: form.image.trim(),
        mobileImage:
          form.mobileImage.trim(),
        primaryButtonText:
          form.primaryButtonText.trim(),
        primaryButtonUrl:
          form.primaryButtonUrl.trim(),
        secondaryButtonText:
          form.secondaryButtonText.trim(),
        secondaryButtonUrl:
          form.secondaryButtonUrl.trim(),
        sortOrder:
          Number(form.sortOrder) || 0,
        isActive: form.isActive,
        startDate:
          form.startDate || null,
        endDate:
          form.endDate || null,
      };

      if (editingHero) {
        await updateWebsiteHero(
          editingHero._id,
          payload,
        );
      } else {
        await createWebsiteHero(
          payload,
        );
      }

      await loadHeroes();
      closeModal();
      toast.success(editingHero ? "Hero slide updated." : "Hero slide created.");
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save hero.",
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleDelete(
    hero: WebsiteHero,
  ) {
    if (!canManage) return;
    const confirmed = await confirmAction({ title: "Delete hero?", message: `Delete the hero "${hero.title}"? This cannot be undone.`, confirmLabel: "Delete hero", destructive: true });

    if (!confirmed) return;

    try {
      setError("");

      await deleteWebsiteHero(
        hero._id,
      );

      await loadHeroes();
      toast.success("Hero slide deleted.");
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete hero.",
      );
    }
  }


  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
            Hero
          </p>

          <h2 className="mt-1 text-xl font-black text-(--foreground)">
            Homepage hero slides
          </h2>

          <p className="mt-1 text-sm text-(--ink-muted)">
            Manage the first impression visitors
            see on ForceStrike.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadHeroes()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-(--line) bg-(--card) px-3 text-sm font-semibold text-(--foreground) transition hover:border-(--line-strong)"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>

          {canManage && <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-(--accent) px-4 text-sm font-bold text-(--accent-contrast) shadow-sm transition hover:opacity-90"
          >
            <Plus size={17} />
            Add Hero
          </button>}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="h-48 animate-pulse rounded-2xl border border-(--line) bg-(--card)"
            />
          ))}
        </div>
      ) : heroes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--line-strong) bg-(--card) p-10 text-center">
          <ImageIcon
            size={30}
            className="mx-auto text-(--ink-muted)"
          />

          <p className="mt-3 font-bold text-(--foreground)">
            No hero slides yet
          </p>

          <p className="mt-1 text-sm text-(--ink-muted)">
            Create your first homepage hero.
          </p>

          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 rounded-xl bg-(--accent) px-4 py-2.5 text-sm font-bold text-(--accent-contrast)"
            >
              Create Hero
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {heroes.map((hero) => (
            <article
              key={hero._id}
              className="overflow-hidden rounded-2xl border border-(--line) bg-(--card) shadow-sm"
            >
              <div className="relative h-48 overflow-hidden bg-(--sidebar-bg)">
                {hero.image ? (
                  <img
                    src={hero.image}
                    alt={hero.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-(--ink-muted)">
                    <ImageIcon size={36} />
                  </div>
                )}

                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />

                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    {hero.badge && (
                      <span className="mb-2 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                        {hero.badge}
                      </span>
                    )}

                    <h3 className="truncate text-lg font-black text-white">
                      {hero.title}
                    </h3>
                  </div>

                  <span
                    className={[
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
                      hero.isActive
                        ? "bg-emerald-500/90 text-white"
                        : "bg-white/20 text-white",
                    ].join(" ")}
                  >
                    {hero.isActive
                      ? "LIVE"
                      : "HIDDEN"}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p className="line-clamp-2 text-sm text-(--ink-muted)">
                  {hero.description ||
                    hero.subtitle ||
                    "No description provided."}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-(--ink-muted)">
                    Order #{hero.sortOrder ?? 0}
                  </span>

                  {canManage && <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openEdit(hero)
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--line) px-3 text-xs font-bold text-(--foreground) hover:bg-(--hover-bg)"
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleDelete(
                          hero,
                        )
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && canManage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-(--line) bg-(--card) shadow-2xl">
            <div className="flex items-center justify-between border-b border-(--line) px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-(--accent)">
                  Homepage
                </p>

                <h3 className="text-lg font-black text-(--foreground)">
                  {editingHero
                    ? "Edit Hero"
                    : "Create Hero"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-(--ink-muted) hover:bg-(--hover-bg)"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="max-h-[calc(92vh-76px)] overflow-y-auto p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Badge"
                  value={form.badge}
                  onChange={(value) =>
                    updateField(
                      "badge",
                      value,
                    )
                  }
                  placeholder="Train. Fight. Transform."
                />

                <Field
                  label="Title"
                  required
                  value={form.title}
                  onChange={(value) =>
                    updateField(
                      "title",
                      value,
                    )
                  }
                  placeholder="Hero title"
                />

                <Field
                  label="Subtitle"
                  value={form.subtitle}
                  onChange={(value) =>
                    updateField(
                      "subtitle",
                      value,
                    )
                  }
                  placeholder="Hero subtitle"
                />

                <Field
                  label="Sort order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(value) =>
                    updateField(
                      "sortOrder",
                      value,
                    )
                  }
                />

                <TextArea
                  label="Description"
                  value={form.description}
                  onChange={(value) =>
                    updateField(
                      "description",
                      value,
                    )
                  }
                  className="sm:col-span-2"
                  placeholder="Describe this hero..."
                />

                <Field
                  label="Desktop image URL"
                  value={form.image}
                  onChange={(value) =>
                    updateField(
                      "image",
                      value,
                    )
                  }
                  placeholder="https://..."
                />

                <Field
                  label="Mobile image URL"
                  value={form.mobileImage}
                  onChange={(value) =>
                    updateField(
                      "mobileImage",
                      value,
                    )
                  }
                  placeholder="https://..."
                />

                <Field
                  label="Primary button text"
                  value={
                    form.primaryButtonText
                  }
                  onChange={(value) =>
                    updateField(
                      "primaryButtonText",
                      value,
                    )
                  }
                  placeholder="Start Training"
                />

                <Field
                  label="Primary button URL"
                  value={
                    form.primaryButtonUrl
                  }
                  onChange={(value) =>
                    updateField(
                      "primaryButtonUrl",
                      value,
                    )
                  }
                  placeholder="/contact"
                />

                <Field
                  label="Secondary button text"
                  value={
                    form.secondaryButtonText
                  }
                  onChange={(value) =>
                    updateField(
                      "secondaryButtonText",
                      value,
                    )
                  }
                  placeholder="Explore Programs"
                />

                <Field
                  label="Secondary button URL"
                  value={
                    form.secondaryButtonUrl
                  }
                  onChange={(value) =>
                    updateField(
                      "secondaryButtonUrl",
                      value,
                    )
                  }
                  placeholder="/programs"
                />

                <Field
                  label="Start date"
                  type="date"
                  value={form.startDate}
                  onChange={(value) =>
                    updateField(
                      "startDate",
                      value,
                    )
                  }
                />

                <Field
                  label="End date"
                  type="date"
                  value={form.endDate}
                  onChange={(value) =>
                    updateField(
                      "endDate",
                      value,
                    )
                  }
                />
              </div>

              <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-(--line) bg-(--background) p-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    updateField(
                      "isActive",
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4 accent-[var(--accent)]"
                />

                <span>
                  <span className="block text-sm font-bold text-(--foreground)">
                    Publish hero
                  </span>

                  <span className="block text-xs text-(--ink-muted)">
                    Active heroes can appear on
                    the public website.
                  </span>
                </span>
              </label>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-(--line) px-4 py-2.5 text-sm font-bold text-(--foreground)"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-(--accent) px-5 py-2.5 text-sm font-bold text-(--accent-contrast) disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingHero
                      ? "Save Changes"
                      : "Create Hero"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}


/* =========================================================
   SMALL FORM COMPONENTS
========================================================= */

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
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-(--foreground)">
        {label}
        {required && (
          <span className="ml-1 text-red-500">
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
        className="h-10 w-full rounded-xl border border-(--line) bg-(--background) px-3 text-sm text-(--foreground) outline-none transition focus:border-(--accent)"
      />
    </label>
  );
}


function TextArea({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label
      className={`block ${className}`}
    >
      <span className="mb-1.5 block text-xs font-bold text-(--foreground)">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-xl border border-(--line) bg-(--background) px-3 py-2.5 text-sm leading-6 text-(--foreground) outline-none transition focus:border-(--accent)"
      />
    </label>
  );
}

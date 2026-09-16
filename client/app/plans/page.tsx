"use client";

import { useEffect, useState } from "react";
import {
  Award,
  CalendarDays,
  Check,
  Clock,
  Dumbbell,
  Edit3,
  Layers3,
  Plus,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
} from "@/lib/api";

type CurriculumItem = {
  day: number;
  title: string;
  description: string;
  skill: string;
};

type MilestoneItem = {
  day: number;
  belt: string;
  skill: string;
  description: string;
};

type Plan = {
  _id: string;
  name: string;
  price: number;
  duration: number;
  durationUnit: "MONTHS" | "DAYS";
  classesPerWeek: number;
  startingBelt: string;
  progressReports: string;
  milestones: MilestoneItem[];
  curriculum: CurriculumItem[];
  isActive: boolean;
};

type FormData = {
  name: string;
  price: string;
  duration: string;
  durationUnit: "MONTHS" | "DAYS";
  classesPerWeek: string;
  startingBelt: string;
  progressReports: string;
};

const emptyForm: FormData = {
  name: "",
  price: "",
  duration: "",
  durationUnit: "MONTHS",
  classesPerWeek: "4",
  startingBelt: "White",
  progressReports: "Monthly",
};

const beltColors: Record<string, string> = {
  White: "bg-slate-100 text-slate-700 border-slate-200",
  Yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Orange: "bg-orange-100 text-orange-700 border-orange-200",
  Green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Blue: "bg-blue-100 text-blue-700 border-blue-200",
  Purple: "bg-purple-100 text-purple-700 border-purple-200",
  Brown: "bg-amber-100 text-amber-800 border-amber-200",
  Black: "bg-slate-900 text-white border-slate-900",
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [curriculum, setCurriculum] = useState<CurriculumItem[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      setError("");

      const data = await getPlans();
      setPlans(data.plans || []);
    } catch (err: any) {
      setError(err.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingPlan(null);
    setForm({ ...emptyForm });
    setCurriculum([]);
    setMilestones([]);
    setFormError("");
    setShowModal(true);
  }

  function openEditModal(plan: Plan) {
    setEditingPlan(plan);

    setForm({
      name: plan.name || "",
      price: String(plan.price ?? ""),
      duration: String(plan.duration ?? ""),
      durationUnit: plan.durationUnit || "MONTHS",
      classesPerWeek: String(plan.classesPerWeek ?? 4),
      startingBelt: plan.startingBelt || "White",
      progressReports: plan.progressReports || "Monthly",
    });

    setCurriculum(
      (plan.curriculum || []).map((item) => ({
        day: item.day,
        title: item.title || "",
        description: item.description || "",
        skill: item.skill || "",
      }))
    );

    setMilestones(
      (plan.milestones || []).map((item) => ({
        day: item.day,
        belt: item.belt || "",
        skill: item.skill || "",
        description: item.description || "",
      }))
    );

    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingPlan(null);
    setFormError("");
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function addCurriculum() {
    setCurriculum((prev) => [
      ...prev,
      {
        day: prev.length + 1,
        title: "",
        description: "",
        skill: "",
      },
    ]);
  }

  function updateCurriculum(
    index: number,
    field: keyof CurriculumItem,
    value: string
  ) {
    setCurriculum((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "day" ? Number(value) : value,
            }
          : item
      )
    );
  }

  function removeCurriculum(index: number) {
    setCurriculum((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, index) => ({
          ...item,
          day: index + 1,
        }))
    );
  }

  function addMilestone() {
    setMilestones((prev) => [
      ...prev,
      {
        day: 1,
        belt: "",
        skill: "",
        description: "",
      },
    ]);
  }

  function updateMilestone(
    index: number,
    field: keyof MilestoneItem,
    value: string
  ) {
    setMilestones((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "day" ? Number(value) : value,
            }
          : item
      )
    );
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Plan name is required.");
      return;
    }

    if (!form.price || Number(form.price) < 0) {
      setFormError("Please enter a valid price.");
      return;
    }

    if (!form.duration || Number(form.duration) <= 0) {
      setFormError("Please enter a valid duration.");
      return;
    }

    if (!form.classesPerWeek || Number(form.classesPerWeek) <= 0) {
      setFormError("Please enter valid classes per week.");
      return;
    }

    for (const item of curriculum) {
      if (!item.day || !item.title.trim()) {
        setFormError("Every curriculum item must have a day and title.");
        return;
      }
    }

    for (const item of milestones) {
      if (!item.day || !item.belt.trim() || !item.skill.trim()) {
        setFormError("Every milestone must have a day, belt and skill.");
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      duration: Number(form.duration),
      durationUnit: form.durationUnit,
      classesPerWeek: Number(form.classesPerWeek),
      startingBelt: form.startingBelt.trim(),
      progressReports: form.progressReports.trim(),
      curriculum,
      milestones,
    };

    try {
      setSaving(true);

      if (editingPlan) {
        await updatePlan(editingPlan._id, payload);
      } else {
        await createPlan(payload);
      }

      closeModal();
      await loadPlans();
    } catch (err: any) {
      setFormError(
        err.message ||
          `Failed to ${editingPlan ? "update" : "create"} plan`
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plan: Plan) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${plan.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      await deletePlan(plan._id);
      await loadPlans();
    } catch (err: any) {
      setError(err.message || "Failed to delete plan");
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-5 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
            <Layers3 size={16} />
            Academy Management
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Training Plans
          </h1>

          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Create and manage structured training programs, curriculum,
            pricing, and belt progression.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-orange-600"
        >
          <Plus size={18} />
          Add Training Plan
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Layers3 size={20} />}
          label="Total Plans"
          value={plans.length}
          description="Available training programs"
        />

        <SummaryCard
          icon={<Check size={20} />}
          label="Active Plans"
          value={plans.filter((plan) => plan.isActive).length}
          description="Currently available"
        />

        <SummaryCard
          icon={<CalendarDays size={20} />}
          label="Curriculum Days"
          value={plans.reduce(
            (total, plan) => total + (plan.curriculum?.length || 0),
            0
          )}
          description="Across all plans"
        />

        <SummaryCard
          icon={<Award size={20} />}
          label="Milestones"
          value={plans.reduce(
            (total, plan) => total + (plan.milestones?.length || 0),
            0
          )}
          description="Belt progression checkpoints"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
          <p className="text-sm font-medium text-slate-500">
            Loading training plans...
          </p>
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <CalendarDays size={30} />
          </div>

          <h2 className="text-xl font-bold text-slate-900">
            No training plans yet
          </h2>

          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Create your first plan to organize classes, curriculum, and belt
            progression.
          </p>

          <button
            onClick={openCreateModal}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <Plus size={17} />
            Create First Plan
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan._id}
              plan={plan}
              onEdit={() => openEditModal(plan)}
              onDelete={() => handleDelete(plan)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600">
                  <Zap size={14} />
                  Plan Configuration
                </div>

                <h2 className="text-xl font-bold text-slate-950">
                  {editingPlan ? "Edit Training Plan" : "Create Training Plan"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Configure pricing, curriculum, and progression milestones.
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={21} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="overflow-y-auto px-5 py-6 sm:px-7"
            >
              {formError && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              {/* Basic Information */}
              <section>
                <SectionHeading
                  icon={<Layers3 size={18} />}
                  title="Basic Information"
                  description="Set the main details of this training plan."
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Plan Name" required>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Beginner Plan"
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label="Price" required>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                        ₹
                      </span>

                      <input
                        name="price"
                        type="number"
                        min="0"
                        value={form.price}
                        onChange={handleChange}
                        placeholder="4000"
                        className={`${inputClass} pl-8`}
                      />
                    </div>
                  </FormField>

                  <FormField label="Duration" required>
                    <input
                      name="duration"
                      type="number"
                      min="1"
                      value={form.duration}
                      onChange={handleChange}
                      placeholder="6"
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label="Duration Unit">
                    <select
                      name="durationUnit"
                      value={form.durationUnit}
                      onChange={handleChange}
                      className={selectClass}
                    >
                      <option value="MONTHS">Months</option>
                      <option value="DAYS">Days</option>
                    </select>
                  </FormField>

                  <FormField label="Classes Per Week" required>
                    <input
                      name="classesPerWeek"
                      type="number"
                      min="1"
                      value={form.classesPerWeek}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label="Starting Belt">
                    <select
                      name="startingBelt"
                      value={form.startingBelt}
                      onChange={handleChange}
                      className={selectClass}
                    >
                      <option value="White">White</option>
                      <option value="Yellow">Yellow</option>
                      <option value="Orange">Orange</option>
                      <option value="Green">Green</option>
                      <option value="Blue">Blue</option>
                      <option value="Purple">Purple</option>
                      <option value="Brown">Brown</option>
                      <option value="Black">Black</option>
                    </select>
                  </FormField>

                  <FormField label="Progress Reports">
                    <select
                      name="progressReports"
                      value={form.progressReports}
                      onChange={handleChange}
                      className={selectClass}
                    >
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                    </select>
                  </FormField>
                </div>
              </section>

              {/* Curriculum */}
              <section className="mt-10">
                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <SectionHeading
                    icon={<CalendarDays size={18} />}
                    title="Day-wise Curriculum"
                    description="Define what students learn on each training day."
                  />

                  <button
                    type="button"
                    onClick={addCurriculum}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                  >
                    <Plus size={16} />
                    Add Day
                  </button>
                </div>

                {curriculum.length === 0 ? (
                  <EmptySection
                    icon={<CalendarDays size={22} />}
                    text="No curriculum days added yet."
                  />
                ) : (
                  <div className="space-y-4">
                    {curriculum.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-sm font-bold text-orange-700">
                              {item.day}
                            </div>

                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                Training Day {item.day}
                              </p>
                              <p className="text-xs text-slate-500">
                                Curriculum lesson
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeCurriculum(index)}
                            className="rounded-xl p-2 text-red-500 transition hover:bg-red-100"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <FormField label="Day">
                            <input
                              type="number"
                              min="1"
                              value={item.day}
                              onChange={(e) =>
                                updateCurriculum(
                                  index,
                                  "day",
                                  e.target.value
                                )
                              }
                              className={inputClass}
                            />
                          </FormField>

                          <FormField label="Title">
                            <input
                              value={item.title}
                              onChange={(e) =>
                                updateCurriculum(
                                  index,
                                  "title",
                                  e.target.value
                                )
                              }
                              placeholder="e.g. Straight Punch"
                              className={inputClass}
                            />
                          </FormField>

                          <FormField label="Skill">
                            <input
                              value={item.skill}
                              onChange={(e) =>
                                updateCurriculum(
                                  index,
                                  "skill",
                                  e.target.value
                                )
                              }
                              placeholder="e.g. Punching"
                              className={inputClass}
                            />
                          </FormField>

                          <FormField label="Description">
                            <input
                              value={item.description}
                              onChange={(e) =>
                                updateCurriculum(
                                  index,
                                  "description",
                                  e.target.value
                                )
                              }
                              placeholder="Brief description"
                              className={inputClass}
                            />
                          </FormField>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Milestones */}
              <section className="mt-10">
                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <SectionHeading
                    icon={<Award size={18} />}
                    title="Belt Milestones"
                    description="Define belt progression checkpoints."
                  />

                  <button
                    type="button"
                    onClick={addMilestone}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                  >
                    <Plus size={16} />
                    Add Milestone
                  </button>
                </div>

                {milestones.length === 0 ? (
                  <EmptySection
                    icon={<Award size={22} />}
                    text="No milestones added yet."
                  />
                ) : (
                  <div className="space-y-4">
                    {milestones.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                              {index + 1}
                            </div>

                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                Milestone {index + 1}
                              </p>
                              <p className="text-xs text-slate-500">
                                Belt progression checkpoint
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeMilestone(index)}
                            className="rounded-xl p-2 text-red-500 transition hover:bg-red-100"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <FormField label="Day">
                            <input
                              type="number"
                              min="1"
                              value={item.day}
                              onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "day",
                                  e.target.value
                                )
                              }
                              className={inputClass}
                            />
                          </FormField>

                          <FormField label="Belt">
                            <select
                              value={item.belt}
                              onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "belt",
                                  e.target.value
                                )
                              }
                              className={selectClass}
                            >
                              <option value="">Select belt</option>
                              <option value="White">White</option>
                              <option value="Yellow">Yellow</option>
                              <option value="Orange">Orange</option>
                              <option value="Green">Green</option>
                              <option value="Blue">Blue</option>
                              <option value="Purple">Purple</option>
                              <option value="Brown">Brown</option>
                              <option value="Black">Black</option>
                            </select>
                          </FormField>

                          <FormField label="Skill">
                            <input
                              value={item.skill}
                              onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "skill",
                                  e.target.value
                                )
                              }
                              placeholder="e.g. Kicks & Blocking"
                              className={inputClass}
                            />
                          </FormField>

                          <FormField label="Description">
                            <input
                              value={item.description}
                              onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "description",
                                  e.target.value
                                )
                              }
                              placeholder="Milestone description"
                              className={inputClass}
                            />
                          </FormField>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Footer */}
              <div className="mt-10 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <Clock size={16} className="animate-spin" />}

                  {saving
                    ? editingPlan
                      ? "Updating..."
                      : "Creating..."
                    : editingPlan
                    ? "Update Plan"
                    : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable Components ---------- */

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-[#d7a84b] hover:shadow-[0_12px_30px_rgba(16,26,51,0.08)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          {icon}
        </div>

        <span className="text-xs font-medium text-slate-400">
          DojoFlow
        </span>
      </div>

      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>

      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function PlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan: Plan;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      {/* Top Accent */}
      <div className="h-1.5 bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-300" />

      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Dumbbell size={20} />
              </div>

              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Training Plan
              </span>
            </div>

            <h2 className="truncate text-xl font-bold text-slate-950">
              {plan.name}
            </h2>

            <div className="mt-2 flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  beltColors[plan.startingBelt] ||
                  "border-slate-200 bg-slate-100 text-slate-700"
                }`}
              >
                {plan.startingBelt} Belt
              </span>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  plan.isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {plan.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="mt-7 rounded-2xl bg-slate-950 p-5 text-white">
          <p className="text-xs font-medium text-slate-400">Plan investment</p>

          <div className="mt-1 flex items-end gap-2">
            <span className="text-3xl font-bold tracking-tight">
              ₹{plan.price.toLocaleString("en-IN")}
            </span>

            <span className="pb-1 text-sm text-slate-400">
              / {plan.duration}{" "}
              {plan.durationUnit === "MONTHS" ? "months" : "days"}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <DetailBox
            label="Classes / Week"
            value={String(plan.classesPerWeek)}
            icon={<CalendarDays size={15} />}
          />

          <DetailBox
            label="Reports"
            value={plan.progressReports}
            icon={<Clock size={15} />}
          />

          <DetailBox
            label="Curriculum"
            value={`${plan.curriculum?.length || 0} days`}
            icon={<Layers3 size={15} />}
          />

          <DetailBox
            label="Milestones"
            value={String(plan.milestones?.length || 0)}
            icon={<Award size={15} />}
          />
        </div>

        {/* Curriculum Preview */}
        {plan.curriculum?.length > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-orange-600" />
                <span className="text-sm font-bold text-slate-800">
                  Curriculum Preview
                </span>
              </div>

              <span className="text-xs font-medium text-slate-400">
                {plan.curriculum.length} total
              </span>
            </div>

            <div className="space-y-3">
              {plan.curriculum.slice(0, 3).map((item) => (
                <div
                  key={`${plan._id}-${item.day}`}
                  className="flex items-start gap-3"
                >
                  <div className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-white text-[11px] font-bold text-orange-600 shadow-sm">
                    {item.day}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {item.title}
                    </p>

                    {item.skill && (
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {item.skill}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {plan.curriculum.length > 3 && (
                <p className="pt-1 text-xs font-medium text-orange-600">
                  +{plan.curriculum.length - 3} more curriculum days
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3 border-t border-slate-100 pt-5">
          <button
            onClick={onEdit}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            <Edit3 size={16} />
            Edit
          </button>

          <button
            onClick={onDelete}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>

      <p className="truncate text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
        {icon}
      </div>

      <div>
        <h3 className="text-base font-bold text-slate-950">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-1 text-orange-600">*</span>}
      </label>

      {children}
    </div>
  );
}

function EmptySection({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center">
      <div className="mb-3 text-slate-400">{icon}</div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10";

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10";
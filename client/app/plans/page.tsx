"use client";

import { useEffect, useState } from "react";
import {
  Award,
  CalendarDays,
  Clock,
  Pencil,
  Plus,
  Trash2,
  X,
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
    setForm(emptyForm);
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
              [field]:
                field === "day" ? Number(value) : value,
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
              [field]:
                field === "day" ? Number(value) : value,
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
        setFormError(
          "Every curriculum item must have a day and title."
        );
        return;
      }
    }

    for (const item of milestones) {
      if (!item.day || !item.belt.trim() || !item.skill.trim()) {
        setFormError(
          "Every milestone must have a day, belt and skill."
        );
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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Training Plans
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage academy plans, curriculum and belt milestones.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus size={18} />
          Add Plan
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">
          Loading plans...
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <CalendarDays
            size={40}
            className="mx-auto mb-3 text-gray-400"
          />

          <h2 className="text-lg font-semibold text-gray-800">
            No plans found
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create your first training plan.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan._id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {plan.name}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Starting belt: {plan.startingBelt}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    plan.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {plan.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Price */}
              <div className="mt-5 flex items-end gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  ₹{plan.price}
                </span>

                <span className="pb-1 text-sm text-gray-500">
                  / {plan.duration}{" "}
                  {plan.durationUnit === "MONTHS"
                    ? "months"
                    : "days"}
                </span>
              </div>

              {/* Details */}
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    Classes / week
                  </span>

                  <span className="font-medium text-gray-800">
                    {plan.classesPerWeek}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    Progress reports
                  </span>

                  <span className="font-medium text-gray-800">
                    {plan.progressReports}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    Curriculum
                  </span>

                  <span className="font-medium text-gray-800">
                    {plan.curriculum?.length || 0} days
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    Milestones
                  </span>

                  <span className="font-medium text-gray-800">
                    {plan.milestones?.length || 0}
                  </span>
                </div>
              </div>

              {/* Curriculum Preview */}
              {plan.curriculum?.length > 0 && (
                <div className="mt-5 rounded-lg bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarDays
                      size={16}
                      className="text-gray-600"
                    />

                    <span className="text-sm font-semibold text-gray-800">
                      Curriculum Preview
                    </span>
                  </div>

                  <div className="space-y-2">
                    {plan.curriculum.slice(0, 3).map((item) => (
                      <div
                        key={`${plan._id}-${item.day}`}
                        className="flex gap-3 text-sm"
                      >
                        <span className="font-medium text-gray-500">
                          Day {item.day}
                        </span>

                        <span className="text-gray-700">
                          {item.title}
                        </span>
                      </div>
                    ))}

                    {plan.curriculum.length > 3 && (
                      <p className="pt-1 text-xs text-gray-400">
                        +{plan.curriculum.length - 3} more days
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-5 flex gap-3 border-t border-gray-100 pt-4">
                <button
                  onClick={() => openEditModal(plan)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Pencil size={16} />
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(plan)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingPlan ? "Edit Plan" : "Create Training Plan"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {editingPlan
                    ? "Update plan details, curriculum and milestones."
                    : "Define the training plan and progression structure."}
                </p>
              </div>

              <button
                onClick={closeModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Form Error */}
              {formError && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              {/* Basic Information */}
              <section>
                <h3 className="mb-4 text-base font-semibold text-gray-900">
                  Basic Information
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Plan Name
                    </label>

                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Beginner Plan"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Price
                    </label>

                    <input
                      name="price"
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={handleChange}
                      placeholder="4000"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Duration
                    </label>

                    <input
                      name="duration"
                      type="number"
                      min="1"
                      value={form.duration}
                      onChange={handleChange}
                      placeholder="6"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Duration Unit
                    </label>

                    <select
                      name="durationUnit"
                      value={form.durationUnit}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                    >
                      <option value="MONTHS">Months</option>
                      <option value="DAYS">Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Classes Per Week
                    </label>

                    <input
                      name="classesPerWeek"
                      type="number"
                      min="1"
                      value={form.classesPerWeek}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Starting Belt
                    </label>

                    <select
                      name="startingBelt"
                      value={form.startingBelt}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
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
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Progress Reports
                    </label>

                    <select
                      name="progressReports"
                      value={form.progressReports}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                    >
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Curriculum */}
              <section className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                      <CalendarDays size={18} />
                      Day-wise Curriculum
                    </h3>

                    <p className="mt-1 text-xs text-gray-500">
                      Define what students learn on each training day.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addCurriculum}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Plus size={16} />
                    Add Day
                  </button>
                </div>

                {curriculum.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                    No curriculum days added yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {curriculum.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">
                            Training Day {item.day}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              removeCurriculum(index)
                            }
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Day
                            </label>

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
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Title
                            </label>

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
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Skill
                            </label>

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
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Description
                            </label>

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
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Milestones */}
              <section className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                      <Award size={18} />
                      Belt Milestones
                    </h3>

                    <p className="mt-1 text-xs text-gray-500">
                      Define belt progression checkpoints.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addMilestone}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Plus size={16} />
                    Add Milestone
                  </button>
                </div>

                {milestones.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                    No milestones added yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {milestones.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">
                            Milestone {index + 1}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              removeMilestone(index)
                            }
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Day
                            </label>

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
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Belt
                            </label>

                            <select
                              value={item.belt}
                              onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "belt",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            >
                              <option value="">
                                Select belt
                              </option>
                              <option value="White">White</option>
                              <option value="Yellow">Yellow</option>
                              <option value="Orange">Orange</option>
                              <option value="Green">Green</option>
                              <option value="Blue">Blue</option>
                              <option value="Purple">Purple</option>
                              <option value="Brown">Brown</option>
                              <option value="Black">Black</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Skill
                            </label>

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
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Description
                            </label>

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
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Footer */}
              <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && (
                    <Clock size={16} className="animate-spin" />
                  )}

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
"use client";

import {
  Award,
  CalendarDays,
  Check,
  Clock3,
  Dumbbell,
  Edit3,
  Layers3,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

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
  SummaryCard,
} from "@/components/ui";

import {
  createPlan,
  deletePlan,
  getPlans,
  updatePlan,
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

const EMPTY_FORM: FormData = {
  name: "",
  price: "",
  duration: "",
  durationUnit: "MONTHS",
  classesPerWeek: "4",
  startingBelt: "White",
  progressReports: "Monthly",
};

const BELTS = [
  "White",
  "Yellow",
  "Orange",
  "Green",
  "Blue",
  "Purple",
  "Brown",
  "Black",
];

const BELT_STYLES: Record<string, string> = {
  White: "bg-(--hover-bg) text-(--foreground) border-(--line)",
  Yellow: "bg-(--yellow-soft) text-(--yellow) border-(--yellow-soft)",
  Orange: "bg-(--orange-soft) text-(--orange) border-(--orange-soft)",
  Green: "bg-(--green-soft) text-(--green) border-(--green-soft)",
  Blue: "bg-(--blue-soft) text-(--blue) border-(--blue-soft)",
  Purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Brown: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Black: "bg-(--foreground) text-(--background) border-(--foreground)",
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [curriculum, setCurriculum] = useState<CurriculumItem[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);

  useEffect(() => {
    void loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      setError("");

      const response = await getPlans();
      setPlans(Array.isArray(response?.plans) ? response.plans : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load training plans.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingPlan(null);
    setForm({ ...EMPTY_FORM });
    setCurriculum([]);
    setMilestones([]);
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(plan: Plan) {
    setEditingPlan(plan);

    setForm({
      name: plan.name ?? "",
      price: String(plan.price ?? ""),
      duration: String(plan.duration ?? ""),
      durationUnit: plan.durationUnit ?? "MONTHS",
      classesPerWeek: String(plan.classesPerWeek ?? 4),
      startingBelt: plan.startingBelt ?? "White",
      progressReports: plan.progressReports ?? "Monthly",
    });

    setCurriculum(
      (plan.curriculum ?? []).map((item) => ({
        day: Number(item.day) || 1,
        title: item.title ?? "",
        description: item.description ?? "",
        skill: item.skill ?? "",
      })),
    );

    setMilestones(
      (plan.milestones ?? []).map((item) => ({
        day: Number(item.day) || 1,
        belt: item.belt ?? "",
        skill: item.skill ?? "",
        description: item.description ?? "",
      })),
    );

    setFormError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingPlan(null);
    setFormError("");
  }

  function handleFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function addCurriculumDay() {
    setCurriculum((previous) => [
      ...previous,
      {
        day: previous.length + 1,
        title: "",
        description: "",
        skill: "",
      },
    ]);
  }

  function updateCurriculum(
    index: number,
    field: keyof CurriculumItem,
    value: string,
  ) {
    setCurriculum((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "day" ? Number(value) || 1 : value,
            }
          : item,
      ),
    );
  }

  function removeCurriculumDay(index: number) {
    setCurriculum((previous) =>
      previous
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({
          ...item,
          day: itemIndex + 1,
        })),
    );
  }

  function addMilestone() {
    setMilestones((previous) => [
      ...previous,
      {
        day: previous.length
          ? Math.max(...previous.map((item) => item.day)) + 1
          : 1,
        belt: "",
        skill: "",
        description: "",
      },
    ]);
  }

  function updateMilestone(
    index: number,
    field: keyof MilestoneItem,
    value: string,
  ) {
    setMilestones((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "day" ? Number(value) || 1 : value,
            }
          : item,
      ),
    );
  }

  function removeMilestone(index: number) {
    setMilestones((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "Plan name is required.";
    }

    if (!form.price || Number(form.price) < 0) {
      return "Please enter a valid price.";
    }

    if (!form.duration || Number(form.duration) <= 0) {
      return "Please enter a valid duration.";
    }

    if (!form.classesPerWeek || Number(form.classesPerWeek) <= 0) {
      return "Please enter valid classes per week.";
    }

    for (const item of curriculum) {
      if (!item.day || !item.title.trim()) {
        return "Every curriculum day must have a day number and title.";
      }
    }

    for (const item of milestones) {
      if (!item.day || !item.belt.trim() || !item.skill.trim()) {
        return "Every milestone must have a day, belt, and skill.";
      }
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      duration: Number(form.duration),
      durationUnit: form.durationUnit,
      classesPerWeek: Number(form.classesPerWeek),
      startingBelt: form.startingBelt.trim(),
      progressReports: form.progressReports.trim(),
      curriculum: curriculum
        .map((item) => ({
          ...item,
          title: item.title.trim(),
          skill: item.skill.trim(),
          description: item.description.trim(),
        }))
        .sort((a, b) => a.day - b.day),
      milestones: milestones
        .map((item) => ({
          ...item,
          belt: item.belt.trim(),
          skill: item.skill.trim(),
          description: item.description.trim(),
        }))
        .sort((a, b) => a.day - b.day),
    };

    try {
      setSaving(true);
      setFormError("");

      if (editingPlan) {
        await updatePlan(editingPlan._id, payload);
      } else {
        await createPlan(payload);
      }

      setModalOpen(false);
      setEditingPlan(null);
      await loadPlans();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : `Failed to ${
              editingPlan ? "update" : "create"
            } the training plan.`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plan: Plan) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${plan.name}"?`,
    );

    if (!confirmed) return;

    try {
      setError("");
      await deletePlan(plan._id);
      await loadPlans();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete the training plan.",
      );
    }
  }

  const activePlans = plans.filter((plan) => plan.isActive).length;
  const curriculumDays = plans.reduce(
    (total, plan) => total + (plan.curriculum?.length ?? 0),
    0,
  );
  const milestoneCount = plans.reduce(
    (total, plan) => total + (plan.milestones?.length ?? 0),
    0,
  );

  return (
    <div className="df-page">
      <PageHeader
        eyebrow="Academy Management"
        title="Training Plans"
        description="Create and manage structured training programs, curriculum, pricing, and belt progression."
        actions={
          <Button
            variant="primary"
            size="lg"
            onClick={openCreateModal}
          >
            <Plus size={18} />
            Add Training Plan
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Plans"
          value={plans.length}
          subtitle="Available training programs"
          icon={<Layers3 size={19} />}
        />

        <SummaryCard
          title="Active Plans"
          value={activePlans}
          subtitle="Currently available"
          icon={<Check size={19} />}
        />

        <SummaryCard
          title="Curriculum Days"
          value={curriculumDays}
          subtitle="Across all plans"
          icon={<CalendarDays size={19} />}
        />

        <SummaryCard
          title="Milestones"
          value={milestoneCount}
          subtitle="Belt progression checkpoints"
          icon={<Award size={19} />}
        />
      </div>

      {error && (
        <div className="mt-6">
          <ErrorState
            title="Unable to load plans"
            message={error}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadPlans()}
              >
                Try again
              </Button>
            }
          />
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <Card className="min-h-[300px]">
            <LoadingSpinner
              size="lg"
              text="Loading training plans..."
              fullPage
            />
          </Card>
        ) : plans.length === 0 ? (
          <EmptyState
            title="No training plans yet"
            description="Create your first plan to organize classes, curriculum, pricing, and belt progression."
            icon={<Layers3 size={22} />}
            action={
              <Button
                variant="secondary"
                onClick={openCreateModal}
              >
                <Plus size={17} />
                Create First Plan
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan._id}
                plan={plan}
                onEdit={() => openEditModal(plan)}
                onDelete={() => void handleDelete(plan)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="xl"
        title={
          editingPlan
            ? "Edit Training Plan"
            : "Create Training Plan"
        }
        description="Configure pricing, schedule, curriculum, and belt progression."
        footer={
          <>
            <Button
              variant="outline"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              variant="secondary"
              type="submit"
              form="plan-form"
              loading={saving}
            >
              {editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </>
        }
      >
        <form
          id="plan-form"
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          {formError && (
            <div className="rounded-xl border border-(--danger-soft) bg-(--danger-soft) px-4 py-3 text-sm font-medium text-(--danger)">
              {formError}
            </div>
          )}

          <FormSection
            icon={<Layers3 size={17} />}
            title="Basic Information"
            description="Set the core details for this training plan."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Plan Name" required>
                <Input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. Beginner Karate"
                />
              </Field>

              <Field label="Price" required>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-(--ink-muted)">
                    ₹
                  </span>
                  <Input
                    name="price"
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={handleFormChange}
                    placeholder="4000"
                    className="pl-8"
                  />
                </div>
              </Field>

              <Field label="Duration" required>
                <Input
                  name="duration"
                  type="number"
                  min="1"
                  value={form.duration}
                  onChange={handleFormChange}
                  placeholder="6"
                />
              </Field>

              <Field label="Duration Unit">
                <Select
                  name="durationUnit"
                  value={form.durationUnit}
                  onChange={handleFormChange}
                >
                  <option value="MONTHS">Months</option>
                  <option value="DAYS">Days</option>
                </Select>
              </Field>

              <Field label="Classes Per Week" required>
                <Input
                  name="classesPerWeek"
                  type="number"
                  min="1"
                  value={form.classesPerWeek}
                  onChange={handleFormChange}
                />
              </Field>

              <Field label="Starting Belt">
                <Select
                  name="startingBelt"
                  value={form.startingBelt}
                  onChange={handleFormChange}
                >
                  {BELTS.map((belt) => (
                    <option key={belt} value={belt}>
                      {belt}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Progress Reports">
                <Select
                  name="progressReports"
                  value={form.progressReports}
                  onChange={handleFormChange}
                >
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection
            icon={<CalendarDays size={17} />}
            title="Day-wise Curriculum"
            description="Define exactly what students learn on each training day."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCurriculumDay}
              >
                <Plus size={15} />
                Add Day
              </Button>
            }
          >
            {curriculum.length === 0 ? (
              <EmptyState
                title="No curriculum days"
                description="Add training days to build the plan's learning path."
                icon={<CalendarDays size={21} />}
                className="py-9"
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addCurriculumDay}
                  >
                    <Plus size={15} />
                    Add First Day
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {curriculum.map((item, index) => (
                  <CurriculumEditor
                    key={`curriculum-${index}`}
                    item={item}
                    index={index}
                    onChange={updateCurriculum}
                    onRemove={removeCurriculumDay}
                  />
                ))}
              </div>
            )}
          </FormSection>

          <FormSection
            icon={<Award size={17} />}
            title="Belt Milestones"
            description="Define the achievement checkpoints students work toward."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMilestone}
              >
                <Plus size={15} />
                Add Milestone
              </Button>
            }
          >
            {milestones.length === 0 ? (
              <EmptyState
                title="No milestones"
                description="Add belt checkpoints to track student progression."
                icon={<Award size={21} />}
                className="py-9"
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addMilestone}
                  >
                    <Plus size={15} />
                    Add First Milestone
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {milestones.map((item, index) => (
                  <MilestoneEditor
                    key={`milestone-${index}`}
                    item={item}
                    index={index}
                    onChange={updateMilestone}
                    onRemove={removeMilestone}
                  />
                ))}
              </div>
            )}
          </FormSection>
        </form>
      </Modal>
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
  const curriculum = plan.curriculum ?? [];
  const milestones = plan.milestones ?? [];

  return (
    <Card
      padding="none"
      className="group overflow-hidden hover:-translate-y-1 hover:shadow-[0_18px_45px_var(--shadow-color)]"
    >
      <div className="h-1 bg-gradient-to-r from-(--accent) via-(--gold) to-(--orange)" />

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                <Dumbbell size={19} />
              </div>

              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--ink-faint)">
                Training Plan
              </span>
            </div>

            <h2 className="mt-4 truncate text-xl font-extrabold tracking-tight text-(--foreground)">
              {plan.name}
            </h2>

            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                  BELT_STYLES[plan.startingBelt] ??
                  BELT_STYLES.White
                }`}
              >
                {plan.startingBelt || "White"} Belt
              </span>

              <Badge
                variant={
                  plan.isActive ? "success" : "default"
                }
              >
                {plan.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-(--line) bg-(--surface) p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--ink-faint)">
            Plan investment
          </p>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-(--foreground)">
              ₹{Number(plan.price ?? 0).toLocaleString("en-IN")}
            </span>

            <span className="text-xs font-medium text-(--ink-muted)">
              / {plan.duration}{" "}
              {plan.durationUnit === "MONTHS"
                ? "months"
                : "days"}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <PlanStat
            icon={<CalendarDays size={14} />}
            label="Classes / Week"
            value={String(plan.classesPerWeek ?? 0)}
          />

          <PlanStat
            icon={<Clock3 size={14} />}
            label="Reports"
            value={plan.progressReports || "—"}
          />

          <PlanStat
            icon={<Layers3 size={14} />}
            label="Curriculum"
            value={`${curriculum.length} days`}
          />

          <PlanStat
            icon={<Award size={14} />}
            label="Milestones"
            value={String(milestones.length)}
          />
        </div>

        {curriculum.length > 0 && (
          <div className="mt-4 rounded-2xl border border-(--line) bg-(--hover-bg) p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays
                  size={15}
                  className="text-(--accent)"
                />
                <span className="text-xs font-bold text-(--foreground)">
                  Curriculum Preview
                </span>
              </div>

              <span className="text-[10px] font-semibold text-(--ink-faint)">
                {curriculum.length} total
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {curriculum.slice(0, 3).map((item) => (
                <div
                  key={`${plan._id}-day-${item.day}`}
                  className="flex items-start gap-2.5 rounded-xl border border-(--line) bg-(--card) p-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-(--accent-soft) text-[10px] font-extrabold text-(--accent)">
                    {item.day}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-(--foreground)">
                      {item.title}
                    </p>

                    {item.skill && (
                      <p className="mt-0.5 truncate text-[10px] text-(--ink-muted)">
                        {item.skill}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {curriculum.length > 3 && (
                <p className="pt-1 text-[10px] font-bold text-(--accent)">
                  +{curriculum.length - 3} more curriculum days
                </p>
              )}
            </div>
          </div>
        )}

        {milestones.length > 0 && (
          <div className="mt-4 flex items-center gap-2 overflow-hidden">
            <Award
              size={14}
              className="shrink-0 text-(--gold)"
            />

            <div className="flex min-w-0 flex-wrap gap-1.5">
              {milestones.slice(0, 4).map((milestone, index) => (
                <span
                  key={`${plan._id}-milestone-${index}`}
                  className={`rounded-full border px-2 py-1 text-[9px] font-bold ${
                    BELT_STYLES[milestone.belt] ??
                    BELT_STYLES.White
                  }`}
                >
                  Day {milestone.day} · {milestone.belt}
                </span>
              ))}

              {milestones.length > 4 && (
                <span className="rounded-full bg-(--hover-bg) px-2 py-1 text-[9px] font-bold text-(--ink-muted)">
                  +{milestones.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2 border-t border-(--line) pt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onEdit}
          >
            <Edit3 size={14} />
            Edit
          </Button>

          <Button
            variant="danger"
            size="sm"
            className="flex-1"
            onClick={onDelete}
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PlanStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-(--line) bg-(--card) px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-(--ink-faint)">
        {icon}
        <span className="text-[9px] font-semibold">
          {label}
        </span>
      </div>

      <p className="mt-1 truncate text-xs font-extrabold text-(--foreground)">
        {value}
      </p>
    </div>
  );
}

function FormSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
            {icon}
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-(--foreground)">
              {title}
            </h3>

            <p className="mt-1 text-xs leading-5 text-(--ink-muted)">
              {description}
            </p>
          </div>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-(--foreground-soft)">
        {label}
        {required && (
          <span className="ml-1 text-(--danger)">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function CurriculumEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: CurriculumItem;
  index: number;
  onChange: (
    index: number,
    field: keyof CurriculumItem,
    value: string,
  ) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-(--line) bg-(--surface) p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--accent-soft) text-xs font-extrabold text-(--accent)">
            {item.day}
          </span>

          <div>
            <p className="text-xs font-extrabold text-(--foreground)">
              Training Day {item.day}
            </p>
            <p className="text-[10px] text-(--ink-faint)">
              Curriculum lesson #{index + 1}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remove training day ${item.day}`}
          onClick={() => onRemove(index)}
          className="text-(--danger) hover:bg-(--danger-soft) hover:text-(--danger)"
        >
          <Trash2 size={15} />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Day" required>
          <Input
            type="number"
            min="1"
            value={item.day}
            onChange={(event) =>
              onChange(index, "day", event.target.value)
            }
          />
        </Field>

        <Field label="Title" required>
          <Input
            value={item.title}
            onChange={(event) =>
              onChange(index, "title", event.target.value)
            }
            placeholder="e.g. Warm-up + Basic Stance"
          />
        </Field>

        <Field label="Skill">
          <Input
            value={item.skill}
            onChange={(event) =>
              onChange(index, "skill", event.target.value)
            }
            placeholder="e.g. Stance"
          />
        </Field>

        <Field label="Description">
          <Input
            value={item.description}
            onChange={(event) =>
              onChange(
                index,
                "description",
                event.target.value,
              )
            }
            placeholder="Brief lesson description"
          />
        </Field>
      </div>
    </div>
  );
}

function MilestoneEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: MilestoneItem;
  index: number;
  onChange: (
    index: number,
    field: keyof MilestoneItem,
    value: string,
  ) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-(--line) bg-(--surface) p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--gold-soft) text-(--gold)">
            <Award size={15} />
          </span>

          <div>
            <p className="text-xs font-extrabold text-(--foreground)">
              Milestone {index + 1}
            </p>
            <p className="text-[10px] text-(--ink-faint)">
              Belt progression checkpoint
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remove milestone ${index + 1}`}
          onClick={() => onRemove(index)}
          className="text-(--danger) hover:bg-(--danger-soft) hover:text-(--danger)"
        >
          <Trash2 size={15} />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Day" required>
          <Input
            type="number"
            min="1"
            value={item.day}
            onChange={(event) =>
              onChange(index, "day", event.target.value)
            }
          />
        </Field>

        <Field label="Belt" required>
          <Select
            value={item.belt}
            onChange={(event) =>
              onChange(index, "belt", event.target.value)
            }
          >
            <option value="">Select belt</option>
            {BELTS.map((belt) => (
              <option key={belt} value={belt}>
                {belt}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Skill" required>
          <Input
            value={item.skill}
            onChange={(event) =>
              onChange(index, "skill", event.target.value)
            }
            placeholder="e.g. Kicks & Blocking"
          />
        </Field>

        <Field label="Description">
          <Input
            value={item.description}
            onChange={(event) =>
              onChange(
                index,
                "description",
                event.target.value,
              )
            }
            placeholder="Milestone description"
          />
        </Field>
      </div>
    </div>
  );
}

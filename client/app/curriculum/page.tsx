"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Target,
  Trash2,
} from "lucide-react";

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

import { getPlans, updatePlan } from "@/lib/api";

type CurriculumItem = {
  day: number;
  title: string;
  description?: string;
  skill?: string;
};

type Milestone = {
  day: number;
  belt: string;
  skill: string;
  description?: string;
};

type Plan = {
  _id: string;
  name: string;
  price: number;
  duration: number;
  durationUnit: "MONTHS" | "DAYS";
  classesPerWeek: number;
  startingBelt?: string;
  progressReports?: string;
  curriculum?: CurriculumItem[];
  milestones?: Milestone[];
  isActive?: boolean;
};

type CurriculumForm = {
  day: number;
  title: string;
  skill: string;
  description: string;
};

type FormMode = "add" | "edit";

export default function CurriculumPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [expandedDays, setExpandedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [editingOriginalDay, setEditingOriginalDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState<CurriculumForm>({
    day: 1,
    title: "",
    skill: "",
    description: "",
  });

  useEffect(() => {
    void loadPlans();
  }, []);

  async function loadPlans(preferredPlanId?: string) {
    try {
      setLoading(true);
      setError("");

      const response = await getPlans();
      const fetchedPlans: Plan[] = Array.isArray(response?.plans)
        ? response.plans
        : [];

      setPlans(fetchedPlans);

      const preferred = preferredPlanId
        ? fetchedPlans.find((plan) => plan._id === preferredPlanId)
        : undefined;

      const firstWithCurriculum = fetchedPlans.find(
        (plan) => Array.isArray(plan.curriculum) && plan.curriculum.length > 0,
      );

      setSelectedPlanId(
        preferred?._id ??
          firstWithCurriculum?._id ??
          fetchedPlans[0]?._id ??
          "",
      );
      setExpandedDays([]);
    } catch (err: unknown) {
      console.error("Failed to load curriculum:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load curriculum.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan._id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const curriculum = useMemo(
    () =>
      [...(selectedPlan?.curriculum ?? [])].sort((a, b) => a.day - b.day),
    [selectedPlan],
  );

  const milestones = useMemo(
    () =>
      [...(selectedPlan?.milestones ?? [])].sort((a, b) => a.day - b.day),
    [selectedPlan],
  );

  const milestoneDays = useMemo(
    () => new Set(milestones.map((item) => item.day)),
    [milestones],
  );

  function getMilestoneForDay(day: number) {
    return milestones.find((milestone) => milestone.day === day);
  }

  function toggleDay(day: number) {
    setExpandedDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  }

  function expandAll() {
    setExpandedDays(curriculum.map((item) => item.day));
  }

  function collapseAll() {
    setExpandedDays([]);
  }

  function handlePlanChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedPlanId(event.target.value);
    setExpandedDays([]);
  }

  function getNextDay() {
    if (curriculum.length === 0) return 1;
    return Math.max(...curriculum.map((item) => item.day)) + 1;
  }

  function openAddModal() {
    setFormMode("add");
    setEditingOriginalDay(null);
    setActionError("");
    setForm({
      day: getNextDay(),
      title: "",
      skill: "",
      description: "",
    });
    setModalOpen(true);
  }

  function openEditModal(item: CurriculumItem) {
    setFormMode("edit");
    setEditingOriginalDay(item.day);
    setActionError("");
    setForm({
      day: item.day,
      title: item.title,
      skill: item.skill ?? "",
      description: item.description ?? "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setActionError("");
  }

  function handleFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === "day" ? Number(value) : value,
    }));
  }

  async function saveCurriculumDay() {
    if (!selectedPlan) return;

    const day = Number(form.day);
    const title = form.title.trim();

    if (!Number.isInteger(day) || day < 1) {
      setActionError("Day must be a positive whole number.");
      return;
    }

    if (!title) {
      setActionError("Training title is required.");
      return;
    }

    const duplicateDay = curriculum.some(
      (item) =>
        item.day === day &&
        (formMode === "add" || item.day !== editingOriginalDay),
    );

    if (duplicateDay) {
      setActionError(`Day ${day} already exists in this training plan.`);
      return;
    }

    const nextItem: CurriculumItem = {
      day,
      title,
      ...(form.skill.trim() ? { skill: form.skill.trim() } : {}),
      ...(form.description.trim()
        ? { description: form.description.trim() }
        : {}),
    };

    const nextCurriculum =
      formMode === "edit"
        ? curriculum
            .filter((item) => item.day !== editingOriginalDay)
            .concat(nextItem)
            .sort((a, b) => a.day - b.day)
        : [...curriculum, nextItem].sort((a, b) => a.day - b.day);

    try {
      setSaving(true);
      setActionError("");

      const response = await updatePlan(selectedPlan._id, {
        curriculum: nextCurriculum,
      });

      const updatedPlan: Plan = response?.plan ?? {
        ...selectedPlan,
        curriculum: nextCurriculum,
      };

      setPlans((current) =>
        current.map((plan) =>
          plan._id === updatedPlan._id ? updatedPlan : plan,
        ),
      );

      setExpandedDays((current) =>
        formMode === "edit" && editingOriginalDay !== day
          ? current
              .filter((item) => item !== editingOriginalDay)
              .concat(day)
          : current.includes(day)
            ? current
            : [...current, day],
      );

      setModalOpen(false);
    } catch (err: unknown) {
      console.error("Failed to save curriculum day:", err);

      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to save curriculum day.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurriculumDay(day: number) {
    if (!selectedPlan) return;

    const item = curriculum.find((entry) => entry.day === day);
    if (!item) return;

    const confirmed = window.confirm(
      `Delete Day ${day} - ${item.title}? This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setActionError("");

      const nextCurriculum = curriculum.filter((entry) => entry.day !== day);

      const response = await updatePlan(selectedPlan._id, {
        curriculum: nextCurriculum,
      });

      const updatedPlan: Plan = response?.plan ?? {
        ...selectedPlan,
        curriculum: nextCurriculum,
      };

      setPlans((current) =>
        current.map((plan) =>
          plan._id === updatedPlan._id ? updatedPlan : plan,
        ),
      );

      setExpandedDays((current) =>
        current.filter((itemDay) => itemDay !== day),
      );
    } catch (err: unknown) {
      console.error("Failed to delete curriculum day:", err);

      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to delete curriculum day.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="df-page">
        <Card className="min-h-[360px]">
          <LoadingSpinner size="lg" text="Loading curriculum..." fullPage />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="df-page">
        <ErrorState
          title="Unable to load curriculum"
          message={error}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadPlans(selectedPlanId)}
            >
              <RefreshCw size={15} />
              Try Again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="df-page">
      <PageHeader
        eyebrow="Academy Management"
        title="Curriculum"
        description="View and manage the day-wise training curriculum and milestone progression for each training plan."
        actions={
          <div className="flex items-center gap-2 rounded-2xl border border-(--line) bg-(--card) px-4 py-3 shadow-[0_8px_28px_var(--shadow-color)]">
            <Layers3 size={18} className="text-(--gold)" />
            <span className="text-sm font-bold text-(--foreground)">
              {plans.length} training {plans.length === 1 ? "plan" : "plans"}
            </span>
          </div>
        }
      />

      <Card padding="md">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="w-full xl:max-w-2xl">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--accent-soft) text-(--accent)">
                <Layers3 size={16} />
              </div>
              <label
                htmlFor="training-plan"
                className="text-sm font-extrabold text-(--foreground)"
              >
                Select Training Plan
              </label>
            </div>

            {plans.length === 0 ? (
              <EmptyState
                title="No training plans found"
                description="Create a training plan before adding day-wise curriculum."
                icon={<Layers3 size={21} />}
                className="py-8"
              />
            ) : (
              <Select
                id="training-plan"
                value={selectedPlanId}
                onChange={handlePlanChange}
              >
                {plans.map((plan) => (
                  <option key={plan._id} value={plan._id}>
                    {plan.name}
                    {plan.isActive === false ? " (Inactive)" : ""}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {selectedPlan && (
            <div className="flex flex-wrap gap-2">
              <InfoPill>{selectedPlan.classesPerWeek} classes / week</InfoPill>
              <InfoPill>
                {selectedPlan.duration} {selectedPlan.durationUnit === "MONTHS" ? "months" : "days"}
              </InfoPill>
              <InfoPill>Starting: {selectedPlan.startingBelt || "White"}</InfoPill>
              {selectedPlan.isActive === false && <Badge variant="warning">Inactive</Badge>}
            </div>
          )}
        </div>
      </Card>

      {selectedPlan && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Curriculum Days"
              value={curriculum.length}
              subtitle="Scheduled training days"
              icon={<BookOpen size={19} />}
            />
            <SummaryCard
              title="Classes / Week"
              value={selectedPlan.classesPerWeek}
              subtitle="Weekly training schedule"
              icon={<CalendarDays size={19} />}
            />
            <SummaryCard
              title="Milestones"
              value={milestones.length}
              subtitle="Belt progression points"
              icon={<Award size={19} />}
            />
            <SummaryCard
              title="Progress Reports"
              value={selectedPlan.progressReports || "—"}
              subtitle="Student progress tracking"
              icon={<Target size={19} />}
            />
          </div>

          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-(--line) px-5 py-6 sm:px-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                    <BookOpen size={19} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-extrabold tracking-tight text-(--foreground) sm:text-2xl">
                        {selectedPlan.name} Curriculum
                      </h2>
                      {selectedPlan.isActive === false && (
                        <Badge variant="warning">Inactive</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-(--ink-muted)">
                      Add, edit and organize every training day for this plan.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {curriculum.length > 0 && (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={expandAll}>
                        <ChevronDown size={15} />
                        Expand All
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={collapseAll}>
                        <ChevronUp size={15} />
                        Collapse All
                      </Button>
                    </>
                  )}
                  <Button type="button" variant="primary" size="sm" onClick={openAddModal}>
                    <Plus size={16} />
                    Add Day
                  </Button>
                </div>
              </div>
            </div>

            {actionError && !modalOpen && (
              <div className="mx-5 mt-5 rounded-xl border border-(--danger)/20 bg-(--danger)/5 px-4 py-3 text-sm font-medium text-(--danger) sm:mx-7">
                {actionError}
              </div>
            )}

            {curriculum.length === 0 ? (
              <EmptyState
                title="No curriculum added yet"
                description={`Start building ${selectedPlan.name} by adding Day 1 and continue day by day.`}
                icon={<BookOpen size={24} />}
                className="py-16"
                action={
                  <Button type="button" onClick={openAddModal}>
                    <Plus size={16} />
                    Add First Day
                  </Button>
                }
              />
            ) : (
              <div>
                {curriculum.map((item) => {
                  const expanded = expandedDays.includes(item.day);
                  const milestone = getMilestoneForDay(item.day);

                  return (
                    <CurriculumRow
                      key={`${selectedPlan._id}-${item.day}`}
                      item={item}
                      milestone={milestone}
                      expanded={expanded}
                      saving={saving}
                      onToggle={() => toggleDay(item.day)}
                      onEdit={() => openEditModal(item)}
                      onDelete={() => void deleteCurriculumDay(item.day)}
                    />
                  );
                })}
              </div>
            )}
          </Card>

          {curriculum.length > 0 && (
            <Card>
              <SectionTitle
                icon={<Clock3 size={18} />}
                title="Training Timeline"
                description="Curriculum progression across training days."
              />

              <div className="mt-7 overflow-x-auto pb-2">
                <div className="flex min-w-max items-start px-2">
                  {curriculum.map((item, index) => {
                    const milestone = getMilestoneForDay(item.day);

                    return (
                      <div key={`timeline-${selectedPlan._id}-${item.day}`} className="flex items-start">
                        <div className="flex w-32 flex-col items-center text-center">
                          <button
                            type="button"
                            onClick={() => toggleDay(item.day)}
                            className={[
                              "flex h-11 w-11 items-center justify-center rounded-full",
                              "border border-(--line) bg-(--surface)",
                              "text-xs font-extrabold text-(--foreground)",
                              "transition-all duration-200",
                              "hover:-translate-y-0.5 hover:border-(--gold)",
                              milestoneDays.has(item.day) ? "ring-4 ring-(--gold-soft)" : "",
                            ].join(" ")}
                            aria-label={`Open training day ${item.day}`}
                          >
                            {item.day}
                          </button>
                          <p className="mt-2 max-w-28 text-[11px] font-bold leading-4 text-(--foreground-soft)">
                            {item.title}
                          </p>
                          {milestone && (
                            <span className="mt-1.5 text-[10px] font-bold text-(--green)">
                              {milestone.belt}
                            </span>
                          )}
                        </div>
                        {index < curriculum.length - 1 && (
                          <div className="mt-[22px] h-px w-10 bg-(--line)" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={formMode === "add" ? "Add Curriculum Day" : "Edit Curriculum Day"}
        description={
          formMode === "add"
            ? `Add a training day to ${selectedPlan?.name ?? "this plan"}.`
            : "Update the training content for this curriculum day."
        }
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveCurriculumDay()} loading={saving}>
              <Save size={15} />
              {formMode === "add" ? "Add Day" : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {actionError && (
            <div className="rounded-xl border border-(--danger)/20 bg-(--danger)/5 px-4 py-3 text-sm font-medium text-(--danger)">
              {actionError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
            <Field label="Day" htmlFor="curriculum-day">
              <Input
                id="curriculum-day"
                name="day"
                type="number"
                min={1}
                step={1}
                value={form.day}
                onChange={handleFormChange}
                disabled={saving}
              />
            </Field>

            <Field label="Training Title" htmlFor="curriculum-title" required>
              <Input
                id="curriculum-title"
                name="title"
                value={form.title}
                onChange={handleFormChange}
                placeholder="e.g. Basic Punching Techniques"
                disabled={saving}
              />
            </Field>
          </div>

          <Field label="Skill / Category" htmlFor="curriculum-skill">
            <Input
              id="curriculum-skill"
              name="skill"
              value={form.skill}
              onChange={handleFormChange}
              placeholder="e.g. Fighting, Stamina, Defense"
              disabled={saving}
            />
          </Field>

          <Field label="Training Description" htmlFor="curriculum-description">
            <textarea
              id="curriculum-description"
              name="description"
              value={form.description}
              onChange={handleFormChange}
              placeholder="Describe what the student will learn or practice on this day..."
              rows={5}
              disabled={saving}
              className="w-full resize-y rounded-xl border border-(--line) bg-(--input-bg) px-3.5 py-3 text-sm text-(--foreground) outline-none transition-all placeholder:text-(--ink-muted) focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/15 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </Field>

          <div className="flex items-start gap-3 rounded-xl border border-(--line) bg-(--surface) p-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--accent-soft) text-(--accent)">
              <Check size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-(--foreground)">Curriculum is saved to this training plan</p>
              <p className="mt-1 text-xs leading-5 text-(--ink-muted)">
                Students using this plan will see the updated day-wise curriculum and progress tracking will use these curriculum days.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CurriculumRow({
  item,
  milestone,
  expanded,
  saving,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: CurriculumItem;
  milestone?: Milestone;
  expanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border-b border-(--line) last:border-b-0">
      <div className="flex items-center gap-3 px-5 py-5 sm:gap-4 sm:px-7">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-sm font-extrabold text-(--accent)">
            {item.day}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-(--foreground)">
                {item.title}
              </span>
              {item.skill && (
                <span className="rounded-full bg-(--hover-bg) px-2.5 py-1 text-[10px] font-bold text-(--ink-muted)">
                  {item.skill}
                </span>
              )}
            </span>

            {!expanded && item.description && (
              <span className="mt-1 block truncate text-xs text-(--ink-muted)">
                {item.description}
              </span>
            )}
          </span>

          <span className="flex shrink-0 items-center gap-3">
            {milestone && (
              <span className="hidden items-center gap-1.5 rounded-full bg-(--green-soft) px-3 py-1.5 text-[10px] font-bold text-(--green) sm:inline-flex">
                <Award size={12} />
                {milestone.belt}
              </span>
            )}
            {expanded ? (
              <ChevronUp size={18} className="text-(--ink-muted)" />
            ) : (
              <ChevronDown size={18} className="text-(--ink-muted)" />
            )}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            disabled={saving}
            aria-label={`Edit day ${item.day}`}
            className="px-2"
          >
            <Pencil size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={saving}
            aria-label={`Delete day ${item.day}`}
            className="px-2 text-(--danger) hover:text-(--danger)"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="bg-(--surface) px-5 pb-6 pt-1 sm:px-7">
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailPanel icon={<BookOpen size={17} />} title="Training Details">
              {item.description ? (
                <p className="text-sm leading-6 text-(--foreground-soft)">{item.description}</p>
              ) : (
                <p className="text-sm text-(--ink-muted)">No description provided.</p>
              )}

              {item.skill && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-(--ink-faint)">Skill</span>
                  <Badge variant="default">{item.skill}</Badge>
                </div>
              )}
            </DetailPanel>

            <DetailPanel icon={<Award size={17} />} title="Milestone">
              {milestone ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-(--green-soft) px-3 py-1.5 text-xs font-bold text-(--green)">
                      {milestone.belt}
                    </span>
                    <span className="text-sm font-extrabold text-(--foreground)">
                      {milestone.skill}
                    </span>
                  </div>
                  {milestone.description && (
                    <p className="mt-4 text-sm leading-6 text-(--foreground-soft)">
                      {milestone.description}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-(--ink-muted)">No milestone assigned to this day.</p>
              )}
            </DetailPanel>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-(--line) bg-(--card) p-5">
      <div className="flex items-center gap-2 text-(--gold)">
        {icon}
        <h3 className="text-sm font-extrabold text-(--foreground)">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-extrabold text-(--foreground)">{title}</h2>
        <p className="mt-1 text-xs text-(--ink-muted)">{description}</p>
      </div>
    </div>
  );
}

function InfoPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-(--line) bg-(--surface) px-3 py-2 text-xs font-bold text-(--foreground-soft)">
      {children}
    </span>
  );
}

function Field({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-2 block text-xs font-bold text-(--foreground)">
        {label}
        {required && <span className="ml-1 text-(--danger)">*</span>}
      </span>
      {children}
    </label>
  );
}

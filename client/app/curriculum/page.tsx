"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Award,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Layers3,
  RefreshCw,
  Target,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSpinner,
  PageHeader,
  Select,
  SummaryCard,
} from "@/components/ui";

import { getPlans } from "@/lib/api";

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

export default function CurriculumPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [expandedDays, setExpandedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      setError("");

      const response = await getPlans();
      const fetchedPlans: Plan[] = Array.isArray(response?.plans)
        ? response.plans
        : [];

      setPlans(fetchedPlans);

      const firstWithCurriculum = fetchedPlans.find(
        (plan) =>
          Array.isArray(plan.curriculum) &&
          plan.curriculum.length > 0,
      );

      setSelectedPlanId(
        firstWithCurriculum?._id ??
          fetchedPlans[0]?._id ??
          "",
      );
      setExpandedDays([]);
    } catch (err: unknown) {
      console.error("Failed to load curriculum:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load curriculum.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = useMemo(
    () =>
      plans.find((plan) => plan._id === selectedPlanId) ??
      null,
    [plans, selectedPlanId],
  );

  const curriculum = useMemo(
    () =>
      [...(selectedPlan?.curriculum ?? [])].sort(
        (a, b) => a.day - b.day,
      ),
    [selectedPlan],
  );

  const milestones = useMemo(
    () =>
      [...(selectedPlan?.milestones ?? [])].sort(
        (a, b) => a.day - b.day,
      ),
    [selectedPlan],
  );

  const milestoneDays = useMemo(
    () => new Set(milestones.map((item) => item.day)),
    [milestones],
  );

  function getMilestoneForDay(day: number) {
    return milestones.find(
      (milestone) => milestone.day === day,
    );
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

  function handlePlanChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ) {
    setSelectedPlanId(event.target.value);
    setExpandedDays([]);
  }

  if (loading) {
    return (
      <div className="df-page">
        <Card className="min-h-[360px]">
          <LoadingSpinner
            size="lg"
            text="Loading curriculum..."
            fullPage
          />
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
              onClick={() => void loadPlans()}
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
        description="View the day-wise training curriculum and milestone progression for each training plan."
        actions={
          <div className="flex items-center gap-2 rounded-2xl border border-(--line) bg-(--card) px-4 py-3 shadow-[0_8px_28px_var(--shadow-color)]">
            <Layers3
              size={18}
              className="text-(--gold)"
            />
            <span className="text-sm font-bold text-(--foreground)">
              {plans.length} training{" "}
              {plans.length === 1 ? "plan" : "plans"}
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
                description="Create a training plan and add curriculum from the Plans section."
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
                  <option
                    key={plan._id}
                    value={plan._id}
                  >
                    {plan.name}
                    {plan.isActive === false
                      ? " (Inactive)"
                      : ""}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {selectedPlan && (
            <div className="flex flex-wrap gap-2">
              <InfoPill>
                {selectedPlan.classesPerWeek} classes / week
              </InfoPill>

              <InfoPill>
                {selectedPlan.duration}{" "}
                {selectedPlan.durationUnit === "MONTHS"
                  ? "months"
                  : "days"}
              </InfoPill>

              <InfoPill>
                Starting:{" "}
                {selectedPlan.startingBelt || "White"}
              </InfoPill>

              {selectedPlan.isActive === false && (
                <Badge variant="warning">Inactive</Badge>
              )}
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
              value={
                selectedPlan.progressReports || "—"
              }
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
                        <Badge variant="warning">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1.5 text-sm text-(--ink-muted)">
                      Day-wise training program and milestone
                      progression.
                    </p>
                  </div>
                </div>

                {curriculum.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={expandAll}
                    >
                      <ChevronDown size={15} />
                      Expand All
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={collapseAll}
                    >
                      <ChevronUp size={15} />
                      Collapse All
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {curriculum.length === 0 ? (
              <EmptyState
                title="No curriculum added"
                description="Add day-wise curriculum from the Plans section."
                icon={<BookOpen size={24} />}
                className="py-20"
              />
            ) : (
              <div>
                {curriculum.map((item) => {
                  const expanded = expandedDays.includes(
                    item.day,
                  );
                  const milestone =
                    getMilestoneForDay(item.day);

                  return (
                    <CurriculumRow
                      key={`${selectedPlan._id}-${item.day}`}
                      item={item}
                      milestone={milestone}
                      expanded={expanded}
                      onToggle={() =>
                        toggleDay(item.day)
                      }
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
                    const milestone =
                      getMilestoneForDay(item.day);

                    return (
                      <div
                        key={`timeline-${selectedPlan._id}-${item.day}`}
                        className="flex items-start"
                      >
                        <div className="flex w-32 flex-col items-center text-center">
                          <button
                            type="button"
                            onClick={() =>
                              toggleDay(item.day)
                            }
                            className={[
                              "flex h-11 w-11 items-center justify-center rounded-full",
                              "border border-(--line) bg-(--surface)",
                              "text-xs font-extrabold text-(--foreground)",
                              "transition-all duration-200",
                              "hover:-translate-y-0.5 hover:border-(--gold)",
                              milestoneDays.has(item.day)
                                ? "ring-4 ring-(--gold-soft)"
                                : "",
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

                        {index <
                          curriculum.length - 1 && (
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
    </div>
  );
}

function CurriculumRow({
  item,
  milestone,
  expanded,
  onToggle,
}: {
  item: CurriculumItem;
  milestone?: Milestone;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-(--line) last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={[
          "flex w-full items-center gap-3 px-5 py-5 text-left",
          "transition-colors duration-200",
          "hover:bg-(--hover-bg)",
          "sm:gap-4 sm:px-7",
        ].join(" ")}
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
            <ChevronUp
              size={18}
              className="text-(--ink-muted)"
            />
          ) : (
            <ChevronDown
              size={18}
              className="text-(--ink-muted)"
            />
          )}
        </span>
      </button>

      {expanded && (
        <div className="bg-(--surface) px-5 pb-6 pt-1 sm:px-7">
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailPanel
              icon={<BookOpen size={17} />}
              title="Training Details"
            >
              {item.description ? (
                <p className="text-sm leading-6 text-(--foreground-soft)">
                  {item.description}
                </p>
              ) : (
                <p className="text-sm text-(--ink-muted)">
                  No description provided.
                </p>
              )}

              {item.skill && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-(--ink-faint)">
                    Skill
                  </span>
                  <Badge variant="default">
                    {item.skill}
                  </Badge>
                </div>
              )}
            </DetailPanel>

            <DetailPanel
              icon={<Award size={17} />}
              title="Milestone"
            >
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
                <p className="text-sm text-(--ink-muted)">
                  No milestone assigned to this day.
                </p>
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
        <h3 className="text-sm font-extrabold text-(--foreground)">
          {title}
        </h3>
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
        <h2 className="text-lg font-extrabold text-(--foreground)">
          {title}
        </h2>

        <p className="mt-1 text-xs text-(--ink-muted)">
          {description}
        </p>
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

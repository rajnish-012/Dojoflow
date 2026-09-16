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
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      setError("");

      const data = await getPlans();
      const fetchedPlans: Plan[] = data?.plans || [];

      setPlans(fetchedPlans);

      const firstPlanWithCurriculum = fetchedPlans.find(
        (plan) => Array.isArray(plan.curriculum) && plan.curriculum.length > 0,
      );

      if (firstPlanWithCurriculum) {
        setSelectedPlanId(firstPlanWithCurriculum._id);
      } else if (fetchedPlans.length > 0) {
        setSelectedPlanId(fetchedPlans[0]._id);
      } else {
        setSelectedPlanId("");
      }
    } catch (err) {
      console.error("Failed to load curriculum:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load curriculum",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan._id === selectedPlanId) || null;
  }, [plans, selectedPlanId]);

  const curriculum = useMemo(() => {
    if (!selectedPlan?.curriculum) return [];

    return [...selectedPlan.curriculum].sort((a, b) => a.day - b.day);
  }, [selectedPlan]);

  const milestones = useMemo(() => {
    if (!selectedPlan?.milestones) return [];

    return [...selectedPlan.milestones].sort((a, b) => a.day - b.day);
  }, [selectedPlan]);

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

  function getMilestoneForDay(day: number) {
    return milestones.find((milestone) => milestone.day === day);
  }

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#f5f7fb] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 text-sm font-medium text-[#697386]">
          <RefreshCw size={18} className="animate-spin text-[#ff4d00]" />
          Loading curriculum...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-80px)] bg-[#f5f7fb] px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">{error}</p>

          <button
            type="button"
            onClick={loadPlans}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#050a1c] px-5 text-sm font-bold text-white transition hover:bg-[#17213d]"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
              <Layers3 size={16} />
              Academy Management
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Curriculum
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              View the day-wise training curriculum and milestone progression
              for each training plan.
            </p>
          </div>

          <div className="inline-flex h-14 w-fit items-center justify-center gap-3 rounded-2xl border border-[#e1e7ef] bg-white px-5 text-[15px] font-bold text-[#34445d] shadow-[0_4px_14px_rgba(16,26,51,0.04)] sm:px-6">
            <Layers3 size={20} className="text-[#c78316]" />
            {plans.length} training plans
          </div>
        </div>

        {/* =====================================================
            PLAN SELECTOR
        ====================================================== */}
        <section className="rounded-2xl border border-[#e4e9f0] bg-white p-5 shadow-[0_4px_18px_rgba(16,26,51,0.035)] sm:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="w-full xl:max-w-[560px]">
              <label
                htmlFor="training-plan"
                className="mb-2 block text-sm font-bold text-[#34445d]"
              >
                Select Training Plan
              </label>

              {plans.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d9e0e9] bg-[#fafbfd] px-4 py-4">
                  <p className="text-sm font-bold text-[#34445d]">
                    No training plans found.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#9aa5b5]">
                    Create a plan and add curriculum from the Plans section.
                  </p>
                </div>
              ) : (
                <select
                  id="training-plan"
                  value={selectedPlanId}
                  onChange={(event) => {
                    setSelectedPlanId(event.target.value);
                    setExpandedDays([]);
                  }}
                  className="h-12 w-full rounded-xl border border-[#dfe6ef] bg-[#fafbfd] px-4 text-sm font-medium text-[#34445d] outline-none transition focus:border-[#d9a63d] focus:bg-white focus:ring-4 focus:ring-[#d9a63d]/10"
                >
                  {plans.map((plan) => (
                    <option key={plan._id} value={plan._id}>
                      {plan.name}
                      {plan.isActive === false ? " (Inactive)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedPlan && (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#f5f7fb] px-3 py-2 text-xs font-bold text-[#697386]">
                  {selectedPlan.classesPerWeek} classes / week
                </span>

                <span className="rounded-full bg-[#f5f7fb] px-3 py-2 text-xs font-bold text-[#697386]">
                  {selectedPlan.duration}{" "}
                  {selectedPlan.durationUnit === "MONTHS" ? "months" : "days"}
                </span>

                <span className="rounded-full bg-[#f5f7fb] px-3 py-2 text-xs font-bold text-[#697386]">
                  Starting: {selectedPlan.startingBelt || "White"}
                </span>

                {selectedPlan.isActive === false && (
                  <span className="rounded-full bg-[#fff5df] px-3 py-2 text-xs font-bold text-[#b67b1d]">
                    Inactive
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {selectedPlan && (
          <>
            {/* =====================================================
                SUMMARY CARDS
            ====================================================== */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={<BookOpen size={20} />}
                label="Curriculum Days"
                value={curriculum.length}
                description="Scheduled training days"
                iconClass="bg-[#edf3ff] text-[#4774c8]"
              />

              <SummaryCard
                icon={<CalendarDays size={21} />}
                label="Classes / Week"
                value={selectedPlan.classesPerWeek}
                description="Weekly training schedule"
                iconClass="bg-[#edf9f2] text-[#29945d]"
              />

              <SummaryCard
                icon={<Award size={21} />}
                label="Milestones"
                value={milestones.length}
                description="Belt progression points"
                iconClass="bg-[#fff6e8] text-[#c78316]"
              />

              <SummaryCard
                icon={<Target size={21} />}
                label="Progress Reports"
                value={selectedPlan.progressReports || "—"}
                description="Student progress tracking"
                iconClass="bg-[#f3edff] text-[#8055c9]"
                valueClass="text-xl"
              />
            </div>

            {/* =====================================================
                CURRICULUM DIRECTORY
            ====================================================== */}
            <section className="overflow-hidden rounded-2xl border border-[#e4e9f0] bg-white shadow-[0_4px_18px_rgba(16,26,51,0.035)]">
              <div className="flex flex-col gap-5 border-b border-[#edf0f4] px-5 py-6 sm:px-7 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-[23px] font-bold tracking-[-0.03em] text-[#071126] sm:text-[25px]">
                    {selectedPlan.name} Curriculum
                  </h2>

                  <p className="mt-2 text-[15px] text-[#60708a] sm:text-[16px]">
                    Day-wise training program and milestone progression.
                  </p>
                </div>

                {curriculum.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="rounded-xl border border-[#e1e7ef] px-4 py-2.5 text-xs font-bold text-[#697386] transition hover:bg-[#f8fafc] hover:text-[#34445d]"
                    >
                      Expand All
                    </button>

                    <button
                      type="button"
                      onClick={collapseAll}
                      className="rounded-xl border border-[#e1e7ef] px-4 py-2.5 text-xs font-bold text-[#697386] transition hover:bg-[#f8fafc] hover:text-[#34445d]"
                    >
                      Collapse All
                    </button>
                  </div>
                )}
              </div>

              {curriculum.length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5f7fb] text-[#9aa5b5]">
                    <BookOpen size={28} />
                  </div>

                  <p className="mt-4 text-sm font-bold text-[#34445d]">
                    No curriculum added
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#9aa5b5]">
                    Add day-wise curriculum from the Plans section.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#edf0f4]">
                  {curriculum.map((item) => {
                    const expanded = expandedDays.includes(item.day);

                    const milestone = getMilestoneForDay(item.day);

                    return (
                      <div key={`${selectedPlan._id}-${item.day}`}>
                        <button
                          type="button"
                          onClick={() => toggleDay(item.day)}
                          aria-expanded={expanded}
                          className="flex w-full items-center gap-3 px-5 py-5 text-left transition hover:bg-[#fbfcfe] sm:gap-4 sm:px-7"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#050a1c] text-sm font-bold text-white">
                            {item.day}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-[#101a33]">
                                {item.title}
                              </h3>

                              {item.skill && (
                                <span className="rounded-full bg-[#f5f7fb] px-2.5 py-1 text-[11px] font-bold text-[#697386]">
                                  {item.skill}
                                </span>
                              )}
                            </div>

                            {!expanded && item.description && (
                              <p className="mt-1 truncate text-xs text-[#9aa5b5]">
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            {milestone && (
                              <span className="hidden items-center gap-1.5 rounded-full bg-[#edf9f2] px-3 py-1.5 text-[11px] font-bold text-[#29945d] sm:inline-flex">
                                <Award size={13} />
                                {milestone.belt}
                              </span>
                            )}

                            {expanded ? (
                              <ChevronUp size={19} className="text-[#9aa5b5]" />
                            ) : (
                              <ChevronDown
                                size={19}
                                className="text-[#9aa5b5]"
                              />
                            )}
                          </div>
                        </button>

                        {expanded && (
                          <div className="bg-[#fafbfd] px-5 pb-6 pt-1 sm:px-7">
                            <div className="grid gap-5 lg:grid-cols-2">
                              {/* Training Details */}
                              <div className="rounded-xl border border-[#e4e9f0] bg-white p-5">
                                <div className="flex items-center gap-2">
                                  <BookOpen
                                    size={18}
                                    className="text-[#c78316]"
                                  />

                                  <h4 className="text-sm font-bold text-[#34445d]">
                                    Training Details
                                  </h4>
                                </div>

                                {item.description ? (
                                  <p className="mt-4 text-sm leading-6 text-[#697386]">
                                    {item.description}
                                  </p>
                                ) : (
                                  <p className="mt-4 text-sm text-[#9aa5b5]">
                                    No description provided.
                                  </p>
                                )}

                                {item.skill && (
                                  <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-[#9aa5b5]">
                                      Skill:
                                    </span>

                                    <span className="rounded-full bg-[#f5f7fb] px-3 py-1.5 text-xs font-bold text-[#697386]">
                                      {item.skill}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Milestone */}
                              <div className="rounded-xl border border-[#e4e9f0] bg-white p-5">
                                <div className="flex items-center gap-2">
                                  <Award size={18} className="text-[#c78316]" />

                                  <h4 className="text-sm font-bold text-[#34445d]">
                                    Milestone
                                  </h4>
                                </div>

                                {milestone ? (
                                  <div className="mt-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-[#edf9f2] px-3 py-1.5 text-xs font-bold text-[#29945d]">
                                        {milestone.belt}
                                      </span>

                                      <span className="text-sm font-bold text-[#34445d]">
                                        {milestone.skill}
                                      </span>
                                    </div>

                                    {milestone.description && (
                                      <p className="mt-4 text-sm leading-6 text-[#697386]">
                                        {milestone.description}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="mt-4 text-sm text-[#9aa5b5]">
                                    No milestone assigned to this day.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* =====================================================
                TRAINING TIMELINE
            ====================================================== */}
            {curriculum.length > 0 && (
              <section className="rounded-2xl border border-[#e4e9f0] bg-white p-5 shadow-[0_4px_18px_rgba(16,26,51,0.035)] sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5f7fb] text-[#c78316]">
                    <Clock3 size={19} />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-[#071126]">
                      Training Timeline
                    </h2>

                    <p className="mt-1 text-xs text-[#9aa5b5]">
                      Curriculum progression across training days.
                    </p>
                  </div>
                </div>

                <div className="mt-7 overflow-x-auto pb-2">
                  <div className="flex min-w-max items-start">
                    {curriculum.map((item, index) => {
                      const milestone = getMilestoneForDay(item.day);

                      return (
                        <div
                          key={`timeline-${item.day}`}
                          className="flex items-start"
                        >
                          <div className="flex w-28 flex-col items-center text-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#050a1c] text-xs font-bold text-white">
                              {item.day}
                            </div>

                            <p className="mt-2 max-w-24 text-[11px] font-bold leading-4 text-[#34445d]">
                              {item.title}
                            </p>

                            {milestone && (
                              <span className="mt-1 text-[10px] font-bold text-[#29945d]">
                                {milestone.belt}
                              </span>
                            )}
                          </div>

                          {index < curriculum.length - 1 && (
                            <div className="mt-5 h-px w-8 bg-[#d9e0e9]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  icon,
  label,
  value,
  description,
  iconClass,
  valueClass = "text-3xl",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  description: string;
  iconClass: string;
  valueClass?: string;
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

      <p
        className={`mt-1 text-2xl font-bold text-slate-950 ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

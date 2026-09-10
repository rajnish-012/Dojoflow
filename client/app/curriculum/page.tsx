"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Award,
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

  const [selectedPlanId, setSelectedPlanId] =
    useState<string>("");

  const [expandedDays, setExpandedDays] =
    useState<number[]>([]);

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

      const fetchedPlans: Plan[] =
        data.plans || [];

      setPlans(fetchedPlans);

      const firstPlanWithCurriculum =
        fetchedPlans.find(
          (plan) =>
            plan.curriculum &&
            plan.curriculum.length > 0,
        );

      if (firstPlanWithCurriculum) {
        setSelectedPlanId(
          firstPlanWithCurriculum._id,
        );
      } else if (fetchedPlans.length > 0) {
        setSelectedPlanId(
          fetchedPlans[0]._id,
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load curriculum",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = useMemo(
    () =>
      plans.find(
        (plan) =>
          plan._id === selectedPlanId,
      ) || null,
    [plans, selectedPlanId],
  );

  const curriculum = useMemo(() => {
    if (!selectedPlan?.curriculum) {
      return [];
    }

    return [...selectedPlan.curriculum].sort(
      (a, b) => a.day - b.day,
    );
  }, [selectedPlan]);

  const milestones = useMemo(() => {
    if (!selectedPlan?.milestones) {
      return [];
    }

    return [...selectedPlan.milestones].sort(
      (a, b) => a.day - b.day,
    );
  }, [selectedPlan]);

  function toggleDay(day: number) {
    setExpandedDays((current) =>
      current.includes(day)
        ? current.filter(
            (item) => item !== day,
          )
        : [...current, day],
    );
  }

  function expandAll() {
    setExpandedDays(
      curriculum.map((item) => item.day),
    );
  }

  function collapseAll() {
    setExpandedDays([]);
  }

  function getMilestoneForDay(day: number) {
    return milestones.find(
      (milestone) => milestone.day === day,
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

          <p className="mt-3 text-sm text-slate-500">
            Loading curriculum...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">
          {error}
        </p>

        <button
          type="button"
          onClick={loadPlans}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Curriculum
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          View the day-wise training curriculum and
          milestone progression for each plan.
        </p>
      </div>

      {/* Plan Selector */}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Select Training Plan
            </label>

            {plans.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-500">
                  No training plans found.
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Create a plan and add curriculum from
                  the Plans section.
                </p>
              </div>
            ) : (
              <select
                value={selectedPlanId}
                onChange={(event) => {
                  setSelectedPlanId(
                    event.target.value,
                  );
                  setExpandedDays([]);
                }}
                className="w-full max-w-xl rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-900"
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
              </select>
            )}
          </div>

          {selectedPlan && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                {selectedPlan.classesPerWeek} classes /
                week
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                {selectedPlan.duration}{" "}
                {selectedPlan.durationUnit ===
                "MONTHS"
                  ? "months"
                  : "days"}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                Starting:{" "}
                {selectedPlan.startingBelt ||
                  "White"}
              </span>
            </div>
          )}
        </div>
      </div>

      {selectedPlan && (
        <>
          {/* Plan Overview */}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  <BookOpen className="h-5 w-5 text-slate-700" />
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Curriculum Days
                  </p>

                  <p className="text-2xl font-bold text-slate-900">
                    {curriculum.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Classes / Week
                  </p>

                  <p className="text-2xl font-bold text-slate-900">
                    {selectedPlan.classesPerWeek}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Milestones
                  </p>

                  <p className="text-2xl font-bold text-slate-900">
                    {milestones.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                  <Target className="h-5 w-5 text-orange-600" />
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Progress Reports
                  </p>

                  <p className="text-lg font-bold text-slate-900">
                    {selectedPlan.progressReports ||
                      "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Curriculum Header */}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {selectedPlan.name} Curriculum
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Day-wise training program
                </p>
              </div>

              {curriculum.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Expand All
                  </button>

                  <button
                    type="button"
                    onClick={collapseAll}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>

            {curriculum.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-slate-300" />

                <p className="mt-3 text-sm font-medium text-slate-700">
                  No curriculum added
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Add day-wise curriculum from the
                  Plans section.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {curriculum.map((item) => {
                  const expanded =
                    expandedDays.includes(
                      item.day,
                    );

                  const milestone =
                    getMilestoneForDay(
                      item.day,
                    );

                  return (
                    <div
                      key={`${selectedPlan._id}-${item.day}`}
                    >
                      {/* Day Row */}

                      <button
                        type="button"
                        onClick={() =>
                          toggleDay(item.day)
                        }
                        className="flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                          {item.day}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {item.title}
                            </h3>

                            {item.skill && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {item.skill}
                              </span>
                            )}
                          </div>

                          {!expanded &&
                            item.description && (
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {item.description}
                              </p>
                            )}
                        </div>

                        <div className="hidden shrink-0 items-center gap-2 sm:flex">
                          {milestone && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700">
                              <Award className="h-3 w-3" />
                              {milestone.belt}
                            </span>
                          )}

                          {expanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Day */}

                      {expanded && (
                        <div className="bg-slate-50 px-6 pb-5 pl-[84px]">
                          <div className="grid gap-4 lg:grid-cols-2">
                            {/* Training Details */}

                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-slate-500" />

                                <h4 className="text-sm font-semibold text-slate-800">
                                  Training Details
                                </h4>
                              </div>

                              {item.description ? (
                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                  {item.description}
                                </p>
                              ) : (
                                <p className="mt-3 text-sm text-slate-400">
                                  No description provided.
                                </p>
                              )}

                              {item.skill && (
                                <div className="mt-4 flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-400">
                                    Skill:
                                  </span>

                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                    {item.skill}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Milestone */}

                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                              <div className="flex items-center gap-2">
                                <Award className="h-4 w-4 text-slate-500" />

                                <h4 className="text-sm font-semibold text-slate-800">
                                  Milestone
                                </h4>
                              </div>

                              {milestone ? (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                                      {milestone.belt}
                                    </span>

                                    <span className="text-sm font-medium text-slate-700">
                                      {milestone.skill}
                                    </span>
                                  </div>

                                  {milestone.description && (
                                    <p className="mt-3 text-sm leading-6 text-slate-600">
                                      {
                                        milestone.description
                                      }
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm text-slate-400">
                                  No milestone assigned
                                  to this day.
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
          </div>

          {/* Timeline Summary */}

          {curriculum.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-slate-500" />

                <h2 className="font-semibold text-slate-900">
                  Training Timeline
                </h2>
              </div>

              <div className="mt-5 overflow-x-auto">
                <div className="flex min-w-max items-start">
                  {curriculum.map(
                    (item, index) => {
                      const milestone =
                        getMilestoneForDay(
                          item.day,
                        );

                      return (
                        <div
                          key={`timeline-${item.day}`}
                          className="flex items-start"
                        >
                          <div className="flex w-28 flex-col items-center text-center">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                              {item.day}
                            </div>

                            <p className="mt-2 max-w-24 text-[11px] font-medium text-slate-700">
                              {item.title}
                            </p>

                            {milestone && (
                              <span className="mt-1 text-[10px] text-purple-600">
                                {milestone.belt}
                              </span>
                            )}
                          </div>

                          {index <
                            curriculum.length -
                              1 && (
                            <div className="mt-4 h-px w-8 bg-slate-300" />
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
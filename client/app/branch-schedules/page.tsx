"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingSpinner,
  PageHeader,
  Select,
} from "@/components/ui";

import {
  getBranchMonthCalendar,
  getBranchSchedules,
  type BranchCalendarDay,
  type BranchScheduleListItem,
} from "@/lib/branchScheduleApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import {
  getTrainingSessionTypes,
  type TrainingSessionTypeRecord,
} from "@/lib/trainingSessionTypeApi";

/* =========================================================
   CONSTANTS
========================================================= */

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* =========================================================
   TYPES
========================================================= */

type CalendarCell =
  | {
      type: "empty";
      key: string;
    }
  | {
      type: "date";
      key: string;
      day: BranchCalendarDay;
    };

/* =========================================================
   HELPERS
========================================================= */

function formatTime(value?: string | null) {
  if (!value) {
    return "";
  }

  const match = value.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return value;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDateLabel(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getStatus(day: BranchCalendarDay) {
  if (day.isHoliday) {
    return {
      key: "holiday",
      label: "Holiday",
    };
  }

  if (day.isClosed) {
    return {
      key: "closed",
      label: "Closed",
    };
  }

  if (day.isTrainingDay) {
    return {
      key: "available",
      label: "Available",
    };
  }

  return {
    key: "no-training",
    label: "No Session",
  };
}

function getCalendarCells(
  year: number,
  month: number,
  days: BranchCalendarDay[],
): CalendarCell[] {
  const firstDate = new Date(year, month - 1, 1);

  /*
   * JavaScript:
   * Sunday = 0
   * Monday = 1
   *
   * Our calendar starts Monday.
   */
  const firstDayMondayIndex = (firstDate.getDay() + 6) % 7;

  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstDayMondayIndex; index += 1) {
    cells.push({
      type: "empty",
      key: `empty-before-${index}`,
    });
  }

  days.forEach((day) => {
    cells.push({
      type: "date",
      key: day.date,
      day,
    });
  });

  /*
   * Complete the final week so the grid
   * always has a clean 7-column layout.
   */
  const remainder = cells.length % 7;

  if (remainder !== 0) {
    const remaining = 7 - remainder;

    for (let index = 0; index < remaining; index += 1) {
      cells.push({
        type: "empty",
        key: `empty-after-${index}`,
      });
    }
  }

  return cells;
}

/* =========================================================
   STATUS STYLES
========================================================= */

function getStatusClasses(day: BranchCalendarDay, selected: boolean) {
  if (day.isHoliday) {
    return {
      card: "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10",
      badge:
        "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300",
      dot: "bg-amber-500",
    };
  }

  if (day.isClosed) {
    return {
      card: "border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10",
      badge:
        "border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-300",
      dot: "bg-red-500",
    };
  }

  if (day.isTrainingDay) {
    return {
      card: selected
        ? "border-(--accent) bg-(--accent-soft)"
        : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
      badge:
        "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300",
      dot: "bg-emerald-500",
    };
  }

  return {
    card: "border-(--line) bg-(--surface-muted)",
    badge: "border-(--line) bg-(--surface) text-(--ink-muted)",
    dot: "bg-(--ink-faint)",
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function BranchSchedulesPage() {
  const router = useRouter();

  const canViewSchedule = useCan(PERMISSIONS.BRANCH_SCHEDULE_VIEW);
  const [trainingTypes, setTrainingTypes] = useState<
    TrainingSessionTypeRecord[]
  >([]);

  useEffect(() => {
    getTrainingSessionTypes()
      .then(setTrainingTypes)
      .catch(() => setTrainingTypes([]));
  }, []);
  const canManageSchedule = useCan(PERMISSIONS.BRANCH_SCHEDULE_MANAGE);

  const today = useMemo(() => {
    const now = new Date();

    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(now.getDate()).padStart(2, "0")}`,
    };
  }, []);

  const [branches, setBranches] = useState<BranchScheduleListItem[]>([]);

  const [selectedBranchId, setSelectedBranchId] = useState("");

  const [year, setYear] = useState(today.year);

  const [month, setMonth] = useState(today.month);

  const [days, setDays] = useState<BranchCalendarDay[]>([]);

  const [summary, setSummary] = useState({
    totalDays: 0,
    availableDays: 0,
    holidayDays: 0,
    closedDays: 0,
    noTrainingDays: 0,
    noScheduleDays: 0,
  });

  const [selectedDate, setSelectedDate] = useState<BranchCalendarDay | null>(
    null,
  );

  const [loadingBranches, setLoadingBranches] = useState(true);

  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  /* =======================================================
     LOAD BRANCHES
  ======================================================= */

  const loadBranches = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoadingBranches(true);
        }

        setError("");

        const response = await getBranchSchedules();

        const result = response.branches || [];

        setBranches(result);

        if (!selectedBranchId && result.length > 0) {
          setSelectedBranchId(result[0].branch._id);
        }
      } catch (caughtError) {
        console.error("Load branch schedules error:", caughtError);

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load branches.",
        );
      } finally {
        setLoadingBranches(false);
        setRefreshing(false);
      }
    },
    [selectedBranchId],
  );

  /* =======================================================
     LOAD MONTH
  ======================================================= */

  const loadCalendar = useCallback(
    async (branchId: string, targetYear: number, targetMonth: number) => {
      if (!branchId) {
        setDays([]);
        setSelectedDate(null);
        return;
      }

      try {
        setLoadingCalendar(true);
        setError("");

        const response = await getBranchMonthCalendar(
          branchId,
          targetYear,
          targetMonth,
        );

        setDays(response.days || []);

        setSummary(
          response.summary || {
            totalDays: 0,
            availableDays: 0,
            holidayDays: 0,
            closedDays: 0,
            noTrainingDays: 0,
            noScheduleDays: 0,
          },
        );

        /*
         * Keep the selected date only when it
         * belongs to the currently loaded month.
         */
        setSelectedDate((previous) => {
          if (!previous) {
            return null;
          }

          return (
            response.days.find((item) => item.date === previous.date) || null
          );
        });
      } catch (caughtError) {
        console.error("Load branch monthly calendar error:", caughtError);

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load monthly availability.",
        );

        setDays([]);
      } finally {
        setLoadingCalendar(false);
      }
    },
    [],
  );

  /* =======================================================
     INITIAL BRANCH LOAD
  ======================================================= */

  useEffect(() => {
    if (canViewSchedule) {
      // The loader owns the async loading/error state for this request.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadBranches();
    } else {
      setLoadingBranches(false);
      setError("You do not have permission to view branch schedules.");
    }
  }, [canViewSchedule, loadBranches]);

  /* =======================================================
     LOAD CALENDAR WHEN BRANCH / MONTH CHANGES
  ======================================================= */

  useEffect(() => {
    if (!canViewSchedule || !selectedBranchId) {
      return;
    }

    // The loader owns the async loading/error state for this request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCalendar(selectedBranchId, year, month);
  }, [canViewSchedule, selectedBranchId, year, month, loadCalendar]);

  /* =======================================================
     CALENDAR CELLS
  ======================================================= */

  const calendarCells = useMemo(
    () => getCalendarCells(year, month, days),
    [year, month, days],
  );

  /* =======================================================
     SELECTED BRANCH
  ======================================================= */

  const selectedBranch = useMemo(
    () => branches.find((item) => item.branch._id === selectedBranchId) || null,
    [branches, selectedBranchId],
  );

  /* =======================================================
     MONTH NAVIGATION
  ======================================================= */

  function goPreviousMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((current) => current - 1);
      return;
    }

    setMonth((current) => current - 1);
  }

  function goNextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((current) => current + 1);
      return;
    }

    setMonth((current) => current + 1);
  }

  function goToday() {
    setYear(today.year);
    setMonth(today.month);
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await loadBranches(true);

      if (selectedBranchId) {
        await loadCalendar(selectedBranchId, year, month);
      }
    } finally {
      setRefreshing(false);
    }
  }

  /* =======================================================
     MANAGE WEEKLY SCHEDULE
  ======================================================= */

  function handleManageWeeklySchedule() {
    if (!selectedBranchId || !canManageSchedule) {
      return;
    }

    router.push(`/branches/${selectedBranchId}/schedule`);
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loadingBranches) {
    return (
      <main className="df-page">
        <div className="flex min-h-[480px] items-center justify-center">
          <LoadingSpinner text="Loading branch schedules..." />
        </div>
      </main>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main>
      <div className="df-page">
        <PageHeader
          eyebrow="Branch Management"
          title="Training Availability"
          description="View complete monthly training availability, holidays, and schedules."
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleRefresh()}
                disabled={refreshing || loadingCalendar}
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : undefined}
                />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              {selectedBranchId && canManageSchedule && (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={handleManageWeeklySchedule}
                >
                  <CalendarDays size={18} />
                  <span>Manage Weekly Schedule</span>
                </Button>
              )}
            </div>
          }
        />

        {error && (
          <div className="mb-6">
            <ErrorState
              title="Unable to load availability"
              message={error}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleRefresh()}
                >
                  Try again
                </Button>
              }
            />
          </div>
        )}

        {!error && branches.length === 0 && (
          <Card className="p-10">
            <div className="mx-auto max-w-lg text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-(--surface-muted)">
                <CalendarDays size={26} className="text-(--accent)" />
              </div>

              <h2 className="mt-5 text-xl font-bold text-(--foreground)">
                No branches found
              </h2>

              <p className="mt-2 text-sm leading-6 text-(--ink-muted)">
                Create a branch first, then configure its training schedule.
              </p>
            </div>
          </Card>
        )}

        {!error && branches.length > 0 && (
          <>
            {/* =================================================
                  BRANCH SELECTOR
              ================================================= */}

            <Card className="mb-6 p-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <label
                    htmlFor="branch-selector"
                    className="mb-2 block text-sm font-bold text-(--foreground-soft)"
                  >
                    Branch
                  </label>

                  <Select
                    id="branch-selector"
                    value={selectedBranchId}
                    onChange={(event) => {
                      setSelectedBranchId(event.target.value);
                      setSelectedDate(null);
                    }}
                    className="lg:max-w-md"
                  >
                    {branches.map((item) => (
                      <option key={item.branch._id} value={item.branch._id}>
                        {item.branch.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  {selectedBranch && (
                    <div className="flex items-start gap-2 text-sm text-(--ink-muted)">
                      <MapPin size={17} className="mt-0.5 shrink-0" />

                      <span>
                        {selectedBranch.branch.address ||
                          "Branch address not available"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* =================================================
                  MONTH HEADER
              ================================================= */}

            <Card className="overflow-hidden">
              <div className="border-b border-(--line) p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--accent)">
                      Monthly Availability
                    </p>

                    <h2 className="mt-1 text-2xl font-bold text-(--foreground)">
                      {MONTH_NAMES[month - 1]} {year}
                    </h2>

                    {selectedBranch && (
                      <p className="mt-1 text-sm text-(--ink-muted)">
                        {selectedBranch.branch.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goPreviousMonth}
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={17} />
                    </Button>

                    <Button type="button" variant="outline" onClick={goToday}>
                      Today
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={goNextMonth}
                      aria-label="Next month"
                    >
                      <ChevronRight size={17} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* =================================================
                    SUMMARY
                ================================================= */}

              <div className="grid grid-cols-2 border-b border-(--line) sm:grid-cols-4">
                <SummaryItem
                  label="Available"
                  value={summary.availableDays}
                  dotClass="bg-emerald-500"
                />

                <SummaryItem
                  label="Holidays"
                  value={summary.holidayDays}
                  dotClass="bg-amber-500"
                />

                <SummaryItem
                  label="Closed"
                  value={summary.closedDays}
                  dotClass="bg-red-500"
                />

                <SummaryItem
                  label="No Session"
                  value={summary.noTrainingDays}
                  dotClass="bg-(--ink-faint)"
                />
              </div>

              {/* =================================================
                    LEGEND
                ================================================= */}

              <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-(--line) px-5 py-4">
                <Legend dotClass="bg-emerald-500" label="Available" />

                <Legend dotClass="bg-amber-500" label="Holiday" />

                <Legend dotClass="bg-red-500" label="Closed" />

                <Legend dotClass="bg-(--ink-faint)" label="No Session" />
              </div>

              {/* =================================================
                    CALENDAR
                ================================================= */}

              <div className="p-3 sm:p-5">
                {loadingCalendar ? (
                  <div className="flex min-h-[420px] items-center justify-center">
                    <LoadingSpinner text="Loading calendar..." />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      {/* WEEKDAY HEADER */}

                      <div className="grid grid-cols-7 border-b border-(--line)">
                        {WEEK_DAYS.map((day) => (
                          <div
                            key={day}
                            className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-(--ink-muted)"
                          >
                            <span className="hidden sm:inline">{day}</span>

                            <span className="sm:hidden">{day.slice(0, 3)}</span>
                          </div>
                        ))}
                      </div>

                      {/* DATE GRID */}

                      <div className="grid grid-cols-7 gap-px bg-(--line)">
                        {calendarCells.map((cell) => {
                          if (cell.type === "empty") {
                            return (
                              <div
                                key={cell.key}
                                className="min-h-[116px] bg-(--surface)"
                              />
                            );
                          }

                          const day = cell.day;

                          const selected = selectedDate?.date === day.date;

                          const status = getStatus(day);

                          const classes = getStatusClasses(day, selected);

                          const dateNumber = Number(day.date.slice(8));

                          return (
                            <button
                              key={cell.key}
                              type="button"
                              onClick={() => setSelectedDate(day)}
                              className="
                                min-h-[116px]
                                bg-(--surface)
                                p-2
                                text-left
                                transition
                                hover:bg-(--surface-muted)
                                sm:p-3
                              "
                            >
                              <div
                                className={`
                                  flex
                                  h-full
                                  min-h-[100px]
                                  flex-col
                                  rounded-xl
                                  border
                                  p-2
                                  transition
                                  ${classes.card}
                                  ${
                                    selected
                                      ? "ring-2 ring-(--accent) ring-offset-1"
                                      : ""
                                  }
                                `}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-bold text-(--foreground)">
                                    {dateNumber}
                                  </span>

                                  <span
                                    className={`
                                      h-2
                                      w-2
                                      shrink-0
                                      rounded-full
                                      ${classes.dot}
                                    `}
                                  />
                                </div>

                                <div className="mt-2">
                                  <span
                                    className={`
                                      inline-flex
                                      rounded-full
                                      border
                                      px-2
                                      py-1
                                      text-[9px]
                                      font-bold
                                      uppercase
                                      tracking-[0.06em]
                                      ${classes.badge}
                                    `}
                                  >
                                    {status.label}
                                  </span>
                                </div>

                                {day.isHoliday && day.holiday && (
                                  <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                    {day.holiday.name}
                                  </p>
                                )}

                                {day.isTrainingDay && day.slots.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {day.slots
                                      .slice(0, 2)
                                      .map((slot, index) => (
                                        <div
                                          key={
                                            slot._id || `${day.date}-${index}`
                                          }
                                          className="truncate text-[10px] font-medium text-(--foreground-soft)"
                                        >
                                          {slot.sessionName}
                                        </div>
                                      ))}

                                    {day.slots.length > 2 && (
                                      <div className="text-[10px] font-semibold text-(--accent)">
                                        +{day.slots.length - 2} more
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* =================================================
                  SELECTED DATE DETAIL
              ================================================= */}

            {selectedDate && (
              <SelectedDatePanel
                day={selectedDate}
                trainingTypes={trainingTypes}
                onClose={() => setSelectedDate(null)}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

/* =========================================================
   SUMMARY ITEM
========================================================= */

function SummaryItem({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass: string;
}) {
  return (
    <div className="border-b border-(--line) p-4 sm:border-b-0 sm:border-r last:border-r-0">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />

        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--ink-muted)">
          {label}
        </span>
      </div>

      <p className="mt-2 text-2xl font-bold text-(--foreground)">{value}</p>
    </div>
  );
}

/* =========================================================
   LEGEND
========================================================= */

function Legend({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-(--ink-muted)">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />

      {label}
    </div>
  );
}

/* =========================================================
   SELECTED DATE PANEL
========================================================= */

function SelectedDatePanel({
  day,
  trainingTypes,
  onClose,
}: {
  day: BranchCalendarDay;
  trainingTypes: TrainingSessionTypeRecord[];
  onClose: () => void;
}) {
  const status = getStatus(day);

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-(--line) p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--accent)">
            Selected Date
          </p>

          <h3 className="mt-1 text-xl font-bold text-(--foreground)">
            {formatDateLabel(day.date)}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--surface-muted) px-3 py-1 text-xs font-bold text-(--foreground-soft)">
              <span
                className={`h-2 w-2 rounded-full ${
                  day.isHoliday
                    ? "bg-amber-500"
                    : day.isClosed
                      ? "bg-red-500"
                      : day.isTrainingDay
                        ? "bg-emerald-500"
                        : "bg-(--ink-faint)"
                }`}
              />

              {status.label}
            </span>

            {day.openingTime && day.closingTime && (
              <span className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--surface-muted) px-3 py-1 text-xs font-medium text-(--ink-muted)">
                <Clock3 size={13} />
                {formatTime(day.openingTime)} – {formatTime(day.closingTime)}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close selected date"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--line) text-(--ink-muted) transition hover:bg-(--surface-muted) hover:text-(--foreground)"
        >
          <X size={17} />
        </button>
      </div>

      <div className="p-5">
        {/* HOLIDAY */}

        {day.isHoliday && day.holiday && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              {day.holiday.name}
            </p>

            {day.holiday.description && (
              <p className="mt-1 text-sm leading-6 text-amber-700 dark:text-amber-400">
                {day.holiday.description}
              </p>
            )}

            <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Training is unavailable on this holiday.
            </p>
          </div>
        )}

        {/* CLOSED */}

        {!day.isHoliday && day.isClosed && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            <p className="text-sm font-bold text-red-700 dark:text-red-300">
              Branch Closed
            </p>

            <p className="mt-1 text-sm leading-6 text-red-600 dark:text-red-400">
              This branch does not have regular training scheduled on{" "}
              {day.dayName}.
            </p>
          </div>
        )}

        {/* NO TRAINING */}

        {!day.isHoliday && !day.isClosed && !day.isTrainingDay && (
          <div className="rounded-xl border border-(--line) bg-(--surface-muted) p-4">
            <p className="text-sm font-bold text-(--foreground)">
              No Training Session
            </p>

            <p className="mt-1 text-sm leading-6 text-(--ink-muted)">
              The branch is not closed, but no active training session is
              configured for this date.
            </p>
          </div>
        )}

        {/* TRAINING SESSIONS */}

        {day.isTrainingDay && day.slots.length > 0 && (
          <div>
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-(--ink-faint)">
                Training Sessions
              </p>

              <p className="mt-1 text-sm text-(--ink-muted)">
                {day.slots.length}{" "}
                {day.slots.length === 1 ? "session" : "sessions"} scheduled
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {day.slots.map((slot, index) => (
                <div
                  key={slot._id || `${day.date}-${index}`}
                  className="rounded-xl border border-(--line) bg-(--surface-muted) p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-(--foreground)">
                        {slot.sessionName || "Training Session"}
                      </p>

                      <Badge
                        variant={
                          slot.sessionTypeId || slot.sessionType
                            ? "accent"
                            : "neutral"
                        }
                        className="mt-2"
                      >
                        {trainingTypes.find(
                          (type) => type._id === slot.sessionTypeId,
                        )?.name ||
                          slot.sessionType?.replaceAll("_", " ") ||
                          "General (legacy)"}
                      </Badge>

                      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-(--ink-muted)">
                        <Clock3 size={15} />
                        {formatTime(slot.startTime)} –{" "}
                        {formatTime(slot.endTime)}
                      </p>
                    </div>

                    <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300">
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

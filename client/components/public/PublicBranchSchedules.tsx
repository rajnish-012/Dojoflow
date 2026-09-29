"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Phone,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, Card } from "@/components/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

type TrainingSlot = {
  _id?: string;
  sessionName?: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};

type WeeklyDay = {
  dayOfWeek: number;
  isClosed: boolean;
  slots: TrainingSlot[];
};

type BranchSchedule = {
  _id?: string;
  openingTime: string;
  closingTime: string;
  weeklySchedule: WeeklyDay[];
};

type PublicBranch = {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
};

type BranchScheduleRecord = {
  branch: PublicBranch;
  schedule: BranchSchedule | null;
  hasSchedule: boolean;
};

type CalendarDay = {
  date: string;
  dayOfWeek: number;
  dayName: string;
  isHoliday: boolean;
  holiday: {
    _id?: string;
    name?: string;
    description?: string;
  } | null;
  scheduleConfigured: boolean;
  isClosed: boolean;
  isTrainingDay: boolean;
  slots: TrainingSlot[];
  openingTime: string | null;
  closingTime: string | null;
  reason: string;
};

type CalendarResponse = {
  success: boolean;
  branch: PublicBranch;
  calendar: {
    year: number;
    month: number;
    monthName: string;
    daysInMonth: number;
  };
  summary: {
    totalDays: number;
    availableDays: number;
    holidayDays: number;
    closedDays: number;
    noTrainingDays: number;
    noScheduleDays: number;
  };
  days: CalendarDay[];
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(value?: string | null) {
  if (!value) {
    return "";
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatTimeRange(startTime: string, endTime: string) {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

function getStatus(day: CalendarDay) {
  if (day.isHoliday) {
    return "holiday";
  }

  if (day.isClosed) {
    return "closed";
  }

  if (day.isTrainingDay) {
    return "available";
  }

  return "none";
}

function getStatusLabel(day: CalendarDay) {
  const status = getStatus(day);

  if (status === "holiday") {
    return "Holiday";
  }

  if (status === "closed") {
    return "Closed";
  }

  if (status === "available") {
    return "Training Available";
  }

  return "No Session";
}

function getStatusClass(day: CalendarDay) {
  const status = getStatus(day);

  if (status === "holiday") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }

  if (status === "closed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "available") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-(--line) bg-(--surface) text-(--ink-muted)";
}

function buildCalendarCells(year: number, month: number, days: CalendarDay[]) {
  const firstDay = new Date(year, month - 1, 1).getDay();

  const cells: Array<CalendarDay | null> = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }

  cells.push(...days);

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export default function PublicBranchSchedules({
  onSelectBranch,
}: {
  onSelectBranch?: (branchId: string) => void;
}) {
  const [branches, setBranches] = useState<BranchScheduleRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);

  const [calendarLoading, setCalendarLoading] = useState(false);

  const [calendarError, setCalendarError] = useState("");

  const [selectedDate, setSelectedDate] = useState<CalendarDay | null>(null);

  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/branch-schedules/public`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load branch schedules.");
        }

        if (!cancelled) {
          setBranches(Array.isArray(data.branches) ? data.branches : []);
        }
      } catch (fetchError: unknown) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to load branch schedules.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBranches();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadCalendar(branchId: string, targetDate = monthDate) {
    setCalendarLoading(true);
    setCalendarError("");

    try {
      const year = targetDate.getFullYear();

      const month = targetDate.getMonth() + 1;

      const response = await fetch(
        `${API_URL}/branch-schedules/public/${branchId}/calendar?year=${year}&month=${month}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = (await response.json()) as CalendarResponse & {
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load branch availability.");
      }

      setCalendar(data);
    } catch (fetchError: unknown) {
      setCalendarError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load branch availability.",
      );
    } finally {
      setCalendarLoading(false);
    }
  }

  function openBranchCalendar(branchId: string) {
    setSelectedBranchId(branchId);
    setSelectedDate(null);

    const selectedBranch = branches.find(
      (item) => item.branch._id === branchId,
    );

    if (!selectedBranch) {
      return;
    }

    onSelectBranch?.(branchId);

    void loadCalendar(branchId, monthDate);
  }

  function closeCalendar() {
    setSelectedBranchId(null);
    setCalendar(null);
    setSelectedDate(null);
    setCalendarError("");
  }

  async function changeMonth(direction: number) {
    if (!selectedBranchId) {
      return;
    }

    const nextDate = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + direction,
      1,
    );

    setMonthDate(nextDate);
    setSelectedDate(null);

    await loadCalendar(selectedBranchId, nextDate);
  }

  function goToCurrentMonth() {
    if (!selectedBranchId) {
      return;
    }

    const now = new Date();

    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    setMonthDate(currentMonth);
    setSelectedDate(null);

    void loadCalendar(selectedBranchId, currentMonth);
  }

  const calendarCells = useMemo(() => {
    if (!calendar) {
      return [];
    }

    return buildCalendarCells(
      calendar.calendar.year,
      calendar.calendar.month,
      calendar.days,
    );
  }, [calendar]);

  if (isLoading) {
    return (
      <section className="border-b border-(--line) bg-(--background)">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-(--gold)" />

            <p className="mt-4 text-sm text-(--ink-muted)">
              Loading branch training schedules...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="border-b border-(--line) bg-(--background)">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <Card className="mx-auto max-w-xl p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-(--danger)" />

            <h2 className="mt-4 text-xl font-bold text-(--foreground)">
              Branch schedules unavailable
            </h2>

            <p className="mt-2 text-sm leading-6 text-(--ink-muted)">{error}</p>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section
      id="branch-training-schedules"
      className="border-b border-(--line) bg-(--background)"
    >
      <div className="mx-auto w-full max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--accent-soft) px-4 py-2 text-sm font-semibold text-(--accent)">
            <CalendarDays className="h-4 w-4" />
            Training availability
          </div>

          <h2 className="mt-5 text-3xl font-bold tracking-tight text-(--foreground) sm:text-4xl">
            Find a branch and view its training timings
          </h2>

          <p className="mt-4 text-sm leading-7 text-(--ink-muted)">
            Choose a branch to see its regular weekly training sessions and
            actual monthly availability.
          </p>
        </div>

        {branches.length === 0 ? (
          <Card className="mx-auto mt-10 max-w-xl p-8 text-center">
            <MapPin className="mx-auto h-8 w-8 text-(--accent)" />

            <h3 className="mt-4 text-lg font-semibold text-(--foreground)">
              No active branches available
            </h3>

            <p className="mt-2 text-sm text-(--ink-muted)">
              Please contact the academy for current branch information.
            </p>
          </Card>
        ) : (
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {branches.map((record) => {
              const { branch, schedule, hasSchedule } = record;

              const activeDays =
                schedule?.weeklySchedule?.filter(
                  (day) =>
                    !day.isClosed &&
                    day.slots.some((slot) => slot.isActive !== false),
                ) || [];

              return (
                <Card key={branch._id} className="overflow-hidden p-0">
                  <div className="border-b border-(--line) p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
                          Available branch
                        </p>

                        <h3 className="mt-2 text-2xl font-bold text-(--foreground)">
                          {branch.name}
                        </h3>

                        {branch.address && (
                          <div className="mt-3 flex items-start gap-2 text-sm text-(--ink-muted)">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{branch.address}</span>
                          </div>
                        )}

                        {branch.phone && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-(--ink-muted)">
                            <Phone className="h-4 w-4 shrink-0" />
                            <span>{branch.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                    </div>

                    {hasSchedule && schedule ? (
                      <div className="mt-6 rounded-xl border border-(--line) bg-(--surface) p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-(--foreground)">
                          <Clock3 className="h-4 w-4 text-(--gold)" />
                          Branch hours
                        </div>

                        <p className="mt-2 text-sm text-(--ink-muted)">
                          {formatTime(schedule.openingTime)} –{" "}
                          {formatTime(schedule.closingTime)}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-800">
                          Training schedule is being updated.
                        </p>

                        <p className="mt-1 text-xs text-amber-700">
                          Please contact the academy for current batch timings.
                        </p>
                      </div>
                    )}
                  </div>

                  {hasSchedule && schedule && activeDays.length > 0 && (
                    <div className="p-6 sm:p-7">
                      <h4 className="text-sm font-bold text-(--foreground)">
                        Weekly training sessions
                      </h4>

                      <div className="mt-4 space-y-3">
                        {schedule.weeklySchedule.map((day) => {
                          const activeSlots = day.slots.filter(
                            (slot) => slot.isActive !== false,
                          );

                          if (day.isClosed || activeSlots.length === 0) {
                            return (
                              <div
                                key={day.dayOfWeek}
                                className="flex items-center justify-between gap-4 rounded-xl border border-(--line) bg-(--surface) px-4 py-3"
                              >
                                <span className="text-sm font-semibold text-(--foreground)">
                                  {DAY_NAMES[day.dayOfWeek]}
                                </span>

                                <span className="text-xs font-medium text-(--ink-faint)">
                                  Closed
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={day.dayOfWeek}
                              className="rounded-xl border border-(--line) bg-(--surface) px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-sm font-semibold text-(--foreground)">
                                  {DAY_NAMES[day.dayOfWeek]}
                                </span>

                                <span className="text-xs font-semibold text-(--accent)">
                                  {activeSlots.length}{" "}
                                  {activeSlots.length === 1
                                    ? "session"
                                    : "sessions"}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {activeSlots.map((slot, index) => (
                                  <span
                                    key={
                                      slot._id || `${day.dayOfWeek}-${index}`
                                    }
                                    className="rounded-lg border border-(--line) bg-(--card) px-3 py-2 text-xs text-(--ink-muted)"
                                  >
                                    <span className="font-semibold text-(--foreground)">
                                      {slot.sessionName || "Training Session"}
                                    </span>

                                    <span className="mx-1">·</span>

                                    {formatTimeRange(
                                      slot.startTime,
                                      slot.endTime,
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-(--line) bg-(--surface) p-5">
                    <Button
                      type="button"
                      fullWidth
                      onClick={() => openBranchCalendar(branch._id)}
                      className="bg-(--sidebar-logo-bg) text-(--gold) hover:bg-(--gold) hover:text-(--sidebar-active-text)"
                    >
                      <CalendarDays className="h-4 w-4" />
                      View Monthly Availability
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectBranch?.(branch._id);

                        const form = document.getElementById("inquiry-form");

                        form?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      className="mt-3 w-full text-center text-sm font-semibold text-(--accent) transition hover:opacity-80"
                    >
                      Enquire at this branch →
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {selectedBranchId && (
          <div className="mt-10">
            <Card className="overflow-hidden p-0">
              <div className="border-b border-(--line) p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
                      Monthly availability
                    </p>

                    <h3 className="mt-2 text-2xl font-bold text-(--foreground)">
                      {calendar?.branch?.name ||
                        branches.find(
                          (item) => item.branch._id === selectedBranchId,
                        )?.branch.name ||
                        "Branch schedule"}
                    </h3>

                    {calendar?.branch?.address && (
                      <p className="mt-2 text-sm text-(--ink-muted)">
                        {calendar.branch.address}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={closeCalendar}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-(--line) bg-(--surface) text-(--ink-muted) transition hover:border-(--accent) hover:text-(--accent)"
                    aria-label="Close monthly availability"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {calendarLoading ? (
                <div className="flex flex-col items-center justify-center px-6 py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-(--gold)" />

                  <p className="mt-4 text-sm text-(--ink-muted)">
                    Loading availability...
                  </p>
                </div>
              ) : calendarError ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-(--danger)">
                    {calendarError}
                  </p>
                </div>
              ) : calendar ? (
                <>
                  <div className="flex flex-col gap-5 border-b border-(--line) p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                      <h4 className="text-xl font-bold text-(--foreground)">
                        {calendar.calendar.monthName} {calendar.calendar.year}
                      </h4>

                      <p className="mt-1 text-sm text-(--ink-muted)">
                        Select a date to view its training sessions.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void changeMonth(-1)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-(--line) bg-(--surface) text-(--foreground) transition hover:border-(--accent)"
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={goToCurrentMonth}
                      >
                        Today
                      </Button>

                      <button
                        type="button"
                        onClick={() => void changeMonth(1)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-(--line) bg-(--surface) text-(--foreground) transition hover:border-(--accent)"
                        aria-label="Next month"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-(--line) sm:grid-cols-4">
                    <SummaryItem
                      label="Available"
                      value={calendar.summary.availableDays}
                    />

                    <SummaryItem
                      label="Holidays"
                      value={calendar.summary.holidayDays}
                    />

                    <SummaryItem
                      label="Closed"
                      value={calendar.summary.closedDays}
                    />

                    <SummaryItem
                      label="No Session"
                      value={calendar.summary.noTrainingDays}
                    />
                  </div>

                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-7 border-l border-t border-(--line)">
                      {DAY_NAMES.map((day) => (
                        <div
                          key={day}
                          className="border-r border-b border-(--line) bg-(--surface) px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-(--ink-muted) sm:text-xs"
                        >
                          {day.slice(0, 3)}
                        </div>
                      ))}

                      {calendarCells.map((day, index) => {
                        if (!day) {
                          return (
                            <div
                              key={`empty-${index}`}
                              className="min-h-28 border-r border-b border-(--line) bg-(--background)"
                            />
                          );
                        }

                        const isSelected = selectedDate?.date === day.date;

                        return (
                          <button
                            type="button"
                            key={day.date}
                            onClick={() => setSelectedDate(day)}
                            className={`min-h-28 border-r border-b p-2 text-left transition hover:shadow-inner sm:p-3 ${getStatusClass(
                              day,
                            )} ${
                              isSelected
                                ? "ring-2 ring-inset ring-(--gold)"
                                : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-bold">
                                {Number(day.date.slice(-2))}
                              </span>

                              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                            </div>

                            <span className="mt-2 inline-flex rounded-full border border-current px-2 py-1 text-[9px] font-bold uppercase">
                              {getStatusLabel(day)}
                            </span>

                            {day.isTrainingDay && day.slots.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {day.slots
                                  .slice(0, 2)
                                  .map((slot, slotIndex) => (
                                    <p
                                      key={slot._id || slotIndex}
                                      className="truncate text-[10px] font-medium"
                                    >
                                      {formatTime(slot.startTime)} –
                                      {formatTime(slot.endTime)}
                                    </p>
                                  ))}

                                {day.slots.length > 2 && (
                                  <p className="text-[10px] font-semibold">
                                    +{day.slots.length - 2} more
                                  </p>
                                )}
                              </div>
                            )}

                            {day.isHoliday && day.holiday?.name && (
                              <p className="mt-2 truncate text-[10px] font-semibold">
                                {day.holiday.name}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-4 text-xs text-(--ink-muted)">
                      <Legend label="Available" className="text-emerald-600" />

                      <Legend label="Holiday" className="text-amber-600" />

                      <Legend label="Closed" className="text-red-600" />

                      <Legend
                        label="No Session"
                        className="text-(--ink-faint)"
                      />
                    </div>
                  </div>

                  {selectedDate && (
                    <div className="border-t border-(--line) bg-(--surface) p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
                            Selected date
                          </p>

                          <h4 className="mt-2 text-xl font-bold text-(--foreground)">
                            {selectedDate.dayName},{" "}
                            {new Date(
                              `${selectedDate.date}T00:00:00`,
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </h4>
                        </div>

                        <span
                          className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClass(
                            selectedDate,
                          )}`}
                        >
                          {getStatusLabel(selectedDate)}
                        </span>
                      </div>

                      {selectedDate.isHoliday ? (
                        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <p className="font-semibold text-amber-800">
                            {selectedDate.holiday?.name || "Holiday"}
                          </p>

                          {selectedDate.holiday?.description && (
                            <p className="mt-1 text-sm text-amber-700">
                              {selectedDate.holiday.description}
                            </p>
                          )}

                          <p className="mt-2 text-xs text-amber-700">
                            Training is unavailable on this date.
                          </p>
                        </div>
                      ) : selectedDate.isTrainingDay &&
                        selectedDate.slots.length > 0 ? (
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {selectedDate.slots.map((slot, index) => (
                            <div
                              key={slot._id || index}
                              className="rounded-xl border border-(--line) bg-(--card) p-4"
                            >
                              <p className="text-sm font-bold text-(--foreground)">
                                {slot.sessionName || "Training Session"}
                              </p>

                              <p className="mt-2 text-sm text-(--ink-muted)">
                                <Clock3 className="mr-1 inline h-4 w-4" />
                                {formatTimeRange(slot.startTime, slot.endTime)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-5 text-sm text-(--ink-muted)">
                          No training session is scheduled for this date.
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-b border-(--line) px-4 py-4 last:border-r-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-(--ink-faint)">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-(--foreground)">{value}</p>
    </div>
  );
}

function Legend({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full bg-current ${className}`} />

      {label}
    </span>
  );
}

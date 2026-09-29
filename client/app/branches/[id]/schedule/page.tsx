"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useParams, useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  CalendarClock,
  Check,
  Clock3,
  Copy,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";

import {
  Button,
  Card,
  ErrorState,
  LoadingSpinner,
  PageHeader,
} from "@/components/ui";

import {
  deleteBranchSchedule,
  getBranchSchedule,
  upsertBranchSchedule,
  type BranchSchedule,
  type TrainingSlot,
  type WeeklyScheduleDay,
} from "@/lib/branchScheduleApi";

/* =========================================================
   CONSTANTS
========================================================= */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_OPENING_TIME = "06:00";
const DEFAULT_CLOSING_TIME = "21:00";

const DEFAULT_SLOT: TrainingSlot = {
  sessionName: "Training Session",
  startTime: "06:00",
  endTime: "07:00",
  isActive: true,
};

/* =========================================================
   HELPERS
========================================================= */

function createEmptyWeeklySchedule(): WeeklyScheduleDay[] {
  return DAY_NAMES.map((_, index) => ({
    dayOfWeek: index,
    isClosed: index === 0,
    slots: [],
  }));
}

function createDefaultWeeklySchedule(): WeeklyScheduleDay[] {
  return DAY_NAMES.map((_, index) => ({
    dayOfWeek: index,
    isClosed: index === 0,
    slots: [],
  }));
}

function normalizeWeeklySchedule(weeklySchedule?: WeeklyScheduleDay[] | null) {
  const source = Array.isArray(weeklySchedule) ? weeklySchedule : [];

  const sourceMap = new Map<number, WeeklyScheduleDay>();

  source.forEach((day) => {
    const dayOfWeek = Number(day?.dayOfWeek);

    if (Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6) {
      sourceMap.set(dayOfWeek, {
        dayOfWeek,
        isClosed: Boolean(day.isClosed),
        slots: Array.isArray(day.slots)
          ? day.slots.map((slot) => ({
              _id: slot._id,
              sessionName: slot.sessionName || "Training Session",
              startTime: slot.startTime || DEFAULT_SLOT.startTime,
              endTime: slot.endTime || DEFAULT_SLOT.endTime,
              isActive: slot.isActive !== false,
            }))
          : [],
      });
    }
  });

  return DAY_NAMES.map((_, index) => {
    return (
      sourceMap.get(index) || {
        dayOfWeek: index,
        isClosed: index === 0,
        slots: [],
      }
    );
  });
}

function createLocalSlot(): TrainingSlot {
  return {
    ...DEFAULT_SLOT,
  };
}

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

function timeToMinutes(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours * 60 + minutes;
}

function createTemporaryId() {
  return `temporary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneSchedule(schedule: BranchSchedule): BranchSchedule {
  return {
    ...schedule,

    weeklySchedule: schedule.weeklySchedule.map((day) => ({
      ...day,
      slots: day.slots.map((slot) => ({
        ...slot,
      })),
    })),
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function BranchSchedulePage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const branchId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";

  const requestedDay = Number(searchParams.get("day"));

  const initialDay =
    Number.isInteger(requestedDay) && requestedDay >= 0 && requestedDay <= 6
      ? requestedDay
      : 1;

  /* =======================================================
     STATE
  ======================================================= */

  const [branchName, setBranchName] = useState("Branch");

  const [branchAddress, setBranchAddress] = useState("");

  const [openingTime, setOpeningTime] = useState(DEFAULT_OPENING_TIME);

  const [closingTime, setClosingTime] = useState(DEFAULT_CLOSING_TIME);

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleDay[]>(
    createDefaultWeeklySchedule(),
  );

  const [selectedDay, setSelectedDay] = useState(initialDay);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* =======================================================
     SELECTED DAY
  ======================================================= */

  const selectedDaySchedule = useMemo(
    () =>
      weeklySchedule.find((day) => day.dayOfWeek === selectedDay) || {
        dayOfWeek: selectedDay,
        isClosed: true,
        slots: [],
      },
    [weeklySchedule, selectedDay],
  );

  const selectedDayName = DAY_NAMES[selectedDay] || "Monday";

  /* =======================================================
     DAY COUNTS
  ======================================================= */

  const dayStats = useMemo(() => {
    return weeklySchedule.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      isClosed: day.isClosed,
      activeSlots: day.slots.filter((slot) => slot.isActive !== false).length,
    }));
  }, [weeklySchedule]);

  /* =======================================================
     LOAD
  ======================================================= */

  const loadSchedule = useCallback(
    async (showRefresh = false) => {
      if (!branchId) {
        return;
      }

      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");
        setSuccess("");

        const response = await getBranchSchedule(branchId);

        const schedule = response.schedule;

        setBranchName(response.branch?.name || "Branch");

        setBranchAddress(response.branch?.address || "");

        setOpeningTime(schedule?.openingTime || DEFAULT_OPENING_TIME);

        setClosingTime(schedule?.closingTime || DEFAULT_CLOSING_TIME);

        setWeeklySchedule(normalizeWeeklySchedule(schedule?.weeklySchedule));
      } catch (caughtError) {
        console.error("Load branch schedule error:", caughtError);

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load branch training schedule.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId],
  );

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  /* =======================================================
     SUCCESS MESSAGE
  ======================================================= */

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccess("");
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [success]);

  /* =======================================================
     UPDATE DAY
  ======================================================= */

  function updateDay(
    dayOfWeek: number,
    updater: (day: WeeklyScheduleDay) => WeeklyScheduleDay,
  ) {
    setWeeklySchedule((current) =>
      current.map((day) => (day.dayOfWeek === dayOfWeek ? updater(day) : day)),
    );

    setSuccess("");
    setError("");
  }

  /* =======================================================
     TOGGLE DAY CLOSED
  ======================================================= */

  function toggleDayClosed() {
    updateDay(selectedDay, (day) => ({
      ...day,
      isClosed: !day.isClosed,
    }));
  }

  /* =======================================================
     ADD SLOT
  ======================================================= */

  function addTrainingSession() {
    const newSlot = {
      ...createLocalSlot(),
      _id: createTemporaryId(),
    };

    updateDay(selectedDay, (day) => ({
      ...day,

      /*
       * If the admin adds a session,
       * automatically open the day.
       */
      isClosed: false,

      slots: [...day.slots, newSlot],
    }));
  }

  /* =======================================================
     UPDATE SLOT
  ======================================================= */

  function updateTrainingSession(
    slotId: string,
    field: "sessionName" | "startTime" | "endTime",
    value: string,
  ) {
    updateDay(selectedDay, (day) => ({
      ...day,

      slots: day.slots.map((slot) =>
        slot._id === slotId
          ? {
              ...slot,
              [field]: value,
            }
          : slot,
      ),
    }));
  }

  /* =======================================================
     TOGGLE SLOT
  ======================================================= */

  function toggleTrainingSession(slotId: string) {
    updateDay(selectedDay, (day) => ({
      ...day,

      slots: day.slots.map((slot) =>
        slot._id === slotId
          ? {
              ...slot,
              isActive: !slot.isActive,
            }
          : slot,
      ),
    }));
  }

  /* =======================================================
     DELETE SLOT
  ======================================================= */

  function deleteTrainingSession(slotId?: string) {
    if (!slotId) {
      return;
    }

    const confirmed = window.confirm("Delete this training session?");

    if (!confirmed) {
      return;
    }

    updateDay(selectedDay, (day) => ({
      ...day,

      slots: day.slots.filter((slot) => slot._id !== slotId),
    }));
  }

  /* =======================================================
     DUPLICATE SLOT
  ======================================================= */

  function duplicateTrainingSession(slot: TrainingSlot) {
    const duplicate = {
      ...slot,
      _id: createTemporaryId(),
    };

    updateDay(selectedDay, (day) => ({
      ...day,

      slots: [...day.slots, duplicate],
    }));
  }

  /* =======================================================
     COPY DAY TO OTHER DAYS
  ======================================================= */

  function copySelectedDayToOtherDays() {
    const selected = weeklySchedule.find(
      (day) => day.dayOfWeek === selectedDay,
    );

    if (!selected) {
      return;
    }

    const targetDays = DAY_NAMES.map((_, index) => index).filter(
      (index) => index !== selectedDay,
    );

    const selectedTargets = window.prompt(
      `Enter day numbers to copy ${selectedDayName} to.\n\n0 = Sunday\n1 = Monday\n2 = Tuesday\n3 = Wednesday\n4 = Thursday\n5 = Friday\n6 = Saturday\n\nExample: 2,3,4`,
    );

    if (!selectedTargets) {
      return;
    }

    const indexes = selectedTargets
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && targetDays.includes(value));

    if (indexes.length === 0) {
      setError("No valid target days were selected.");
      return;
    }

    setWeeklySchedule((current) =>
      current.map((day) => {
        if (!indexes.includes(day.dayOfWeek)) {
          return day;
        }

        return {
          ...day,
          isClosed: selected.isClosed,
          slots: selected.slots.map((slot) => ({
            ...slot,
            _id: createTemporaryId(),
          })),
        };
      }),
    );

    setSuccess(`${selectedDayName} schedule copied successfully.`);
  }

  /* =======================================================
     VALIDATE BEFORE SAVE
  ======================================================= */

  function validateBeforeSave() {
    const openingMinutes = timeToMinutes(openingTime);

    const closingMinutes = timeToMinutes(closingTime);

    if (openingMinutes === null || closingMinutes === null) {
      return "Opening and closing time must be valid.";
    }

    if (openingMinutes >= closingMinutes) {
      return "Opening time must be earlier than closing time.";
    }

    for (const day of weeklySchedule) {
      if (day.isClosed) {
        continue;
      }

      const activeSlots = day.slots.filter((slot) => slot.isActive !== false);

      for (const slot of activeSlots) {
        if (!slot.sessionName.trim()) {
          return `${DAY_NAMES[day.dayOfWeek]} has a training session without a name.`;
        }

        if (!/^\d{2}:\d{2}$/.test(slot.startTime)) {
          return `${DAY_NAMES[day.dayOfWeek]} has an invalid start time.`;
        }

        if (!/^\d{2}:\d{2}$/.test(slot.endTime)) {
          return `${DAY_NAMES[day.dayOfWeek]} has an invalid end time.`;
        }

        const start = timeToMinutes(slot.startTime);

        const end = timeToMinutes(slot.endTime);

        if (start === null || end === null) {
          return `${DAY_NAMES[day.dayOfWeek]} contains an invalid time.`;
        }

        if (start >= end) {
          return `${DAY_NAMES[day.dayOfWeek]}: ${slot.sessionName} must end after it starts.`;
        }

        if (start < openingMinutes) {
          return `${DAY_NAMES[day.dayOfWeek]}: ${slot.sessionName} starts before branch opening time.`;
        }

        if (end > closingMinutes) {
          return `${DAY_NAMES[day.dayOfWeek]}: ${slot.sessionName} ends after branch closing time.`;
        }
      }

      const sortedSlots = [...activeSlots].sort(
        (a, b) =>
          (timeToMinutes(a.startTime) || 0) - (timeToMinutes(b.startTime) || 0),
      );

      for (let index = 1; index < sortedSlots.length; index += 1) {
        const previous = sortedSlots[index - 1];

        const current = sortedSlots[index];

        const previousEnd = timeToMinutes(previous.endTime);

        const currentStart = timeToMinutes(current.startTime);

        if (
          previousEnd !== null &&
          currentStart !== null &&
          currentStart < previousEnd
        ) {
          return (
            `${DAY_NAMES[day.dayOfWeek]} has overlapping sessions: ` +
            `"${previous.sessionName}" and "${current.sessionName}".`
          );
        }
      }
    }

    return "";
  }

  /* =======================================================
     SAVE
  ======================================================= */

  async function handleSave() {
    if (!branchId) {
      return;
    }

    const validationError = validateBeforeSave();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const cleanedSchedule = weeklySchedule.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        isClosed: day.isClosed,

        slots: day.slots.map((slot) => ({
          ...(slot._id && !slot._id.startsWith("temporary-")
            ? {
                _id: slot._id,
              }
            : {}),

          sessionName: slot.sessionName.trim() || "Training Session",

          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: slot.isActive !== false,
        })),
      }));

      const response = await upsertBranchSchedule(branchId, {
        openingTime,
        closingTime,
        weeklySchedule: cleanedSchedule,
      });

      setWeeklySchedule(
        normalizeWeeklySchedule(response.schedule?.weeklySchedule),
      );

      setOpeningTime(response.schedule?.openingTime || openingTime);

      setClosingTime(response.schedule?.closingTime || closingTime);

      setSuccess("Branch training schedule saved successfully.");
    } catch (caughtError) {
      console.error("Save branch schedule error:", caughtError);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save branch training schedule.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     RESET
  ======================================================= */

  async function handleReset() {
    if (!branchId) {
      return;
    }

    const confirmed = window.confirm(
      "Reset this branch schedule?\n\nThis will remove the configured schedule and restore the default editor state.",
    );

    if (!confirmed) {
      return;
    }

    try {
      setResetting(true);
      setError("");
      setSuccess("");

      await deleteBranchSchedule(branchId);

      setOpeningTime(DEFAULT_OPENING_TIME);

      setClosingTime(DEFAULT_CLOSING_TIME);

      setWeeklySchedule(createEmptyWeeklySchedule());

      setSuccess("Branch schedule reset successfully.");
    } catch (caughtError) {
      console.error("Reset branch schedule error:", caughtError);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to reset branch schedule.",
      );
    } finally {
      setResetting(false);
    }
  }

  /* =======================================================
     COPY CURRENT DAY
  ======================================================= */

  function resetSelectedDay() {
    const confirmed = window.confirm(
      `Reset ${selectedDayName}'s training sessions?`,
    );

    if (!confirmed) {
      return;
    }

    updateDay(selectedDay, (day) => ({
      ...day,
      isClosed: true,
      slots: [],
    }));

    setSuccess(
      `${selectedDayName} schedule reset locally. Click Save Schedule to apply it.`,
    );
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="df-page">
        <div className="flex min-h-[480px] items-center justify-center">
          <LoadingSpinner text="Loading branch training schedule..." />
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
          title="Training Timings"
          description="Configure recurring training sessions for every day of the week. These settings automatically determine the available training dates in the monthly calendar."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/branch-schedules"
                className="
        inline-flex
        h-10
        items-center
        justify-center
        gap-2
        rounded-xl
        border
        border-(--line)
        bg-(--surface)
        px-4
        text-sm
        font-bold
        text-(--foreground-soft)
        transition
        hover:border-(--accent)
        hover:text-(--accent)
      "
              >
                <ArrowLeft size={16} />
                Branch Schedules
              </Link>

              <Button
                type="button"
                variant="outline"
                onClick={() => void loadSchedule(true)}
                disabled={refreshing || saving || resetting}
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : undefined}
                />
                Refresh
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={() => void handleSave()}
                loading={saving}
                disabled={resetting}
              >
                <Save size={16} />
                Save Schedule
              </Button>
            </div>
          }
        />

        {error && (
          <div className="mb-5">
            <ErrorState
              title="Unable to update training schedule"
              message={error}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setError("")}
                >
                  Dismiss
                </Button>
              }
            />
          </div>
        )}

        {success && (
          <div
            className="
              mb-5 flex items-center gap-3
              rounded-xl border
              border-(--success)/20
              bg-(--success-soft)
              px-4 py-3
            "
          >
            <Check size={18} className="text-(--success)" />

            <p className="text-sm font-semibold text-(--success)">{success}</p>
          </div>
        )}

        {/* =================================================
            BRANCH INFORMATION
        ================================================= */}

        <Card className="mb-6 overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-3">
            <div className="border-b border-(--line) p-5 lg:border-b-0 lg:border-r">
              <p
                className="
                  text-[11px] font-bold
                  uppercase tracking-[0.12em]
                  text-(--ink-faint)
                "
              >
                Branch
              </p>

              <h2 className="mt-2 text-xl font-bold text-(--foreground)">
                {branchName}
              </h2>

              {branchAddress && (
                <p className="mt-1 text-sm text-(--ink-muted)">
                  {branchAddress}
                </p>
              )}
            </div>

            <div className="border-b border-(--line) p-5 lg:border-b-0 lg:border-r">
              <label
                htmlFor="opening-time"
                className="
                  text-[11px] font-bold
                  uppercase tracking-[0.12em]
                  text-(--ink-faint)
                "
              >
                Opening Time
              </label>

              <div className="relative mt-2">
                <Clock3
                  size={17}
                  className="
                    pointer-events-none
                    absolute left-3
                    top-1/2
                    -translate-y-1/2
                    text-(--ink-faint)
                  "
                />

                <input
                  id="opening-time"
                  type="time"
                  value={openingTime}
                  onChange={(event) => setOpeningTime(event.target.value)}
                  className="
                    h-12 w-full rounded-xl
                    border border-(--line)
                    bg-(--surface)
                    pl-10 pr-3
                    text-sm font-semibold
                    text-(--foreground)
                    outline-none
                    focus:border-(--accent)
                  "
                />
              </div>
            </div>

            <div className="p-5">
              <label
                htmlFor="closing-time"
                className="
                  text-[11px] font-bold
                  uppercase tracking-[0.12em]
                  text-(--ink-faint)
                "
              >
                Closing Time
              </label>

              <div className="relative mt-2">
                <Clock3
                  size={17}
                  className="
                    pointer-events-none
                    absolute left-3
                    top-1/2
                    -translate-y-1/2
                    text-(--ink-faint)
                  "
                />

                <input
                  id="closing-time"
                  type="time"
                  value={closingTime}
                  onChange={(event) => setClosingTime(event.target.value)}
                  className="
                    h-12 w-full rounded-xl
                    border border-(--line)
                    bg-(--surface)
                    pl-10 pr-3
                    text-sm font-semibold
                    text-(--foreground)
                    outline-none
                    focus:border-(--accent)
                  "
                />
              </div>
            </div>
          </div>
        </Card>

        {/* =================================================
            WEEKLY SCHEDULE
        ================================================= */}

        <Card className="overflow-hidden">
          <div
            className="
              border-b border-(--line)
              px-5 py-5
              sm:px-6
            "
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarClock size={20} className="text-(--accent)" />

                  <h2 className="text-xl font-bold text-(--foreground)">
                    Weekly Training Availability
                  </h2>
                </div>

                <p className="mt-1 text-sm text-(--ink-muted)">
                  Configure the recurring sessions for Sunday through Saturday.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={copySelectedDayToOtherDays}
                >
                  <Copy size={16} />
                  Copy Day
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={resetSelectedDay}
                >
                  <RotateCcw size={16} />
                  Reset Day
                </Button>
              </div>
            </div>
          </div>

          {/* =================================================
              DAY SELECTOR
          ================================================= */}

          <div className="border-b border-(--line) p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {DAY_NAMES.map((dayName, index) => {
                const stats = dayStats[index];

                const active = selectedDay === index;

                return (
                  <button
                    key={dayName}
                    type="button"
                    onClick={() => setSelectedDay(index)}
                    className={`
                        rounded-xl border
                        px-3 py-3
                        text-left
                        transition
                        ${
                          active
                            ? "border-(--accent) bg-(--accent) text-white shadow-sm"
                            : "border-(--line) bg-(--surface-muted) text-(--foreground) hover:border-(--accent)"
                        }
                      `}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{dayName}</span>

                      <span
                        className={`
                            h-2 w-2 rounded-full
                            ${
                              active
                                ? "bg-white"
                                : stats.isClosed
                                  ? "bg-(--ink-faint)"
                                  : "bg-(--accent)"
                            }
                          `}
                      />
                    </div>

                    <p
                      className={`
                          mt-1 text-xs
                          ${active ? "text-white/80" : "text-(--ink-muted)"}
                        `}
                    >
                      {stats.isClosed
                        ? "Closed"
                        : `${stats.activeSlots} active`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* =================================================
              SELECTED DAY
          ================================================= */}

          <div className="p-5 sm:p-6">
            <div
              className="
                mb-6 flex flex-col gap-4
                rounded-2xl
                border border-(--line)
                bg-(--surface-muted)
                p-5
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-[11px] font-bold
                    uppercase tracking-[0.12em]
                    text-(--ink-faint)
                  "
                >
                  Selected Day
                </p>

                <h3 className="mt-1 text-2xl font-bold text-(--foreground)">
                  {selectedDayName}
                </h3>

                <p className="mt-1 text-sm text-(--ink-muted)">
                  {selectedDaySchedule.isClosed
                    ? "Branch is closed on this recurring day."
                    : `${
                        selectedDaySchedule.slots.filter(
                          (slot) => slot.isActive !== false,
                        ).length
                      } active training session${
                        selectedDaySchedule.slots.filter(
                          (slot) => slot.isActive !== false,
                        ).length === 1
                          ? ""
                          : "s"
                      }`}
                </p>
              </div>

              <button
                type="button"
                onClick={toggleDayClosed}
                className="
                  inline-flex
                  items-center
                  gap-3
                  self-start
                  rounded-xl
                  border
                  border-(--line)
                  bg-(--surface)
                  px-4 py-3
                  text-sm font-bold
                  text-(--foreground)
                  transition
                  hover:border-(--accent)
                  sm:self-auto
                "
              >
                <span>
                  {selectedDaySchedule.isClosed
                    ? "Branch Closed"
                    : "Branch Open"}
                </span>

                <span
                  className={`
                    relative
                    h-6 w-11
                    rounded-full
                    transition
                    ${
                      selectedDaySchedule.isClosed
                        ? "bg-(--ink-faint)"
                        : "bg-(--accent)"
                    }
                  `}
                >
                  <span
                    className={`
                      absolute top-1
                      h-4 w-4 rounded-full
                      bg-white
                      shadow-sm
                      transition
                      ${selectedDaySchedule.isClosed ? "left-1" : "left-6"}
                    `}
                  />
                </span>
              </button>
            </div>

            {/* =================================================
                TABLE HEADER
            ================================================= */}

            <div
              className="
                hidden
                grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_minmax(150px,1fr)_100px_100px]
                gap-4
                border-b border-(--line)
                px-2 pb-3
                lg:grid
              "
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-(--ink-faint)">
                Training Session
              </span>

              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-(--ink-faint)">
                Start Time
              </span>

              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-(--ink-faint)">
                End Time
              </span>

              <span className="text-center text-[11px] font-bold uppercase tracking-[0.1em] text-(--ink-faint)">
                Status
              </span>

              <span className="text-center text-[11px] font-bold uppercase tracking-[0.1em] text-(--ink-faint)">
                Action
              </span>
            </div>

            {/* =================================================
                CLOSED STATE
            ================================================= */}

            {selectedDaySchedule.isClosed && (
              <div
                className="
                  my-5 rounded-2xl
                  border border-(--line)
                  bg-(--surface-muted)
                  p-8 text-center
                "
              >
                <div
                  className="
                    mx-auto flex h-12 w-12
                    items-center justify-center
                    rounded-full
                    bg-(--surface)
                    text-(--ink-muted)
                  "
                >
                  <X size={20} />
                </div>

                <h4 className="mt-4 text-lg font-bold text-(--foreground)">
                  {selectedDayName} is closed
                </h4>

                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-(--ink-muted)">
                  No normal training sessions are available on this recurring
                  day.
                </p>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-5"
                  onClick={toggleDayClosed}
                >
                  Open {selectedDayName}
                </Button>
              </div>
            )}

            {/* =================================================
                SESSION LIST
            ================================================= */}

            {!selectedDaySchedule.isClosed &&
              selectedDaySchedule.slots.length > 0 && (
                <div className="space-y-3 pt-4">
                  {selectedDaySchedule.slots.map((slot, index) => {
                    const slotId = slot._id || `${selectedDay}-${index}`;

                    return (
                      <div
                        key={slotId}
                        className={`
                            rounded-2xl
                            border
                            p-4
                            transition
                            ${
                              slot.isActive === false
                                ? "border-(--line) bg-(--surface-muted) opacity-70"
                                : "border-(--accent)/50 bg-(--surface)"
                            }
                          `}
                      >
                        <div
                          className="
                              grid gap-3
                              lg:grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_minmax(150px,1fr)_100px_100px]
                              lg:items-center
                            "
                        >
                          {/* SESSION NAME */}

                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-(--ink-muted) lg:hidden">
                              Training Session
                            </label>

                            <input
                              type="text"
                              value={slot.sessionName}
                              onChange={(event) =>
                                updateTrainingSession(
                                  slotId,
                                  "sessionName",
                                  event.target.value,
                                )
                              }
                              placeholder="Training Session"
                              className="
                                  h-12 w-full
                                  rounded-xl
                                  border border-(--line)
                                  bg-(--surface)
                                  px-4
                                  text-sm font-semibold
                                  text-(--foreground)
                                  outline-none
                                  focus:border-(--accent)
                                "
                            />
                          </div>

                          {/* START */}

                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-(--ink-muted) lg:hidden">
                              Start Time
                            </label>

                            <div className="relative">
                              <Clock3
                                size={17}
                                className="
                                    pointer-events-none
                                    absolute left-3
                                    top-1/2
                                    -translate-y-1/2
                                    text-(--ink-faint)
                                  "
                              />

                              <input
                                type="time"
                                value={slot.startTime}
                                onChange={(event) =>
                                  updateTrainingSession(
                                    slotId,
                                    "startTime",
                                    event.target.value,
                                  )
                                }
                                className="
                                    h-12 w-full
                                    rounded-xl
                                    border border-(--line)
                                    bg-(--surface)
                                    pl-10 pr-3
                                    text-sm font-semibold
                                    text-(--foreground)
                                    outline-none
                                    focus:border-(--accent)
                                  "
                              />
                            </div>
                          </div>

                          {/* END */}

                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-(--ink-muted) lg:hidden">
                              End Time
                            </label>

                            <div className="relative">
                              <Clock3
                                size={17}
                                className="
                                    pointer-events-none
                                    absolute left-3
                                    top-1/2
                                    -translate-y-1/2
                                    text-(--ink-faint)
                                  "
                              />

                              <input
                                type="time"
                                value={slot.endTime}
                                onChange={(event) =>
                                  updateTrainingSession(
                                    slotId,
                                    "endTime",
                                    event.target.value,
                                  )
                                }
                                className="
                                    h-12 w-full
                                    rounded-xl
                                    border border-(--line)
                                    bg-(--surface)
                                    pl-10 pr-3
                                    text-sm font-semibold
                                    text-(--foreground)
                                    outline-none
                                    focus:border-(--accent)
                                  "
                              />
                            </div>
                          </div>

                          {/* STATUS */}

                          <div className="flex items-center justify-between lg:justify-center">
                            <span className="text-xs font-semibold text-(--ink-muted) lg:hidden">
                              Status
                            </span>

                            <button
                              type="button"
                              onClick={() => toggleTrainingSession(slotId)}
                              className="
                                  inline-flex
                                  items-center
                                  gap-2
                                  rounded-full
                                  px-2
                                  py-1
                                "
                            >
                              <span
                                className={`
                                    relative
                                    h-6 w-11
                                    rounded-full
                                    transition
                                    ${
                                      slot.isActive
                                        ? "bg-(--accent)"
                                        : "bg-(--ink-faint)"
                                    }
                                  `}
                              >
                                <span
                                  className={`
                                      absolute
                                      top-1
                                      h-4 w-4
                                      rounded-full
                                      bg-white
                                      shadow-sm
                                      transition
                                      ${slot.isActive ? "left-6" : "left-1"}
                                    `}
                                />
                              </span>

                              <span className="text-xs font-bold text-(--foreground)">
                                {slot.isActive ? "ON" : "OFF"}
                              </span>
                            </button>
                          </div>

                          {/* ACTIONS */}

                          <div className="flex items-center justify-end gap-2 lg:justify-center">
                            <button
                              type="button"
                              title="Duplicate session"
                              aria-label="Duplicate session"
                              onClick={() => duplicateTrainingSession(slot)}
                              className="
                                  flex h-10 w-10
                                  items-center justify-center
                                  rounded-xl
                                  border border-(--line)
                                  bg-(--surface)
                                  text-(--ink-muted)
                                  transition
                                  hover:border-(--accent)
                                  hover:text-(--accent)
                                "
                            >
                              <Copy size={16} />
                            </button>

                            <button
                              type="button"
                              title="Delete session"
                              aria-label="Delete session"
                              onClick={() => deleteTrainingSession(slot._id)}
                              className="
                                  flex h-10 w-10
                                  items-center justify-center
                                  rounded-xl
                                  border border-red-200
                                  bg-red-50
                                  text-red-600
                                  transition
                                  hover:bg-red-100
                                "
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div
                          className="
                              mt-3
                              flex items-center
                              justify-between
                              border-t
                              border-(--line)
                              pt-3
                            "
                        >
                          <span className="text-xs text-(--ink-muted)">
                            {formatTime(slot.startTime)} –{" "}
                            {formatTime(slot.endTime)}
                          </span>

                          <span
                            className={`
                                rounded-full
                                border px-2.5 py-1
                                text-[10px]
                                font-bold
                                uppercase
                                tracking-[0.08em]
                                ${
                                  slot.isActive
                                    ? "border-(--accent)/30 bg-(--accent-soft) text-(--accent)"
                                    : "border-(--line) bg-(--surface-muted) text-(--ink-faint)"
                                }
                              `}
                          >
                            {slot.isActive ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            {/* =================================================
                ADD SESSION
            ================================================= */}

            {!selectedDaySchedule.isClosed && (
              <button
                type="button"
                onClick={addTrainingSession}
                className="
                  mt-5 flex w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  border
                  border-dashed
                  border-(--accent)
                  bg-(--accent-soft)
                  px-5 py-4
                  text-sm
                  font-bold
                  text-(--accent)
                  transition
                  hover:bg-(--accent)
                  hover:text-white
                "
              >
                <Plus size={18} />
                Add Training Session
              </button>
            )}

            {/* =================================================
                SAVE FOOTER
            ================================================= */}

            <div
              className="
                mt-8 flex
                flex-col gap-3
                border-t border-(--line)
                pt-5
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div>
                <p className="text-sm font-bold text-(--foreground)">
                  {selectedDayName} schedule
                </p>

                <p className="mt-1 text-xs text-(--ink-muted)">
                  Changes are local until you click Save Schedule.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving || resetting}
                >
                  <RotateCcw size={16} />
                  Reset Branch
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleSave()}
                  loading={saving}
                  disabled={resetting}
                >
                  <Save size={16} />
                  Save Schedule
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* =================================================
            INFORMATION
        ================================================= */}

        <div
          className="
            mt-5 rounded-2xl
            border border-(--line)
            bg-(--surface-muted)
            p-5
          "
        >
          <div className="flex gap-3">
            <CalendarClock
              size={19}
              className="mt-0.5 shrink-0 text-(--accent)"
            />

            <div>
              <p className="text-sm font-bold text-(--foreground)">
                How recurring training works
              </p>

              <p className="mt-1 text-sm leading-6 text-(--ink-muted)">
                These are weekly recurring rules, not individual calendar dates.
                For example, configuring Monday with 06:00–07:00 and 07:00–08:00
                automatically makes every Monday in the monthly calendar
                available with those sessions.
              </p>

              <p className="mt-2 text-sm leading-6 text-(--ink-muted)">
                Holidays override the recurring schedule for a specific date.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

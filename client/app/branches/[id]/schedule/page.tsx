"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useParams, useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  CalendarClock,
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
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmationDialog,
  ErrorState,
  IconButton,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
} from "@/components/ui";

import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  getTrainingSessionTypes,
  type TrainingSessionTypeRecord,
} from "@/lib/trainingSessionTypeApi";

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
  capacity: null,
  coach: null,
};

type SessionDraft = {
  sessionTypeId: string;
  sessionName: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  capacity: string;
  coach: string;
};

type ConfirmationAction =
  | { type: "delete-session"; slotId: string }
  | { type: "reset-branch" }
  | { type: "reset-day" };

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
              sessionTypeId: slot.sessionTypeId,
              sessionType: slot.sessionType,
              startTime: slot.startTime || DEFAULT_SLOT.startTime,
              endTime: slot.endTime || DEFAULT_SLOT.endTime,
              isActive: slot.isActive !== false,
              capacity: slot.capacity ?? null,
              coach:
                typeof slot.coach === "string"
                  ? slot.coach
                  : slot.coach?._id || null,
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

  const canManageSchedule = useCan("branch_schedule.manage");

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
  const [copyTargetsOpen, setCopyTargetsOpen] = useState(false);
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([]);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionFormError, setSessionFormError] = useState("");
  const [sessionTypes, setSessionTypes] = useState<TrainingSessionTypeRecord[]>(
    [],
  );
  const [coaches, setCoaches] = useState<{ _id: string; name: string }[]>([]);
  const [sessionTypesLoading, setSessionTypesLoading] = useState(true);
  const [sessionTypesError, setSessionTypesError] = useState("");
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>({
    sessionTypeId: "",
    sessionName: "",
    startTime: DEFAULT_SLOT.startTime,
    endTime: DEFAULT_SLOT.endTime,
    isActive: true,
    capacity: "",
    coach: "",
  });

  useEffect(() => {
    let cancelled = false;
    getTrainingSessionTypes()
      .then((types) => {
        if (!cancelled) setSessionTypes(types);
      })
      .catch((caught) => {
        if (!cancelled)
          setSessionTypesError(
            caught instanceof Error
              ? caught.message
              : "Unable to load training session types.",
          );
      })
      .finally(() => {
        if (!cancelled) setSessionTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction | null>(null);

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

        const response = await getBranchSchedule(branchId);

        const schedule = response.schedule;

        setBranchName(response.branch?.name || "Branch");

        setBranchAddress(response.branch?.address || "");
        setCoaches(response.coaches || []);

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
    // The loader owns the async loading/error state for this request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSchedule();
  }, [loadSchedule]);

  /* =======================================================
     UPDATE DAY
  ======================================================= */

  function updateDay(
    dayOfWeek: number,
    updater: (day: WeeklyScheduleDay) => WeeklyScheduleDay,
  ) {
    if (!canManageSchedule) return;
    setWeeklySchedule((current) =>
      current.map((day) => (day.dayOfWeek === dayOfWeek ? updater(day) : day)),
    );

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
    if (!canManageSchedule) return;
    setError("");
    setSessionFormError("");
    setSessionDraft({
      sessionTypeId: "",
      sessionName: "",
      startTime: DEFAULT_SLOT.startTime,
      endTime: DEFAULT_SLOT.endTime,
      isActive: true,
      capacity: "",
      coach: "",
    });
    setSessionModalOpen(true);
  }

  function createTrainingSession() {
    if (!canManageSchedule) return;
    const sessionName = sessionDraft.sessionName.trim();
    const start = timeToMinutes(sessionDraft.startTime);
    const end = timeToMinutes(sessionDraft.endTime);

    if (!sessionName) {
      setSessionFormError("Enter a name for the training session.");
      return;
    }
    if (!sessionDraft.sessionTypeId) {
      setSessionFormError("Select a program.");
      return;
    }
    if (start === null || end === null || start >= end) {
      setSessionFormError(
        "The session end time must be later than its start time.",
      );
      return;
    }

    const newSlot: TrainingSlot = {
      ...createLocalSlot(),
      _id: createTemporaryId(),
      sessionTypeId: sessionDraft.sessionTypeId,
      sessionName,
      startTime: sessionDraft.startTime,
      endTime: sessionDraft.endTime,
      isActive: sessionDraft.isActive,
      capacity: sessionDraft.capacity ? Number(sessionDraft.capacity) : null,
      coach: sessionDraft.coach || null,
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
    setSessionModalOpen(false);
    setSessionFormError("");
  }

  /* =======================================================
     UPDATE SLOT
  ======================================================= */

  function updateTrainingSession(
    slotId: string,
    field:
      | "sessionName"
      | "sessionTypeId"
      | "startTime"
      | "endTime"
      | "capacity"
      | "coach",
    value: string | number | null,
  ) {
    updateDay(selectedDay, (day) => ({
      ...day,

      slots: day.slots.map((slot) =>
        slot._id === slotId
          ? {
              ...slot,
              [field]:
                field === "sessionTypeId"
                  ? value || undefined
                  : field === "capacity"
                    ? value === ""
                      ? null
                      : Number(value)
                    : field === "coach"
                      ? value || null
                      : value,
              ...(field === "sessionTypeId" ? { sessionType: undefined } : {}),
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

    updateDay(selectedDay, (day) => ({
      ...day,

      slots: day.slots.filter((slot) => slot._id !== slotId),
    }));
  }

  function confirmDestructiveAction() {
    const action = confirmationAction;
    setConfirmationAction(null);
    if (!action) return;

    if (action.type === "delete-session") {
      deleteTrainingSession(action.slotId);
    } else if (action.type === "reset-day") {
      resetSelectedDay();
    } else {
      void handleReset();
    }
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
    if (!canManageSchedule) return;
    const selected = weeklySchedule.find(
      (day) => day.dayOfWeek === selectedDay,
    );

    if (!selected) {
      return;
    }

    const targetDays = DAY_NAMES.map((_, index) => index).filter(
      (index) => index !== selectedDay,
    );

    setCopyTargetDays(targetDays);
    setCopyTargetsOpen(true);
  }

  function applyCopySelectedDayToOtherDays() {
    const selected = weeklySchedule.find(
      (day) => day.dayOfWeek === selectedDay,
    );
    if (!selected) return;
    const indexes = copyTargetDays;

    if (indexes.length === 0) {
      toast.warning("Choose at least one target day.");
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

    setCopyTargetsOpen(false);
    toast.success(`${selectedDayName} schedule copied successfully.`);
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
      const activeSlots = day.slots.filter((slot) => slot.isActive !== false);

      const validTimeSlots = activeSlots.filter(
        (slot) =>
          /^\d{2}:\d{2}$/.test(slot.startTime) &&
          /^\d{2}:\d{2}$/.test(slot.endTime),
      );
      const sortedForOverlap = [...validTimeSlots].sort(
        (a, b) =>
          (timeToMinutes(a.startTime) || 0) - (timeToMinutes(b.startTime) || 0),
      );
      for (let index = 1; index < sortedForOverlap.length; index += 1) {
        const previous = sortedForOverlap[index - 1],
          current = sortedForOverlap[index];
        const previousEnd = timeToMinutes(previous.endTime),
          currentStart = timeToMinutes(current.startTime);
        if (
          previousEnd !== null &&
          currentStart !== null &&
          currentStart < previousEnd
        )
          return `${DAY_NAMES[day.dayOfWeek]} already has a session scheduled from ${formatTime(previous.startTime)} to ${formatTime(previous.endTime)}. The requested time ${formatTime(current.startTime)} to ${formatTime(current.endTime)} overlaps with it.`;
      }

      if (day.isClosed) continue;

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
          return `${DAY_NAMES[day.dayOfWeek]} already has a session scheduled from ${formatTime(previous.startTime)} to ${formatTime(previous.endTime)}. The requested time ${formatTime(current.startTime)} to ${formatTime(current.endTime)} overlaps with it.`;
        }
      }
    }

    return "";
  }

  /* =======================================================
     SAVE
  ======================================================= */

  async function handleSave() {
    if (!branchId || !canManageSchedule) {
      return;
    }

    const validationError = validateBeforeSave();

    if (validationError) {
      toast.error(
        validationError,
        validationError.includes("overlaps")
          ? "Schedule conflict"
          : "Check schedule details",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

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
          ...(slot.sessionTypeId ? { sessionTypeId: slot.sessionTypeId } : {}),
          sessionType: slot.sessionType,

          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: slot.isActive !== false,
          capacity: slot.capacity ?? null,
          coach:
            typeof slot.coach === "string"
              ? slot.coach
              : slot.coach?._id || null,
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

      toast.success("Branch training schedule saved successfully.");
    } catch (caughtError) {
      console.error("Save branch schedule error:", caughtError);

      const message = getApiErrorMessage(
        caughtError,
        "Failed to save branch training schedule.",
      );
      toast.error(
        message,
        message.toLowerCase().includes("overlap")
          ? "Schedule conflict"
          : "Unable to save schedule",
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     RESET
  ======================================================= */

  async function handleReset() {
    if (!branchId || !canManageSchedule) {
      return;
    }

    try {
      setResetting(true);
      setError("");

      await deleteBranchSchedule(branchId);

      setOpeningTime(DEFAULT_OPENING_TIME);

      setClosingTime(DEFAULT_CLOSING_TIME);

      setWeeklySchedule(createEmptyWeeklySchedule());

      toast.success("Branch schedule reset successfully.");
    } catch (caughtError) {
      console.error("Reset branch schedule error:", caughtError);

      toast.error(
        getApiErrorMessage(caughtError, "Failed to reset branch schedule."),
      );
    } finally {
      setResetting(false);
    }
  }

  /* =======================================================
     COPY CURRENT DAY
  ======================================================= */

  function resetSelectedDay() {
    updateDay(selectedDay, (day) => ({
      ...day,
      isClosed: true,
      slots: [],
    }));

    toast.info(
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
          description="Configure weekly recurring training sessions for monthly availability."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/branch-schedules">
                <Button variant="back">
                  <ArrowLeft size={16} />
                  Back to Branch Schedule
                </Button>
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
                disabled={resetting || !canManageSchedule}
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
              title="Unable to load branch schedule"
              message={error}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadSchedule(true)}
                >
                  Retry
                </Button>
              }
            />
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
                  disabled={!canManageSchedule}
                >
                  <Copy size={16} />
                  Copy Day
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmationAction({ type: "reset-day" })}
                  disabled={!canManageSchedule}
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
                disabled={!canManageSchedule}
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
                  disabled={!canManageSchedule}
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
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <label className="text-xs font-semibold text-(--ink-muted) lg:hidden">
                                Training Session
                              </label>
                              <Badge
                                variant={
                                  slot.sessionTypeId || slot.sessionType
                                    ? "accent"
                                    : "neutral"
                                }
                              >
                                {sessionTypes.find(
                                  (type) => type._id === slot.sessionTypeId,
                                )?.name ||
                                  slot.sessionType?.replaceAll("_", " ") ||
                                  "General (legacy)"}
                              </Badge>
                            </div>

                            <Select
                              aria-label="Program"
                              value={slot.sessionTypeId || ""}
                              disabled={!canManageSchedule}
                              onChange={(event) =>
                                updateTrainingSession(
                                  slotId,
                                  "sessionTypeId",
                                  event.target.value,
                                )
                              }
                              className="mb-2 h-9 text-xs"
                            >
                              <option value="">Select a type</option>
                              {sessionTypes
                                .filter(
                                  (type) =>
                                    type.isActive ||
                                    type._id === slot.sessionTypeId,
                                )
                                .map((type) => (
                                  <option
                                    key={type._id}
                                    value={type._id}
                                    disabled={!type.isActive}
                                  >
                                    {type.name}
                                    {!type.isActive ? " (inactive)" : ""}
                                  </option>
                                ))}
                            </Select>

                            <Input
                              type="text"
                              value={slot.sessionName}
                              disabled={!canManageSchedule}
                              onChange={(event) =>
                                updateTrainingSession(
                                  slotId,
                                  "sessionName",
                                  event.target.value,
                                )
                              }
                              placeholder="Training Session"
                              className="h-12 font-semibold"
                            />
                            <Select
                              aria-label={`Coach for ${slot.sessionName}`}
                              value={
                                typeof slot.coach === "string"
                                  ? slot.coach
                                  : slot.coach?._id || ""
                              }
                              disabled={!canManageSchedule}
                              onChange={(event) =>
                                updateTrainingSession(
                                  slotId,
                                  "coach",
                                  event.target.value,
                                )
                              }
                              className="mt-2 h-10 text-sm"
                            >
                              <option value="">No coach assigned</option>
                              {coaches.map((coach) => (
                                <option key={coach._id} value={coach._id}>
                                  {coach.name}
                                </option>
                              ))}
                            </Select>
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

                              <Input
                                type="time"
                                value={slot.startTime}
                                disabled={!canManageSchedule}
                                onChange={(event) =>
                                  updateTrainingSession(
                                    slotId,
                                    "startTime",
                                    event.target.value,
                                  )
                                }
                                className="h-12 pl-10 pr-3 font-semibold"
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

                              <Input
                                type="time"
                                value={slot.endTime}
                                disabled={!canManageSchedule}
                                onChange={(event) =>
                                  updateTrainingSession(
                                    slotId,
                                    "endTime",
                                    event.target.value,
                                  )
                                }
                                className="h-12 pl-10 pr-3 font-semibold"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-(--ink-muted) lg:hidden">
                              Capacity
                            </label>
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              placeholder="Unlimited"
                              value={slot.capacity ?? ""}
                              disabled={!canManageSchedule}
                              onChange={(event) =>
                                updateTrainingSession(
                                  slotId,
                                  "capacity",
                                  event.target.value,
                                )
                              }
                              className="h-12 font-semibold"
                              aria-label={`Capacity for ${slot.sessionName}`}
                            />
                          </div>

                          {/* STATUS */}

                          <div className="flex items-center justify-between lg:justify-center">
                            <span className="text-xs font-semibold text-(--ink-muted) lg:hidden">
                              Status
                            </span>

                            <button
                              type="button"
                              onClick={() => toggleTrainingSession(slotId)}
                              disabled={!canManageSchedule}
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

                          {canManageSchedule && (
                            <div className="flex items-center justify-end gap-2 lg:justify-center">
                              <IconButton
                                label="Duplicate session"
                                onClick={() => duplicateTrainingSession(slot)}
                              >
                                <Copy size={16} />
                              </IconButton>

                              <IconButton
                                variant="danger"
                                label="Delete session"
                                onClick={() =>
                                  slot._id &&
                                  setConfirmationAction({
                                    type: "delete-session",
                                    slotId: slot._id,
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </div>
                          )}
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

            {!selectedDaySchedule.isClosed && canManageSchedule && (
              <Button
                type="button"
                onClick={addTrainingSession}
                variant="outline"
                fullWidth
                className="mt-5 h-12 border-dashed border-(--accent) bg-(--accent-soft) font-bold text-(--accent) hover:bg-(--accent) hover:text-black"
              >
                <Plus size={18} />
                Add Training Session
              </Button>
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
                  onClick={() =>
                    setConfirmationAction({ type: "reset-branch" })
                  }
                  disabled={saving || resetting || !canManageSchedule}
                >
                  <RotateCcw size={16} />
                  Reset Branch
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleSave()}
                  loading={saving}
                  disabled={resetting || !canManageSchedule}
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

        <Modal
          open={sessionModalOpen}
          onClose={() => setSessionModalOpen(false)}
          title="Add Training Session"
          description="Choose a program, then set the session details for this day."
          size="lg"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setSessionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={createTrainingSession}
                disabled={!canManageSchedule}
              >
                <Plus size={16} />
                Add Training Session
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <section aria-labelledby="training-type-label">
              <h3
                id="training-type-label"
                className="mb-2 text-sm font-bold text-(--foreground)"
              >
                Training Type
              </h3>
              {sessionTypesLoading ? (
                <p className="text-sm text-(--ink-muted)">Loading programs…</p>
              ) : sessionTypesError ? (
                <p role="alert" className="text-sm text-(--danger)">
                  {sessionTypesError}
                </p>
              ) : sessionTypes.filter((type) => type.isActive).length === 0 ? (
                <div className="rounded-lg border border-(--line) p-3 text-sm text-(--ink-muted)">
                  No programs have been created yet.{" "}
                  <Link
                    className="font-semibold text-(--accent) underline"
                    href="/training-session-types"
                  >
                    Manage programs
                  </Link>
                </div>
              ) : (
                <Select
                  aria-label="Program"
                  value={sessionDraft.sessionTypeId}
                  disabled={!canManageSchedule}
                  onChange={(event) =>
                    setSessionDraft((current) => ({
                      ...current,
                      sessionTypeId: event.target.value,
                    }))
                  }
                >
                  <option value="">Select a program</option>
                  {sessionTypes
                    .filter((type) => type.isActive)
                    .map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.name}
                      </option>
                    ))}
                </Select>
              )}
            </section>

            <div>
              <label
                htmlFor="new-session-name"
                className="mb-1.5 block text-sm font-semibold text-(--foreground)"
              >
                Session Name
              </label>
              <Input
                id="new-session-name"
                autoFocus
                value={sessionDraft.sessionName}
                onChange={(event) =>
                  setSessionDraft((current) => ({
                    ...current,
                    sessionName: event.target.value,
                  }))
                }
                placeholder="e.g. Beginner Karate"
                disabled={!canManageSchedule}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="new-session-start"
                  className="mb-1.5 block text-sm font-semibold text-(--foreground)"
                >
                  Start Time
                </label>
                <Input
                  id="new-session-start"
                  type="time"
                  value={sessionDraft.startTime}
                  onChange={(event) =>
                    setSessionDraft((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                  disabled={!canManageSchedule}
                />
              </div>
              <div>
                <label
                  htmlFor="new-session-end"
                  className="mb-1.5 block text-sm font-semibold text-(--foreground)"
                >
                  End Time
                </label>
                <Input
                  id="new-session-end"
                  type="time"
                  value={sessionDraft.endTime}
                  onChange={(event) =>
                    setSessionDraft((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                  disabled={!canManageSchedule}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="new-session-capacity"
                  className="mb-1.5 block text-sm font-semibold text-(--foreground)"
                >
                  Capacity (optional)
                </label>
                <Input
                  id="new-session-capacity"
                  type="number"
                  min={1}
                  max={1000}
                  placeholder="Unlimited"
                  value={sessionDraft.capacity}
                  onChange={(event) =>
                    setSessionDraft((current) => ({
                      ...current,
                      capacity: event.target.value,
                    }))
                  }
                  disabled={!canManageSchedule}
                />
              </div>
              <div>
                <label
                  htmlFor="new-session-coach"
                  className="mb-1.5 block text-sm font-semibold text-(--foreground)"
                >
                  Coach
                </label>
                <Select
                  id="new-session-coach"
                  value={sessionDraft.coach}
                  onChange={(event) =>
                    setSessionDraft((current) => ({
                      ...current,
                      coach: event.target.value,
                    }))
                  }
                  disabled={!canManageSchedule}
                >
                  <option value="">No coach assigned</option>
                  {coaches.map((coach) => (
                    <option key={coach._id} value={coach._id}>
                      {coach.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-(--foreground)">
              <Checkbox
                checked={sessionDraft.isActive}
                onChange={(event) =>
                  setSessionDraft((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                disabled={!canManageSchedule}
              />
              Session is active
            </label>

            {sessionFormError && (
              <p
                role="alert"
                className="rounded-lg border border-(--danger)/20 bg-(--danger-soft) px-3 py-2 text-sm text-(--danger)"
              >
                {sessionFormError}
              </p>
            )}
          </div>
        </Modal>

        <Modal
          open={copyTargetsOpen}
          onClose={() => setCopyTargetsOpen(false)}
          title={`Copy ${selectedDayName} schedule`}
          description="Choose the weekdays that should receive a copy of this day’s sessions."
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setCopyTargetsOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={applyCopySelectedDayToOtherDays}>
                Copy schedule
              </Button>
            </>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {DAY_NAMES.map(
              (name, index) =>
                index !== selectedDay && (
                  <label
                    key={name}
                    className="flex items-center gap-2 rounded-lg border border-(--line) p-3 text-sm"
                  >
                    <Checkbox
                      checked={copyTargetDays.includes(index)}
                      onChange={(event) =>
                        setCopyTargetDays((current) =>
                          event.target.checked
                            ? [...current, index]
                            : current.filter((day) => day !== index),
                        )
                      }
                    />
                    {name}
                  </label>
                ),
            )}
          </div>
        </Modal>

        <ConfirmationDialog
          open={Boolean(confirmationAction)}
          title={
            confirmationAction?.type === "delete-session"
              ? "Delete training session?"
              : confirmationAction?.type === "reset-day"
                ? `Reset ${selectedDayName}?`
                : "Reset branch schedule?"
          }
          description={
            confirmationAction?.type === "delete-session"
              ? "This session will be removed from the unsaved weekly schedule. Save the schedule to apply the change."
              : confirmationAction?.type === "reset-day"
                ? `All sessions for ${selectedDayName} will be removed from the unsaved weekly schedule.`
                : "This removes the configured recurring schedule for this branch and restores the default editor state."
          }
          confirmLabel={
            confirmationAction?.type === "delete-session"
              ? "Delete Session"
              : "Reset Schedule"
          }
          onConfirm={confirmDestructiveAction}
          onClose={() => setConfirmationAction(null)}
        />
      </div>
    </main>
  );
}

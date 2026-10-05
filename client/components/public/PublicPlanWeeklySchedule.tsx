"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Loader2, MapPin } from "lucide-react";
import { Card } from "@/components/ui";
import {
  getPublicTrainingSessionTypes,
  type TrainingSessionTypeRecord,
} from "@/lib/trainingSessionTypeApi";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
type Slot = {
  _id?: string;
  sessionName?: string;
  sessionType?: string;
  sessionTypeId?: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};
type WeeklyDay = { dayOfWeek: number; isClosed: boolean; slots: Slot[] };
type Branch = { _id: string; name: string; address?: string };
type ScheduleRecord = {
  branch: Branch;
  schedule: { weeklySchedule: WeeklyDay[] } | null;
  hasSchedule: boolean;
};
export type WeeklySessionChoice = {
  dayOfWeek: number;
  dayName: string;
  sessionName: string;
  sessionTypeId: string;
  sessionTypeName: string;
  startTime: string;
  endTime: string;
};

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

export default function PublicPlanWeeklySchedule({
  planProgramIds,
  programWeeklyLimits,
  selectionLimit,
  value,
  onChange,
}: {
  planProgramIds: string[];
  programWeeklyLimits: Record<string, number | null>;
  selectionLimit: number;
  value: WeeklySessionChoice[];
  onChange: (
    branch: { id: string; name: string } | null,
    choices: WeeklySessionChoice[],
  ) => void;
}) {
  const [branches, setBranches] = useState<ScheduleRecord[]>([]);
  const [types, setTypes] = useState<TrainingSessionTypeRecord[]>([]);
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_URL}/branch-schedules/public`, { cache: "no-store" }).then(
        async (response) => {
          const data = await response.json();
          if (!response.ok || !data.success)
            throw new Error(data.message || "Unable to load branch schedules.");
          return (
            Array.isArray(data.branches) ? data.branches : []
          ) as ScheduleRecord[];
        },
      ),
      getPublicTrainingSessionTypes(),
    ])
      .then(([records, sessionTypes]) => {
        if (!cancelled) {
          setBranches(records);
          setTypes(sessionTypes);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load branch schedules.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBranch =
    branches.find((item) => item.branch._id === branchId) || null;
  const weeklyDays = useMemo(
    () => selectedBranch?.schedule?.weeklySchedule || [],
    [selectedBranch],
  );
  const rows = useMemo(() => {
    const slots = weeklyDays.flatMap((day) =>
      day.isClosed
        ? []
        : (day.slots || []).filter(
            (slot) =>
              slot.isActive !== false &&
              slot.sessionTypeId &&
              planProgramIds.includes(String(slot.sessionTypeId)),
          ),
    );
    const unique = new Map<string, { startTime: string; endTime: string }>();
    slots.forEach((slot) =>
      unique.set(`${slot.startTime}-${slot.endTime}`, {
        startTime: slot.startTime,
        endTime: slot.endTime,
      }),
    );
    return [...unique.values()].sort(
      (a, b) =>
        a.startTime.localeCompare(b.startTime) ||
        a.endTime.localeCompare(b.endTime),
    );
  }, [weeklyDays, planProgramIds]);

  function selectBranch(nextId: string) {
    setBranchId(nextId);
    const next = branches.find((item) => item.branch._id === nextId);
    onChange(next ? { id: next.branch._id, name: next.branch.name } : null, []);
  }

  function slotsAt(
    dayOfWeek: number,
    row: { startTime: string; endTime: string },
  ) {
    const day = weeklyDays.find((item) => Number(item.dayOfWeek) === dayOfWeek);
    if (!day || day.isClosed) return [];
    return (day.slots || []).filter(
      (slot) =>
        slot.isActive !== false &&
        slot.sessionTypeId &&
        planProgramIds.includes(String(slot.sessionTypeId)) &&
        slot.startTime === row.startTime &&
        slot.endTime === row.endTime,
    );
  }

  function isSelected(dayOfWeek: number, slot: Slot) {
    return value.some(
      (item) =>
        item.dayOfWeek === dayOfWeek &&
        item.sessionTypeId === String(slot.sessionTypeId) &&
        item.startTime === slot.startTime &&
        item.endTime === slot.endTime &&
        item.sessionName === (slot.sessionName || "Training Session"),
    );
  }

  function toggleSlot(dayOfWeek: number, slot: Slot) {
    if (!selectedBranch) return;
    const typeId = String(slot.sessionTypeId || "");
    const existing = value.find((item) => item.dayOfWeek === dayOfWeek);
    const selected = isSelected(dayOfWeek, slot);
    if (selected) {
      onChange(
        { id: selectedBranch.branch._id, name: selectedBranch.branch.name },
        value.filter((item) => item.dayOfWeek !== dayOfWeek),
      );
      return;
    }
    if (!existing && value.length >= selectionLimit) return;
    const limit = programWeeklyLimits[typeId];
    const programCount = value.filter(
      (item) => item.sessionTypeId === typeId,
    ).length;
    if (
      limit != null &&
      programCount >= limit &&
      existing?.sessionTypeId !== typeId
    )
      return;
    const type = types.find((item) => item._id === typeId);
    const choice: WeeklySessionChoice = {
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      sessionName: slot.sessionName || "Training Session",
      sessionTypeId: typeId,
      sessionTypeName:
        type?.name || slot.sessionType?.replaceAll("_", " ") || "Training",
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
    onChange(
      { id: selectedBranch.branch._id, name: selectedBranch.branch.name },
      [...value.filter((item) => item.dayOfWeek !== dayOfWeek), choice].sort(
        (a, b) =>
          WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek),
      ),
    );
  }

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-(--accent)" />
      </div>
    );
  if (error) return <Card className="p-5 text-sm text-red-700">{error}</Card>;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-sm font-semibold">
          Choose branch
          <select
            value={branchId}
            onChange={(event) => selectBranch(event.target.value)}
            className="mt-2 w-full rounded-xl border border-(--line) bg-(--input-bg) px-4 py-3 font-normal outline-none focus:border-(--accent)"
          >
            <option value="">Select a branch</option>
            {branches.map((item) => (
              <option key={item.branch._id} value={item.branch._id}>
                {item.branch.name}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-xl bg-(--accent-soft) px-4 py-3 text-sm font-semibold text-(--accent)">
          {value.length} of {selectionLimit} classes selected
        </div>
      </div>
      {!branches.length && (
        <p className="text-sm text-(--ink-muted)">
          No active branches are available right now.
        </p>
      )}
      {selectedBranch && (
        <>
          <div className="flex items-center gap-2 text-sm text-(--ink-muted)">
            <MapPin size={16} className="text-(--accent)" />
            <span>
              <strong className="text-(--foreground)">
                {selectedBranch.branch.name}
              </strong>
              {selectedBranch.branch.address
                ? ` · ${selectedBranch.branch.address}`
                : ""}
            </span>
          </div>
          {!selectedBranch.hasSchedule || !selectedBranch.schedule ? (
            <Card className="p-5 text-sm text-(--ink-muted)">
              This branch has no weekly schedule configured yet.
            </Card>
          ) : rows.length === 0 ? (
            <Card className="p-5 text-sm text-(--ink-muted)">
              This branch has no weekly sessions for programs included in this
              plan.
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-(--line)">
              <table className="w-full min-w-[850px] border-collapse text-center text-xs">
                <thead>
                  <tr className="bg-(--sidebar-logo-bg) text-white">
                    <th className="sticky left-0 z-10 min-w-28 border-r border-white/10 px-3 py-3 text-left">
                      TIME
                    </th>
                    {WEEK_ORDER.map((day) => (
                      <th
                        key={day}
                        className="min-w-24 border-r border-white/10 px-2 py-3"
                      >
                        <span className="block font-bold">
                          {DAY_NAMES[day].slice(0, 3).toUpperCase()}
                        </span>
                        <span className="mt-1 block text-[10px] font-normal text-white/70">
                          Every week
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.startTime}-${row.endTime}`}
                      className="border-t border-(--line)"
                    >
                      <th className="sticky left-0 z-[1] border-r border-(--line) bg-(--surface) px-3 py-3 text-left font-semibold text-(--ink-muted)">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={12} />
                          {formatTime(row.startTime)}
                        </span>
                        <span className="block pl-4 text-[10px] font-normal">
                          – {formatTime(row.endTime)}
                        </span>
                      </th>
                      {WEEK_ORDER.map((day) => {
                        const slots = slotsAt(day, row);
                        const dayChoice = value.find(
                          (item) => item.dayOfWeek === day,
                        );
                        return (
                          <td
                            key={day}
                            className="border-r border-(--line) p-1.5 align-middle"
                          >
                            {slots.length ? (
                              <div className="flex flex-col gap-1">
                                {slots.map((slot, index) => {
                                  const chosen = isSelected(day, slot);
                                  const programLimit =
                                    programWeeklyLimits[
                                      String(slot.sessionTypeId)
                                    ];
                                  const programCount = value.filter(
                                    (item) =>
                                      item.sessionTypeId ===
                                      String(slot.sessionTypeId),
                                  ).length;
                                  const exceedsProgramLimit =
                                    programLimit != null &&
                                    programCount >= programLimit &&
                                    dayChoice?.sessionTypeId !==
                                      String(slot.sessionTypeId);
                                  const disabled =
                                    !chosen &&
                                    ((!dayChoice &&
                                      value.length >= selectionLimit) ||
                                      exceedsProgramLimit);
                                  return (
                                    <button
                                      key={slot._id || `${day}-${index}`}
                                      type="button"
                                      disabled={disabled}
                                      aria-pressed={chosen}
                                      onClick={() => toggleSlot(day, slot)}
                                      title={`${slot.sessionName || "Training Session"} · ${types.find((type) => type._id === slot.sessionTypeId)?.name || "Program"}`}
                                      className={`flex min-h-12 w-full items-center justify-center rounded-lg border px-2 transition disabled:cursor-not-allowed disabled:opacity-35 ${chosen ? "border-(--accent) bg-(--accent) text-white shadow-sm" : "border-(--line) bg-(--surface) text-(--ink-muted) hover:border-(--accent) hover:bg-(--accent-soft)"}`}
                                    >
                                      {chosen ? (
                                        <Check size={17} />
                                      ) : (
                                        <span className="line-clamp-2 text-[10px] font-medium">
                                          {slot.sessionName || "Select"}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-(--surface) text-(--ink-faint)">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="flex items-start gap-2 text-xs leading-5 text-(--ink-faint)">
            <CalendarDays size={14} className="mt-0.5 shrink-0" />
            Choose one available session on each of {selectionLimit} different
            days. These recurring weekly choices are preferences, not
            reservations.
          </p>
        </>
      )}
    </div>
  );
}

import Link from "next/link";

import {
  ArrowUpRight,
  CalendarOff,
  Check,
  Clock3,
  FileClock,
  RotateCcw,
  X,
} from "lucide-react";

import { Badge, Button } from "@/components/ui";

export type DailyAttendanceRow = {
  student: {
    _id: string;
    name: string;
    age?: number;
    phone?: string;
    currentBelt?: string;
    joinDate?: string | Date;

    branch?: {
      _id: string;
      name: string;
    } | null;

    plan?: {
      _id: string;
      name: string;
    } | null;
  };

  attendance: {
    _id?: string;
    attendanceType?: "REGULAR" | "MAKEUP";
    sessionSlotId?: string;
    sessionName?: string;
    sessionStartTime?: string;
    sessionEndTime?: string;
    status?: string;
    planDay?: number;
    curriculumTitle?: string;
    makeupRequired?: boolean;
    makeupCompleted?: boolean;
  } | null;
  attendanceComplete?: boolean;
  curriculumComplete?: boolean;
  curriculumScheduled?: boolean;
  sessionAttendanceCount?: number;
  sessionAttendanceTotal?: number;

  planDay?: number;

  curriculum: {
    day?: number;
    title?: string;
    description?: string;
    skill?: string;
  } | null;

  holiday?: {
    _id?: string;
    name?: string;
    description?: string;
    date?: string;
  } | null;

  /*
   * Branch schedule for the exact
   * calendar date being displayed.
   *
   * The backend calculates this from:
   *
   * calendar date
   *      ↓
   * day of week
   *      ↓
   * weekly branch schedule
   */
  branchSchedule?: {
    configured: boolean;
    isOpen: boolean;
    isClosed: boolean;
    dayOfWeek: number | null;
    dayName: string | null;

    slots: {
      _id?: string;
      sessionTypeId?: string;
      sessionName?: string;
      startTime: string;
      endTime: string;
      isActive?: boolean;
      attendance?: { _id?: string; status?: string } | null;
      planDay?: number | null;
      curriculum?: {
        title?: string;
        description?: string;
        skill?: string;
      } | null;
      programName?: string;
      entitled?: boolean;
      curriculumAvailable?: boolean;
      curriculumComplete?: boolean;
      capacity?: number | null;
      currentEnrollment?: number;
      availableSeats?: number | null;
    }[];

    openingTime: string | null;
    closingTime: string | null;
  } | null;
};

type AttendanceRowProps = {
  row: DailyAttendanceRow;
  canManage: boolean;

  saving: boolean;

  onMark: (row: DailyAttendanceRow, status: "PRESENT" | "ABSENT") => void;
  onUndo: (row: DailyAttendanceRow) => void;
  canRequestCorrection?: boolean;
  onRequestCorrection?: (row: DailyAttendanceRow) => void;
};

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST"
  );
}

function formatTime(value?: string) {
  if (!value) {
    return "";
  }

  const parts = value.split(":");

  if (parts.length < 2) {
    return value;
  }

  const hour = Number(parts[0]);

  const minute = parts[1];

  if (Number.isNaN(hour)) {
    return value;
  }

  const period = hour >= 12 ? "PM" : "AM";

  const displayHour = hour % 12 || 12;

  return `${String(displayHour).padStart(2, "0")}:${minute} ${period}`;
}

export default function AttendanceRow({
  row,
  canManage,
  saving,
  onMark,
  onUndo,
  canRequestCorrection = false,
  onRequestCorrection,
}: AttendanceRowProps) {
  const marked = Boolean(row.attendance);

  const status = row.attendance?.status;

  const isHoliday = Boolean(row.holiday);

  /*
   * A configured branch with no active
   * training slot is considered closed.
   *
   * Missing schedule remains open for
   * backward compatibility.
   */
  const isBranchClosed =
    !isHoliday &&
    row.branchSchedule?.configured === true &&
    row.branchSchedule.isOpen === false;

  const activeSlots = row.branchSchedule?.slots || [];
  const selectedAttendanceSlot = activeSlots.find(
    (slot) =>
      String(slot._id || "") === String(row.attendance?.sessionSlotId || ""),
  );
  const attendedSessionName =
    row.attendance?.sessionName || selectedAttendanceSlot?.sessionName;
  const attendedSessionStart =
    row.attendance?.sessionStartTime || selectedAttendanceSlot?.startTime;
  const attendedSessionEnd =
    row.attendance?.sessionEndTime || selectedAttendanceSlot?.endTime;
  const hasMarkableSlot = activeSlots.some(
    (slot) => slot.entitled && slot.curriculumAvailable && !slot.attendance,
  );

  const canMarkAttendance =
    canManage &&
    !isHoliday &&
    !isBranchClosed &&
    !marked &&
    hasMarkableSlot &&
    !saving;

  return (
    <tr
      className={`
        group
        transition-colors
        duration-200
        ${
          isHoliday || isBranchClosed
            ? "bg-(--surface)"
            : "hover:bg-(--surface)"
        }
      `}
    >
      {/* =====================================
          STUDENT
      ====================================== */}

      <td className="px-6 py-5">
        <Link
          href={`/students/${row.student._id}`}
          className="flex items-center gap-3"
        >
          <div
            className="
              flex h-10 w-10 shrink-0
              items-center justify-center
              rounded-full
              border border-(--line)
              bg-(--sidebar-logo-bg)
              text-xs font-black
              text-(--gold)
            "
          >
            {getInitials(row.student.name)}
          </div>

          <div className="min-w-0">
            <p
              className="
                truncate text-[15px] font-semibold leading-5
                text-(--foreground-soft)
                transition-colors
                group-hover:text-(--accent)
              "
            >
              {row.student.name}
            </p>

            <p className="mt-1 text-sm leading-5 text-(--ink-muted)">
              Age {row.student.age ?? "—"}
            </p>
          </div>
        </Link>
      </td>

      {/* =====================================
          CONTACT
      ====================================== */}

      <td className="px-6 py-5">
        <p
          className="
            text-[15px] font-medium leading-5
            text-(--foreground-soft)
          "
        >
          {row.student.phone || "No phone"}
        </p>

        <p
          className="
            mt-1 max-w-[200px]
            truncate text-sm leading-5
            text-(--ink-muted)
          "
        >
          {row.student.branch?.name || "No branch"}
        </p>
      </td>

      {/* =====================================
          TRAINING
      ====================================== */}

      <td className="px-6 py-5">
        <p
          className="
            text-[15px] font-medium leading-5
            text-(--foreground-soft)
          "
        >
          Day {row.planDay}
        </p>

        <p
          className="
            mt-1 max-w-[230px]
            truncate text-sm leading-5
            text-(--ink-muted)
          "
        >
          {row.student.plan?.name || "No plan"}
        </p>
      </td>

      {/* =====================================
          TODAY'S STEP
      ====================================== */}

      <td className="px-6 py-5">
        {/* HOLIDAY */}

        {isHoliday ? (
          <div
            className="
              flex items-start gap-2
              rounded-xl
              border border-(--line)
              bg-(--accent-soft)
              px-3 py-2.5
            "
          >
            <CalendarOff
              size={16}
              className="
                mt-0.5
                shrink-0
                text-(--accent)
              "
            />

            <div className="min-w-0">
              <p
                className="
                  max-w-[220px]
                  truncate
                  text-[15px] font-semibold leading-5
                  text-(--accent)
                "
              >
                {row.holiday?.name || "Holiday"}
              </p>

              <p
                className="
                  mt-1 max-w-[220px]
                  truncate text-sm leading-5
                  text-(--ink-muted)
                "
              >
                {row.holiday?.description || "No training session"}
              </p>
            </div>
          </div>
        ) : isBranchClosed ? (
          /* BRANCH CLOSED */

          <div
            className="
              flex items-start gap-2
              rounded-xl
              border border-(--line)
              bg-(--surface)
              px-3 py-2.5
            "
          >
            <CalendarOff
              size={16}
              className="
                mt-0.5
                shrink-0
                text-(--ink-muted)
              "
            />

            <div className="min-w-0">
              <p
                className="
                  max-w-[220px]
                  truncate
                  text-[15px] font-semibold leading-5
                  text-(--foreground-soft)
                "
              >
                Branch Closed
              </p>

              <p
                className="
                  mt-1 max-w-[260px]
                  text-sm leading-5
                  text-(--ink-muted)
                "
              >
                {row.branchSchedule?.dayName || "No training day"} has no active
                training session.
              </p>
            </div>
          </div>
        ) : row.curriculum ? (
          /* CURRICULUM */

          <>
            <p
              className="
                max-w-[220px]
                truncate text-[15px] font-medium leading-5
                text-(--foreground-soft)
              "
            >
              {row.curriculum.title}
            </p>

            <p
              className="
                mt-1 max-w-[220px]
                truncate text-sm leading-5
                text-(--ink-muted)
              "
            >
              {row.curriculum.skill ||
                row.curriculum.description ||
                "Training step"}
            </p>

            {row.attendance &&
            (attendedSessionName ||
              attendedSessionStart ||
              attendedSessionEnd) ? (
              <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-(--accent)">
                <Clock3 size={12} />
                <span className="truncate">
                  {attendedSessionName || "Selected session"}
                  {(attendedSessionStart || attendedSessionEnd) &&
                    ` · ${formatTime(attendedSessionStart)} – ${formatTime(attendedSessionEnd)}`}
                </span>
              </p>
            ) : (
              row.curriculumScheduled &&
              activeSlots.some(
                (slot) => slot.entitled && slot.curriculumAvailable,
              ) && (
                <p className="mt-2 text-[11px] font-semibold text-(--accent)">
                  {(() => {
                    const matching = activeSlots.filter(
                      (slot) => slot.entitled && slot.curriculumAvailable,
                    );
                    return matching.length === 1
                      ? `${formatTime(matching[0].startTime)} – ${formatTime(matching[0].endTime)}`
                      : `${matching.length} training sessions`;
                  })()}
                </p>
              )
            )}
            {!row.attendance && !row.curriculumScheduled && (
              <p className="mt-2 text-[11px] font-semibold text-(--ink-muted)">
                No matching program session scheduled today; attendance is
                unavailable.
              </p>
            )}
          </>
        ) : row.curriculumComplete ? (
          <div className="rounded-xl border border-(--line) bg-(--surface) px-3 py-2.5 text-sm font-semibold text-(--ink-muted)">
            This program&apos;s curriculum is complete.
          </div>
        ) : (
          <div
            className="
              flex items-center gap-2
              text-xs text-(--ink-muted)
            "
          >
            <Clock3 size={14} />

            {activeSlots.some((slot) => slot.entitled)
              ? "No curriculum day available"
              : "No enrolled program session"}
          </div>
        )}
      </td>

      {/* =====================================
          STATUS
      ====================================== */}

      <td className="px-6 py-5">
        {isHoliday && (
          <Badge variant="default">
            <span className="inline-flex items-center gap-1.5">
              <CalendarOff size={13} />
              HOLIDAY
            </span>
          </Badge>
        )}

        {!isHoliday && isBranchClosed && (
          <Badge variant="default">
            <span className="inline-flex items-center gap-1.5">
              <CalendarOff size={13} />
              CLOSED
            </span>
          </Badge>
        )}

        {!isHoliday && !isBranchClosed && status === "PRESENT" && (
          <Badge variant="success">Present</Badge>
        )}

        {!isHoliday && !isBranchClosed && status === "ABSENT" && (
          <Badge variant="danger">Absent</Badge>
        )}

        {!isHoliday && !isBranchClosed && status === "PARTIAL" && (
          <Badge variant="warning">
            Partial ({row.sessionAttendanceCount}/{row.sessionAttendanceTotal})
          </Badge>
        )}

        {!isHoliday && !isBranchClosed && !marked && row.curriculumComplete && (
          <Badge variant="warning">Curriculum complete</Badge>
        )}

        {!isHoliday &&
          !isBranchClosed &&
          !marked &&
          !row.curriculumComplete && (
            <Badge variant="default">Not marked</Badge>
          )}
      </td>

      {/* =====================================
          ACTION
      ====================================== */}

      <td className="px-6 py-5">
        <div className="flex items-center justify-end gap-2">
          {/* NORMAL ATTENDANCE */}

          {!isHoliday &&
            marked &&
            canManage &&
            row.attendance?.attendanceType !== "MAKEUP" && !canRequestCorrection && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving || !row.attendance?._id}
                onClick={() => onUndo(row)}
              >
                <RotateCcw size={15} /> Undo
              </Button>
            )}

          {!isHoliday && marked && canRequestCorrection && row.attendance?.attendanceType !== "MAKEUP" && <Button type="button" size="sm" variant="outline" disabled={saving || !row.attendance?._id} onClick={() => onRequestCorrection?.(row)}><FileClock size={15}/> Request correction</Button>}

          {!isHoliday && !marked && !isBranchClosed && (
            <>
              <Button
                type="button"
                size="sm"
                variant={status === "PRESENT" ? "primary" : "outline"}
                disabled={!canMarkAttendance}
                className={status === "PRESENT" ? "disabled:opacity-100" : ""}
                onClick={() => onMark(row, "PRESENT")}
              >
                <Check size={15} />
                Present
              </Button>

              <Button
                type="button"
                size="sm"
                variant={status === "ABSENT" ? "danger" : "outline"}
                disabled={!canMarkAttendance}
                className={status === "ABSENT" ? "disabled:opacity-100" : ""}
                onClick={() => onMark(row, "ABSENT")}
              >
                <X size={15} />
                Absent
              </Button>
            </>
          )}

          {/* HOLIDAY */}

          {isHoliday && (
            <span
              className="
                inline-flex
                items-center gap-2
                rounded-lg
                border border-(--line)
                bg-(--surface)
                px-3 py-2
                text-xs font-bold
                text-(--ink-muted)
              "
            >
              <CalendarOff size={14} />
              No attendance
            </span>
          )}

          {/* CLOSED */}

          {!isHoliday && isBranchClosed && (
            <span
              className="
                  inline-flex
                  items-center gap-2
                  rounded-lg
                  border border-(--line)
                  bg-(--surface)
                  px-3 py-2
                  text-xs font-bold
                  text-(--ink-muted)
                "
            >
              <CalendarOff size={14} />
              Branch closed
            </span>
          )}

          {/* STUDENT LINK */}

          <Link
            href={`/students/${row.student._id}`}
            title="View student"
            className="
              ml-1 inline-flex h-8 w-8
              items-center justify-center
              rounded-lg
              text-(--accent)
              transition-colors
              hover:bg-(--accent-soft)
            "
          >
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </td>
    </tr>
  );
}

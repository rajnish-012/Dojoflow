import { AlertCircle, CalendarDays, CheckCircle2, X } from "lucide-react";

import { Badge, Button, Modal, Select } from "@/components/ui";

import type { DailyAttendanceRow } from "./AttendanceRow";

type AttendanceModalProps = {
  row: DailyAttendanceRow | null;
  status: "PRESENT" | "ABSENT" | null;
  open: boolean;
  saving: boolean;
  error: string;
  canManage: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sessionSlotId: string;
  onSessionChange: (id: string) => void;
};

export default function AttendanceModal({
  row,
  status,
  open,
  saving,
  error,
  canManage,
  onClose,
  onConfirm,
  sessionSlotId,
  onSessionChange,
}: AttendanceModalProps) {
  if (!row || !status) {
    return null;
  }

  const isAbsent = status === "ABSENT";
  const selectedSlot = (row.branchSchedule?.slots || []).find(
    (slot) => slot._id === sessionSlotId,
  );
  const selectedCurriculum = selectedSlot?.curriculum || row.curriculum;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAbsent ? "Mark student absent" : "Mark student present"}
      description="Review the training step before saving this attendance record."
    >
      <div className="space-y-5">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-4">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-[var(--danger)]"
            />

            <p className="text-sm text-[var(--danger)]">{error}</p>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)]">
              {row.student.name
                .trim()
                .split(/\s+/)
                .map((part) => part[0] || "")
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div>
              <p className="font-semibold text-[var(--foreground)]">
                {row.student.name}
              </p>

              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                {row.student.currentBelt || "White"} belt
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)]">
              <CalendarDays size={15} />
              Training day
            </div>

            <p className="mt-2 text-lg font-bold text-[var(--foreground)]">
              Day {selectedSlot?.planDay || row.planDay}
              {selectedSlot?.programName
                ? ` · ${selectedSlot.programName}`
                : ""}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">
              Status
            </p>

            <div className="mt-2">
              <Badge variant={isAbsent ? "danger" : "success"}>
                {isAbsent ? "Absent" : "Present"}
              </Badge>
            </div>
          </div>
        </div>

        {(row.branchSchedule?.slots || []).filter(
          (slot) =>
            slot.entitled &&
            slot.curriculumAvailable &&
            slot.sessionTypeId &&
            slot._id &&
            !slot.attendance,
        ).length > 0 && (
          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--ink-muted)]">
              Scheduled session
            </label>
            <Select
              value={sessionSlotId}
              onChange={(event) => onSessionChange(event.target.value)}
            >
              {(row.branchSchedule?.slots || [])
                .filter(
                  (slot) =>
                    slot.entitled &&
                    slot.curriculumAvailable &&
                    slot.sessionTypeId &&
                    slot._id &&
                    !slot.attendance,
                )
                .map((slot) => (
                  <option key={slot._id} value={slot._id}>
                    {slot.sessionName} ({slot.startTime}–{slot.endTime})
                  </option>
                ))}
            </Select>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
            Curriculum step
          </p>

          <p className="mt-2 font-semibold text-[var(--foreground)]">
            {selectedCurriculum?.title || "No curriculum title configured"}
          </p>

          {selectedCurriculum?.description && (
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {selectedCurriculum.description}
            </p>
          )}

          {selectedCurriculum?.skill && (
            <p className="mt-2 text-xs font-semibold text-[var(--accent)]">
              Skill: {selectedCurriculum.skill}
            </p>
          )}
        </div>

        {isAbsent && (
          <div className="rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 text-[var(--warning)]" />

              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Makeup tracking
                </p>

                <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                  This absence will be recorded as a missed training day. Makeup
                  scheduling will be handled in the next module.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            <X size={16} />
            Cancel
          </Button>

          {canManage && (
            <Button
              type="button"
              variant={isAbsent ? "danger" : "primary"}
              loading={saving}
              onClick={onConfirm}
            >
              {isAbsent ? (
                <AlertCircle size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Confirm {isAbsent ? "Absent" : "Present"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

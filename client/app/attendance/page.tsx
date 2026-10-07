"use client";
import { toast } from "@/lib/toast";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CalendarDays, CheckCheck, RefreshCw } from "lucide-react";

import {
  Button,
  Card,
  ConfirmationDialog,
  ErrorState,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import AttendanceStats from "@/components/attendance/AttendanceStats";
import AttendanceSheet from "@/components/attendance/AttendanceSheet";
import AttendanceModal from "@/components/attendance/AttendanceModal";

import type { DailyAttendanceRow } from "@/components/attendance/AttendanceRow";

import {
  getAttendanceDailySheet,
  markAllAttendancePresent,
  markAttendance,
  undoAttendance,
  requestAttendanceCorrection,
} from "@/lib/attendanceApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";

/* ==========================================
   LOCAL DATE HELPERS
========================================== */

function getLocalDate(daysFromToday = 0) {
  const date = new Date();

  date.setDate(date.getDate() + daysFromToday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/*
 * Convert YYYY-MM-DD to a local
 * calendar date.
 *
 * This avoids the JavaScript UTC
 * date conversion issue.
 */

function parseLocalDate(value: string | Date | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const date = new Date(value);

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatLocalDateKey(value: string | Date | undefined) {
  const date = parseLocalDate(value);

  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* ==========================================
   FRONTEND TRAINING DAY DISPLAY
========================================== */

/*
 * The joining date is always
 * Day 1.
 *
 * The backend remains the final
 * source of truth.
 */

function getDisplayPlanDay(row: DailyAttendanceRow, selectedDate: string) {
  const joinDate = row.student?.joinDate;
  if (!joinDate) {
    return Number(row.planDay || 1);
  }

  const joinDateKey = formatLocalDateKey(joinDate);
  if (joinDateKey === selectedDate) {
    return 1;
  }
  return Number(row.planDay || 1);
}

/* ==========================================
   PAGE
========================================== */

export default function AttendancePage() {
  const canViewAttendance = useCan(PERMISSIONS.ATTENDANCE_VIEW);
  const canManageAttendance = useCan(PERMISSIONS.ATTENDANCE_MANAGE);
  const canApproveCorrections = useCan(PERMISSIONS.ATTENDANCE_CORRECT_APPROVE);
  const canRequestCorrections = useCan(PERMISSIONS.ATTENDANCE_CORRECT);

  /*
   * Attendance rules:
   *
   * Previous dates → allowed
   * Today          → allowed
   * Tomorrow       → not allowed
   * Future dates   → not allowed
   */
  const today = useMemo(() => getLocalDate(0), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [rows, setRows] = useState<DailyAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRow, setSelectedRow] = useState<DailyAttendanceRow | null>(
    null,
  );
  const [selectedStatus, setSelectedStatus] = useState<
    "PRESENT" | "ABSENT" | null
  >(null);
  const [selectedSessionSlotId, setSelectedSessionSlotId] = useState("");
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [confirmMarkAllOpen, setConfirmMarkAllOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [undoRow, setUndoRow] = useState<DailyAttendanceRow | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [correctionRow, setCorrectionRow] = useState<DailyAttendanceRow | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<"PRESENT" | "ABSENT">("PRESENT");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  /* ==========================================
     LOAD ATTENDANCE SHEET
  ========================================== */

  const loadSheet = useCallback(async () => {
    if (!canViewAttendance) {
      setRows([]);
      setLoading(false);

      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await getAttendanceDailySheet(selectedDate);

      setRows(data.rows || []);
    } catch (err) {
      console.error("Attendance daily sheet error:", err);

      setRows([]);

      setError(
        err instanceof Error ? err.message : "Failed to load attendance sheet.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDate, canViewAttendance]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadSheet(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSheet]);

  /* ==========================================
     ATTENDANCE STATS
  ========================================== */

  const stats = useMemo(() => {
    const total = rows.length;

    const present = rows.filter(
      (row) => row.attendance?.status === "PRESENT",
    ).length;

    const absent = rows.filter(
      (row) => row.attendance?.status === "ABSENT",
    ).length;

    const pendingMakeups = rows.filter(
      (row) =>
        row.attendance?.makeupRequired && !row.attendance.makeupCompleted,
    ).length;

    return {
      total,
      present,
      absent,
      pendingMakeups,
    };
  }, [rows]);

  /* ==========================================
     DATE CHANGE
  ========================================== */

  function handleDateChange(value: string) {
    if (value > today) {
      toast.warning(
        "Attendance can only be marked for today or previous dates.",
      );

      return;
    }

    setError("");
    setSelectedDate(value);
  }

  async function confirmUndoAttendance() {
    const attendanceId = undoRow?.attendance?._id;
    if (!canManageAttendance || !attendanceId || undoing) return;
    setUndoing(true);
    setSavingStudentId(undoRow.student._id);
    try {
      await undoAttendance(attendanceId);
      setUndoRow(null);
      await loadSheet();
      toast.success("Attendance undone.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not undo attendance.",
      );
    } finally {
      setSavingStudentId(null);
      setUndoing(false);
    }
  }

  async function submitAttendanceCorrection() {
    const attendanceId = correctionRow?.attendance?._id;
    if (!attendanceId || !correctionReason.trim() || submittingCorrection) return;
    setSubmittingCorrection(true); setCorrectionError("");
    try {
      await requestAttendanceCorrection(attendanceId, correctionStatus, correctionReason.trim());
      setCorrectionRow(null); setCorrectionReason(""); await loadSheet(); toast.success("Correction request sent for approval.");
    } catch (err) { setCorrectionError(err instanceof Error ? err.message : "Unable to submit correction request."); }
    finally { setSubmittingCorrection(false); }
  }

  /* ==========================================
     OPEN MARK MODAL
  ========================================== */

  function openMarkModal(
    row: DailyAttendanceRow,
    status: "PRESENT" | "ABSENT",
  ) {
    if (!canManageAttendance) {
      return;
    }

    /*
     * Already marked:
     * no changes from this sheet.
     */

    if (row.attendanceComplete || row.attendance) {
      return;
    }

    const availableSlots = (row.branchSchedule?.slots || []).filter(
      (slot) => slot.entitled && slot.curriculumAvailable && !slot.attendance,
    );
    if (availableSlots.length === 0) {
      setFormError(
        row.curriculumComplete
          ? "This program's curriculum is complete. Add the next curriculum day before recording more attendance."
          : "This student has no scheduled program session with an available curriculum day on this date.",
      );
      return;
    }

    /*
     * Holiday:
     * absolutely no attendance.
     */

    if (row.holiday) {
      setFormError(
        `Attendance cannot be marked because this date is a holiday: ${
          row.holiday.name || "Holiday"
        }.`,
      );

      return;
    }

    /*
     * Branch schedule:
     *
     * If the exact calendar date
     * is closed, do not even open
     * the attendance modal.
     */

    if (
      row.branchSchedule?.configured === true &&
      row.branchSchedule.isOpen === false
    ) {
      setFormError(
        `${
          row.branchSchedule.dayName || "This day"
        } is closed for this branch. No training session is scheduled.`,
      );

      return;
    }

    setSelectedRow(row);
    setSelectedStatus(status);
    setSelectedSessionSlotId(availableSlots[0]?._id || "");
    setFormError("");
  }

  /* ==========================================
     CLOSE MODAL
  ========================================== */

  function closeMarkModal() {
    if (savingStudentId) {
      return;
    }

    setSelectedRow(null);
    setSelectedStatus(null);
    setSelectedSessionSlotId("");
    setFormError("");
  }

  /* ==========================================
     CONFIRM ATTENDANCE
  ========================================== */

  async function confirmAttendance() {
    if (!canManageAttendance) {
      setFormError(
        "Your role does not include permission to manage attendance.",
      );

      return;
    }

    if (!selectedRow || !selectedStatus) {
      return;
    }

    /*
     * Future protection.
     */

    if (selectedDate > today) {
      setFormError(
        "Future attendance cannot be marked. Please select today or a previous date.",
      );

      return;
    }

    /*
     * Holiday protection.
     */

    if (selectedRow.holiday) {
      setFormError(
        `Attendance cannot be marked because this date is a holiday: ${
          selectedRow.holiday.name || "Holiday"
        }.`,
      );

      return;
    }

    /*
     * Branch schedule protection.
     *
     * The backend remains the final
     * authority, but the frontend
     * prevents an unnecessary request.
     */

    if (
      selectedRow.branchSchedule?.configured === true &&
      selectedRow.branchSchedule.isOpen === false
    ) {
      setFormError(
        `${
          selectedRow.branchSchedule.dayName || "This day"
        } is closed for this branch. No training session is scheduled.`,
      );

      return;
    }

    const studentId = selectedRow.student._id;

    /*
     * Always send the attendance date
     * as a strict YYYY-MM-DD calendar key.
     */

    const attendanceDate = formatLocalDateKey(selectedDate);

    if (!attendanceDate) {
      setFormError(
        "Unable to determine the attendance date. Please select the date again.",
      );

      return;
    }

    /*
     * Compatibility value only.
     *
     * Backend calculates the
     * authoritative training day.
     */

    const displayPlanDay = getDisplayPlanDay(selectedRow, attendanceDate);

    try {
      setSavingStudentId(studentId);
      setFormError("");

      await markAttendance({
        student: studentId,
        sessionSlotId: selectedSessionSlotId || undefined,
        date: attendanceDate,
        planDay: displayPlanDay,
        curriculumTitle: selectedRow.curriculum?.title || "",
        status: selectedStatus,
        makeupRequired: selectedStatus === "ABSENT",
      });

      closeMarkModal();

      await loadSheet();
    } catch (err) {
      console.error("Mark attendance error:", err);

      /*
       * The backend may still reject
       * the request if the schedule was
       * changed after this page loaded.
       */

      if (err && typeof err === "object" && "data" in err) {
        const apiError = err as {
          data?: {
            branchSchedule?: {
              configured?: boolean;
              isOpen?: boolean;
              dayName?: string | null;
            };
            holiday?: {
              name?: string;
            } | null;
          };
          message?: string;
        };

        if (
          apiError.data?.branchSchedule?.configured === true &&
          apiError.data.branchSchedule.isOpen === false
        ) {
          setFormError(
            `${
              apiError.data.branchSchedule.dayName || "This day"
            } is closed for this branch. No training session is scheduled.`,
          );

          return;
        }

        if (apiError.data?.holiday) {
          setFormError(
            `Attendance cannot be marked because this date is a holiday: ${
              apiError.data.holiday.name || "Holiday"
            }.`,
          );

          return;
        }
      }

      const message =
        err instanceof Error ? err.message : "Failed to mark attendance.";
      if (message.toLowerCase().includes("completed this program curriculum")) {
        setSelectedRow(null);
        setSelectedStatus(null);
        setSelectedSessionSlotId("");
        setFormError("");
        await loadSheet();
        toast.info(message);
        return;
      }

      toast.error(message);
    } finally {
      setSavingStudentId(null);
    }
  }

  /* ==========================================
     PREPARE DISPLAY ROWS
  ========================================== */

  const displayRows = useMemo(() => {
    return rows.map((row) => ({
      ...row,

      /*
       * Joining date must always
       * display as Day 1.
       */

      planDay: getDisplayPlanDay(row, selectedDate),
    }));
  }, [rows, selectedDate]);

  /*
   * Determine whether the selected
   * date contains at least one
   * closed branch row.
   */

  const closedBranches = useMemo(() => {
    const branches = new Map<string, string>();

    for (const row of rows) {
      if (
        row.holiday ||
        !row.branchSchedule?.configured ||
        row.branchSchedule.isOpen
      ) {
        continue;
      }

      const branchId =
        row.student.branch?._id || row.student.branch?.name || row.student._id;

      const branchName = row.student.branch?.name || "Branch";

      if (branchId && !branches.has(branchId)) {
        branches.set(branchId, branchName);
      }
    }

    return Array.from(branches.values());
  }, [rows]);

  if (!canViewAttendance) {
    return (
      <main className="df-page">
        <PageHeader
          eyebrow="Authorization"
          title="Attendance"
          description="Your role does not include permission to view attendance."
        />
      </main>
    );
  }

  /* ==========================================
     RENDER
  ========================================== */

  return (
    <main>
      <div className="df-page">
        <PageHeader
          eyebrow="Training operations"
          title="Attendance"
          description="Manage daily attendance, training days and curriculum progress for your academy."
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canApproveCorrections && <Link href="/attendance/corrections" className="inline-flex h-11 items-center gap-2 rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--foreground) hover:bg-(--hover-bg)"><CalendarDays size={16}/> Corrections</Link>}
              <Button
                type="button"
                variant="outline"
                onClick={loadSheet}
                disabled={loading || markingAll}
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </Button>
              {canManageAttendance && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setConfirmMarkAllOpen(true)}
                  disabled={loading || markingAll || selectedDate > today}
                >
                  <CheckCheck size={16} />
                  Mark All Present
                </Button>
              )}
            </div>
          }
        />

        {/* ==================================
            ERROR
        ================================== */}

        {error && (
          <div>
            <ErrorState
              title="Attendance notice"
              message={error}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError("");
                    loadSheet();
                  }}
                >
                  Try again
                </Button>
              }
            />
          </div>
        )}

        {/* ==================================
            SUMMARY
        ================================== */}

        <AttendanceStats {...stats} />

        {/* ==================================
            DATE + TRAINING AVAILABILITY
        ================================== */}

        <Card padding="md">
          <div
            className="
              grid
              gap-0
              lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]
            "
          >
            {/* ================================
                DATE SECTION
            ================================= */}

            <div
              className="
                flex
                min-w-0
                flex-col
                gap-4
                border-b
                border-(--line)
                pb-5
                lg:border-b-0
                lg:border-r
                lg:pr-8
                lg:pb-0
              "
            >
              <div className="flex items-start gap-3">
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-(--accent-soft)
                    text-(--accent)
                  "
                >
                  <CalendarDays size={17} />
                </div>

                <div className="min-w-0">
                  <p
                    className="
                      text-sm
                      font-extrabold
                      text-(--foreground)
                    "
                  >
                    Attendance Date
                  </p>

                  <p
                    className="
                      mt-1
                      text-sm
                      font-bold
                      text-(--foreground-soft)
                    "
                  >
                    {formatDate(selectedDate)}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-(--ink-muted)
                    "
                  >
                    You can mark attendance for today or any previous date.
                  </p>
                </div>
              </div>

              <label className="relative block w-full sm:max-w-[260px]">
                <span className="sr-only">Select attendance date</span>

                <CalendarDays
                  size={17}
                  className="
                    pointer-events-none
                    absolute
                    left-3.5
                    top-1/2
                    -translate-y-1/2
                    text-(--ink-faint)
                  "
                />

                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(event) => handleDateChange(event.target.value)}
                  className="
                    df-input
                    h-11
                    w-full
                    pl-10
                  "
                />
              </label>
            </div>

            {/* ================================
                TRAINING AVAILABILITY SECTION
            ================================= */}

            <div
              className="
                flex
                min-w-0
                flex-col
                gap-3
                pt-5
                lg:pl-8
                lg:pt-0
              "
            >
              <div className="flex items-start gap-3">
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-(--accent-soft)
                    text-(--accent)
                  "
                >
                  <CalendarDays size={17} />
                </div>

                <div className="min-w-0">
                  <p
                    className="
                      text-sm
                      font-extrabold
                      text-(--foreground)
                    "
                  >
                    Training availability
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-(--ink-muted)
                    "
                  >
                    {closedBranches.length > 0
                      ? `Some branches are closed on ${formatDate(
                          selectedDate,
                        )}. Attendance cannot be marked for those branches.`
                      : `Training is available for all configured branches on ${formatDate(
                          selectedDate,
                        )}.`}
                  </p>
                </div>
              </div>

              {closedBranches.length > 0 ? (
                <div
                  className="
                    flex
                    flex-wrap
                    gap-2
                  "
                >
                  {closedBranches.map((branchName) => (
                    <span
                      key={branchName}
                      className="
                        inline-flex
                        items-center
                        rounded-full
                        border
                        border-(--line)
                        bg-(--card)
                        px-3
                        py-1.5
                        text-[11px]
                        font-bold
                        text-(--ink-muted)
                      "
                    >
                      {branchName} · Closed
                    </span>
                  ))}
                </div>
              ) : (
                <span
                  className="
                    inline-flex
                    w-fit
                    items-center
                    rounded-full
                    border
                    border-(--line)
                    bg-(--card)
                    px-3
                    py-1.5
                    text-[11px]
                    font-bold
                    text-(--ink-muted)
                  "
                >
                  All branches available
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* ==================================
            ATTENDANCE TABLE
        ================================== */}

        <AttendanceSheet
          rows={displayRows}
          loading={loading}
          error=""
          savingStudentId={savingStudentId}
          canManage={canManageAttendance}
          canRequestCorrection={canRequestCorrections && selectedDate < today}
          onMark={openMarkModal}
          onUndo={setUndoRow}
          onRequestCorrection={(row) => { setCorrectionRow(row); setCorrectionStatus(row.attendance?.status === "ABSENT" ? "PRESENT" : "ABSENT"); setCorrectionReason(""); setCorrectionError(""); }}
        />

        <Modal open={Boolean(correctionRow)} onClose={() => setCorrectionRow(null)} title="Request attendance correction" description="Historical attendance changes require review by another authorized administrator." footer={<><Button variant="outline" onClick={() => setCorrectionRow(null)} disabled={submittingCorrection}>Cancel</Button><Button onClick={() => void submitAttendanceCorrection()} disabled={submittingCorrection || !correctionReason.trim()}>{submittingCorrection ? "Submitting…" : "Submit request"}</Button></>}>
          {correctionRow && <div className="space-y-4"><p className="text-sm text-(--ink-muted)">{correctionRow.student.name}: currently <strong>{correctionRow.attendance?.status}</strong></p><label className="block text-xs font-semibold text-(--ink-muted)">Correct status<Select className="mt-1" value={correctionStatus} onChange={(event) => setCorrectionStatus(event.target.value as "PRESENT" | "ABSENT")}><option value="PRESENT">Present</option><option value="ABSENT">Absent</option></Select></label><label className="block text-xs font-semibold text-(--ink-muted)">Reason required<Textarea className="mt-1 min-h-28" maxLength={500} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Explain why the historical attendance should change"/></label>{correctionError && <p role="alert" className="text-sm text-(--danger)">{correctionError}</p>}</div>}
        </Modal>

        {/* ==================================
            ATTENDANCE MODAL
        ================================== */}

        <AttendanceModal
          row={selectedRow}
          status={selectedStatus}
          open={Boolean(selectedRow && selectedStatus)}
          saving={Boolean(
            selectedRow && savingStudentId === selectedRow.student._id,
          )}
          error={formError}
          canManage={canManageAttendance}
          onClose={closeMarkModal}
          onConfirm={confirmAttendance}
          sessionSlotId={selectedSessionSlotId}
          onSessionChange={setSelectedSessionSlotId}
        />

        <ConfirmationDialog
          open={Boolean(undoRow)}
          title="Undo this attendance?"
          description={
            undoRow?.attendance?.status === "ABSENT"
              ? "This removes the absence and its pending makeup recovery. Completed makeup recovery or performance evaluations must be resolved first."
              : "This removes the attendance record and recalculates the student's training progression."
          }
          confirmLabel="Undo attendance"
          cancelLabel="Keep attendance"
          confirmVariant="danger"
          loading={undoing}
          onClose={() => !undoing && setUndoRow(null)}
          onConfirm={confirmUndoAttendance}
        />

        <ConfirmationDialog
          open={confirmMarkAllOpen}
          title="Mark all students present?"
          description={`This will mark every eligible scheduled program session as Present for ${formatDate(
            selectedDate,
          )}. Sessions already marked, students who are inactive, and sessions on holidays or closed days will be skipped.`}
          confirmLabel="Mark All Present"
          cancelLabel="Cancel"
          confirmVariant="primary"
          loading={markingAll}
          onClose={() => setConfirmMarkAllOpen(false)}
          onConfirm={async () => {
            if (!canManageAttendance || markingAll) return;

            setMarkingAll(true);

            try {
              const result = await markAllAttendancePresent(
                formatLocalDateKey(selectedDate),
              );

              setConfirmMarkAllOpen(false);
              await loadSheet();

              if (result.marked === 0) {
                toast.info(
                  result.failed > 0
                    ? `No sessions were marked. ${result.failed} session(s) could not be processed; please refresh and try again.`
                    : "No sessions were marked. All eligible attendance is already completed or unavailable for this date.",
                );
              } else {
                toast.success(
                  `${result.marked} ${result.marked === 1 ? "program session" : "program sessions"} marked Present. ${result.skipped} ${result.skipped === 1 ? "session" : "sessions"} skipped.${
                    result.failed > 0
                      ? ` ${result.failed} could not be marked because of an error.`
                      : ""
                  }`,
                );
              }
            } catch (err) {
              toast.error(
                err instanceof Error
                  ? err.message
                  : "Failed to mark all eligible students present.",
              );
            } finally {
              setMarkingAll(false);
            }
          }}
        />
      </div>
    </main>
  );
}

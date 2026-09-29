"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CalendarDays, RefreshCw } from "lucide-react";

import { Button, Card, ErrorState, PageHeader } from "@/components/ui";

import AttendanceStats from "@/components/attendance/AttendanceStats";
import AttendanceSheet from "@/components/attendance/AttendanceSheet";
import AttendanceModal from "@/components/attendance/AttendanceModal";

import type { DailyAttendanceRow } from "@/components/attendance/AttendanceRow";

import { getAttendanceDailySheet, markAttendance } from "@/lib/attendanceApi";

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

  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);

  const [formError, setFormError] = useState("");

  /* ==========================================
     LOAD ATTENDANCE SHEET
  ========================================== */

  const loadSheet = useCallback(async () => {
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
  }, [selectedDate]);

  useEffect(() => {
    loadSheet();
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
      setError("Attendance can only be marked for today or previous dates.");

      return;
    }

    setError("");
    setSelectedDate(value);
  }

  /* ==========================================
     OPEN MARK MODAL
  ========================================== */

  function openMarkModal(
    row: DailyAttendanceRow,
    status: "PRESENT" | "ABSENT",
  ) {
    /*
     * Already marked:
     * no changes from this sheet.
     */

    if (row.attendance) {
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
     *
     * This prevents the user from
     * reaching the backend error:
     *
     * "Monday is closed for this branch..."
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
    setFormError("");
  }

  /* ==========================================
     CONFIRM ATTENDANCE
  ========================================== */

  async function confirmAttendance() {
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
     *
     * This prevents accidental values such as:
     *
     * 2026-09-29T00:00:00.000Z
     * Tue Sep 29 2026
     * 29/09/2026
     *
     * from reaching the API.
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
       *
       * Show that response inside the
       * modal rather than crashing the
       * page.
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
          apiError.data?.branchSchedule?.isOpen === false
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

      setFormError(
        err instanceof Error ? err.message : "Failed to mark attendance.",
      );
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
   *
   * This is mainly useful for the
   * date-level notice.
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
            <Button
              type="button"
              variant="outline"
              onClick={loadSheet}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
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
            DATE SELECTOR
        ================================== */}

        <Card padding="md">
          <div
            className="
              flex flex-col gap-5
              xl:flex-row
              xl:items-center
              xl:justify-between
            "
          >
            {/* LEFT */}

            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="
                    flex h-8 w-8
                    items-center justify-center
                    rounded-lg
                    bg-(--accent-soft)
                    text-(--accent)
                  "
                >
                  <CalendarDays size={16} />
                </div>

                <p
                  className="
                    text-sm font-extrabold
                    text-(--foreground)
                  "
                >
                  Attendance Date
                </p>
              </div>

              <p
                className="
                  text-sm font-bold
                  text-(--foreground-soft)
                "
              >
                {formatDate(selectedDate)}
              </p>

              <p
                className="
                  mt-1 text-xs
                  text-(--ink-muted)
                "
              >
                You can mark attendance for today or any previous date.
              </p>
            </div>

            {/* DATE INPUT */}

            <label className="relative block w-full xl:w-auto">
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
                  xl:w-auto
                "
              />
            </label>
          </div>
        </Card>

        {/* ==================================
            DATE-LEVEL SCHEDULE NOTICE
        ================================== */}

        {!loading && closedBranches.length > 0 && (
          <div
            className="
                mt-5
                rounded-2xl
                border
                border-(--line)
                bg-(--surface)
                px-5 py-4
              "
          >
            <div className="flex items-start gap-3">
              <div
                className="
                    flex h-9 w-9
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
                      text-sm font-extrabold
                      text-(--foreground)
                    "
                >
                  Training availability
                </p>

                <p
                  className="
                      mt-1 text-xs leading-5
                      text-(--ink-muted)
                    "
                >
                  Some branches are closed on {formatDate(selectedDate)}.
                  Attendance cannot be marked for those branches.
                </p>

                <div
                  className="
                      mt-3 flex flex-wrap
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
                            px-3 py-1.5
                            text-[11px]
                            font-bold
                            text-(--ink-muted)
                          "
                    >
                      {branchName} · Closed
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================
            SUMMARY
        ================================== */}

        <AttendanceStats {...stats} />

        {/* ==================================
            ATTENDANCE TABLE
        ================================== */}

        <AttendanceSheet
          rows={displayRows}
          loading={loading}
          error=""
          savingStudentId={savingStudentId}
          onMark={openMarkModal}
        />

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
          onClose={closeMarkModal}
          onConfirm={confirmAttendance}
        />
      </div>
    </main>
  );
}

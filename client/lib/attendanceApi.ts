import { fetchWithSession } from "@/lib/sessionFetch";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/* ==========================================
   AUTH
========================================== */


/* ==========================================
   DATE HELPERS
========================================== */

/**
 * Attendance uses calendar dates, not timestamps.
 *
 * The backend expects:
 *
 * YYYY-MM-DD
 *
 * This helper accepts a canonical date and
 * also safely extracts the calendar portion
 * if an ISO timestamp accidentally reaches
 * this layer.
 */
function normalizeAttendanceDate(value: string): string {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    throw new Error("Attendance date is required.");
  }

  /*
   * Already in YYYY-MM-DD format.
   */
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    /*
     * Validate that the date is a real
     * calendar date.
     */
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return trimmed;
    }

    throw new Error("Attendance date is invalid.");
  }

  /*
   * Handle an ISO timestamp such as:
   *
   * 2026-09-29T00:00:00.000Z
   *
   * without converting it through the
   * browser's timezone.
   */
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);

    const month = Number(isoMatch[2]);

    const day = Number(isoMatch[3]);

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0",
      )}`;
    }
  }

  throw new Error("Attendance date must be in YYYY-MM-DD format.");
}

/* ==========================================
   STUDENT TYPES
========================================== */

export type AttendanceStudentBranch = {
  _id: string;
  name: string;
};

export type AttendanceStudentPlan = {
  _id: string;
  name: string;
};

export type AttendanceStudent = {
  _id: string;
  name: string;
  age?: number;
  phone?: string;
  currentBelt?: string;
  joinDate?: string | Date;
  branch?: AttendanceStudentBranch | null;
  plan?: AttendanceStudentPlan | null;
  [key: string]: unknown;
};

/* ==========================================
   ATTENDANCE RECORD
========================================== */

export type AttendanceRecord = {
  _id?: string;

  student?: string | AttendanceStudent;

  studentId?: string;

  date?: string;

  status?: "PRESENT" | "ABSENT" | "HOLIDAY" | "PENDING" | "NOT_MARKED" | string;

  attendanceType?: "REGULAR" | "MAKEUP";

  planDay?: number;

  trainingDay?: number;

  makeupRequired?: boolean;

  makeupScheduled?: boolean;

  makeupDate?: string | null;

  curriculumTitle?: string;

  [key: string]: unknown;
};

/* ==========================================
   CURRICULUM
========================================== */

export type AttendanceCurriculum = {
  _id?: string;

  title?: string;

  name?: string;

  description?: string;

  day?: number;

  trainingDay?: number;

  planDay?: number;

  [key: string]: unknown;
};

/* ==========================================
   BRANCH SCHEDULE
========================================== */

export type AttendanceBranchSchedule = {
  configured: boolean;

  isOpen: boolean;

  isClosed: boolean;

  dayOfWeek: number | null;

  dayName: string | null;

  slots: {
    _id?: string;

    sessionName?: string;

    startTime: string;

    endTime: string;

    isActive?: boolean;
  }[];

  openingTime: string | null;

  closingTime: string | null;
};

/* ==========================================
   DAILY ATTENDANCE ROW
========================================== */

export type AttendanceDailyRow = {
  _id?: string;

  /**
   * The attendance page expects a
   * populated student object.
   */
  student: AttendanceStudent;

  studentId?: string;

  name?: string;

  fullName?: string;

  date?: string;

  planDay?: number;

  curriculumTitle?: string;

  trainingDay?: number;

  status?: "PRESENT" | "ABSENT" | "HOLIDAY" | "PENDING" | "NOT_MARKED" | string;

  makeupRequired?: boolean;

  makeupScheduled?: boolean;

  makeupDate?: string | null;

  holiday?: {
    _id?: string;

    name?: string;

    description?: string;

    date?: string;
  } | null;

  branch?: string;

  branchId?: string;

  branchName?: string;

  attendance: AttendanceRecord | null;

  curriculum: AttendanceCurriculum | null;

  [key: string]: unknown;
};

/* ==========================================
   COMMON API RESPONSE
========================================== */

export type AttendanceApiResponse = {
  success?: boolean;

  message?: string;

  code?: string;

  [key: string]: unknown;
};

/* ==========================================
   DAILY SHEET RESPONSE
========================================== */

export type AttendanceDailySheetResponse = AttendanceApiResponse & {
  rows: AttendanceDailyRow[];

  holiday?: {
    _id?: string;

    name?: string;

    description?: string;

    date?: string;
  } | null;

  branchSchedule?: AttendanceBranchSchedule | null;
};

/* ==========================================
   API ERROR DATA
========================================== */

export type AttendanceApiErrorData = {
  success?: boolean;

  message?: string;

  code?: string;

  holiday?: {
    _id?: string;

    name?: string;

    description?: string;

    date?: string;
  } | null;

  branchSchedule?: AttendanceBranchSchedule | null;

  [key: string]: unknown;
};

/* ==========================================
   API ERROR
========================================== */

export class AttendanceApiError extends Error {
  status: number;

  data: AttendanceApiErrorData;

  constructor(
    message: string,
    status: number,
    data: AttendanceApiErrorData = {},
  ) {
    super(message);

    this.name = "AttendanceApiError";

    this.status = status;

    this.data = data;
  }
}

/* ==========================================
   RESPONSE PARSER
========================================== */

async function parseResponse<
  T extends AttendanceApiResponse = AttendanceApiResponse,
>(response: Response): Promise<T> {
  const text = await response.text();

  let data: Record<string, unknown> = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new AttendanceApiError(
      `API returned an invalid response (${response.status}).`,
      response.status,
    );
  }

  if (!response.ok) {
    throw new AttendanceApiError(
      typeof data.message === "string"
        ? data.message
        : "Attendance request failed.",
      response.status,
      data as AttendanceApiErrorData,
    );
  }

  return data as T;
}

/* ==========================================
   GET DAILY ATTENDANCE SHEET
========================================== */

export async function getAttendanceDailySheet(
  date: string,
): Promise<AttendanceDailySheetResponse> {
  /*
   * Normalize the date before sending it
   * to the daily-sheet endpoint as well.
   */
  const normalizedDate = normalizeAttendanceDate(date);

  const response = await fetchWithSession(
    `${API_URL}/attendance/daily-sheet?date=${encodeURIComponent(
      normalizedDate,
    )}`,
    {
      method: "GET",

      headers: {
        "Content-Type": "application/json",
      },

      cache: "no-store",
    },
  );

  const data = await parseResponse<AttendanceDailySheetResponse>(response);

  return {
    ...data,

    rows: Array.isArray(data.rows) ? data.rows : [],
  };
}

/* ==========================================
   MARK ATTENDANCE
========================================== */

export type MarkAttendancePayload = {
  student: string;
  sessionSlotId?: string;

  date: string;

  planDay: number;

  curriculumTitle: string;

  status: "PRESENT" | "ABSENT";

  makeupRequired: boolean;
};

export type MarkAttendanceResponse = AttendanceApiResponse & {
  attendance?: AttendanceRecord;

  makeup?: { _id?: string; status?: string; planDay?: number; curriculumTitle?: string } | null;

  progression?: { consumedDay: number; nextDay: number | null };

  row?: AttendanceDailyRow;

  data?: unknown;
};

export type MarkAllAttendanceResponse = AttendanceApiResponse & {
  marked: number;
  skipped: number;
  failed: number;
};

/**
 * Mark attendance for a student.
 *
 * The date is always normalized to:
 *
 * YYYY-MM-DD
 *
 * before the request is sent.
 */
export async function markAttendance(
  data: MarkAttendancePayload,
): Promise<MarkAttendanceResponse> {
  const normalizedDate = normalizeAttendanceDate(data.date);

  const payload: MarkAttendancePayload = {
    ...data,

    date: normalizedDate,
  };

  const response = await fetchWithSession(`${API_URL}/attendance`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(payload),
  });

  return parseResponse<MarkAttendanceResponse>(response);
}

export async function markAllAttendancePresent(
  date: string,
): Promise<MarkAllAttendanceResponse> {
  const normalizedDate = normalizeAttendanceDate(date);

  const response = await fetchWithSession(`${API_URL}/attendance/bulk-present`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date: normalizedDate }),
  });

  return parseResponse<MarkAllAttendanceResponse>(response);
}

export async function undoAttendance(attendanceId: string): Promise<AttendanceApiResponse> {
  const response = await fetchWithSession(`${API_URL}/attendance/${encodeURIComponent(attendanceId)}/undo`, {
    method: "POST",
  });
  return parseResponse<AttendanceApiResponse>(response);
}

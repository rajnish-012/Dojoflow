import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

/* =========================================================
   TYPES
========================================================= */

export interface TrainingSlot {
  _id?: string;
  sessionName: string;
  sessionTypeId?: string;
  sessionType?: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface WeeklyScheduleDay {
  dayOfWeek: number;
  isClosed: boolean;
  slots: TrainingSlot[];
}

export interface BranchSchedule {
  _id?: string;
  branch: string;
  openingTime: string;
  closingTime: string;
  weeklySchedule: WeeklyScheduleDay[];
  updatedBy?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BranchRecord {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}

export interface BranchScheduleListItem {
  branch: BranchRecord;
  schedule: BranchSchedule | null;
  hasSchedule: boolean;
}

export interface BranchSchedulesResponse {
  success: boolean;
  count: number;
  branches: BranchScheduleListItem[];
}

export interface BranchScheduleResponse {
  success: boolean;
  branch: BranchRecord;
  schedule: BranchSchedule;
}

export interface BranchCalendarHoliday {
  _id: string;
  name: string;
  description?: string;
  branch?: string | {
    _id: string;
    name: string;
  } | null;
}

export interface BranchCalendarDay {
  date: string;
  dayOfWeek: number;
  dayName: string;

  isHoliday: boolean;
  holiday: BranchCalendarHoliday | null;

  scheduleConfigured: boolean;

  isClosed: boolean;
  isTrainingDay: boolean;

  slots: TrainingSlot[];

  openingTime: string | null;
  closingTime: string | null;

  reason:
    | "HOLIDAY"
    | "NO_SCHEDULE_CONFIGURED"
    | "NO_DAY_SCHEDULE"
    | "BRANCH_CLOSED"
    | "NO_ACTIVE_SLOTS"
    | "TRAINING_AVAILABLE";
}

export interface BranchCalendarSummary {
  totalDays: number;
  availableDays: number;
  holidayDays: number;
  closedDays: number;
  noTrainingDays: number;
  noScheduleDays: number;
}

export interface BranchMonthCalendarResponse {
  success: boolean;
  branch: BranchRecord;
  calendar: {
    year: number;
    month: number;
    monthName: string;
    daysInMonth: number;
  };
  summary: BranchCalendarSummary;
  days: BranchCalendarDay[];
}

export interface SaveBranchSchedulePayload {
  openingTime: string;
  closingTime: string;
  weeklySchedule: WeeklyScheduleDay[];
}

/* =========================================================
   REQUEST HELPER
========================================================= */

async function branchScheduleRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {},
) {
  if (typeof window === "undefined") {
    throw new Error("This request must run in the browser.");
  }
  const response = await fetchWithSession(`${API_URL}/branch-schedules${path}`, {
    method: options.method || "GET",

    headers: {
      "Content-Type": "application/json",
    },

    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),

    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.href = "/login";

    throw new Error("Authentication required.");
  }

  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "Branch schedule request failed.",
    );
  }

  return data;
}

/* =========================================================
   GET ALL BRANCH SCHEDULES
========================================================= */

export async function getBranchSchedules(): Promise<BranchSchedulesResponse> {
  return branchScheduleRequest("");
}

/* =========================================================
   GET ONE BRANCH SCHEDULE
========================================================= */

export async function getBranchSchedule(
  branchId: string,
): Promise<BranchScheduleResponse> {
  if (!branchId) {
    throw new Error("Branch ID is required.");
  }

  return branchScheduleRequest(`/${branchId}`);
}

/* =========================================================
   CREATE / UPDATE BRANCH SCHEDULE
========================================================= */

export async function upsertBranchSchedule(
  branchId: string,
  payload: SaveBranchSchedulePayload,
): Promise<BranchScheduleResponse & { message?: string }> {
  if (!branchId) {
    throw new Error("Branch ID is required.");
  }

  return branchScheduleRequest(`/${branchId}`, {
    method: "PUT",
    body: payload,
  });
}

/* =========================================================
   RESET / DELETE BRANCH SCHEDULE
========================================================= */

export async function deleteBranchSchedule(branchId: string) {
  if (!branchId) {
    throw new Error("Branch ID is required.");
  }

  return branchScheduleRequest(`/${branchId}`, {
    method: "DELETE",
  });
}

/* =========================================================
   MONTHLY AVAILABILITY
========================================================= */

export async function getBranchMonthCalendar(
  branchId: string,
  year: number,
  month: number,
): Promise<BranchMonthCalendarResponse> {
  if (!branchId) {
    throw new Error("Branch ID is required.");
  }

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    throw new Error("Invalid calendar year.");
  }

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Invalid calendar month.");
  }

  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });

  return branchScheduleRequest(
    `/${branchId}/calendar?${params.toString()}`,
  );
}

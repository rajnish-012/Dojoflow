const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

/* ======================================================
   TYPES
====================================================== */

export type MakeupStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

export interface MakeupStudent {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  age?: number;
  currentBelt?: string;
  status?: string;
}

export interface MakeupBranch {
  _id: string;
  name: string;
  address?: string;
}

export interface MakeupAttendance {
  _id: string;
  date: string;
  planDay: number;
  curriculumTitle?: string;
  status:
    | "PRESENT"
    | "ABSENT"
    | "LATE";
  makeupRequired: boolean;
  makeupCompleted: boolean;
}

export interface MakeupHoliday {
  _id: string;
  name: string;
  description?: string;
  date: string;
}

export interface MakeupUser {
  _id: string;
  name: string;
  email: string;
}

export interface Makeup {
  _id: string;

  student:
    | string
    | MakeupStudent;

  branch:
    | string
    | MakeupBranch;

  originalAttendance:
    | string
    | MakeupAttendance;

  planDay: number;

  originalDate: string;

  makeupDate: string | null;

  status: MakeupStatus;

  curriculumTitle?: string;

  notes?: string;

  markedBy?: MakeupUser | null;

  completedBy?: MakeupUser | null;

  completedAt?: string | null;

  createdAt?: string;

  updatedAt?: string;

  holiday?: MakeupHoliday | null;

  isHoliday?: boolean;
}

/* ======================================================
   BRANCH SCHEDULE TYPES
====================================================== */

export interface BranchScheduleSlot {
  _id?: string;
  sessionName: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

export interface BranchScheduleDay {
  dayOfWeek: number;
  isClosed: boolean;
  slots: BranchScheduleSlot[];
}

export interface BranchSchedule {
  _id?: string;

  branch:
    | string
    | {
        _id: string;
        name?: string;
      };

  openingTime: string;

  closingTime: string;

  weeklySchedule: BranchScheduleDay[];

  updatedBy?: MakeupUser | null;

  createdAt?: string | null;

  updatedAt?: string | null;
}

export interface BranchScheduleBranch {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}

export interface BranchScheduleResponse {
  success: boolean;
  branch: BranchScheduleBranch;
  schedule: BranchSchedule;
}

/* ======================================================
   DATE AVAILABILITY TYPES
====================================================== */

export interface MakeupDateAvailability {
  date: string;

  dayOfWeek: number;

  dayName: string;

  configured: boolean;

  isOpen: boolean;

  isClosed: boolean;

  openingTime: string | null;

  closingTime: string | null;

  slots: BranchScheduleSlot[];

  holiday?: MakeupHoliday | null;
}

export interface CreateMakeupPayload {
  student: string;

  originalAttendance: string;

  makeupDate: string;

  notes?: string;
}

export interface ScheduleMakeupPayload {
  makeupDate: string;

  notes?: string;
}

export interface GetMakeupsParams {
  status?: MakeupStatus;

  student?: string;

  fromDate?: string;

  toDate?: string;
}

/* ======================================================
   HELPERS
====================================================== */

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem("token") || "";
}

async function parseResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : fallbackMessage;

    throw new Error(message);
  }

  return data as T;
}

function getHeaders() {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/* ======================================================
   GET MAKEUPS
====================================================== */

export async function getMakeups(
  params?: GetMakeupsParams,
): Promise<{
  success: boolean;
  count: number;
  makeups: Makeup[];
}> {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.set(
      "status",
      params.status,
    );
  }

  if (params?.student) {
    searchParams.set(
      "student",
      params.student,
    );
  }

  if (params?.fromDate) {
    searchParams.set(
      "fromDate",
      params.fromDate,
    );
  }

  if (params?.toDate) {
    searchParams.set(
      "toDate",
      params.toDate,
    );
  }

  const query =
    searchParams.toString();

  const response = await fetch(
    `${API_URL}/makeups${
      query ? `?${query}` : ""
    }`,
    {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    },
  );

  return parseResponse(
    response,
    "Failed to fetch makeup classes",
  );
}

/* ======================================================
   GET ONE MAKEUP
====================================================== */

export async function getMakeupById(
  id: string,
): Promise<{
  success: boolean;
  makeup: Makeup;
}> {
  const response = await fetch(
    `${API_URL}/makeups/${id}`,
    {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    },
  );

  return parseResponse(
    response,
    "Failed to fetch makeup class",
  );
}

/* ======================================================
   CREATE MAKEUP
====================================================== */

export async function createMakeup(
  payload: CreateMakeupPayload,
): Promise<{
  success: boolean;
  makeup: Makeup;
}> {
  const response = await fetch(
    `${API_URL}/makeups`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    },
  );

  return parseResponse(
    response,
    "Failed to schedule makeup class",
  );
}

/* ======================================================
   SCHEDULE MAKEUP
====================================================== */

export async function scheduleMakeup(
  id: string,
  payload: ScheduleMakeupPayload,
): Promise<{
  success: boolean;
  makeup: Makeup;
}> {
  const response = await fetch(
    `${API_URL}/makeups/${id}/schedule`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    },
  );

  return parseResponse(
    response,
    "Failed to schedule makeup class",
  );
}

/* ======================================================
   COMPLETE MAKEUP
====================================================== */

export async function completeMakeup(
  id: string,
): Promise<{
  success: boolean;
  makeup: Makeup;
}> {
  const response = await fetch(
    `${API_URL}/makeups/${id}/complete`,
    {
      method: "PUT",
      headers: getHeaders(),
    },
  );

  return parseResponse(
    response,
    "Failed to complete makeup class",
  );
}

/* ======================================================
   CANCEL MAKEUP
====================================================== */

export async function cancelMakeup(
  id: string,
): Promise<{
  success: boolean;
  makeup: Makeup;
}> {
  const response = await fetch(
    `${API_URL}/makeups/${id}/cancel`,
    {
      method: "PUT",
      headers: getHeaders(),
    },
  );

  return parseResponse(
    response,
    "Failed to cancel makeup class",
  );
}

/* ======================================================
   GET BRANCH SCHEDULE
====================================================== */

export async function getBranchSchedule(
  branchId: string,
): Promise<BranchScheduleResponse> {
  if (!branchId) {
    throw new Error(
      "Branch is required to load the training schedule.",
    );
  }

  const response = await fetch(
    `${API_URL}/branch-schedules/${branchId}`,
    {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    },
  );

  return parseResponse(
    response,
    "Failed to fetch branch training schedule.",
  );
}

/* ======================================================
   RESOLVE WEEKLY SCHEDULE FOR A DATE
====================================================== */

export function getScheduleForDate(
  schedule: BranchSchedule,
  date: string,
): MakeupDateAvailability {
  const selectedDate =
    new Date(`${date}T00:00:00`);

  if (
    Number.isNaN(
      selectedDate.getTime(),
    )
  ) {
    return {
      date,
      dayOfWeek: -1,
      dayName: "Invalid date",
      configured: true,
      isOpen: false,
      isClosed: true,
      openingTime:
        schedule.openingTime || null,
      closingTime:
        schedule.closingTime || null,
      slots: [],
    };
  }

  const dayOfWeek =
    selectedDate.getDay();

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const dayName =
    dayNames[dayOfWeek];

  const daySchedule =
    Array.isArray(
      schedule.weeklySchedule,
    )
      ? schedule.weeklySchedule.find(
          (day) =>
            Number(day.dayOfWeek) ===
            dayOfWeek,
        )
      : null;

  /*
   * Missing weekly day is treated as closed.
   */
  if (!daySchedule) {
    return {
      date,
      dayOfWeek,
      dayName,
      configured: true,
      isOpen: false,
      isClosed: true,
      openingTime:
        schedule.openingTime || null,
      closingTime:
        schedule.closingTime || null,
      slots: [],
    };
  }

  const activeSlots =
    Array.isArray(daySchedule.slots)
      ? daySchedule.slots.filter(
          (slot) =>
            slot &&
            slot.isActive !== false &&
            Boolean(slot.startTime) &&
            Boolean(slot.endTime),
        )
      : [];

  const isClosed =
    daySchedule.isClosed === true;

  const isOpen =
    !isClosed &&
    activeSlots.length > 0;

  return {
    date,
    dayOfWeek,
    dayName,
    configured: true,
    isOpen,
    isClosed: !isOpen,
    openingTime:
      schedule.openingTime || null,
    closingTime:
      schedule.closingTime || null,
    slots: activeSlots,
  };
}
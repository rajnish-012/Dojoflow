import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

export type CalendarEventType =
  | "CLASS"
  | "HOLIDAY"
  | "MAKEUP"
  | "TRIAL"
  | "GRADING"
  | "PROMOTION"
  | "ACADEMY_EVENT"
  | "COACH_LEAVE"
  | "ANNOUNCEMENT";

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  source: string;
  sourceId: string;
  title: string;
  description: string;
  start: { date: string; time: string };
  end: { date: string; time: string };
  branch: { id: string; name: string } | null;
  program: { id: string; name: string } | null;
  coach: { id: string; name: string } | null;
  status: string;
  capacity: number | null;
  location?: string;
  metadata: Record<string, unknown>;
  actionUrl: string;
};

export type CalendarBranch = { id: string; name: string };

export type CalendarConflict = {
  severity: "BLOCKING" | "WARNING" | "INFORMATION";
  type: "COACH" | "LOCATION" | "BRANCH" | "CAPACITY";
  message: string;
  source: string;
  sourceId: string;
};

export type AcademyEventInput = {
  name: string;
  description?: string;
  category: "TOURNAMENT" | "SEMINAR" | "WORKSHOP" | "COMPETITION" | "ACADEMY_EVENT";
  branch: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  program?: string;
  coach?: string;
  capacity?: number | null;
  location?: string;
  registrationRequired: boolean;
  registrationDeadline?: string;
  status: "DRAFT" | "SCHEDULED" | "OPEN";
  confirmConflicts?: boolean;
};

export type AcademyEventDetail = {
  _id: string;
  name: string;
  description: string;
  category: AcademyEventInput["category"];
  branch: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  program: string | null;
  coach: string | null;
  capacity: number | null;
  location: string;
  registrationRequired: boolean;
  registrationDeadline: string | null;
  status: string;
};

export class CalendarRequestError extends Error {
  conflicts: CalendarConflict[];
  requiresConfirmation: boolean;

  constructor(message: string, details: { conflicts?: CalendarConflict[]; requiresConfirmation?: boolean } = {}) {
    super(message);
    this.name = "CalendarRequestError";
    this.conflicts = Array.isArray(details.conflicts) ? details.conflicts : [];
    this.requiresConfirmation = details.requiresConfirmation === true;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const response = await fetchWithSession(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new CalendarRequestError(
      typeof data?.message === "string" ? data.message : "Calendar request failed.",
      data,
    );
  }
  return data;
}

export async function getCalendar(params: {
  start: string;
  end: string;
  branch?: string;
  types?: string;
  program?: string;
  coach?: string;
}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const data = await request(`/calendar?${query.toString()}`);
  return {
    branches: Array.isArray(data.branches) ? data.branches as CalendarBranch[] : [],
    events: Array.isArray(data.events) ? data.events as CalendarEvent[] : [],
  };
}

export async function getMyCalendar() {
  const data = await request("/calendar/me");
  return Array.isArray(data.events) ? data.events as CalendarEvent[] : [];
}

export async function updateTrainingSessionStatus(id: string, status: "CLOSED" | "SCHEDULED", reason = "", occurrence?: { branchId: string; date: string; slotId: string; batchId: string }) {
  return request(`/branch-schedules/sessions/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status, reason, occurrence }) });
}

export async function previewAcademyEventConflicts(input: AcademyEventInput, excludeId?: string) {
  const data = await request("/academy-events/validate", {
    method: "POST",
    body: JSON.stringify({ ...input, excludeId }),
  });
  return {
    conflicts: Array.isArray(data.conflicts) ? data.conflicts as CalendarConflict[] : [],
    blocking: Array.isArray(data.blocking) ? data.blocking as CalendarConflict[] : [],
    warnings: Array.isArray(data.warnings) ? data.warnings as CalendarConflict[] : [],
  };
}

export async function createAcademyEvent(input: AcademyEventInput) {
  return request("/academy-events", { method: "POST", body: JSON.stringify(input) });
}

export async function updateAcademyEvent(id: string, input: AcademyEventInput) {
  return request(`/academy-events/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function getAcademyEvent(id: string) {
  return request(`/academy-events/${id}`) as Promise<{ event: AcademyEventDetail; registrations: Array<{ _id: string; student?: { _id: string; name: string; currentBelt?: string }; status: string; result?: string }> }>;
}

export async function cancelAcademyEvent(id: string) {
  return request(`/academy-events/${id}/cancel`, { method: "POST" });
}

export async function completeAcademyEvent(id: string) {
  return request(`/academy-events/${id}/complete`, { method: "POST" });
}

export async function registerStudentForAcademyEvent(id: string, student: string) {
  return request(`/academy-events/${id}/registrations`, { method: "POST", body: JSON.stringify({ student }) });
}

export async function updateAcademyEventRegistration(id: string, registrationId: string, status: string, result = "") {
  return request(`/academy-events/${id}/registrations/${registrationId}`, { method: "PATCH", body: JSON.stringify({ status, result }) });
}

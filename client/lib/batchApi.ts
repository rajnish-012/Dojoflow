import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

export type BatchRecord = {
  _id: string;
  name: string;
  code: string;
  branch: string | { _id: string; name?: string };
  plan: string | { _id: string; name?: string; classesPerWeek?: number; isActive?: boolean; programs?: { program: string | { _id: string; name?: string } }[] };
  capacity: number;
  occupiedSeats?: number;
  availableSeats?: number;
  coach?: string | { _id: string; name?: string; isActive?: boolean; branch?: string | { _id: string } } | null;
  room?: string;
  roomId?: string | { _id: string; name?: string; isActive?: boolean } | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "INACTIVE";
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  startDate?: string | null;
  calculatedEndDate?: string | null;
  capacityIssue?: string;
  configuredSessions?: number;
  requiredSessions?: number;
  weeklySessions?: { _id: string; dayOfWeek: number; dayClosed: boolean; name: string; startTime: string; endTime: string; active: boolean; program: string; room: string; coach: string | null }[];
};

async function request(path: string, init: RequestInit = {}) {
  const response = await fetchWithSession(`${API_URL}/batches${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Batch request failed.");
  return data;
}

export async function getBatches(branch?: string) {
  const query = branch ? `?branch=${encodeURIComponent(branch)}` : "";
  const data = await request(query);
  return (Array.isArray(data.batches) ? data.batches : []) as BatchRecord[];
}

export async function getBatchCoaches(branch: string) {
  if (!branch) return [] as { _id: string; name: string }[];
  const data = await request(`/coaches?branch=${encodeURIComponent(branch)}`);
  return (Array.isArray(data.coaches) ? data.coaches : []) as { _id: string; name: string }[];
}

export async function createBatch(input: {
  name: string; code: string; plan: string; branch: string; capacity: number;
  room?: string; roomId?: string; coach?: string; startDate: string; effectiveFrom?: string; effectiveUntil?: string;
}) {
  return request("", { method: "POST", body: JSON.stringify(input) });
}

export async function updateBatch(id: string, input: Partial<Pick<BatchRecord, "name" | "code" | "capacity" | "room" | "roomId" | "coach" | "status" | "effectiveFrom" | "effectiveUntil" | "startDate">>) {
  return request(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

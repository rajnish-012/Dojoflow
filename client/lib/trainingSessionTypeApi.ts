import { fetchWithSession } from "@/lib/sessionFetch";
export interface TrainingSessionTypeRecord {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  isActive: boolean;
  displayOrder: number;
  sessionsCount?: number;
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

async function request(path = "", options: { method?: string; body?: unknown } = {}) {
  const response = await fetchWithSession(`${API_URL}/training-session-types${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "Training session type request failed.");
  return data;
}

export async function getTrainingSessionTypes(): Promise<TrainingSessionTypeRecord[]> {
  const data = await request(); return Array.isArray(data.types) ? data.types : [];
}
export async function getPublicTrainingSessionTypes(): Promise<TrainingSessionTypeRecord[]> {
  const data = await request("/public"); return Array.isArray(data.types) ? data.types : [];
}
export async function createTrainingSessionType(payload: Partial<TrainingSessionTypeRecord>) { return request("", { method: "POST", body: payload }); }
export async function updateTrainingSessionType(id: string, payload: Partial<TrainingSessionTypeRecord>) { return request(`/${id}`, { method: "PUT", body: payload }); }
export async function deleteTrainingSessionType(id: string) { return request(`/${id}`, { method: "DELETE" }); }

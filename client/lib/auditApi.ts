import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
export type AuditRecord = {
  _id: string; action: string; entityType: string; entityId: string | null;
  actorName?: string; actor?: { _id: string; name?: string; email?: string } | null;
  branch?: { _id: string; name?: string } | null; branchId?: string;
  before?: unknown; after?: unknown; metadata?: unknown; ipAddress?: string;
  userAgent?: string; createdAt: string;
};
export type AuditQuery = { page: number; pageSize: number; from?: string; to?: string; actor?: string; action?: string; entityType?: string; branchId?: string; search?: string; sort?: "createdAt-desc" | "createdAt-asc" };
export type AuditPage = { records: AuditRecord[]; page: number; pageSize: number; totalItems: number; totalPages: number; timeZone?: string };

async function auditRequest(path: string) {
  const response = await fetchWithSession(`${API_URL}/audit-logs${path}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to load audit records.");
  return data;
}
export async function getAuditLogs(query: AuditQuery): Promise<AuditPage> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  const data = await auditRequest(`?${params.toString()}`);
  return { records: Array.isArray(data.records) ? data.records : [], page: data.page || 1, pageSize: data.pageSize || query.pageSize, totalItems: data.totalItems || 0, totalPages: data.totalPages || 1, timeZone: data.timeZone || "Asia/Kolkata" };
}
export async function getAuditLog(id: string): Promise<AuditRecord> {
  const data = await auditRequest(`/${encodeURIComponent(id)}`);
  return data.record;
}

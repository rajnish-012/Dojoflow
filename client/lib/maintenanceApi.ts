import { fetchWithSession } from "@/lib/sessionFetch";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
async function request(path: string, options: RequestInit = {}) {
  const response = await fetchWithSession(`${API_URL}/maintenance${path}`, { ...options, headers: { "Content-Type": "application/json", ...options.headers }, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Maintenance request failed.");
  return data;
}
export const getMaintenanceState = () => request("/settings");
export const getSystemHealth = () => request("/health");
export const updateMaintenanceState = (payload: { enabled: boolean; message: string; endsAt?: string | null }) => request("/settings", { method: "PUT", body: JSON.stringify(payload) });

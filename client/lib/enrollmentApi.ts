import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

export type MembershipStatus = "NEW" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "RENEWED" | "COMPLETED" | "CANCELLED" | "PAUSED";
export type Enrollment = {
  _id: string;
  student: { _id: string; name: string; phone?: string; email?: string; branch?: { _id: string; name: string } | string };
  plan?: { _id: string; name: string } | string;
  planName: string;
  branch?: { _id: string; name: string } | string;
  branchName: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  lifecycleStatus: MembershipStatus;
  daysRemaining: number | null;
  enrollmentSource?: string;
  createdBy?: string;
};
export type MembershipDashboard = {
  metrics: { active: number; expiringThisWeek: number; expiringThisMonth: number; expired: number; renewed: number; renewalRate: number; renewalRevenue: number | null };
  memberships: Enrollment[];
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithSession(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init.headers }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Membership request failed");
  return data as T;
}

export const getMembershipDashboard = () => request<{ success: boolean } & MembershipDashboard>("/enrollments/dashboard");
export const getEnrollmentHistory = (studentId: string) => request<{ success: boolean; enrollments: Enrollment[] }>(`/enrollments/students/${studentId}`);
export const createEnrollment = (studentId: string, payload: { plan: string; branch?: string; startDate: string; createInvoice: boolean }) => request<{ success: boolean; enrollment: Enrollment; invoice?: unknown; invoiceError?: string }>(`/enrollments/students/${studentId}`, { method: "POST", body: JSON.stringify(payload) });
export const renewEnrollment = (studentId: string, payload: { plan: string; branch?: string; startDate: string; createInvoice: boolean }) => request<{ success: boolean; enrollment: Enrollment; invoice?: unknown; invoiceError?: string }>(`/enrollments/students/${studentId}/renewals`, { method: "POST", body: JSON.stringify(payload) });
export const updateEnrollmentStatus = (studentId: string, enrollmentId: string, status: string) => request(`/enrollments/students/${studentId}/${enrollmentId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });

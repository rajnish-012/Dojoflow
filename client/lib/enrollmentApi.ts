import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

export type MembershipStatus = "NEW" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "RENEWED" | "COMPLETED" | "CANCELLED" | "PAUSED";
export type EnrollmentBillingSnapshot = {
  feeTerm?: string | { _id?: string } | null;
  feeTermVersion?: number | null;
  planName?: string;
  branch?: string | null;
  branchName?: string;
  currency?: string | null;
  amount?: number;
  billingFrequency?: "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  registrationFee?: number;
  taxRate?: number;
  discountRules?: Array<{ name?: string; type?: "FIXED" | "PERCENT"; amount?: number; active?: boolean }>;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
};
export type StudentPlanEnrollment = {
  _id?: string;
  plan?: string | { _id?: string; name?: string };
  feeTerm?: string | { _id?: string } | null;
  status: string;
  program?: string | { _id?: string } | null;
  programs?: { program: string | { _id?: string }; curriculumVersion?: string | null }[];
  startDate: string;
  firstAttendedClassDate?: string | null;
  endDate?: string | null;
  renewedTo?: string | null;
  billingSnapshot?: EnrollmentBillingSnapshot | null;
};

function academyDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function findCurrentStudentEnrollment(
  enrollments: StudentPlanEnrollment[] | undefined,
  asOf = new Date(),
) {
  const today = academyDateKey(asOf);
  return [...(enrollments || [])]
    .filter((item) => {
      if (item.status !== "ACTIVE" || item.renewedTo) return false;
      if (!item.startDate || academyDateKey(item.startDate) > today) return false;
      return !item.endDate || academyDateKey(item.endDate) >= today;
    })
    .sort((a, b) => academyDateKey(b.startDate).localeCompare(academyDateKey(a.startDate)))[0] || null;
}

export function hasFrozenBillingSnapshot(
  snapshot: EnrollmentBillingSnapshot | null | undefined,
) {
  if (!snapshot) return false;
  const hasReference = (value: string | { _id?: string } | null | undefined) =>
    typeof value === "string" ? Boolean(value) : Boolean(value?._id);
  return hasReference(snapshot.feeTerm) &&
    Number.isInteger(snapshot.feeTermVersion) && Number(snapshot.feeTermVersion) > 0 &&
    Boolean(snapshot.planName?.trim()) && hasReference(snapshot.branch) &&
    typeof snapshot.amount === "number" && Number.isFinite(snapshot.amount) && snapshot.amount >= 0 &&
    ["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"].includes(snapshot.billingFrequency || "") &&
    typeof snapshot.registrationFee === "number" && Number.isFinite(snapshot.registrationFee) && snapshot.registrationFee >= 0 &&
    typeof snapshot.taxRate === "number" && Number.isFinite(snapshot.taxRate) && snapshot.taxRate >= 0 && snapshot.taxRate <= 100 &&
    Array.isArray(snapshot.discountRules) && Boolean(snapshot.effectiveFrom) &&
    Object.prototype.hasOwnProperty.call(snapshot, "effectiveUntil");
}

export type Enrollment = {
  _id: string;
  student: { _id: string; name: string; phone?: string; email?: string; branch?: { _id: string; name: string } | string };
  plan?: { _id: string; name: string } | string;
  batch?: { _id: string; name?: string; code?: string } | string | null;
  planName: string;
  branch?: { _id: string; name: string } | string;
  branchName: string;
  startDate: string;
  endDate?: string | null;
  billingSnapshot?: {
    feeTerm?: string | null;
    feeTermVersion?: number | null;
    planName?: string;
    currency?: string | null;
    billingFrequency?: "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "YEARLY";
    amount?: number;
    registrationFee?: number;
    taxRate?: number;
  };
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
export const createEnrollment = (studentId: string, payload: { plan: string; branch: string; feeTerm: string; startDate: string; createInvoice: boolean; batch?: string }) => request<{ success: boolean; enrollment: Enrollment; invoice?: unknown; invoiceError?: string }>(`/enrollments/students/${studentId}`, { method: "POST", body: JSON.stringify(payload) });
export const renewEnrollment = (studentId: string, payload: { plan: string; branch: string; feeTerm: string; startDate: string; createInvoice: boolean; batch?: string }) => request<{ success: boolean; enrollment: Enrollment; invoice?: unknown; invoiceError?: string }>(`/enrollments/students/${studentId}/renewals`, { method: "POST", body: JSON.stringify(payload) });
export const updateEnrollmentStatus = (studentId: string, enrollmentId: string, status: string) => request(`/enrollments/students/${studentId}/${enrollmentId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });

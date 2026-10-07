import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "TRIAL_SCHEDULED"
  | "TRIAL_COMPLETED"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "CONVERTED"
  | "LOST";

  
export type CrmLead = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  age?: number;
  source?: string;
  status: LeadStatus | "ENROLLED" | "CLOSED";
  branch?: { _id: string; name: string } | string | null;
  plan?: string | null;
  program?: string | null;
  programName?: string;
  planName?: string;
  message?: string;
  notes?: string;
  preferredDate?: string;
  preferredSession?: { sessionName?: string; sessionTypeName?: string; startTime?: string; endTime?: string };
  preferredWeeklySessions?: { dayName?: string; sessionName?: string; sessionTypeName?: string; startTime?: string; endTime?: string }[];
  assignedTo?: { _id: string; name: string } | null;
  nextFollowUpAt?: string | null;
  followUps?: {
    _id: string;
    note: string;
    dueAt?: string;
    createdAt: string;
  }[];
  statusHistory?: {
    from?: string;
    to: string;
    note?: string;
    changedAt: string;
  }[];
  convertedStudent?: { _id: string; name: string } | string | null;
  createdAt: string;
};
export type CrmTrial = {
  _id: string;
  lead: string;
  trialDate: string;
  startTime: string;
  endTime?: string;
  status: "SCHEDULED" | "COMPLETED" | "MISSED" | "CANCELLED" | "CONVERTED";
  attendance?: "PRESENT" | "ABSENT" | null;
  notes?: string;
  coach?: { name: string };
  program?: { name: string };
};
export type CrmSummary = {
  newLeads: number;
  trials: number;
  trialConversionRate: number;
  admissions: number;
  conversionRate: number;
  lostLeads: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
  funnel: { status: LeadStatus; count: number }[];
  monthlyAdmissions: { month: string; admissions: number }[];
  branchConversions: {
    branch: string;
    leads: number;
    conversions: number;
    conversionRate: number;
  }[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchWithSession(`${API_URL}/inquiries${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "CRM request failed.");
  return body as T;
}

export const getCrmPipeline = () =>
  request<{ leads: CrmLead[]; trials: CrmTrial[]; summary: CrmSummary }>(
    "/pipeline",
  );
export const createCrmLead = (values: {
  name: string;
  phone: string;
  email?: string;
  source?: string;
  branch?: string;
  notes?: string;
}) =>
  request<{ lead: CrmLead }>("/leads", {
    method: "POST",
    body: JSON.stringify(values),
  });
export const updateCrmLead = (id: string, values: Record<string, unknown>) =>
  request<{ lead: CrmLead }>(`/${encodeURIComponent(id)}/lead`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
export const addCrmFollowUp = (
  id: string,
  values: { note: string; dueAt?: string; assignedTo?: string },
) =>
  request<{ lead: CrmLead }>(`/${encodeURIComponent(id)}/follow-ups`, {
    method: "POST",
    body: JSON.stringify(values),
  });
export const createCrmTrial = (
  id: string,
  values: { trialDate: string; startTime: string; endTime?: string; program?: string; coach?: string },
) =>
  request<{ trial: CrmTrial }>(`/${encodeURIComponent(id)}/trials`, {
    method: "POST",
    body: JSON.stringify(values),
  });
export const updateCrmTrial = (id: string, values: Record<string, unknown>) =>
  request<{ trial: CrmTrial }>(`/trials/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
export const convertCrmLead = (
  id: string,
  values: { age: number; plan: string; createInvoice: boolean },
) =>
  request<{
    lead: CrmLead;
    student: { _id: string; name: string };
    invoice?: { invoiceNumber: string };
  }>(`/${encodeURIComponent(id)}/convert`, {
    method: "POST",
    body: JSON.stringify(values),
  });

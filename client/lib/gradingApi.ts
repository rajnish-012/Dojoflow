import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetchWithSession(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "Grading request failed.");
  return data as T;
}

export type GradingParticipant = { student: { _id: string; name: string; currentBelt?: string }; program?: { _id: string; name: string }; eligibility?: { eligible: boolean; reason?: string } };
export type GradingEvent = { _id: string; date: string; branch: { _id: string; name: string }; program: { _id: string; name: string }; examiner: { _id: string; name: string }; students: GradingParticipant[]; status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"; notes?: string };
export type Evaluation = { _id: string; student: { _id: string; name: string; currentBelt?: string }; criteria: Record<string, { value: number; remarks?: string }>; overallScore: number; remarks: string; result: "PASS" | "FAIL" | "PENDING"; status: "DRAFT" | "FINALIZED" | "PUBLISHED"; promotion?: string };
export type Candidate = { student: { _id: string; name: string; currentBelt?: string }; program: { _id: string; name: string }; eligible: boolean; reason: string; trainingDay: number; milestone?: { belt: string; skill?: string; description?: string; requiresFormalGrading?: boolean } | null };
export type StaffRecord = { _id: string; name: string; email?: string; role: string; isActive?: boolean; branch?: string | { _id?: string } | null };
export type CertificateRecord = { _id: string; certificateNumber: string; kind: "BELT_PROMOTION" | "PROGRAM_COMPLETION" | "ACHIEVEMENT"; student: string | { _id?: string; name?: string }; studentName: string; branch: string | { _id?: string; name?: string }; program?: string | { _id?: string; name?: string } | null; programName?: string; belt?: string; achievement?: string; issuedAt: string; issuedBy?: string | { name?: string }; examinerName?: string; academy: { name: string; logoUrl: string; address: string; contactEmail: string; contactPhone: string; primaryColor: string; secondaryColor: string } };

export const getGradingEvents = () => request<{ events: GradingEvent[] }>("/grading");
export const getGradingEvent = (id: string) => request<{ event: GradingEvent; evaluations: Evaluation[] }>(`/grading/${id}`);
export const getEligibleForGrading = (branch: string, program: string, date: string) => request<{ students: Candidate[] }>(`/grading/eligibility?branch=${encodeURIComponent(branch)}&program=${encodeURIComponent(program)}&date=${encodeURIComponent(date)}`);
export const createGradingEvent = (body: unknown) => request<{ event: GradingEvent }>("/grading", { method: "POST", body });
export const updateGradingEvent = (id: string, body: unknown) => request<{ event: GradingEvent }>(`/grading/${id}`, { method: "PUT", body });
export const gradingAction = (id: string, action: "start" | "cancel" | "complete" | "publish") => request<{ event?: GradingEvent; evaluations?: Evaluation[] }>(`/grading/${id}/${action}`, { method: "POST" });
export const saveGradingEvaluation = (id: string, studentId: string, body: unknown) => request<{ evaluation: Evaluation }>(`/grading/${id}/students/${studentId}/evaluation`, { method: "PUT", body });
export const finalizeGradingEvaluation = (id: string, studentId: string) => request<{ evaluation: Evaluation; promotion?: { _id: string; toBelt: string } | null; promotionMessage?: string }>(`/grading/${id}/students/${studentId}/evaluation/finalize`, { method: "POST" });
export const generatePromotionCertificate = (promotionId: string) => request<{ certificate: { _id: string } }>(`/certificates/promotions/${promotionId}`, { method: "POST" });
export const getCertificate = (id: string) => request<{ certificate: CertificateRecord }>(`/certificates/${id}`);
export const issueProgramCompletionCertificate = (body: unknown) => request<{ certificate: { _id: string } }>("/certificates/program-completion", { method: "POST", body });
export const issueAchievementCertificate = (body: unknown) => request<{ certificate: { _id: string } }>("/certificates/achievements", { method: "POST", body });
export const listCertificates = () => request<{ certificates: CertificateRecord[] }>("/certificates");
export const getCompletionCandidates = () => request<{ completions: Array<{ studentId: string; studentName: string; branch: string; enrollmentId: string; programId: string; programName: string }> }>("/certificates/completion-eligible");
export const issueCompletionCertificate = (body: unknown) => request<{ certificate: { _id: string } }>("/certificates/program-completion", { method: "POST", body });

export async function getGradingStaff(): Promise<StaffRecord[]> {
  const response = await fetchWithSession(`${API_URL}/users`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to load examiners.");
  return Array.isArray(data.users) ? data.users.filter((user: StaffRecord) => user.role !== "STUDENT" && user.role !== "SUPER_ADMIN" && user.isActive !== false) : [];
}

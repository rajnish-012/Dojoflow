import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

async function financeRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetchWithSession(`${API_URL}/finance${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Financial request failed");
  return data as T;
}

export type FeePlan = {
  _id: string;
  name: string;
  feeName?: string;
  price: number;
  duration: number;
  durationUnit: "MONTHS" | "DAYS";
  billingFrequency?: "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  registrationFee?: number;
  taxRate?: number;
  feeBranch?: { _id: string; name: string } | null;
  feeActive?: boolean;
  effectiveFee?: {
    feeName?: string;
    amount: number;
    billingFrequency: "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "YEARLY";
    registrationFee?: number;
    taxRate?: number;
    active?: boolean;
    effectiveFrom?: string | null;
    effectiveUntil?: string | null;
    discountRules?: FeePlan["discountRules"];
  };
  branchFeeOverrides?: {
    branch: { _id: string; name: string } | string;
    feeName: string;
    amount: number;
    billingFrequency: "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "YEARLY";
    registrationFee: number;
    taxRate: number;
    active?: boolean;
    effectiveFrom?: string | null;
    effectiveUntil?: string | null;
    discountRules?: FeePlan["discountRules"];
  }[];
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  discountRules?: {
    _id?: string;
    name: string;
    type: "FIXED" | "PERCENT";
    amount: number;
    active?: boolean;
    effectiveFrom?: string | null;
    effectiveUntil?: string | null;
  }[];
  programs?: { program?: { name?: string } | string }[];
};

export type Invoice = {
  _id: string;
  invoiceNumber: string;
  student:
    | { _id: string; name: string; phone?: string; email?: string }
    | string;
  enrollment: string;
  plan?: { _id: string; name: string } | string;
  branch: { _id: string; name: string } | string;
  items: {
    description: string;
    amount: number;
    kind: string;
    programName?: string;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
  notes?: string;
  currency: string;
  dueDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  status:
    | "DRAFT"
    | "ISSUED"
    | "PARTIALLY_PAID"
    | "PAID"
    | "OVERDUE"
    | "CANCELLED"
    | "REFUNDED";
};

export type FinanceDashboard = {
  currency: string;
  metrics: {
    todayCollection: number;
    monthCollection: number;
    pending: number;
    overdue: number;
    overdueCount: number;
    partiallyPaid: number;
    partialCount: number;
    expectedCollection: number;
  };
  charts: {
    monthlyCollection: { month: string; amount: number }[];
    outstandingFees: { label: string; amount: number }[];
    branchCollection: { branch: string; amount: number }[];
    programRevenue: { program: string; amount: number }[];
  };
};

export type FinanceProfile = {
  summary: {
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
    overdue: number;
  };
  invoices: Invoice[];
  payments: {
    _id: string;
    invoice: string;
    amount: number;
    direction: "CREDIT" | "DEBIT";
    kind: "PAYMENT" | "REFUND" | "CORRECTION";
    method: string;
    paymentDate: string;
    notes?: string;
  }[];
  receipts: {
    _id: string;
    payment: string;
    receiptNumber: string;
    invoiceNumber: string;
    amount: number;
    method: string;
    date: string;
  }[];
};

export type Receipt = {
  _id: string;
  receiptNumber: string;
  invoiceNumber: string;
  studentName: string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  kind: "PAYMENT" | "REFUND" | "CORRECTION";
  method: string;
  date: string;
  currency: string;
  academy: {
    name: string;
    logoUrl: string;
    address: string;
    contactEmail: string;
    contactPhone: string;
    primaryColor: string;
  };
  branch: { name?: string } | string;
};

export type FinancePayment = {
  _id: string;
  invoice: { _id?: string; invoiceNumber?: string; status?: string } | string;
  student: { _id?: string; name?: string } | string;
  branch: { _id?: string; name?: string } | string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  kind: "PAYMENT" | "REFUND" | "CORRECTION";
  method: string;
  paymentDate: string;
  referenceId?: string;
  notes?: string;
  reason?: string;
  remainingRefundable: number;
  corrected: boolean;
  receivedBy?: { name?: string } | string;
  receipt?: { _id: string; receiptNumber?: string } | null;
};

export const getFinanceDashboard = () =>
  financeRequest<{ success: true } & FinanceDashboard>("/dashboard");
export const getFinancePlans = () =>
  financeRequest<{ plans: FeePlan[] }>("/plans");
export const getFinanceBranches = () =>
  financeRequest<{ branches: { _id: string; name: string }[] }>("/branches");
export const updateFeePlan = (id: string, values: Record<string, unknown>) =>
  financeRequest<{ plan: FeePlan }>(`/plans/${id}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
export const updateBranchFeePlan = (
  id: string,
  values: Record<string, unknown>,
) =>
  financeRequest<{ plan: FeePlan; branchFee: NonNullable<FeePlan["effectiveFee"]> }>(
    `/plans/${id}/branch-fees`,
    { method: "PUT", body: JSON.stringify(values) },
  );
export const getInvoiceCandidates = () =>
  financeRequest<{
    students: {
      _id: string;
      name: string;
      planEnrollments: {
        _id: string;
        startDate: string;
        status: string;
        plan: { _id: string; name?: string } | string;
        endDate?: string | null;
        billingSnapshot?: { discountRules?: NonNullable<FeePlan["discountRules"]> };
      }[];
    }[];
  }>("/invoice-candidates");
export const getInvoices = () =>
  financeRequest<{ invoices: Invoice[]; total: number }>("/invoices");
export const getFinancePayments = () =>
  financeRequest<{ payments: FinancePayment[] }>("/payments");
export const getFinanceReport = () =>
  financeRequest<{
    invoices: (Invoice & { createdAt: string })[];
    payments: FinancePayment[];
    audits: { action: string; reason?: string; before?: unknown; after?: unknown; createdAt: string }[];
    truncated: { invoices: boolean; payments: boolean; audits: boolean };
  }>("/reports");
export const createInvoice = (values: {
  studentId: string;
  enrollmentId: string;
  dueDate: string;
  discountRuleId?: string;
  status?: "DRAFT" | "ISSUED";
  notes?: string;
  periodStart?: string;
}) =>
  financeRequest<{ invoice: Invoice }>("/invoices", {
    method: "POST",
    body: JSON.stringify(values),
  });
export const issueInvoice = (id: string) =>
  financeRequest<{ invoice: Invoice }>(`/invoices/${id}/issue`, {
    method: "POST",
    body: "{}",
  });
export const cancelInvoice = (id: string, reason: string) =>
  financeRequest<{ invoice: Invoice }>(`/invoices/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
export const recordPayment = (
  id: string,
  values: {
    amount: number;
    method: string;
    referenceId?: string;
    notes?: string;
  },
  idempotencyKey = `pay-${crypto.randomUUID()}`,
) =>
  financeRequest<{
    payment: unknown;
    invoice: Invoice;
    receipt: { _id: string; receiptNumber: string };
  }>(`/invoices/${id}/payments`, {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(values),
  });
export const getStudentFinance = (id: string) =>
  financeRequest<FinanceProfile>(`/students/${id}`);
export const getMyFinance = () => financeRequest<FinanceProfile>("/me");
export const getReceipt = (id: string) =>
  financeRequest<{ receipt: Receipt }>(`/receipts/${id}`);
export const refundPayment = (
  id: string,
  values: { amount: number; reason: string },
  idempotencyKey = `refund-${crypto.randomUUID()}`,
) =>
  financeRequest<{ refund: FinancePayment; receipt: { _id: string } }>(
    `/payments/${id}/refund`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(values),
    },
  );
export const correctPayment = (
  id: string,
  values: { correctedAmount: number; reason: string },
  idempotencyKey = `correction-${crypto.randomUUID()}`,
) =>
  financeRequest<{ corrections: FinancePayment[]; receipts: { _id: string }[] }>(
    `/payments/${id}/corrections`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(values),
    },
  );

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

export type FeeTermPlanOption = {
  _id: string;
  name: string;
  programs?: { program?: { name?: string } | string }[];
};

export type FeeDiscountRule = {
  _id?: string;
  name: string;
  type: "FIXED" | "PERCENT";
  amount: number;
  active?: boolean;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
};

export type FeeTerm = {
  _id: string;
  plan: { _id: string; name: string } | string;
  branch: { _id: string; name: string } | string | null;
  currency?: string;
  billingFrequency: "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  amount: number;
  registrationFee: number;
  taxRate: number;
  discountRules: FeeDiscountRule[];
  effectiveFrom: string;
  effectiveUntil: string | null;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  version: number;
  supersedes: string | null;
};
export type AvailableFeeTermState = { configuredCount: number; inactiveCount: number; notYetEffectiveCount: number; expiredCount: number; applicableCount: number };

export const getPlanFeeTerms = (planId: string) =>
  financeRequest<{ feeTerms: FeeTerm[] }>(`/plans/${planId}/fee-terms`);
export const getFeeTerms = (filters: { branchId?: string; billingFrequency?: string; status?: string } = {}) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]);
  return financeRequest<{ feeTerms: FeeTerm[] }>(`/fee-terms${query.size ? `?${query.toString()}` : ""}`);
};
export const getAvailableEnrollmentFeeTerms = (
  planId: string,
  branchId: string,
  asOf: string,
) => financeRequest<{ feeTerms: FeeTerm[]; availability: AvailableFeeTermState }>(
  `/fee-terms/available?planId=${encodeURIComponent(planId)}&branchId=${encodeURIComponent(branchId)}&asOf=${encodeURIComponent(asOf)}`,
);
export const createPlanFeeTerm = (
  planId: string,
  values: Partial<FeeTerm> & { branch?: string | null; reason?: string },
) =>
  financeRequest<{ feeTerm: FeeTerm }>(`/plans/${planId}/fee-terms`, {
    method: "POST",
    body: JSON.stringify(values),
  });
export const updatePlanFeeTerm = (
  id: string,
  values: Partial<FeeTerm> & { reason?: string },
) =>
  financeRequest<{ feeTerm: FeeTerm }>(`/fee-terms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
export const supersedePlanFeeTerm = (
  id: string,
  values: Partial<FeeTerm> & { reason?: string },
) =>
  financeRequest<{ feeTerm: FeeTerm; previous: FeeTerm }>(
    `/fee-terms/${id}/supersede`,
    { method: "POST", body: JSON.stringify(values) },
  );

export type Invoice = {
  _id: string;
  invoiceNumber: string;
  student:
    | { _id: string; name: string; phone?: string; email?: string }
    | string;
  enrollment: string;
  plan?: { _id: string; name: string } | string;
  feeTerm?: string | null;
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
  summaryByCurrency?: {
    currency: string;
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
    overdue: number;
  }[];
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
    currency?: string;
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
export const getFeeTermPlanOptions = () =>
  financeRequest<{ plans: FeeTermPlanOption[] }>("/plan-options");
export const getFinanceBranches = () =>
  financeRequest<{ branches: { _id: string; name: string }[] }>("/branches");
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
        billingSnapshot?: { discountRules?: FeeDiscountRule[] };
      }[];
    }[];
  }>("/invoice-candidates");
export const getInvoices = () =>
  financeRequest<{ invoices: Invoice[]; total: number }>("/invoices");
export const getFinancePayments = () =>
  financeRequest<{ payments: FinancePayment[] }>("/payments");
export type FinanceReportFilters = {
  branchId?: string;
  planId?: string;
  invoiceStatus?: string;
  paymentKind?: string;
  from?: string;
  to?: string;
};
export const getFinanceReport = (filters: FinanceReportFilters = {}) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]);
  return financeRequest<{
    invoices: (Invoice & { createdAt: string })[];
    payments: FinancePayment[];
    receipts: Receipt[];
    audits: { action: string; reason?: string; before?: unknown; after?: unknown; createdAt: string }[];
    truncated: { invoices: boolean; payments: boolean; receipts: boolean; audits: boolean };
  }>(`/reports${query.size ? `?${query.toString()}` : ""}`);
};
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

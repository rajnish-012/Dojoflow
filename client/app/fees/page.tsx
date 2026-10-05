"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingSpinner,
  Modal,
  PageHeader,
  SummaryCard,
} from "@/components/ui";
import { useCan, useCurrentRole, PERMISSIONS } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/current-user";
import { toast } from "@/lib/toast";
import {
  cancelInvoice,
  createInvoice,
  getFinanceBranches,
  getFinanceDashboard,
  getFinancePayments,
  getFinancePlans,
  getFinanceReport,
  getInvoiceCandidates,
  getInvoices,
  issueInvoice,
  recordPayment,
  refundPayment,
  correctPayment,
  updateBranchFeePlan,
  updateFeePlan,
  type FeePlan,
  type FinanceDashboard,
  type FinancePayment,
  type Invoice,
} from "@/lib/financeApi";

type Candidate = {
  _id: string;
  name: string;
  planEnrollments: {
    _id: string;
    startDate: string;
    status: string;
    plan: { _id: string; name?: string } | string;
    endDate?: string | null;
    billingSnapshot?: { discountRules?: DiscountRule[] };
  }[];
};
type DiscountRule = NonNullable<FeePlan["discountRules"]>[number];
type Tab = "invoices" | "payments" | "plans" | "reports";

function formatMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function formatInvoicePeriod(invoice: Invoice) {
  if (!invoice.periodStart) return "Billing period not specified";
  const start = new Date(invoice.periodStart);
  const end = invoice.periodEnd ? new Date(invoice.periodEnd) : null;
  if (!end || end <= start) return `Billing date: ${formatDate(invoice.periodStart)}`;
  return `${formatDate(invoice.periodStart)} – ${formatDate(
    new Date(end.getTime() - 86400000).toISOString(),
  )}`;
}
function chartLine(values: number[]) {
  if (!values.length) return "";
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => ({
    x: 14 + (index / Math.max(1, values.length - 1)) * 272,
    y: 20 + ((max - value) / span) * 82,
  }));
  return points.slice(0, -1).reduce((path, point, index) => {
    const next = points[index + 1];
    const control = (next.x - point.x) / 2;
    return `${path} C ${point.x + control} ${point.y}, ${next.x - control} ${next.y}, ${next.x} ${next.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function StatTile({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <SummaryCard title={label} value={value} icon={icon} subtitle={note} />
  );
}

export default function FeesPage() {
  const canManage = useCan(PERMISSIONS.FINANCE_MANAGE);
  const canCollect = useCan(PERMISSIONS.FINANCE_COLLECT);
  const canRefund = useCan(PERMISSIONS.FINANCE_REFUND);
  const canReport = useCan(PERMISSIONS.FINANCE_REPORT);
  const role = useCurrentRole();
  const currentUser = useCurrentUser();
  const isSuperAdmin = role === "SUPER_ADMIN";
  const currentBranchId = currentUser?.branch || undefined;
  const [tab, setTab] = useState<Tab>("invoices");
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string }[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState("");
  const [selectedDiscount, setSelectedDiscount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentKey, setPaymentKey] = useState("");
  const [adjustmentPayment, setAdjustmentPayment] =
    useState<FinancePayment | null>(null);
  const [adjustmentKind, setAdjustmentKind] = useState<"REFUND" | "CORRECTION">(
    "REFUND",
  );
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentKey, setAdjustmentKey] = useState("");
  const [adjustmentBusy, setAdjustmentBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FeePlan | null>(null);
  const [planDraft, setPlanDraft] = useState({
    feeName: "",
    price: "",
    billingFrequency: "ONE_TIME",
    registrationFee: "0",
    taxRate: "0",
    effectiveFrom: "",
    effectiveUntil: "",
    feeBranch: "",
    active: true,
  });
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [ruleDraft, setRuleDraft] = useState({
    name: "",
    type: "PERCENT",
    amount: "",
  });
  const [planBusy, setPlanBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, invoiceData, feePlanData, paymentData] =
        await Promise.all([
          getFinanceDashboard(),
          getInvoices(),
          getFinancePlans(),
          getFinancePayments(),
        ]);
      setDashboard(summary);
      setInvoices(invoiceData.invoices);
      setPlans(feePlanData.plans);
      setPayments(paymentData.payments);
      setBranches((await getFinanceBranches()).branches);
      if (canManage) {
        const data = await getInvoiceCandidates();
        setCandidates(data.students);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load finance data",
      );
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const name =
          typeof invoice.student === "object" ? invoice.student.name : "";
        return `${invoice.invoiceNumber} ${name} ${invoice.status}`
          .toLowerCase()
          .includes(search.toLowerCase());
      }),
    [invoices, search],
  );
  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        const student =
          typeof payment.student === "object" ? payment.student.name || "" : "";
        const invoice =
          typeof payment.invoice === "object"
            ? payment.invoice.invoiceNumber || ""
            : payment.invoice;
        return `${student} ${invoice} ${payment.kind} ${payment.method} ${payment.referenceId || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      }),
    [payments, search],
  );
  const chosenStudent = candidates.find(
    (student) => student._id === selectedStudent,
  );
  const enrollmentOptions = chosenStudent?.planEnrollments || [];
  const selectedEnrollmentRecord = enrollmentOptions.find(
    (enrollment) => enrollment._id === selectedEnrollment,
  );
  const enrollmentPlanId = selectedEnrollmentRecord
    ? typeof selectedEnrollmentRecord.plan === "object"
      ? selectedEnrollmentRecord.plan._id
      : selectedEnrollmentRecord.plan
    : "";
  const availableDiscounts = (
    selectedEnrollmentRecord?.billingSnapshot?.discountRules ||
    plans.find((plan) => plan._id === enrollmentPlanId)?.discountRules ||
    []
  ).filter((rule) => rule.active !== false);

  function setDraftForPlanTarget(plan: FeePlan, targetBranch: string) {
    const branchOverride = targetBranch
      ? plan.branchFeeOverrides?.find(
          (item) =>
            String(
              typeof item.branch === "object" ? item.branch._id : item.branch,
            ) === targetBranch,
        )
      : undefined;
    const terms = branchOverride ||
      plan.effectiveFee || {
        feeName: plan.feeName || plan.name,
        amount: plan.price,
        billingFrequency: plan.billingFrequency || "ONE_TIME",
        registrationFee: plan.registrationFee || 0,
        taxRate: plan.taxRate || 0,
        active: plan.feeActive !== false,
        effectiveFrom: plan.effectiveFrom,
        effectiveUntil: plan.effectiveUntil,
        discountRules: plan.discountRules,
      };
    setPlanDraft({
      feeName: terms.feeName || plan.name,
      price: String("amount" in terms ? terms.amount : plan.price),
      billingFrequency: terms.billingFrequency || "ONE_TIME",
      registrationFee: String(terms.registrationFee || 0),
      taxRate: String(terms.taxRate || 0),
      effectiveFrom: terms.effectiveFrom?.slice(0, 10) || "",
      effectiveUntil: terms.effectiveUntil?.slice(0, 10) || "",
      feeBranch: targetBranch,
      active: terms.active !== false,
    });
    setDiscountRules((terms.discountRules || []).map((rule) => ({ ...rule })));
  }

  function beginEditPlan(plan: FeePlan, targetBranch?: string) {
    setEditingPlan(plan);
    setDraftForPlanTarget(
      plan,
      targetBranch ??
        (isSuperAdmin ? plan.feeBranch?._id || "" : currentBranchId || ""),
    );
  }

  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    if (!editingPlan) return;
    setPlanBusy(true);
    try {
      const values = {
        feeName: planDraft.feeName,
        billingFrequency: planDraft.billingFrequency,
        registrationFee: Number(planDraft.registrationFee),
        taxRate: Number(planDraft.taxRate),
        effectiveFrom: planDraft.effectiveFrom || null,
        effectiveUntil: planDraft.effectiveUntil || null,
        discountRules,
        reason: "Fee plan terms updated",
      };
      if (planDraft.feeBranch || (!isSuperAdmin && currentBranchId)) {
        await updateBranchFeePlan(editingPlan._id, {
          ...values,
          amount: Number(planDraft.price),
          active: planDraft.active,
          branchId: planDraft.feeBranch || currentBranchId,
        });
      } else {
        await updateFeePlan(editingPlan._id, {
          ...values,
          price: Number(planDraft.price),
          feeActive: planDraft.active,
        });
      }
      toast.success(
        "Fee terms updated. Existing enrollment snapshots remain unchanged.",
      );
      setEditingPlan(null);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update fee plan",
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function submitInvoice(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedStudent || !selectedEnrollment || !dueDate) return;
    setCreateBusy(true);
    try {
      await createInvoice({
        studentId: selectedStudent,
        enrollmentId: selectedEnrollment,
        dueDate,
        periodStart: periodStart || undefined,
        discountRuleId: selectedDiscount || undefined,
      });
      toast.success("Invoice created successfully");
      setCreateOpen(false);
      setSelectedStudent("");
      setSelectedEnrollment("");
      setSelectedDiscount("");
      setPeriodStart("");
      setDueDate("");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create invoice",
      );
    } finally {
      setCreateBusy(false);
    }
  }

  async function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!payInvoice) return;
    setPaymentBusy(true);
    try {
      const result = await recordPayment(
        payInvoice._id,
        {
          amount: Number(payAmount),
          method: payMethod,
          referenceId: payReference,
          notes: payNotes,
        },
        paymentKey,
      );
      toast.success("Payment recorded and receipt generated");
      setPayInvoice(null);
      setPaymentKey("");
      await refresh();
      window.open(
        `/fees/receipts/${result.receipt._id}`,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not record payment",
      );
    } finally {
      setPaymentBusy(false);
    }
  }

  async function submitAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!adjustmentPayment) return;
    setAdjustmentBusy(true);
    try {
      if (adjustmentKind === "REFUND") {
        const result = await refundPayment(
          adjustmentPayment._id,
          { amount: Number(adjustmentAmount), reason: adjustmentReason },
          adjustmentKey,
        );
        toast.success("Refund recorded with an auditable receipt");
        window.open(
          `/fees/receipts/${result.receipt._id}`,
          "_blank",
          "noopener,noreferrer",
        );
      } else {
        const result = await correctPayment(
          adjustmentPayment._id,
          {
            correctedAmount: Number(adjustmentAmount),
            reason: adjustmentReason,
          },
          adjustmentKey,
        );
        toast.success("Payment correction recorded with an auditable receipt");
        const receipt = result.receipts[0];
        if (receipt)
          window.open(
            `/fees/receipts/${receipt._id}`,
            "_blank",
            "noopener,noreferrer",
          );
      }
      setAdjustmentPayment(null);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setAdjustmentKey("");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update payment",
      );
    } finally {
      setAdjustmentBusy(false);
    }
  }

  async function exportFinanceCsv() {
    setReportBusy(true);
    try {
      const report = await getFinanceReport();
      const escapeCsv = (value: unknown) =>
        `"${String(value ?? "").replaceAll('"', '""')}"`;
      const rows: unknown[][] = [
        [
          "Record type",
          "Date",
          "Record number",
          "Student",
          "Branch",
          "Amount",
          "Status or movement",
          "Details",
        ],
      ];
      for (const invoice of report.invoices) {
        rows.push([
          "INVOICE",
          invoice.createdAt,
          invoice.invoiceNumber,
          typeof invoice.student === "object" ? invoice.student.name : "",
          typeof invoice.branch === "object" ? invoice.branch.name : "",
          invoice.total,
          invoice.status,
          invoice.notes,
        ]);
      }
      for (const payment of report.payments) {
        rows.push([
          "PAYMENT",
          payment.paymentDate,
          payment._id,
          typeof payment.student === "object" ? payment.student.name : "",
          typeof payment.branch === "object" ? payment.branch.name : "",
          `${payment.direction === "DEBIT" ? "-" : ""}${payment.amount}`,
          payment.kind,
          payment.referenceId || payment.reason || payment.notes,
        ]);
      }
      for (const audit of report.audits)
        rows.push([
          "AUDIT",
          audit.createdAt,
          audit.action,
          "",
          "",
          "",
          audit.action,
          `${audit.reason || ""} ${JSON.stringify({ before: audit.before, after: audit.after })}`,
        ]);
      const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `forcestrike-finance-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      const truncated = Object.values(report.truncated).some(Boolean);
      toast.success(
        truncated
          ? "Finance report downloaded. At least one section reached the 5,000 record export limit."
          : "Finance report downloaded",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not export finance report",
      );
    } finally {
      setReportBusy(false);
    }
  }

  async function handleIssue(invoice: Invoice) {
    try {
      await issueInvoice(invoice._id);
      toast.success("Invoice issued");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not issue invoice",
      );
    }
  }
  async function handleCancel(invoice: Invoice) {
    const reason = window.prompt(
      `Why should ${invoice.invoiceNumber} be cancelled?`,
    );
    if (!reason) return;
    try {
      await cancelInvoice(invoice._id, reason);
      toast.success("Invoice cancelled");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not cancel invoice",
      );
    }
  }

  const monthlyValues = (dashboard?.charts.monthlyCollection || []).map(
    (point) => point.amount,
  );
  const monthlyMax = Math.max(0, ...monthlyValues);
  const monthlyMin = Math.min(0, ...monthlyValues);
  const monthlySpan = Math.max(1, monthlyMax - monthlyMin);
  const monthlyY = (value: number) =>
    20 + ((monthlyMax - value) / monthlySpan) * 82;

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-8">
      <PageHeader
        eyebrow="Academy finance"
        title="Fees & Payments"
        description="Manage fee terms, issue invoices, record payments, and review collection across your authorized branches."
        actions={
          <Button
            variant="outline"
            onClick={() => void refresh()}
            leftIcon={<RefreshCw size={16} />}
          >
            Refresh
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Today's collection"
          value={
            dashboard
              ? formatMoney(
                  dashboard.metrics.todayCollection,
                  dashboard.currency,
                )
              : "—"
          }
          icon={<CircleDollarSign size={20} />}
        />
        <StatTile
          label="This month"
          value={
            dashboard
              ? formatMoney(
                  dashboard.metrics.monthCollection,
                  dashboard.currency,
                )
              : "—"
          }
          icon={<Banknote size={20} />}
        />
        <StatTile
          label="Outstanding"
          value={
            dashboard
              ? formatMoney(dashboard.metrics.pending, dashboard.currency)
              : "—"
          }
          icon={<WalletCards size={20} />}
          note={
            dashboard
              ? `${dashboard.metrics.partialCount} partially paid`
              : undefined
          }
        />
        <StatTile
          label="Overdue"
          value={
            dashboard
              ? formatMoney(dashboard.metrics.overdue, dashboard.currency)
              : "—"
          }
          icon={<ShieldAlert size={20} />}
          note={
            dashboard ? `${dashboard.metrics.overdueCount} invoices` : undefined
          }
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card padding="md" className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-(--ink-muted)">
              Expected in the next 30 days
            </p>
            <p className="mt-1 text-xl font-bold">
              {dashboard
                ? formatMoney(
                    dashboard.metrics.expectedCollection,
                    dashboard.currency,
                  )
                : "—"}
            </p>
          </div>
          <CalendarDays className="text-(--accent)" />
        </Card>
        <Card padding="md" className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-(--ink-muted)">
              Partially paid balance
            </p>
            <p className="mt-1 text-xl font-bold">
              {dashboard
                ? formatMoney(
                    dashboard.metrics.partiallyPaid,
                    dashboard.currency,
                  )
                : "—"}
            </p>
          </div>
          <Clock3 className="text-(--accent)" />
        </Card>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-(--line) pb-3">
        {(
          [
            "invoices",
            "payments",
            "plans",
            ...(canReport ? ["reports"] : []),
          ] as Tab[]
        ).map((item) => (
          <button
            key={item}
            className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${tab === item ? "bg-(--accent-soft) text-(--accent)" : "text-(--ink-muted) hover:bg-(--hover-bg)"}`}
            onClick={() => setTab(item)}
          >
            {item === "plans" ? "Fee plans" : item}
          </button>
        ))}
        {canManage && (
          <Button
            className="ml-auto"
            leftIcon={<Plus size={16} />}
            onClick={() => {
              setDueDate(
                new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
              );
              setCreateOpen(true);
            }}
          >
            Create invoice
          </Button>
        )}
      </div>

      {loading ? (
        <Card className="flex min-h-64 items-center justify-center">
          <LoadingSpinner />
        </Card>
      ) : tab === "invoices" ? (
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-(--line) p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="font-bold">Invoices</h2>
              <p className="mt-1 text-xs text-(--ink-muted)">
                Outstanding balances, due dates, and payment receipts.
              </p>
            </div>
            <label className="relative w-full sm:max-w-xs">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-(--ink-faint)"
              />
              <input
                className="h-10 w-full rounded-xl border border-(--line) bg-(--input) pl-9 pr-3 text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoices or students"
              />
            </label>
          </div>
          {filteredInvoices.length === 0 ? (
            <EmptyState
              title="No invoices found"
              description="Create an invoice from an active student enrollment to start tracking fees."
              icon={<FileText size={22} />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-(--surface-muted) text-xs uppercase tracking-wide text-(--ink-muted)">
                  <tr>
                    <th className="px-5 py-3">Invoice</th>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3">Due date</th>
                    <th className="px-5 py-3">Total / Balance</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice._id} className="border-t border-(--line)">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{invoice.invoiceNumber}</p>
                        <p className="mt-1 text-xs text-(--ink-muted)">
                          {invoice.items
                            .map((item) => item.description)
                            .join(", ")}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {typeof invoice.student === "object"
                          ? invoice.student.name
                          : "Student"}
                      </td>
                      <td className="px-5 py-4">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-5 py-4">
                        <p>{formatMoney(invoice.total, invoice.currency)}</p>
                        <p className="mt-1 text-xs text-(--ink-muted)">
                          {formatMoney(invoice.balance, invoice.currency)} due
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant={
                            invoice.status === "PAID"
                              ? "success"
                              : invoice.status === "OVERDUE"
                                ? "danger"
                                : "default"
                          }
                        >
                          {invoice.status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {invoice.status === "DRAFT" && canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleIssue(invoice)}
                            >
                              Issue
                            </Button>
                          )}
                          {canManage &&
                            ["DRAFT", "ISSUED"].includes(invoice.status) &&
                            invoice.paidAmount === 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleCancel(invoice)}
                              >
                                Cancel
                              </Button>
                            )}
                          {canCollect &&
                            ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(
                              invoice.status,
                            ) && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setPayInvoice(invoice);
                                  setPayAmount(String(invoice.balance));
                                  setPaymentKey(`pay-${crypto.randomUUID()}`);
                                }}
                              >
                                Record payment
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : tab === "payments" ? (
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-(--line) p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="font-bold">Payment ledger</h2>
              <p className="mt-1 text-xs text-(--ink-muted)">
                Every payment, refund, and correction is kept as a separate
                record.
              </p>
            </div>
            <label className="relative w-full sm:max-w-xs">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-(--ink-faint)"
              />
              <input
                className="h-10 w-full rounded-xl border border-(--line) bg-(--input) pl-9 pr-3 text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ledger"
              />
            </label>
          </div>
          {filteredPayments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-(--surface-muted) text-xs uppercase tracking-wide text-(--ink-muted)">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Student / Invoice</th>
                    <th className="px-5 py-3">Movement</th>
                    <th className="px-5 py-3">Method / Reference</th>
                    <th className="px-5 py-3">Received by</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => {
                    const isOriginal = payment.kind === "PAYMENT";
                    const invoiceName =
                      typeof payment.invoice === "object"
                        ? payment.invoice.invoiceNumber
                        : payment.invoice;
                    const studentName =
                      typeof payment.student === "object"
                        ? payment.student.name
                        : "Student";
                    return (
                      <tr
                        key={payment._id}
                        className="border-t border-(--line)"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          {formatDate(payment.paymentDate)}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold">{studentName}</p>
                          <p className="mt-1 text-xs text-(--ink-muted)">
                            {invoiceName}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold">
                            {payment.kind.replaceAll("_", " ")}
                          </p>
                          <p
                            className={`mt-1 text-xs font-semibold ${payment.direction === "CREDIT" ? "text-(--success)" : "text-(--danger)"}`}
                          >
                            {payment.direction === "CREDIT" ? "+" : "−"}
                            {formatMoney(payment.amount, dashboard?.currency)}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p>{payment.method.replaceAll("_", " ")}</p>
                          <p className="mt-1 text-xs text-(--ink-muted)">
                            {payment.referenceId || payment.reason || "—"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          {typeof payment.receivedBy === "object"
                            ? payment.receivedBy.name
                            : "Staff"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {payment.receipt && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(
                                    `/fees/receipts/${payment.receipt?._id}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                Receipt
                              </Button>
                            )}
                            {isOriginal &&
                              canRefund &&
                              payment.remainingRefundable > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setAdjustmentKind("REFUND");
                                    setAdjustmentPayment(payment);
                                    setAdjustmentAmount(
                                      String(payment.remainingRefundable),
                                    );
                                    setAdjustmentReason("");
                                    setAdjustmentKey(
                                      `refund-${crypto.randomUUID()}`,
                                    );
                                  }}
                                >
                                  Refund
                                </Button>
                              )}
                            {isOriginal &&
                              canManage &&
                              !payment.corrected &&
                              payment.remainingRefundable ===
                                payment.amount && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setAdjustmentKind("CORRECTION");
                                    setAdjustmentPayment(payment);
                                    setAdjustmentAmount(String(payment.amount));
                                    setAdjustmentReason("");
                                    setAdjustmentKey(
                                      `correction-${crypto.randomUUID()}`,
                                    );
                                  }}
                                >
                                  <RotateCcw size={14} className="mr-1" />
                                  Correct
                                </Button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No payments found"
              description="Collected amounts and later adjustments will appear here."
              icon={<Banknote size={22} />}
            />
          )}
        </Card>
      ) : tab === "plans" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {plans.map((plan) => {
            const fee = plan.effectiveFee || {
              feeName: plan.feeName || plan.name,
              amount: plan.price,
              billingFrequency: plan.billingFrequency || "ONE_TIME",
              registrationFee: plan.registrationFee || 0,
              taxRate: plan.taxRate || 0,
              active: plan.feeActive !== false,
            };
            const branchFeeOverrides = plan.branchFeeOverrides || [];
            const showBranchOverrides =
              isSuperAdmin && !plan.feeBranch && branchFeeOverrides.length > 0;
            const canEditThisPlan =
              canManage && (isSuperAdmin || Boolean(currentBranchId));
            return (
              <Card key={plan._id} padding="lg">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--accent)">
                      Fee structure
                    </p>
                    <h2 className="mt-1 text-lg font-bold">
                      {fee.feeName || plan.name}
                    </h2>
                    <p className="mt-1 text-sm text-(--ink-muted)">
                      {plan.programs
                        ?.map((item) =>
                          typeof item.program === "object"
                            ? item.program.name
                            : "",
                        )
                        .filter(Boolean)
                        .join(", ") || plan.name}
                    </p>
                  </div>
                  {canEditThisPlan && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Settings2 size={15} />}
                      onClick={() => beginEditPlan(plan)}
                    >
                      Manage
                    </Button>
                  )}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-(--ink-muted)">
                      {showBranchOverrides ? "Base amount" : "Amount"}
                    </p>
                    <p className="mt-1 font-bold">
                      {formatMoney(fee.amount, dashboard?.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-(--ink-muted)">
                      {showBranchOverrides ? "Base billing" : "Billing"}
                    </p>
                    <p className="mt-1 font-semibold">
                      {fee.billingFrequency?.replaceAll("_", " ") || "Custom"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-(--ink-muted)">
                      {showBranchOverrides ? "Base registration" : "Registration"}
                    </p>
                    <p className="mt-1 font-semibold">
                      {formatMoney(
                        fee.registrationFee || 0,
                        dashboard?.currency,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-(--ink-muted)">
                      {showBranchOverrides ? "Base tax" : "Tax"}
                    </p>
                    <p className="mt-1 font-semibold">{fee.taxRate || 0}%</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-(--line) pt-3 text-xs text-(--ink-muted)">
                  <Badge variant={fee.active === false ? "danger" : "success"}>
                    {fee.active === false ? "Inactive" : "Active"}
                  </Badge>
                  {plan.feeBranch?.name || "Available across branches"} ·{" "}
                  {plan.duration} {plan.durationUnit.toLowerCase()}
                </div>
                {showBranchOverrides && (
                  <div className="mt-4 border-t border-(--line) pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-(--ink-muted)">
                      Branch-specific fee terms
                    </p>
                    <div className="mt-3 space-y-2">
                      {branchFeeOverrides.map((override) => {
                        const branchId =
                          typeof override.branch === "object"
                            ? override.branch._id
                            : override.branch;
                        const branchName =
                          typeof override.branch === "object"
                            ? override.branch.name
                            : branches.find((branch) => branch._id === branchId)
                                ?.name || "Branch";
                        return (
                          <div
                            key={branchId}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-(--surface-muted) px-3 py-2.5"
                          >
                            <div>
                              <p className="text-sm font-semibold">{branchName}</p>
                              <p className="mt-0.5 text-xs text-(--ink-muted)">
                                {formatMoney(override.amount, dashboard?.currency)}
                                {" · "}
                                {override.billingFrequency.replaceAll("_", " ")}
                                {" · Registration "}
                                {formatMoney(
                                  override.registrationFee || 0,
                                  dashboard?.currency,
                                )}
                                {" · Tax "}
                                {override.taxRate || 0}%
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  override.active === false ? "danger" : "success"
                                }
                              >
                                {override.active === false ? "Inactive" : "Active"}
                              </Badge>
                              {canEditThisPlan && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => beginEditPlan(plan, branchId)}
                                >
                                  Manage branch terms
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card padding="lg" className="xl:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">Monthly collection</h2>
                <p className="mt-1 text-xs text-(--ink-muted)">
                  Net payment movement for the last 12 months, after refunds and
                  corrections.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Download size={15} />}
                loading={reportBusy}
                onClick={() => void exportFinanceCsv()}
              >
                Export report
              </Button>
            </div>
            <div className="mt-4 h-52 w-full">
              <svg
                viewBox="0 0 300 120"
                role="img"
                aria-label="Monthly collection trend"
                className="h-full w-full overflow-visible"
              >
                <path
                  d="M 14 102 H 286 M 14 61 H 286 M 14 20 H 286"
                  fill="none"
                  stroke="var(--line)"
                  strokeDasharray="3 5"
                />
                {dashboard && (
                  <path
                    d={chartLine(
                      dashboard.charts.monthlyCollection.map(
                        (point) => point.amount,
                      ),
                    )}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-700"
                  />
                )}
                {dashboard?.charts.monthlyCollection.map((point, index) => (
                  <circle
                    key={`${point.month}-${index}`}
                    cx={14 + (index / 11) * 272}
                    cy={monthlyY(point.amount)}
                    r="2.8"
                    fill="var(--accent)"
                  />
                ))}
              </svg>
            </div>
            <div className="grid grid-cols-6 gap-1 text-center text-[10px] text-(--ink-muted) sm:grid-cols-12">
              {dashboard?.charts.monthlyCollection.map((point, index) => (
                <span key={`${point.month}-label-${index}`}>{point.month}</span>
              ))}
            </div>
          </Card>
          {dashboard && (
            <Card padding="lg">
              <h2 className="font-bold">Outstanding by age</h2>
              <p className="mt-1 text-xs text-(--ink-muted)">
                Open balances grouped by due date.
              </p>
              <div className="mt-5 space-y-4">
                {dashboard.charts.outstandingFees.map((point) => {
                  const max = Math.max(
                    1,
                    ...dashboard.charts.outstandingFees.map(
                      (item) => item.amount,
                    ),
                  );
                  return (
                    <div key={point.label}>
                      <div className="mb-1 flex justify-between gap-3 text-xs">
                        <span>{point.label}</span>
                        <span className="font-semibold">
                          {formatMoney(point.amount, dashboard.currency)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-(--surface-muted)">
                        <div
                          className="h-full rounded-full bg-(--accent) transition-all duration-700"
                          style={{
                            width: `${Math.max(0, Math.min(100, (point.amount / max) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          {dashboard && (
            <Card padding="lg">
              <h2 className="font-bold">Branch collection</h2>
              <p className="mt-1 text-xs text-(--ink-muted)">
                Current month by branch.
              </p>
              <div className="mt-5 space-y-4">
                {dashboard.charts.branchCollection.length ? (
                  dashboard.charts.branchCollection.map((point) => {
                    const max = Math.max(
                      1,
                      ...dashboard.charts.branchCollection.map(
                        (item) => item.amount,
                      ),
                    );
                    return (
                      <div key={point.branch}>
                        <div className="mb-1 flex justify-between gap-3 text-xs">
                          <span>{point.branch}</span>
                          <span className="font-semibold">
                            {formatMoney(point.amount, dashboard.currency)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-(--surface-muted)">
                          <div
                            className="h-full rounded-full bg-(--primary) transition-all duration-700"
                            style={{
                              width: `${Math.max(0, Math.min(100, (point.amount / max) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-(--ink-muted)">
                    No collection recorded this month.
                  </p>
                )}
              </div>
            </Card>
          )}
          {dashboard && (
            <Card padding="lg" className="xl:col-span-2">
              <h2 className="font-bold">Program revenue</h2>
              <p className="mt-1 text-xs text-(--ink-muted)">
                Net collections allocated to each invoice program over the last
                12 months.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {dashboard.charts.programRevenue.map((point) => (
                  <div
                    key={point.program}
                    className="rounded-xl border border-(--line) bg-(--surface-muted) p-4"
                  >
                    <p
                      className="truncate text-xs text-(--ink-muted)"
                      title={point.program}
                    >
                      {point.program}
                    </p>
                    <p className="mt-2 font-bold">
                      {formatMoney(point.amount, dashboard.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create invoice"
        description="Generate an invoice using the billing terms saved with the student's enrollment."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-invoice-form"
              loading={createBusy}
            >
              Create invoice
            </Button>
          </>
        }
      >
        <form
          id="create-invoice-form"
          onSubmit={submitInvoice}
          className="space-y-4"
        >
          <label className="block text-sm font-semibold">
            Student
            <select
              required
              value={selectedStudent}
              onChange={(event) => {
                setSelectedStudent(event.target.value);
                setSelectedEnrollment("");
              }}
              className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
            >
              <option value="">Select student</option>
              {candidates.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Enrollment
            <select
              required
              value={selectedEnrollment}
              onChange={(event) => {
                setSelectedEnrollment(event.target.value);
                const item = enrollmentOptions.find(
                  (enrollment) => enrollment._id === event.target.value,
                );
                if (item) setPeriodStart(item.startDate.slice(0, 10));
              }}
              className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
            >
              <option value="">Select enrollment</option>
              {enrollmentOptions.map((enrollment) => (
                <option key={enrollment._id} value={enrollment._id}>
                  {typeof enrollment.plan === "object"
                    ? enrollment.plan.name
                    : "Training plan"}{" "}
                  · {formatDate(enrollment.startDate)} · {enrollment.status}
                </option>
              ))}
            </select>
          </label>
          {availableDiscounts.length > 0 && (
            <label className="block text-sm font-semibold">
              Discount rule
              <select
                value={selectedDiscount}
                onChange={(event) => setSelectedDiscount(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              >
                <option value="">No discount</option>
                {availableDiscounts.map((rule) => (
                  <option key={rule._id} value={rule._id}>
                    {rule.name} ·{" "}
                    {rule.type === "PERCENT"
                      ? `${rule.amount}%`
                      : formatMoney(rule.amount, dashboard?.currency)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Billing period start
              <input
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-semibold">
              Due date
              <input
                required
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              />
            </label>
          </div>
          <p className="rounded-xl bg-(--surface-muted) p-3 text-xs leading-5 text-(--ink-muted)">
            The invoice amount, registration fee, discounts, and tax come from
            the enrollment's saved fee terms. This form does not accept a client
            supplied total.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(payInvoice)}
        onClose={() => setPayInvoice(null)}
        title="Record payment"
        description={
          payInvoice
            ? `${payInvoice.invoiceNumber} · Remaining ${formatMoney(payInvoice.balance, payInvoice.currency)}`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setPayInvoice(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="record-payment-form"
              loading={paymentBusy}
            >
              Save payment
            </Button>
          </>
        }
      >
        {payInvoice && (
          <section className="mb-4 rounded-xl border border-(--line) bg-(--surface-muted) p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold">Current invoice</p>
                <p className="mt-1 text-xs text-(--ink-muted)">
                  {formatInvoicePeriod(payInvoice)}
                </p>
              </div>
              <Badge variant="default">One billing period</Badge>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-(--line) pt-3 text-xs">
              {payInvoice.items.map((item, index) => (
                <div key={`${item.kind}-${index}`} className="flex justify-between gap-3">
                  <span>{item.description}</span>
                  <span className="font-semibold">
                    {formatMoney(item.amount, payInvoice.currency)}
                  </span>
                </div>
              ))}
              {payInvoice.discount > 0 && (
                <div className="flex justify-between gap-3 text-(--ink-muted)">
                  <span>Discount</span>
                  <span>-{formatMoney(payInvoice.discount, payInvoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 text-(--ink-muted)">
                <span>Tax</span>
                <span>{formatMoney(payInvoice.tax, payInvoice.currency)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-(--line) pt-2 font-bold">
                <span>Invoice total</span>
                <span>{formatMoney(payInvoice.total, payInvoice.currency)}</span>
              </div>
              <div className="flex justify-between gap-3 text-(--ink-muted)">
                <span>Already paid</span>
                <span>{formatMoney(payInvoice.paidAmount, payInvoice.currency)}</span>
              </div>
              <div className="flex justify-between gap-3 font-bold">
                <span>Remaining balance</span>
                <span>{formatMoney(payInvoice.balance, payInvoice.currency)}</span>
              </div>
            </div>
          </section>
        )}
        <form
          id="record-payment-form"
          onSubmit={submitPayment}
          className="space-y-4"
        >
          <label className="block text-sm font-semibold">
            Amount
            <input
              required
              type="number"
              min="0.01"
              max={payInvoice?.balance}
              step="0.01"
              value={payAmount}
              onChange={(event) => setPayAmount(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
            />
            <span className="mt-1 block text-xs font-normal leading-5 text-(--ink-muted)">
              Defaults to the current invoice balance. Change it to record a
              partial payment; no payment is recorded until you save.
            </span>
          </label>
          <label className="block text-sm font-semibold">
            Payment method
            <select
              value={payMethod}
              onChange={(event) => setPayMethod(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
            >
              {["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"].map(
                (method) => (
                  <option key={method} value={method}>
                    {method.replaceAll("_", " ")}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Transaction / reference ID{" "}
            <span className="font-normal text-(--ink-muted)">optional</span>
            <input
              maxLength={120}
              value={payReference}
              onChange={(event) => setPayReference(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold">
            Notes{" "}
            <span className="font-normal text-(--ink-muted)">optional</span>
            <textarea
              maxLength={1000}
              value={payNotes}
              onChange={(event) => setPayNotes(event.target.value)}
              className="mt-1.5 min-h-24 w-full rounded-xl border border-(--line) bg-(--input) p-3 text-sm"
            />
          </label>
          <p className="text-xs leading-5 text-(--ink-muted)">
            This records payment for this invoice only. Monthly invoices for
            later billing periods must be issued separately; this does not
            automatically charge future months.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(adjustmentPayment)}
        onClose={() => setAdjustmentPayment(null)}
        title={
          adjustmentKind === "REFUND" ? "Record refund" : "Correct payment"
        }
        description={
          adjustmentPayment
            ? `${adjustmentPayment.kind.replaceAll("_", " ")} of ${formatMoney(adjustmentPayment.amount, dashboard?.currency)}. This adds a new ledger entry and preserves the original record.`
            : ""
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setAdjustmentPayment(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="payment-adjustment-form"
              loading={adjustmentBusy}
            >
              {adjustmentKind === "REFUND"
                ? "Record refund"
                : "Save correction"}
            </Button>
          </>
        }
      >
        <form
          id="payment-adjustment-form"
          onSubmit={submitAdjustment}
          className="space-y-4"
        >
          <label className="block text-sm font-semibold">
            {adjustmentKind === "REFUND" ? "Refund amount" : "Corrected amount"}
            <input
              required
              type="number"
              min={adjustmentKind === "REFUND" ? "0.01" : "0"}
              max={
                adjustmentKind === "REFUND"
                  ? adjustmentPayment?.remainingRefundable
                  : undefined
              }
              step="0.01"
              value={adjustmentAmount}
              onChange={(event) => setAdjustmentAmount(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold">
            Reason
            <textarea
              required
              minLength={4}
              maxLength={500}
              value={adjustmentReason}
              onChange={(event) => setAdjustmentReason(event.target.value)}
              className="mt-1.5 min-h-24 w-full rounded-xl border border-(--line) bg-(--input) p-3 text-sm"
            />
          </label>
          <p className="rounded-xl bg-(--surface-muted) p-3 text-xs leading-5 text-(--ink-muted)">
            This action is recorded in the finance audit log and creates a
            separate receipt or adjustment document.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingPlan)}
        onClose={() => setEditingPlan(null)}
        title="Fee plan terms"
        description="These terms apply to new enrollments. Existing enrollment snapshots remain unchanged."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>
              Cancel
            </Button>
            <Button type="submit" form="fee-plan-form" loading={planBusy}>
              Save fee terms
            </Button>
          </>
        }
      >
        <form id="fee-plan-form" onSubmit={savePlan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Fee name
              <input
                required
                value={planDraft.feeName}
                onChange={(event) =>
                  setPlanDraft({ ...planDraft, feeName: event.target.value })
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-semibold">
              Amount
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={planDraft.price}
                onChange={(event) =>
                  setPlanDraft({ ...planDraft, price: event.target.value })
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-semibold">
              Billing frequency
              <select
                value={planDraft.billingFrequency}
                onChange={(event) =>
                  setPlanDraft({
                    ...planDraft,
                    billingFrequency: event.target.value,
                  })
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              >
                {["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"].map(
                  (frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequency.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Registration fee
              <input
                type="number"
                min="0"
                step="0.01"
                value={planDraft.registrationFee}
                onChange={(event) =>
                  setPlanDraft({
                    ...planDraft,
                    registrationFee: event.target.value,
                  })
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-semibold">
              Tax rate (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={planDraft.taxRate}
                onChange={(event) =>
                  setPlanDraft({ ...planDraft, taxRate: event.target.value })
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              />
            </label>
            {isSuperAdmin && (
              <label className="block text-sm font-semibold">
                Fee terms apply to
                <select
                  value={planDraft.feeBranch}
                  onChange={(event) =>
                    setDraftForPlanTarget(editingPlan!, event.target.value)
                  }
                  className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
                >
                  <option value="">Base plan terms</option>
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!isSuperAdmin && (
              <div className="flex items-center text-sm text-(--ink-muted)">
                These terms apply to your assigned branch.
              </div>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={planDraft.active}
                onChange={(event) =>
                  setPlanDraft({ ...planDraft, active: event.target.checked })
                }
                className="h-4 w-4 accent-(--accent)"
              />
              Active fee structure
            </label>
            <label className="block text-sm font-semibold">
              Effective from
              <input
                type="date"
                value={planDraft.effectiveFrom}
                onChange={(event) =>
                  setPlanDraft({
                    ...planDraft,
                    effectiveFrom: event.target.value,
                  })
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-semibold">
              Effective until
              <input
                type="date"
                value={planDraft.effectiveUntil}
                onChange={(event) =>
                  setPlanDraft({
                    ...planDraft,
                    effectiveUntil: event.target.value,
                  })
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm"
              />
            </label>
          </div>
          <div className="rounded-xl border border-(--line) p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Discount rules</h3>
                <p className="mt-1 text-xs text-(--ink-muted)">
                  Rules can be selected when creating an invoice.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!ruleDraft.name.trim() || !Number(ruleDraft.amount))
                    return;
                  setDiscountRules([
                    ...discountRules,
                    {
                      name: ruleDraft.name.trim(),
                      type: ruleDraft.type as "FIXED" | "PERCENT",
                      amount: Number(ruleDraft.amount),
                      active: true,
                    },
                  ]);
                  setRuleDraft({ name: "", type: "PERCENT", amount: "" });
                }}
              >
                Add rule
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_130px]">
              <input
                aria-label="Discount name"
                placeholder="Discount name"
                value={ruleDraft.name}
                onChange={(event) =>
                  setRuleDraft({ ...ruleDraft, name: event.target.value })
                }
                className="h-10 rounded-lg border border-(--line) bg-(--input) px-3 text-sm"
              />
              <select
                aria-label="Discount type"
                value={ruleDraft.type}
                onChange={(event) =>
                  setRuleDraft({ ...ruleDraft, type: event.target.value })
                }
                className="h-10 rounded-lg border border-(--line) bg-(--input) px-2 text-sm"
              >
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Fixed amount</option>
              </select>
              <input
                aria-label="Discount amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Value"
                value={ruleDraft.amount}
                onChange={(event) =>
                  setRuleDraft({ ...ruleDraft, amount: event.target.value })
                }
                className="h-10 rounded-lg border border-(--line) bg-(--input) px-3 text-sm"
              />
            </div>
            <div className="mt-3 space-y-2">
              {discountRules.map((rule, index) => (
                <div
                  key={`${rule.name}-${index}`}
                  className="flex items-center justify-between rounded-lg bg-(--surface-muted) px-3 py-2 text-sm"
                >
                  <span>
                    {rule.name} ·{" "}
                    {rule.type === "PERCENT"
                      ? `${rule.amount}%`
                      : formatMoney(rule.amount, dashboard?.currency)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${rule.name}`}
                    className="text-(--danger)"
                    onClick={() =>
                      setDiscountRules(
                        discountRules.filter(
                          (_, ruleIndex) => ruleIndex !== index,
                        ),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

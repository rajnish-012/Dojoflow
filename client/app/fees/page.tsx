"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { InvoiceTable, PaymentTable } from "@/components/finance/FinanceTables";
import FeeTermManager from "@/components/finance/FeeTermManager";
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Download,
  Plus,
  RefreshCw,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataFilters,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
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
  getFeeTermPlanOptions,
  getFinanceReport,
  getInvoiceCandidates,
  getInvoices,
  issueInvoice,
  recordPayment,
  refundPayment,
  correctPayment,
  type FeeTermPlanOption,
  type FeeDiscountRule,
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
type DiscountRule = FeeDiscountRule;
type Tab = "invoices" | "payments" | "fee-terms" | "reports";

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
  if (!end || end <= start)
    return `Billing date: ${formatDate(invoice.periodStart)}`;
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
  const [plans, setPlans] = useState<FeeTermPlanOption[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string }[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [invoiceSort, setInvoiceSort] = useState("date-desc");
  const [paymentSort, setPaymentSort] = useState("date-desc");
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
  const [reportBranch, setReportBranch] = useState("");
  const [reportPlan, setReportPlan] = useState("");
  const [reportInvoiceStatus, setReportInvoiceStatus] = useState("");
  const [reportPaymentKind, setReportPaymentKind] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, invoiceData, feeTermPlanData, paymentData] =
        await Promise.all([
          getFinanceDashboard(),
          getInvoices(),
          getFeeTermPlanOptions(),
          getFinancePayments(),
        ]);
      setDashboard(summary);
      setInvoices(invoiceData.invoices);
      setPlans(feeTermPlanData.plans);
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
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const filteredInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => {
          const name =
            typeof invoice.student === "object" ? invoice.student.name : "";
          const branch =
            typeof invoice.branch === "object"
              ? invoice.branch._id
              : invoice.branch;
          return (
            (!invoiceStatusFilter || invoice.status === invoiceStatusFilter) &&
            (!branchFilter || branch === branchFilter) &&
            `${invoice.invoiceNumber} ${name} ${invoice.status}`
              .toLowerCase()
              .includes(search.toLowerCase())
          );
        })
        .sort((a, b) =>
          invoiceSort === "amount-desc"
            ? b.total - a.total
            : invoiceSort === "amount-asc"
              ? a.total - b.total
              : (new Date(a.dueDate).getTime() -
                  new Date(b.dueDate).getTime()) *
                (invoiceSort === "date-asc" ? 1 : -1),
        ),
    [invoices, search, invoiceStatusFilter, branchFilter, invoiceSort],
  );
  const filteredPayments = useMemo(
    () =>
      payments
        .filter((payment) => {
          const student =
            typeof payment.student === "object"
              ? payment.student.name || ""
              : "";
          const invoice =
            typeof payment.invoice === "object"
              ? payment.invoice.invoiceNumber || ""
              : payment.invoice;
          const branch =
            typeof payment.branch === "object"
              ? payment.branch._id
              : payment.branch;
          return (
            (!paymentStatusFilter || payment.kind === paymentStatusFilter) &&
            (!branchFilter || branch === branchFilter) &&
            `${student} ${invoice} ${payment.kind} ${payment.method} ${payment.referenceId || ""}`
              .toLowerCase()
              .includes(search.toLowerCase())
          );
        })
        .sort((a, b) =>
          paymentSort === "amount-desc"
            ? b.amount - a.amount
            : paymentSort === "amount-asc"
              ? a.amount - b.amount
              : (new Date(a.paymentDate).getTime() -
                  new Date(b.paymentDate).getTime()) *
                (paymentSort === "date-asc" ? 1 : -1),
        ),
    [payments, search, paymentStatusFilter, branchFilter, paymentSort],
  );
  const chosenStudent = candidates.find(
    (student) => student._id === selectedStudent,
  );
  const enrollmentOptions = chosenStudent?.planEnrollments || [];
  const selectedEnrollmentRecord = enrollmentOptions.find(
    (enrollment) => enrollment._id === selectedEnrollment,
  );
  const availableDiscounts: DiscountRule[] = (
    selectedEnrollmentRecord?.billingSnapshot?.discountRules || []
  ).filter((rule) => rule.active !== false);

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
      const report = await getFinanceReport({
        branchId: reportBranch,
        planId: reportPlan,
        invoiceStatus: reportInvoiceStatus,
        paymentKind: reportPaymentKind,
        from: reportFrom,
        to: reportTo,
      });
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
      for (const receipt of report.receipts) {
        rows.push([
          "RECEIPT",
          receipt.date,
          receipt.receiptNumber,
          receipt.studentName,
          typeof receipt.branch === "object" ? receipt.branch.name || "" : receipt.branch,
          `${receipt.direction === "DEBIT" ? "-" : ""}${receipt.amount}`,
          receipt.kind,
          `${receipt.invoiceNumber} · ${receipt.method}`,
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
  const reportActiveFilters = [
    ...(reportBranch ? [{ id: "branch", label: `Branch: ${branches.find((item) => item._id === reportBranch)?.name || "Selected"}`, onClear: () => setReportBranch("") }] : []),
    ...(reportPlan ? [{ id: "plan", label: `Plan: ${plans.find((item) => item._id === reportPlan)?.name || "Selected"}`, onClear: () => setReportPlan("") }] : []),
    ...(reportInvoiceStatus ? [{ id: "invoice-status", label: `Invoice: ${reportInvoiceStatus.replaceAll("_", " ")}`, onClear: () => setReportInvoiceStatus("") }] : []),
    ...(reportPaymentKind ? [{ id: "payment-kind", label: `Movement: ${reportPaymentKind.toLowerCase()}`, onClear: () => setReportPaymentKind("") }] : []),
    ...(reportFrom ? [{ id: "from", label: `From: ${reportFrom}`, onClear: () => setReportFrom("") }] : []),
    ...(reportTo ? [{ id: "to", label: `To: ${reportTo}`, onClear: () => setReportTo("") }] : []),
  ];

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

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Today's collection"
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
        <SummaryCard
          title="This month"
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
        <SummaryCard
          title="Outstanding"
          value={
            dashboard
              ? formatMoney(dashboard.metrics.pending, dashboard.currency)
              : "—"
          }
          icon={<WalletCards size={20} />}
          subtitle={
            dashboard
              ? `${dashboard.metrics.partialCount} partially paid`
              : undefined
          }
        />
        <SummaryCard
          title="Overdue"
          value={
            dashboard
              ? formatMoney(dashboard.metrics.overdue, dashboard.currency)
              : "—"
          }
          icon={<ShieldAlert size={20} />}
          subtitle={
            dashboard ? `${dashboard.metrics.overdueCount} invoices` : undefined
          }
        />
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <SummaryCard
          title="Expected in the next 30 days"
          value={
            dashboard
              ? formatMoney(
                  dashboard.metrics.expectedCollection,
                  dashboard.currency,
                )
              : "—"
          }
          icon={<CalendarDays size={20} />}
          subtitle="Scheduled fees due soon"
        />
        <SummaryCard
          title="Partially paid balance"
          value={
            dashboard
              ? formatMoney(dashboard.metrics.partiallyPaid, dashboard.currency)
              : "—"
          }
          icon={<Clock3 size={20} />}
          subtitle={
            dashboard
              ? `${dashboard.metrics.partialCount} partially paid invoices`
              : undefined
          }
        />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-(--line) pb-3">
        {(
          [
            "invoices",
            "payments",
            "fee-terms",
            ...(canReport ? ["reports"] : []),
          ] as Tab[]
        ).map((item) => (
          <button
            key={item}
            className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${tab === item ? "bg-(--accent-soft) text-(--accent)" : "text-(--ink-muted) hover:bg-(--hover-bg)"}`}
            onClick={() => setTab(item)}
          >
            {item === "fee-terms" ? "Fee Terms" : item}
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
        <InvoiceTable
          invoices={filteredInvoices}
          search={search}
          onSearch={setSearch}
          canManage={canManage}
          canCollect={canCollect}
          filters={{
            status: invoiceStatusFilter,
            onStatus: setInvoiceStatusFilter,
            branch: branchFilter,
            onBranch: setBranchFilter,
            sort: invoiceSort,
            onSort: setInvoiceSort,
            branches,
            statuses: [
              { value: "DRAFT", label: "Draft" },
              { value: "ISSUED", label: "Issued" },
              { value: "PARTIALLY_PAID", label: "Partially paid" },
              { value: "PAID", label: "Paid" },
              { value: "OVERDUE", label: "Overdue" },
              { value: "CANCELLED", label: "Cancelled" },
              { value: "REFUNDED", label: "Refunded" },
            ],
          }}
          onIssue={(invoice) => void handleIssue(invoice)}
          onCancel={(invoice) => void handleCancel(invoice)}
          onPay={(invoice) => {
            setPayInvoice(invoice);
            setPayAmount(String(invoice.balance));
            setPaymentKey(`pay-${crypto.randomUUID()}`);
          }}
        />
      ) : tab === "payments" ? (
        <PaymentTable
          payments={filteredPayments}
          currency={dashboard?.currency}
          search={search}
          onSearch={setSearch}
          canRefund={canRefund}
          canManage={canManage}
          filters={{
            status: paymentStatusFilter,
            onStatus: setPaymentStatusFilter,
            branch: branchFilter,
            onBranch: setBranchFilter,
            sort: paymentSort,
            onSort: setPaymentSort,
            branches,
            statuses: [
              { value: "PAYMENT", label: "Payment" },
              { value: "REFUND", label: "Refund" },
              { value: "CORRECTION", label: "Correction" },
            ],
          }}
          onRefund={(payment) => {
            setAdjustmentKind("REFUND");
            setAdjustmentPayment(payment);
            setAdjustmentAmount(String(payment.remainingRefundable));
            setAdjustmentReason("");
            setAdjustmentKey(`refund-${crypto.randomUUID()}`);
          }}
          onCorrect={(payment) => {
            setAdjustmentKind("CORRECTION");
            setAdjustmentPayment(payment);
            setAdjustmentAmount(String(payment.amount));
            setAdjustmentReason("");
            setAdjustmentKey(`correction-${crypto.randomUUID()}`);
          }}
        />
      ) : tab === "fee-terms" ? (
        <FeeTermManager
          plans={plans}
          branches={branches}
          currency={dashboard?.currency}
          canManage={canManage}
          isSuperAdmin={isSuperAdmin}
          currentBranchId={currentBranchId}
        />
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
            <div className="mt-4">
              <DataFilters
                label="Report filters"
                activeFilters={reportActiveFilters}
                onClearAll={() => { setReportBranch(""); setReportPlan(""); setReportInvoiceStatus(""); setReportPaymentKind(""); setReportFrom(""); setReportTo(""); }}
                panelWidth={640}
                contentClassName="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                responsiveToolbar
              >
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">Branch<Select value={reportBranch} onChange={(event) => setReportBranch(event.target.value)}><option value="">All permitted branches</option>{branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}</Select></label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">Training plan<Select value={reportPlan} onChange={(event) => setReportPlan(event.target.value)}><option value="">All plans</option>{plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}</Select></label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">Invoice status<Select value={reportInvoiceStatus} onChange={(event) => setReportInvoiceStatus(event.target.value)}><option value="">All invoice statuses</option>{["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</Select></label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">Payment movement<Select value={reportPaymentKind} onChange={(event) => setReportPaymentKind(event.target.value)}><option value="">All payment movements</option>{["PAYMENT", "REFUND", "CORRECTION"].map((kind) => <option key={kind} value={kind}>{kind[0]}{kind.slice(1).toLowerCase()}</option>)}</Select></label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">From date<Input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} /></label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">To date<Input type="date" min={reportFrom || undefined} value={reportTo} onChange={(event) => setReportTo(event.target.value)} /></label>
              </DataFilters>
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
            the enrollment&apos;s saved fee terms. This form does not accept a client
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
                <div
                  key={`${item.kind}-${index}`}
                  className="flex justify-between gap-3"
                >
                  <span>{item.description}</span>
                  <span className="font-semibold">
                    {formatMoney(item.amount, payInvoice.currency)}
                  </span>
                </div>
              ))}
              {payInvoice.discount > 0 && (
                <div className="flex justify-between gap-3 text-(--ink-muted)">
                  <span>Discount</span>
                  <span>
                    -{formatMoney(payInvoice.discount, payInvoice.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-3 text-(--ink-muted)">
                <span>Tax</span>
                <span>{formatMoney(payInvoice.tax, payInvoice.currency)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-(--line) pt-2 font-bold">
                <span>Invoice total</span>
                <span>
                  {formatMoney(payInvoice.total, payInvoice.currency)}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-(--ink-muted)">
                <span>Already paid</span>
                <span>
                  {formatMoney(payInvoice.paidAmount, payInvoice.currency)}
                </span>
              </div>
              <div className="flex justify-between gap-3 font-bold">
                <span>Remaining balance</span>
                <span>
                  {formatMoney(payInvoice.balance, payInvoice.currency)}
                </span>
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

    </div>
  );
}

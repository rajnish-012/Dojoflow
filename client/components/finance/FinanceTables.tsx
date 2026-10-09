"use client";

import { useState } from "react";
import { Banknote, FileText, RotateCcw, Search } from "lucide-react";
import {
  Badge,
  Button,
  CopyButton,
  DataTableSection,
  DataTableToolbar,
  DataFilters,
  DataSort,
  EmptyState,
  Input,
  Select,
  TableHeading,
  TablePagination,
} from "@/components/ui";
import type { FinancePayment, Invoice } from "@/lib/financeApi";

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
function date(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label data-toolbar-search className="relative w-full lg:w-[340px]">
      <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--ink-faint)" />
      <Input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-11 pl-10" />
    </label>
  );
}

export type FinanceFilters = {
  status: string;
  onStatus: (value: string) => void;
  branch: string;
  onBranch: (value: string) => void;
  sort: string;
  onSort: (value: string) => void;
  branches: { _id: string; name: string }[];
  statuses: { value: string; label: string }[];
};
function FilterSortControls({ filters }: { filters: FinanceFilters }) {
  const active = [
    ...(filters.status
      ? [
          {
            id: "status",
            label: `Status: ${filters.status.replaceAll("_", " ")}`,
            onClear: () => filters.onStatus(""),
          },
        ]
      : []),
    ...(filters.branch
      ? [
          {
            id: "branch",
            label: `Branch: ${filters.branches.find((item) => item._id === filters.branch)?.name || "Selected"}`,
            onClear: () => filters.onBranch(""),
          },
        ]
      : []),
  ];
  return (
    <>
      <DataFilters
        activeFilters={active}
        onClearAll={() => {
          filters.onStatus("");
          filters.onBranch("");
        }}
        responsiveToolbar
      >
        <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
          Status
          <Select
            value={filters.status}
            onChange={(event) => filters.onStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {filters.statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
          Branch
          <Select
            value={filters.branch}
            onChange={(event) => filters.onBranch(event.target.value)}
          >
            <option value="">All branches</option>
            {filters.branches.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </Select>
        </label>
      </DataFilters>
      <DataSort
        value={filters.sort}
        onChange={filters.onSort}
        options={[
          { value: "date-desc", label: "Newest first" },
          { value: "date-asc", label: "Oldest first" },
          { value: "amount-desc", label: "Amount: high to low" },
          { value: "amount-asc", label: "Amount: low to high" },
        ]}
      />
    </>
  );
}

export function InvoiceTable({
  invoices,
  search,
  onSearch,
  canManage,
  canCollect,
  onIssue,
  onCancel,
  onPay,
  filters,
}: {
  invoices: Invoice[];
  search: string;
  onSearch: (value: string) => void;
  canManage: boolean;
  canCollect: boolean;
  onIssue: (invoice: Invoice) => void;
  onCancel: (invoice: Invoice) => void;
  onPay: (invoice: Invoice) => void;
  filters: FinanceFilters;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const totalPages = Math.max(1, Math.ceil(invoices.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const visibleInvoices = invoices.slice((page - 1) * pageSize, page * pageSize);
  const tableFilters = {
    ...filters,
    onStatus: (value: string) => { setCurrentPage(1); filters.onStatus(value); },
    onBranch: (value: string) => { setCurrentPage(1); filters.onBranch(value); },
    onSort: (value: string) => { setCurrentPage(1); filters.onSort(value); },
  };
  return (
    <DataTableSection
        title="Invoices"
        description="Outstanding balances, due dates, and payment receipts."
        icon={<FileText size={18} />}
        toolbar={
          <DataTableToolbar>
            <SearchBox
              value={search}
              onChange={(value) => { setCurrentPage(1); onSearch(value); }}
              placeholder="Search invoices or students"
            />
            <FilterSortControls filters={tableFilters} />
          </DataTableToolbar>
        }
      >
      {!invoices.length ? (
        <EmptyState
          title="No invoices found"
          description="Create an invoice from an active student enrollment to start tracking fees."
          icon={<FileText size={22} />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-(--line) bg-(--surface)">
              <tr>
                <TableHeading>Invoice</TableHeading>
                <TableHeading>Student</TableHeading>
                <TableHeading>Due date</TableHeading>
                <TableHeading>Total / Balance</TableHeading>
                <TableHeading>Status</TableHeading>
                <TableHeading align="right">Actions</TableHeading>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((invoice) => (
                <tr key={invoice._id} className="border-t border-(--line)">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5"><p className="font-semibold">{invoice.invoiceNumber}</p><CopyButton value={invoice.invoiceNumber} label="Invoice number" /></div>
                    <p className="mt-1 text-xs text-(--ink-muted)">
                      {invoice.items.map((item) => item.description).join(", ")}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    {typeof invoice.student === "object"
                      ? invoice.student.name
                      : "Student"}
                  </td>
                  <td className="px-6 py-5">{date(invoice.dueDate)}</td>
                  <td className="px-6 py-5">
                    <p>{money(invoice.total, invoice.currency)}</p>
                    <p className="mt-1 text-xs text-(--ink-muted)">
                      {money(invoice.balance, invoice.currency)} due
                    </p>
                  </td>
                  <td className="px-6 py-5">
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
                  <td className="px-6 py-5">
                    <div className="flex justify-end gap-2">
                      {invoice.status === "DRAFT" && canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onIssue(invoice)}
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
                            onClick={() => onCancel(invoice)}
                          >
                            Cancel
                          </Button>
                        )}
                      {canCollect &&
                        ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(
                          invoice.status,
                        ) && (
                          <Button size="sm" onClick={() => onPay(invoice)}>
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
      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={invoices.length}
        visibleItems={visibleInvoices.length}
        pageSize={pageSize}
        entityLabel="invoices"
        onPrevious={() => setCurrentPage((value) => Math.max(1, value - 1))}
        onNext={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
        onPageSizeChange={(value) => { setPageSize(value); setCurrentPage(1); }}
      />
    </DataTableSection>
  );
}

export function PaymentTable({
  payments,
  currency,
  search,
  onSearch,
  canRefund,
  canManage,
  onRefund,
  onCorrect,
  filters,
}: {
  payments: FinancePayment[];
  currency?: string;
  search: string;
  onSearch: (value: string) => void;
  canRefund: boolean;
  canManage: boolean;
  onRefund: (payment: FinancePayment) => void;
  onCorrect: (payment: FinancePayment) => void;
  filters: FinanceFilters;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const totalPages = Math.max(1, Math.ceil(payments.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const visiblePayments = payments.slice((page - 1) * pageSize, page * pageSize);
  const tableFilters = {
    ...filters,
    onStatus: (value: string) => { setCurrentPage(1); filters.onStatus(value); },
    onBranch: (value: string) => { setCurrentPage(1); filters.onBranch(value); },
    onSort: (value: string) => { setCurrentPage(1); filters.onSort(value); },
  };
  return (
    <DataTableSection
        title="Payment ledger"
        description="Every payment, refund, and correction is kept as a separate record."
        icon={<Banknote size={18} />}
        toolbar={
          <DataTableToolbar>
            <SearchBox
              value={search}
              onChange={(value) => { setCurrentPage(1); onSearch(value); }}
              placeholder="Search ledger"
            />
            <FilterSortControls filters={tableFilters} />
          </DataTableToolbar>
        }
      >
      {!payments.length ? (
        <EmptyState
          title="No payments found"
          description="Collected amounts and later adjustments will appear here."
          icon={<Banknote size={22} />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="border-b border-(--line) bg-(--surface)">
              <tr>
                <TableHeading>Date</TableHeading>
                <TableHeading>Student / Invoice</TableHeading>
                <TableHeading>Movement</TableHeading>
                <TableHeading>Method / Reference</TableHeading>
                <TableHeading>Received by</TableHeading>
                <TableHeading align="right">Actions</TableHeading>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((payment) => {
                const original = payment.kind === "PAYMENT";
                const invoice =
                  typeof payment.invoice === "object"
                    ? payment.invoice.invoiceNumber
                    : payment.invoice;
                const student =
                  typeof payment.student === "object"
                    ? payment.student.name
                    : "Student";
                return (
                  <tr key={payment._id} className="border-t border-(--line)">
                    <td className="whitespace-nowrap px-6 py-5">
                      {date(payment.paymentDate)}
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold">{student}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-(--ink-muted)"><p>{invoice}</p>{invoice && <CopyButton value={invoice} label="Invoice number" />}</div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold">
                        {payment.kind.replaceAll("_", " ")}
                      </p>
                      <p
                        className={`mt-1 text-xs font-semibold ${payment.direction === "CREDIT" ? "text-(--success)" : "text-(--danger)"}`}
                      >
                        {payment.direction === "CREDIT" ? "+" : "−"}
                        {money(payment.amount, currency)}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p>{payment.method.replaceAll("_", " ")}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-(--ink-muted)"><p>{payment.referenceId || payment.reason || "—"}</p>{payment.referenceId && <CopyButton value={payment.referenceId} label="Payment reference" />}</div>
                    </td>
                    <td className="px-6 py-5">
                      {typeof payment.receivedBy === "object"
                        ? payment.receivedBy.name
                        : "Staff"}
                    </td>
                    <td className="px-6 py-5">
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
                        {payment.receipt?.receiptNumber && <CopyButton value={payment.receipt.receiptNumber} label="Receipt number" />}
                        {original &&
                          canRefund &&
                          payment.remainingRefundable > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onRefund(payment)}
                            >
                              Refund
                            </Button>
                          )}
                        {original &&
                          canManage &&
                          !payment.corrected &&
                          payment.remainingRefundable === payment.amount && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCorrect(payment)}
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
      )}
      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={payments.length}
        visibleItems={visiblePayments.length}
        pageSize={pageSize}
        entityLabel="payments"
        onPrevious={() => setCurrentPage((value) => Math.max(1, value - 1))}
        onNext={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
        onPageSizeChange={(value) => { setPageSize(value); setCurrentPage(1); }}
      />
    </DataTableSection>
  );
}

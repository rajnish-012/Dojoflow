"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, ExternalLink, FileText, ReceiptText, WalletCards } from "lucide-react";
import { Badge, Card, LoadingSpinner } from "@/components/ui";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import { getMyFinance, getStudentFinance, type FinanceProfile } from "@/lib/financeApi";
import { toast } from "@/lib/toast";

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function StudentFinancePanel({ studentId }: { studentId?: string }) {
  const canViewAll = useCan(PERMISSIONS.FINANCE_VIEW);
  const canViewOwn = useCan(PERMISSIONS.STUDENT_FINANCE_VIEW);
  const [profile, setProfile] = useState<FinanceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if ((studentId && !canViewAll) || (!studentId && !canViewOwn)) { setLoading(false); return; }
    let active = true;
    (studentId ? getStudentFinance(studentId) : getMyFinance())
      .then((value) => { if (active) setProfile(value); })
      .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Could not load financial profile"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studentId, canViewAll, canViewOwn]);

  if ((studentId && !canViewAll) || (!studentId && !canViewOwn)) return null;
  return (
    <Card padding="lg" className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)"><WalletCards size={19} /></div><div><h2 className="text-lg font-bold">Financial profile</h2><p className="mt-1 text-sm text-(--ink-muted)">Invoices, payments, and available receipts.</p></div></div>
        {!studentId && <Link href="/fees" className="text-sm font-semibold text-(--accent)">Open fees <ExternalLink size={14} className="ml-1 inline" /></Link>}
      </div>
      {loading ? <div className="flex min-h-24 items-center justify-center"><LoadingSpinner /></div> : !profile ? <p className="mt-5 text-sm text-(--ink-muted)">No financial records are available.</p> : <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[{ label: "Total billed", amount: profile.summary.totalBilled }, { label: "Total paid", amount: profile.summary.totalPaid }, { label: "Outstanding", amount: profile.summary.outstanding }, { label: "Overdue", amount: profile.summary.overdue }].map((item) => <div key={item.label} className="rounded-xl border border-(--line) bg-(--surface-muted) p-4"><p className="text-xs text-(--ink-muted)">{item.label}</p><p className="mt-2 text-lg font-bold">{money(item.amount)}</p></div>)}
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><FileText size={16} className="text-(--accent)" />Invoices</h3>{profile.invoices.length ? <div className="space-y-2">{profile.invoices.slice(0, 5).map((invoice) => <div key={invoice._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line) p-3"><div><p className="text-sm font-semibold">{invoice.invoiceNumber}</p><p className="mt-1 text-xs text-(--ink-muted)">Due {new Date(invoice.dueDate).toLocaleDateString("en-IN")} · {money(invoice.total, invoice.currency)}</p></div><div className="flex items-center gap-2"><Badge variant={invoice.status === "PAID" ? "success" : invoice.status === "OVERDUE" ? "danger" : "default"}>{invoice.status.replaceAll("_", " ")}</Badge><span className="text-xs text-(--ink-muted)">{money(invoice.balance, invoice.currency)} due</span></div></div>)}</div> : <p className="text-sm text-(--ink-muted)">No invoices yet.</p>}</section>
          <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Banknote size={16} className="text-(--accent)" />Recent payments and receipts</h3>{profile.payments.length ? <div className="space-y-2">{profile.payments.slice(0, 5).map((payment) => { const receipt = profile.receipts.find((item) => item.payment === payment._id); return <div key={payment._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line) p-3"><div><p className="text-sm font-semibold">{payment.kind.replaceAll("_", " ")} · {money(payment.amount)}</p><p className="mt-1 text-xs text-(--ink-muted)">{payment.method.replaceAll("_", " ")} · {new Date(payment.paymentDate).toLocaleDateString("en-IN")}</p></div>{receipt && <Link href={`${studentId ? "/fees" : "/student-dashboard"}/receipts/${receipt._id}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-(--accent)"><ReceiptText size={14} />Receipt</Link>}</div>; })}</div> : <p className="text-sm text-(--ink-muted)">No payments have been recorded.</p>}</section>
        </div>
      </>}
    </Card>
  );
}

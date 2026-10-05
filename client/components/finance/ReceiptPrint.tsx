"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Printer, ReceiptText } from "lucide-react";
import Link from "next/link";
import { Button, Card, LoadingSpinner } from "@/components/ui";
import { getReceipt, type Receipt } from "@/lib/financeApi";

function amount(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function ReceiptPrint({ receiptId, backHref }: { receiptId: string; backHref: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getReceipt(receiptId).then((result) => { if (active) setReceipt(result.receipt); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Receipt could not be loaded"); });
    return () => { active = false; };
  }, [receiptId]);

  if (error) return <div className="mx-auto max-w-xl p-6 text-center"><h1 className="text-xl font-bold">Receipt unavailable</h1><p className="mt-2 text-sm text-(--ink-muted)">{error}</p><Link href={backHref} className="mt-4 inline-block text-sm font-semibold text-(--accent)">Go back</Link></div>;
  if (!receipt) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;
  const branchName = typeof receipt.branch === "object" ? receipt.branch.name : "";
  const isDebit = receipt.direction === "DEBIT";
  const receiptTitle = receipt.kind === "REFUND" ? "Refund receipt" : receipt.kind === "CORRECTION" ? "Payment correction" : "Payment receipt";
  return (
    <div className="reports-print-root mx-auto max-w-3xl p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden"><Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-(--ink-muted)"><ArrowLeft size={16} />Back</Link><Button variant="primary" leftIcon={<Printer size={16} />} onClick={() => window.print()}>Print receipt</Button></div>
      <Card padding="none" className="overflow-hidden print:rounded-none print:border-0">
        <div className="h-2" style={{ backgroundColor: receipt.academy.primaryColor || "#d52b83" }} />
        <div className="p-6 sm:p-10 print:p-8">
          <div className="flex flex-col gap-5 border-b border-(--line) pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">{receipt.academy.logoUrl ? <img src={receipt.academy.logoUrl} alt="" className="h-14 w-14 rounded-xl border border-(--line) bg-white object-contain p-1" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)"><ReceiptText size={24} /></div>}<div><p className="text-lg font-extrabold">{receipt.academy.name}</p><p className="mt-1 text-xs text-(--ink-muted)">{receipt.academy.address}</p><p className="mt-1 text-xs text-(--ink-muted)">{[receipt.academy.contactEmail, receipt.academy.contactPhone].filter(Boolean).join(" · ")}</p></div></div>
            <div className="sm:text-right"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--accent)">{receiptTitle}</p><p className="mt-1 text-xl font-bold">{receipt.receiptNumber}</p><p className="mt-1 text-sm text-(--ink-muted)">{new Date(receipt.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></div>
          </div>
          <div className="grid gap-5 border-b border-(--line) py-6 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-wide text-(--ink-muted)">Received from</p><p className="mt-2 font-bold">{receipt.studentName}</p><p className="mt-1 text-sm text-(--ink-muted)">{branchName}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-(--ink-muted)">Invoice</p><p className="mt-2 font-bold">{receipt.invoiceNumber}</p><p className="mt-1 text-sm text-(--ink-muted)">Payment method: {receipt.method.replaceAll("_", " ")}</p></div></div>
          <div className="flex items-center justify-between gap-4 py-7"><div><p className="text-sm text-(--ink-muted)">{isDebit ? "Amount refunded or reversed" : "Amount received"}</p><p className="mt-1 text-xs text-(--ink-muted)">{isDebit ? "This document confirms a refund or reversal recorded by the academy." : "This receipt confirms the payment recorded by the academy."}</p></div><p className="text-2xl font-extrabold" style={{ color: receipt.academy.primaryColor }}>{isDebit ? "−" : ""}{amount(receipt.amount, receipt.currency)}</p></div>
          <div className="border-t border-(--line) pt-4 text-center text-xs text-(--ink-muted)">Thank you for training with {receipt.academy.name}.</div>
        </div>
      </Card>
    </div>
  );
}

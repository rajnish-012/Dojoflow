"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, LoadingSpinner } from "@/components/ui";
import { getAvailableEnrollmentFeeTerms, type AvailableFeeTermState, type FeeTerm } from "@/lib/financeApi";
import { formatCurrency } from "@/lib/currency";
import { useAcademyBrand } from "@/components/settings/AcademyBrandProvider";

type Props = {
  planId: string;
  branchId: string;
  startDate: string;
  value: string;
  onChange: (feeTermId: string, currency?: string) => void;
  currency?: string;
  required?: boolean;
};

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "No end date";
}
export default function EnrollmentFeeTermSelect({ planId, branchId, startDate, value, onChange, currency, required = true }: Props) {
  const { settings, initialized } = useAcademyBrand();
  const displayCurrency = currency || settings.currency;
  const money = (amount: number, termCurrency?: string) => {
    const code = termCurrency || displayCurrency;
    return !code && !initialized ? "Loading currency…" : formatCurrency(amount, code);
  };
  const [terms, setTerms] = useState<FeeTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<AvailableFeeTermState | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = `${planId}:${branchId}:${startDate}`;
  const canLoad = Boolean(planId && branchId && startDate);

  useEffect(() => {
    let current = true;
    if (!canLoad) return () => { current = false; };
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      setAvailability(null);
      getAvailableEnrollmentFeeTerms(planId, branchId, startDate)
        .then((result) => { if (current) { setTerms(result.feeTerms); setAvailability(result.availability || null); setLoadedKey(requestKey); } })
        .catch((reason: unknown) => { if (current) { setTerms([]); setAvailability(null); setLoadedKey(requestKey); setError(reason instanceof Error ? reason.message : "Could not load available Fee Terms"); } })
        .finally(() => { if (current) setLoading(false); });
    }, 0);
    return () => { current = false; window.clearTimeout(timer); };
  }, [planId, branchId, startDate, canLoad, requestKey]);

  const availableTerms = useMemo(() => canLoad && loadedKey === requestKey ? terms : [], [canLoad, loadedKey, requestKey, terms]);
  const isLoading = canLoad && (loading || loadedKey !== requestKey);
  const displayedError = loadedKey === requestKey ? error : "";

  useEffect(() => {
    if (value && availableTerms.length && !availableTerms.some((term) => term._id === value)) onChange("", displayCurrency);
  }, [availableTerms, value, onChange, displayCurrency]);

  const selected = availableTerms.find((term) => term._id === value);
  const selectedCurrency = selected?.currency || displayCurrency;
  const fieldClass = "mt-1.5 h-11 w-full rounded-xl border border-(--line) bg-(--input) px-3 text-sm";
  return <div className="space-y-2">
    <label className="block text-sm font-semibold">Fee Term<select className={fieldClass} value={value} onChange={(event) => { const term = availableTerms.find((item) => item._id === event.target.value); onChange(event.target.value, term?.currency || displayCurrency); }} disabled={isLoading || !canLoad || !availableTerms.length} required={required}>
      <option value="">{isLoading ? "Loading available Fee Terms…" : !canLoad ? "Choose plan, branch, and start date first" : displayedError ? "Fee Terms could not be loaded" : availableTerms.length ? "Select a Fee Term" : "No applicable Fee Terms"}</option>
      {availableTerms.map((term) => <option key={term._id} value={term._id}>{term.billingFrequency.replaceAll("_", " ")} · {money(term.amount, term.currency)} · v{term.version}</option>)}
    </select></label>
    {isLoading && <div className="flex items-center gap-2 text-xs text-(--ink-muted)"><LoadingSpinner /> Loading current terms for this start date</div>}
    {displayedError && <p role="alert" className="text-sm text-(--danger)">{displayedError}</p>}
    {!isLoading && !displayedError && canLoad && availableTerms.length === 0 && <p className="text-xs text-(--warning)">{availability?.configuredCount === 0 ? "No Fee Terms are configured for this plan and branch." : availability && availability.inactiveCount + availability.notYetEffectiveCount + availability.expiredCount > 0 ? `Fee Terms exist, but none apply on this start date (${availability.inactiveCount} inactive, ${availability.notYetEffectiveCount} not yet effective, ${availability.expiredCount} expired).` : "There is no active Fee Term for this plan, branch, and start date."}</p>}
    {selected && <div className="rounded-xl border border-(--line) bg-(--surface-muted) p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{selected.billingFrequency.replaceAll("_", " ")} agreement</p><Badge variant="success">Active · v{selected.version}</Badge></div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <p><span className="block text-(--ink-muted)">Amount</span><strong>{money(selected.amount, selectedCurrency)}</strong></p>
        <p><span className="block text-(--ink-muted)">Registration fee</span><strong>{money(selected.registrationFee, selectedCurrency)}</strong></p>
        <p><span className="block text-(--ink-muted)">Tax</span><strong>{selected.taxRate}%</strong></p>
        <p><span className="block text-(--ink-muted)">Effective</span><strong>{dateLabel(selected.effectiveFrom)} – {dateLabel(selected.effectiveUntil)}</strong></p>
      </div>
      {selected.discountRules?.filter((rule) => rule.active !== false).length > 0 && <div className="mt-2 border-t border-(--line) pt-2 text-xs text-(--ink-muted)">Available discounts: {selected.discountRules.filter((rule) => rule.active !== false).map((rule) => `${rule.name} (${rule.type === "PERCENT" ? `${rule.amount}%` : money(rule.amount, selectedCurrency)})`).join(", ")}</div>}
    </div>}
  </div>;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  DataFilters,
  DataTableSection,
  DataTableToolbar,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingSpinner,
  Modal,
  Select,
  TableHeading,
} from "@/components/ui";
import { toast } from "@/lib/toast";
import {
  createPlanFeeTerm,
  getFeeTerms,
  supersedePlanFeeTerm,
  updatePlanFeeTerm,
  type FeeTermPlanOption,
  type FeeTerm,
} from "@/lib/financeApi";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import { useAcademyBrand } from "@/components/settings/AcademyBrandProvider";

type Branch = { _id: string; name: string };
type Props = {
  plans: FeeTermPlanOption[];
  branches: Branch[];
  currency?: string;
  canManage: boolean;
  isSuperAdmin: boolean;
  currentBranchId?: string;
};
type FeeDraft = {
  planId: string;
  branchId: string;
  billingFrequency: FeeTerm["billingFrequency"];
  amount: string;
  registrationFee: string;
  taxRate: string;
  effectiveFrom: string;
  effectiveUntil: string;
};

const emptyDraft = (branchId = ""): FeeDraft => ({
  planId: "",
  branchId,
  billingFrequency: "MONTHLY",
  amount: "",
  registrationFee: "0",
  taxRate: "0",
  effectiveFrom: "",
  effectiveUntil: "",
});
const FREQUENCIES: FeeTerm["billingFrequency"][] = [
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "ONE_TIME",
];

function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}
function showDate(value?: string | null) {
  if (!value) return "Open ended";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function frequencyLabel(value: FeeTerm["billingFrequency"]) {
  return value === "ONE_TIME"
    ? "One time"
    : `${value[0]}${value.slice(1).toLowerCase()}`;
}
function branchName(term: FeeTerm) {
  return typeof term.branch === "object" && term.branch
    ? term.branch.name
    : "All branches";
}
function planId(term: FeeTerm) {
  return typeof term.plan === "object" ? term.plan._id : term.plan;
}

export default function FeeTermManager({
  plans,
  branches,
  currency,
  canManage,
  isSuperAdmin,
  currentBranchId,
}: Props) {
  const { settings: academySettings } = useAcademyBrand();
  const displayCurrency = academySettings.currency || currency || DEFAULT_CURRENCY;
  const [termsByPlan, setTermsByPlan] = useState<Record<string, FeeTerm[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [draft, setDraft] = useState<FeeDraft>(emptyDraft(currentBranchId));
  const [editing, setEditing] = useState<FeeTerm | null>(null);
  const [superseding, setSuperseding] = useState<FeeTerm | null>(null);
  const [viewing, setViewing] = useState<FeeTerm | null>(null);
  const [retiring, setRetiring] = useState<FeeTerm | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { feeTerms } = await getFeeTerms({
        branchId: branchFilter,
        billingFrequency: frequencyFilter,
        status: statusFilter,
      });
      const grouped: Record<string, FeeTerm[]> = {};
      for (const term of feeTerms) {
        const id = planId(term);
        if (id) (grouped[id] ||= []).push(term);
      }
      setTermsByPlan(grouped);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load Fee Terms";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, frequencyFilter, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const visiblePlans = useMemo(
    () =>
      plans
        .map((plan) => ({
          ...plan,
          terms: (termsByPlan[plan._id] || []).filter((term) => {
            const text =
              `${plan.name} ${branchName(term)} ${term.billingFrequency} ${term.status}`.toLowerCase();
            const termBranch =
              typeof term.branch === "object" && term.branch
                ? term.branch._id
                : "";
            return (
              (!search || text.includes(search.toLowerCase())) &&
              (!branchFilter || termBranch === branchFilter || !termBranch) &&
              (!frequencyFilter || term.billingFrequency === frequencyFilter) &&
              (!statusFilter || term.status === statusFilter)
            );
          }),
        }))
        .filter(
          (plan) =>
            plan.terms.length ||
            (!search && !branchFilter && !frequencyFilter && !statusFilter),
        ),
    [plans, termsByPlan, search, branchFilter, frequencyFilter, statusFilter],
  );
  const activeFilters = [
    ...(branchFilter
      ? [
          {
            id: "branch",
            label: `Branch: ${branches.find((item) => item._id === branchFilter)?.name || "Selected"}`,
            onClear: () => setBranchFilter(""),
          },
        ]
      : []),
    ...(frequencyFilter
      ? [
          {
            id: "frequency",
            label: `Frequency: ${frequencyLabel(frequencyFilter as FeeTerm["billingFrequency"])}`,
            onClear: () => setFrequencyFilter(""),
          },
        ]
      : []),
    ...(statusFilter
      ? [
          {
            id: "status",
            label: `Status: ${statusFilter}`,
            onClear: () => setStatusFilter(""),
          },
        ]
      : []),
  ];
  const feeTermFilters = (
    <DataFilters
      activeFilters={activeFilters}
      onClearAll={() => {
        setBranchFilter("");
        setFrequencyFilter("");
        setStatusFilter("");
      }}
      responsiveToolbar
    >
      <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
        Branch
        <Select
          className="mt-1"
          value={branchFilter}
          onChange={(event) => setBranchFilter(event.target.value)}
        >
          <option value="">All permitted branches</option>
          {branches.map((branch) => (
            <option key={branch._id} value={branch._id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
        Billing frequency
        <Select
          className="mt-1"
          value={frequencyFilter}
          onChange={(event) => setFrequencyFilter(event.target.value)}
        >
          <option value="">All frequencies</option>
          {FREQUENCIES.map((value) => (
            <option key={value} value={value}>
              {frequencyLabel(value)}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
        Status
        <Select
          className="mt-1"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          {["ACTIVE", "DRAFT", "RETIRED"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      </label>
    </DataFilters>
  );

  function openCreate(plan: FeeTermPlanOption) {
    setEditing(null);
    setSuperseding(null);
    setDraft({
      ...emptyDraft(currentBranchId),
      planId: plan._id,
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });
    setFormOpen(true);
  }
  function openEdit(term: FeeTerm) {
    setEditing(term);
    setSuperseding(null);
    setDraft({
      planId: planId(term),
      branchId:
        typeof term.branch === "object" && term.branch ? term.branch._id : "",
      billingFrequency: term.billingFrequency,
      amount: String(term.amount),
      registrationFee: String(term.registrationFee || 0),
      taxRate: String(term.taxRate || 0),
      effectiveFrom: dateInput(term.effectiveFrom),
      effectiveUntil: dateInput(term.effectiveUntil),
    });
    setFormOpen(true);
  }
  function openSupersede(term: FeeTerm) {
    setEditing(null);
    setSuperseding(term);
    setDraft({
      planId: planId(term),
      branchId:
        typeof term.branch === "object" && term.branch ? term.branch._id : "",
      billingFrequency: term.billingFrequency,
      amount: String(term.amount),
      registrationFee: String(term.registrationFee || 0),
      taxRate: String(term.taxRate || 0),
      effectiveFrom: "",
      effectiveUntil: "",
    });
    setFormOpen(true);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(draft.amount);
    const registrationFee = Number(draft.registrationFee);
    const taxRate = Number(draft.taxRate);
    if (
      !draft.effectiveFrom ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isFinite(registrationFee) ||
      registrationFee < 0 ||
      !Number.isFinite(taxRate) ||
      taxRate < 0 ||
      taxRate > 100 ||
      (draft.effectiveUntil && draft.effectiveUntil < draft.effectiveFrom)
    ) {
      toast.error("Check the amount, tax, and effective dates.");
      return;
    }
    setBusy(true);
    const payload = {
      ...(editing
        ? {}
        : !superseding
          ? {
              branch: draft.branchId || null,
              billingFrequency: draft.billingFrequency,
            }
          : {}),
      amount,
      registrationFee,
      taxRate,
      effectiveFrom: draft.effectiveFrom,
      effectiveUntil: draft.effectiveUntil || null,
      reason: superseding
        ? "Successor FeeTerm created"
        : editing
          ? "FeeTerm updated"
          : "FeeTerm created",
    };
    try {
      if (superseding) await supersedePlanFeeTerm(superseding._id, payload);
      else if (editing) await updatePlanFeeTerm(editing._id, payload);
      else
        await createPlanFeeTerm(draft.planId, {
          ...payload,
          branch: draft.branchId || null,
          billingFrequency: draft.billingFrequency,
          status: "ACTIVE",
        });
      toast.success(
        superseding
          ? "Fee Term superseded"
          : editing
            ? "Fee Term updated"
            : "Fee Term created",
      );
      setFormOpen(false);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save Fee Term",
      );
    } finally {
      setBusy(false);
    }
  }
  async function retire(term: FeeTerm) {
    setBusy(true);
    try {
      await updatePlanFeeTerm(term._id, {
        status: "RETIRED",
        reason: "FeeTerm retired from Finance",
      });
      toast.success("Fee Term retired");
      setRetiring(null);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not retire Fee Term",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <DataTableSection
        title="Fee Terms"
        description="Manage branch-specific billing terms and effective dates by training plan."
        toolbar={
          <DataTableToolbar>
            <label data-toolbar-search className="relative w-full lg:w-[340px]">
              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--ink-faint)"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Fee Terms"
                aria-label="Search Fee Terms"
                className="h-11 pl-10"
              />
            </label>
            {feeTermFilters}
            <Button
              variant="outline"
              leftIcon={<RefreshCw size={15} />}
              onClick={() => void refresh()}
              disabled={loading}
            >
              Refresh
            </Button>
          </DataTableToolbar>
        }
      >
        {loading ? (
          <Card className="flex min-h-48 items-center justify-center">
            <LoadingSpinner text="Loading Fee Terms..." />
          </Card>
        ) : error ? (
          <ErrorState
            message={error}
            action={
              <Button variant="outline" onClick={() => void refresh()}>
                Try again
              </Button>
            }
          />
        ) : visiblePlans.length === 0 ? (
          <EmptyState
            title="No Fee Terms found"
            description="No plans or fee terms match the current search and filters."
          />
        ) : (
          <div className="space-y-4">
          {visiblePlans.map((plan) => (
            <DataTableSection
              key={plan._id}
              title={plan.name}
              className="m-2 rounded-2xl"
              description="Fee Terms for this training plan"
              toolbar={
                canManage ? (
                  <Button
                    size="sm"
                    leftIcon={<Plus size={15} />}
                    onClick={() => openCreate(plan)}
                    disabled={busy}
                  >
                    Add Fee Term
                  </Button>
                ) : undefined
              }
            >
              {plan.terms.length === 0 ? (
                <EmptyState
                  className="m-4"
                  title="No Fee Terms for this plan"
                  description="Add a fee term to define billing for this training plan."
                  action={
                    canManage ? (
                      <Button
                        size="sm"
                        leftIcon={<Plus size={15} />}
                        onClick={() => openCreate(plan)}
                        disabled={busy}
                      >
                        Add Fee Term
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="border-b border-(--line) bg-(--surface)">
                      <tr>
                        <TableHeading>Branch</TableHeading>
                        <TableHeading>Billing frequency</TableHeading>
                        <TableHeading>Amount</TableHeading>
                        <TableHeading>Effective dates</TableHeading>
                        <TableHeading>Status</TableHeading>
                        <TableHeading>Version</TableHeading>
                        <TableHeading align="right">Actions</TableHeading>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--line)">
                      {plan.terms.map((term) => (
                        <tr
                          key={term._id}
                          className="transition-colors hover:bg-(--hover-bg)"
                        >
                          <td className="px-6 py-5 text-sm">
                            {branchName(term)}
                          </td>
                          <td className="px-6 py-5 text-sm">
                            {frequencyLabel(term.billingFrequency)}
                          </td>
                          <td className="px-6 py-5 text-sm font-semibold">
                            {formatCurrency(term.amount, term.currency || displayCurrency)}
                            <span className="mt-1 block text-xs font-normal text-(--ink-muted)">
                              Registration{" "}
                              {formatCurrency(term.registrationFee, term.currency || displayCurrency)} · Tax{" "}
                              {term.taxRate}%
                            </span>
                          </td>
                          <td className="px-6 py-5 text-sm">
                            {showDate(term.effectiveFrom)}
                            <span className="mt-1 block text-xs text-(--ink-muted)">
                              to {showDate(term.effectiveUntil)}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <Badge
                              variant={
                                term.status === "ACTIVE"
                                  ? "success"
                                  : term.status === "DRAFT"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {term.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-5 text-sm">v{term.version}</td>
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-end gap-2">
                              <IconButton
                                label={`View fee term v${term.version}`}
                                onClick={() => setViewing(term)}
                              >
                                <Eye size={16} />
                              </IconButton>
                              {canManage && term.status !== "RETIRED" && (
                                <>
                                  <IconButton
                                    label={`Edit fee term v${term.version}`}
                                    onClick={() => openEdit(term)}
                                    disabled={busy}
                                  >
                                    <Pencil size={16} />
                                  </IconButton>
                                  {term.status === "ACTIVE" && (
                                    <IconButton
                                      label={`Create successor for fee term v${term.version}`}
                                      onClick={() => openSupersede(term)}
                                      disabled={busy}
                                    >
                                      <RotateCcw size={16} />
                                    </IconButton>
                                  )}
                                  <IconButton
                                    variant="danger"
                                    label={`Retire fee term v${term.version}`}
                                    onClick={() => setRetiring(term)}
                                    disabled={busy}
                                  >
                                    <XCircle size={16} />
                                  </IconButton>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DataTableSection>
          ))}
          </div>
        )}
      </DataTableSection>

      <Modal
        open={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        title={
          superseding
            ? "Supersede Fee Term"
            : editing
              ? "Edit Fee Term"
              : "Add Fee Term"
        }
        description="Training Plan identity is managed in Academy Plans. Fee Terms define branch and billing-specific prices."
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" form="fee-term-form" loading={busy}>
              {superseding
                ? "Create successor"
                : editing
                  ? "Save changes"
                  : "Create Fee Term"}
            </Button>
          </>
        }
      >
        <form
          id="fee-term-form"
          onSubmit={(e) => void submit(e)}
          className="grid gap-4 sm:grid-cols-2"
        >
          {!editing && <p className="rounded-lg bg-(--surface-muted) p-3 text-xs text-(--ink-muted) sm:col-span-2">Amounts entered here will be saved in {displayCurrency}, the current Academy Settings currency.</p>}
          <div className="sm:col-span-2">
            <label htmlFor="fee-term-plan" className="block text-xs font-bold text-(--foreground-soft)">
              Training Plan
            </label>
            <Input
              id="fee-term-plan"
              readOnly
              value={plans.find((item) => item._id === draft.planId)?.name || ""}
              className="mt-1.5 cursor-not-allowed bg-(--surface-muted) text-(--ink-muted)"
            />
          </div>
          <div>
            <label htmlFor="fee-term-branch" className="block text-xs font-bold text-(--foreground-soft)">
              Branch
            </label>
            <Select
              id="fee-term-branch"
              className="mt-1.5"
              disabled={
                Boolean(editing || superseding) ||
                (!isSuperAdmin && Boolean(currentBranchId))
              }
              value={draft.branchId}
              onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="fee-term-frequency" className="block text-xs font-bold text-(--foreground-soft)">
              Billing frequency
            </label>
            <Select
              id="fee-term-frequency"
              className="mt-1.5"
              disabled={Boolean(editing || superseding)}
              value={draft.billingFrequency}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  billingFrequency: e.target
                    .value as FeeTerm["billingFrequency"],
                })
              }
            >
              {FREQUENCIES.map((value) => (
                <option key={value} value={value}>
                  {frequencyLabel(value)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="fee-term-amount" className="block text-xs font-bold text-(--foreground-soft)">
              Amount
            </label>
            <Input
              id="fee-term-amount"
              className="mt-1.5"
              required
              type="number"
              min="0"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="fee-term-registration-fee" className="block text-xs font-bold text-(--foreground-soft)">
              Registration fee
            </label>
            <Input
              id="fee-term-registration-fee"
              className="mt-1.5"
              required
              type="number"
              min="0"
              step="0.01"
              value={draft.registrationFee}
              onChange={(e) =>
                setDraft({ ...draft, registrationFee: e.target.value })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="fee-term-tax-rate" className="block text-xs font-bold text-(--foreground-soft)">
              Tax rate (%)
            </label>
            <Input
              id="fee-term-tax-rate"
              className="mt-1.5"
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draft.taxRate}
              onChange={(e) => setDraft({ ...draft, taxRate: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="fee-term-effective-from" className="block text-xs font-bold text-(--foreground-soft)">
              Effective from
            </label>
            <Input
              id="fee-term-effective-from"
              className="mt-1.5"
              required
              type="date"
              value={draft.effectiveFrom}
              onChange={(e) =>
                setDraft({ ...draft, effectiveFrom: e.target.value })
              }
            />
          </div>
          <div>
            <label htmlFor="fee-term-effective-until" className="block text-xs font-bold text-(--foreground-soft)">
              Effective until (optional)
            </label>
            <Input
              id="fee-term-effective-until"
              className="mt-1.5"
              type="date"
              min={draft.effectiveFrom}
              value={draft.effectiveUntil}
              onChange={(e) =>
                setDraft({ ...draft, effectiveUntil: e.target.value })
              }
            />
          </div>
          {superseding && (
            <p className="sm:col-span-2 rounded-xl bg-(--surface-muted) p-3 text-xs leading-5 text-(--ink-muted)">
              A new version will be created and the current term will be closed
              before the successor starts. Existing enrollment agreements and
              financial documents remain unchanged.
            </p>
          )}
        </form>
      </Modal>
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Fee Term details"
        size="md"
      >
        {viewing && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[
              [
                "Training plan",
                plans.find((item) => item._id === planId(viewing))?.name ||
                  "Plan",
              ],
              ["Branch", branchName(viewing)],
              ["Billing frequency", frequencyLabel(viewing.billingFrequency)],
              ["Amount", formatCurrency(viewing.amount, viewing.currency || displayCurrency)],
              ["Registration fee", formatCurrency(viewing.registrationFee, viewing.currency || displayCurrency)],
              ["Tax rate", `${viewing.taxRate}%`],
              ["Effective from", showDate(viewing.effectiveFrom)],
              ["Effective until", showDate(viewing.effectiveUntil)],
              ["Status", viewing.status],
              ["Version", `v${viewing.version}`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-0 rounded-xl border border-(--line) bg-(--surface) px-3.5 py-3"
              >
                <dt className="text-xs font-semibold text-(--ink-muted)">{label}</dt>
                <dd className="mt-1 break-words text-sm font-bold text-(--foreground)">
                  {label === "Status" ? (
                    <Badge
                      variant={
                        value === "ACTIVE"
                          ? "success"
                          : value === "DRAFT"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {value}
                    </Badge>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
      <ConfirmationDialog
        open={Boolean(retiring)}
        title="Retire Fee Term?"
        description={
          retiring
            ? `Retire the ${frequencyLabel(retiring.billingFrequency)} Fee Term for ${branchName(retiring)}? Existing enrollment agreements will remain unchanged.`
            : ""
        }
        confirmLabel="Retire Fee Term"
        loading={busy}
        onConfirm={() => retiring && void retire(retiring)}
        onClose={() => setRetiring(null)}
      />
    </div>
  );
}

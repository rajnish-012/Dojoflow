"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Clock3,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  DataTableSection,
  DataTableToolbar,
  DataFilters,
  DataSort,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
  TableHeading,
  TablePagination,
  type ActiveFilter,
} from "@/components/ui";
import { getBranches, getPlans } from "@/lib/api";
import { getBatches, type BatchRecord } from "@/lib/batchApi";
import {
  createEnrollment,
  Enrollment,
  getEnrollmentHistory,
  getMembershipDashboard,
  MembershipDashboard,
  renewEnrollment,
  updateEnrollmentStatus,
} from "@/lib/enrollmentApi";
import { useCan } from "@/lib/permissions";
import { useAcademyBrand } from "@/components/settings/AcademyBrandProvider";
import EnrollmentFeeTermSelect from "@/components/finance/EnrollmentFeeTermSelect";

type Branch = { _id: string; name: string; isActive?: boolean };
type Plan = {
  _id: string;
  name: string;
  isActive?: boolean;
  duration?: number;
  durationUnit?: string;
};
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const money = (amount: number, currency: string) =>
  currency
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount || 0)
    : new Intl.NumberFormat().format(amount || 0);
const statusStyle = (
  status: string,
): "success" | "warning" | "danger" | "accent" | "neutral" =>
  status === "ACTIVE" || status === "RENEWED"
    ? "success"
    : status === "EXPIRING"
      ? "warning"
      : status === "EXPIRED" || status === "CANCELLED"
        ? "danger"
        : status === "NEW"
          ? "accent"
          : "neutral";

export default function MembershipsPage() {
  const canView = useCan("membership.view");
  const canManage = useCan("membership.manage");
  const canInvoice = useCan("finance.manage");
  const canViewFinance = useCan("finance.view");
  const { settings: academySettings } = useAcademyBrand();
  const currency = academySettings.currency.trim().toUpperCase();
  const [data, setData] = useState<MembershipDashboard | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState("");
  const [sort, setSort] = useState("expiry-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Enrollment | null>(null);
  const [renewalMode, setRenewalMode] = useState(true);
  const [renewalBranch, setRenewalBranch] = useState("");
  const [history, setHistory] = useState<Enrollment[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState("");
  const [batch, setBatch] = useState("");
  const [feeTerm, setFeeTerm] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [createInvoice, setCreateInvoice] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMembershipDashboard();
      setData(result);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failed to load memberships",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    getMembershipDashboard()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Failed to load memberships",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    if (canManage)
      void Promise.all([getBranches(), getPlans(), getBatches().catch(() => [])])
        .then(([branchResult, planResult, batchResult]) => {
          if (!active) return;
          setBranches(branchResult.branches as Branch[]);
          setPlans((planResult.plans || []) as Plan[]);
          setBatches(batchResult);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [canManage]);

  const filteredRows = useMemo(
    () =>
      (data?.memberships || []).filter((row) => {
        const text =
          `${row.student?.name || ""} ${row.student?.phone || ""} ${row.student?.email || ""} ${row.planName || ""} ${row.branchName || ""}`.toLowerCase();
        return (
          (!search || text.includes(search.toLowerCase())) &&
          (!status || row.lifecycleStatus === status) &&
          (!branch ||
            String(
              (typeof row.branch === "object" ? row.branch?._id : row.branch) ||
                (row.student?.branch &&
                  typeof row.student.branch === "object" &&
                  row.student.branch._id) ||
                "",
            ) === branch)
        );
      }),
    [data, search, status, branch],
  );
  const sortedRows = useMemo(
    () =>
      [...filteredRows].sort((a, b) => {
        if (sort === "name-asc")
          return a.student.name.localeCompare(b.student.name);
        if (sort === "name-desc")
          return b.student.name.localeCompare(a.student.name);
        const left = a.daysRemaining ?? Number.MAX_SAFE_INTEGER;
        const right = b.daysRemaining ?? Number.MAX_SAFE_INTEGER;
        return sort === "expiry-desc" ? right - left : left - right;
      }),
    [filteredRows, sort],
  );
  const rows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters: ActiveFilter[] = [
    ...(status
      ? [
          {
            id: "status",
            label: `Status: ${status.replaceAll("_", " ")}`,
            onClear: () => setStatus(""),
          },
        ]
      : []),
    ...(branch
      ? [
          {
            id: "branch",
            label: `Branch: ${branches.find((item) => item._id === branch)?.name || "Selected"}`,
            onClear: () => setBranch(""),
          },
        ]
      : []),
  ];

  const openRenew = (row: Enrollment, renewal: boolean) => {
    if (!canManage) return;
    setSelected(row);
    setRenewalMode(renewal);
    setRenewalBranch(
      typeof row.branch === "object" ? row.branch?._id || "" : row.branch || "",
    );
    setPlan(
      typeof row.plan === "object" ? row.plan?._id || "" : row.plan || "",
    );
    setFeeTerm("");
    const rowBatch = typeof row.batch === "object" && row.batch ? row.batch._id : row.batch;
    setBatch(rowBatch || "");
    setStartDate(today());
    setCreateInvoice(false);
  };
  const submitEnrollment = async () => {
    if (!canManage || !selected || !plan || !feeTerm || !renewalBranch || !startDate) return;
    setSubmitting(true);
    try {
      const payload = {
        plan,
        branch: renewalBranch,
        feeTerm,
        startDate,
        createInvoice: createInvoice && canInvoice,
        ...(batch ? { batch } : {}),
      };
      const result = renewalMode
        ? await renewEnrollment(selected.student._id, payload)
        : await createEnrollment(selected.student._id, payload);
      if (result.invoiceError) toast.error(result.invoiceError);
      else
        toast.success(
          renewalMode ? "Membership renewed" : "Enrollment created",
        );
      setSelected(null);
      await load();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Enrollment could not be saved",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const availableBatches = batches.filter((item) => item.status === "ACTIVE" && String(typeof item.plan === "object" ? item.plan._id : item.plan) === plan && String(typeof item.branch === "object" ? item.branch._id : item.branch) === renewalBranch);
  const openHistory = async (row: Enrollment) => {
    if (!canView) return;
    try {
      const result = await getEnrollmentHistory(row.student._id);
      setHistory(result.enrollments);
      setSelected(row);
      setHistoryOpen(true);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not load history",
      );
    }
  };
  const setEnrollmentStatus = async (row: Enrollment, nextStatus: string) => {
    if (!canManage) return;
    try {
      await updateEnrollmentStatus(row.student._id, row._id, nextStatus);
      toast.success(`Enrollment ${nextStatus.toLowerCase()}`);
      await load();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Status update failed",
      );
    }
  };

  if (loading && !data)
    return (
      <div className="df-page">
        <LoadingSpinner text="Loading memberships" />
      </div>
    );
  if (error && !data)
    return (
      <div className="df-page">
        <ErrorState
          message={error}
          action={<Button onClick={() => void load()}>Retry</Button>}
        />
      </div>
    );
  const metrics = data?.metrics;
  return (
    <main className="df-page space-y-6">
      <PageHeader
        title="Memberships"
        eyebrow="Academy Management"
        description="Track active plans, upcoming renewals, and each student’s enrollment history."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Active memberships"
          value={metrics?.active || 0}
          subtitle="Current active enrollments"
          icon={<Users size={20} />}
        />
        <SummaryCard
          title="Expiring this week"
          value={metrics?.expiringThisWeek || 0}
          subtitle="Renewal due in 7 days"
          icon={<CalendarDays size={20} />}
        />
        <SummaryCard
          title="Expiring this month"
          value={metrics?.expiringThisMonth || 0}
          subtitle="Renewal due in 30 days"
          icon={<Clock3 size={20} />}
        />
        <SummaryCard
          title="Expired"
          value={metrics?.expired || 0}
          subtitle="Requires renewal"
          icon={<AlertTriangle size={20} />}
        />
        <SummaryCard
          title="Renewal rate"
          value={`${metrics?.renewalRate || 0}%`}
          subtitle="Renewals completed this month"
          icon={<TrendingUp size={20} />}
        />
        <SummaryCard
          title="Renewal revenue"
          value={
            canViewFinance || canInvoice
              ? money(metrics?.renewalRevenue || 0, currency)
              : "Restricted"
          }
          subtitle="Collected from renewals"
          icon={<Banknote size={20} />}
        />
      </section>
      <DataTableSection
        title="Memberships"
        description="Review enrollments, renewal dates, and lifecycle status."
        icon={<Users size={18} />}
        toolbar={
          <DataTableToolbar>
            <div data-toolbar-search className="relative w-full lg:w-[340px]">
              <Input
                aria-label="Search memberships"
                placeholder="Search name, phone, email, plan, branch…"
                className="min-h-11"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <DataFilters
              activeFilters={activeFilters}
              onClearAll={() => {
                setStatus("");
                setBranch("");
                setPage(1);
              }}
              responsiveToolbar
            >
              <label className="grid gap-1 text-xs font-semibold">
                Lifecycle status
                <Select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {[
                    "ACTIVE",
                    "EXPIRING",
                    "EXPIRED",
                    "NEW",
                    "RENEWED",
                    "COMPLETED",
                    "CANCELLED",
                    "PAUSED",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                Branch
                <Select
                  value={branch}
                  onChange={(event) => {
                    setBranch(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All branches</option>
                  {branches.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </label>
            </DataFilters>
            <DataSort
              value={sort}
              onChange={setSort}
              options={[
                { value: "expiry-asc", label: "Expiry: soonest" },
                { value: "expiry-desc", label: "Expiry: latest" },
                { value: "name-asc", label: "Student: A to Z" },
                { value: "name-desc", label: "Student: Z to A" },
              ]}
            />
          </DataTableToolbar>
        }
      >
        {error && (
          <div className="px-5 pt-4">
            <ErrorState message={error} />
          </div>
        )}
        {!rows.length ? (
          <EmptyState
            title="No memberships found"
            description="Memberships appear here when students have an enrollment history."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead>
                <tr className="border-b border-(--line) bg-(--surface)">
                  {[
                    "STUDENT",
                    "PLAN / BRANCH",
                    "START DATE",
                    "END DATE",
                    "LIFECYCLE",
                    "REMAINING",
                    "ACTIONS",
                  ].map((label) => (
                    <TableHeading key={label}>{label}</TableHeading>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row._id}
                    className="border-b border-(--line) last:border-0 hover:bg-(--hover-bg)"
                  >
                    <td className="px-6 py-5">
                      <div className="font-semibold">
                        {row.student?.name || "Student"}
                      </div>
                      <div className="mt-1 text-xs text-(--ink-muted)">
                        {row.student?.phone ||
                          row.student?.email ||
                          "No contact details"}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div>{row.planName}</div>
                      <div className="mt-1 text-xs text-(--ink-muted)">
                        {row.branchName}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {new Date(row.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-5">
                      {row.endDate
                        ? new Date(row.endDate).toLocaleDateString()
                        : "No end date"}
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant={statusStyle(row.lifecycleStatus)}>
                        {row.lifecycleStatus.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      {row.daysRemaining === null
                        ? "—"
                        : row.daysRemaining < 0
                          ? `${Math.abs(row.daysRemaining)} days overdue`
                          : `${row.daysRemaining} days`}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void openHistory(row)}
                        >
                          History
                        </Button>
                        {canManage &&
                          ["ACTIVE", "EXPIRING", "EXPIRED"].includes(
                            row.lifecycleStatus,
                          ) && (
                            <Button
                              size="sm"
                              onClick={() => openRenew(row, true)}
                            >
                              Renew
                            </Button>
                          )}
                        {canManage &&
                          ["COMPLETED", "CANCELLED"].includes(
                            row.lifecycleStatus,
                          ) && (
                            <Button
                              size="sm"
                              onClick={() => openRenew(row, false)}
                            >
                              New enrollment
                            </Button>
                          )}
                        {canManage && row.status === "ACTIVE" && (
                          <Select
                            aria-label={`Update ${row.student?.name} enrollment`}
                            className="h-9 w-32"
                            value=""
                            onChange={(event) => {
                              if (event.target.value)
                                void setEnrollmentStatus(
                                  row,
                                  event.target.value,
                                );
                            }}
                          >
                            <option value="">Manage</option>
                            <option value="PAUSED">Pause</option>
                            <option value="COMPLETED">Complete</option>
                            <option value="CANCELLED">Cancel</option>
                          </Select>
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
          totalPages={Math.max(1, Math.ceil(sortedRows.length / pageSize))}
          totalItems={sortedRows.length}
          visibleItems={rows.length}
          pageSize={pageSize}
          entityLabel="memberships"
          onPrevious={() => setPage((value) => Math.max(1, value - 1))}
          onNext={() =>
            setPage((value) =>
              Math.min(Math.ceil(sortedRows.length / pageSize), value + 1),
            )
          }
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </DataTableSection>
      <Modal
        open={Boolean(selected) && !historyOpen}
        onClose={() => setSelected(null)}
        title={renewalMode ? "Renew membership" : "New enrollment"}
        description={`Create a new enrollment for ${selected?.student?.name || "this student"}. The existing enrollment remains in the history.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              loading={submitting}
              disabled={!canManage || !plan || !feeTerm || !renewalBranch || (availableBatches.length > 0 && !batch) || submitting}
              aria-disabled={!canManage}
              onClick={() => void submitEnrollment()}
            >
              {renewalMode ? "Save renewal" : "Create enrollment"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {renewalMode && selected && (
            <section className="rounded-xl border border-(--line) bg-(--surface-muted) p-4" aria-label="Current enrollment agreement">
              <p className="text-xs font-bold uppercase tracking-wide text-(--ink-muted)">Current agreement</p>
              <p className="mt-1 font-semibold">{selected.planName} · {selected.branchName}</p>
              <p className="mt-1 text-sm text-(--ink-muted)">
                {selected.billingSnapshot?.billingFrequency?.replaceAll("_", " ") || "Billing terms not recorded"}
                {selected.billingSnapshot?.amount !== undefined ? ` · ${money(selected.billingSnapshot.amount, currency)}` : ""}
                {selected.billingSnapshot?.registrationFee ? ` · ${money(selected.billingSnapshot.registrationFee, currency)} registration` : ""}
              </p>
              <p className="mt-2 text-xs text-(--ink-muted)">The new selection below creates a separate agreement. Previous invoices and receipts stay as issued.</p>
            </section>
          )}
          <label className="block space-y-1.5 text-sm font-medium">
            Training and fee plan
            <Select
              value={plan}
              onChange={(event) => { setPlan(event.target.value); setBatch(""); setFeeTerm(""); }}
            >
              <option value="">Choose a plan</option>
              {plans
                .filter((item) => item.isActive !== false)
                .map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
            </Select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Start date
            <Input
              type="date"
              min={today()}
              value={startDate}
              onChange={(event) => { setStartDate(event.target.value); setFeeTerm(""); }}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Branch
            <Select
              value={renewalBranch}
              onChange={(event) => { setRenewalBranch(event.target.value); setBatch(""); setFeeTerm(""); }}
            >
              {branches.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>
          {availableBatches.length > 0 && (
            <label className="block space-y-1.5 text-sm font-medium">
              Batch
              <Select value={batch} onChange={(event) => setBatch(event.target.value)}>
                <option value="">Choose a Batch</option>
                {availableBatches.map((item) => (
                  <option key={item._id} value={item._id} disabled={item.availableSeats !== undefined && item.availableSeats <= 0}>
                    {item.name} ({item.code}) · {item.availableSeats ?? "capacity unknown"} seats available
                  </option>
                ))}
              </Select>
            </label>
          )}
          <EnrollmentFeeTermSelect
            planId={plan}
            branchId={renewalBranch}
            startDate={startDate}
            value={feeTerm}
            currency={currency}
            onChange={setFeeTerm}
          />
          {canInvoice && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={createInvoice}
                onChange={(event) => setCreateInvoice(event.target.checked)}
              />
              Create an invoice for this enrollment
            </label>
          )}
        </div>
      </Modal>
      <Modal
        open={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
          setSelected(null);
        }}
        title="Enrollment history"
        description={selected?.student?.name}
        size="lg"
      >
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line) p-4"
            >
              <div>
                <div className="font-semibold">{item.planName}</div>
                <div className="mt-1 text-xs text-(--ink-muted)">
                  {item.branchName} ·{" "}
                  {new Date(item.startDate).toLocaleDateString()} –{" "}
                  {item.endDate
                    ? new Date(item.endDate).toLocaleDateString()
                    : "Ongoing"}
                </div>
              </div>
              <Badge variant={statusStyle(item.lifecycleStatus)}>
                {item.lifecycleStatus}
              </Badge>
            </div>
          ))}
          {!history.length && <EmptyState title="No enrollment history" />}
        </div>
      </Modal>
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock3,
  List,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Users,
  Kanban,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import { fetchWithSession } from "@/lib/sessionFetch";
import {
  addCrmFollowUp,
  convertCrmLead,
  createCrmLead,
  createCrmTrial,
  CrmLead,
  CrmSummary,
  CrmTrial,
  getCrmPipeline,
  updateCrmLead,
  updateCrmTrial,
} from "@/lib/crmApi";
import {
  Button,
  Badge,
  Card,
  DataTableSection,
  Checkbox,
  DataFilters,
  DataSort,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
  TableHeading,
  TablePagination,
  Textarea,
} from "@/components/ui";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");
const STAGES = [
  { id: "NEW", label: "New", color: "bg-sky-500" },
  { id: "CONTACTED", label: "Contacted", color: "bg-indigo-500" },
  { id: "TRIAL_SCHEDULED", label: "Trial Scheduled", color: "bg-violet-500" },
  { id: "TRIAL_COMPLETED", label: "Trial Completed", color: "bg-amber-500" },
  { id: "INTERESTED", label: "Interested", color: "bg-emerald-500" },
  { id: "CONVERTED", label: "Converted", color: "bg-green-600" },
] as const;
type PlanOption = { _id: string; name: string; isActive: boolean };
type BranchOption = { _id: string; name: string };
type StaffOption = {
  _id: string;
  name: string;
  role: string;
  branch?: { _id: string } | string | null;
  isActive?: boolean;
};
type ProgramOption = { _id: string; name: string; isActive: boolean };
type ModalState = {
  kind: "trial" | "convert" | "details";
  lead: CrmLead;
} | null;
type ViewMode = "pipeline" | "list" | "table";
const PAGE_SIZE = 25;

function branchName(lead: CrmLead) {
  return typeof lead.branch === "object" && lead.branch
    ? lead.branch.name
    : "Branch not set";
}
function branchId(lead: CrmLead) {
  return String(
    typeof lead.branch === "object" && lead.branch
      ? lead.branch._id
      : lead.branch || "",
  );
}
function dateLabel(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
function timeLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function statusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
function statusBadgeVariant(status: string): "success" | "warning" | "danger" | "info" | "accent" | "neutral" {
  if (["CONVERTED", "ENROLLED", "COMPLETED"].includes(status)) return "success";
  if (["LOST", "CLOSED", "NOT_INTERESTED", "MISSED"].includes(status)) return "danger";
  if (["TRIAL_SCHEDULED", "SCHEDULED"].includes(status)) return "info";
  if (["INTERESTED", "PRESENT"].includes(status)) return "accent";
  if (status === "TRIAL_COMPLETED") return "warning";
  return "neutral";
}
function leadStage(status: string) {
  return status === "ENROLLED"
    ? "CONVERTED"
    : status === "CLOSED"
      ? "LOST"
      : status;
}
function overdue(lead: CrmLead) {
  return Boolean(
    lead.nextFollowUpAt &&
    new Date(lead.nextFollowUpAt) < new Date() &&
    !["CONVERTED", "ENROLLED", "LOST", "CLOSED"].includes(lead.status),
  );
}
function statusOptions(status: string) {
  const normalized = leadStage(status);
  const choices: Record<string, string[]> = {
    NEW: ["NEW", "CONTACTED", "LOST"],
    CONTACTED: [
      "CONTACTED",
      "TRIAL_SCHEDULED",
      "INTERESTED",
      "NOT_INTERESTED",
      "LOST",
    ],
    TRIAL_SCHEDULED: [
      "TRIAL_SCHEDULED",
      "CONTACTED",
      "TRIAL_COMPLETED",
      "LOST",
    ],
    TRIAL_COMPLETED: [
      "TRIAL_COMPLETED",
      "INTERESTED",
      "NOT_INTERESTED",
      "LOST",
    ],
    INTERESTED: ["INTERESTED", "TRIAL_SCHEDULED", "NOT_INTERESTED", "LOST"],
    NOT_INTERESTED: ["NOT_INTERESTED", "CONTACTED", "LOST"],
    LOST: ["LOST", "CONTACTED"],
  };
  return choices[normalized] || [normalized];
}

export default function CrmPage() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [trials, setTrials] = useState<CrmTrial[]>([]);
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<StaffOption[]>([]);
  const [coaches, setCoaches] = useState<StaffOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [view, setView] = useState<ViewMode>("pipeline");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [programFilter, setProgramFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [expandedStages, setExpandedStages] = useState<Record<string, number>>(
    {},
  );
  const [listPage, setListPage] = useState(1);

  async function refresh() {
    setError("");
    try {
      const data = await getCrmPipeline();
      setLeads(data.leads);
      setTrials(data.trials);
      setSummary(data.summary);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load the CRM pipeline.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
    void fetchWithSession(`${API_URL}/plans`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { plans?: PlanOption[] }) =>
        setPlans((data.plans || []).filter((plan) => plan.isActive)),
      )
      .catch(() => setPlans([]));
    void Promise.all([
      fetchWithSession(`${API_URL}/branches`, { cache: "no-store" }).then(
        (response) => response.json(),
      ),
      fetchWithSession(`${API_URL}/users`, { cache: "no-store" }).then(
        (response) => response.json(),
      ),
      fetchWithSession(`${API_URL}/training-session-types`, {
        cache: "no-store",
      }).then((response) => response.json()),
    ])
      .then(
        ([branchData, staffData, programData]: [
          { branches?: BranchOption[] },
          { users?: StaffOption[] },
          { types?: ProgramOption[] },
        ]) => {
          setBranches(branchData.branches || []);
          setEmployees(
            (staffData.users || []).filter(
              (person) =>
                person.role !== "STUDENT" && person.isActive !== false,
            ),
          );
          setCoaches(
            (staffData.users || []).filter(
              (person) => person.role === "COACH" && person.isActive !== false,
            ),
          );
          setPrograms(
            (programData.types || []).filter((program) => program.isActive),
          );
        },
      )
      .catch(() => undefined);
  }, []);

  const trialsByLead = useMemo(() => {
    const map = new Map<string, CrmTrial[]>();
    for (const trial of trials)
      map.set(trial.lead, [...(map.get(trial.lead) || []), trial]);
    return map;
  }, [trials]);
  const sources = useMemo(
    () =>
      [
        ...new Set(
          leads
            .map((lead) => lead.source)
            .filter((source): source is string => Boolean(source)),
        ),
      ].sort(),
    [leads],
  );
  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = leads.filter((lead) => {
      const status = leadStage(lead.status);
      const haystack = [
        lead.fullName,
        lead.phone,
        lead.email,
        lead.source,
        branchName(lead),
        lead.programName,
        lead.assignedTo?.name,
      ]
        .join(" ")
        .toLowerCase();
      const created = new Date(lead.createdAt).getTime();
      const end = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Infinity;
      return (
        (!needle || haystack.includes(needle)) &&
        (statusFilter === "ALL" || status === statusFilter) &&
        (branchFilter === "ALL" || branchId(lead) === branchFilter) &&
        (programFilter === "ALL" ||
          lead.program === programFilter ||
          lead.programName === programFilter) &&
        (sourceFilter === "ALL" || lead.source === sourceFilter) &&
        (assigneeFilter === "ALL" || lead.assignedTo?._id === assigneeFilter) &&
        (!fromDate || created >= new Date(`${fromDate}T00:00:00`).getTime()) &&
        created <= end
      );
    });
    return result.sort((a, b) => {
      if (sort === "oldest")
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      if (sort === "name") return a.fullName.localeCompare(b.fullName);
      if (sort === "followup")
        return (
          new Date(a.nextFollowUpAt || "9999-12-31").getTime() -
          new Date(b.nextFollowUpAt || "9999-12-31").getTime()
        );
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [
    leads,
    query,
    statusFilter,
    branchFilter,
    programFilter,
    sourceFilter,
    assigneeFilter,
    fromDate,
    toDate,
    sort,
  ]);
  const filteredByStage = useMemo(() => {
    const map = new Map<string, CrmLead[]>();
    for (const stage of STAGES)
      map.set(
        stage.id,
        filteredLeads.filter((lead) => leadStage(lead.status) === stage.id),
      );
    return map;
  }, [filteredLeads]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await refresh();
      setModal(null);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Unable to save changes.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        createCrmLead({
          name: String(form.get("name")),
          phone: String(form.get("phone")),
          email: String(form.get("email") || ""),
          source: String(form.get("source") || "STAFF"),
          branch: String(form.get("branch") || "") || undefined,
          notes: String(form.get("notes") || ""),
        }),
      "Lead added",
    );
    setShowCreate(false);
  }
  async function handleTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.kind !== "trial") return;
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        createCrmTrial(modal.lead._id, {
          trialDate: String(form.get("trialDate")),
          startTime: String(form.get("startTime")),
          endTime: String(form.get("endTime") || ""),
          program: String(form.get("program") || "") || undefined,
          coach: String(form.get("coach") || "") || undefined,
        }),
      "Trial scheduled",
    );
  }
  async function handleConvert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.kind !== "convert") return;
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        convertCrmLead(modal.lead._id, {
          age: Number(form.get("age")),
          plan: String(form.get("plan")),
          createInvoice: form.get("createInvoice") === "on",
        }),
      "Lead admitted",
    );
  }
  async function handleFollowUp(
    event: FormEvent<HTMLFormElement>,
    lead: CrmLead,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        addCrmFollowUp(lead._id, {
          note: String(form.get("note")),
          dueAt: String(form.get("dueAt") || ""),
          assignedTo: String(form.get("assignedTo") || "") || undefined,
        }),
      "Follow-up saved",
    );
  }
  async function handleLeadNotes(
    event: FormEvent<HTMLFormElement>,
    lead: CrmLead,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () => updateCrmLead(lead._id, { notes: String(form.get("notes") || "") }),
      "Lead notes saved",
    );
  }
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
    setBranchFilter("ALL");
    setProgramFilter("ALL");
    setSourceFilter("ALL");
    setAssigneeFilter("ALL");
    setFromDate("");
    setToDate("");
    setListPage(1);
  };
  const hasFilters = Boolean(
    query ||
    statusFilter !== "ALL" ||
    branchFilter !== "ALL" ||
    programFilter !== "ALL" ||
    sourceFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    fromDate ||
    toDate,
  );
  const activeFilterChips = [
    ...(statusFilter !== "ALL" ? [{ id: "status", label: `Status: ${statusLabel(statusFilter)}`, onClear: () => setStatusFilter("ALL") }] : []),
    ...(branchFilter !== "ALL" ? [{ id: "branch", label: `Branch: ${branches.find((item) => item._id === branchFilter)?.name || "Selected"}`, onClear: () => setBranchFilter("ALL") }] : []),
    ...(programFilter !== "ALL" ? [{ id: "program", label: `Program: ${programs.find((item) => item._id === programFilter)?.name || programFilter}`, onClear: () => setProgramFilter("ALL") }] : []),
    ...(sourceFilter !== "ALL" ? [{ id: "source", label: `Source: ${sourceFilter}`, onClear: () => setSourceFilter("ALL") }] : []),
    ...(assigneeFilter !== "ALL" ? [{ id: "assignee", label: `Staff: ${employees.find((item) => item._id === assigneeFilter)?.name || "Selected"}`, onClear: () => setAssigneeFilter("ALL") }] : []),
    ...(fromDate ? [{ id: "from", label: `From: ${fromDate}`, onClear: () => setFromDate("") }] : []),
    ...(toDate ? [{ id: "to", label: `To: ${toDate}`, onClear: () => setToDate("") }] : []),
  ];
  const changeStatus = (lead: CrmLead, next: string) =>
    void run(
      () => updateCrmLead(lead._id, { status: next }),
      "Lead status updated",
    );

  if (loading)
    return (
      <div className="p-8">
        <LoadingSpinner />
      </div>
    );

  const viewButtons: { mode: ViewMode; label: string; Icon: LucideIcon }[] = [
    { mode: "pipeline", label: "Pipeline", Icon: Kanban },
    { mode: "list", label: "List", Icon: List },
    { mode: "table", label: "Table", Icon: Table2 },
  ];
  const visibleList = filteredLeads.slice(
    (listPage - 1) * PAGE_SIZE,
    listPage * PAGE_SIZE,
  );
  const maxPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const closeModal = () => setModal(null);

  return (
    <main>
      <div className="df-page">
      <PageHeader
        eyebrow="Admissions CRM"
        title="Leads & Trials"
        description="A clear view of every prospect, from first contact to admission."
        actions={
          <>
            <Button variant="outline" onClick={() => { setLoading(true); void refresh(); }} disabled={busy}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreate((value) => !value)}>
              <Plus className="h-4 w-4" />
              Add lead
            </Button>
          </>
        }
      />
      {error && (
        <ErrorState
          className=""
          title="Could not load CRM"
          message={error}
          action={<Button variant="outline" onClick={() => void refresh()}>Retry</Button>}
        />
      )}

      {summary && (
        <section
          aria-label="CRM overview"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {(
            [
              { label: "New leads", value: summary.newLeads, subtitle: "Ready for first contact", Icon: Users },
              {
                label: "Trials this month",
                value: summary.trials,
                subtitle: "Trial sessions scheduled",
                Icon: CalendarPlus,
              },
              {
                label: "Trial conversion",
                value: `${summary.trialConversionRate}%`,
                subtitle: "Completed trials converted",
                Icon: Check,
              },
              { label: "Admissions", value: summary.admissions, subtitle: "New student admissions", Icon: Check },
              {
                label: "Lead conversion",
                value: `${summary.conversionRate}%`,
                subtitle: "Leads converted",
                Icon: ChevronRight,
              },
              {
                label: "Lost leads",
                value: summary.lostLeads,
                subtitle: "Lost or not interested",
                Icon: AlertTriangle,
              },
              {
                label: "Pending follow-ups",
                value: summary.pendingFollowUps,
                subtitle: "Follow-ups awaiting action",
                Icon: Clock3,
              },
            ] as { label: string; value: string | number; subtitle: string; Icon: LucideIcon }[]
          ).map(({ label, value, subtitle, Icon }) => (
            <SummaryCard
              key={label}
              title={label}
              value={value}
              subtitle={subtitle}
              icon={<Icon className="h-5 w-5" />}
            />
          ))}
        </section>
      )}

      {showCreate && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Add a lead</h2>
            <IconButton label="Close add lead form" size="sm" variant="ghost" onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></IconButton>
          </div>
          <form
            onSubmit={handleCreateLead}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <Input
              name="name"
              required
              minLength={2}
              placeholder="Lead name"
              aria-label="Lead name"
            />
            <Input
              name="phone"
              required
              placeholder="Phone number"
              aria-label="Phone number"
            />
            <Input
              name="email"
              type="email"
              placeholder="Email (optional)"
              aria-label="Email"
            />
            <Input
              name="source"
              placeholder="Source (e.g. referral)"
              aria-label="Source"
            />
            <Select
              name="branch"
              required
              aria-label="Branch"
              className="min-w-0"
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Input
              name="notes"
              placeholder="Notes (optional)"
              aria-label="Lead notes"
            />
            <Button type="submit" disabled={busy}>
              Save lead
            </Button>
          </form>
        </Card>
      )}

      {summary && (
        <section className="grid gap-3 xl:grid-cols-3">
          <Card padding="sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold">Lead funnel</h2>
              <span className="text-xs text-(--ink-muted)">
                {leads.length} total
              </span>
            </div>
            <div className="space-y-1.5">
              {summary.funnel.map((stage) => (
                <div
                  key={stage.status}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="w-28 truncate text-(--ink-muted)">
                    {STAGES.find((item) => item.id === stage.status)?.label ||
                      statusLabel(stage.status)}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--line)">
                    <div
                      className="h-full rounded-full bg-(--accent)"
                      style={{
                        width: `${Math.max(stage.count ? 4 : 0, leads.length ? (stage.count / leads.length) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                  <b className="w-7 text-right">{stage.count}</b>
                </div>
              ))}
            </div>
          </Card>
          <Card padding="sm" className="flex h-full flex-col">
            <h2 className="mb-2 text-sm font-bold">Monthly admissions</h2>
            <div className="flex min-h-[150px] flex-1 items-end gap-2">
              {summary.monthlyAdmissions.map((month) => {
                const max = Math.max(
                  1,
                  ...summary.monthlyAdmissions.map((row) => row.admissions),
                );
                return (
                  <div
                    key={month.month}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-0.5"
                  >
                    <span className="text-[10px]">{month.admissions}</span>
                    <div
                      className="w-full max-w-7 rounded-t bg-(--accent)"
                      style={{
                        height: `${Math.max(month.admissions ? 10 : 2, (month.admissions / max) * 65)}%`,
                      }}
                    />
                    <span className="text-[10px] text-(--ink-muted)">
                      {month.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card padding="sm">
            <h2 className="mb-2 text-sm font-bold">Branch conversion</h2>
            <div className="space-y-2">
              {summary.branchConversions.length ? (
                summary.branchConversions.slice(0, 4).map((row) => (
                  <div key={row.branch}>
                    <div className="mb-0.5 flex justify-between gap-2 text-xs">
                      <span className="truncate">{row.branch}</span>
                      <span>
                        {row.conversions}/{row.leads} · {row.conversionRate}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-(--line)">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${row.conversionRate}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-(--ink-muted)">
                  No branch data yet.
                </p>
              )}
            </div>
          </Card>
        </section>
      )}

      <DataTableSection title="All leads" description="View and manage every prospect in your academy." icon={<Users size={18} />} toolbar={
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-start">
            <div className="relative w-full lg:w-[340px]">
              <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--ink-faint)" />
              <Input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setListPage(1); }} placeholder="Search name, phone, email, branch..." aria-label="Search leads" className="h-11 pl-10" />
              {query && <IconButton type="button" label="Clear search" size="sm" variant="ghost" onClick={() => { setQuery(""); setListPage(1); }} className="absolute right-2.5 top-1/2 h-7 w-7 -translate-y-1/2"><X size={15} /></IconButton>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <DataFilters activeFilters={activeFilterChips} onClearAll={clearFilters} label="Filters" panelWidth={390}>
              <label className="grid gap-1 text-xs font-semibold text-(--ink-muted)">Status<Select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{[...STAGES.map((stage) => stage.id), "NOT_INTERESTED", "LOST"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</Select></label>
              <label className="grid gap-1 text-xs font-semibold text-(--ink-muted)">Branch<Select aria-label="Filter by branch" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option value="ALL">All branches</option>{branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}</Select></label>
              <label className="grid gap-1 text-xs font-semibold text-(--ink-muted)">Program<Select aria-label="Filter by program" value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}><option value="ALL">All programs</option>{programs.map((program) => <option key={program._id} value={program._id}>{program.name}</option>)}</Select></label>
              <label className="grid gap-1 text-xs font-semibold text-(--ink-muted)">Source<Select aria-label="Filter by source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="ALL">All sources</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</Select></label>
              <label className="grid gap-1 text-xs font-semibold text-(--ink-muted)">Assigned staff<Select aria-label="Filter by assigned staff" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="ALL">All staff</option>{employees.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}</Select></label>
              <label className="grid gap-1 text-xs font-semibold text-(--ink-muted)">Created from<Input type="date" aria-label="Created from" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
              <label className="grid gap-1 text-xs font-semibold text-(--ink-muted)">Created to<Input type="date" aria-label="Created to" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            </DataFilters>
            <DataSort value={sort} onChange={setSort} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "followup", label: "Next follow-up" }, { value: "name", label: "Name A–Z" }]} />
          </div>
          </div>
      }>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6">
          <p className="text-sm text-(--ink-muted)">
            {hasFilters
              ? `Showing ${filteredLeads.length} of ${leads.length} leads`
              : `${leads.length} leads`}{" "}
            · {trials.length} trials
          </p>
          <div
            className="flex rounded-lg border border-(--line) p-0.5"
            role="group"
            aria-label="Lead view"
          >
            {viewButtons.map(({ mode, label, Icon }) => (
              <Button
                key={mode}
                type="button"
                onClick={() => {
                  setView(mode);
                  setListPage(1);
                }}
                aria-pressed={view === mode}
                size="sm"
                variant={view === mode ? "secondary" : "ghost"}
                className="h-8 px-2.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </DataTableSection>

      {view === "pipeline" && <h2 className="mb-3 text-lg font-bold">Pipeline</h2>}

      {view === "pipeline" && (
        <section
          aria-label="Lead pipeline"
          className="max-w-full overflow-x-auto overflow-y-hidden rounded-xl pb-2 [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]"
        >
          <div className="grid h-[min(66vh,680px)] min-h-[390px] w-max min-w-full grid-flow-col auto-cols-[minmax(248px,290px)] gap-3 2xl:w-full 2xl:auto-cols-fr 2xl:grid-flow-col 2xl:grid-cols-6">
            {STAGES.map((stage) => {
              const rows = filteredByStage.get(stage.id) || [];
              const baseCount = 6;
              const shownCount = expandedStages[stage.id] || baseCount;
              const visible = rows.slice(0, shownCount);
              return (
                <section
                  key={stage.id}
                  aria-label={`${stage.label}: ${rows.length} leads`}
                  className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-(--line) bg-(--surface-subtle)"
                >
                  <header className="shrink-0 border-b border-(--line) bg-(--card) px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${stage.color}`}
                        />
                        <h3 className="truncate text-sm font-bold">
                          {stage.label}
                        </h3>
                      </div>
                      <span className="rounded-full bg-(--surface-subtle) px-2 py-0.5 text-xs font-semibold">
                        {rows.length}
                      </span>
                    </div>
                    {hasFilters && (
                      <p className="mt-1 text-[10px] text-(--ink-muted)">
                        {rows.length} matched
                      </p>
                    )}
                  </header>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2.5 [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]">
                    {visible.map((lead) => (
                      <LeadCard
                        key={lead._id}
                        lead={lead}
                        trialsCount={trialsByLead.get(lead._id)?.length || 0}
                        onOpen={() => setModal({ kind: "details", lead })}
                      />
                    ))}
                    {rows.length === 0 && (
                      <p className="rounded-lg border border-dashed border-(--line) px-3 py-5 text-center text-xs text-(--ink-muted)">
                        {hasFilters
                          ? "No matching leads"
                          : "No leads in this stage"}
                      </p>
                    )}
                    {rows.length > visible.length && (
                      <button
                        onClick={() =>
                          setExpandedStages((current) => ({
                            ...current,
                            [stage.id]: shownCount + 10,
                          }))
                        }
                        className="w-full rounded-lg border border-dashed border-(--line) px-3 py-2 text-xs font-medium text-(--ink-muted) hover:bg-(--card)"
                      >
                        Show next {Math.min(10, rows.length - visible.length)} ·{" "}
                        {rows.length - visible.length} remaining
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}

      {view === "list" && (
        <section className="space-y-2">
          {visibleList.map((lead) => (
            <LeadRow
              key={lead._id}
              lead={lead}
              trialsCount={trialsByLead.get(lead._id)?.length || 0}
              onOpen={() => setModal({ kind: "details", lead })}
            />
          ))}
          {visibleList.length === 0 && <EmptyState title="No leads found" description="Try changing your search or filters." />}
        </section>
      )}
      {view === "table" && (
        <Card padding="none" className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1080px]">
              <thead className="border-b border-(--line) bg-(--surface)">
                <tr>
                  <TableHeading>Lead</TableHeading>
                  <TableHeading>Contact</TableHeading>
                  <TableHeading>Program / Branch</TableHeading>
                  <TableHeading>Assigned</TableHeading>
                  <TableHeading>Status</TableHeading>
                  <TableHeading>Follow-up</TableHeading>
                  <TableHeading>Created</TableHeading>
                  <TableHeading align="right">Action</TableHeading>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--line)">
                {visibleList.map((lead) => (
                  <tr key={lead._id} className="group transition-colors duration-200 hover:bg-(--surface)">
                    <td className="px-6 py-5">
                      <button
                        onClick={() => setModal({ kind: "details", lead })}
                        className="flex items-center gap-3 text-left"
                      >
                        <LeadAvatar name={lead.fullName} />
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold leading-5 text-(--foreground-soft) transition-colors group-hover:text-(--accent)">{lead.fullName}</span>
                          <span className="mt-1 block text-sm leading-5 text-(--ink-muted)">{lead.source || "Lead"}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-5"><p className="text-[15px] font-medium leading-5 text-(--foreground-soft)">{lead.phone}</p><p className="mt-1 max-w-[220px] truncate text-sm leading-5 text-(--ink-muted)">{lead.email || "No email"}</p></td>
                    <td className="px-6 py-5"><p className="text-[15px] font-medium leading-5 text-(--foreground-soft)">{lead.programName || "No program"}</p><p className="mt-1 text-sm leading-5 text-(--ink-muted)">{branchName(lead)}</p></td>
                    <td className="px-6 py-5 text-[15px] leading-5 text-(--foreground-soft)">{lead.assignedTo?.name || "Unassigned"}</td>
                    <td className="px-6 py-5"><Badge variant={statusBadgeVariant(leadStage(lead.status))}>{statusLabel(leadStage(lead.status))}</Badge></td>
                    <td className={`px-6 py-5 text-[15px] leading-5 ${overdue(lead) ? "text-(--danger)" : "text-(--foreground-soft)"}`}>
                      {lead.nextFollowUpAt ? dateLabel(lead.nextFollowUpAt) : "No follow-up"}
                      {overdue(lead) && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}
                    </td>
                    <td className="whitespace-nowrap px-6 py-5 text-[15px] leading-5 text-(--foreground-soft)">{dateLabel(lead.createdAt)}</td>
                    <td className="px-6 py-5 text-right"><IconButton label={`View ${lead.fullName}`} title={`View ${lead.fullName}`} onClick={() => setModal({ kind: "details", lead })}><ArrowUpRight size={16} /></IconButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-4 md:hidden">{visibleList.map((lead) => <LeadRow key={lead._id} lead={lead} trialsCount={trialsByLead.get(lead._id)?.length || 0} onOpen={() => setModal({ kind: "details", lead })} />)}</div>
          {visibleList.length === 0 && <div className="p-5"><EmptyState title="No leads found" description="Try changing your search or filters." icon={<Users size={22} />} /></div>}
        </Card>
      )}

      {view !== "pipeline" && filteredLeads.length > 0 && (
        <TablePagination
          currentPage={listPage}
          totalPages={maxPages}
          totalItems={filteredLeads.length}
          visibleItems={visibleList.length}
          pageSize={PAGE_SIZE}
          entityLabel="leads"
          onPrevious={() => setListPage((page) => Math.max(1, page - 1))}
          onNext={() => setListPage((page) => Math.min(maxPages, page + 1))}
        />
      )}
      {summary && summary.overdueFollowUps > 0 && (
        <p className="flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {summary.overdueFollowUps} overdue follow-up
          {summary.overdueFollowUps === 1 ? "" : "s"} · assigned staff will be
          notified.
        </p>
      )}

      {modal && (
        <Modal
          open
          onClose={closeModal}
          size="lg"
          title={modal.lead.fullName}
          description={modal.kind === "details" ? "Lead details" : modal.kind === "trial" ? "Schedule trial" : "Admission"}
        >
            {modal.kind === "details" ? (
              <LeadDetails
                lead={modal.lead}
                trials={trialsByLead.get(modal.lead._id) || []}
                employees={employees}
                onTrial={() => setModal({ kind: "trial", lead: modal.lead })}
                onConvert={() =>
                  setModal({ kind: "convert", lead: modal.lead })
                }
                onStatus={(status) => changeStatus(modal.lead, status)}
                onFollowUp={(event) => void handleFollowUp(event, modal.lead)}
                onNotes={(event) => void handleLeadNotes(event, modal.lead)}
                onTrialUpdate={(trial, values) =>
                  void run(
                    () => updateCrmTrial(trial._id, values),
                    values.status === "MISSED"
                      ? "Trial marked missed"
                      : "Trial completed",
                  )
                }
                busy={busy}
              />
            ) : modal.kind === "trial" ? (
              <form
                onSubmit={(event) => void handleTrial(event)}
                className="space-y-3"
              >
                <label className="block text-sm">
                  Date
                  <Input
                    name="trialDate"
                    type="date"
                    required
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </label>
                <label className="block text-sm">
                  Start time
                  <Input name="startTime" type="time" required />
                </label>
                <label className="block text-sm">
                  End time
                  <Input name="endTime" type="time" />
                </label>
                <label className="block text-sm">
                  Program (optional)
                  <Select
                    name="program"
                    defaultValue={String(modal.lead.program || "")}
                    className="mt-1"
                  >
                    <option value="">Use lead program / choose later</option>
                    {programs.map((program) => (
                      <option key={program._id} value={program._id}>
                        {program.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block text-sm">
                  Coach (optional)
                  <Select
                    name="coach"
                    defaultValue=""
                    className="mt-1"
                  >
                    <option value="">Unassigned</option>
                    {coaches
                      .filter(
                        (coach) =>
                          String(
                            typeof coach.branch === "object" && coach.branch
                              ? coach.branch._id
                              : coach.branch || "",
                          ) === branchId(modal.lead),
                      )
                      .map((coach) => (
                        <option key={coach._id} value={coach._id}>
                          {coach.name}
                        </option>
                      ))}
                  </Select>
                </label>
                <Button type="submit" disabled={busy}>
                  Schedule trial
                </Button>
              </form>
            ) : (
              <form
                onSubmit={(event) => void handleConvert(event)}
                className="space-y-3"
              >
                <label className="block text-sm">
                  Student age
                  <Input
                    name="age"
                    type="number"
                    required
                    min={1}
                    max={120}
                    defaultValue={modal.lead.age || ""}
                  />
                </label>
                <label className="block text-sm">
                  Training plan
                  <Select
                    name="plan"
                    required
                    defaultValue={String(modal.lead.plan || "")}
                    className="mt-1"
                  >
                    {!modal.lead.plan && (
                      <option value="" disabled>
                        Select a plan
                      </option>
                    )}
                    {plans.map((plan) => (
                      <option key={plan._id} value={plan._id}>
                        {plan.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox name="createInvoice" />
                  Create admission invoice (requires finance permission)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={busy || !plans.length}>
                    Create admission
                  </Button>
                  {!plans.length && (
                    <span className="text-xs text-amber-700">
                      No plan access or active plans found.
                    </span>
                  )}
                </div>
              </form>
            )}
        </Modal>
      )}
      </div>
    </main>
  );
}

function LeadCard({
  lead,
  trialsCount,
  onOpen,
}: {
  lead: CrmLead;
  trialsCount: number;
  onOpen: () => void;
}) {
  return (
    <Card padding="none" className="rounded-lg p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 text-left">
          <h4 className="truncate text-sm font-semibold hover:text-(--accent)">
            {lead.fullName}
          </h4>
          <p className="mt-0.5 truncate text-[11px] text-(--ink-muted)">
            {branchName(lead)}
            {lead.source ? ` · ${lead.source}` : ""}
          </p>
        </button>
        {overdue(lead) && (
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-red-500"
            aria-label="Overdue follow-up"
          />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-(--ink-muted)">
        <a href={`tel:${lead.phone}`} className="hover:text-(--accent)">
          {lead.phone}
        </a>
        {lead.programName && (
          <span className="max-w-full truncate">{lead.programName}</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-(--line) pt-2 text-[11px] text-(--ink-muted)">
        <span
          className={overdue(lead) ? "font-medium text-red-600" : "truncate"}
        >
          {lead.nextFollowUpAt
            ? `Follow-up ${dateLabel(lead.nextFollowUpAt)}`
            : "No follow-up"}
        </span>
        <span className="shrink-0">
          {trialsCount} {trialsCount === 1 ? "trial" : "trials"}
        </span>
      </div>
      <button
        onClick={onOpen}
        className="mt-2 flex w-full items-center justify-between rounded-md bg-(--surface-subtle) px-2.5 py-1.5 text-xs font-medium hover:text-(--accent)"
      >
        Open lead
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </Card>
  );
}

function LeadRow({
  lead,
  trialsCount,
  onOpen,
}: {
  lead: CrmLead;
  trialsCount: number;
  onOpen: () => void;
}) {
  return (
    <Card
      padding="sm"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {lead.fullName}
          </span>
          {overdue(lead) && (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-(--ink-muted)">
          {lead.phone} · {branchName(lead)} <Badge variant={statusBadgeVariant(leadStage(lead.status))}>{statusLabel(leadStage(lead.status))}</Badge>
        </span>
      </button>
      <span className="text-xs text-(--ink-muted)">
        {lead.programName || "No program"} · {trialsCount} trials
      </span>
      <span className="text-xs text-(--ink-muted)">
        {lead.nextFollowUpAt
          ? `Follow-up ${dateLabel(lead.nextFollowUpAt)}`
          : "No follow-up"}
      </span>
      <button
        onClick={onOpen}
        className="flex items-center gap-1 text-xs font-medium text-(--accent)"
      >
        Details
        <ChevronRight className="h-3 w-3" />
      </button>
    </Card>
  );
}

function LeadAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-(--line) bg-(--sidebar-logo-bg) text-xs font-black text-(--gold)">
      {initials || "LD"}
    </span>
  );
}

function LeadDetails({
  lead,
  trials,
  employees,
  onTrial,
  onConvert,
  onStatus,
  onFollowUp,
  onNotes,
  onTrialUpdate,
  busy,
}: {
  lead: CrmLead;
  trials: CrmTrial[];
  employees: StaffOption[];
  onTrial: () => void;
  onConvert: () => void;
  onStatus: (status: string) => void;
  onFollowUp: (event: FormEvent<HTMLFormElement>) => void;
  onNotes: (event: FormEvent<HTMLFormElement>) => void;
  onTrialUpdate: (trial: CrmTrial, values: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const isConverted = ["CONVERTED", "ENROLLED"].includes(lead.status);
  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-xl bg-(--surface-subtle) p-3 sm:grid-cols-2">
        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-(--ink-muted)">Status</p><Badge variant={statusBadgeVariant(leadStage(lead.status))}>{statusLabel(leadStage(lead.status))}</Badge></div>
        <Info label="Branch" value={branchName(lead)} />
        <Info label="Phone" value={lead.phone} href={`tel:${lead.phone}`} />
        <Info
          label="Email"
          value={lead.email || "—"}
          href={lead.email ? `mailto:${lead.email}` : undefined}
        />
        <Info label="Program" value={lead.programName || "—"} />
        <Info label="Source" value={lead.source || "—"} />
        <Info
          label="Assigned staff"
          value={lead.assignedTo?.name || "Unassigned"}
        />
        <Info label="Created" value={dateLabel(lead.createdAt)} />
        <Info
          label="Next follow-up"
          value={
            lead.nextFollowUpAt ? timeLabel(lead.nextFollowUpAt) : "Not set"
          }
        />
        <Info label="Plan" value={lead.planName || "—"} />
        {lead.convertedStudent && (
          <Info
            label="Student"
            value={
              typeof lead.convertedStudent === "object"
                ? lead.convertedStudent.name
                : "Linked"
            }
          />
        )}
      </section>
      {lead.message && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--ink-muted)">
            Original inquiry
          </h3>
          <p className="whitespace-pre-wrap text-sm">{lead.message}</p>
        </section>
      )}
      {(lead.preferredSession || lead.preferredWeeklySessions?.length) && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--ink-muted)">
            Preferred sessions
          </h3>
          {lead.preferredSession && (
            <p className="text-sm">
              {lead.preferredSession.sessionTypeName ||
                lead.preferredSession.sessionName}{" "}
              {lead.preferredSession.startTime
                ? `· ${lead.preferredSession.startTime}`
                : ""}
            </p>
          )}
          {lead.preferredWeeklySessions?.map((session, index) => (
            <p key={`${session.dayName}-${index}`} className="text-sm">
              {session.dayName}:{" "}
              {session.sessionTypeName || session.sessionName}{" "}
              {session.startTime ? `· ${session.startTime}` : ""}
            </p>
          ))}
        </section>
      )}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">
            Trials{" "}
            <span className="font-normal text-(--ink-muted)">
              ({trials.length})
            </span>
          </h3>
          {!isConverted && (
            <Button size="sm" variant="outline" onClick={onTrial}>
              <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
              Schedule
            </Button>
          )}
        </div>
        {trials.length ? (
          <div className="space-y-2">
            {trials.map((trial) => (
              <div
                key={trial._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--line) p-2.5"
              >
                <div>
                  <p className="text-sm font-medium">
                    {dateLabel(trial.trialDate)} · {trial.startTime}
                    {trial.endTime ? `–${trial.endTime}` : ""}
                  </p>
                  <p className="text-xs text-(--ink-muted)">
                    {trial.program?.name ||
                      lead.programName ||
                      "Program not set"}{" "}
                    · {trial.coach?.name || "Coach unassigned"} ·{" "}
                    <Badge variant={statusBadgeVariant(trial.status)}>{statusLabel(trial.status)}</Badge>
                    {trial.attendance
                      ? ` · ${trial.attendance.toLowerCase()}`
                      : ""}
                  </p>
                  {trial.notes && <p className="mt-1 text-xs">{trial.notes}</p>}
                </div>
                {trial.status === "SCHEDULED" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        onTrialUpdate(trial, {
                          status: "COMPLETED",
                          attendance: "PRESENT",
                        })
                      }
                      className="text-xs font-medium text-emerald-700 underline"
                    >
                      Present
                    </button>
                    <button
                      onClick={() => onTrialUpdate(trial, { status: "MISSED" })}
                      className="text-xs font-medium text-amber-700 underline"
                    >
                      Missed
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-(--ink-muted)">No trials scheduled.</p>
        )}
      </section>
      {lead.followUps?.length ? (
        <section>
          <h3 className="mb-2 text-sm font-bold">Follow-up history</h3>
          <ol className="space-y-2">
            {[...lead.followUps].reverse().map((item, index) => (
              <li
                key={item._id || index}
                className="border-l-2 border-(--line) pl-3"
              >
                <p className="text-sm">{item.note}</p>
                <p className="text-xs text-(--ink-muted)">
                  {item.dueAt ? `Due ${timeLabel(item.dueAt)} · ` : ""}
                  {timeLabel(item.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {lead.statusHistory?.length ? (
        <details className="rounded-lg border border-(--line) p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Status history · {lead.statusHistory.length}
          </summary>
          <ol className="mt-3 space-y-2">
            {[...lead.statusHistory].reverse().map((item, index) => (
              <li key={`${item.to}-${index}`} className="text-xs">
                <span className="font-medium">
                  {item.from ? `${statusLabel(item.from)} → ` : ""}
                  {statusLabel(item.to)}
                </span>
                <span className="text-(--ink-muted)">
                  {" "}
                  · {timeLabel(item.changedAt)}
                  {item.note ? ` · ${item.note}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {!isConverted && (
        <>
          <section className="grid gap-3 border-t border-(--line) pt-3 md:grid-cols-2">
            <form onSubmit={onFollowUp} className="space-y-2">
              <h3 className="text-sm font-bold">Add follow-up</h3>
              <Input
                name="note"
                required
                placeholder="Follow-up note"
                aria-label="Follow-up note"
              />
              <Input
                name="dueAt"
                type="datetime-local"
                aria-label="Follow-up date"
              />
              <Select
                name="assignedTo"
                defaultValue=""
                aria-label="Assigned employee"
              >
                <option value="">Assign to me</option>
                {employees
                  .filter(
                    (person) =>
                      !lead.branch ||
                      String(
                        typeof person.branch === "object" && person.branch
                          ? person.branch._id
                          : person.branch || "",
                      ) === branchId(lead),
                  )
                  .map((person) => (
                    <option key={person._id} value={person._id}>
                      {person.name}
                    </option>
                  ))}
              </Select>
              <Button size="sm" type="submit" disabled={busy}>
                Save follow-up
              </Button>
            </form>
            <form onSubmit={onNotes} className="space-y-2">
              <h3 className="text-sm font-bold">Staff notes</h3>
              <Textarea
                name="notes"
                defaultValue={lead.notes || ""}
                maxLength={2000}
                rows={3}
                aria-label="Lead notes"
                placeholder="Add staff notes"
              />
              <Button size="sm" type="submit" disabled={busy}>
                Save notes
              </Button>
            </form>
          </section>
          <section className="flex flex-wrap items-center justify-between gap-3 border-t border-(--line) pt-3">
            <label className="text-xs text-(--ink-muted)">
              Update status
              <Select
                aria-label={`Update ${lead.fullName} status`}
                value={lead.status === "CLOSED" ? "LOST" : lead.status}
                onChange={(event) => onStatus(event.target.value)}
                className="ml-2 inline-block w-auto"
              >
                {statusOptions(lead.status).map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onTrial}>
                <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                Trial
              </Button>
              {["INTERESTED", "TRIAL_COMPLETED", "CONTACTED"].includes(
                lead.status,
              ) && (
                <Button size="sm" onClick={onConvert}>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Admit
                </Button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
function Info({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-(--ink-muted)">
        {label}
      </p>
      {href ? (
        <a className="break-words text-sm hover:text-(--accent)" href={href}>
          {value}
        </a>
      ) : (
        <p className="break-words text-sm">{value}</p>
      )}
    </div>
  );
}

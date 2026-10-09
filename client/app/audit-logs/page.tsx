"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, RefreshCw, Search } from "lucide-react";
import {
  Badge,
  Button,
  DataFilters,
  DataSort,
  DataTableSection,
  DataTableToolbar,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  TableHeading,
  TablePagination,
} from "@/components/ui";
import {
  getAuditLog,
  getAuditLogs,
  type AuditPage,
  type AuditQuery,
  type AuditRecord,
} from "@/lib/auditApi";
import { getBranches, type BranchApiRecord } from "@/lib/api";
import { PERMISSIONS, useCan } from "@/lib/permissions";

const ACTIONS = [
  "STUDENT_CREATED",
  "STUDENT_UPDATED",
  "STUDENT_DEACTIVATED",
  "ENROLLMENT_CHANGED",
  "ATTENDANCE_MARKED",
  "ATTENDANCE_UNDONE",
  "ATTENDANCE_CORRECTION_REQUESTED",
  "ATTENDANCE_CORRECTION_APPROVED",
  "ATTENDANCE_CORRECTION_REJECTED",
  "PAYMENT_CREATED",
  "PAYMENT_CORRECTED",
  "PAYMENT_REFUNDED",
  "INVOICE_CREATED",
  "INVOICE_CANCELLED",
  "PROMOTION_CREATED",
  "PROMOTION_REVERSED",
  "ROLE_CREATED",
  "ROLE_UPDATED",
  "ROLE_DELETED",
  "USER_ROLE_CHANGED",
  "USER_BRANCH_CHANGED",
  "BRANCH_CREATED",
  "BRANCH_UPDATED",
  "BRANCH_DEACTIVATED",
  "SETTINGS_UPDATED",
  "MODULE_CREATED",
  "MODULE_UPDATED",
  "MODULE_DELETED",
  "PERMISSION_ASSIGNED",
  "PERMISSION_REVOKED",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_CHANGED",
  "SESSION_INVALIDATED",
];
const ENTITIES = [
  "STUDENT",
  "ATTENDANCE",
  "PAYMENT",
  "INVOICE",
  "FEE_PLAN",
  "PROMOTION",
  "ROLE",
  "USER",
  "BRANCH",
  "SETTINGS",
  "MODULE",
  "AUTHENTICATION",
  "ENROLLMENT",
];
const blankPage: AuditPage = {
  records: [],
  page: 1,
  pageSize: 25,
  totalItems: 0,
  totalPages: 1,
};
const actorName = (record: AuditRecord) =>
  record.actor?.name || record.actorName || "System";
function when(value: string, zone: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: zone,
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}
function Snapshot({ value }: { value: unknown }) {
  if (!value || typeof value !== "object")
    return (
      <p className="text-sm text-(--ink-muted)">
        {value == null ? "No recorded values" : String(value)}
      </p>
    );
  const fields = Object.entries(value as Record<string, unknown>).slice(0, 50);
  if (!fields.length)
    return <p className="text-sm text-(--ink-muted)">No recorded values</p>;
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {fields.map(([key, item]) => (
        <div key={key} className="min-w-0 rounded-lg bg-(--surface) p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-(--ink-faint)">
            {key.replace(/([A-Z])/g, " $1")}
          </dt>
          <dd className="mt-1 break-words text-sm">
            {typeof item === "object"
              ? JSON.stringify(item)
              : String(item ?? "—")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function AuditLogsPage() {
  const canView = useCan(PERMISSIONS.AUDIT_VIEW);
  const [result, setResult] = useState<AuditPage>(blankPage);
  const [branches, setBranches] = useState<BranchApiRecord[]>([]);
  const [query, setQuery] = useState<AuditQuery>({ page: 1, pageSize: 25 });
  const [draft, setDraft] = useState({
    from: "",
    to: "",
    actor: "",
    action: "",
    entityType: "",
    branchId: "",
    search: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AuditRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const load = useCallback(async (values: AuditQuery) => {
    setLoading(true);
    setError("");
    try {
      setResult(await getAuditLogs(values));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load audit records.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => void load(query), 0);
    return () => window.clearTimeout(timer);
  }, [canView, load, query]);
  useEffect(() => {
    if (canView)
      void getBranches()
        .then((data) => setBranches(data.branches || []))
        .catch(() => setBranches([]));
  }, [canView]);
  const updateFilter = (key: keyof typeof draft, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (key !== "search") setQuery((current) => ({ ...current, ...next, page: 1 }));
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((current) => current.search === draft.search ? current : { ...current, search: draft.search, page: 1 });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft.search]);
  const clear = () => {
    setDraft({
      from: "",
      to: "",
      actor: "",
      action: "",
      entityType: "",
      branchId: "",
      search: "",
    });
    setQuery((current) => ({ page: 1, pageSize: current.pageSize, sort: current.sort }));
  };
  const openDetail = async (item: AuditRecord) => {
    setSelected(item);
    setDetailLoading(true);
    try {
      setSelected(await getAuditLog(item._id));
    } catch {
      /* Keep authorized list snapshot available. */
    } finally {
      setDetailLoading(false);
    }
  };
  const activeFilters = Object.entries(draft)
    .filter(([, value]) => value)
    .map(([key, value]) => ({
      id: key,
      label: `${key}: ${value}`,
      onClear: () => {
        const next = { ...draft, [key]: "" };
        setDraft(next);
        setQuery((current) => ({ ...current, ...next, page: 1 }));
      },
    }));
  if (!canView)
    return (
      <div className="df-page">
        <ErrorState
          title="Access denied"
          message="Your account does not have permission to view audit records."
        />
      </div>
    );

  return (
    <div className="df-page space-y-6">
      <PageHeader
        eyebrow="Security & Compliance"
        title="Audit Log"
        description="Review important changes and security events across the academy."
        actions={
          <Button
            variant="outline"
            onClick={() => void load(query)}
            disabled={loading}
          >
            <RefreshCw size={16} /> Refresh
          </Button>
        }
      />
      <DataTableSection
       className="mt-6"
        title="Audit records"
        description="Historical records are immutable and read only."
        icon={<ClipboardList size={18} />}
        toolbar={
          <DataTableToolbar>
            <div data-toolbar-search className="relative w-full lg:w-[340px]">
              <Search
                  size={17}
                  aria-hidden="true"
                  className="
                  pointer-events-none absolute left-3.5
                  top-1/2 -translate-y-1/2
                  text-(--ink-faint)
                "
                />
            <Input
             type="search"
              value={draft.search}
              onChange={(e) => setDraft((current) => ({ ...current, search: e.target.value }))}
              placeholder="Search actor or entity ID..."
              aria-label="Search actor or entity ID"
              className="h-11 pl-10"
            />
            </div>
          <DataFilters
            label="Filters"
            contentClassName="grid gap-3 sm:grid-cols-2"
            activeFilters={activeFilters}
            onClearAll={clear}
            responsiveToolbar
          >
            <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
              From
              <Input
                className="mt-1"
                type="date"
                value={draft.from}
              onChange={(e) => updateFilter("from", e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-(--ink-muted)">
              To
              <Input
                className="mt-1"
                type="date"
                value={draft.to}
              onChange={(e) => updateFilter("to", e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-(--ink-muted)">
              Actor
              <Input
                className="mt-1"
                value={draft.actor}
                onChange={(e) => updateFilter("actor", e.target.value)}
                placeholder="Name or user ID"
              />
            </label>
            <label className="text-xs font-semibold text-(--ink-muted)">
              Action
              <Select
                className="mt-1"
                value={draft.action}
                onChange={(e) => updateFilter("action", e.target.value)}
              >
                <option value="">All actions</option>
                {ACTIONS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-semibold text-(--ink-muted)">
              Entity
              <Select
                className="mt-1"
                value={draft.entityType}
                onChange={(e) =>
                  updateFilter("entityType", e.target.value)
                }
              >
                <option value="">All entities</option>
                {ENTITIES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-semibold text-(--ink-muted)">
              Branch
              <Select
                className="mt-1"
                value={draft.branchId}
                onChange={(e) =>
                  updateFilter("branchId", e.target.value)
                }
              >
                <option value="">All accessible branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </label>
          </DataFilters>
            <DataSort
              value={query.sort || "createdAt-desc"}
              onChange={(sort) => setQuery((current) => ({ ...current, sort: sort as NonNullable<AuditQuery["sort"]>, page: 1 }))}
              options={[
                { value: "createdAt-desc", label: "Newest first" },
                { value: "createdAt-asc", label: "Oldest first" },
              ]}
            />
          </DataTableToolbar>
        }
      >
        {error ? (
          <div className="p-5">
            <ErrorState
              title="Audit log unavailable"
              message={error}
              action={
                <Button variant="outline" onClick={() => void load(query)}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : loading ? (
          <div className="p-12">
            <LoadingSpinner text="Loading audit records" />
          </div>
        ) : !result.records.length ? (
          <div className="p-5">
            <EmptyState
              title="No audit records found"
              description="Try changing the date range or filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead className="bg-(--surface)">
                <tr>
                  <TableHeading>Timestamp</TableHeading>
                  <TableHeading>Actor</TableHeading>
                  <TableHeading>Action</TableHeading>
                  <TableHeading>Entity</TableHeading>
                  <TableHeading>Entity ID</TableHeading>
                  <TableHeading>Branch</TableHeading>
                  <TableHeading>Summary</TableHeading>
                </tr>
              </thead>
              <tbody>
                {result.records.map((item) => (
                  <tr
                    key={item._id}
                    onClick={() => void openDetail(item)}
                    className="cursor-pointer border-t border-(--line) hover:bg-(--hover-bg)"
                  >
                    <td className="px-6 py-4 text-sm text-(--ink-muted)">
                      {when(item.createdAt, result.timeZone || "Asia/Kolkata")}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      {actorName(item)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="accent">{item.action}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">{item.entityType}</td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {item.entityId ? `#${item.entityId.slice(-8)}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.branch?.name || "Academy"}
                    </td>
                    <td className="px-6 py-4 text-sm text-(--ink-muted)">
                      {item.after && typeof item.after === "object"
                        ? `Updated ${(Object.keys(item.after as object)[0] || "record").replace(/([A-Z])/g, " $1")}`
                        : "Security or system event"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              currentPage={result.page}
              totalPages={result.totalPages}
              totalItems={result.totalItems}
              visibleItems={result.records.length}
              pageSize={result.pageSize}
              entityLabel="audit records"
              onPrevious={() =>
                setQuery({ ...query, page: Math.max(1, query.page - 1) })
              }
              onNext={() =>
                setQuery({
                  ...query,
                  page: Math.min(result.totalPages, query.page + 1),
                })
              }
              onPageSizeChange={(pageSize) =>
                setQuery({ ...query, page: 1, pageSize })
              }
            />
          </div>
        )}
      </DataTableSection>
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Audit record details"
        description="Audit records are read only historical records."
        size="lg"
      >
        {detailLoading ? (
          <LoadingSpinner text="Loading record" />
        ) : (
          selected && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Actor" value={actorName(selected)} />
                <Detail label="Action" value={selected.action} />
                <Detail label="Entity" value={selected.entityType} />
                <Detail label="Entity ID" value={selected.entityId || "—"} />
                <Detail
                  label="Branch"
                  value={selected.branch?.name || "Academy"}
                />
                <Detail
                  label="Timestamp"
                  value={when(
                    selected.createdAt,
                    result.timeZone || "Asia/Kolkata",
                  )}
                />
                <Detail
                  label="IP address"
                  value={selected.ipAddress || "Not available"}
                />
                <Detail
                  label="User agent"
                  value={selected.userAgent || "Not recorded"}
                />
              </div>
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-(--ink-faint)">
                  Before
                </h3>
                <Snapshot value={selected.before} />
              </section>
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-(--ink-faint)">
                  After
                </h3>
                <Snapshot value={selected.after} />
              </section>
              {Boolean(
                selected.metadata &&
                Object.keys(selected.metadata as object).length,
              ) && (
                <section>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-(--ink-faint)">
                    Metadata
                  </h3>
                  <Snapshot value={selected.metadata} />
                </section>
              )}
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-(--surface) p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-(--ink-faint)">
        {label}
      </p>
      <p className="mt-1 break-all text-sm">{value}</p>
    </div>
  );
}

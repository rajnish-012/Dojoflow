"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Badge, Button, DataTableSection, DataFilters, DataSort, ConfirmationDialog, ErrorState, Input, LoadingSpinner, Modal, PageHeader, Select, TableHeading, TablePagination, Textarea, type ActiveFilter } from "@/components/ui";
import { useCan, PERMISSIONS } from "@/lib/permissions";
import { createTrainingSessionType, deleteTrainingSessionType, getTrainingSessionTypes, updateTrainingSessionType, type TrainingSessionTypeRecord } from "@/lib/trainingSessionTypeApi";
import { toast } from "@/lib/toast";

type Draft = { name: string; description: string; icon: string; displayOrder: string };
const emptyDraft: Draft = { name: "", description: "", icon: "", displayOrder: "0" };

export default function TrainingSessionTypesPage() {
  const canCreate = useCan(PERMISSIONS.TRAINING_SESSION_TYPE_CREATE);
  const canUpdate = useCan(PERMISSIONS.TRAINING_SESSION_TYPE_UPDATE);
  const canDelete = useCan(PERMISSIONS.TRAINING_SESSION_TYPE_DELETE);
  const [types, setTypes] = useState<TrainingSessionTypeRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("display-asc");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingSessionTypeRecord | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<TrainingSessionTypeRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTypes(await getTrainingSessionTypes()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load programs."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    getTrainingSessionTypes()
      .then((records) => { if (active) setTypes(records); })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load programs.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const filteredTypes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = types.filter((type) => {
      const matchesSearch = !query || `${type.name} ${type.slug} ${type.description || ""}`.toLowerCase().includes(query);
      const matchesStatus = !statusFilter || (statusFilter === "active" ? type.isActive : !type.isActive);
      return matchesSearch && matchesStatus;
    });
    return filtered.sort((a, b) => {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "sessions-desc") return (b.sessionsCount || 0) - (a.sessionsCount || 0);
      if (sort === "sessions-asc") return (a.sessionsCount || 0) - (b.sessionsCount || 0);
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name);
    });
  }, [types, search, statusFilter, sort]);
  const activeFilters: ActiveFilter[] = statusFilter ? [{
    id: "status",
    label: `Status: ${statusFilter === "active" ? "Active" : "Inactive"}`,
    onClear: () => { setStatusFilter(""); setCurrentPage(1); },
  }] : [];
  const totalPages = Math.max(1, Math.ceil(filteredTypes.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const visibleTypes = filteredTypes.slice((page - 1) * pageSize, page * pageSize);

  function openForm(type?: TrainingSessionTypeRecord) {
    setEditing(type || null);
    setDraft(type ? { name: type.name, description: type.description || "", icon: type.icon || "", displayOrder: String(type.displayOrder ?? 0) } : emptyDraft);
    setModalOpen(true);
  }
  async function save() {
    setSaving(true); setError("");
    try {
      const payload = { ...draft, displayOrder: Number(draft.displayOrder) || 0 };
      if (editing) await updateTrainingSessionType(editing._id, payload);
      else await createTrainingSessionType(payload);
      setModalOpen(false); toast.success(editing ? "Program updated." : "Program created."); await load();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to save the program."); }
    finally { setSaving(false); }
  }
  async function toggle(type: TrainingSessionTypeRecord) {
    try { await updateTrainingSessionType(type._id, { isActive: !type.isActive }); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to update status."); }
  }
  async function remove() {
    if (!deleteTarget) return;
    try { await deleteTrainingSessionType(deleteTarget._id); setDeleteTarget(null); toast.success("Program deleted."); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to delete the type."); setDeleteTarget(null); }
  }

  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader title="Programs" eyebrow="Training setup" description="Manage the programs included in plans and assigned to branch sessions." actions={<><Button variant="outline" onClick={() => void load()}><RefreshCw size={16} />Refresh</Button>{canCreate && <Button onClick={() => openForm()}><Plus size={16} />Add program</Button>}</>} />
    {error && <ErrorState title="Programs" message={error} />}
    {loading ? <LoadingSpinner /> : <DataTableSection
      title="Programs"
      description="Programs used by plans and branch schedules."
      icon={<LayoutGrid size={18} />}
      toolbar={
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-start">
          <label className="relative w-full lg:w-[340px]">
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--ink-faint)" />
            <Input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }}
              placeholder="Search programs..."
              aria-label="Search programs"
              className="h-11 pl-10"
            />
          </label>
          <DataFilters
            activeFilters={activeFilters}
            onClearAll={() => { setSearch(""); setStatusFilter(""); setCurrentPage(1); }}
          >
            <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
              Status
              <Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </label>
          </DataFilters>
          <DataSort
            value={sort}
            onChange={(value) => { setSort(value); setCurrentPage(1); }}
            options={[
              { value: "display-asc", label: "Display order" },
              { value: "name-asc", label: "Name: A to Z" },
              { value: "name-desc", label: "Name: Z to A" },
              { value: "sessions-desc", label: "Sessions: most first" },
              { value: "sessions-asc", label: "Sessions: fewest first" },
            ]}
          />
        </div>
      }
    ><div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse"><thead className="border-b border-(--line) bg-(--surface)"><tr><TableHeading>Program</TableHeading><TableHeading>Description</TableHeading><TableHeading>Status</TableHeading><TableHeading>Scheduled sessions</TableHeading><TableHeading align="right">Actions</TableHeading></tr></thead><tbody className="divide-y divide-(--line)">{visibleTypes.map((type) => <tr key={type._id}><td className="px-6 py-5 text-sm font-semibold text-(--foreground)">{type.name}<span className="mt-1 block text-xs font-normal text-(--ink-muted)">{type.slug}</span></td><td className="px-6 py-5 text-sm text-(--ink-muted)">{type.description || "—"}</td><td className="px-6 py-5"><Badge variant={type.isActive ? "success" : "neutral"}>{type.isActive ? "Active" : "Inactive"}</Badge></td><td className="px-6 py-5 text-sm text-(--ink-muted)">{type.sessionsCount || 0}</td><td className="px-6 py-5"><div className="flex justify-end gap-2">{canUpdate && <><Button size="sm" variant="outline" onClick={() => openForm(type)}><Pencil size={14} />Edit</Button><Button size="sm" variant="outline" onClick={() => void toggle(type)}>{type.isActive ? "Deactivate" : "Activate"}</Button></>}{canDelete && !type.sessionsCount && <Button size="sm" variant="danger" onClick={() => setDeleteTarget(type)} aria-label={`Delete ${type.name}`}><Trash2 size={14} /></Button>}</div></td></tr>)}{filteredTypes.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-(--ink-muted)">{types.length === 0 ? "No programs yet. Add one to make it available in branch schedules." : "No programs match the current search and filters."}</td></tr>}</tbody></table></div><TablePagination currentPage={page} totalPages={totalPages} totalItems={filteredTypes.length} visibleItems={visibleTypes.length} pageSize={pageSize} entityLabel="programs" onPrevious={() => setCurrentPage((value) => Math.max(1, value - 1))} onNext={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} onPageSizeChange={(value) => { setPageSize(value); setCurrentPage(1); }} /></DataTableSection>}
    <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? "Edit program" : "Add program"} description="Programs are included in plans; scheduled sessions assign a time and branch to a program." footer={<><Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} loading={saving}>{editing ? "Save changes" : "Create program"}</Button></>}>
      <div className="space-y-4"><label className="block text-sm font-semibold">Name<Input autoFocus value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Yoga" /></label><label className="block text-sm font-semibold">Description<Textarea value={draft.description} maxLength={500} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} /></label><label className="block text-sm font-semibold">Icon key (optional)<Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="e.g. Activity" /></label><label className="block text-sm font-semibold">Display order<Input type="number" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: e.target.value })} /></label></div>
    </Modal>
    <ConfirmationDialog open={Boolean(deleteTarget)} title="Delete program?" description={deleteTarget ? `Delete ${deleteTarget.name}? This cannot be undone.` : ""} confirmLabel="Delete program" onConfirm={() => void remove()} onClose={() => setDeleteTarget(null)} />
  </div>;
}

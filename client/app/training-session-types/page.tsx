"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, Card, ConfirmationDialog, ErrorState, Input, LoadingSpinner, Modal, PageHeader, TableHeading, Textarea } from "@/components/ui";
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
  useEffect(() => { void load(); }, [load]);

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
    {loading ? <LoadingSpinner /> : <Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse"><thead className="border-b border-(--line) bg-(--surface-muted)"><tr><TableHeading>Type</TableHeading><TableHeading>Description</TableHeading><TableHeading>Status</TableHeading><TableHeading>Sessions</TableHeading><TableHeading align="right">Actions</TableHeading></tr></thead><tbody className="divide-y divide-(--line)">{types.map((type) => <tr key={type._id}><td className="px-6 py-4 text-sm font-semibold text-(--foreground)">{type.name}<span className="mt-1 block text-xs font-normal text-(--ink-muted)">{type.slug}</span></td><td className="px-6 py-4 text-sm text-(--ink-muted)">{type.description || "—"}</td><td className="px-6 py-4"><Badge variant={type.isActive ? "success" : "neutral"}>{type.isActive ? "Active" : "Inactive"}</Badge></td><td className="px-6 py-4 text-sm text-(--ink-muted)">{type.sessionsCount || 0}</td><td className="px-6 py-4"><div className="flex justify-end gap-2">{canUpdate && <><Button size="sm" variant="outline" onClick={() => openForm(type)}><Pencil size={14} />Edit</Button><Button size="sm" variant="outline" onClick={() => void toggle(type)}>{type.isActive ? "Deactivate" : "Activate"}</Button></>}{canDelete && !type.sessionsCount && <Button size="sm" variant="danger" onClick={() => setDeleteTarget(type)} aria-label={`Delete ${type.name}`}><Trash2 size={14} /></Button>}</div></td></tr>)}{types.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-(--ink-muted)">No training session types yet. Add one to make it available in branch schedules.</td></tr>}</tbody></table></div></Card>}
    <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? "Edit program" : "Add program"} description="Programs are included in plans; scheduled sessions assign a time and branch to a program." footer={<><Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} loading={saving}>{editing ? "Save changes" : "Create program"}</Button></>}>
      <div className="space-y-4"><label className="block text-sm font-semibold">Name<Input autoFocus value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Yoga" /></label><label className="block text-sm font-semibold">Description<Textarea value={draft.description} maxLength={500} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} /></label><label className="block text-sm font-semibold">Icon key (optional)<Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="e.g. Activity" /></label><label className="block text-sm font-semibold">Display order<Input type="number" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: e.target.value })} /></label></div>
    </Modal>
    <ConfirmationDialog open={Boolean(deleteTarget)} title="Delete program?" description={deleteTarget ? `Delete ${deleteTarget.name}? This cannot be undone.` : ""} confirmLabel="Delete program" onConfirm={() => void remove()} onClose={() => setDeleteTarget(null)} />
  </div>;
}

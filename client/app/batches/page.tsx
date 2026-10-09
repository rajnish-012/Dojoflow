"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Layers3, Plus, RefreshCw } from "lucide-react";
import { Badge, Button, Card, DataTableSection, EmptyState, ErrorState, Input, LoadingSpinner, Modal, PageHeader, Select, TableHeading } from "@/components/ui";
import { createBatch, getBatchCoaches, getBatches, updateBatch, type BatchRecord } from "@/lib/batchApi";
import { getBranches, getPlans } from "@/lib/api";
import { useCan, PERMISSIONS } from "@/lib/permissions";
import { toast } from "@/lib/toast";
import { getBranchRooms, type BranchRoom } from "@/lib/branchScheduleApi";

type Choice = { _id: string; name: string; isActive?: boolean; classesPerWeek?: number };
type CoachChoice = { _id: string; name: string };
const label = (value: BatchRecord["branch"] | BatchRecord["plan"]) => typeof value === "string" ? value : value?.name || "—";
const todayKey = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const emptyForm = () => ({ name: "", code: "", branch: "", plan: "", capacity: "20", room: "", roomId: "", coach: "", startDate: todayKey() });

export default function BatchesPage() {
  const canView = useCan(PERMISSIONS.PLAN_VIEW);
  const canManage = useCan(PERMISSIONS.PLAN_MANAGE);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [branches, setBranches] = useState<Choice[]>([]);
  const [plans, setPlans] = useState<Choice[]>([]);
  const [coaches, setCoaches] = useState<CoachChoice[]>([]);
  const [roomsByBranch, setRoomsByBranch] = useState<Record<string, BranchRoom[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BatchRecord | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [loadedBatches, branchResponse, planResponse] = await Promise.all([getBatches(), getBranches(), getPlans()]);
      setBatches(loadedBatches);
      setBranches((branchResponse.branches || []).filter((item) => item.isActive !== false).map((item) => ({ _id: item._id, name: item.name })));
      const activeBranches = (branchResponse.branches || []).filter((item) => item.isActive !== false);
      const roomEntries = await Promise.all(activeBranches.map(async (item) => [item._id, await getBranchRooms(item._id).catch(() => [])] as const));
      setRoomsByBranch(Object.fromEntries(roomEntries));
      setPlans(((planResponse.plans || []) as Choice[]).filter((item) => item.isActive !== false));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load Batches."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // Initial page data fetch synchronizes with the external API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    if (!form.branch) return () => { active = false; };
    void getBatchCoaches(form.branch).then((result) => { if (active) setCoaches(result); }).catch(() => { if (active) setCoaches([]); });
    return () => { active = false; };
  }, [form.branch]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, capacity: Number(form.capacity), coach: form.coach || undefined, roomId: form.roomId || undefined };
      const result = editing ? await updateBatch(editing._id, payload) : await createBatch(payload);
      toast.success(result.message || (editing ? "Batch updated." : "Batch created.")); setOpen(false); setEditing(null);
      setForm(emptyForm());
      await load();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to create Batch."); }
    finally { setSaving(false); }
  }

  async function changeStatus(batch: BatchRecord) {
    const status = batch.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try { await updateBatch(batch._id, { status }); toast.success(status === "ACTIVE" ? "Batch activated." : "Batch paused."); await load(); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to update Batch."); }
  }

  async function recalculateBatch(batch: BatchRecord) {
    try { await updateBatch(batch._id, { status: "ACTIVE" }); toast.success("Batch completion date recalculated."); await load(); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to recalculate Batch completion."); }
  }

  function editBatch(batch: BatchRecord) {
    setEditing(batch);
    setForm({ name: batch.name, code: batch.code, branch: typeof batch.branch === "string" ? batch.branch : batch.branch._id, plan: typeof batch.plan === "string" ? batch.plan : batch.plan._id, capacity: String(batch.capacity), room: batch.room || "", roomId: typeof batch.roomId === "string" ? batch.roomId : batch.roomId?._id || "", coach: typeof batch.coach === "string" ? batch.coach : batch.coach?._id || "", startDate: batch.startDate || batch.effectiveFrom || todayKey() });
    setOpen(true);
  }

  if (!canView) return <div className="df-page"><ErrorState title="Access restricted" message="Your account does not have permission to view Batches." /></div>;
  return <div className="df-page">
    <PageHeader eyebrow="Academy Management" title="Batches" description="Create capacity-limited groups under Plans, then assign their weekly sessions in each Branch schedule. Draft, paused, and inactive Batches are hidden from both calendars." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>Refresh</Button>{canManage && <Button onClick={() => { setEditing(null); setForm(emptyForm()); setOpen(true); }}><Plus size={16}/>Create Batch</Button>}</div>} />
    {!loading && batches.some((batch) => batch.status === "DRAFT") && <Card className="mb-4 border-(--warning)/30 bg-(--warning-soft)"><p className="text-sm font-semibold">Draft Batches do not appear in Training Availability or Academy Calendar.</p><p className="mt-1 text-sm text-(--ink-muted)">Configure the required weekly sessions and publish at least one Curriculum learning step for the Plan. Then use Activate on the Batch; activation calculates its completion date and makes eligible future sessions visible.</p></Card>}
    {error ? <ErrorState title="Batches could not be loaded" message={error} action={<Button variant="outline" onClick={() => void load()}>Try again</Button>} /> : loading ? <LoadingSpinner text="Loading Batches…" /> : <DataTableSection title="Training Batches" description="A Plan can have multiple Batches with independent schedules and seat limits." icon={<Layers3 size={18}/>}>
      {batches.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse"><thead className="border-b border-(--line) bg-(--surface)"><tr><TableHeading>Batch</TableHeading><TableHeading>Plan</TableHeading><TableHeading>Branch</TableHeading><TableHeading>Coach</TableHeading><TableHeading>Weekly Sessions</TableHeading><TableHeading>Seats</TableHeading><TableHeading>Status</TableHeading><TableHeading align="right">Actions</TableHeading></tr></thead><tbody className="divide-y divide-(--line)">{batches.map((batch) => <tr key={batch._id}><td className="px-5 py-4 text-sm font-semibold">{batch.name}<span className="block text-xs font-normal text-(--ink-muted)">{batch.code}{typeof batch.roomId === "object" && batch.roomId?.name ? ` · ${batch.roomId.name}` : batch.room ? ` · ${batch.room}` : ""}</span>{batch.startDate ? <span className="block text-xs font-normal text-(--ink-muted)">Starts {batch.startDate}{batch.calculatedEndDate ? ` · Ends ${batch.calculatedEndDate}` : ""}</span> : null}{batch.capacityIssue && <span className="block text-xs font-medium text-(--danger)">{batch.capacityIssue}</span>}</td><td className="px-5 py-4 text-sm">{label(batch.plan)}</td><td className="px-5 py-4 text-sm">{label(batch.branch)}</td><td className="px-5 py-4 text-sm">{typeof batch.coach === "object" ? batch.coach?.name || "Unassigned" : batch.coach || "Unassigned"}</td><td className="px-5 py-4 text-sm"><div className="mb-1 font-semibold">{batch.configuredSessions ?? 0} / {batch.requiredSessions ?? 0} configured</div>{batch.weeklySessions?.length ? <ul className="space-y-1 text-xs text-(--ink-muted)">{batch.weeklySessions.map((session) => <li key={session._id}><span className="font-medium text-(--ink)">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][session.dayOfWeek]} · {session.name}</span><span className="block">{session.startTime}–{session.endTime} · {session.program} · {session.room}{session.coach ? ` · ${session.coach}` : ""}{!session.active || session.dayClosed ? " · Inactive" : ""}</span></li>)}</ul> : <span className="text-xs text-(--ink-muted)">No weekly sessions assigned</span>}</td><td className="px-5 py-4 text-sm">{batch.occupiedSeats || 0} / {batch.capacity}<span className="block text-xs text-(--ink-muted)">{batch.availableSeats ?? batch.capacity} available</span></td><td className="px-5 py-4"><Badge variant={batch.status === "ACTIVE" ? "success" : "neutral"}>{batch.status}</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Link className="inline-flex h-10 items-center rounded-xl border border-(--line) px-3 text-sm font-semibold hover:border-(--accent)" href={`/branches/${typeof batch.branch === "string" ? batch.branch : batch.branch._id}/schedule?batch=${batch._id}`}>Configure schedule</Link>{canManage && <><Button size="sm" variant="outline" onClick={() => editBatch(batch)}>Edit</Button>{batch.status === "ACTIVE" && <Button size="sm" variant="outline" onClick={() => void recalculateBatch(batch)}>Recalculate dates</Button>}<Button size="sm" variant="outline" disabled={batch.status === "INACTIVE"} onClick={() => void changeStatus(batch)}>{batch.status === "ACTIVE" ? "Pause" : "Activate"}</Button></>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="No Batches yet" description="Create a Batch under a Plan, then assign its schedule slots from the Branch schedule page." action={canManage ? <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16}/>Create Batch</Button> : undefined} />}
    </DataTableSection>}
    <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? "Edit Batch" : "Create Batch"} description={editing ? "Update the Batch and its optional assigned coach. Future scheduled Sessions inherit coach changes." : "Create a draft group under a Plan. It can be activated after assigning exactly the Plan’s weekly number of valid schedule slots."} size="lg" footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button><Button type="submit" form="batch-form" disabled={saving}>{saving ? "Saving…" : editing ? "Save Batch" : "Create Batch"}</Button></div>}>
      <form id="batch-form" onSubmit={(event) => void save(event)} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Batch name<Input required maxLength={100} className="mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
        <label className="text-sm font-semibold">Stable code<Input required maxLength={40} className="mt-1" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}/></label>
        <label className="text-sm font-semibold">Branch<Select required disabled={Boolean(editing)} className="mt-1" value={form.branch} onChange={(event) => { setCoaches([]); setForm({ ...form, branch: event.target.value, coach: "", roomId: "" }); }}><option value="">Choose Branch</option>{branches.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Select></label>
        <label className="text-sm font-semibold">Plan<Select required disabled={Boolean(editing)} className="mt-1" value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}><option value="">Choose Plan</option>{plans.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.classesPerWeek || "?"} / week)</option>)}</Select></label>
        <label className="text-sm font-semibold">Maximum students<Input required type="number" min={1} max={1000} className="mt-1" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })}/></label>
        <label className="text-sm font-semibold">Default room (optional)<Select disabled={!form.branch} className="mt-1" value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}><option value="">Choose per session</option>{(roomsByBranch[form.branch] || []).filter((room) => room.isActive || room._id === form.roomId).map((room) => <option key={room._id} value={room._id} disabled={!room.isActive}>{room.name}{!room.isActive ? " (inactive)" : ""}</option>)}</Select></label>
        <label className="text-sm font-semibold">Coach / Instructor (optional)<Select disabled={!form.branch} className="mt-1" value={form.coach} onChange={(event) => setForm({ ...form, coach: event.target.value })}><option value="">No coach assigned</option>{coaches.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Select></label>
        <label className="text-sm font-semibold">Batch start date<Input required type="date" className="mt-1" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })}/></label>
        {editing?.calculatedEndDate && <div className="self-end rounded-xl bg-(--surface) p-3 text-sm"><span className="block font-semibold">Calculated completion</span><span className="text-(--ink-muted)">{editing.calculatedEndDate} · recalculated on activation after schedule changes</span></div>}
      </form>
    </Modal>
  </div>;
}

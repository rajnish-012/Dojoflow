"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Award, Check, CircleAlert, Printer, Save } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingSpinner, PageHeader, Select, Textarea, Input } from "@/components/ui";
import { finalizeGradingEvaluation, generatePromotionCertificate, getGradingEvent, gradingAction, saveGradingEvaluation, type Evaluation, type GradingEvent } from "@/lib/gradingApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";

const CRITERIA = ["technique", "discipline", "attendance", "performance"] as const;
type Criterion = typeof CRITERIA[number];
type EvaluationDraft = { criteria: Record<Criterion, { value: number; remarks: string }>; overallScore: number; remarks: string; result: "PASS" | "FAIL" | "PENDING" };
const newDraft = (): EvaluationDraft => ({ criteria: Object.fromEntries(CRITERIA.map((key) => [key, { value: 0, remarks: "" }])) as Record<Criterion, { value: number; remarks: string }>, overallScore: 0, remarks: "", result: "PENDING" });

export default function GradingDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const canView = useCan(PERMISSIONS.GRADING_VIEW);
  const canEvaluate = useCan(PERMISSIONS.GRADING_EVALUATE);
  const canFinalize = useCan(PERMISSIONS.GRADING_FINALIZE);
  const canPublish = useCan(PERMISSIONS.GRADING_PUBLISH);
  const canCancel = useCan(PERMISSIONS.GRADING_CANCEL);
  const canGenerate = useCan(PERMISSIONS.CERTIFICATE_GENERATE);
  const [event, setEvent] = useState<GradingEvent | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [drafts, setDrafts] = useState<Record<string, EvaluationDraft>>({});
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [promotionMessages, setPromotionMessages] = useState<Record<string, string>>({});
  const [certificateIds, setCertificateIds] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); const data = await getGradingEvent(eventId); setEvent(data.event); setEvaluations(data.evaluations || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load grading event."); }
    finally { setLoading(false); }
  }, [eventId]);
  useEffect(() => { if (!canView || !eventId) return; const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [canView, eventId, load]);

  function currentDraft(studentId: string) {
    if (drafts[studentId]) return drafts[studentId];
    const saved = evaluations.find((item) => (typeof item.student === "object" ? item.student._id : item.student) === studentId);
    if (!saved) return newDraft();
    return { criteria: { ...newDraft().criteria, ...saved.criteria }, overallScore: saved.overallScore, remarks: saved.remarks || "", result: saved.result };
  }
  function changeDraft(studentId: string, update: Partial<EvaluationDraft>) {
    setDrafts((current) => ({ ...current, [studentId]: { ...currentDraft(studentId), ...update } }));
  }
  async function action(name: "start" | "cancel" | "complete" | "publish") {
    try { setBusy(name); await gradingAction(eventId, name); toast.success(name === "publish" ? "Results published." : `Grading ${name === "start" ? "started" : name === "cancel" ? "cancelled" : "completed"}.`); await load(); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to update grading event."); }
    finally { setBusy(""); }
  }
  async function save(studentId: string) {
    try { setBusy(`save:${studentId}`); const result = await saveGradingEvaluation(eventId, studentId, currentDraft(studentId)); setEvaluations((current) => [...current.filter((item) => item.student._id !== studentId), result.evaluation]); toast.success("Evaluation saved as draft."); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to save evaluation."); }
    finally { setBusy(""); }
  }
  async function finalize(studentId: string) {
    try { setBusy(`finalize:${studentId}`); const result = await finalizeGradingEvaluation(eventId, studentId); setEvaluations((current) => [...current.filter((item) => item.student._id !== studentId), result.evaluation]); setPromotionMessages((current) => ({ ...current, [studentId]: result.promotion?._id ? `Promotion recorded: ${result.promotion.toBelt} belt.` : result.promotionMessage || "" })); toast.success("Evaluation finalized."); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to finalize evaluation."); }
    finally { setBusy(""); }
  }
  async function certificate(promotionId: string, studentId: string) {
    try { setBusy(`certificate:${studentId}`); const result = await generatePromotionCertificate(promotionId); setCertificateIds((current) => ({ ...current, [studentId]: result.certificate._id })); toast.success("Promotion certificate generated."); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to generate certificate."); }
    finally { setBusy(""); }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;
  if (error || !event) return <div className="mx-auto max-w-3xl p-6"><ErrorState title="Grading event unavailable" message={error || "This grading event could not be found."} action={<Link href="/grading"><Button variant="outline">Back to grading</Button></Link>} /></div>;
  const editable = ["SCHEDULED", "IN_PROGRESS"].includes(event.status);

  return <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
    <Link href="/grading" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-(--ink-muted) hover:text-(--foreground)"><ArrowLeft size={16} />All grading events</Link>
    <PageHeader title={event.program?.name || "Grading event"} description={`${new Date(event.date).toLocaleDateString("en-IN", { dateStyle: "long" })} · ${event.branch?.name || "Branch"} · Examiner: ${event.examiner?.name || "—"}`} eyebrow="Evaluation" actions={<div className="flex flex-wrap gap-2">{event.status === "SCHEDULED" && canEvaluate && <Button loading={busy === "start"} onClick={() => void action("start")}>Start grading</Button>}{event.status === "IN_PROGRESS" && canPublish && <Button variant="secondary" loading={busy === "publish"} onClick={() => void action("publish")}>Publish results</Button>}{event.status === "IN_PROGRESS" && canFinalize && <Button variant="outline" loading={busy === "complete"} onClick={() => void action("complete")}>Complete event</Button>}{editable && canCancel && <Button variant="danger" loading={busy === "cancel"} onClick={() => void action("cancel")}>Cancel</Button>}</div>} />
    <Card className="mb-5 p-4 sm:p-5"><div className="flex flex-wrap items-center gap-3"><Badge variant={event.status === "COMPLETED" ? "success" : event.status === "CANCELLED" ? "danger" : event.status === "IN_PROGRESS" ? "accent" : "neutral"}>{event.status.replaceAll("_", " ")}</Badge><span className="text-sm text-(--ink-muted)">{event.students.length} participating students</span></div>{event.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-(--ink-muted)">{event.notes}</p>}</Card>
    <div className="space-y-4">{event.students.map((participant) => {
      const studentId = participant.student._id;
      const evaluation = evaluations.find((item) => item.student._id === studentId);
      const draft = currentDraft(studentId);
      const locked = evaluation && evaluation.status !== "DRAFT";
      return <Card key={studentId} padding="none" className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) p-4 sm:px-6"><div><h2 className="font-bold">{participant.student.name}</h2><p className="mt-1 text-xs text-(--ink-muted)">Current belt: {participant.student.currentBelt || "White"} · Eligibility verified when scheduled</p></div><div className="flex items-center gap-2">{evaluation ? <><Badge variant={evaluation.result === "PASS" ? "success" : evaluation.result === "FAIL" ? "danger" : "warning"}>{evaluation.result}</Badge><Badge variant={evaluation.status === "PUBLISHED" ? "accent" : "neutral"}>{evaluation.status}</Badge></> : <Badge variant="neutral">Not evaluated</Badge>}</div></div>
        {participant.eligibility?.eligible === false && <div className="m-4 flex gap-2 rounded-xl bg-(--warning-soft) p-3 text-sm text-(--warning)"><CircleAlert size={18} />{participant.eligibility.reason}</div>}
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">{CRITERIA.map((key) => <label key={key} className="text-xs font-semibold capitalize text-(--ink-muted)">{key}<Input className="mt-1" type="number" min={0} max={100} value={draft.criteria[key].value} disabled={!canEvaluate || !editable || Boolean(locked)} onChange={(e) => changeDraft(studentId, { criteria: { ...draft.criteria, [key]: { ...draft.criteria[key], value: Number(e.target.value) } } })} /><Input className="mt-2" placeholder="Criterion remark" maxLength={500} value={draft.criteria[key].remarks || ""} disabled={!canEvaluate || !editable || Boolean(locked)} onChange={(e) => changeDraft(studentId, { criteria: { ...draft.criteria, [key]: { ...draft.criteria[key], remarks: e.target.value } } })} /></label>)}
          <label className="text-xs font-semibold text-(--ink-muted)">Overall score<Input className="mt-1" type="number" min={0} max={100} value={draft.overallScore} disabled={!canEvaluate || !editable || Boolean(locked)} onChange={(e) => changeDraft(studentId, { overallScore: Number(e.target.value) })} /></label>
          <label className="text-xs font-semibold text-(--ink-muted)">Result<Select className="mt-1" value={draft.result} disabled={!canEvaluate || !editable || Boolean(locked)} onChange={(e) => changeDraft(studentId, { result: e.target.value as "PASS" | "FAIL" | "PENDING" })}><option value="PENDING">Pending</option><option value="PASS">Pass</option><option value="FAIL">Fail</option></Select></label>
          <label className="text-xs font-semibold text-(--ink-muted) sm:col-span-2">Overall remarks<Textarea className="mt-1" rows={2} maxLength={2000} value={draft.remarks} disabled={!canEvaluate || !editable || Boolean(locked)} onChange={(e) => changeDraft(studentId, { remarks: e.target.value })} /></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--line) bg-(--hover-bg)/50 p-4 sm:px-6">{evaluation?.promotion ? <span className="text-sm font-semibold text-(--success)">Existing promotion completed</span> : <span className="text-xs text-(--ink-muted)">{promotionMessages[studentId] || (evaluation?.result === "PASS" && locked ? "Promotion remains governed by the existing eligibility rules." : "A pass only changes belt when the existing promotion workflow succeeds.")}</span>}<div className="flex gap-2">{canEvaluate && editable && !locked && <Button variant="outline" loading={busy === `save:${studentId}`} leftIcon={<Save size={15} />} onClick={() => void save(studentId)}>Save draft</Button>}{canFinalize && editable && evaluation?.status === "DRAFT" && <Button loading={busy === `finalize:${studentId}`} leftIcon={<Check size={15} />} onClick={() => void finalize(studentId)}>Finalize</Button>}{canGenerate && evaluation?.promotion && <Button variant="secondary" loading={busy === `certificate:${studentId}`} leftIcon={<Award size={15} />} onClick={() => void certificate(String(evaluation.promotion), studentId)}>Generate certificate</Button>}{certificateIds[studentId] && <Link href={`/certificates/${certificateIds[studentId]}`} target="_blank"><Button variant="outline" leftIcon={<Printer size={15} />}>Preview / print</Button></Link>}</div></div>
      </Card>;
    })}</div>
    {event.students.length === 0 && <EmptyState icon={<Award size={24} />} title="No participants" description="This grading event has no students." />}
  </main>;
}

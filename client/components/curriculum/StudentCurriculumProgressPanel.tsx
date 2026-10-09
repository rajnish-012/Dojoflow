"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, RefreshCw, Award, PackageCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, LoadingSpinner, Select } from "@/components/ui";
import { toast } from "@/lib/toast";
import { approveStudentCurriculumMilestone, fulfillStudentCurriculumReward, getStudentCurriculumProgress, issueStudentCurriculumReward, recordStudentCurriculumProgress, type CurriculumMilestoneApi, type CurriculumVersionApi, type PlannedCurriculumSessionApi } from "@/lib/api";
import { PERMISSIONS, useCan } from "@/lib/permissions";

type Props = { studentId: string; enrollmentId: string; programId: string };

function assessmentMustPassFor(step: NonNullable<CurriculumVersionApi["modules"]>[number]["steps"][number], modules: CurriculumVersionApi["modules"]) {
  const hasLegacyMilestoneRules = Boolean(step.milestoneName || step.milestoneDescription || step.milestoneCriteria || step.milestoneRequiredStepIds?.length);
  return Boolean(step.assessmentPassRequired || (step.isMilestone && step.assessmentRequired && hasLegacyMilestoneRules) || modules.some((module) => module.steps.some((candidate) => candidate.isMilestone && (candidate.milestoneRequiredStepIds || []).includes(step._id))));
}

export default function StudentCurriculumProgressPanel({ studentId, enrollmentId, programId }: Props) {
  const canManage = useCan(PERMISSIONS.ATTENDANCE_MANAGE);
  const canManageRewards = useCan(PERMISSIONS.CURRICULUM_REWARD_MANAGE);
  const [curriculum, setCurriculum] = useState<CurriculumVersionApi | null>(null);
  const [milestones, setMilestones] = useState<CurriculumMilestoneApi[]>([]);
  const [sessions, setSessions] = useState<PlannedCurriculumSessionApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStep, setSavingStep] = useState("");
  const [sessionChoice, setSessionChoice] = useState<Record<string, string>>({});
  const [assessment, setAssessment] = useState<Record<string, string>>({});
  const [assessmentPass, setAssessmentPass] = useState<Record<string, boolean>>({});
  const [fulfillmentNotes, setFulfillmentNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!studentId || !enrollmentId || !programId) { setCurriculum(null); setLoading(false); return; }
    try {
      setLoading(true);
      const response = await getStudentCurriculumProgress(studentId, enrollmentId, programId);
      setCurriculum(response.curriculum);
      setMilestones(response.milestones || []);
      setSessions(response.sessions || []);
      const choices = (response.sessions || []).flatMap((session) => (session.plannedStepIds || []).map((stepId) => [stepId, session._id] as const));
      setSessionChoice(Object.fromEntries(choices));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load curriculum progress."); }
    finally { setLoading(false); }
  }, [studentId, enrollmentId, programId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function record(stepId: string, status: "IN_PROGRESS" | "COMPLETED") {
    if (!canManage) return;
    const step = curriculum?.modules.flatMap((module) => module.steps).find((item) => item._id === stepId);
    if (status === "COMPLETED" && step?.assessmentRequired && !assessment[stepId]?.trim()) { toast.error("Enter the required assessment result first."); return; }
    const assessmentMustPass = step && curriculum ? assessmentMustPassFor(step, curriculum.modules) : false;
    if (status === "COMPLETED" && step?.assessmentRequired && assessmentMustPass && !assessmentPass[stepId]) { toast.error("Mark the required assessment as passed first."); return; }
    try {
      setSavingStep(stepId);
      const selectedSession = sessions.find((session) => session._id === sessionChoice[stepId]);
      await recordStudentCurriculumProgress(studentId, stepId, { enrollmentId, programId, status, sessionId: selectedSession?._id, attendanceId: selectedSession?.attendanceId, assessmentResult: assessment[stepId] || "", assessmentPassed: assessmentPass[stepId] || false });
      toast.success(status === "COMPLETED" ? "Learning step completed." : "Learning step marked in progress.");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update student progress."); }
    finally { setSavingStep(""); }
  }

  async function approve(achievementId: string) {
    try { await approveStudentCurriculumMilestone(studentId, achievementId); toast.success("Milestone approved and earned."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to approve milestone."); }
  }
  async function issue(achievementId: string, rewardId: string) {
    try { await issueStudentCurriculumReward(studentId, achievementId, rewardId); toast.success("Reward issued. Physical delivery is recorded separately."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to issue reward."); }
  }
  async function fulfill(achievementId: string, rewardId: string) {
    const key = `${achievementId}:${rewardId}`;
    try { await fulfillStudentCurriculumReward(studentId, achievementId, rewardId, fulfillmentNotes[key] || ""); toast.success("Reward fulfillment recorded."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to record fulfillment."); }
  }

  if (loading) return <Card><LoadingSpinner size="sm" text="Loading enrollment curriculum..." /></Card>;
  if (!curriculum) return <Card><EmptyState title="No versioned curriculum assigned" description="This enrollment keeps its original legacy Plan curriculum. New enrollments use a published Plan and Program version." icon={<Clock3 size={20} />} /></Card>;

  const stepSessions = (stepId: string) => sessions.filter((session) => (session.plannedStepIds || []).includes(stepId));
  return <Card>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Learning progress</h2><p className="mt-1 text-sm text-(--ink-muted)">{curriculum.name} · Version {curriculum.version} · recorded per enrollment</p></div><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw size={14} />Refresh</Button></div>
    <div className="mt-5 space-y-4">{curriculum.modules.map((module) => {
      const completeCount = module.steps.filter((step) => step.progress?.status === "COMPLETED").length;
      return <section key={module._id} className="rounded-xl border border-(--line) p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{module.order}. {module.name}</h3><Badge variant={completeCount === module.steps.length && module.steps.length ? "success" : "default"}>{completeCount}/{module.steps.length} complete</Badge></div>{module.description && <p className="mt-1 text-sm text-(--ink-muted)">{module.description}</p>}<div className="mt-3 space-y-3">{module.steps.map((step) => {
      const choices = stepSessions(step._id);
      const assessmentMustPass = assessmentMustPassFor(step, curriculum.modules);
      const milestoneRequired = [step._id, ...(step.milestoneRequiredStepIds || [])];
      const milestoneDone = milestoneRequired.filter((requiredId) => curriculum.modules.flatMap((group) => group.steps).some((item) => item._id === requiredId && item.progress?.status === "COMPLETED")).length;
        return <div key={step._id} className="rounded-lg bg-(--surface) p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{step.title}</p><Badge variant={step.progress?.status === "COMPLETED" ? "success" : step.progress?.status === "IN_PROGRESS" ? "warning" : "default"}>{step.progress?.status?.replace("_", " ") || "NOT STARTED"}</Badge></div>{step.description && <p className="mt-1 text-sm text-(--ink-muted)">{step.description}</p>}{step.isMilestone && <div className="mt-2 rounded-md border border-(--line) p-2 text-xs"><strong>Milestone: {step.milestoneName || step.title}</strong>{step.milestoneDescription && <p>{step.milestoneDescription}</p>}{step.milestoneCriteria && step.milestoneCriteria !== step.completionCriteria && <p>{step.milestoneCriteria}</p>}<p className="mt-1 text-(--ink-muted)">Progress: {milestoneDone}/{milestoneRequired.length} required learning steps</p></div>}{step.completionCriteria && <p className="mt-2 text-xs"><strong>Completion criteria:</strong> {step.completionCriteria}</p>}{step.progress?.status === "COMPLETED" ? <p className="mt-2 text-xs text-(--ink-muted)">Completed {step.progress.completedAt ? new Date(step.progress.completedAt).toLocaleDateString("en-IN") : ""}{step.progress.assessmentResult ? ` · Assessment: ${step.progress.assessmentResult}` : ""}{step.assessmentRequired ? (step.progress.assessmentPassed ? " · Assessment passed" : " · Assessment not marked passed") : ""}</p> : canManage && <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">{choices.length ? <Select aria-label={`Session for ${step.title}`} value={sessionChoice[step._id] || ""} onChange={(event) => setSessionChoice((current) => ({ ...current, [step._id]: event.target.value }))}><option value="">Choose attended Session</option>{choices.map((session) => <option key={session._id} value={session._id}>{session.date} · {session.sessionName} · {session.startTime}</option>)}</Select> : <p className="self-center text-xs text-(--ink-muted)">{step.attendanceRequired ? "No assigned Session with attendance found." : "Coach confirmation may be recorded without Session attendance."}</p>}{step.assessmentRequired ? <Input aria-label={`Assessment result for ${step.title}`} value={assessment[step._id] || ""} placeholder={assessmentMustPass ? (step.assessmentPassingValue || "PASS") : "Assessment result"} onChange={(event) => setAssessment((current) => ({ ...current, [step._id]: event.target.value }))} /> : <span />}{step.assessmentRequired && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(assessmentPass[step._id])} onChange={(event) => setAssessmentPass((current) => ({ ...current, [step._id]: event.target.checked }))} />Passed</label>}{step.progress?.status === "IN_PROGRESS" ? <Button size="sm" onClick={() => void record(step._id, "COMPLETED")} disabled={savingStep === step._id || (step.attendanceRequired && !sessionChoice[step._id]) || (step.assessmentRequired && assessmentMustPass && !assessmentPass[step._id])}>{savingStep === step._id ? "Saving..." : <><CheckCircle2 size={14} />Complete</>}</Button> : <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void record(step._id, "IN_PROGRESS")} disabled={savingStep === step._id}>Start</Button><Button size="sm" onClick={() => void record(step._id, "COMPLETED")} disabled={savingStep === step._id || (step.attendanceRequired && !sessionChoice[step._id]) || (step.assessmentRequired && assessmentMustPass && !assessmentPass[step._id])}><CheckCircle2 size={14} />Complete</Button></div>}</div>}</div>;
      })}</div></section>;
    })}</div>
    {!!milestones.length && <section className="mt-6 space-y-3 border-t border-(--line) pt-5"><h3 className="flex items-center gap-2 font-bold"><Award size={17} />Milestone history</h3>{milestones.map((milestone) => {
      const completed = new Set(curriculum.modules.flatMap((module) => module.steps).filter((step) => step.progress?.status === "COMPLETED").map((step) => step._id));
      const doneCount = milestone.requiredStepIds.filter((stepId) => completed.has(stepId)).length;
      return <article key={milestone._id} className="rounded-xl border border-(--line) p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold">{milestone.milestoneName}</h4><p className="text-xs text-(--ink-muted)">Criteria satisfied {new Date(milestone.criteriaMetAt).toLocaleDateString("en-IN")} · {doneCount}/{milestone.requiredStepIds.length} required steps complete</p></div><Badge variant={milestone.status === "EARNED" ? "success" : "warning"}>{milestone.status === "PENDING_APPROVAL" ? "Awaiting approval" : milestone.status}</Badge></div>{milestone.milestoneDescription && <p className="mt-2 text-sm">{milestone.milestoneDescription}</p>}<p className="mt-1 text-xs text-(--ink-muted)">{milestone.milestoneCriteria}</p>{milestone.status === "EARNED" && <p className="mt-2 text-xs text-(--ink-muted)">Earned {milestone.earnedAt ? new Date(milestone.earnedAt).toLocaleDateString("en-IN") : ""}{milestone.approvedBy?.name ? ` · Approved by ${milestone.approvedBy.name}` : ""}</p>}{canManage && milestone.status === "PENDING_APPROVAL" && <Button className="mt-3" size="sm" onClick={() => void approve(milestone._id)}>Approve milestone</Button>}{milestone.rewards.map((reward) => <div key={reward._id} className="mt-3 flex flex-wrap items-end justify-between gap-3 rounded-lg bg-(--surface) p-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><PackageCheck size={15} />{reward.name}{reward.type === "BELT_PROGRESSION" ? ` · ${reward.targetBelt || "rank"}` : ` × ${reward.quantity}`}</p><p className="text-xs text-(--ink-muted)">{reward.type === "BELT_PROGRESSION" ? `Belt progression · ${reward.status === "AWAITING_GRADING" ? "Awaiting formal grading" : reward.status === "AWAITING_PROMOTION_APPROVAL" ? "Awaiting authorized promotion approval" : reward.status}` : `${reward.type} · ${reward.status}`}{reward.issuedBy?.name ? ` · Issued by ${reward.issuedBy.name}` : ""}{reward.fulfilledBy?.name ? ` · Fulfilled by ${reward.fulfilledBy.name}` : ""}{reward.fulfillmentNote ? ` · ${reward.fulfillmentNote}` : ""}</p></div>{reward.certificate && <Link className="text-sm font-semibold text-(--accent)" href={`/certificates/${reward.certificate}`}>View certificate</Link>}{canManageRewards && reward.type !== "BELT_PROGRESSION" && milestone.status === "EARNED" && reward.status === "EARNED" && <Button size="sm" variant="outline" onClick={() => void issue(milestone._id, reward._id)}>Issue reward</Button>}{canManageRewards && reward.status === "ISSUED" && <div className="flex min-w-[min(100%,24rem)] gap-2"><Input aria-label={`Fulfillment note for ${reward.name}`} value={fulfillmentNotes[`${milestone._id}:${reward._id}`] || ""} placeholder="Record how the reward was delivered" onChange={(event) => setFulfillmentNotes((current) => ({ ...current, [`${milestone._id}:${reward._id}`]: event.target.value }))} /><Button size="sm" onClick={() => void fulfill(milestone._id, reward._id)} disabled={(fulfillmentNotes[`${milestone._id}:${reward._id}`] || "").trim().length < 3}>Record delivery</Button></div>}</div>)}</article>;
    })}</section>}
  </Card>;
}

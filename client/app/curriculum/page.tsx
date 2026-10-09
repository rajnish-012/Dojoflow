"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, ClipboardList, Plus, RefreshCw, Save, Send, Archive, Trash2 } from "lucide-react";
import { toast, confirmAction } from "@/lib/toast";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingSpinner, PageHeader, Select, Textarea } from "@/components/ui";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import { getCurriculumPlans, getCurriculumVersions, getCurriculumCapacity, createCurriculumDraft, updateCurriculumDraft, appendPublishedCurriculumModule, publishCurriculum, archiveCurriculum, getPlannedCurriculumSessions, updatePlannedSessionContent, type CurriculumApiPlan, type CurriculumVersionApi, type CurriculumModuleApi, type LearningStepApi, type PlannedCurriculumSessionApi, type CurriculumPlanCapacityApi } from "@/lib/api";
import CurriculumMilestoneFields from "@/components/curriculum/CurriculumMilestoneFields";

const programIdOf = (value: string | { _id: string }) => typeof value === "string" ? value : value?._id || "";
const newStep = (): LearningStepApi => ({ _id: `pending-${Date.now()}-${Math.random()}`, title: "", description: "", objectives: [], activities: [], materials: [], completionCriteria: "", coachApprovalRequired: true, attendanceRequired: false, assessmentRequired: false, assessmentPassRequired: false, milestoneDay: null, isMilestone: false, rewards: [], prerequisites: [] });

export default function CurriculumPage() {
  const pendingIdPrefix = useId();
  const canView = useCan(PERMISSIONS.CURRICULUM_VIEW);
  const canManage = useCan(PERMISSIONS.CURRICULUM_MANAGE);
  const canPlanSessions = useCan(PERMISSIONS.BRANCH_SCHEDULE_MANAGE);
  const [plans, setPlans] = useState<CurriculumApiPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [programId, setProgramId] = useState("");
  const [versions, setVersions] = useState<CurriculumVersionApi[]>([]);
  const [versionId, setVersionId] = useState("");
  const [sessions, setSessions] = useState<PlannedCurriculumSessionApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingModuleSequence, setPendingModuleSequence] = useState(0);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [sessionSteps, setSessionSteps] = useState<Record<string, string[]>>({});
  const [capacity, setCapacity] = useState<CurriculumPlanCapacityApi | null>(null);
  const [batchCapacityIssues, setBatchCapacityIssues] = useState<Array<{ batchId: string; name: string; code: string; message: string }>>([]);

  const selectedPlan = plans.find((item) => item._id === planId) || null;
  const selectedProgram = selectedPlan?.programs?.find((item) => programIdOf(item.program) === programId);
  const selectedProgramName = typeof selectedProgram?.program === "object" ? selectedProgram.program.name : "Program";
  const selectedVersion = versions.find((item) => item._id === versionId) || null;
  const modules = selectedVersion?.modules || [];
  const published = selectedVersion?.status === "PUBLISHED";
  const currentStepCount = modules.reduce((total, module) => total + module.steps.length, 0);
  const hasPendingPublishedModule = selectedVersion?.status === "PUBLISHED" && modules.some((module) => module._id.startsWith("pending-"));
  const displayedCapacity = capacity && (selectedVersion?.status === "DRAFT" || hasPendingPublishedModule) ? {
    ...capacity,
    stepsByProgram: capacity.stepsByProgram.map((item) => item.programId === programId ? { ...item, requiredSteps: currentStepCount } : item),
    combinedSteps: capacity.stepsByProgram.reduce((total, item) => total + (item.programId === programId ? currentStepCount : item.requiredSteps), 0),
    remainingSessions: Math.max(0, capacity.maximumSessions - capacity.stepsByProgram.reduce((total, item) => total + (item.programId === programId ? currentStepCount : item.requiredSteps), 0)),
  } : capacity;
  const exceedsPlanCapacity = Boolean(displayedCapacity && displayedCapacity.combinedSteps > displayedCapacity.maximumSessions);

  const loadVersions = useCallback(async (targetPlanId: string, targetProgramId: string) => {
    if (!targetPlanId || !targetProgramId) { setVersions([]); setVersionId(""); setSessions([]); setCapacity(null); return; }
    const [versionResponse, sessionResponse] = await Promise.all([
      getCurriculumVersions(targetPlanId, targetProgramId),
      getPlannedCurriculumSessions(targetPlanId, targetProgramId).catch(() => ({ sessions: [] })),
    ]);
    setVersions(versionResponse.versions || []);
    setSessions(sessionResponse.sessions || []);
    const next = (versionResponse.versions || []).find((item) => item.status === "DRAFT") || (versionResponse.versions || []).find((item) => item.status === "PUBLISHED") || (versionResponse.versions || [])[0];
    setVersionId(next?._id || "");
    setBatchCapacityIssues([]);
    const capacityResponse = await getCurriculumCapacity(targetPlanId, targetProgramId, next?.status === "PUBLISHED").catch(() => null);
    setCapacity(capacityResponse?.capacity || null);
    setSessionSteps(Object.fromEntries((sessionResponse.sessions || []).map((session) => [session._id, session.plannedStepIds || []])));
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const response = await getCurriculumPlans();
      const nextPlans = response.plans || [];
      setPlans(nextPlans);
      const plan = nextPlans.find((item) => item._id === planId) || nextPlans[0];
      const nextPlanId = plan?._id || "";
      const currentProgram = plan?.programs?.find((item) => programIdOf(item.program) === programId) || plan?.programs?.[0];
      const nextProgramId = currentProgram ? programIdOf(currentProgram.program) : "";
      setPlanId(nextPlanId); setProgramId(nextProgramId);
      await loadVersions(nextPlanId, nextProgramId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load curriculum."); }
    finally { setLoading(false); }
  }, [loadVersions, planId, programId]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => { void loadPlans(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, loadPlans]);

  async function refreshVersions() {
    try { await loadVersions(planId, programId); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to refresh curriculum."); }
  }

  async function selectVersion(nextVersionId: string) {
    setVersionId(nextVersionId);
    setPreview(false);
    setBatchCapacityIssues([]);
    const version = versions.find((item) => item._id === nextVersionId);
    if (!version || !planId || !programId) return;
    try {
      const response = await getCurriculumCapacity(planId, programId, version.status === "PUBLISHED");
      setCapacity(response.capacity);
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to load Plan capacity."); }
  }

  async function startDraft() {
    if (!canManage) return;
    try {
      setSaving(true);
      const response = await createCurriculumDraft(planId, programId);
      await refreshVersions(); setVersionId(response.curriculum._id);
      toast.success(`Draft version ${response.curriculum.version} created.`);
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to create draft."); }
    finally { setSaving(false); }
  }

  function updateVersion(update: (current: CurriculumVersionApi) => CurriculumVersionApi) {
    setVersions((current) => current.map((item) => item._id === versionId ? update(item) : item));
  }
  function updateModule(moduleId: string, update: (module: CurriculumModuleApi) => CurriculumModuleApi) {
    updateVersion((current) => ({ ...current, modules: current.modules.map((module) => module._id === moduleId ? update(module) : module) }));
  }
  function updateStep(moduleId: string, stepId: string, update: (step: LearningStepApi) => LearningStepApi) {
    updateModule(moduleId, (module) => ({ ...module, steps: module.steps.map((step) => step._id === stepId ? update(step) : step) }));
  }

  function addModule() {
    if (!selectedVersion || !["DRAFT", "PUBLISHED"].includes(selectedVersion.status) || (selectedVersion.status === "PUBLISHED" && hasPendingPublishedModule)) return;
    setPreview(false);
    const next: CurriculumModuleApi = { _id: `pending-${pendingIdPrefix}-${pendingModuleSequence}`, name: "", description: "", order: modules.reduce((maximum, module) => Math.max(maximum, module.order), 0) + 1, objectives: [], expectedSessions: null, prerequisites: [], steps: [] };
    setPendingModuleSequence((sequence) => sequence + 1);
    updateVersion((current) => ({ ...current, modules: [...current.modules, next] }));
  }
  function moveModule(moduleId: string, delta: number) {
    const index = modules.findIndex((item) => item._id === moduleId); const target = index + delta;
    if (target < 0 || target >= modules.length) return;
    const next = [...modules]; [next[index], next[target]] = [next[target], next[index]];
    updateVersion((current) => ({ ...current, modules: next.map((item, order) => ({ ...item, order: order + 1 })) }));
  }
  function removeModule(moduleId: string) {
    const next = modules.filter((item) => item._id !== moduleId).map((item, index) => ({ ...item, order: index + 1 }));
    updateVersion((current) => ({ ...current, modules: next }));
  }
  function addStep(moduleId: string) { updateModule(moduleId, (module) => ({ ...module, steps: [...module.steps, newStep()] })); }
  function moveStep(moduleId: string, stepId: string, delta: number) {
    updateModule(moduleId, (module) => { const index = module.steps.findIndex((item) => item._id === stepId); const target = index + delta; if (target < 0 || target >= module.steps.length) return module; const steps = [...module.steps]; [steps[index], steps[target]] = [steps[target], steps[index]]; return { ...module, steps }; });
  }
  function removeStep(moduleId: string, stepId: string) { updateModule(moduleId, (module) => ({ ...module, steps: module.steps.filter((item) => item._id !== stepId) })); }

  async function saveDraft() {
    if (!selectedVersion || selectedVersion.status !== "DRAFT" || !canManage) return;
    try {
      setSaving(true);
      const response = await updateCurriculumDraft(selectedVersion._id, { name: selectedVersion.name, description: selectedVersion.description || "", modules: selectedVersion.modules });
      setVersions((current) => current.map((item) => item._id === response.curriculum._id ? response.curriculum : item));
      toast.success("Draft saved. Existing enrollments are unchanged.");
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to save draft."); }
    finally { setSaving(false); }
  }

  async function savePublishedModule() {
    if (!selectedVersion || selectedVersion.status !== "PUBLISHED" || !canManage || saving) return;
    const pendingModule = selectedVersion.modules.find((item) => item._id.startsWith("pending-"));
    if (!pendingModule) return;
    if (!pendingModule.name.trim() || !pendingModule.steps.length || pendingModule.steps.some((step) => !step.title.trim())) {
      toast.error("Enter a module name and a title for every learning step.");
      return;
    }
    if (exceedsPlanCapacity) {
      toast.error(`This addition exceeds Plan capacity by ${displayedCapacity!.combinedSteps - displayedCapacity!.maximumSessions} learning step(s).`);
      return;
    }
    try {
      setSaving(true);
      const response = await appendPublishedCurriculumModule(selectedVersion._id, pendingModule);
      setVersions((current) => current.map((item) => item._id === response.curriculum._id ? response.curriculum : item));
      setCapacity(response.capacity);
      setBatchCapacityIssues(response.batchCapacityIssues || []);
      toast.success(`Module added to published Curriculum v${response.curriculum.version}.`);
      if (response.batchCapacityIssues?.length) toast.warning(`${response.batchCapacityIssues.length} active Batch schedule(s) need review. See the capacity warning below.`);
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to add module."); }
    finally { setSaving(false); }
  }

  async function publishDraft() {
    if (!selectedVersion || selectedVersion.status !== "DRAFT" || !canManage) return;
    try {
      setSaving(true);
      const saved = await updateCurriculumDraft(selectedVersion._id, { name: selectedVersion.name, description: selectedVersion.description || "", modules: selectedVersion.modules });
      const response = await publishCurriculum(saved.curriculum._id);
      setVersions((current) => [response.curriculum, ...current.filter((item) => item._id !== response.curriculum._id)]);
      toast.success(`Curriculum version ${response.curriculum.version} published for new enrollments.`);
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to publish curriculum."); }
    finally { setSaving(false); }
  }

  async function archiveVersion() {
    if (!selectedVersion || selectedVersion.status !== "PUBLISHED" || !canManage) return;
    const confirmed = await confirmAction({ title: "Archive curriculum version?", message: "Historical enrollments and progress will remain readable. New enrollments will use the latest other published version, if one exists.", confirmLabel: "Archive version", destructive: true });
    if (!confirmed) return;
    try { setSaving(true); const response = await archiveCurriculum(selectedVersion._id); setVersions((current) => current.map((item) => item._id === response.curriculum._id ? response.curriculum : item)); toast.success("Curriculum version archived."); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to archive curriculum."); }
    finally { setSaving(false); }
  }

  async function saveSessionContent(session: PlannedCurriculumSessionApi) {
    if (!selectedVersion || selectedVersion.status !== "PUBLISHED") return;
    try {
      await updatePlannedSessionContent(session._id, selectedVersion._id, [], sessionSteps[session._id] || []);
      toast.success("Planned Session content saved. Student progress is unchanged.");
      await refreshVersions();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to update Session content."); }
  }

  const stepMap = new Map(modules.flatMap((module) => module.steps.map((step) => [step._id, `${module.order}. ${step.title || "Untitled step"}`] as const)));

  if (!canView) return <div className="df-page"><ErrorState title="Access restricted" message="Your account does not have permission to view curriculum." /></div>;
  if (loading) return <div className="df-page"><Card className="min-h-[300px]"><LoadingSpinner size="lg" text="Loading curriculum..." fullPage /></Card></div>;
  if (error) return <div className="df-page"><ErrorState title="Unable to load curriculum" message={error} action={<Button variant="outline" onClick={() => void loadPlans()}><RefreshCw size={15} />Try again</Button>} /></div>;

  return <div className="df-page space-y-5">
    <PageHeader eyebrow="Academy Management" title="Plan Curriculum" description="Build shared Plan curricula by Program, schedule content on dated Sessions, and track each enrollment independently." actions={<Badge variant="info">{plans.length} Plans</Badge>} />
    <Card className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-semibold">Plan<Select className="mt-1" value={planId} onChange={(event) => { const nextPlan = plans.find((item) => item._id === event.target.value); const nextProgram = nextPlan?.programs?.[0]; const nextProgramId = nextProgram ? programIdOf(nextProgram.program) : ""; setPlanId(event.target.value); setProgramId(nextProgramId); void loadVersions(event.target.value, nextProgramId).catch((caught) => toast.error(caught instanceof Error ? caught.message : "Unable to load versions.")); }}><option value="">Choose Plan</option>{plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}</Select></label>
      <label className="text-sm font-semibold">Program<Select className="mt-1" value={programId} onChange={(event) => { setProgramId(event.target.value); void loadVersions(planId, event.target.value).catch((caught) => toast.error(caught instanceof Error ? caught.message : "Unable to load versions.")); }}><option value="">Choose Program</option>{(selectedPlan?.programs || []).map((item) => <option key={programIdOf(item.program)} value={programIdOf(item.program)}>{typeof item.program === "string" ? "Program" : item.program.name}</option>)}</Select></label>
      <label className="text-sm font-semibold">Curriculum version<Select className="mt-1" value={versionId} onChange={(event) => void selectVersion(event.target.value)}><option value="">No version</option>{versions.map((item) => <option key={item._id} value={item._id}>v{item.version} · {item.status} · {item.name}</option>)}</Select></label>
      <div className="flex flex-wrap items-end gap-2">{canManage && <Button onClick={() => void startDraft()} disabled={!planId || !programId || saving || versions.some((item) => item.status === "DRAFT")}><Plus size={16} />New draft</Button>}<Button variant="outline" onClick={() => void refreshVersions()} disabled={!planId || !programId}><RefreshCw size={15} />Refresh</Button></div>
    </Card>

    {!selectedPlan || !programId ? <Card><EmptyState title="Choose a Plan and Program" description="Curriculum must be associated with a Program explicitly. Multi-Program Plans are never inferred." icon={<BookOpen size={22} />} /></Card> : !selectedVersion ? <Card><EmptyState title="No curriculum version yet" description="Create a draft to begin entering academy-approved learning content. Existing legacy Plan curriculum remains readable." icon={<BookOpen size={22} />} action={canManage ? <Button onClick={() => void startDraft()}><Plus size={16} />Create draft</Button> : undefined} /></Card> : <>
      {displayedCapacity && <Card className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Plan curriculum capacity</h3><div className="flex flex-wrap gap-2"><Badge variant={exceedsPlanCapacity ? "danger" : "success"}>Required: {displayedCapacity.combinedSteps} / {displayedCapacity.maximumSessions}</Badge><Badge variant="info">Remaining: {displayedCapacity.remainingSessions}</Badge></div></div><p className="text-sm text-(--ink-muted)">{displayedCapacity.duration} {displayedCapacity.durationUnit.toLowerCase()} at {displayedCapacity.classesPerWeek} sessions per week. Combined learning steps across all Programs must fit within the Plan capacity.</p><div className="flex flex-wrap gap-2">{displayedCapacity.stepsByProgram.map((item) => <Badge key={item.programId} variant="default">{item.programName}: {item.requiredSteps}</Badge>)}</div>{hasPendingPublishedModule && <p className="text-sm">Proposed addition: {Math.max(0, currentStepCount - (capacity?.stepsByProgram.find((item) => item.programId === programId)?.requiredSteps || 0))} learning step(s).</p>}{exceedsPlanCapacity && <p role="alert" className="text-sm text-red-700">This curriculum exceeds Plan capacity by {displayedCapacity.combinedSteps - displayedCapacity.maximumSessions} learning step(s).</p>}</Card>}
      {batchCapacityIssues.length > 0 && <Card className="border-(--warning)/30 bg-(--warning-soft)"><h3 className="font-semibold">Some Batches need schedule review</h3><p className="mt-1 text-sm">The module is saved. These active Batches could not fit all required learning steps into their current schedules. Adjust schedules, holidays, or conflicts, then recalculate.</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{batchCapacityIssues.map((issue) => <li key={issue.batchId}><strong>{issue.name} ({issue.code}):</strong> {issue.message}</li>)}</ul></Card>}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{selectedProgramName} · {selectedPlan.name}</h2><Badge variant={selectedVersion.status === "PUBLISHED" ? "success" : selectedVersion.status === "ARCHIVED" ? "default" : "warning"}>{selectedVersion.status}</Badge><Badge variant="default">Version {selectedVersion.version}</Badge></div>
            {selectedVersion.status === "DRAFT" && canManage ? <><label className="block text-sm font-semibold">Curriculum name<Input className="mt-1" value={selectedVersion.name} maxLength={160} onChange={(event) => updateVersion((current) => ({ ...current, name: event.target.value }))} /></label><label className="block text-sm font-semibold">Description<Textarea className="mt-1" value={selectedVersion.description || ""} rows={2} maxLength={4000} onChange={(event) => updateVersion((current) => ({ ...current, description: event.target.value }))} /></label></> : <p className="text-sm text-(--ink-muted)">{selectedVersion.description || "No description provided."}</p>}
            <p className="text-sm text-(--ink-muted)">{modules.length} modules · {modules.reduce((count, module) => count + module.steps.length, 0)} learning steps</p>
          </div>
          <div className="flex flex-wrap gap-2">{selectedVersion.status === "DRAFT" && canManage && <><Button variant="outline" onClick={() => void saveDraft()} disabled={saving}><Save size={15} />Save draft</Button><Button onClick={() => void publishDraft()} disabled={saving || modules.length === 0 || exceedsPlanCapacity}><Send size={15} />Publish</Button></>}{selectedVersion.status !== "DRAFT" && <Button variant="outline" onClick={() => setPreview((current) => !current)}><BookOpen size={15} />{preview ? "Edit view" : "Preview"}</Button>}{selectedVersion.status === "PUBLISHED" && canManage && <Button variant="danger" onClick={() => void archiveVersion()} disabled={saving}><Archive size={15} />Archive</Button>}</div>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) px-5 py-4"><div><h3 className="font-bold">Modules and learning steps</h3><p className="mt-1 text-sm text-(--ink-muted)">Existing step IDs and student progress stay attached to this Curriculum. New published modules append without changing earlier content.</p></div>{canManage && selectedVersion.status === "DRAFT" && <Button size="sm" onClick={addModule}><Plus size={15} />Add module</Button>}{canManage && published && !hasPendingPublishedModule && <Button size="sm" onClick={addModule} disabled={saving || (displayedCapacity?.remainingSessions || 0) <= 0}><Plus size={15} />Add Next Module</Button>}</div>
        {!modules.length ? <EmptyState title="No modules yet" description="Add a module and then enter the academy's own learning steps. Drafts may be incomplete." icon={<ClipboardList size={22} />} className="py-12" /> : <div className="divide-y divide-(--line)">{modules.map((module, moduleIndex) => {
          const editableModule = !preview && canManage && (selectedVersion.status === "DRAFT" || (published && module._id.startsWith("pending-")));
          return <section key={module._id} className="space-y-4 p-5">
          <div className="flex items-start gap-3"><div className="mt-1 flex flex-col">{!preview && canManage && selectedVersion.status === "DRAFT" && <><button className="rounded p-1 text-(--ink-muted) hover:bg-(--surface)" aria-label="Move module up" disabled={moduleIndex === 0} onClick={() => moveModule(module._id, -1)}><ChevronUp size={16} /></button><button className="rounded p-1 text-(--ink-muted) hover:bg-(--surface)" aria-label="Move module down" disabled={moduleIndex === modules.length - 1} onClick={() => moveModule(module._id, 1)}><ChevronDown size={16} /></button></>}</div><div className="min-w-0 flex-1 space-y-3"><div className="grid gap-3 md:grid-cols-[1fr_2fr]">{editableModule ? <Input aria-label="Module name" value={module.name} placeholder="Module name" onChange={(event) => updateModule(module._id, (current) => ({ ...current, name: event.target.value }))} /> : <h4 className="text-lg font-bold">{module.order}. {module.name}</h4>}{editableModule ? <Input aria-label="Module description" value={module.description || ""} placeholder="Module description" onChange={(event) => updateModule(module._id, (current) => ({ ...current, description: event.target.value }))} /> : <p className="text-sm text-(--ink-muted)">{module.description}</p>}</div>
            {editableModule ? <Textarea aria-label="Module learning objectives" rows={2} placeholder="Module objectives, one per line" value={(module.objectives || []).join("\n")} onChange={(event) => updateModule(module._id, (current) => ({ ...current, objectives: event.target.value.split("\n") }))} /> : module.objectives?.map((objective, index) => <p key={`${module._id}-objective-${index}`} className="text-sm text-(--ink-muted)">Objective: {objective}</p>)}
            {editableModule && modules.filter((item) => item._id !== module._id).length > 0 && <fieldset className="flex flex-wrap gap-3 text-xs"><legend className="mb-1 font-semibold text-(--ink-muted)">Prerequisite modules</legend>{modules.filter((item) => item._id !== module._id).map((item) => <label key={item._id} className="flex items-center gap-1.5"><input type="checkbox" checked={(module.prerequisites || []).includes(item._id)} onChange={(event) => updateModule(module._id, (current) => ({ ...current, prerequisites: event.target.checked ? [...(current.prerequisites || []), item._id] : (current.prerequisites || []).filter((value) => value !== item._id) }))} />{item.name || `Module ${item.order}`}</label>)}</fieldset>}
            {editableModule && <label className="block max-w-xs text-xs font-semibold text-(--ink-muted)">Expected Sessions (optional)<Input className="mt-1" type="number" min="0" value={module.expectedSessions ?? ""} onChange={(event) => updateModule(module._id, (current) => ({ ...current, expectedSessions: event.target.value ? Number(event.target.value) : null }))} /></label>}
          </div>{!preview && canManage && selectedVersion.status === "DRAFT" && modules.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeModule(module._id)} aria-label="Remove module"><Trash2 size={15} /></Button>}</div>
          <div className="space-y-3 pl-7">{module.steps.map((step, stepIndex) => <div key={step._id} className="rounded-xl border border-(--line) bg-(--surface)/50 p-4"><div className="flex items-start gap-3"><div className="flex flex-col">{!preview && canManage && selectedVersion.status === "DRAFT" && <><button className="rounded p-1 text-(--ink-muted) hover:bg-(--surface)" aria-label="Move step up" disabled={stepIndex === 0} onClick={() => moveStep(module._id, step._id, -1)}><ChevronUp size={15} /></button><button className="rounded p-1 text-(--ink-muted) hover:bg-(--surface)" aria-label="Move step down" disabled={stepIndex === module.steps.length - 1} onClick={() => moveStep(module._id, step._id, 1)}><ChevronDown size={15} /></button></>}</div><div className="min-w-0 flex-1 space-y-2">{editableModule ? <><Input aria-label="Learning step title" value={step.title} placeholder="Learning step title" onChange={(event) => updateStep(module._id, step._id, (current) => ({ ...current, title: event.target.value }))} /><Textarea aria-label="Learning step description" value={step.description || ""} rows={2} placeholder="Description and practice instructions" onChange={(event) => updateStep(module._id, step._id, (current) => ({ ...current, description: event.target.value }))} /><Input aria-label="Completion criteria" value={step.completionCriteria || ""} placeholder="Completion criteria (optional)" onChange={(event) => updateStep(module._id, step._id, (current) => ({ ...current, completionCriteria: event.target.value }))} /><div className="flex flex-wrap gap-4 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(step.coachApprovalRequired)} onChange={(event) => updateStep(module._id, step._id, (current) => ({ ...current, coachApprovalRequired: event.target.checked }))} />Coach confirmation</label><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(step.attendanceRequired)} onChange={(event) => updateStep(module._id, step._id, (current) => ({ ...current, attendanceRequired: event.target.checked }))} />Present attendance required</label><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(step.assessmentRequired)} onChange={(event) => updateStep(module._id, step._id, (current) => ({ ...current, assessmentRequired: event.target.checked, assessmentPassRequired: event.target.checked ? current.assessmentPassRequired : false }))} />Assessment required</label>{step.assessmentRequired && <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(step.assessmentPassRequired)} onChange={(event) => updateStep(module._id, step._id, (current) => ({ ...current, assessmentPassRequired: event.target.checked }))} />Assessment must pass</label>}</div>{step.assessmentRequired && step.assessmentPassRequired && <Input aria-label="Assessment passing value" value={step.assessmentPassingValue || "PASS"} maxLength={100} placeholder="Passing result (e.g. PASS)" onChange={(event) => updateStep(module._id, step._id, (current) => ({ ...current, assessmentPassingValue: event.target.value }))} />}<CurriculumMilestoneFields step={step} onChange={(update) => updateStep(module._id, step._id, update)} /></> : <><div className="flex flex-wrap items-center gap-2"><h5 className="font-semibold">{module.order}.{stepIndex + 1} {step.title || "Untitled step"}</h5>{step.progress && <Badge variant={step.progress.status === "COMPLETED" ? "success" : "warning"}>{step.progress.status.replace("_", " ")}</Badge>}</div>{step.description && <p className="text-sm text-(--ink-muted)">{step.description}</p>}{step.completionCriteria && <p className="text-xs"><strong>Completion:</strong> {step.completionCriteria}</p>}<div className="flex flex-wrap gap-2 text-xs">{step.coachApprovalRequired && <Badge variant="default">Coach approval</Badge>}{step.attendanceRequired && <Badge variant="default">Present attendance</Badge>}{step.assessmentRequired && <Badge variant="warning">Assessment</Badge>}{step.isMilestone && <Badge variant="success">{step.milestoneName || step.title || "Milestone"}</Badge>}{step.milestoneDay && <Badge variant="info">Legacy day {step.milestoneDay}</Badge>}</div></>}</div>{editableModule && <Button variant="ghost" size="sm" onClick={() => removeStep(module._id, step._id)} aria-label="Remove learning step"><Trash2 size={14} /></Button>}</div></div>)}
            {editableModule && <Button variant="outline" size="sm" onClick={() => addStep(module._id)}><Plus size={14} />Add learning step</Button>}
          </div>
        </section>;
        })}</div>}
        {canManage && published && hasPendingPublishedModule && <div className="flex justify-end border-t border-(--line) p-4"><Button variant="outline" onClick={() => updateVersion((current) => ({ ...current, modules: current.modules.filter((module) => !module._id.startsWith("pending-")) }))} disabled={saving}>Discard module</Button><Button onClick={() => void savePublishedModule()} disabled={saving || exceedsPlanCapacity}><Save size={15} />Save to published Curriculum</Button></div>}
        {canManage && selectedVersion.status === "DRAFT" && modules.length > 0 && <div className="flex justify-end border-t border-(--line) p-4"><Button variant="outline" onClick={() => void saveDraft()} disabled={saving}><Save size={15} />Save draft</Button></div>}
      </Card>

      {published && canPlanSessions && <Card><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Schedule content on Sessions</h3><p className="mt-1 text-sm text-(--ink-muted)">Content is a plan only; it does not complete student learning. Attended sessions retain their history.</p></div><Badge variant="info">{sessions.length} Sessions</Badge></div>{sessions.length ? <div className="mt-4 space-y-3">{sessions.map((session) => <div key={session._id} className="rounded-xl border border-(--line) p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{session.sessionName} · {session.date} · {session.startTime}–{session.endTime}</p><p className="text-sm text-(--ink-muted)">{session.batch?.name || "Batch"} · {session.branch?.name || "Branch"}{session.coach?.name ? ` · ${session.coach.name}` : ""}</p></div><Button size="sm" variant="outline" onClick={() => void saveSessionContent(session)}><Save size={14} />Save content</Button></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{modules.flatMap((module) => module.steps.map((step) => <label key={step._id} className="flex items-start gap-2 rounded-lg bg-(--surface) p-2 text-sm"><input className="mt-1" type="checkbox" checked={(sessionSteps[session._id] || []).includes(step._id)} onChange={(event) => setSessionSteps((current) => { const chosen = new Set(current[session._id] || []); if (event.target.checked) chosen.add(step._id); else chosen.delete(step._id); return { ...current, [session._id]: [...chosen] }; })} /><span>{module.order}. {step.title || "Untitled step"}</span></label>))}</div><p className="mt-2 text-xs text-(--ink-muted)">Planned: {(sessionSteps[session._id] || []).map((stepId) => stepMap.get(stepId)).filter(Boolean).join(", ") || "No content selected"}</p></div>)}</div> : <EmptyState title="No dated Sessions found" description="Active Batch schedules materialize dated Sessions as calendar or attendance requests need them. Refresh after Sessions are generated." icon={<ClipboardList size={20} />} className="py-8" />}</Card>}
    </>}
  </div>;
}

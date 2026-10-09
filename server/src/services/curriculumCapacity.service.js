const Curriculum = require("../models/Curriculum");

// Month-based Plans use the conventional 52-week academic year (52 / 12
// weeks per month); fractional weeks round up because an occurrence in a
// partial week can still be scheduled. Day-based Plans round up partial weeks.
function theoreticalMaximumSessions(plan) {
  const duration = Number(plan?.duration);
  const classesPerWeek = Number(plan?.classesPerWeek);
  if (!Number.isInteger(duration) || duration < 1 || !Number.isInteger(classesPerWeek) || classesPerWeek < 1) return 0;
  const weeks = plan.durationUnit === "DAYS" ? Math.ceil(duration / 7) : Math.ceil((duration * 52) / 12);
  return weeks * classesPerWeek;
}

function countLearningSteps(modules = []) {
  const ids = new Set();
  let anonymous = 0;
  for (const module of modules || []) for (const step of module.steps || []) {
    const stepId = String(step?._id || "");
    if (stepId) ids.add(stepId);
    else anonymous += 1;
  }
  return ids.size + anonymous;
}

function capacityError({ requiredSteps, maximumSessions }) {
  const excess = Math.max(0, requiredSteps - maximumSessions);
  return excess ? `This Curriculum requires ${requiredSteps} learning steps, exceeding the Plan's theoretical maximum of ${maximumSessions} sessions by ${excess}. Increase the Plan duration or weekly frequency, or reduce the required learning steps.` : "";
}

async function summarizePlanCurriculumCapacity(plan, { targetProgramId = "", targetModules, publishedOnly = false, session = null } = {}) {
  const programs = (plan?.programs || []).map((entry) => String(entry.program?._id || entry.program || "")).filter(Boolean);
  let versionQuery = programs.length
    ? Curriculum.find({ plan: plan._id, program: { $in: programs }, status: publishedOnly ? "PUBLISHED" : { $in: ["DRAFT", "PUBLISHED"] } }).sort({ version: -1, publishedAt: -1 }).populate("program", "name").lean()
    : null;
  if (versionQuery && session) versionQuery = versionQuery.session(session);
  const versions = versionQuery ? await versionQuery : [];
  const byProgram = new Map();
  for (const version of versions) {
    const programId = String(version.program?._id || version.program);
    if (!byProgram.has(programId)) byProgram.set(programId, {});
    const record = byProgram.get(programId);
    if (version.status === "DRAFT" && !record.draft) record.draft = version;
    if (version.status === "PUBLISHED" && !record.published) record.published = version;
  }
  const stepsByProgram = (plan.programs || []).map((entry) => {
    const programId = String(entry.program?._id || entry.program || "");
    const record = byProgram.get(programId) || {};
    const selected = programId === String(targetProgramId) && Array.isArray(targetModules)
      ? { status: "DRAFT", modules: targetModules, _id: record.draft?._id || null, version: record.draft?.version || null }
      : (publishedOnly ? record.published : record.draft || record.published);
    const legacyRows = (entry.curriculum || []).length ? entry.curriculum : (plan.curriculum || []);
    return {
      programId,
      programName: entry.program?.name || "Program",
      curriculumId: selected?._id || null,
      curriculumStatus: selected?.status || (legacyRows.length ? "LEGACY" : "MISSING"),
      version: selected?.version || null,
      requiredSteps: selected ? countLearningSteps(selected.modules || []) : legacyRows.length,
    };
  });
  const combinedSteps = stepsByProgram.reduce((sum, item) => sum + item.requiredSteps, 0);
  const maximumSessions = theoreticalMaximumSessions(plan);
  const excessSteps = Math.max(0, combinedSteps - maximumSessions);
  return {
    planId: String(plan._id),
    duration: Number(plan.duration),
    durationUnit: plan.durationUnit || "MONTHS",
    classesPerWeek: Number(plan.classesPerWeek),
    maximumSessions,
    stepsByProgram,
    combinedSteps,
    remainingSessions: Math.max(0, maximumSessions - combinedSteps),
    excessSteps,
    valid: excessSteps === 0,
  };
}

module.exports = { theoreticalMaximumSessions, countLearningSteps, capacityError, summarizePlanCurriculumCapacity };

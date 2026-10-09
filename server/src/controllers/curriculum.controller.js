const mongoose = require("mongoose");
const Curriculum = require("../models/Curriculum");
const StudentCurriculumStepProgress = require("../models/StudentCurriculumStepProgress");
const StudentCurriculumMilestone = require("../models/StudentCurriculumMilestone");
const Certificate = require("../models/Certificate");
const FinanceSequence = require("../models/FinanceSequence");
const TrainingSessionType = require("../models/TrainingSessionType");
const Product = require("../models/Product");
const BranchInventory = require("../models/BranchInventory");
const { stockState, createStockMovement, publishStockTransitions } = require("../services/inventory.service");
const Plan = require("../models/Plan");
const Student = require("../models/Student");
const Session = require("../models/Session");
const Attendance = require("../models/Attendance");
const Makeup = require("../models/Makeup");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const { isBranchScoped } = require("../utils/access");
const { completionRequirementError, milestoneRequirementResult } = require("../services/curriculumProgress.service");
const { ensureLegacyEnrollmentCurriculum } = require("../services/curriculumVersion.service");
const { safelyCreateNotification } = require("../services/notification.service");
const { sendStudentEmail } = require("../services/studentEmail.service");
const { summarizePlanCurriculumCapacity, capacityError } = require("../services/curriculumCapacity.service");

const id = (value) => String(value?._id || value || "");
const validId = (value) => mongoose.isValidObjectId(value);
const canBranch = (user, branch) => !isBranchScoped(user) || id(user.branch) === id(branch);

function legacyModules(plan, programId) {
  const entry = (plan.programs || []).find((item) => id(item.program) === id(programId));
  const rows = entry?.curriculum?.length ? entry.curriculum : plan.curriculum || [];
  return rows.length ? [{
    name: "Legacy learning steps",
    description: "Imported from the Plan's existing day-based curriculum. Day labels are retained for reference and are not milestones.",
    order: 1,
    objectives: [],
    steps: rows.map((row, index) => ({ title: row.title || `Day ${row.day || index + 1}`, description: row.description || "", objectives: row.skill ? [row.skill] : [], coachApprovalRequired: true, assessmentRequired: false, legacyTrainingDay: Number(row.day) || index + 1 })),
  }] : [];
}

function stringList(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 200) throw new Error(`${label} must be a list of at most 200 entries.`);
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function hasDependencyCycle(items, getId, getDependencies) {
  const byId = new Map(items.map((item) => [getId(item), item]));
  const visiting = new Set(); const visited = new Set();
  function visit(key) {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    for (const dependency of getDependencies(byId.get(key)) || []) if (byId.has(String(dependency)) && visit(String(dependency))) return true;
    visiting.delete(key); visited.add(key); return false;
  }
  return [...byId.keys()].some(visit);
}

function validateModules(input, plan, publishing = false) {
  if (!Array.isArray(input) || input.length > 200) throw new Error("Curriculum modules must be a list of at most 200 items.");
  const moduleIds = new Set();
  const stepIds = new Set();
  const orders = new Set();
  const submittedIdMap = new Map();
  const modules = input.map((module, moduleIndex) => {
    if (!module || typeof module !== "object") throw new Error(`Module ${moduleIndex + 1} is invalid.`);
    const name = String(module.name || "").trim();
    const order = Number(module.order);
    if (publishing && !name) throw new Error(`Module ${moduleIndex + 1} needs a name before publishing.`);
    if (!Number.isInteger(order) || order < 1 || orders.has(order)) throw new Error("Module ordering must use unique positive whole numbers.");
    orders.add(order);
    const moduleId = validId(module._id) ? String(module._id) : new mongoose.Types.ObjectId().toString();
    if (module._id) submittedIdMap.set(String(module._id), moduleId);
    if (moduleIds.has(moduleId)) throw new Error("Each module must have a unique stable ID.");
    moduleIds.add(moduleId);
    if (!Array.isArray(module.steps) || module.steps.length > 500) throw new Error(`${name || `Module ${moduleIndex + 1}`} steps must be a list.`);
    const steps = module.steps.map((step, stepIndex) => {
      const title = String(step?.title || "").trim();
      if (publishing && !title) throw new Error(`${name || `Module ${moduleIndex + 1}`} step ${stepIndex + 1} needs a title before publishing.`);
      const stepId = validId(step?._id) ? String(step._id) : new mongoose.Types.ObjectId().toString();
      if (step?._id) submittedIdMap.set(String(step._id), stepId);
      if (stepIds.has(stepId)) throw new Error("Each learning step must have a unique stable ID.");
      stepIds.add(stepId);
      // Keep legacy curriculum day values intact for old versions. They are no
      // longer validated against or driven by Plan milestone configuration.
      const milestoneDay = step?.milestoneDay == null || step.milestoneDay === "" ? null : Number(step.milestoneDay);
      const isMilestone = step.isMilestone === true;
      const rewards = Array.isArray(step.rewards) ? step.rewards : [];
      if (isMilestone && rewards.length > 20) throw new Error("A milestone can have at most 20 configured rewards.");
      const normalizedRewards = isMilestone ? rewards.map((reward) => {
        const type = String(reward?.type || "CUSTOM").toUpperCase();
        const targetBelt = String(reward?.targetBelt || "").trim();
        const targetMilestoneDay = reward?.targetMilestoneDay == null || reward.targetMilestoneDay === "" ? null : Number(reward.targetMilestoneDay);
        const rewardName = String(reward?.name || (type === "BELT_PROGRESSION" ? targetBelt : "")).trim();
        const quantity = Number(reward?.quantity ?? 1);
        if (!["CERTIFICATE", "MERCHANDISE", "POINTS", "RECOGNITION", "CUSTOM", "BELT_PROGRESSION"].includes(type) || !rewardName || rewardName.length > 160 || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new Error(`${title || "A step"} has an invalid milestone reward.`);
        if (reward.product && !validId(reward.product)) throw new Error(`${rewardName} must refer to a valid merchandise item.`);
        if (type === "BELT_PROGRESSION") {
          if (!targetBelt) throw new Error(`${title || "A step"} belt reward must select a target belt.`);
        } else if (targetBelt) throw new Error(`${rewardName || "This reward"} can only set a target belt for belt progression.`);
        return { rewardId: validId(reward.rewardId) ? String(reward.rewardId) : new mongoose.Types.ObjectId().toString(), type, name: rewardName || targetBelt, description: String(reward.description || "").trim(), quantity, product: reward.product || null, targetBelt, targetMilestoneDay, requiresFormalGrading: reward.requiresFormalGrading !== false, active: reward.active !== false };
      }) : [];
      const milestoneRequiredStepIds = isMilestone ? stringList(step.milestoneRequiredStepIds, "Milestone requirements") : (Array.isArray(step.milestoneRequiredStepIds) ? step.milestoneRequiredStepIds.map(String) : []);
      if (isMilestone && (String(step.milestoneName || "").trim().length > 160 || String(step.milestoneDescription || "").length > 2000 || String(step.milestoneCriteria || "").length > 2000)) throw new Error(`${title || "A step"} milestone fields exceed their allowed length.`);
      if (normalizedRewards.some((reward) => reward.description.length > 1000)) throw new Error(`${title || "A step"} reward descriptions must be 1,000 characters or fewer.`);
      return { ...step, _id: stepId, title, description: String(step.description || "").trim(), objectives: stringList(step.objectives, "Step objectives"), activities: stringList(step.activities, "Step activities"), materials: stringList(step.materials, "Step materials"), prerequisites: stringList(step.prerequisites, "Step prerequisites"), milestoneDay, legacyTrainingDay: step.legacyTrainingDay == null ? null : Number(step.legacyTrainingDay), assessmentRequired: step.assessmentRequired === true || step.assessmentPassRequired === true, isMilestone, milestoneName: String(step.milestoneName || "").trim(), milestoneDescription: String(step.milestoneDescription || "").trim(), milestoneCriteria: String(step.milestoneCriteria || "").trim(), milestoneRequiredStepIds, requiresCoachApproval: step.requiresCoachApproval !== false, assessmentPassRequired: step.assessmentPassRequired === true, assessmentPassingValue: String(step.assessmentPassingValue || "PASS").trim(), rewards: isMilestone ? normalizedRewards : rewards };
    });
    if (publishing && !steps.length) throw new Error(`${name || `Module ${moduleIndex + 1}`} needs at least one learning step before publishing.`);
    return { ...module, _id: moduleId, name, order, description: String(module.description || "").trim(), objectives: stringList(module.objectives, "Module objectives"), prerequisites: stringList(module.prerequisites, "Module prerequisites"), steps };
  });
  for (const module of modules) {
    module.prerequisites = module.prerequisites.map((required) => submittedIdMap.get(required) || required);
    for (const step of module.steps) {
      step.prerequisites = step.prerequisites.map((required) => submittedIdMap.get(required) || required);
      step.milestoneRequiredStepIds = step.milestoneRequiredStepIds.map((required) => submittedIdMap.get(required) || required);
    }
  }
  for (const module of modules) {
    if (module.prerequisites.some((required) => !moduleIds.has(required) || required === String(module._id))) throw new Error(`${module.name || "A module"} has an invalid prerequisite.`);
    for (const step of module.steps) {
      if (step.prerequisites.some((required) => !stepIds.has(required) || required === String(step._id))) throw new Error(`${step.title || "A step"} has an invalid prerequisite.`);
      if (step.isMilestone && step.milestoneRequiredStepIds.some((required) => !stepIds.has(required) || required === String(step._id))) throw new Error(`${step.title || "A step"} milestone has an invalid required learning step.`);
      if (step.isMilestone && new Set(step.rewards.map((reward) => reward.rewardId)).size !== step.rewards.length) throw new Error(`${step.title || "A step"} has duplicate reward IDs.`);
    }
  }
  const allSteps = modules.flatMap((module) => module.steps);
  if (hasDependencyCycle(modules, (item) => String(item._id), (item) => item.prerequisites) || hasDependencyCycle(allSteps, (item) => String(item._id), (item) => item.prerequisites)) throw new Error("Curriculum prerequisites cannot contain a cycle.");
  if (publishing && modules.length === 0) throw new Error("Add at least one module before publishing this curriculum.");
  return modules.sort((a, b) => a.order - b.order);
}

async function validateRewardProducts(modules, session = null) {
  const productIds = [];
  for (const module of modules) for (const step of module.steps || []) for (const reward of step.isMilestone ? step.rewards || [] : []) {
    if (reward.product && reward.type !== "MERCHANDISE") throw new Error(`${reward.name} can only reference inventory for a merchandise reward.`);
    if (reward.product) productIds.push(String(reward.product));
  }
  if (!productIds.length) return;
  let productQuery = Product.countDocuments({ _id: { $in: [...new Set(productIds)] }, status: "ACTIVE" });
  if (session) productQuery = productQuery.session(session);
  const activeCount = await productQuery;
  if (activeCount !== new Set(productIds).size) throw new Error("Milestone merchandise rewards must reference active inventory products.");
}

function curriculumHttpError(status, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function reservePlanCurriculumRevision(planId, session) {
  const result = await Plan.updateOne({ _id: planId }, { $inc: { curriculumRevision: 1 } }, { session });
  if (!result.matchedCount) throw curriculumHttpError(404, "Plan not found.");
}

async function getPlanProgram(planId, programId) {
  const plan = await Plan.findById(planId);
  if (!plan) return { error: [404, "Plan not found."] };
  if (!(plan.programs || []).some((item) => id(item.program) === id(programId))) return { error: [400, "Choose a Program included in this Plan."] };
  return { plan };
}

async function listVersions(req, res) {
  try {
    const { planId, programId } = req.query;
    if (!validId(planId) || !validId(programId)) return res.status(400).json({ success: false, message: "Choose a valid Plan and Program." });
    const selected = await getPlanProgram(planId, programId);
    if (selected.error) return res.status(selected.error[0]).json({ success: false, message: selected.error[1] });
    const versions = await Curriculum.find({ plan: planId, program: programId }).sort({ version: -1 }).populate("createdBy updatedBy", "name").lean();
    return res.json({ success: true, versions });
  } catch (error) { console.error("List curriculum versions failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load curriculum versions." }); }
}

async function getCapacity(req, res) {
  try {
    const { planId, programId } = req.query;
    if (!validId(planId)) return res.status(400).json({ success: false, message: "Choose a valid Plan." });
    const plan = await Plan.findById(planId).populate("programs.program", "name").lean();
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });
    if (programId && !(plan.programs || []).some((entry) => id(entry.program) === id(programId))) return res.status(400).json({ success: false, message: "Choose a Program included in this Plan." });
    const capacity = await summarizePlanCurriculumCapacity(plan, { publishedOnly: req.query.publishedOnly === "true" });
    return res.json({ success: true, capacity });
  } catch (error) {
    console.error("Curriculum capacity lookup failed", { name: error.name });
    return res.status(500).json({ success: false, message: "Unable to calculate Curriculum capacity." });
  }
}

async function createDraft(req, res) {
  try {
    const { planId, programId } = req.params;
    if (!validId(planId) || !validId(programId)) return res.status(400).json({ success: false, message: "Choose a valid Plan and Program." });
    const selected = await getPlanProgram(planId, programId);
    if (selected.error) return res.status(selected.error[0]).json({ success: false, message: selected.error[1] });
    if (!selected.plan.isActive) return res.status(409).json({ success: false, message: "An inactive Plan cannot receive a new curriculum version." });
    const existingDraft = await Curriculum.findOne({ plan: planId, program: programId, status: "DRAFT" });
    if (existingDraft) return res.status(409).json({ success: false, message: "A draft already exists for this Plan and Program.", curriculum: existingDraft });
    const latest = await Curriculum.findOne({ plan: planId, program: programId }).sort({ version: -1 }).lean();
    const legacyBase = latest?.modules?.length ? latest.modules : legacyModules(selected.plan, programId);
    const base = legacyBase.length ? legacyBase : [{ name: "Learning steps", order: 1, steps: [] }];
    const curriculum = await Curriculum.create({ plan: planId, program: programId, version: (latest?.version || 0) + 1, name: latest?.name || `${selected.plan.name} curriculum`, description: latest?.description || "", status: "DRAFT", modules: base, createdBy: req.user._id, updatedBy: req.user._id });
    await auditService.record({ req, action: AUDIT_ACTIONS.CURRICULUM_VERSION_CREATED, entityType: "CURRICULUM", entityId: curriculum._id, after: { planId, programId, version: curriculum.version } });
    return res.status(201).json({ success: true, curriculum });
  } catch (error) { if (error?.code === 11000) return res.status(409).json({ success: false, message: "A draft already exists for this Plan and Program." }); console.error("Create curriculum draft failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to create curriculum draft." }); }
}

async function updateDraft(req, res) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid curriculum version." });
    const curriculum = await Curriculum.findById(req.params.id);
    if (!curriculum) return res.status(404).json({ success: false, message: "Curriculum version not found." });
    if (curriculum.status !== "DRAFT") return res.status(409).json({ success: false, message: "Published or archived curriculum versions are immutable. Create a new draft to make changes." });
    const selected = await getPlanProgram(curriculum.plan, curriculum.program);
    if (selected.error) return res.status(409).json({ success: false, message: "The curriculum Plan and Program relationship is invalid." });
    const { name, description, modules } = req.body || {};
    if (name !== undefined) { if (typeof name !== "string" || !name.trim() || name.trim().length > 160) return res.status(400).json({ success: false, message: "Curriculum name is required and must be 160 characters or fewer." }); curriculum.name = name.trim(); }
    if (description !== undefined) { if (typeof description !== "string" || description.length > 4000) return res.status(400).json({ success: false, message: "Description must be 4,000 characters or fewer." }); curriculum.description = description.trim(); }
    if (modules !== undefined) {
      curriculum.modules = validateModules(modules, selected.plan, false);
      await validateRewardProducts(curriculum.modules);
      const capacity = await summarizePlanCurriculumCapacity(selected.plan, { targetProgramId: curriculum.program, targetModules: curriculum.modules });
      const message = capacityError({ requiredSteps: capacity.combinedSteps, maximumSessions: capacity.maximumSessions });
      if (message) return res.status(409).json({ success: false, message, capacity });
    }
    curriculum.updatedBy = req.user._id;
    await curriculum.save();
    await auditService.record({ req, action: AUDIT_ACTIONS.CURRICULUM_DRAFT_UPDATED, entityType: "CURRICULUM", entityId: curriculum._id, after: { version: curriculum.version, moduleCount: curriculum.modules.length } });
    return res.json({ success: true, curriculum });
  } catch (error) { if (error.name === "ValidationError" || (error instanceof Error && /invalid|unique|must|needs|refers|list|exceed/i.test(error.message))) return res.status(400).json({ success: false, message: error.name === "ValidationError" ? "Curriculum fields exceed their allowed limits." : error.message }); console.error("Update curriculum draft failed", { name: error.name, message: error.message }); return res.status(500).json({ success: false, message: "Unable to update curriculum draft." }); }
}

async function publish(req, res) {
  let session;
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid curriculum version." });
    session = await mongoose.startSession();
    let curriculumId;
    await session.withTransaction(async () => {
      const curriculum = await Curriculum.findById(req.params.id).session(session);
      if (!curriculum) throw curriculumHttpError(404, "Curriculum version not found.");
      if (curriculum.status !== "DRAFT") throw curriculumHttpError(409, "Only a draft can be published.");
      const plan = await Plan.findById(curriculum.plan).populate("programs.program", "name isActive").session(session);
      if (!plan || !(plan.programs || []).some((item) => id(item.program) === id(curriculum.program))) throw curriculumHttpError(409, "The curriculum Plan and Program relationship is invalid.");
      curriculum.modules = validateModules(curriculum.modules, plan, true);
      const capacity = await summarizePlanCurriculumCapacity(plan, { targetProgramId: curriculum.program, targetModules: curriculum.modules, publishedOnly: true, session });
      const capacityValidation = capacityError({ requiredSteps: capacity.combinedSteps, maximumSessions: capacity.maximumSessions });
      if (capacityValidation) throw curriculumHttpError(409, capacityValidation, { capacity });
      await validateRewardProducts(curriculum.modules);
      await reservePlanCurriculumRevision(plan._id, session);
      curriculum.status = "PUBLISHED";
      curriculum.publishedAt = new Date();
      curriculum.updatedBy = req.user._id;
      await curriculum.save({ session });
      curriculumId = curriculum._id;
      await auditService.record({ req, session, action: AUDIT_ACTIONS.CURRICULUM_PUBLISHED, entityType: "CURRICULUM", entityId: curriculum._id, after: { planId: curriculum.plan, programId: curriculum.program, version: curriculum.version } });
    });
    await session.endSession();
    session = null;
    const curriculum = await Curriculum.findById(curriculumId).lean();
    try { await require("../services/batchCompletion.service").recalculateBatchCompletionsForPlan(curriculum.plan); }
    catch (error) { console.error("Batch completion dates could not be recalculated after Curriculum publish", { name: error?.name || "Error" }); }
    return res.json({ success: true, curriculum });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, ...error.details });
    if (error.name === "ValidationError" || (error instanceof Error && /invalid|unique|must|needs|refers|list|exceed/i.test(error.message))) return res.status(400).json({ success: false, message: error.name === "ValidationError" ? "Curriculum fields exceed their allowed limits." : error.message });
    console.error("Publish curriculum failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to publish curriculum." });
  } finally { if (session) await session.endSession(); }
}

async function appendPublishedModule(req, res) {
  let session;
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid curriculum version." });
    if (!req.body?.module || typeof req.body.module !== "object" || Array.isArray(req.body.module)) return res.status(400).json({ success: false, message: "Provide one module with at least one learning step." });
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      const curriculum = await Curriculum.findById(req.params.id).session(session);
      if (!curriculum) throw curriculumHttpError(404, "Curriculum version not found.");
      if (curriculum.status !== "PUBLISHED") throw curriculumHttpError(409, "Add Next Module is only available for a published Curriculum.");
      const plan = await Plan.findById(curriculum.plan).populate("programs.program", "name isActive").session(session);
      if (!plan || !(plan.programs || []).some((item) => id(item.program) === id(curriculum.program))) throw curriculumHttpError(409, "The curriculum Plan and Program relationship is invalid.");
      if (!plan.isActive) throw curriculumHttpError(409, "An inactive Plan cannot be extended.");
      const currentModules = curriculum.modules.map((module) => module.toObject());
      const nextOrder = currentModules.reduce((maximum, module) => Math.max(maximum, Number(module.order) || 0), 0) + 1;
      const proposedModules = validateModules([...currentModules, { ...req.body.module, order: nextOrder }], plan, true);
      if (proposedModules.length !== currentModules.length + 1) throw curriculumHttpError(400, "Add exactly one new module.");
      const appendedModule = proposedModules.find((module) => Number(module.order) === nextOrder);
      if (!appendedModule?.steps?.length) throw curriculumHttpError(400, "The new module must contain at least one learning step.");
      await validateRewardProducts([appendedModule], session);
      const capacity = await summarizePlanCurriculumCapacity(plan, { targetProgramId: curriculum.program, targetModules: proposedModules, publishedOnly: true, session });
      const capacityValidation = capacityError({ requiredSteps: capacity.combinedSteps, maximumSessions: capacity.maximumSessions });
      if (capacityValidation) throw curriculumHttpError(409, capacityValidation, { capacity });

      // Every publish/append transaction writes this shared Plan record. MongoDB
      // serializes concurrent transactions here, so capacity is rechecked on retry.
      await reservePlanCurriculumRevision(plan._id, session);
      curriculum.modules.push(appendedModule);
      curriculum.updatedBy = req.user._id;
      await curriculum.save({ session });
      await auditService.record({ req, session, action: AUDIT_ACTIONS.CURRICULUM_PUBLISHED_MODULE_ADDED, entityType: "CURRICULUM", entityId: curriculum._id, after: { planId: curriculum.plan, programId: curriculum.program, version: curriculum.version, moduleId: appendedModule._id, moduleName: appendedModule.name, learningStepsAdded: appendedModule.steps.length, combinedRequiredSteps: capacity.combinedSteps, maximumSessions: capacity.maximumSessions } });
      result = { curriculumId: curriculum._id, planId: curriculum.plan, capacity };
    });
    await session.endSession();
    session = null;
    await require("../services/batchCompletion.service").recalculateBatchCompletionsForPlan(result.planId);
    const [curriculum, batches] = await Promise.all([
      Curriculum.findById(result.curriculumId).lean(),
      require("../models/Batch").find({ plan: result.planId, status: "ACTIVE", capacityIssue: { $ne: "" } }).select("_id name code capacityIssue").lean(),
    ]);
    return res.json({ success: true, curriculum, capacity: result.capacity, batchCapacityIssues: batches.map((batch) => ({ batchId: id(batch._id), name: batch.name, code: batch.code, message: batch.capacityIssue })) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, ...error.details });
    if (error.name === "ValidationError" || (error instanceof Error && /invalid|unique|must|needs|refers|list|exceed/i.test(error.message))) return res.status(400).json({ success: false, message: error.name === "ValidationError" ? "Curriculum fields exceed their allowed limits." : error.message });
    console.error("Append published curriculum module failed", { name: error.name });
    return res.status(500).json({ success: false, message: "Unable to add this module. Refresh the Curriculum and try again." });
  } finally { if (session) await session.endSession(); }
}

async function archive(req, res) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid curriculum version." });
    const curriculum = await Curriculum.findById(req.params.id);
    if (!curriculum) return res.status(404).json({ success: false, message: "Curriculum version not found." });
    if (curriculum.status === "ARCHIVED") return res.json({ success: true, curriculum });
    curriculum.status = "ARCHIVED"; curriculum.updatedBy = req.user._id; await curriculum.save();
    await auditService.record({ req, action: AUDIT_ACTIONS.CURRICULUM_ARCHIVED, entityType: "CURRICULUM", entityId: curriculum._id, after: { version: curriculum.version } });
    return res.json({ success: true, curriculum });
  } catch (error) { console.error("Archive curriculum failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to archive curriculum." }); }
}

async function listSessions(req, res) {
  try {
    const { planId, programId } = req.query;
    if (!validId(planId) || !validId(programId)) return res.status(400).json({ success: false, message: "Choose a valid Plan and Program." });
    const oldestDate = new Date(); oldestDate.setDate(oldestDate.getDate() - 365);
    const query = { plan: planId, program: programId, status: { $in: ["SCHEDULED", "COMPLETED"] }, date: { $gte: oldestDate.toISOString().slice(0, 10) } };
    if (isBranchScoped(req.user)) { if (!req.user.branch) return res.status(403).json({ success: false, message: "Your account is not assigned to a Branch." }); query.branch = req.user.branch; }
    const sessions = await Session.find(query).sort({ date: 1, startTime: 1 }).limit(100).populate("branch batch coach roomId", "name code").populate("curriculum", "name version status").lean();
    return res.json({ success: true, sessions });
  } catch (error) { console.error("List curriculum sessions failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load scheduled Sessions." }); }
}

async function updateSessionContent(req, res) {
  try {
    const { id: sessionId } = req.params;
    const { curriculumId, moduleIds = [], stepIds = [] } = req.body || {};
    if (!validId(sessionId) || !validId(curriculumId) || !Array.isArray(moduleIds) || !Array.isArray(stepIds) || moduleIds.length > 200 || stepIds.length > 500) return res.status(400).json({ success: false, message: "Provide a valid Session, curriculum version, and content selection." });
    const session = await Session.findById(sessionId);
    if (!session || !canBranch(req.user, session.branch)) return res.status(404).json({ success: false, message: "Scheduled Session not found." });
    if (session.status !== "SCHEDULED" || session.date < new Date().toISOString().slice(0, 10) || await Attendance.exists({ session: session._id })) return res.status(409).json({ success: false, message: "Historical or attended Sessions cannot have planned curriculum changed." });
    const curriculum = await Curriculum.findOne({ _id: curriculumId, plan: session.plan, program: session.program, status: "PUBLISHED" }).lean();
    if (!curriculum) return res.status(400).json({ success: false, message: "Choose the published curriculum version for this Session's Plan and Program." });
    const allModules = new Set(curriculum.modules.map((item) => String(item._id)));
    const allSteps = new Set(curriculum.modules.flatMap((item) => (item.steps || []).map((step) => String(step._id))));
    if (new Set(moduleIds.map(String)).size !== moduleIds.length || new Set(stepIds.map(String)).size !== stepIds.length || moduleIds.some((item) => !allModules.has(String(item))) || stepIds.some((item) => !allSteps.has(String(item)))) return res.status(400).json({ success: false, message: "The selection contains content outside this curriculum version." });
    const modulesWithSelectedSteps = curriculum.modules.filter((item) => (item.steps || []).some((step) => stepIds.map(String).includes(String(step._id)))).map((item) => String(item._id));
    session.curriculum = curriculum._id; session.plannedModuleIds = [...new Set([...moduleIds.map(String), ...modulesWithSelectedSteps])]; session.plannedStepIds = stepIds.map(String); await session.save();
    return res.json({ success: true, session });
  } catch (error) { console.error("Update Session curriculum failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to update Session content." }); }
}

async function studentCurriculumProgress(req, res) {
  try {
    const { studentId } = req.params;
    const { enrollmentId, programId } = req.query;
    if (!validId(studentId) || !validId(enrollmentId) || !validId(programId)) return res.status(400).json({ success: false, message: "Choose a student, enrollment, and Program." });
    const student = await Student.findById(studentId).populate("planEnrollments.plan", "name programs");
    if (!student || !canBranch(req.user, student.branch)) return res.status(404).json({ success: false, message: "Student not found." });
    if (req.user.role === "STUDENT" && id(student.user) !== id(req.user._id)) return res.status(404).json({ success: false, message: "Student not found." });
    if (req.user.role === "COACH" && !await CoachStudentAssignment.exists({ coach: req.user._id, student: studentId, status: "ACTIVE" })) return res.status(404).json({ success: false, message: "Student not found." });
    const enrollment = (student.planEnrollments || []).find((item) => id(item._id) === id(enrollmentId));
    if (!enrollment) return res.status(404).json({ success: false, message: "Enrollment not found." });
    const entitlement = (enrollment.programs || []).find((item) => id(item.program) === id(programId));
    const curriculumId = entitlement ? await ensureLegacyEnrollmentCurriculum(student, enrollment, entitlement) : null;
    if (!curriculumId) return res.json({ success: true, curriculum: null, progress: [], sessions: [], legacyCurriculum: entitlement?.curriculum || [] });
    const curriculum = await Curriculum.findOne({ _id: curriculumId, plan: id(enrollment.plan), program: programId }).lean();
    if (!curriculum) return res.status(409).json({ success: false, message: "The curriculum version assigned to this enrollment is unavailable." });
    const progress = await StudentCurriculumStepProgress.find({ student: studentId, enrollment: enrollmentId, curriculum: curriculumId }).populate("recordedBy session attendance", "name date status").lean();
    const milestones = await StudentCurriculumMilestone.find({ student: studentId, enrollment: enrollmentId, curriculum: curriculumId }).populate("approvedBy rewards.issuedBy rewards.fulfilledBy", "name").sort({ earnedAt: -1, criteriaMetAt: -1 }).lean();
    const sessionQuery = { plan: id(enrollment.plan), program: programId, curriculum: curriculumId, plannedStepIds: { $exists: true, $ne: [] }, date: { $gte: new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10) } };
    if (isBranchScoped(req.user)) sessionQuery.branch = req.user.branch;
    const sessions = await Session.find(sessionQuery).select("_id date startTime endTime sessionName plannedStepIds status branch").sort({ date: -1 }).limit(100).lean();
    const makeups = await Makeup.find({ student: studentId, enrollment: enrollmentId, status: "COMPLETED", makeupSession: { $ne: null } }).populate("makeupSession originalSession makeupAttendance", "_id date startTime endTime sessionName plannedStepIds curriculum status").lean();
    for (const makeup of makeups) {
      const makeupSession = makeup.makeupSession;
      const originalSession = makeup.originalSession;
      const attendance = makeup.makeupAttendance;
      if (!makeupSession || !originalSession || !attendance || id(attendance.status) !== "PRESENT" || id(originalSession.curriculum) !== id(curriculumId)) continue;
      if (!(originalSession.plannedStepIds || []).length) continue;
      sessions.push({ _id: id(makeupSession._id), date: makeupSession.date, startTime: makeupSession.startTime || "", endTime: makeupSession.endTime || "", sessionName: `Makeup · ${makeupSession.sessionName || "Training Session"}`, plannedStepIds: originalSession.plannedStepIds, status: "COMPLETED", attendanceId: id(attendance._id) });
    }
    const byStep = new Map(progress.map((item) => [item.stepId, item]));
    const modules = (curriculum.modules || []).map((module) => ({ ...module, steps: (module.steps || []).map((step) => ({ ...step, progress: byStep.get(String(step._id)) || null })) }));
    const visibleMilestones = milestones.map((milestone) => ({ ...milestone, rewards: (milestone.rewards || []).map(({ certificateAchievement, ...reward }) => reward) }));
    return res.json({ success: true, curriculum: { ...curriculum, modules }, progress, sessions, milestones: visibleMilestones });
  } catch (error) { console.error("Student curriculum progress failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load curriculum progress." }); }
}

async function recordStepProgress(req, res) {
  try {
    const { studentId, stepId } = req.params;
    const { enrollmentId, status, sessionId = null, attendanceId = null, assessmentResult = "", assessmentPassed = false, notes = "" } = req.body || {};
    if (![studentId, stepId, enrollmentId, req.body.programId].every(validId) || !["IN_PROGRESS", "COMPLETED"].includes(status) || (sessionId && !validId(sessionId)) || (attendanceId && !validId(attendanceId)) || typeof assessmentResult !== "string" || assessmentResult.length > 1000 || typeof assessmentPassed !== "boolean" || typeof notes !== "string" || notes.length > 2000) return res.status(400).json({ success: false, message: "Provide valid student curriculum progress details." });
    const student = await Student.findById(studentId);
    if (!student || !canBranch(req.user, student.branch)) return res.status(404).json({ success: false, message: "Student not found." });
    if (req.user.role === "COACH" && !await CoachStudentAssignment.exists({ coach: req.user._id, student: studentId, status: "ACTIVE" })) return res.status(404).json({ success: false, message: "Student not found." });
    const enrollment = (student.planEnrollments || []).find((item) => id(item._id) === id(enrollmentId));
    if (!enrollment || !["ACTIVE", "PAUSED"].includes(enrollment.status)) return res.status(409).json({ success: false, message: "Curriculum progress can only be updated for an active or paused enrollment." });
    const entitlement = (enrollment.programs || []).find((item) => id(item.program) === id(req.body.programId));
    const curriculumId = entitlement ? await ensureLegacyEnrollmentCurriculum(student, enrollment, entitlement) : null;
    if (!curriculumId) return res.status(409).json({ success: false, message: "This enrollment has no versioned curriculum assignment." });
    const curriculum = await Curriculum.findOne({ _id: curriculumId, plan: id(enrollment.plan), program: id(entitlement.program) }).lean();
    const module = curriculum?.modules.find((item) => (item.steps || []).some((step) => id(step._id) === id(stepId)));
    const step = module?.steps.find((item) => id(item._id) === id(stepId));
    if (!curriculum || !step) return res.status(404).json({ success: false, message: "Learning step not found in the enrollment's curriculum version." });
    const requiredModules = curriculum.modules.filter((item) => (module.prerequisites || []).includes(id(item._id)));
    const prerequisiteIds = [...requiredModules.flatMap((item) => (item.steps || []).map((required) => id(required._id))), ...(step.prerequisites || [])];
    const milestoneAssessmentStep = curriculum.modules.flatMap((item) => item.steps || []).some((candidate) => candidate.isMilestone && (candidate.milestoneRequiredStepIds || []).map(String).includes(id(stepId)));
    const validatedStep = milestoneAssessmentStep && step.assessmentRequired ? { ...step, assessmentPassRequired: true } : step;
    let completedPrerequisiteIds = [];
    if (status === "COMPLETED" && prerequisiteIds.length) {
      completedPrerequisiteIds = await StudentCurriculumStepProgress.find({ student: studentId, enrollment: enrollmentId, curriculum: curriculumId, stepId: { $in: prerequisiteIds }, status: "COMPLETED" }).distinct("stepId");
    }
    let session = null, attendance = null, makeupRecord = null;
    if (sessionId) {
      session = await Session.findOne({ _id: sessionId, plan: id(enrollment.plan), program: id(entitlement.program) });
      if (!session || !canBranch(req.user, session.branch)) return res.status(400).json({ success: false, message: "Choose a Session planned for this learning step and curriculum version." });
      if (id(session.curriculum) !== id(curriculumId) || !(session.plannedStepIds || []).map(id).includes(id(stepId))) {
        makeupRecord = await Makeup.findOne({ student: studentId, enrollment: enrollmentId, makeupSession: session._id, status: "COMPLETED" }).populate("originalSession makeupAttendance");
        const originalSession = makeupRecord?.originalSession;
        if (!originalSession || id(originalSession.curriculum) !== id(curriculumId) || !(originalSession.plannedStepIds || []).map(id).includes(id(stepId))) return res.status(400).json({ success: false, message: "Choose a Session planned for this learning step and curriculum version." });
      }
    }
    if (attendanceId) {
      attendance = await Attendance.findOne({ _id: attendanceId, student: studentId, enrollment: enrollmentId, status: "PRESENT" });
      if (!attendance || (session && id(attendance.session) !== id(session._id) && id(attendance._id) !== id(makeupRecord?.makeupAttendance?._id))) return res.status(400).json({ success: false, message: "Completion attendance must be a Present record for this student and Session." });
    }
    if (session && !attendance) attendance = makeupRecord?.makeupAttendance || await Attendance.findOne({ student: studentId, enrollment: enrollmentId, session: session._id, status: "PRESENT" });
    const completionError = completionRequirementError({ step: validatedStep, status, assessmentResult, assessmentPassed, prerequisiteStepIds: prerequisiteIds, completedStepIds: completedPrerequisiteIds, attendance });
    if (completionError) return res.status(409).json({ success: false, message: completionError });
    const before = await StudentCurriculumStepProgress.findOne({ student: studentId, enrollment: enrollmentId, curriculum: curriculumId, stepId: id(stepId) }).lean();
    const now = new Date();
    const history = { status, recordedBy: req.user._id, recordedAt: now, session: session?._id || null, attendance: attendance?._id || null, assessmentResult: assessmentResult.trim(), assessmentPassed, notes: notes.trim() };
    let updated = before;
    if (before?.status !== "COMPLETED") {
      try {
        updated = await StudentCurriculumStepProgress.findOneAndUpdate(
          { student: studentId, enrollment: enrollmentId, curriculum: curriculumId, stepId: id(stepId), status: { $ne: "COMPLETED" } },
          { $set: { student: studentId, enrollment: enrollmentId, plan: enrollment.plan, program: entitlement.program, curriculum: curriculumId, stepId: id(stepId), status, recordedBy: req.user._id, session: session?._id || null, attendance: attendance?._id || null, assessmentResult: assessmentResult.trim(), assessmentPassed, notes: notes.trim(), ...(status === "COMPLETED" ? { completedAt: now } : {}) }, $setOnInsert: { startedAt: now }, $push: { history } },
          { upsert: true, new: true, runValidators: true },
        );
      } catch (error) { if (error?.code === 11000) return res.status(409).json({ success: false, message: "This learning step was completed by another request." }); throw error; }
      await auditService.record({ req, action: AUDIT_ACTIONS.STUDENT_CURRICULUM_PROGRESS_UPDATED, entityType: "CURRICULUM_PROGRESS", entityId: updated._id, branchId: student.branch, before: before ? { status: before.status } : null, after: { status, stepId: id(stepId), curriculum: curriculumId, enrollment: enrollmentId, session: session?._id || null } });
    }
    if (status === "COMPLETED") {
      const allSteps = curriculum.modules.flatMap((item) => item.steps || []);
      const candidates = allSteps.filter((item) => item.isMilestone && (id(item._id) === id(stepId) || (item.milestoneRequiredStepIds || []).map(String).includes(id(stepId))));
      for (const candidate of candidates) {
        const requiredStepIds = [...new Set([id(candidate._id), ...(candidate.milestoneRequiredStepIds || []).map(String)])];
        const criteriaProgress = await StudentCurriculumStepProgress.find({ student: studentId, enrollment: enrollmentId, curriculum: curriculumId, stepId: { $in: requiredStepIds } }).select("stepId status assessmentPassed").lean();
        const progressByStep = new Map(criteriaProgress.map((item) => [item.stepId, item]));
        const criteria = milestoneRequirementResult({ milestoneStep: candidate, curriculumSteps: allSteps, progressByStep });
        if (!criteria.eligible) continue;
        const requiresApproval = candidate.coachApprovalRequired !== false;
        const initialStatus = requiresApproval ? "PENDING_APPROVAL" : "EARNED";
        let achievement; let created = false;
        try {
          achievement = await StudentCurriculumMilestone.create({ student: studentId, branch: session?.branch || enrollment.branch || student.branch, enrollment: enrollmentId, plan: enrollment.plan, program: entitlement.program, curriculum: curriculumId, milestoneStepId: id(candidate._id), milestoneName: candidate.milestoneName || candidate.title, milestoneDescription: candidate.milestoneDescription || candidate.description || "", milestoneCriteria: candidate.milestoneCriteria || candidate.completionCriteria || "", requiredStepIds, status: initialStatus, criteriaMetAt: now, earnedAt: requiresApproval ? null : now, rewards: (candidate.rewards || []).filter((reward) => reward.active !== false).map((reward) => ({ rewardId: reward.rewardId, type: reward.type, name: reward.name, description: reward.description || "", quantity: reward.quantity || 1, product: reward.product || null, targetBelt: reward.targetBelt || "", targetMilestoneDay: reward.targetMilestoneDay || null, requiresFormalGrading: reward.requiresFormalGrading !== false, status: requiresApproval ? "PENDING_APPROVAL" : reward.type === "BELT_PROGRESSION" ? (reward.requiresFormalGrading === false ? "AWAITING_PROMOTION_APPROVAL" : "AWAITING_GRADING") : "EARNED" })), history: [{ action: "CRITERIA_MET", performedBy: req.user._id, performedAt: now }] });
          created = true;
        } catch (error) {
          if (error?.code !== 11000) throw error;
          achievement = await StudentCurriculumMilestone.findOne({ student: studentId, enrollment: enrollmentId, curriculum: curriculumId, milestoneStepId: id(candidate._id) });
        }
        if (achievement && created) {
          await auditService.record({ req, action: AUDIT_ACTIONS.CURRICULUM_MILESTONE_CRITERIA_MET, entityType: "CURRICULUM_MILESTONE", entityId: achievement._id, branchId: achievement.branch, after: { student: studentId, enrollment: enrollmentId, curriculum: curriculumId, milestoneStepId: id(candidate._id), status: achievement.status } });
          if (!requiresApproval && student.user) await safelyCreateNotification({ recipient: student.user, type: "STUDENT_CURRICULUM_MILESTONE_EARNED", title: "Curriculum milestone earned", message: `You earned ${candidate.milestoneName || candidate.title}.`, severity: "SUCCESS", branch: achievement.branch, student: student._id, entityType: "CURRICULUM_MILESTONE", entityId: achievement._id, eventKey: `curriculum-milestone:${achievement._id}:earned`, actionUrl: "/student-dashboard" });
        }
      }
    }
    return res.json({ success: true, progress: updated });
  } catch (error) { console.error("Record curriculum progress failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to update curriculum progress." }); }
}

async function approveMilestone(req, res) {
  try {
    const { studentId, achievementId } = req.params;
    if (!["COACH", "BRANCH_ADMIN", "SUPER_ADMIN"].includes(String(req.user.role || "").toUpperCase())) return res.status(403).json({ success: false, message: "Only authorized coaching staff may approve milestones." });
    if (![studentId, achievementId].every(validId)) return res.status(400).json({ success: false, message: "Invalid student or milestone record." });
    const student = await Student.findById(studentId).select("name branch user").lean();
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    const existing = await StudentCurriculumMilestone.findOne({ _id: achievementId, student: studentId }).select("branch").lean();
    if (!existing || !canBranch(req.user, existing.branch)) return res.status(404).json({ success: false, message: "Milestone record not found." });
    if (req.user.role === "COACH" && !await CoachStudentAssignment.exists({ coach: req.user._id, student: studentId, status: "ACTIVE" })) return res.status(404).json({ success: false, message: "Student not found." });
    const achievement = await StudentCurriculumMilestone.findOneAndUpdate(
      { _id: achievementId, student: studentId, status: "PENDING_APPROVAL" },
      { $set: { status: "EARNED", earnedAt: new Date(), approvedBy: req.user._id }, $push: { history: { action: "APPROVED", performedBy: req.user._id, performedAt: new Date() } } },
      { new: true },
    );
    if (achievement) {
      for (const reward of achievement.rewards) if (reward.status === "PENDING_APPROVAL") reward.status = reward.type === "BELT_PROGRESSION" ? (reward.requiresFormalGrading ? "AWAITING_GRADING" : "AWAITING_PROMOTION_APPROVAL") : "EARNED";
      await achievement.save();
    }
    const current = achievement || await StudentCurriculumMilestone.findOne({ _id: achievementId, student: studentId });
    if (!current) return res.status(404).json({ success: false, message: "Milestone record not found." });
    if (achievement) {
      await auditService.record({ req, action: AUDIT_ACTIONS.CURRICULUM_MILESTONE_APPROVED, entityType: "CURRICULUM_MILESTONE", entityId: current._id, branchId: current.branch, after: { student: studentId, enrollment: current.enrollment, curriculum: current.curriculum, milestoneName: current.milestoneName } });
      if (student.user) await safelyCreateNotification({ recipient: student.user, type: "STUDENT_CURRICULUM_MILESTONE_EARNED", title: "Curriculum milestone approved", message: `Your achievement ${current.milestoneName} has been approved.`, severity: "SUCCESS", branch: current.branch, student: studentId, entityType: "CURRICULUM_MILESTONE", entityId: current._id, eventKey: `curriculum-milestone:${current._id}:approved`, actionUrl: "/student-dashboard" });
    }
    return res.json({ success: true, achievement: current });
  } catch (error) { console.error("Milestone approval failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to approve milestone." }); }
}

async function issueMilestoneReward(req, res) {
  try {
    const { studentId, achievementId, rewardId } = req.params;
    if (![studentId, achievementId, rewardId].every(validId)) return res.status(400).json({ success: false, message: "Invalid milestone reward." });
    const student = await Student.findById(studentId).populate("branch", "name").lean();
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    const achievement = await StudentCurriculumMilestone.findOne({ _id: achievementId, student: studentId, status: "EARNED" });
    if (!achievement || !canBranch(req.user, achievement.branch)) return res.status(404).json({ success: false, message: "Milestone record not found." });
    const reward = achievement.rewards.id(rewardId);
    if (!reward) return res.status(404).json({ success: false, message: "Reward not found." });
    if (reward.type === "BELT_PROGRESSION") return res.status(409).json({ success: false, message: "Belt progression can only be recorded through the authorized grading or promotion workflow." });
    if (["ISSUED", "FULFILLED"].includes(reward.status)) return res.json({ success: true, duplicate: true, achievement });
    if (reward.status !== "EARNED") return res.status(409).json({ success: false, message: "The reward is not ready to issue." });
    let certificate = null;
    if (reward.type === "CERTIFICATE") {
      const certificateController = require("./certificate.controller");
      if (!reward.certificateAchievement) {
        const serial = await certificateController.nextCertificateNumber();
        const title = `${reward.name.slice(0, 55)} — ${achievement.milestoneName.slice(0, 55)} (${serial})`;
        await StudentCurriculumMilestone.findOneAndUpdate({ _id: achievementId, status: "EARNED", rewards: { $elemMatch: { _id: reward._id, status: "EARNED", certificateAchievement: { $in: ["", null] } } } }, { $set: { "rewards.$[reward].certificateAchievement": title } }, { arrayFilters: [{ "reward._id": reward._id, "reward.status": "EARNED", "reward.certificateAchievement": { $in: ["", null] } }] });
        const reserved = await StudentCurriculumMilestone.findById(achievementId);
        reward.certificateAchievement = reserved?.rewards.id(rewardId)?.certificateAchievement || title;
      }
      const title = reward.certificateAchievement;
      certificate = await Certificate.findOne({ kind: "ACHIEVEMENT", student: studentId, achievement: title });
      if (!certificate) {
        const program = await TrainingSessionType.findById(achievement.program).select("name").lean();
        try {
          certificate = await certificateController.writeCertificate(req, { kind: "ACHIEVEMENT", student: studentId, branch: achievement.branch, enrollment: achievement.enrollment, program: achievement.program, achievement: title, studentName: student.name, programName: program?.name || "", certificateNumber: title.slice(title.lastIndexOf("(") + 1, -1) });
        } catch (error) { if (error?.code !== 11000) throw error; certificate = await Certificate.findOne({ kind: "ACHIEVEMENT", student: studentId, achievement: title }); }
      }
    }
    const now = new Date();
    const updated = await StudentCurriculumMilestone.findOneAndUpdate({ _id: achievementId, student: studentId, status: "EARNED", rewards: { $elemMatch: { _id: reward._id, status: "EARNED" } } }, { $set: { "rewards.$[reward].status": "ISSUED", "rewards.$[reward].issuedAt": now, "rewards.$[reward].issuedBy": req.user._id, ...(certificate ? { "rewards.$[reward].certificate": certificate._id } : {}) }, $push: { history: { action: "REWARD_ISSUED", rewardId: reward.rewardId, performedBy: req.user._id, performedAt: now } } }, { new: true, arrayFilters: [{ "reward._id": reward._id, "reward.status": "EARNED" }] });
    const current = updated || await StudentCurriculumMilestone.findById(achievementId);
    if (!updated && !["ISSUED", "FULFILLED"].includes(current?.rewards.id(rewardId)?.status)) return res.status(409).json({ success: false, message: "Reward issuance changed concurrently; refresh and retry." });
    if (updated) await auditService.record({ req, action: AUDIT_ACTIONS.CURRICULUM_REWARD_ISSUED, entityType: "CURRICULUM_MILESTONE", entityId: achievement._id, branchId: achievement.branch, after: { student: studentId, rewardId: reward.rewardId, type: reward.type, certificate: certificate?._id || null } });
    if (certificate) await require("./certificate.controller").emailCertificate(certificate);
    return res.json({ success: true, achievement: current, certificate });
  } catch (error) { console.error("Milestone reward issue failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to issue milestone reward." }); }
}

async function fulfillMilestoneReward(req, res) {
  const { studentId, achievementId, rewardId } = req.params;
  const fulfillmentNote = String(req.body?.fulfillmentNote || "").trim();
  if (![studentId, achievementId, rewardId].every(validId) || fulfillmentNote.length < 3 || fulfillmentNote.length > 500) return res.status(400).json({ success: false, message: "A short fulfillment record is required." });
  let session;
  const transitions = [];
  try {
    const student = await Student.findById(studentId).select("name branch").lean();
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    session = await mongoose.startSession();
    let current;
    await session.withTransaction(async () => {
      const achievement = await StudentCurriculumMilestone.findOne({ _id: achievementId, student: studentId }).session(session);
      if (!achievement || !canBranch(req.user, achievement.branch)) { const error = new Error("Milestone record not found."); error.status = 404; throw error; }
      if (achievement.status !== "EARNED") { const error = new Error("Milestone is not earned."); error.status = 409; throw error; }
      const reward = achievement.rewards.id(rewardId);
      if (!reward) { const error = new Error("Reward not found."); error.status = 404; throw error; }
      if (reward.status === "FULFILLED") { current = achievement; return; }
      if (reward.status !== "ISSUED") { const error = new Error("Issue this reward before recording fulfillment."); error.status = 409; throw error; }
      if (reward.type === "MERCHANDISE" && reward.product) {
        const product = await Product.findOne({ _id: reward.product, status: "ACTIVE" }).session(session);
        const inventory = await BranchInventory.findOne({ product: reward.product, branch: achievement.branch }).session(session);
        if (!product || !inventory || inventory.quantity - inventory.reservedQuantity < reward.quantity) { const error = new Error("The configured merchandise is unavailable in this Branch inventory."); error.status = 409; throw error; }
        const previousStockState = inventory.stockState; const previousQuantity = inventory.quantity;
        inventory.quantity -= reward.quantity; inventory.stockState = stockState(inventory.quantity, inventory.reservedQuantity, inventory.minimumStock); inventory.updatedBy = req.user._id; await inventory.save({ session });
        const movement = await createStockMovement({ product: product._id, sku: product.sku, branch: achievement.branch, type: "ADJUSTMENT", quantity: reward.quantity, quantityDelta: -reward.quantity, previousQuantity, newQuantity: inventory.quantity, previousReserved: inventory.reservedQuantity, newReserved: inventory.reservedQuantity, reference: `MILESTONE:${achievement._id}`, reason: `Milestone reward fulfilled: ${fulfillmentNote}`, idempotencyKey: `curriculum-reward:${achievement._id}:${reward._id}`, performedBy: req.user._id }, session);
        transitions.push({ inventory, movement, previousStockState });
      }
      const now = new Date(); reward.status = "FULFILLED"; reward.fulfilledAt = now; reward.fulfilledBy = req.user._id; reward.fulfillmentNote = fulfillmentNote;
      achievement.history.push({ action: "REWARD_FULFILLED", rewardId: reward.rewardId, performedBy: req.user._id, performedAt: now, reason: fulfillmentNote });
      await achievement.save({ session });
      await auditService.record({ req, session, action: AUDIT_ACTIONS.CURRICULUM_REWARD_FULFILLED, entityType: "CURRICULUM_MILESTONE", entityId: achievement._id, branchId: achievement.branch, after: { student: studentId, rewardId: reward.rewardId, type: reward.type, fulfillmentNote } });
      current = achievement;
    });
    await publishStockTransitions(transitions);
    return res.json({ success: true, achievement: current });
  } catch (error) { if (error.status) return res.status(error.status).json({ success: false, message: error.message }); if (error.code === 20 || /transaction numbers are only allowed on a replica set member or mongos/i.test(error.message || "")) return res.status(503).json({ success: false, message: "Milestone merchandise fulfillment requires MongoDB running as a replica set or mongos." }); console.error("Milestone reward fulfillment failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to record milestone reward fulfillment." }); }
  finally { if (session) await session.endSession(); }
}

module.exports = { validateModules, hasDependencyCycle, listVersions, getCapacity, createDraft, updateDraft, publish, appendPublishedModule, archive, listSessions, updateSessionContent, studentCurriculumProgress, recordStepProgress, approveMilestone, issueMilestoneReward, fulfillMilestoneReward };

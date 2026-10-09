const mongoose = require("mongoose");
const GradingEvent = require("../models/GradingEvent");
const GradingEvaluation = require("../models/GradingEvaluation");
const Student = require("../models/Student");
const BeltHistory = require("../models/BeltHistory");
const Certificate = require("../models/Certificate");
const Branch = require("../models/Branch");
const TrainingSessionType = require("../models/TrainingSessionType");
const User = require("../models/User");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const { evaluateStudentPromotionEligibility } = require("../services/promotionEligibility.service");
const { safelyNotify, safelyCreateNotification } = require("../services/notification.service");
const { sendStudentEmail } = require("../services/studentEmail.service");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");

const id = (value) => String(value?._id || value || "");
const branchScoped = (user) => user?.role !== "SUPER_ADMIN" && user?.dataScope !== "ALL";
const canBranch = (user, branch) => !branchScoped(user) || Boolean(user?.branch && id(user.branch) === id(branch));
const validId = (value) => mongoose.isValidObjectId(value);
const eligibilitySnapshot = (candidate) => ({ eligible: true, currentBelt: candidate.currentBelt, trainingDay: candidate.trainingDay, milestone: candidate.milestone ? { belt: candidate.milestone.belt, skill: candidate.milestone.skill, description: candidate.milestone.description, requiresFormalGrading: candidate.milestone.requiresFormalGrading } : null, checkedAt: new Date() });
const populateEvent = (query) => query
  .populate("branch", "name address")
  .populate("program", "name normalizedName")
  .populate("examiner", "name email role")
  .populate("createdBy", "name")
  .populate("students.student", "name age currentBelt programBelts branch")
  .populate("students.program", "name");

async function eventInScope(req, eventId) {
  if (!validId(eventId)) return { error: [400, "Invalid grading event ID."] };
  const event = await GradingEvent.findById(eventId);
  if (!event) return { error: [404, "Grading event not found."] };
  if (!canBranch(req.user, event.branch)) return { error: [404, "Grading event not found."] };
  if (req.user.role === "COACH" && id(event.examiner) !== id(req.user._id)) {
    const assigned = await CoachStudentAssignment.exists({ coach: req.user._id, status: "ACTIVE", student: { $in: event.students.map((item) => item.student) } });
    if (!assigned) return { error: [404, "Grading event not found."] };
  }
  return { event };
}

async function eligibleCandidates({ user, branchId, programId, asOfDate = new Date() }) {
  if (!validId(branchId) || !validId(programId)) return [];
  const query = { branch: branchId, status: "ACTIVE" };
  if (branchScoped(user)) query.branch = user.branch;
  if (user.role === "COACH") {
    const assignments = await CoachStudentAssignment.find({ coach: user._id, status: "ACTIVE" }).select("student").lean();
    query._id = { $in: assignments.map((assignment) => assignment.student) };
  }
  const students = await Student.find(query).populate({ path: "plan", populate: { path: "programs.program", select: "name" } }).sort({ name: 1 }).lean();
  const output = [];
  for (const student of students) {
    const programEligibility = await evaluateStudentPromotionEligibility(student, { asOfDate, programId });
    for (const result of programEligibility) output.push({
      student: { _id: student._id, name: student.name, age: student.age, currentBelt: result.currentBelt || student.currentBelt },
      program: { _id: id(programId), name: result.program?.name || "Training program" },
      eligible: result.eligible,
      reason: result.reason,
      trainingDay: result.trainingDay || 0,
      milestone: result.milestone ? { belt: result.milestone.belt, skill: result.milestone.skill, requiresFormalGrading: result.milestone.requiresFormalGrading } : null,
    });
  }
  return output;
}

async function getEligibility(req, res) {
  try {
    const branchId = req.query.branch || req.user.branch;
    const programId = req.query.program;
    if (!validId(branchId) || !validId(programId)) return res.status(400).json({ success: false, message: "Choose a valid branch and program." });
    const asOfDate = req.query.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(asOfDate.getTime())) return res.status(400).json({ success: false, message: "Enter a valid grading date." });
    if (!canBranch(req.user, branchId)) return res.status(403).json({ success: false, message: "You cannot access this branch." });
    return res.json({ success: true, students: await eligibleCandidates({ user: req.user, branchId, programId, asOfDate }) });
  } catch (error) { console.error("Grading eligibility failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to calculate grading eligibility." }); }
}

async function listEvents(req, res) {
  try {
    const filter = {};
    if (branchScoped(req.user)) {
      if (!req.user.branch) return res.status(403).json({ success: false, message: "A branch is required." });
      filter.branch = req.user.branch;
    } else if (req.query.branch && validId(req.query.branch)) filter.branch = req.query.branch;
    if (req.query.status && ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(req.query.status)) filter.status = req.query.status;
    if (req.user.role === "COACH") {
      const assignments = await CoachStudentAssignment.find({ coach: req.user._id, status: "ACTIVE" }).select("student").lean();
      const studentIds = assignments.map((item) => item.student);
      filter.$or = [{ examiner: req.user._id }, { "students.student": { $in: studentIds } }];
    }
    const events = await populateEvent(GradingEvent.find(filter).sort({ date: -1, createdAt: -1 }).limit(100)).lean();
    return res.json({ success: true, events });
  } catch (error) { console.error("Grading list failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load grading events." }); }
}

async function getEvent(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const [event, allEvaluations] = await Promise.all([
      populateEvent(GradingEvent.findById(scoped.event._id)).lean(),
      GradingEvaluation.find({ event: scoped.event._id }).populate("student", "name currentBelt programBelts").populate("evaluatedBy finalizedBy", "name").sort({ createdAt: 1 }).lean(),
    ]);
    const assignedIds = req.user.role === "COACH" ? (await CoachStudentAssignment.find({ coach: req.user._id, status: "ACTIVE" }).distinct("student")).map(id) : null;
    if (assignedIds && id(scoped.event.examiner) !== id(req.user._id)) {
      event.students = event.students.filter((participant) => assignedIds.includes(id(participant.student)));
    }
    const evaluations = assignedIds && id(scoped.event.examiner) !== id(req.user._id) ? allEvaluations.filter((item) => assignedIds.includes(id(item.student))) : allEvaluations;
    return res.json({ success: true, event, evaluations });
  } catch (error) { console.error("Grading detail failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load grading event." }); }
}

async function getMyResults(req, res) {
  try {
    const student = await Student.findOne({ user: req.user._id }).select("_id").lean();
    if (!student) return res.status(404).json({ success: false, message: "Student profile not found." });
    const evaluations = await GradingEvaluation.find({ student: student._id, status: "PUBLISHED" })
      .populate({ path: "event", select: "date branch program examiner status", populate: [{ path: "branch", select: "name" }, { path: "program", select: "name" }, { path: "examiner", select: "name" }] })
      .populate("promotion", "fromBelt toBelt promotedAt")
      .sort({ publishedAt: -1 }).lean();
    return res.json({ success: true, results: evaluations });
  } catch (error) { console.error("Student grading results failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load your grading results." }); }
}

async function createEvent(req, res) {
  try {
    const { date, branch: branchId, program: programId, examiner: examinerId, studentIds, notes = "" } = req.body || {};
    if (!date || Number.isNaN(new Date(date).getTime()) || !validId(branchId) || !validId(programId) || !validId(examinerId) || !Array.isArray(studentIds) || studentIds.length < 1 || studentIds.length > 100 || typeof notes !== "string" || notes.length > 2000) return res.status(400).json({ success: false, message: "Provide a valid date, branch, program, examiner, and 1–100 students." });
    if (!canBranch(req.user, branchId)) return res.status(403).json({ success: false, message: "You cannot access this branch." });
    const [branch, program, examiner] = await Promise.all([Branch.findById(branchId).select("_id isActive"), TrainingSessionType.findById(programId).select("_id name isActive"), User.findById(examinerId).select("_id name role isActive branch")]);
    if (!branch || branch.isActive === false || !program || program.isActive === false || !examiner || examiner.isActive === false || (branchScoped(req.user) && id(examiner.branch) !== id(branchId))) return res.status(400).json({ success: false, message: "Select an active branch, program, and examiner within your branch." });
    if (new Set(studentIds.map(id)).size !== studentIds.length || studentIds.some((studentId) => !validId(studentId))) return res.status(400).json({ success: false, message: "Student selection contains invalid or duplicate records." });
    const candidates = await eligibleCandidates({ user: req.user, branchId, programId, asOfDate: new Date(date) });
    const eligibleById = new Map(candidates.filter((item) => item.eligible).map((item) => [id(item.student), item]));
    if (studentIds.some((studentId) => !eligibleById.has(id(studentId)))) return res.status(400).json({ success: false, message: "Only currently eligible students may be added to grading." });
    const event = await GradingEvent.create({ date: new Date(date), branch: branchId, program: programId, examiner: examinerId, notes: notes.trim(), createdBy: req.user._id, students: studentIds.map((studentId) => ({ student: studentId, program: programId, eligibility: eligibilitySnapshot(eligibleById.get(id(studentId))), addedBy: req.user._id })) });
    await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_CREATED, entityType: "GRADING_EVENT", entityId: event._id, branchId, after: { date: event.date, program: programId, examiner: examinerId, studentIds } });
    for (const participant of event.students) {
      await safelyNotify({ type: "GRADING_SCHEDULED", title: "Student scheduled for grading", message: `${eligibleById.get(id(participant.student)).student.name} is scheduled for ${program.name} grading on ${new Date(date).toLocaleDateString("en-IN")}.`, severity: "INFO", branch: branchId, student: participant.student, entityType: "GRADING", entityId: event._id, eventKey: `grading:${event._id}:staff-scheduled:${participant.student}`, actionUrl: `/grading/${event._id}` });
      const student = await Student.findById(participant.student).select("user").lean();
      if (student?.user) {
        await safelyCreateNotification({ recipient: student.user, type: "STUDENT_GRADING_SCHEDULED", title: "Grading scheduled", message: `Your ${program.name} grading is scheduled for ${new Date(date).toLocaleDateString("en-IN")}.`, severity: "INFO", branch: branchId, student: participant.student, entityType: "GRADING", entityId: event._id, eventKey: `grading:${event._id}:student-scheduled:${participant.student}`, actionUrl: "/student-dashboard" });
      }
    }
    return res.status(201).json({ success: true, event: await populateEvent(GradingEvent.findById(event._id)).lean() });
  } catch (error) { console.error("Grading create failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to create grading event." }); }
}

async function updateEvent(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const event = scoped.event;
    if (event.status !== "SCHEDULED") return res.status(409).json({ success: false, message: "Only scheduled grading events can be edited." });
    const before = { date: event.date, notes: event.notes, examiner: event.examiner, students: event.students.map((item) => id(item.student)) };
    let addedStudentIds = [];
    const { date, examiner: examinerId, studentIds, notes } = req.body || {};
    if (date !== undefined) { if (Number.isNaN(new Date(date).getTime())) return res.status(400).json({ success: false, message: "Enter a valid date." }); event.date = new Date(date); }
    if (notes !== undefined) { if (typeof notes !== "string" || notes.length > 2000) return res.status(400).json({ success: false, message: "Notes must be 2,000 characters or fewer." }); event.notes = notes.trim(); }
    if (examinerId !== undefined) { if (!validId(examinerId)) return res.status(400).json({ success: false, message: "Invalid examiner." }); const examiner = await User.findById(examinerId).select("_id branch isActive"); if (!examiner || examiner.isActive === false || (branchScoped(req.user) && id(examiner.branch) !== id(event.branch))) return res.status(400).json({ success: false, message: "Examiner must be active and assigned to this branch." }); event.examiner = examinerId; }
    if (studentIds !== undefined) { if (await GradingEvaluation.exists({ event: event._id })) return res.status(409).json({ success: false, message: "Participants cannot change after evaluations have started." }); if (!Array.isArray(studentIds) || !studentIds.length || studentIds.length > 100 || new Set(studentIds.map(id)).size !== studentIds.length) return res.status(400).json({ success: false, message: "Select 1–100 unique students." }); const candidates = await eligibleCandidates({ user: req.user, branchId: event.branch, programId: event.program, asOfDate: event.date }); const eligible = new Map(candidates.filter((item) => item.eligible).map((item) => [id(item.student), item])); if (studentIds.some((studentId) => !eligible.has(id(studentId)))) return res.status(400).json({ success: false, message: "Only currently eligible students may be added." }); const existingIds = new Set(event.students.map((item) => id(item.student))); addedStudentIds = studentIds.map(id).filter((studentId) => !existingIds.has(studentId)); event.students = studentIds.map((studentId) => ({ student: studentId, program: event.program, eligibility: eligibilitySnapshot(eligible.get(id(studentId))), addedBy: req.user._id })); }
    await event.save();
    const after = { date: event.date, notes: event.notes, examiner: event.examiner, students: event.students.map((item) => id(item.student)) };
    await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_UPDATED, entityType: "GRADING_EVENT", entityId: event._id, branchId: event.branch, before, after });
    if (JSON.stringify(before.students) !== JSON.stringify(after.students)) await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_STUDENT_CHANGED, entityType: "GRADING_EVENT", entityId: event._id, branchId: event.branch, before: { students: before.students }, after: { students: after.students } });
    if (addedStudentIds.length) {
      const [program, students] = await Promise.all([TrainingSessionType.findById(event.program).select("name").lean(), Student.find({ _id: { $in: addedStudentIds } }).select("_id name user").lean()]);
      for (const student of students) {
        await safelyNotify({ type: "GRADING_SCHEDULED", title: "Student scheduled for grading", message: `${student.name} is scheduled for ${program?.name || "grading"} on ${event.date.toLocaleDateString("en-IN")}.`, severity: "INFO", branch: event.branch, student: student._id, entityType: "GRADING", entityId: event._id, eventKey: `grading:${event._id}:staff-scheduled:${student._id}`, actionUrl: `/grading/${event._id}` });
        if (student.user) await safelyCreateNotification({ recipient: student.user, type: "STUDENT_GRADING_SCHEDULED", title: "Grading scheduled", message: `Your ${program?.name || "grading"} is scheduled for ${event.date.toLocaleDateString("en-IN")}.`, severity: "INFO", branch: event.branch, student: student._id, entityType: "GRADING", entityId: event._id, eventKey: `grading:${event._id}:student-scheduled:${student._id}`, actionUrl: "/student-dashboard" });
      }
    }
    return res.json({ success: true, event: await populateEvent(GradingEvent.findById(event._id)).lean() });
  } catch (error) { console.error("Grading update failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to update grading event." }); }
}

async function changeStatus(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const event = scoped.event;
    if (req.params.action === "cancel") {
      if (["COMPLETED", "CANCELLED"].includes(event.status)) return res.status(409).json({ success: false, message: "This grading event can no longer be cancelled." });
      event.status = "CANCELLED"; event.cancelledAt = new Date();
      await event.save();
      await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_CANCELLED, entityType: "GRADING_EVENT", entityId: event._id, branchId: event.branch, before: { status: "SCHEDULED/IN_PROGRESS" }, after: { status: event.status } });
    } else if (req.params.action === "start") {
      if (event.status !== "SCHEDULED") return res.status(409).json({ success: false, message: "Only scheduled grading can be started." });
      event.status = "IN_PROGRESS"; await event.save();
      await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_UPDATED, entityType: "GRADING_EVENT", entityId: event._id, branchId: event.branch, before: { status: "SCHEDULED" }, after: { status: event.status } });
    } else {
      if (event.status !== "IN_PROGRESS") return res.status(409).json({ success: false, message: "Only in-progress grading can be completed." });
      const evaluations = await GradingEvaluation.find({ event: event._id }).select("student status").lean();
      if (evaluations.length !== event.students.length || evaluations.some((item) => !["FINALIZED", "PUBLISHED"].includes(item.status))) return res.status(409).json({ success: false, message: "Finalize every participant's evaluation before completing the event." });
      event.status = "COMPLETED"; event.completedAt = new Date(); await event.save();
      await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_UPDATED, entityType: "GRADING_EVENT", entityId: event._id, branchId: event.branch, before: { status: "IN_PROGRESS" }, after: { status: event.status } });
    }
    return res.json({ success: true, event: await populateEvent(GradingEvent.findById(event._id)).lean() });
  } catch (error) { console.error("Grading status change failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to update grading status." }); }
}

function validateEvaluation(body) {
  const criteria = body?.criteria || {};
  const values = ["technique", "discipline", "attendance", "performance"];
  if (values.some((key) => !Number.isFinite(Number(criteria[key]?.value)) || Number(criteria[key].value) < 0 || Number(criteria[key].value) > 100 || String(criteria[key]?.remarks || "").length > 500)) return "Each score must be between 0 and 100; criterion remarks may not exceed 500 characters.";
  if (!Number.isFinite(Number(body.overallScore)) || Number(body.overallScore) < 0 || Number(body.overallScore) > 100) return "Overall score must be between 0 and 100.";
  if (typeof body.remarks !== "string" || body.remarks.length > 2000) return "Overall remarks must be 2,000 characters or fewer.";
  return "";
}

async function saveEvaluation(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const event = scoped.event;
    if (!["SCHEDULED", "IN_PROGRESS"].includes(event.status)) return res.status(409).json({ success: false, message: "Evaluations can only be edited before the event is completed or cancelled." });
    const studentId = req.params.studentId;
    if (!event.students.some((participant) => id(participant.student) === id(studentId))) return res.status(404).json({ success: false, message: "Student is not a participant in this grading event." });
    if (!validId(studentId)) return res.status(400).json({ success: false, message: "Invalid student ID." });
    if (req.user.role === "COACH" && !await CoachStudentAssignment.exists({ coach: req.user._id, student: studentId, status: "ACTIVE" })) return res.status(403).json({ success: false, message: "You are not assigned to this student." });
    const error = validateEvaluation(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    if (!(["PASS", "FAIL", "PENDING"].includes(req.body.result))) return res.status(400).json({ success: false, message: "Result must be PASS, FAIL, or PENDING." });
    let evaluation = await GradingEvaluation.findOne({ event: event._id, student: studentId });
    if (evaluation && evaluation.status !== "DRAFT") return res.status(409).json({ success: false, message: "Finalized evaluations cannot be changed." });
    const values = { criteria: req.body.criteria, overallScore: Number(req.body.overallScore), remarks: req.body.remarks.trim(), result: req.body.result, evaluatedBy: req.user._id };
    if (!evaluation) evaluation = new GradingEvaluation({ event: event._id, student: studentId, ...values });
    else Object.assign(evaluation, values);
    await evaluation.save();
    await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_EVALUATION_SAVED, entityType: "GRADING_EVALUATION", entityId: evaluation._id, branchId: event.branch, after: { eventId: event._id, studentId, result: evaluation.result, overallScore: evaluation.overallScore } });
    const responseEvaluation = await GradingEvaluation.findById(evaluation._id).populate("student", "name currentBelt").lean();
    return res.json({ success: true, evaluation: responseEvaluation });
  } catch (error) { if (error?.code === 11000) return res.status(409).json({ success: false, message: "An evaluation already exists for this student and event." }); console.error("Evaluation save failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to save evaluation." }); }
}

async function finalizeEvaluation(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    if (!["SCHEDULED", "IN_PROGRESS"].includes(scoped.event.status)) return res.status(409).json({ success: false, message: "Evaluations can only be finalized for active grading events." });
    const evaluation = await GradingEvaluation.findOne({ event: scoped.event._id, student: req.params.studentId });
    if (!evaluation) return res.status(404).json({ success: false, message: "Save an evaluation before finalizing it." });
    if (evaluation.status !== "DRAFT") return res.status(409).json({ success: false, message: "This evaluation has already been finalized." });
    if (!scoped.event.students.some((participant) => id(participant.student) === id(evaluation.student))) return res.status(409).json({ success: false, message: "Student is not in this grading event." });
    evaluation.status = "FINALIZED"; evaluation.finalizedBy = req.user._id; evaluation.finalizedAt = new Date(); await evaluation.save();
    await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_EVALUATION_FINALIZED, entityType: "GRADING_EVALUATION", entityId: evaluation._id, branchId: scoped.event.branch, after: { eventId: scoped.event._id, studentId: evaluation.student, result: evaluation.result } });
    let promotionAttempt = null;
    if (evaluation.result === "PASS") {
      await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_PROMOTION_TRIGGERED, entityType: "GRADING_EVALUATION", entityId: evaluation._id, branchId: scoped.event.branch, after: { gradingEventId: scoped.event._id, studentId: evaluation.student, programId: scoped.event.program } });
      const { promoteStudentForGrading } = require("./promotion.controller");
      promotionAttempt = await promoteStudentForGrading({ req, studentId: evaluation.student, programId: scoped.event.program, gradingEventId: scoped.event._id });
      if (promotionAttempt.statusCode === 201 && promotionAttempt.body?.promotion?._id) {
        evaluation.promotion = promotionAttempt.body.promotion._id;
        await evaluation.save();
        await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_PROMOTION_COMPLETED, entityType: "GRADING_EVALUATION", entityId: evaluation._id, branchId: scoped.event.branch, after: { promotionId: evaluation.promotion, gradingEventId: scoped.event._id } });
      }
    }
    const responseEvaluation = await GradingEvaluation.findById(evaluation._id).populate("student", "name currentBelt").lean();
    return res.json({ success: true, evaluation: responseEvaluation, promotion: promotionAttempt?.body?.promotion || null, promotionMessage: promotionAttempt?.body?.message || (evaluation.result === "PASS" ? "The existing promotion rules did not allow a belt change." : "") });
  } catch (error) { console.error("Evaluation finalization failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to finalize evaluation." }); }
}

async function publishResults(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const event = scoped.event;
    const evaluations = await GradingEvaluation.find({ event: event._id });
    if (!evaluations.length || evaluations.some((item) => item.status !== "FINALIZED")) return res.status(409).json({ success: false, message: "Every participating student must have a finalized evaluation before results are published." });
    for (const evaluation of evaluations) {
      evaluation.status = "PUBLISHED"; evaluation.publishedAt = new Date(); await evaluation.save();
      const student = await Student.findById(evaluation.student).select("name user").lean();
      if (student?.user) {
        await safelyCreateNotification({ recipient: student.user, type: "STUDENT_GRADING_RESULT_PUBLISHED", title: "Grading result published", message: `Your grading result is ${evaluation.result}.`, severity: evaluation.result === "PASS" ? "SUCCESS" : evaluation.result === "FAIL" ? "WARNING" : "INFO", branch: event.branch, student: evaluation.student, entityType: "GRADING", entityId: event._id, eventKey: `grading:${event._id}:result:${evaluation.student}`, actionUrl: "/student-dashboard" });
      }
      await safelyNotify({ type: "GRADING_RESULT_PUBLISHED", title: "Grading results published", message: `${student?.name || "A student"} received a ${evaluation.result} result.`, severity: evaluation.result === "PASS" ? "SUCCESS" : "INFO", branch: event.branch, student: evaluation.student, entityType: "GRADING", entityId: event._id, eventKey: `grading:${event._id}:staff-result:${evaluation.student}`, actionUrl: `/grading/${event._id}` });
      const certificateFilters = [{ evaluation: evaluation._id }, { gradingEvent: event._id }];
      if (evaluation.promotion) certificateFilters.push({ promotion: evaluation.promotion });
      const [promotion, certificate] = await Promise.all([
        evaluation.promotion ? BeltHistory.findById(evaluation.promotion).select("fromBelt toBelt").lean() : null,
        Certificate.findOne({ student: evaluation.student, $or: certificateFilters }).select("certificateNumber").lean(),
      ]);
      await sendStudentEmail({
        studentId: evaluation.student,
        eventKey: `grading:${event._id}:outcome:${evaluation.student}`,
        category: "GRADING_RESULT_PUBLISHED",
        subject: `Your grading result: ${evaluation.result}`,
        text: [
          `Your grading result is ${evaluation.result}.`,
          `Overall score: ${Number(evaluation.overallScore).toFixed(1)}%`,
          promotion ? `Promotion: ${promotion.fromBelt} to ${promotion.toBelt}` : "",
          certificate ? `Certificate reference: ${certificate.certificateNumber}` : "",
          evaluation.remarks ? `Remarks: ${evaluation.remarks}` : "",
          "",
          "Sign in to your student dashboard to view the full result.",
        ].filter(Boolean).join("\n"),
      }).catch(() => {});
    }
    await auditService.record({ req, action: AUDIT_ACTIONS.GRADING_RESULT_PUBLISHED, entityType: "GRADING_EVENT", entityId: event._id, branchId: event.branch, after: { studentCount: evaluations.length, results: evaluations.map(({ student, result }) => ({ student, result })) } });
    return res.json({ success: true, evaluations });
  } catch (error) { console.error("Result publication failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to publish grading results." }); }
}

module.exports = { getEligibility, listEvents, getEvent, getMyResults, createEvent, updateEvent, changeStatus, saveEvaluation, finalizeEvaluation, publishResults };

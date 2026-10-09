const mongoose = require("mongoose");

const AcademyEvent = require("../models/AcademyEvent");
const AcademyEventRegistration = require("../models/AcademyEventRegistration");
const Branch = require("../models/Branch");
const Student = require("../models/Student");
const TrainingSessionType = require("../models/TrainingSessionType");
const User = require("../models/User");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const auditService = require("../services/audit.service");
const { dayKey, dateOnly, detectAcademyEventConflicts } = require("../services/calendar.service");
const { safelyCreateNotification, safelyNotify } = require("../services/notification.service");
const { EVENT_CATEGORIES, EVENT_STATUSES } = require("../models/AcademyEvent");
const { REGISTRATION_STATUSES } = require("../models/AcademyEventRegistration");
const { sendStudentEmail } = require("../services/studentEmail.service");

const id = (value) => String(value?._id || value || "");
const compareIds = (first, second) => id(first) === id(second);
const isAllScope = (user) => String(user?.role || "").toUpperCase() === "SUPER_ADMIN" || user?.dataScope === "ALL";
const canAccessBranch = (user, branch) => isAllScope(user) || Boolean(user?.branch && id(user.branch) === id(branch));
const validClock = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));

function normalisePayload(body = {}) {
  const startDate = dayKey(body.startDate);
  const endDate = dayKey(body.endDate || body.startDate);
  const capacityValue = body.capacity === "" || body.capacity === null || body.capacity === undefined
    ? null
    : Number(body.capacity);
  return {
    name: String(body.name || "").trim(),
    description: String(body.description || "").trim(),
    category: String(body.category || "").trim().toUpperCase(),
    branch: String(body.branch || "").trim(),
    startDate,
    endDate,
    startTime: String(body.startTime || "").trim(),
    endTime: String(body.endTime || "").trim(),
    program: body.program ? String(body.program) : null,
    coach: body.coach ? String(body.coach) : null,
    capacity: capacityValue,
    location: String(body.location || "").trim(),
    registrationRequired: body.registrationRequired === true,
    registrationDeadline: body.registrationDeadline ? dayKey(body.registrationDeadline) : null,
    status: String(body.status || "DRAFT").trim().toUpperCase(),
  };
}

function validatePayload(values) {
  if (!values.name) return "Event name is required.";
  if (!EVENT_CATEGORIES.includes(values.category)) return "Choose a valid event category.";
  if (!mongoose.isValidObjectId(values.branch)) return "Choose a valid branch.";
  if (!dateOnly(values.startDate) || !dateOnly(values.endDate) || values.endDate < values.startDate) return "Start and end dates must be valid calendar dates.";
  if (!validClock(values.startTime) || !validClock(values.endTime)) return "Start and end times must use HH:mm.";
  if (values.program && !mongoose.isValidObjectId(values.program)) return "Program is invalid.";
  if (values.coach && !mongoose.isValidObjectId(values.coach)) return "Coach is invalid.";
  if (values.capacity !== null && (!Number.isInteger(values.capacity) || values.capacity < 1)) return "Capacity must be a whole number greater than zero.";
  if (values.registrationDeadline && (!dateOnly(values.registrationDeadline) || values.registrationDeadline > values.startDate)) return "Registration deadline must be on or before the event start date.";
  if (!EVENT_STATUSES.includes(values.status) || ["CANCELLED", "COMPLETED", "FULL"].includes(values.status)) return "Use the lifecycle actions to cancel or complete an event.";
  return null;
}

async function validateReferences(values, user) {
  if (!canAccessBranch(user, values.branch)) return "You do not have access to this branch.";
  const branch = await Branch.findById(values.branch).select("_id name isActive").lean();
  if (!branch) return "Branch not found.";
  if (branch.isActive === false) return "Events cannot be scheduled for an inactive branch.";
  if (values.program) {
    const program = await TrainingSessionType.findById(values.program).select("_id").lean();
    if (!program) return "Program not found.";
  }
  if (values.coach) {
    const coach = await User.findOne({ _id: values.coach, role: "COACH", isActive: { $ne: false } }).select("_id branch").lean();
    if (!coach) return "Coach not found.";
    if (!id(coach.branch) || id(coach.branch) !== values.branch) return "Coach must belong to the selected branch.";
  }
  return null;
}

async function eventInScope(req, eventId) {
  if (!mongoose.isValidObjectId(eventId)) return { error: [400, "Invalid academy event ID."] };
  const academyEvent = await AcademyEvent.findById(eventId);
  if (!academyEvent || !canAccessBranch(req.user, academyEvent.branch)) return { error: [404, "Academy event not found."] };
  return { academyEvent };
}

function serializeEvent(academyEvent) {
  return {
    _id: academyEvent._id,
    name: academyEvent.name,
    description: academyEvent.description || "",
    category: academyEvent.category,
    branch: academyEvent.branch,
    startDate: dayKey(academyEvent.startDate),
    endDate: dayKey(academyEvent.endDate),
    startTime: academyEvent.startTime,
    endTime: academyEvent.endTime,
    program: academyEvent.program,
    coach: academyEvent.coach,
    capacity: academyEvent.capacity,
    location: academyEvent.location || "",
    registrationRequired: academyEvent.registrationRequired,
    registrationDeadline: academyEvent.registrationDeadline ? dayKey(academyEvent.registrationDeadline) : null,
    status: academyEvent.status,
    createdAt: academyEvent.createdAt,
    updatedAt: academyEvent.updatedAt,
    cancelledAt: academyEvent.cancelledAt,
    completedAt: academyEvent.completedAt,
  };
}

async function notifyEventChange(academyEvent, type, title, message, eventSuffix) {
  await safelyNotify({
    type,
    title,
    message,
    severity: type === "ACADEMY_EVENT_CANCELLED" ? "WARNING" : "INFO",
    branch: academyEvent.branch,
    entityType: "ACADEMY_EVENT",
    entityId: academyEvent._id,
    eventKey: `academy-event:${academyEvent._id}:${eventSuffix}:staff`,
    actionUrl: "/calendar",
  });
  const registrations = await AcademyEventRegistration.find({ event: academyEvent._id, status: { $in: ["REGISTERED", "ATTENDED"] } })
    .populate("student", "user")
    .lean();
  const studentType = type === "ACADEMY_EVENT_CANCELLED"
    ? "STUDENT_ACADEMY_EVENT_CANCELLED"
    : type === "ACADEMY_EVENT_UPDATED"
      ? "STUDENT_ACADEMY_EVENT_UPDATED"
      : "STUDENT_ACADEMY_EVENT_SCHEDULED";
  await Promise.all(registrations.map((registration) => registration.student?.user
    ? safelyCreateNotification({
      recipient: registration.student.user,
      type: studentType,
      title,
      message,
      severity: type === "ACADEMY_EVENT_CANCELLED" ? "WARNING" : "INFO",
      branch: academyEvent.branch,
      student: registration.student._id,
      entityType: "ACADEMY_EVENT",
      entityId: academyEvent._id,
      eventKey: `academy-event:${academyEvent._id}:${eventSuffix}:student:${registration.student._id}`,
      actionUrl: "/student-dashboard",
    })
    : null));
}

function eventDetails(academyEvent) {
  return [`Date: ${dayKey(academyEvent.startDate)}${dayKey(academyEvent.endDate) !== dayKey(academyEvent.startDate) ? ` to ${dayKey(academyEvent.endDate)}` : ""}`, `Time: ${academyEvent.startTime}–${academyEvent.endTime}`, academyEvent.location ? `Location: ${academyEvent.location}` : ""].filter(Boolean).join("\n");
}

function materialChanges(before, after) {
  const labels = { name: "event name", startDate: "start date", endDate: "end date", startTime: "start time", endTime: "end time", location: "location" };
  return Object.keys(labels).filter((key) => String(before[key] || "") !== String(after[key] || "")).map((key) => labels[key]);
}

async function emailRegisteredStudents(academyEvent, { eventKey, category, subject, text }) {
  const registrations = await AcademyEventRegistration.find({ event: academyEvent._id, status: { $in: ["REGISTERED", "ATTENDED"] } }).select("student").lean();
  await Promise.all(registrations.map((registration) => sendStudentEmail({ studentId: registration.student, eventKey: `${eventKey}:student:${registration.student}`, category, subject, text }).catch(() => {})));
}

async function validateConflicts(values, excludeId, confirmed) {
  const conflicts = await detectAcademyEventConflicts({ draft: values, excludeId });
  const blocking = conflicts.filter((item) => item.severity === "BLOCKING");
  const warnings = conflicts.filter((item) => item.severity === "WARNING");
  if (blocking.length || (warnings.length && !confirmed)) {
    const error = new Error(blocking.length ? "This event conflicts with an existing schedule." : "Confirm the schedule warning before saving this event.");
    error.status = 409;
    error.conflicts = conflicts;
    error.requiresConfirmation = Boolean(!blocking.length && warnings.length);
    throw error;
  }
  return conflicts;
}

async function previewConflicts(req, res) {
  try {
    const values = normalisePayload(req.body);
    const validation = validatePayload(values) || await validateReferences(values, req.user);
    if (validation) return res.status(400).json({ success: false, message: validation });
    const conflicts = await detectAcademyEventConflicts({ draft: values, excludeId: req.body?.excludeId || null });
    return res.json({ success: true, conflicts, blocking: conflicts.filter((item) => item.severity === "BLOCKING"), warnings: conflicts.filter((item) => item.severity === "WARNING") });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to check event conflicts." });
  }
}

async function createAcademyEvent(req, res) {
  try {
    const values = normalisePayload(req.body);
    const validation = validatePayload(values) || await validateReferences(values, req.user);
    if (validation) return res.status(400).json({ success: false, message: validation });
    const conflicts = await validateConflicts(values, null, req.body?.confirmConflicts === true);
    const academyEvent = await AcademyEvent.create({ ...values, startDate: dateOnly(values.startDate), endDate: dateOnly(values.endDate), registrationDeadline: values.registrationDeadline ? dateOnly(values.registrationDeadline) : null, createdBy: req.user._id, updatedBy: req.user._id });
    await auditService.record({ req, action: AUDIT_ACTIONS.ACADEMY_EVENT_CREATED, entityType: "ACADEMY_EVENT", entityId: academyEvent._id, branchId: academyEvent.branch, after: serializeEvent(academyEvent) });
    if (["SCHEDULED", "OPEN"].includes(academyEvent.status)) await notifyEventChange(academyEvent, "ACADEMY_EVENT_SCHEDULED", "Academy event scheduled", `${academyEvent.name} is scheduled for ${dayKey(academyEvent.startDate)}.`, "created");
    return res.status(201).json({ success: true, event: serializeEvent(academyEvent), conflicts });
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ success: false, message: error.message, conflicts: error.conflicts, requiresConfirmation: error.requiresConfirmation });
    console.error("Create academy event failed:", { name: error?.name || "Error" });
    return res.status(500).json({ success: false, message: "Unable to create academy event." });
  }
}

async function updateAcademyEvent(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const existing = scoped.academyEvent;
    if (["CANCELLED", "COMPLETED"].includes(existing.status)) return res.status(409).json({ success: false, message: "Completed or cancelled events cannot be edited." });
    const values = normalisePayload({ ...serializeEvent(existing), ...req.body });
    const validation = validatePayload(values) || await validateReferences(values, req.user);
    if (validation) return res.status(400).json({ success: false, message: validation });
    const conflicts = await validateConflicts(values, existing._id, req.body?.confirmConflicts === true);
    const before = serializeEvent(existing);
    Object.assign(existing, { ...values, startDate: dateOnly(values.startDate), endDate: dateOnly(values.endDate), registrationDeadline: values.registrationDeadline ? dateOnly(values.registrationDeadline) : null, updatedBy: req.user._id });
    await existing.save();
    await auditService.record({ req, action: AUDIT_ACTIONS.ACADEMY_EVENT_UPDATED, entityType: "ACADEMY_EVENT", entityId: existing._id, branchId: existing.branch, before, after: serializeEvent(existing) });
    await notifyEventChange(existing, "ACADEMY_EVENT_UPDATED", "Academy event updated", `${existing.name} has been updated.`, `updated:${existing.updatedAt.getTime()}`);
    const changes = materialChanges(before, serializeEvent(existing));
    if (changes.length) await emailRegisteredStudents(existing, {
      eventKey: `academy-event:${existing._id}:updated:${existing.updatedAt.getTime()}`,
      category: "ACADEMY_EVENT_UPDATED",
      subject: `${existing.name} has changed`,
      text: [`An event you registered for has changed: ${changes.join(", ")}.`, "", eventDetails(existing), "", "Please review the updated details with the academy if needed."].join("\n"),
    });
    return res.json({ success: true, event: serializeEvent(existing), conflicts });
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ success: false, message: error.message, conflicts: error.conflicts, requiresConfirmation: error.requiresConfirmation });
    console.error("Update academy event failed:", { name: error?.name || "Error" });
    return res.status(500).json({ success: false, message: "Unable to update academy event." });
  }
}

async function getAcademyEvent(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const registrations = await AcademyEventRegistration.find({ event: scoped.academyEvent._id }).populate("student", "name currentBelt").sort({ createdAt: -1 }).lean();
    return res.json({ success: true, event: serializeEvent(scoped.academyEvent), registrations });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load academy event." });
  }
}

async function listAcademyEvents(req, res) {
  try {
    const branch = req.query.branch ? String(req.query.branch) : null;
    if (branch && !mongoose.isValidObjectId(branch)) return res.status(400).json({ success: false, message: "Invalid branch ID." });
    if (branch && !canAccessBranch(req.user, branch)) return res.status(403).json({ success: false, message: "You do not have access to this branch." });
    const filter = isAllScope(req.user) ? {} : { branch: req.user.branch };
    if (branch) filter.branch = branch;
    if (req.query.status && EVENT_STATUSES.includes(String(req.query.status).toUpperCase())) filter.status = String(req.query.status).toUpperCase();
    const events = await AcademyEvent.find(filter).sort({ startDate: 1, startTime: 1 }).lean();
    return res.json({ success: true, events: events.map(serializeEvent) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load academy events." });
  }
}

async function setLifecycle(req, res, status) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const academyEvent = scoped.academyEvent;
    if (["CANCELLED", "COMPLETED"].includes(academyEvent.status)) return res.status(409).json({ success: false, message: "This event is already closed." });
    const before = serializeEvent(academyEvent);
    academyEvent.status = status;
    academyEvent.updatedBy = req.user._id;
    if (status === "CANCELLED") academyEvent.cancelledAt = new Date();
    if (status === "COMPLETED") academyEvent.completedAt = new Date();
    await academyEvent.save();
    const action = status === "CANCELLED" ? AUDIT_ACTIONS.ACADEMY_EVENT_CANCELLED : AUDIT_ACTIONS.ACADEMY_EVENT_COMPLETED;
    await auditService.record({ req, action, entityType: "ACADEMY_EVENT", entityId: academyEvent._id, branchId: academyEvent.branch, before, after: serializeEvent(academyEvent) });
    if (status === "CANCELLED") {
      await notifyEventChange(academyEvent, "ACADEMY_EVENT_CANCELLED", "Academy event cancelled", `${academyEvent.name} has been cancelled.`, "cancelled");
      await emailRegisteredStudents(academyEvent, {
        eventKey: `academy-event:${academyEvent._id}:cancelled`, category: "ACADEMY_EVENT_CANCELLED",
        subject: `${academyEvent.name} has been cancelled`,
        text: [`The following event has been cancelled:`, "", academyEvent.name, eventDetails(academyEvent), "", "Please contact the academy if you have questions."].join("\n"),
      });
    }
    return res.json({ success: true, event: serializeEvent(academyEvent) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to update event status." });
  }
}

function enrolledInProgram(student, programId) {
  if (!programId) return true;
  return (student.planEnrollments || []).some((enrollment) => enrollment.status === "ACTIVE" && (enrollment.programs || []).some((program) => id(program.program) === id(programId)));
}

async function createRegistration(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const academyEvent = scoped.academyEvent;
    if (!academyEvent.registrationRequired) return res.status(409).json({ success: false, message: "This event does not require registration." });
    if (!["SCHEDULED", "OPEN", "FULL"].includes(academyEvent.status)) return res.status(409).json({ success: false, message: "Registration is not available for this event." });
    if (academyEvent.registrationDeadline && dayKey(new Date()) > dayKey(academyEvent.registrationDeadline)) return res.status(409).json({ success: false, message: "The registration deadline has passed." });
    const studentId = String(req.body?.student || "");
    if (!mongoose.isValidObjectId(studentId)) return res.status(400).json({ success: false, message: "Choose a valid student." });
    const student = await Student.findById(studentId).select("_id name branch status planEnrollments user").lean();
    if (!student || !canAccessBranch(req.user, student.branch) || !compareIds(student.branch, academyEvent.branch)) return res.status(404).json({ success: false, message: "Student not found for this event branch." });
    if (student.status !== "ACTIVE") return res.status(409).json({ success: false, message: "Only active students can register." });
    if (!enrolledInProgram(student, academyEvent.program)) return res.status(409).json({ success: false, message: "Student is not enrolled in this event program." });
    const activeRegistrations = await AcademyEventRegistration.countDocuments({ event: academyEvent._id, status: { $in: ["REGISTERED", "ATTENDED"] } });
    if (academyEvent.capacity !== null && activeRegistrations >= academyEvent.capacity) {
      academyEvent.status = "FULL";
      await academyEvent.save();
      return res.status(409).json({ success: false, message: "This event is already at capacity." });
    }
    const registration = await AcademyEventRegistration.findOneAndUpdate(
      { event: academyEvent._id, student: student._id },
      { $set: { status: "REGISTERED", registeredBy: req.user._id, updatedBy: req.user._id, cancelledAt: null } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    );
    const updatedCount = activeRegistrations + 1;
    if (academyEvent.capacity !== null && updatedCount >= academyEvent.capacity) {
      academyEvent.status = "FULL";
      await academyEvent.save();
    }
    await auditService.record({ req, action: AUDIT_ACTIONS.ACADEMY_EVENT_REGISTRATION_CHANGED, entityType: "ACADEMY_EVENT_REGISTRATION", entityId: registration._id, branchId: academyEvent.branch, after: { eventId: academyEvent._id, studentId: student._id, status: registration.status } });
    await safelyNotify({ type: "ACADEMY_EVENT_REGISTRATION", title: "Event registration", message: `${student.name} registered for ${academyEvent.name}.`, severity: "SUCCESS", branch: academyEvent.branch, student: student._id, entityType: "ACADEMY_EVENT", entityId: academyEvent._id, eventKey: `academy-event:${academyEvent._id}:registration:${student._id}:staff`, actionUrl: "/calendar" });
    if (student.user) await safelyCreateNotification({ recipient: student.user, type: "STUDENT_ACADEMY_EVENT_REGISTRATION", title: "Event registration confirmed", message: `You are registered for ${academyEvent.name}.`, severity: "SUCCESS", branch: academyEvent.branch, student: student._id, entityType: "ACADEMY_EVENT", entityId: academyEvent._id, eventKey: `academy-event:${academyEvent._id}:registration:${student._id}:student`, actionUrl: "/student-dashboard" });
    await sendStudentEmail({
      studentId: student._id, eventKey: `academy-event:${academyEvent._id}:registration:${student._id}`, category: "ACADEMY_EVENT_REGISTRATION",
      subject: `Registration confirmed: ${academyEvent.name}`,
      text: [`Your registration is confirmed for ${academyEvent.name}.`, "", eventDetails(academyEvent), "", "Please contact the academy if you need assistance."].join("\n"),
    }).catch(() => {});
    return res.status(201).json({ success: true, registration, eventStatus: academyEvent.status });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Student is already registered for this event." });
    console.error("Create academy event registration failed:", { name: error?.name || "Error" });
    return res.status(500).json({ success: false, message: "Unable to register student for this event." });
  }
}

async function updateRegistration(req, res) {
  try {
    const scoped = await eventInScope(req, req.params.id);
    if (scoped.error) return res.status(scoped.error[0]).json({ success: false, message: scoped.error[1] });
    const registration = await AcademyEventRegistration.findOne({ _id: req.params.registrationId, event: scoped.academyEvent._id });
    if (!registration) return res.status(404).json({ success: false, message: "Registration not found." });
    const status = String(req.body?.status || "").toUpperCase();
    if (!REGISTRATION_STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Invalid registration status." });
    registration.status = status;
    registration.result = String(req.body?.result || registration.result || "").trim();
    registration.updatedBy = req.user._id;
    if (status === "CANCELLED") registration.cancelledAt = new Date();
    if (status === "ATTENDED") registration.attendedAt = new Date();
    await registration.save();
    if (status === "CANCELLED" && scoped.academyEvent.status === "FULL") {
      scoped.academyEvent.status = "OPEN";
      await scoped.academyEvent.save();
    }
    await auditService.record({ req, action: AUDIT_ACTIONS.ACADEMY_EVENT_REGISTRATION_CHANGED, entityType: "ACADEMY_EVENT_REGISTRATION", entityId: registration._id, branchId: scoped.academyEvent.branch, after: { eventId: scoped.academyEvent._id, studentId: registration.student, status } });
    return res.json({ success: true, registration });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to update event registration." });
  }
}

module.exports = {
  previewConflicts,
  listAcademyEvents,
  createAcademyEvent,
  getAcademyEvent,
  updateAcademyEvent,
  cancelAcademyEvent: (req, res) => setLifecycle(req, res, "CANCELLED"),
  completeAcademyEvent: (req, res) => setLifecycle(req, res, "COMPLETED"),
  createRegistration,
  updateRegistration,
};

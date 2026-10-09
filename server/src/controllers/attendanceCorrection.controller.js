const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const AttendanceCorrection = require("../models/AttendanceCorrection");
const Makeup = require("../models/Makeup");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const auditService = require("../services/audit.service");
const { recalculateEnrollmentFirstAttendedClassDate } = require("../services/enrollmentAttendance.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const { isBranchScoped } = require("../utils/access");

function scoped(req, branch) {
  return !isBranchScoped(req.user) || (req.user.branch && String(req.user.branch) === String(branch));
}

async function requestCorrection(req, res) {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || "").trim();
    const proposedStatus = String(req.body?.proposedStatus || "").toUpperCase();
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid attendance ID." });
    if (!reason || reason.length > 500) return res.status(400).json({ success: false, message: "A reason of 1 to 500 characters is required." });
    if (!["PRESENT", "ABSENT"].includes(proposedStatus)) return res.status(400).json({ success: false, message: "Proposed status must be PRESENT or ABSENT." });
    const attendance = await Attendance.findById(id);
    if (!attendance) return res.status(404).json({ success: false, message: "Attendance was not found." });
    if (!scoped(req, attendance.branch)) return res.status(403).json({ success: false, message: "You cannot access this branch." });
    if (attendance.attendanceType !== "REGULAR") return res.status(409).json({ success: false, message: "Only regular attendance can be corrected." });
    if (req.user.role === "COACH" && !await CoachStudentAssignment.exists({ coach: req.user._id, student: attendance.student, status: "ACTIVE" })) return res.status(403).json({ success: false, message: "You are not assigned to this student." });
    if (new Date(attendance.date) >= startOfLocalDay(new Date())) return res.status(409).json({ success: false, message: "Only historical attendance requires correction approval." });
    if (proposedStatus === attendance.status) return res.status(400).json({ success: false, message: "The proposed status matches the current attendance." });
    let created;
    await session.withTransaction(async () => {
      const [correction] = await AttendanceCorrection.create([{
        attendance: attendance._id, student: attendance.student, branch: attendance.branch,
        requestedBy: req.user._id, reason,
        original: { status: attendance.status, attendanceType: attendance.attendanceType, makeupRequired: attendance.makeupRequired, makeupCompleted: attendance.makeupCompleted, markedBy: attendance.markedBy, updatedAt: attendance.updatedAt },
        proposed: { status: proposedStatus },
      }], { session });
      await auditService.record({ req, session, action: AUDIT_ACTIONS.ATTENDANCE_CORRECTION_REQUESTED, entityType: "ATTENDANCE", entityId: attendance._id, branchId: attendance.branch, before: { status: attendance.status }, after: { proposedStatus, correctionId: correction._id }, metadata: { reason } });
      created = correction;
    });
    return res.status(201).json({ success: true, correction: created });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "A correction is already pending for this attendance." });
    console.error("Attendance correction request failed", { name: error.name, code: error.code });
    return res.status(500).json({ success: false, message: "Unable to request attendance correction." });
  } finally { await session.endSession(); }
}

function startOfLocalDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }

async function getCorrectionRequests(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 25));
    if (!Number.isSafeInteger(page) || page > 1_000_000) return res.status(400).json({ success: false, message: "Invalid page." });
    const query = {};
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) return res.status(403).json({ success: false, message: "A branch is required." });
      if (req.query.branchId && String(req.query.branchId) !== String(req.user.branch)) return res.status(403).json({ success: false, message: "You cannot view corrections from another branch." });
      query.branch = req.user.branch;
    } else if (req.query.branchId) {
      if (!mongoose.isValidObjectId(req.query.branchId)) return res.status(400).json({ success: false, message: "Invalid branch ID." });
      query.branch = req.query.branchId;
    }
    const status = String(req.query.status || "PENDING").toUpperCase();
    if (!['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'].includes(status)) return res.status(400).json({ success: false, message: "Invalid correction status." });
    if (status !== "ALL") query.status = status;
    const [corrections, totalItems] = await Promise.all([
      AttendanceCorrection.find(query).populate("student", "name status").populate("attendance", "date status attendanceType makeupRequired").populate("requestedBy", "name").populate("approvedBy", "name").populate("branch", "name").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      AttendanceCorrection.countDocuments(query),
    ]);
    return res.json({ success: true, corrections, page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) });
  } catch (error) {
    console.error("Attendance correction query failed", { name: error.name });
    return res.status(500).json({ success: false, message: "Unable to load attendance corrections." });
  }
}

async function decideCorrection(req, res, decision) {
  const session = await mongoose.startSession();
  try {
    const { correctionId } = req.params;
    if (!mongoose.isValidObjectId(correctionId)) return res.status(400).json({ success: false, message: "Invalid correction ID." });
    const reason = String(req.body?.reason || "").trim();
    if (decision === "REJECTED" && (!reason || reason.length > 500)) return res.status(400).json({ success: false, message: "A rejection reason of 1 to 500 characters is required." });
    let result;
    let conflict = null;
    await session.withTransaction(async () => {
      const correction = await AttendanceCorrection.findOne({ _id: correctionId, status: "PENDING" }).session(session);
      if (!correction) { conflict = "Correction not found or already decided."; return; }
      if (!scoped(req, correction.branch)) { conflict = "You cannot access this branch."; return; }
      if (String(correction.requestedBy) === String(req.user._id)) { conflict = "The requester cannot approve or reject their own correction."; return; }
      const attendance = await Attendance.findOne({ _id: correction.attendance, attendanceType: "REGULAR" }).session(session);
      if (!attendance) { conflict = "The original attendance record no longer exists."; return; }
      if (decision === "APPROVED") {
        const makeup = await Makeup.findOne({ originalAttendance: attendance._id }).session(session);
        if (correction.proposed.status === "PRESENT") {
          if (makeup?.status === "COMPLETED" || makeup?.makeupAttendance) { conflict = "A completed makeup prevents changing this absence to present."; return; }
          if (makeup) { makeup.status = "CANCELLED"; makeup.notes = [makeup.notes, "Cancelled after approved attendance correction."].filter(Boolean).join(" ").slice(0, 1000); await makeup.save({ session }); }
          attendance.status = "PRESENT"; attendance.makeupRequired = false;
        } else {
          if (attendance.makeupCompleted || attendance.makeupAttendance || makeup?.status === "COMPLETED" || makeup?.makeupAttendance) { conflict = "Completed makeup history prevents this correction."; return; }
          if (makeup?.status === "CANCELLED") { conflict = "A cancelled makeup record already exists; manual review is required."; return; }
          if (!makeup) {
            await Makeup.create([{
              student: attendance.student, enrollment: attendance.enrollment, plan: attendance.plan, sessionTypeId: attendance.sessionTypeId, sessionSlotId: attendance.sessionSlotId,
              branch: attendance.branch, originalAttendance: attendance._id, planDay: attendance.planDay, originalDate: attendance.date,
              status: "SCHEDULED", curriculumTitle: attendance.curriculumTitle, curriculumSkill: attendance.curriculumSkill, markedBy: attendance.markedBy,
              notes: "Created after approved attendance correction.",
            }], { session });
          }
          attendance.status = "ABSENT"; attendance.makeupRequired = true; attendance.makeupCompleted = false;
        }
        await attendance.save({ session });
        if (attendance.enrollment) await recalculateEnrollmentFirstAttendedClassDate({ studentId: attendance.student, enrollmentId: attendance.enrollment, session });
      }
      correction.status = decision;
      correction.approvedBy = req.user._id;
      correction.approvedAt = new Date();
      correction.rejectionReason = decision === "REJECTED" ? reason : "";
      correction.final = decision === "APPROVED" ? { status: attendance.status, makeupRequired: attendance.makeupRequired, correctedAt: correction.approvedAt } : null;
      await correction.save({ session });
      await auditService.record({ req, session, action: decision === "APPROVED" ? AUDIT_ACTIONS.ATTENDANCE_CORRECTION_APPROVED : AUDIT_ACTIONS.ATTENDANCE_CORRECTION_REJECTED, entityType: "ATTENDANCE", entityId: attendance._id, branchId: attendance.branch, before: correction.original, after: correction.final || { status: "REJECTED", rejectionReason: reason }, metadata: { correctionId: correction._id, requestedBy: correction.requestedBy } });
      result = correction;
    });
    if (conflict) return res.status(conflict.includes("branch") ? 403 : 409).json({ success: false, message: conflict });
    return res.json({ success: true, correction: result });
  } catch (error) {
    console.error("Attendance correction decision failed", { name: error.name, code: error.code });
    return res.status(500).json({ success: false, message: "Unable to decide attendance correction." });
  } finally { await session.endSession(); }
}

module.exports = { getCorrectionRequests, requestCorrection, approveCorrection: (req, res) => decideCorrection(req, res, "APPROVED"), rejectCorrection: (req, res) => decideCorrection(req, res, "REJECTED") };

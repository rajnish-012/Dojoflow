const mongoose = require("mongoose");
const Certificate = require("../models/Certificate");
const BeltHistory = require("../models/BeltHistory");
const Student = require("../models/Student");
const TrainingSessionType = require("../models/TrainingSessionType");
const AcademySettings = require("../models/AcademySettings");
const FinanceSequence = require("../models/FinanceSequence");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const GradingEvaluation = require("../models/GradingEvaluation");
const { sendStudentEmail } = require("../services/studentEmail.service");

const id = (value) => String(value?._id || value || "");
const scoped = (user, branch) => user?.role === "SUPER_ADMIN" || user?.dataScope === "ALL" || id(user?.branch) === id(branch);
const nextNumber = async () => {
  const year = new Date().getFullYear();
  const row = await FinanceSequence.findOneAndUpdate({ key: `CRT:${year}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after" });
  return `CRT-${year}-${String(row.value).padStart(6, "0")}`;
};

async function snapshotBranding() {
  const settings = await AcademySettings.findOne().sort({ updatedAt: -1 }).lean();
  return {
    name: settings?.academyName || "ForceStrike Academy", logoUrl: settings?.logoUrl || "",
    address: settings?.address || "", contactEmail: settings?.contactEmail || "",
    contactPhone: settings?.contactPhone || "", primaryColor: settings?.primaryColor || "#D7A84B",
    secondaryColor: settings?.secondaryColor || "#101A33",
  };
}

async function writeCertificate(req, data) {
  const certificate = await Certificate.create({ ...data, certificateNumber: data.certificateNumber || await nextNumber(), issuedAt: new Date(), issuedBy: req.user._id, academy: await snapshotBranding() });
  await auditService.record({ req, action: AUDIT_ACTIONS.CERTIFICATE_GENERATED, entityType: "CERTIFICATE", entityId: certificate._id, branchId: certificate.branch, after: { certificateNumber: certificate.certificateNumber, kind: certificate.kind, studentId: certificate.student, promotionId: certificate.promotion, gradingEventId: certificate.gradingEvent } });
  return certificate;
}

async function emailCertificate(certificate) {
  // A certificate prepared before grading publication is included in the one grading outcome email.
  if (certificate.gradingEvent) {
    const evaluation = await GradingEvaluation.findOne({ event: certificate.gradingEvent, student: certificate.student }).select("status").lean();
    if (evaluation?.status !== "PUBLISHED") return;
  }
  await sendStudentEmail({
    studentId: certificate.student,
    eventKey: `certificate:${certificate._id}:issued`,
    category: "CERTIFICATE_ISSUED",
    subject: `Your certificate is ready: ${certificate.certificateNumber}`,
    text: [`Your ${certificate.kind.replaceAll("_", " ").toLowerCase()} certificate is ready.`, "", `Certificate reference: ${certificate.certificateNumber}`, certificate.programName ? `Program: ${certificate.programName}` : "", certificate.belt ? `Belt: ${certificate.belt}` : "", "", "Sign in to your student dashboard to view your certificate."].filter(Boolean).join("\n"),
  }).catch(() => {});
}

async function listCertificates(req, res) {
  try {
    const filter = req.user.dataScope === "ALL" || req.user.role === "SUPER_ADMIN" ? {} : { branch: req.user.branch || null };
    if (req.query.student && mongoose.isValidObjectId(req.query.student)) filter.student = req.query.student;
    const certificates = await Certificate.find(filter).sort({ issuedAt: -1 }).limit(100).populate("student", "name").populate("program", "name").populate("branch", "name").lean();
    return res.json({ success: true, certificates });
  } catch (error) { console.error("Certificate list failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load certificates." }); }
}

async function listProgramCompletionCandidates(req, res) {
  try {
    const filter = { status: { $ne: "INACTIVE" }, "planEnrollments.status": { $in: ["COMPLETED", "ENDED"] } };
    if (req.user.role !== "SUPER_ADMIN" && req.user.dataScope !== "ALL") filter.branch = req.user.branch || null;
    const students = await Student.find(filter).select("name branch planEnrollments").populate("branch", "name").populate("planEnrollments.programs.program", "name").populate("planEnrollments.program", "name").sort({ name: 1 }).lean();
    const options = [];
    for (const student of students) for (const enrollment of student.planEnrollments || []) {
      if (!["COMPLETED", "ENDED"].includes(enrollment.status)) continue;
      const programs = enrollment.programs?.length ? enrollment.programs.map((item) => ({ _id: id(item.program), name: item.program?.name || "Training program" })) : enrollment.program ? [{ _id: id(enrollment.program), name: enrollment.program.name || "Training program" }] : [];
      for (const program of programs) options.push({ studentId: student._id, studentName: student.name, branch: student.branch?.name || "", enrollmentId: enrollment._id, programId: program._id, programName: program.name });
    }
    return res.json({ success: true, completions: options });
  } catch (error) { console.error("Completion certificate candidates failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load completed programs." }); }
}

async function getCertificate(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid certificate ID." });
    let ownerStudentId = null;
    if (req.user.role === "STUDENT") ownerStudentId = (await Student.findOne({ user: req.user._id }).select("_id").lean())?._id || null;
    const certificate = await Certificate.findById(req.params.id).populate("branch", "name").populate("program", "name").populate("student", "name currentBelt").populate("issuedBy", "name").lean();
    if (!certificate || (req.user.role === "STUDENT" ? id(certificate.student?._id || certificate.student) !== id(ownerStudentId) : !scoped(req.user, certificate.branch?._id || certificate.branch))) return res.status(404).json({ success: false, message: "Certificate not found." });
    return res.json({ success: true, certificate });
  } catch (error) { console.error("Certificate detail failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load certificate." }); }
}

async function getMyCertificates(req, res) {
  try {
    const student = await Student.findOne({ user: req.user._id }).select("_id").lean();
    if (!student) return res.status(404).json({ success: false, message: "Student profile not found." });
    const certificates = await Certificate.find({ student: student._id }).sort({ issuedAt: -1 }).populate("program", "name").lean();
    return res.json({ success: true, certificates });
  } catch (error) { console.error("Student certificates failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to load your certificates." }); }
}

async function issuePromotionCertificate(req, res) {
  try {
    const { promotionId } = req.params;
    if (!mongoose.isValidObjectId(promotionId)) return res.status(400).json({ success: false, message: "Invalid promotion ID." });
    const promotion = await BeltHistory.findById(promotionId).populate("student", "name branch").populate("sessionTypeId", "name").populate("approvedBy", "name").lean();
    if (!promotion || !promotion.student || !scoped(req.user, promotion.branch)) return res.status(404).json({ success: false, message: "Completed promotion not found." });
    let certificate = await Certificate.findOne({ kind: "BELT_PROMOTION", promotion: promotion._id });
    if (!certificate) certificate = await writeCertificate(req, { kind: "BELT_PROMOTION", student: promotion.student._id, branch: promotion.branch, program: promotion.sessionTypeId?._id || promotion.sessionTypeId || null, promotion: promotion._id, gradingEvent: promotion.gradingEvent || null, studentName: promotion.student.name, programName: promotion.sessionTypeId?.name || "", belt: promotion.toBelt, examinerName: promotion.approvedBy?.name || "" });
    await emailCertificate(certificate);
    return res.status(201).json({ success: true, certificate });
  } catch (error) { if (error?.code === 11000) { const certificate = await Certificate.findOne({ kind: "BELT_PROMOTION", promotion: req.params.promotionId }); return res.status(200).json({ success: true, certificate }); } console.error("Promotion certificate failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to generate promotion certificate." }); }
}

async function issueProgramCompletionCertificate(req, res) {
  try {
    const { studentId, enrollmentId, programId } = req.body || {};
    if (![studentId, enrollmentId, programId].every(mongoose.isValidObjectId)) return res.status(400).json({ success: false, message: "Student, completed enrollment, and program are required." });
    const student = await Student.findById(studentId).populate("branch", "name").lean();
    if (!student || !scoped(req.user, student.branch?._id || student.branch)) return res.status(404).json({ success: false, message: "Student not found." });
    const enrollment = (student.planEnrollments || []).find((item) => id(item._id) === id(enrollmentId));
    const programIncluded = enrollment && ((enrollment.programs || []).some((item) => id(item.program) === id(programId)) || id(enrollment.program) === id(programId));
    if (!enrollment || !["COMPLETED", "ENDED"].includes(enrollment.status) || !programIncluded) return res.status(409).json({ success: false, message: "A completed enrollment for this program is required." });
    const program = await TrainingSessionType.findById(programId).select("name").lean();
    if (!program) return res.status(404).json({ success: false, message: "Program not found." });
    let certificate = await Certificate.findOne({ kind: "PROGRAM_COMPLETION", enrollment: enrollment._id, program: program._id, student: student._id });
    if (!certificate) certificate = await writeCertificate(req, { kind: "PROGRAM_COMPLETION", student: student._id, branch: student.branch?._id || student.branch, enrollment: enrollment._id, program: program._id, studentName: student.name, programName: program.name });
    await emailCertificate(certificate);
    return res.status(201).json({ success: true, certificate });
  } catch (error) { if (error?.code === 11000) { const certificate = await Certificate.findOne({ kind: "PROGRAM_COMPLETION", enrollment: req.body.enrollmentId, program: req.body.programId, student: req.body.studentId }); return res.status(200).json({ success: true, certificate }); } console.error("Program certificate failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to generate program completion certificate." }); }
}

async function issueAchievementCertificate(req, res) {
  try {
    const { studentId, achievement } = req.body || {};
    const title = typeof achievement === "string" ? achievement.trim() : "";
    if (!mongoose.isValidObjectId(studentId) || title.length < 3 || title.length > 160) return res.status(400).json({ success: false, message: "Provide a valid student and achievement title (3–160 characters)." });
    const student = await Student.findById(studentId).populate("branch", "name").lean();
    if (!student || !scoped(req.user, student.branch?._id || student.branch)) return res.status(404).json({ success: false, message: "Student not found." });
    const certificate = await writeCertificate(req, { kind: "ACHIEVEMENT", student: student._id, branch: student.branch?._id || student.branch, achievement: title, studentName: student.name });
    await emailCertificate(certificate);
    return res.status(201).json({ success: true, certificate });
  } catch (error) { if (error?.code === 11000) { const certificate = await Certificate.findOne({ kind: "ACHIEVEMENT", student: req.body.studentId, achievement: String(req.body.achievement || "").trim() }); return res.status(200).json({ success: true, certificate }); } console.error("Achievement certificate failed", { name: error.name }); return res.status(500).json({ success: false, message: "Unable to generate achievement certificate." }); }
}

module.exports = { listCertificates, listProgramCompletionCandidates, getCertificate, getMyCertificates, issuePromotionCertificate, issueProgramCompletionCertificate, issueAchievementCertificate, writeCertificate, emailCertificate, nextCertificateNumber: nextNumber };

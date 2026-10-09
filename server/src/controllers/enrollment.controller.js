const mongoose = require("mongoose");
const Student = require("../models/Student");
const Plan = require("../models/Plan");
const Batch = require("../models/Batch");
const { reserveBatchSeat } = require("../services/batchEnrollment.service");
const Branch = require("../models/Branch");
const Invoice = require("../models/Invoice");
const { isBranchScoped } = require("../utils/access");
const {
  academyDateKey,
  academyDayStart,
  academyMonthStart,
} = require("../utils/financeDates");
const {
  safelyNotify,
  createNotification,
} = require("../services/notification.service");
const {
  daysUntil,
  getMembershipStatus,
  RENEWAL_REMINDERS,
} = require("../services/enrollmentLifecycle.service");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const { sendStudentEmail } = require("../services/studentEmail.service");
const { selectEnrollmentFeeTerm } = require("../services/enrollmentFeeTerm.service");
const { createEnrollmentInvoice } = require("../services/enrollmentInvoice.service");
const { sendInvoiceIssuedEmail } = require("../services/financeEmail.service");
const { getPublishedCurriculumByProgram } = require("../services/curriculumVersion.service");

const idIsValid = (value) => mongoose.Types.ObjectId.isValid(value);
const branchOf = (user) => user?.branch?._id || user?.branch || null;
const hasPermission = (user, permission) =>
  user?.role === "SUPER_ADMIN" || user?.permissions?.includes(permission);
const dateValue = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const addDuration = (start, plan) => {
  const end = new Date(start);
  if (plan.durationUnit === "DAYS")
    end.setDate(end.getDate() + Number(plan.duration));
  else end.setMonth(end.getMonth() + Number(plan.duration));
  return end;
};
async function trainingSnapshot(plan) {
  const curriculumVersions = await getPublishedCurriculumByProgram(plan._id, (plan.programs || []).map((item) => item.program));
  return {
    classesPerWeek: Number(plan.classesPerWeek || 0),
    startingBelt: plan.startingBelt || "White",
    programs: (plan.programs || []).map((item) => ({
      program: item.program?._id || item.program,
      weeklyLimit: item.weeklyLimit ?? null,
      curriculumVersion: curriculumVersions.get(String(item.program?._id || item.program)) || null,
      curriculum: (item.curriculum?.length
        ? item.curriculum
        : plan.curriculum || []
      ).map((lesson) => ({
        day: lesson.day,
        title: lesson.title,
        description: lesson.description || "",
        skill: lesson.skill || "",
      })),
    })),
  };
}
function scopeQuery(user, branch) {
  if (isBranchScoped(user)) return { branch: branchOf(user) || null };
  if (branch && idIsValid(branch)) return { branch };
  return {};
}
function decorate(student, enrollment, asOf = new Date()) {
  const daysRemaining = daysUntil(enrollment.endDate, asOf);
  return {
    ...(enrollment.toObject ? enrollment.toObject() : enrollment),
    lifecycleStatus: getMembershipStatus(enrollment, asOf),
    daysRemaining,
    student: {
      _id: student._id,
      name: student.name,
      phone: student.phone,
      email: student.email,
      branch: student.branch,
    },
    planName: enrollment.plan?.name || student.plan?.name || enrollment.billingSnapshot?.planName || "Training plan",
    branchName: enrollment.branch?.name || student.branch?.name || "Branch",
  };
}

async function getRenewalDashboard(req, res) {
  try {
    const students = await Student.find(scopeQuery(req.user, req.query.branch))
      .select("name phone email branch plan planEnrollments")
      .populate("branch", "name")
      .populate("plan", "name")
      .populate("planEnrollments.plan", "name")
      .populate("planEnrollments.branch", "name")
      .sort({ name: 1 })
      .lean();
    const now = new Date();
    const candidates = [];
    for (const student of students) {
      const current = [...(student.planEnrollments || [])]
        .reverse()
        .find(
          (enrollment) =>
            !enrollment.renewedTo,
        );
      if (!current) continue;
      const item = decorate(student, current, now);
      candidates.push(item);
    }
    const expiring = candidates
      .filter((item) => item.lifecycleStatus === "EXPIRING")
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
    const expired = candidates.filter(
      (item) => item.lifecycleStatus === "EXPIRED",
    );
    const active = candidates.filter((item) =>
      ["ACTIVE", "EXPIRING"].includes(item.lifecycleStatus),
    );
    const week = expiring.filter((item) => item.daysRemaining <= 7).length;
    const month = expiring.length;
    const currentMonthStart = academyMonthStart(now);
    const renewed = students
      .flatMap((student) => student.planEnrollments || [])
      .filter(
        (item) =>
          item.enrollmentSource === "RENEWAL" &&
          new Date(item.createdAt || 0) >= currentMonthStart,
      );
    const recentExpired = candidates.filter(
      (item) =>
        item.lifecycleStatus === "EXPIRED" &&
        item.endDate &&
        daysUntil(item.endDate, now) >= -30 &&
        daysUntil(item.endDate, now) < 0,
    );
    const denominator = recentExpired.length + renewed.length;
    const renewalRate = denominator
      ? Math.round((renewed.length / denominator) * 100)
      : 0;
    const renewedIds = renewed.map((item) => item._id);
    const invoices = renewedIds.length
      ? await Invoice.find({
          enrollment: { $in: renewedIds },
          ...(isBranchScoped(req.user)
            ? { branch: branchOf(req.user) || null }
            : {}),
          status: { $ne: "CANCELLED" },
        })
          .select("paidAmount")
          .lean()
      : [];
    const renewalRevenue =
      Math.round(
        invoices.reduce(
          (sum, invoice) => sum + Number(invoice.paidAmount || 0),
          0,
        ) * 100,
      ) / 100;
    const approaching = expiring.filter((item) =>
      RENEWAL_REMINDERS.includes(item.daysRemaining),
    );
    res.json({
      success: true,
      metrics: {
        active: active.length,
        expiringThisWeek: week,
        expiringThisMonth: month,
        expired: expired.length,
        renewed: renewed.length,
        renewalRate,
        renewalRevenue:
          hasPermission(req.user, "finance.view") ||
          hasPermission(req.user, "finance.manage")
            ? renewalRevenue
            : null,
      },
      memberships: candidates.map((item) => ({
        ...item,
        endDate: item.endDate || null,
      })),
      reminderDays: RENEWAL_REMINDERS,
      today: academyDateKey(now),
      reminderCount: approaching.length,
    });
  } catch (error) {
    console.error("Enrollment dashboard read failed", { name: error.name });
    res
      .status(500)
      .json({ success: false, message: "Failed to load membership dashboard" });
  }
}

async function getStudentEnrollments(req, res) {
  if (!idIsValid(req.params.studentId))
    return res
      .status(400)
      .json({ success: false, message: "Invalid student ID" });
  try {
    const student = await Student.findById(req.params.studentId)
      .populate("branch", "name")
      .populate("plan", "name")
      .populate("planEnrollments.plan", "name")
      .populate("planEnrollments.branch", "name")
      .populate("planEnrollments.program", "name");
    if (
      !student ||
      (isBranchScoped(req.user) &&
        String(student.branch?._id || student.branch) !==
          String(branchOf(req.user) || ""))
    )
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    res.json({
      success: true,
      enrollments: [...(student.planEnrollments || [])]
        .reverse()
        .map((item) => decorate(student, item)),
    });
  } catch (error) {
    console.error("Enrollment history read failed", { name: error.name });
    res
      .status(500)
      .json({ success: false, message: "Failed to load enrollment history" });
  }
}

async function createEnrollment(req, res, isRenewal = false) {
  const {
    plan: planId,
    branch: branchInput,
    batch: batchInput,
    feeTerm: feeTermId,
    startDate: dateInput,
    enrollmentSource,
    createInvoice: shouldInvoice,
  } = req.body || {};
  if (
    !idIsValid(req.params.studentId) ||
    !idIsValid(planId) ||
    !idIsValid(branchInput)
  )
    return res
      .status(400)
      .json({
        success: false,
        message: "Valid student, plan, and branch IDs are required",
      });
  if (shouldInvoice && !hasPermission(req.user, "finance.manage"))
    return res
      .status(403)
      .json({
        success: false,
        message: "Finance permission is required to create a renewal invoice",
      });
  const startDate = dateInput
    ? dateValue(dateInput)
    : academyDayStart(new Date());
  if (!startDate)
    return res
      .status(400)
      .json({
        success: false,
        message: "A valid enrollment start date is required",
      });
  if (academyDateKey(startDate) < academyDateKey(new Date()))
    return res
      .status(400)
      .json({
        success: false,
        message: "Enrollment start date cannot be in the past",
      });
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const student = await Student.findById(req.params.studentId).session(
        session,
      );
      if (
        !student ||
        (isBranchScoped(req.user) &&
          String(student.branch) !== String(branchOf(req.user) || ""))
      ) {
        const error = new Error("Student not found");
        error.status = 404;
        throw error;
      }
      const branchId = branchInput || student.branch;
      if (
        isBranchScoped(req.user) &&
        String(branchId) !== String(branchOf(req.user) || "")
      ) {
        const error = new Error(
          "You can only enroll students in your assigned branch",
        );
        error.status = 403;
        throw error;
      }
      if (!idIsValid(feeTermId)) {
        const error = new Error("Select a valid Fee Term for this enrollment.");
        error.status = 400;
        throw error;
      }
      const branch = await Branch.findById(branchId).session(session);
      if (!branch || branch.isActive === false) {
        const error = new Error("Selected branch is unavailable");
        error.status = 400;
        throw error;
      }
      const prior = [...(student.planEnrollments || [])]
        .reverse()
        .find(
          (item) =>
            !item.renewedTo &&
            ["ACTIVE", "PAUSED", "EXPIRED"].includes(item.status),
        );
      const priorSnapshot = prior ? { status: prior.status, planId: prior.plan, endDate: prior.endDate } : null;
      if (isRenewal && !prior) {
        const error = new Error("No existing membership is available to renew");
        error.status = 409;
        throw error;
      }
      if (isRenewal && !["EXPIRING", "EXPIRED"].includes(getMembershipStatus(prior))) {
        const error = new Error("Membership renewal opens when 30 days or fewer remain");
        error.status = 409;
        throw error;
      }
      if (isRenewal && prior.status === "PAUSED") {
        const error = new Error(
          "Paused memberships must be resumed or completed before renewal",
        );
        error.status = 409;
        throw error;
      }
      if (!isRenewal && prior && getMembershipStatus(prior) !== "EXPIRED") {
        const error = new Error(
          "An active membership already exists; use renewal to extend it",
        );
        error.status = 409;
        throw error;
      }
      const selectedPlanId = planId || prior?.plan || student.plan;
      const plan = await Plan.findById(selectedPlanId).session(session);
      if (!plan || plan.isActive === false) {
        const error = new Error("Selected training plan is unavailable");
        error.status = 400;
        throw error;
      }
      const activeBatches = await Batch.find({ plan: plan._id, branch: branch._id, status: "ACTIVE" }).select("_id").session(session);
      let selectedBatchId = batchInput || (prior && String(prior.plan) === String(plan._id) && String(prior.branch) === String(branch._id) ? prior.batch : null);
      if (!selectedBatchId && activeBatches.length === 1) selectedBatchId = activeBatches[0]._id;
      if (activeBatches.length && !selectedBatchId) {
        const error = new Error("Select a Batch for this Plan and Branch."); error.status = 400; throw error;
      }
      if (selectedBatchId && !activeBatches.some((item) => String(item._id) === String(selectedBatchId))) {
        const error = new Error("Choose an active Batch under the selected Plan and Branch."); error.status = 400; throw error;
      }
      if (selectedBatchId) await reserveBatchSeat({ batchId: selectedBatchId, planId: plan._id, branchId: branch._id, studentId: student._id, startDate, session });
      const selectedTerms = await selectEnrollmentFeeTerm({
        feeTermId,
        plan,
        branch,
        startDate,
        session,
      });
      const newEnrollmentId = new mongoose.Types.ObjectId();
      if (prior) {
        const currentEnd = prior.endDate ? new Date(prior.endDate) : null;
        if (!currentEnd || currentEnd > startDate) prior.endDate = startDate;
        prior.renewedTo = newEnrollmentId;
        if (prior.status === "ACTIVE") {
          prior.status = "COMPLETED";
          prior.statusHistory.push({ from: "ACTIVE", to: "COMPLETED", changedBy: req.user._id, note: "Superseded by renewal" });
        }
      }
      const rawSource =
        String(enrollmentSource || (isRenewal ? "RENEWAL" : "STAFF"))
          .trim()
          .slice(0, 60) || (isRenewal ? "RENEWAL" : "STAFF");
      const enrollment = {
        _id: newEnrollmentId,
        plan: plan._id,
        feeTerm: selectedTerms.term._id,
        branch: branch._id,
        batch: selectedBatchId || null,
        program:
          plan.programs?.[0]?.program?._id ||
          plan.programs?.[0]?.program ||
          null,
        startDate,
        endDate: addDuration(startDate, plan),
        status: "ACTIVE",
        statusHistory: [{ from: null, to: "ACTIVE", changedBy: req.user._id, note: isRenewal ? "Membership renewal" : "New enrollment" }],
        enrollmentSource: rawSource,
        createdBy: req.user._id,
        ...await trainingSnapshot(plan),
        billingSnapshot: selectedTerms.billingSnapshot,
      };
      student.planEnrollments.push(enrollment);
      student.plan = plan._id;
      student.branch = branch._id;
      student.status = "ACTIVE";
      await student.save({ session });
      await auditService.record({ req, session, action: AUDIT_ACTIONS.ENROLLMENT_CHANGED, entityType: "ENROLLMENT", entityId: newEnrollmentId, branchId: branch._id, before: priorSnapshot, after: { status: "ACTIVE", planId: plan._id, branchId: branch._id, startDate, endDate: addDuration(startDate, plan), renewal: isRenewal } });
      let invoice = null;
      if (shouldInvoice) {
        const enrollmentRecord = student.planEnrollments.id(newEnrollmentId);
        invoice = await createEnrollmentInvoice({
          req,
          student,
          enrollment: enrollmentRecord,
          plan,
          terms: selectedTerms.billingSnapshot,
          branch,
          dueDate: `${academyDateKey(startDate)}T12:00:00.000Z`,
          session,
          notes: isRenewal ? "Membership renewal" : "New enrollment",
        });
      }
      result = {
        studentId: student._id,
        enrollmentId: newEnrollmentId,
        enrollment: student.planEnrollments.id(newEnrollmentId).toObject(),
        branchId: branch._id,
        invoice,
      };
    });
  } catch (error) {
    await session.endSession();
    if (error.status)
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    console.error("Enrollment write failed", {
      name: error.name,
      code: error.code,
    });
    return res
      .status(500)
      .json({ success: false, message: "Failed to save enrollment" });
  }
  await session.endSession();

  const invoice = result.invoice || null;
  if (invoice) await sendInvoiceIssuedEmail(invoice).catch(() => {});

  if (isRenewal) await safelyNotify({
    type: "MEMBERSHIP_RENEWAL_COMPLETED",
    title: "Membership renewed",
    message: `A membership for ${req.body?.studentName || "a student"} is now active.`,
    severity: "SUCCESS",
    branch: result.branchId,
    student: result.studentId,
    entityType: "MEMBERSHIP",
    entityId: result.enrollmentId,
    actionUrl: "/memberships",
    eventKey: `membership:${result.enrollmentId}:renewed`,
  });
  if (isRenewal) await sendStudentEmail({ studentId: result.studentId, eventKey: `membership:${result.enrollmentId}:renewed`, category: "MEMBERSHIP_RENEWED", subject: "Your membership has been renewed", text: ["Your membership renewal is complete.", "", "Sign in to your student dashboard to review your membership details."].join("\n") }).catch(() => {});
  const responseStudent = await Student.findById(result.studentId)
    .populate("branch", "name")
    .populate("plan", "name")
    .populate("planEnrollments.plan", "name")
    .populate("planEnrollments.branch", "name");
  const saved = responseStudent.planEnrollments.id(result.enrollmentId);
  return res
    .status(201)
    .json({
      success: true,
      enrollment: decorate(responseStudent, saved),
      invoice,
      invoiceError: null,
    });
}

const addEnrollment = (req, res) => createEnrollment(req, res, false);
const renewEnrollment = (req, res) => createEnrollment(req, res, true);

async function updateEnrollmentStatus(req, res) {
  const { status } = req.body || {};
  if (!idIsValid(req.params.studentId) || !idIsValid(req.params.enrollmentId))
    return res
      .status(400)
      .json({ success: false, message: "Invalid student or enrollment ID" });
  if (
    !["ACTIVE", "PAUSED", "COMPLETED", "EXPIRED", "CANCELLED"].includes(status)
  )
    return res
      .status(400)
      .json({ success: false, message: "Invalid enrollment status" });
  try {
    const student = await Student.findById(req.params.studentId);
    if (
      !student ||
      (isBranchScoped(req.user) &&
        String(student.branch) !== String(branchOf(req.user) || ""))
    )
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    const enrollment = student.planEnrollments.id(req.params.enrollmentId);
    if (!enrollment)
      return res
        .status(404)
        .json({ success: false, message: "Enrollment not found" });
    const transitions = { ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"], PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED"], EXPIRED: ["CANCELLED"] };
    if (status !== enrollment.status && !(transitions[enrollment.status] || []).includes(status))
      return res.status(409).json({ success: false, message: `Cannot change enrollment from ${enrollment.status} to ${status}` });
    if (status === "ACTIVE") {
      const conflict = student.planEnrollments.some(
        (item) =>
          String(item._id) !== String(enrollment._id) &&
          item.status === "ACTIVE" &&
          (!item.endDate ||
            new Date(item.endDate) > new Date(enrollment.startDate)),
      );
      if (conflict)
        return res
          .status(409)
          .json({
            success: false,
            message: "Another active enrollment overlaps this period",
          });
    }
    const previousStatus = enrollment.status;
    enrollment.status = status;
    if (
      ["COMPLETED", "EXPIRED", "CANCELLED"].includes(status) &&
      (!enrollment.endDate || new Date(enrollment.endDate) > new Date())
    )
      enrollment.endDate = academyDayStart(new Date());
    if (status !== previousStatus) enrollment.statusHistory.push({ from: previousStatus, to: status, changedBy: req.user._id });
    await student.save();
    if (previousStatus !== status) await auditService.record({ req, action: AUDIT_ACTIONS.ENROLLMENT_CHANGED, entityType: "ENROLLMENT", entityId: enrollment._id, branchId: student.branch, before: { status: previousStatus, endDate: enrollment.endDate }, after: { status, endDate: enrollment.endDate } });
    res.json({ success: true, enrollment: decorate(student, enrollment) });
  } catch (error) {
    console.error("Enrollment status update failed", { name: error.name });
    res
      .status(500)
      .json({ success: false, message: "Failed to update enrollment" });
  }
}

module.exports = {
  getRenewalDashboard,
  getStudentEnrollments,
  addEnrollment,
  renewEnrollment,
  updateEnrollmentStatus,
};

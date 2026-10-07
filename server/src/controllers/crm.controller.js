const mongoose = require("mongoose");
const crypto = require("node:crypto");
const Inquiry = require("../models/Inquiry");
const Trial = require("../models/Trial");
const Student = require("../models/Student");
const Branch = require("../models/Branch");
const Plan = require("../models/Plan");
const Invoice = require("../models/Invoice");
const FinanceSequence = require("../models/FinanceSequence");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const AcademySettings = require("../models/AcademySettings");
const TrainingSessionType = require("../models/TrainingSessionType");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { isBranchScoped } = require("../utils/access");
const { safelyNotify } = require("../services/notification.service");
const { academyDateKey } = require("../utils/financeDates");
const { normalizePhone } = require("../utils/phone");

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "TRIAL_SCHEDULED",
  "TRIAL_COMPLETED",
  "INTERESTED",
  "NOT_INTERESTED",
  "CONVERTED",
  "LOST",
];
const TRIAL_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "MISSED",
  "CANCELLED",
  "CONVERTED",
];
const TRANSITIONS = {
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["TRIAL_SCHEDULED", "INTERESTED", "NOT_INTERESTED", "LOST"],
  TRIAL_SCHEDULED: ["CONTACTED", "TRIAL_COMPLETED", "LOST"],
  TRIAL_COMPLETED: ["INTERESTED", "NOT_INTERESTED", "LOST"],
  INTERESTED: ["CONTACTED", "LOST"],
  NOT_INTERESTED: ["CONTACTED", "LOST"],
  LOST: ["CONTACTED"],
  CONVERTED: [],
};
const idIsValid = mongoose.isValidObjectId;
const allScope = (user) =>
  user?.role === "SUPER_ADMIN" || user?.dataScope === "ALL";
const branchIdFor = (user) => String(user?.branch?._id || user?.branch || "");
const inScope = (user, branch) =>
  allScope(user) || String(branch?._id || branch || "") === branchIdFor(user);
const scopeFilter = (user) =>
  isBranchScoped(user) ? { branch: branchIdFor(user) || null } : {};
const dateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const startOfDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
const errorResponse = (res, error) =>
  res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : "CRM operation failed.",
  });

async function getPipeline(req, res) {
  try {
    const leads = await Inquiry.find(scopeFilter(req.user))
      .sort({ createdAt: -1 })
      .populate("branch", "name")
      .populate("assignedTo", "name email")
      .populate("convertedStudent", "name")
      .lean();
    const leadIds = leads.map((item) => item._id);
    const trials = await Trial.find({
      lead: { $in: leadIds },
      ...scopeFilter(req.user),
    })
      .sort({ trialDate: 1, startTime: 1 })
      .populate("coach", "name")
      .populate("program", "name")
      .lean();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const admissions = leads.filter(
      (lead) => lead.status === "CONVERTED" && (lead.convertedAt || lead.updatedAt) >= monthStart,
    ).length;
    const convertedCount = leads.filter(
      (lead) => lead.status === "CONVERTED",
    ).length;
    const closedCount = leads.filter(
      (lead) => lead.status === "LOST" || lead.status === "NOT_INTERESTED",
    ).length;
    const trialsThisMonth = trials.filter(
      (trial) => trial.trialDate >= monthStart && trial.status !== "CANCELLED",
    );
    const completedTrials = trials.filter(
      (trial) => trial.status === "COMPLETED" || trial.status === "CONVERTED",
    ).length;
    const convertedTrials = trials.filter(
      (trial) => trial.status === "CONVERTED",
    ).length;
    const pendingFollowUps = leads.filter(
      (lead) =>
        lead.nextFollowUpAt &&
        lead.status !== "CONVERTED" &&
        lead.status !== "LOST",
    );
    const overdueFollowUps = pendingFollowUps.filter(
      (lead) => new Date(lead.nextFollowUpAt) < now,
    );
    const monthly = new Map();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      monthly.set(`${date.getFullYear()}-${date.getMonth() + 1}`, {
        month: date.toLocaleString("en", { month: "short" }),
        admissions: 0,
      });
    }
    for (const lead of leads) {
      const convertedAt = lead.convertedAt || lead.updatedAt;
      if (lead.status === "CONVERTED" && convertedAt >= yearStart) {
        const row = monthly.get(
          `${convertedAt.getFullYear()}-${convertedAt.getMonth() + 1}`,
        );
        if (row) row.admissions += 1;
      }
    }
    const branchIds = [
      ...new Set(
        leads
          .map((lead) => String(lead.branch?._id || lead.branch || ""))
          .filter(Boolean),
      ),
    ];
    const branchRows = await Promise.all(
      branchIds.map(async (id) => {
        const branchLeads = leads.filter(
          (lead) => String(lead.branch?._id || lead.branch || "") === id,
        );
        const conversions = branchLeads.filter(
          (lead) => lead.status === "CONVERTED",
        ).length;
        return {
          branch: branchLeads[0]?.branch?.name || "Branch",
          leads: branchLeads.length,
          conversions,
          conversionRate: branchLeads.length
            ? Math.round((conversions * 1000) / branchLeads.length) / 10
            : 0,
        };
      }),
    );
    const funnel = [
      "NEW",
      "CONTACTED",
      "TRIAL_SCHEDULED",
      "TRIAL_COMPLETED",
      "INTERESTED",
      "CONVERTED",
    ].map((status) => ({
      status,
      count: leads.filter(
        (lead) =>
          lead.status === status ||
          (status === "CONVERTED" && lead.status === "ENROLLED"),
      ).length,
    }));
    return res.json({
      success: true,
      leads,
      trials,
      summary: {
        newLeads: leads.filter((lead) => lead.status === "NEW").length,
        trials: trialsThisMonth.length,
        trialConversionRate: completedTrials
          ? Math.round((convertedTrials * 1000) / completedTrials) / 10
          : 0,
        admissions,
        conversionRate: leads.length
          ? Math.round((convertedCount * 1000) / leads.length) / 10
          : 0,
        lostLeads: closedCount,
        pendingFollowUps: pendingFollowUps.length,
        overdueFollowUps: overdueFollowUps.length,
        funnel,
        monthlyAdmissions: [...monthly.values()],
        branchConversions: branchRows,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function createLead(req, res) {
  try {
    const fullName = String(req.body?.name || req.body?.fullName || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const normalizedPhone = normalizePhone(phone);
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const branch = req.body?.branch || branchIdFor(req.user);
    if (
      fullName.length < 2 ||
      fullName.length > 120 ||
      !normalizedPhone ||
      !branch ||
      !idIsValid(branch)
    )
      return res.status(400).json({
        success: false,
        message: "Name, valid phone number, and branch are required.",
      });
    if (req.body?.age !== undefined && (!Number.isInteger(Number(req.body.age)) || Number(req.body.age) < 3 || Number(req.body.age) > 100))
      return res.status(400).json({ success: false, message: "Lead age must be a whole number between 3 and 100." });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid email address." });
    if (!inScope(req.user, branch))
      return res.status(403).json({
        success: false,
        message: "You cannot create a lead for another branch.",
      });
    const branchDoc = await Branch.findOne({
      _id: branch,
      isActive: { $ne: false },
    });
    if (!branchDoc)
      return res
        .status(400)
        .json({ success: false, message: "Selected branch is unavailable." });
    const lead = await Inquiry.create({
      fullName,
      phone: normalizedPhone,
      email,
      source: String(req.body?.source || "STAFF").slice(0, 80),
      branch: branchDoc._id,
      preferredBranch: branchDoc.name,
      assignedTo: req.user._id,
      age: req.body?.age,
      status: "NEW",
      statusHistory: [
        { to: "NEW", changedBy: req.user._id, note: "Lead created" },
      ],
    });
    return res.status(201).json({ success: true, lead });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateLead(req, res) {
  try {
    if (!idIsValid(req.params.id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID." });
    const lead = await Inquiry.findOne({
      _id: req.params.id,
      ...scopeFilter(req.user),
    });
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Lead not found." });
    const {
      status,
      assignedTo,
      source,
      interestedProgram,
      notes,
      nextFollowUpAt,
    } = req.body || {};
    if (status !== undefined) {
      const current = ["ENROLLED"].includes(lead.status)
        ? "CONVERTED"
        : ["CLOSED"].includes(lead.status)
          ? "LOST"
          : lead.status;
      if (["TRIAL_SCHEDULED", "TRIAL_COMPLETED"].includes(status))
        return res.status(400).json({ success: false, message: "Trial stages are updated by scheduling or recording a trial." });
      if (
        !LEAD_STATUSES.includes(status) ||
        (status !== current && !TRANSITIONS[current]?.includes(status))
      )
        return res.status(400).json({
          success: false,
          message: `Invalid lead status change from ${current}.`,
        });
      if (status === "CONVERTED")
        return res.status(400).json({
          success: false,
          message: "Use the conversion action to admit a lead.",
        });
      if (status !== lead.status) {
        lead.statusHistory.push({
          from: lead.status,
          to: status,
          changedBy: req.user._id,
        });
        lead.status = status;
      }
    }
    if (assignedTo !== undefined) {
      if (assignedTo && !idIsValid(assignedTo))
        return res
          .status(400)
          .json({ success: false, message: "Invalid staff assignment." });
      if (assignedTo) {
        const staff = await User.findOne({
          _id: assignedTo,
          isActive: { $ne: false },
          role: { $ne: "STUDENT" },
        }).select("_id branch role");
        if (!staff || (staff.branch && (!inScope(req.user, staff.branch) || (lead.branch && String(staff.branch) !== String(lead.branch) && staff.role !== "SUPER_ADMIN"))))
          return res.status(400).json({
            success: false,
            message: "Selected staff member is unavailable.",
          });
      }
      lead.assignedTo = assignedTo || null;
    }
    if (source !== undefined) lead.source = String(source).trim().slice(0, 80);
    if (interestedProgram !== undefined) {
      if (interestedProgram && !idIsValid(interestedProgram))
        return res
          .status(400)
          .json({ success: false, message: "Invalid program." });
      const program = interestedProgram ? await TrainingSessionType.findOne({ _id: interestedProgram, isActive: true }).select("name") : null;
      if (interestedProgram && !program) return res.status(400).json({ success: false, message: "Selected program is unavailable." });
      lead.program = program?._id || null;
      lead.programName = program?.name || "";
      lead.programs = program ? [{ program: program._id, name: program.name }] : [];
    }
    if (notes !== undefined) {
      const note = String(notes).trim();
      if (note.length > 2000)
        return res.status(400).json({
          success: false,
          message: "Lead notes are limited to 2000 characters.",
        });
      lead.notes = note;
    }
    if (nextFollowUpAt !== undefined) {
      const date = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
      if (date && Number.isNaN(date.getTime()))
        return res
          .status(400)
          .json({ success: false, message: "Invalid follow-up date." });
      lead.nextFollowUpAt = date;
    }
    await lead.save();
    return res.json({ success: true, lead });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function addFollowUp(req, res) {
  try {
    if (!idIsValid(req.params.id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID." });
    const note = String(req.body?.note || "").trim();
    const dueAt = req.body?.dueAt ? new Date(req.body.dueAt) : null;
    const assignedTo = req.body?.assignedTo || req.user._id;
    if (
      !note ||
      note.length > 2000 ||
      (dueAt && Number.isNaN(dueAt.getTime())) ||
      !idIsValid(assignedTo)
    )
      return res.status(400).json({
        success: false,
        message:
          "A follow-up note, valid due date, and staff assignee are required.",
      });
    const lead = await Inquiry.findOne({
      _id: req.params.id,
      ...scopeFilter(req.user),
    });
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Lead not found." });
    if (["CONVERTED", "ENROLLED", "LOST", "CLOSED"].includes(lead.status))
      return res.status(409).json({ success: false, message: "This lead is closed and cannot receive follow-ups." });
    const assignee = await User.findOne({ _id: assignedTo, isActive: { $ne: false }, role: { $ne: "STUDENT" } }).select("_id branch role");
    if (!assignee || (assignee.branch && (!inScope(req.user, assignee.branch) || (lead.branch && String(assignee.branch) !== String(lead.branch) && assignee.role !== "SUPER_ADMIN"))))
      return res.status(400).json({ success: false, message: "Selected follow-up employee is unavailable." });
    lead.followUps.push({ note, dueAt, assignedTo, createdBy: req.user._id });
    lead.nextFollowUpAt = dueAt;
    lead.assignedTo = assignedTo;
    await lead.save();
    return res.status(201).json({ success: true, lead });
  } catch (error) {
    return errorResponse(res, error);
  }
}

const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
async function createTrial(req, res) {
  try {
    if (!idIsValid(req.params.id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID." });
    const lead = await Inquiry.findOne({
      _id: req.params.id,
      ...scopeFilter(req.user),
    });
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Lead not found." });
    const {
      trialDate,
      startTime,
      endTime,
      branch: requestedBranch,
      program,
      coach,
      notes = "",
    } = req.body || {};
    const branchId = requestedBranch || lead.branch || req.user.branch;
    const dateParts = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trialDate || "");
    const date = dateParts ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])) : new Date(NaN);
    const canonicalDate = Boolean(dateParts && date.getFullYear() === Number(dateParts[1]) && date.getMonth() === Number(dateParts[2]) - 1 && date.getDate() === Number(dateParts[3]));
    if (
      !trialDate ||
      !canonicalDate ||
      date < startOfDay() ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || "")
    )
      return res.status(400).json({
        success: false,
        message: "Choose a valid future trial date and start time.",
      });
    const end =
      endTime ||
      `${String(((minutes(startTime) + 60) / 60) | 0).padStart(2, "0")}:${String((minutes(startTime) + 60) % 60).padStart(2, "0")}`;
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) ||
      minutes(end) <= minutes(startTime)
    )
      return res.status(400).json({
        success: false,
        message: "Trial end time must follow the start time.",
      });
    if (!idIsValid(branchId) || !inScope(req.user, branchId))
      return res.status(403).json({
        success: false,
        message: "You cannot schedule a trial at this branch.",
      });
    const branch = await Branch.findOne({
      _id: branchId,
      isActive: { $ne: false },
    });
    if (!branch)
      return res
        .status(400)
        .json({ success: false, message: "Selected branch is unavailable." });
    if (
      program &&
      (!idIsValid(program) ||
        !(await TrainingSessionType.exists({ _id: program, isActive: true })))
    )
      return res
        .status(400)
        .json({ success: false, message: "Selected program is unavailable." });
    if (coach) {
      const coachUser = await User.findOne({
        _id: coach,
        role: "COACH",
        isActive: { $ne: false },
        branch: branchId,
      }).select("_id");
      if (!coachUser)
        return res.status(400).json({
          success: false,
          message: "Selected coach is not active at this branch.",
        });
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const conflicts = await Trial.find({
        coach,
        trialDate: { $gte: dayStart, $lt: dayEnd },
        status: "SCHEDULED",
      })
        .select("startTime endTime")
        .lean();
      if (
        conflicts.some(
          (item) =>
            minutes(item.startTime) < minutes(end) &&
            minutes(item.endTime || "23:59") > minutes(startTime),
        )
      )
        return res.status(409).json({
          success: false,
          message: "This coach already has a trial during that time.",
        });
    }
    const trial = await Trial.create({
      lead: lead._id,
      branch: branchId,
      program: program || lead.program || null,
      coach: coach || null,
      trialDate: date,
      startTime,
      endTime: end,
      notes: String(notes).slice(0, 2000),
      createdBy: req.user._id,
      statusHistory: [{ from: null, to: "SCHEDULED", changedBy: req.user._id, note: "Trial scheduled" }],
    });
    if (lead.status !== "TRIAL_SCHEDULED") {
      if (!TRANSITIONS[lead.status]?.includes("TRIAL_SCHEDULED")) {
        lead.statusHistory.push({
          from: lead.status,
          to: "CONTACTED",
          changedBy: req.user._id,
          note: "Contacted while scheduling trial",
        });
        lead.status = "CONTACTED";
      }
      lead.statusHistory.push({
        from: lead.status,
        to: "TRIAL_SCHEDULED",
        changedBy: req.user._id,
        note: "Trial scheduled",
      });
      lead.status = "TRIAL_SCHEDULED";
      await lead.save();
    }
    return res.status(201).json({ success: true, trial });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({
        success: false,
        message: "A trial is already booked for this lead at that time.",
      });
    return errorResponse(res, error);
  }
}

async function updateTrial(req, res) {
  try {
    if (!idIsValid(req.params.trialId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid trial ID." });
    const trial = await Trial.findOne({
      _id: req.params.trialId,
      ...scopeFilter(req.user),
    });
    if (!trial)
      return res
        .status(404)
        .json({ success: false, message: "Trial not found." });
    const { status, attendance, notes } = req.body || {};
    const validNext = {
      SCHEDULED: ["COMPLETED", "MISSED", "CANCELLED"],
      COMPLETED: [],
      MISSED: ["SCHEDULED", "CANCELLED"],
      CANCELLED: ["SCHEDULED"],
      CONVERTED: [],
    };
    if (
      status !== undefined &&
      (!TRIAL_STATUSES.includes(status) ||
        (status !== trial.status && !validNext[trial.status]?.includes(status)))
    )
      return res.status(400).json({
        success: false,
        message: `Invalid trial status change from ${trial.status}.`,
      });
    if (
      attendance !== undefined &&
      ![null, "PRESENT", "ABSENT"].includes(attendance)
    )
      return res
        .status(400)
        .json({ success: false, message: "Invalid trial attendance." });
    const previousStatus = trial.status;
    if (status !== undefined) trial.status = status;
    if (status !== undefined && status !== previousStatus)
      trial.statusHistory.push({ from: previousStatus, to: status, changedBy: req.user._id, note: String(notes || "").slice(0, 500) });
    if (attendance !== undefined) trial.attendance = attendance;
    if (status === "COMPLETED") trial.attendance = attendance || "PRESENT";
    if (status === "MISSED") trial.attendance = "ABSENT";
    if (notes !== undefined) trial.notes = String(notes).slice(0, 2000);
    await trial.save();
    if (trial.status === "COMPLETED") {
      const lead = await Inquiry.findById(trial.lead);
      if (lead && lead.status === "TRIAL_SCHEDULED") {
        lead.statusHistory.push({
          from: lead.status,
          to: "TRIAL_COMPLETED",
          changedBy: req.user._id,
          note: "Trial completed",
        });
        lead.status = "TRIAL_COMPLETED";
        await lead.save();
      }
    }
    if (["MISSED", "CANCELLED"].includes(trial.status)) {
      const otherScheduled = await Trial.exists({ lead: trial.lead, _id: { $ne: trial._id }, status: "SCHEDULED" });
      if (!otherScheduled) {
        const lead = await Inquiry.findById(trial.lead);
        if (lead && lead.status === "TRIAL_SCHEDULED") {
          lead.statusHistory.push({ from: lead.status, to: "CONTACTED", changedBy: req.user._id, note: trial.status === "MISSED" ? "Trial missed; follow-up needed" : "Trial cancelled; follow-up needed" });
          lead.status = "CONTACTED";
          await lead.save();
        }
      }
    }
    return res.json({ success: true, trial });
  } catch (error) {
    return errorResponse(res, error);
  }
}

function enrollmentSnapshot(plan, branchId) {
  const override = (plan.branchFeeOverrides || []).find(
    (row) => String(row.branch) === String(branchId),
  );
  const terms = override || plan;
  return {
    classesPerWeek: Number(plan.classesPerWeek || 0),
    startingBelt: plan.startingBelt || "White",
    billingSnapshot: {
      feeName: terms.feeName || plan.name,
      active: terms.active !== false && plan.feeActive !== false,
      amount: Number(terms.amount ?? plan.price ?? 0),
      billingFrequency:
        terms.billingFrequency || plan.billingFrequency || "ONE_TIME",
      registrationFee: Number(
        terms.registrationFee ?? plan.registrationFee ?? 0,
      ),
      taxRate: Number(terms.taxRate ?? plan.taxRate ?? 0),
      discountRules: (terms.discountRules || plan.discountRules || []).map(
        (rule) => ({
          _id: rule._id,
          name: rule.name,
          type: rule.type,
          amount: Number(rule.amount || 0),
          active: rule.active !== false,
          effectiveFrom: rule.effectiveFrom || null,
          effectiveUntil: rule.effectiveUntil || null,
        }),
      ),
      effectiveFrom: terms.effectiveFrom || plan.effectiveFrom || null,
      effectiveUntil: terms.effectiveUntil || plan.effectiveUntil || null,
    },
    programs: (plan.programs || []).map((item) => ({
      program: item.program?._id || item.program,
      weeklyLimit: item.weeklyLimit ?? null,
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
function enrollmentEndDate(plan, start) {
  const date = new Date(start);
  if (plan.durationUnit === "DAYS")
    date.setDate(date.getDate() + Number(plan.duration));
  else date.setMonth(date.getMonth() + Number(plan.duration));
  return date;
}

async function createAdmissionInvoice({
  req,
  lead,
  student,
  enrollment,
  plan,
  actor,
}) {
  if (
    !actor.permissions?.includes("finance.manage") &&
    actor.role !== "SUPER_ADMIN"
  )
    throw Object.assign(
      new Error(
        "Finance management permission is required to create an admission invoice.",
      ),
      { status: 403 },
    );
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const terms = enrollment.billingSnapshot || {};
      const frequency = terms.billingFrequency || "ONE_TIME";
      const cycleKey = frequency === "ONE_TIME" ? "ONE_TIME" : `${frequency}:${academyDateKey(enrollment.startDate)}`;
      const existing = await Invoice.findOne({
        enrollment: enrollment._id,
        cycleKey,
        status: { $ne: "CANCELLED" },
      }).session(session);
      if (existing) {
        created = existing;
        return;
      }
      if (terms.active === false || plan.feeActive === false)
        throw Object.assign(
          new Error("This plan has no active fee structure."),
          { status: 400 },
        );
      const base = Number(terms.amount || 0);
      const registration = Number(terms.registrationFee || 0);
      const taxRate = Number(terms.taxRate || 0);
      if (base <= 0 && registration <= 0)
        throw Object.assign(new Error("This plan has no billable fee."), {
          status: 400,
        });
      const priorInvoice = await Invoice.exists({ enrollment: enrollment._id, status: { $ne: "CANCELLED" } }).session(session);
      const items = [];
      if (base > 0)
        items.push({
          description: terms.feeName || plan.name,
          quantity: 1,
          unitAmount: base,
          amount: base,
          kind: "TUITION",
        });
      if (!priorInvoice && registration > 0)
        items.push({
          description: "Registration fee",
          quantity: 1,
          unitAmount: registration,
          amount: registration,
          kind: "REGISTRATION",
        });
      if (!items.length)
        throw Object.assign(new Error("This enrollment already has its applicable admission fees."), { status: 409 });
      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const tax = Math.round(subtotal * taxRate) / 100;
      const sequence = await FinanceSequence.findOneAndUpdate(
        { key: `INV:${new Date().getFullYear()}` },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after", session },
      );
      const settings = await AcademySettings.findOne().session(session).lean();
      [created] = await Invoice.create(
        [
          {
            invoiceNumber: `INV-${new Date().getFullYear()}-${String(sequence.value).padStart(6, "0")}`,
            student: student._id,
            enrollment: enrollment._id,
            plan: plan._id,
            branch: student.branch,
            items,
            subtotal,
            discount: 0,
            taxRate,
            tax,
            total: subtotal + tax,
            balance: subtotal + tax,
            currency: settings?.currency || "INR",
            dueDate: new Date(),
            periodStart: enrollment.startDate,
            periodEnd: enrollment.endDate,
            cycleKey,
            status: "ISSUED",
            notes: "Admission invoice",
            createdBy: actor._id,
            issuedAt: new Date(),
          },
        ],
        { session },
      );
      await auditService.record({ req, session, action: AUDIT_ACTIONS.INVOICE_CREATED, entityType: "INVOICE", entityId: created._id, branchId: student.branch, after: { invoiceNumber: created.invoiceNumber, total: created.total, status: created.status }, metadata: { source: "LEAD_CONVERSION" }, legacy: { student: student._id, invoice: created._id } });
    });
    return created;
  } finally {
    await session.endSession();
  }
}

async function convertLead(req, res) {
  let conversionLock = null;
  try {
    if (!idIsValid(req.params.id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID." });
    const lead = await Inquiry.findOne({
      _id: req.params.id,
      ...scopeFilter(req.user),
    });
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Lead not found." });
    if (lead.convertedStudent)
      return res.json({
        success: true,
        alreadyConverted: true,
        student: lead.convertedStudent,
        enrollment: lead.convertedEnrollment,
        invoice: lead.convertedInvoice,
      });
    if (!["CONTACTED", "TRIAL_COMPLETED", "INTERESTED"].includes(lead.status))
      return res.status(400).json({
        success: false,
        message:
          "Move the lead to Contacted, Trial Completed, or Interested before admission.",
      });
    const branchId = req.body?.branch || lead.branch || branchIdFor(req.user);
    const planId = req.body?.plan || lead.plan;
    const joinDate = req.body?.joinDate
      ? new Date(`${req.body.joinDate}T00:00:00`)
      : startOfDay();
    if (
      !idIsValid(branchId) ||
      !inScope(req.user, branchId) ||
      !idIsValid(planId) ||
      Number.isNaN(joinDate.getTime()) ||
      joinDate > startOfDay()
    )
      return res.status(400).json({
        success: false,
        message:
          "A valid branch, plan, and nonfuture admission date are required.",
      });
    const [branch, plan] = await Promise.all([
      Branch.findOne({ _id: branchId, isActive: { $ne: false } }),
      Plan.findOne({ _id: planId, isActive: { $ne: false } }),
    ]);
    if (!branch || !plan)
      return res.status(400).json({
        success: false,
        message: "Selected branch or plan is unavailable.",
      });
    if (plan.feeBranch && String(plan.feeBranch) !== String(branch._id))
      return res.status(400).json({
        success: false,
        message: "Selected plan is not available to this branch.",
      });
    const normalizedPhone = normalizePhone(lead.phone);
    const identityMatches = await Student.find({
      $or: [
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        { phone: lead.phone },
        ...(lead.email ? [{ email: lead.email.toLowerCase() }] : []),
      ],
    }).limit(2);
    if (identityMatches.length > 1)
      return res.status(409).json({ success: false, message: "The lead phone and email match different student records. Resolve the duplicate records first." });
    let student = identityMatches[0] || null;
    if (student && String(student.branch) !== String(branch._id))
      return res.status(409).json({
        success: false,
        message: "This person already has a student record at another branch.",
      });
    if (
      !student &&
      (!Number.isInteger(Number(req.body?.age ?? lead.age)) ||
        Number(req.body?.age ?? lead.age) < 1 ||
        Number(req.body?.age ?? lead.age) > 120)
    )
      return res.status(400).json({
        success: false,
        message: "A valid student age is required for admission.",
      });
    if (!student && !normalizedPhone)
      return res.status(400).json({ success: false, message: "The lead phone number must be valid before admission." });
    conversionLock = crypto.randomUUID();
    const claimed = await Inquiry.findOneAndUpdate(
      {
        _id: lead._id,
        convertedStudent: null,
        $or: [
          { conversionLockAt: null },
          { conversionLockAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
        ],
      },
      { $set: { conversionLock, conversionLockAt: new Date() } },
      { returnDocument: "after" },
    ).select("_id");
    if (!claimed) {
      const latest = await Inquiry.findById(lead._id).populate("convertedStudent", "name").lean();
      if (latest?.convertedStudent) return res.json({ success: true, alreadyConverted: true, student: latest.convertedStudent, enrollment: latest.convertedEnrollment, invoice: latest.convertedInvoice });
      return res.status(409).json({ success: false, message: "This lead is already being converted. Refresh and retry shortly." });
    }
    if (!student) {
      student = await Student.create({
        name: lead.fullName,
        age: Number(req.body?.age ?? lead.age),
        phone: normalizedPhone,
        email: lead.email || null,
        branch: branch._id,
        plan: plan._id,
        joinDate,
        status: "ACTIVE",
        currentBelt: plan.startingBelt || "White",
        planEnrollments: [
          {
            plan: plan._id,
            feePlan: plan._id,
            branch: branch._id,
            program: plan.programs?.[0]?.program?._id || plan.programs?.[0]?.program || null,
            startDate: joinDate,
            endDate: enrollmentEndDate(plan, joinDate),
            status: "ACTIVE",
            enrollmentSource: "CRM_CONVERSION",
            createdBy: req.user._id,
            statusHistory: [{ from: null, to: "ACTIVE", changedBy: req.user._id, note: "CRM admission" }],
            ...enrollmentSnapshot(plan, branch._id),
          },
        ],
      });
    } else {
      student.status = "ACTIVE";
      let enrollment = (student.planEnrollments || []).find(
        (item) =>
          item.status === "ACTIVE" && String(item.plan) === String(plan._id),
      );
      if (!enrollment) {
        for (const item of student.planEnrollments || [])
          if (item.status === "ACTIVE") { item.status = "COMPLETED"; item.endDate = joinDate; item.statusHistory.push({ from: "ACTIVE", to: "COMPLETED", changedBy: req.user._id, note: "Superseded by CRM admission" }); }
        student.plan = plan._id;
        student.planEnrollments.push({
          plan: plan._id,
          feePlan: plan._id,
          branch: branch._id,
          program: plan.programs?.[0]?.program?._id || plan.programs?.[0]?.program || null,
          startDate: joinDate,
          endDate: enrollmentEndDate(plan, joinDate),
          status: "ACTIVE",
          enrollmentSource: "CRM_CONVERSION",
          createdBy: req.user._id,
          statusHistory: [{ from: null, to: "ACTIVE", changedBy: req.user._id, note: "CRM admission" }],
          ...enrollmentSnapshot(plan, branch._id),
        });
        await student.save();
      } else if (student.isModified("status")) await student.save();
    }
    const enrollment = [...(student.planEnrollments || [])]
      .reverse()
      .find(
        (item) =>
          item.status === "ACTIVE" && String(item.plan) === String(plan._id),
      );
    let invoice = null;
    if (req.body?.createInvoice === true)
      invoice = await createAdmissionInvoice({
        req,
        lead,
        student,
        enrollment,
        plan,
        actor: req.user,
      });
    lead.convertedStudent = student._id;
    lead.convertedEnrollment = enrollment?._id || null;
    lead.convertedInvoice = invoice?._id || null;
    lead.convertedAt = new Date();
    if (lead.status !== "CONVERTED")
      lead.statusHistory.push({
        from: lead.status,
        to: "CONVERTED",
        changedBy: req.user._id,
        note: "Lead admitted",
      });
    lead.status = "CONVERTED";
    lead.nextFollowUpAt = null;
    await lead.save();
    await Inquiry.updateOne({ _id: lead._id, conversionLock }, { $unset: { conversionLock: 1, conversionLockAt: 1 } });
    const openTrials = await Trial.find({ lead: lead._id, status: { $in: ["COMPLETED", "SCHEDULED"] } });
    for (const trial of openTrials) {
      const nextStatus = trial.status === "COMPLETED" ? "CONVERTED" : "CANCELLED";
      trial.statusHistory.push({ from: trial.status, to: nextStatus, changedBy: req.user._id, note: "Lead admitted" });
      trial.status = nextStatus;
      await trial.save();
    }
    await safelyNotify({
      type: "LEAD_CONVERTED",
      title: "Lead admitted",
      message: `${lead.fullName} was admitted as a student.`,
      severity: "SUCCESS",
      branch: branch._id,
      student: student._id,
      entityType: "LEAD",
      entityId: lead._id,
      actionUrl: "/students",
      eventKey: `lead:${lead._id}:converted`,
    });
    return res.status(201).json({
      success: true,
      alreadyConverted: false,
      lead,
      student,
      enrollment,
      invoice,
    });
  } catch (error) {
    if (conversionLock) await Inquiry.updateOne({ _id: req.params.id, conversionLock }, { $unset: { conversionLock: 1, conversionLockAt: 1 } }).catch(() => {});
    return errorResponse(res, error);
  }
}

async function notifyOverdueFollowUps() {
  const now = new Date();
  const leads = await Inquiry.find({
    nextFollowUpAt: { $lt: now },
    status: { $nin: ["CONVERTED", "LOST", "ENROLLED", "CLOSED"] },
  })
    .select("fullName branch assignedTo nextFollowUpAt")
    .lean();
  for (const lead of leads) {
    const recipients = lead.assignedTo
      ? [lead.assignedTo]
      : await User.find({
          isActive: { $ne: false },
          role: { $in: ["SUPER_ADMIN", "BRANCH_ADMIN"] },
          ...(lead.branch ? { branch: lead.branch } : {}),
        }).distinct("_id");
    for (const recipient of recipients) {
      try {
        await Notification.updateOne(
          {
            recipient,
            eventKey: `lead:${lead._id}:followup:${dateKey(lead.nextFollowUpAt)}`,
          },
          {
            $setOnInsert: {
              recipient,
              type: "LEAD_FOLLOWUP_OVERDUE",
              title: "Lead follow-up overdue",
              message: `Follow up with ${lead.fullName}.`,
              severity: "WARNING",
              branch: lead.branch,
              entityType: "LEAD",
              entityId: lead._id,
              actionUrl: "/crm",
              requiredPermission: "inquiry.view",
              eventKey: `lead:${lead._id}:followup:${dateKey(lead.nextFollowUpAt)}`,
              expiresAt: new Date(Date.now() + 90 * 86400000),
            },
          },
          { upsert: true, runValidators: true },
        );
      } catch (error) {
        if (error.code !== 11000)
          console.error("Lead reminder notification failed", {
            name: error.name,
          });
      }
    }
  }
  return leads.length;
}

module.exports = {
  getPipeline,
  createLead,
  updateLead,
  addFollowUp,
  createTrial,
  updateTrial,
  convertLead,
  notifyOverdueFollowUps,
};

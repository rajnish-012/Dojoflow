const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const Role = require("../models/Role");
const User = require("../models/User");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");

const TYPE_PERMISSION = Object.freeze({
  STUDENT_CREATED: "student.view",
  ATTENDANCE_ABSENT: "attendance.view",
  MAKEUP_CREATED: "makeup.view",
  MAKEUP_SCHEDULED: "makeup.view",
  MAKEUP_COMPLETED: "makeup.view",
  STUDENT_COMPLETED: "student.view",
  PROMOTION_ELIGIBLE: "promotion.view",
  PROMOTION_COMPLETED: "promotion.view",
  FINANCE_PAYMENT_RECEIVED: "finance.view",
  FINANCE_PARTIAL_PAYMENT_RECEIVED: "finance.view",
  FINANCE_DUE_REMINDER: "finance.view",
  FINANCE_OVERDUE_REMINDER: "finance.view",
  FINANCE_STUDENT_PAYMENT_RECEIVED: "student.finance.view",
  FINANCE_STUDENT_PARTIAL_PAYMENT_RECEIVED: "student.finance.view",
  FINANCE_STUDENT_DUE_REMINDER: "student.finance.view",
  FINANCE_STUDENT_OVERDUE_REMINDER: "student.finance.view",
  INQUIRY_RECEIVED: "inquiry.view",
  LEAD_FOLLOWUP_OVERDUE: "inquiry.view",
  LEAD_CONVERTED: "inquiry.view",
  MEMBERSHIP_EXPIRING: "student.view",
  MEMBERSHIP_EXPIRED: "student.view",
  MEMBERSHIP_RENEWAL_COMPLETED: "student.view",
  SYSTEM: null,
});

const ALLOWED_ACTION_ROOTS = new Set([
  "/students", "/memberships", "/attendance", "/makeups", "/inquiries", "/crm", "/promotions", "/notifications", "/fees", "/student-dashboard",
]);

function validateActionUrl(actionUrl) {
  if (!actionUrl) return "";
  if (typeof actionUrl !== "string" || !actionUrl.startsWith("/") || actionUrl.startsWith("//")) {
    throw new Error("Notification action URL must be an internal application path");
  }
  const parsed = new URL(actionUrl, "http://forcestrike.local");
  if (parsed.origin !== "http://forcestrike.local" || ![...ALLOWED_ACTION_ROOTS].some((root) => parsed.pathname === root || parsed.pathname.startsWith(`${root}/`))) {
    throw new Error("Notification action URL is not an approved application route");
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function validateNotification(input) {
  const permitted = TYPE_PERMISSION[input.type];
  if (permitted === undefined) throw new Error("Unsupported notification type");
  const message = String(input.message || "").trim();
  const title = String(input.title || "").trim();
  if (!title || title.length > 120 || !message || message.length > 500) throw new Error("Notification title or message is invalid");
  const metadata = input.metadata;
  if (metadata !== undefined && Buffer.byteLength(JSON.stringify(metadata)) > 2000) throw new Error("Notification metadata is too large");
  return {
    recipient: input.recipient,
    type: input.type,
    title,
    message,
    severity: input.severity || "INFO",
    branch: input.branch || null,
    student: input.student || null,
    entityType: input.entityType || "SYSTEM",
    entityId: input.entityId || null,
    actionUrl: validateActionUrl(input.actionUrl),
    requiredPermission: permitted,
    eventKey: input.eventKey || null,
    metadata,
  };
}

async function createNotification(input) {
  const data = validateNotification(input);
  if (!mongoose.Types.ObjectId.isValid(data.recipient)) throw new Error("Notification recipient is invalid");
  const recipient = await User.findOne({ _id: data.recipient, isActive: { $ne: false } }).select("_id").lean();
  if (!recipient) return null;
  if (data.eventKey) {
    try {
      await Notification.updateOne(
        { recipient: data.recipient, eventKey: data.eventKey },
        { $setOnInsert: { ...data, createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true, runValidators: true, timestamps: false },
      );
      return Notification.findOne({ recipient: data.recipient, eventKey: data.eventKey }).lean();
    } catch (error) {
      if (error?.code === 11000) return Notification.findOne({ recipient: data.recipient, eventKey: data.eventKey }).lean();
      throw error;
    }
  }
  return Notification.create(data);
}

async function resolveRecipients({ permission, branch, student }) {
  if (!permission) throw new Error("Notification recipient permission is required");
  const roles = await Role.find({ permissions: permission }).select("key dataScope").lean();
  const allScopeKeys = roles.filter((role) => role.dataScope === "ALL").map((role) => role.key);
  const branchScopeKeys = roles.filter((role) => role.dataScope !== "ALL").map((role) => role.key);
  const roleKeys = Array.from(new Set(["SUPER_ADMIN", ...allScopeKeys, ...branchScopeKeys]));
  const branchId = branch ? String(branch) : null;
  const branchQuery = branchId
    ? [{ role: "SUPER_ADMIN" }, { role: { $in: allScopeKeys } }, { role: { $in: branchScopeKeys }, branch: branchId }]
    : [{ role: "SUPER_ADMIN" }, { role: { $in: allScopeKeys } }];
  let recipients = await User.find({ isActive: { $ne: false }, role: { $in: roleKeys }, $or: branchQuery }).select("_id role").lean();

  if (student && recipients.some((user) => user.role === "COACH")) {
    const coachIds = recipients.filter((user) => user.role === "COACH").map((user) => user._id);
    const assignments = await CoachStudentAssignment.find({ coach: { $in: coachIds }, student, status: "ACTIVE" }).select("coach").lean();
    const assignedCoachIds = new Set(assignments.map((item) => String(item.coach)));
    recipients = recipients.filter((user) => user.role !== "COACH" || assignedCoachIds.has(String(user._id)));
  }
  return recipients.map((user) => user._id);
}

async function notifyAuthorizedUsers(input) {
  const permission = TYPE_PERMISSION[input.type];
  if (permission === undefined) throw new Error("Unsupported notification type");
  const recipientIds = await resolveRecipients({ permission, branch: input.branch, student: input.student });
  return Promise.all(recipientIds.map((recipient) => createNotification({ ...input, recipient })));
}

async function safelyNotify(input) {
  try {
    return await notifyAuthorizedUsers(input);
  } catch (error) {
    console.error("Notification persistence failed", { type: input?.type, name: error?.name || "Error", code: error?.code });
    return [];
  }
}

module.exports = { TYPE_PERMISSION, createNotification, notifyAuthorizedUsers, safelyNotify, resolveRecipients };

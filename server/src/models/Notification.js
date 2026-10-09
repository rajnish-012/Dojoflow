const mongoose = require("mongoose");

const NOTIFICATION_TYPES = Object.freeze([
  "STUDENT_CREATED",
  "ATTENDANCE_ABSENT",
  "MAKEUP_CREATED",
  "MAKEUP_SCHEDULED",
  "MAKEUP_COMPLETED",
  "STUDENT_COMPLETED",
  "PROMOTION_ELIGIBLE",
  "PROMOTION_COMPLETED",
  "GRADING_SCHEDULED",
  "STUDENT_GRADING_SCHEDULED",
  "GRADING_RESULT_PUBLISHED",
  "STUDENT_GRADING_RESULT_PUBLISHED",
  "STUDENT_PROMOTION_COMPLETED",
  "FINANCE_PAYMENT_RECEIVED",
  "FINANCE_PARTIAL_PAYMENT_RECEIVED",
  "FINANCE_STUDENT_PAYMENT_RECEIVED",
  "FINANCE_STUDENT_PARTIAL_PAYMENT_RECEIVED",
  "FINANCE_DUE_REMINDER",
  "FINANCE_OVERDUE_REMINDER",
  "FINANCE_STUDENT_DUE_REMINDER",
  "FINANCE_STUDENT_OVERDUE_REMINDER",
  "INVENTORY_LOW_STOCK",
  "INVENTORY_OUT_OF_STOCK",
  "INVENTORY_TRANSFER_COMPLETED",
  "INQUIRY_RECEIVED",
  "LEAD_FOLLOWUP_OVERDUE",
  "LEAD_CONVERTED",
  "ACADEMY_EVENT_SCHEDULED",
  "ACADEMY_EVENT_UPDATED",
  "ACADEMY_EVENT_CANCELLED",
  "ACADEMY_EVENT_REGISTRATION",
  "STUDENT_ACADEMY_EVENT_SCHEDULED",
  "STUDENT_ACADEMY_EVENT_UPDATED",
  "STUDENT_ACADEMY_EVENT_CANCELLED",
  "STUDENT_ACADEMY_EVENT_REGISTRATION",
  "MEMBERSHIP_EXPIRING",
  "MEMBERSHIP_EXPIRED",
  "MEMBERSHIP_RENEWAL_COMPLETED",
  "SYSTEM",
]);

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    severity: {
      type: String,
      enum: ["INFO", "SUCCESS", "WARNING", "ERROR"],
      default: "INFO",
      required: true,
    },
    read: { type: Boolean, default: false, required: true },
    readAt: { type: Date, default: null },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
    entityType: {
      type: String,
      enum: [
        "STUDENT",
        "ATTENDANCE",
        "MAKEUP",
        "PROMOTION",
        "INQUIRY",
        "LEAD",
        "SYSTEM",
        "FINANCE",
        "MEMBERSHIP",
        "GRADING",
        "INVENTORY",
        "ACADEMY_EVENT",
      ],
      default: "SYSTEM",
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actionUrl: { type: String, trim: true, maxlength: 300, default: "" },
    requiredPermission: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },
    eventKey: { type: String, trim: true, maxlength: 200, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      required: true,
    },
  },
  { timestamps: true, minimize: true },
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, branch: 1, createdAt: -1 });
notificationSchema.index({ entityType: 1, entityId: 1 });
notificationSchema.index(
  { recipient: 1, eventKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventKey: { $type: "string" } },
    name: "uniq_notification_recipient_event",
  },
);
notificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "ttl_notification_expiry" },
);

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

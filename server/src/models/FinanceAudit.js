const mongoose = require("mongoose");
const { AUDIT_ACTION_VALUES } = require("../config/auditActions");

const financeAuditSchema = new mongoose.Schema({
  action: { type: String, enum: AUDIT_ACTION_VALUES, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  actorName: { type: String, trim: true, maxlength: 120, default: "" },
  entityType: { type: String, trim: true, maxlength: 80, default: "FINANCE" },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null, index: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
  reason: { type: String, trim: true, maxlength: 500, default: "" },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  ipAddress: { type: String, trim: true, maxlength: 80, default: "" },
  userAgent: { type: String, trim: true, maxlength: 300, default: "" },
  requestId: { type: String, trim: true, maxlength: 100, default: "" },
}, { timestamps: { createdAt: true, updatedAt: false } });

financeAuditSchema.index({ branch: 1, createdAt: -1 });
financeAuditSchema.index({ actor: 1, createdAt: -1 });
financeAuditSchema.index({ entityType: 1, createdAt: -1 });
financeAuditSchema.index({ action: 1, createdAt: -1 });
financeAuditSchema.index({ entityId: 1, createdAt: -1 });
financeAuditSchema.index({ createdAt: -1, _id: -1 });

const immutableWrite = function rejectAuditMutation() {
  throw new Error("Audit records are immutable.");
};
financeAuditSchema.pre("save", function rejectAuditSave() {
  if (!this.isNew) throw new Error("Audit records are immutable.");
});
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  financeAuditSchema.pre(operation, immutableWrite);
}
financeAuditSchema.pre("bulkWrite", immutableWrite);
financeAuditSchema.pre("deleteOne", { document: true, query: false }, immutableWrite);

// Preserve the existing collection and all legacy FinanceAudit consumers while
// providing the same centralized immutable audit store for other CRM domains.
module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", financeAuditSchema, "financeaudits");

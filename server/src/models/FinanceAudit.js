const mongoose = require("mongoose");

const financeAuditSchema = new mongoose.Schema({
  action: { type: String, enum: ["FEE_PLAN_UPDATED", "INVOICE_CREATED", "INVOICE_CANCELLED", "PAYMENT_CREATED", "PAYMENT_CORRECTED", "PAYMENT_REFUNDED"], required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null, index: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
  reason: { type: String, trim: true, maxlength: 500, default: "" },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

financeAuditSchema.index({ branch: 1, createdAt: -1 });
module.exports = mongoose.model("FinanceAudit", financeAuditSchema);

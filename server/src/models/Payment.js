const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  direction: { type: String, enum: ["CREDIT", "DEBIT"], default: "CREDIT", required: true },
  kind: { type: String, enum: ["PAYMENT", "REFUND", "CORRECTION"], default: "PAYMENT", required: true },
  paymentDate: { type: Date, required: true, default: Date.now, index: true },
  method: { type: String, enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"], default: "OTHER", required: true },
  referenceId: { type: String, trim: true, maxlength: 120, default: "" },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  notes: { type: String, trim: true, maxlength: 1000, default: "" },
  status: { type: String, enum: ["COMPLETED"], default: "COMPLETED", required: true },
  idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
  relatedPayment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
  reason: { type: String, trim: true, maxlength: 500, default: "" },
}, { timestamps: true });

paymentSchema.index({ idempotencyKey: 1 }, { unique: true, name: "uniq_payment_idempotency" });
paymentSchema.index({ branch: 1, paymentDate: -1 });
paymentSchema.index({ invoice: 1, paymentDate: 1 });
paymentSchema.index({ referenceId: 1 }, { unique: true, partialFilterExpression: { referenceId: { $type: "string", $gt: "" } }, name: "uniq_payment_reference" });

module.exports = mongoose.model("Payment", paymentSchema);

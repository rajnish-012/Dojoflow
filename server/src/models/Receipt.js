const mongoose = require("mongoose");

const receiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true, trim: true, index: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, unique: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  direction: { type: String, enum: ["CREDIT", "DEBIT"], default: "CREDIT", required: true },
  kind: { type: String, enum: ["PAYMENT", "REFUND", "CORRECTION"], default: "PAYMENT", required: true },
  method: { type: String, enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"], required: true },
  date: { type: Date, required: true },
  currency: { type: String, default: "INR", uppercase: true, trim: true },
  academy: { name: { type: String, default: "ForceStrike Academy" }, logoUrl: { type: String, default: "" }, address: { type: String, default: "" }, contactEmail: { type: String, default: "" }, contactPhone: { type: String, default: "" }, primaryColor: { type: String, default: "#D7A84B" } },
  studentName: { type: String, required: true },
  invoiceNumber: { type: String, required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

receiptSchema.index({ branch: 1, date: -1 });

module.exports = mongoose.model("Receipt", receiptSchema);

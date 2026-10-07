const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true, maxlength: 160 },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  unitAmount: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  kind: { type: String, enum: ["TUITION", "REGISTRATION", "ADJUSTMENT"], default: "TUITION" },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", default: null },
  programName: { type: String, default: "" },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, trim: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  enrollment: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  items: { type: [invoiceItemSchema], required: true, validate: (items) => Array.isArray(items) && items.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  discountName: { type: String, default: "" },
  taxRate: { type: Number, default: 0, min: 0, max: 100 },
  tax: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  balance: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR", uppercase: true, trim: true, maxlength: 3 },
  dueDate: { type: Date, required: true, index: true },
  periodStart: { type: Date, default: null },
  periodEnd: { type: Date, default: null },
  cycleKey: { type: String, required: true, trim: true },
  status: { type: String, enum: ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"], default: "ISSUED", index: true },
  notes: { type: String, trim: true, maxlength: 1000, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  issuedAt: { type: Date, default: Date.now },
}, { timestamps: true });

invoiceSchema.index({ enrollment: 1, cycleKey: 1 }, {
  unique: true,
  name: "uniq_invoice_enrollment_cycle",
  partialFilterExpression: { status: { $in: ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "REFUNDED"] } },
});
invoiceSchema.index({ branch: 1, status: 1, dueDate: 1 });
invoiceSchema.index({ branch: 1, issuedAt: -1, status: 1 });
invoiceSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("Invoice", invoiceSchema);

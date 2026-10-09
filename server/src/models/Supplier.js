const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  contactPerson: { type: String, trim: true, maxlength: 120, default: "" },
  phone: { type: String, trim: true, maxlength: 30, default: "" },
  email: { type: String, trim: true, lowercase: true, maxlength: 160, default: "" },
  address: { type: String, trim: true, maxlength: 1000, default: "" },
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", required: true },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

supplierSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 }, name: "uniq_supplier_name_case_insensitive" });
supplierSchema.index({ email: 1 });

module.exports = mongoose.model("Supplier", supplierSchema);

const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  capacity: { type: Number, required: true, min: 1, max: 1000 },
  // A write inside the admission transaction serializes competing seat claims.
  capacityRevision: { type: Number, default: 0, min: 0 },
  coach: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  room: { type: String, trim: true, maxlength: 100, default: "" },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
  status: { type: String, enum: ["DRAFT", "ACTIVE", "PAUSED", "INACTIVE"], default: "DRAFT", index: true },
  effectiveFrom: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
  effectiveUntil: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
  startDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
  calculatedEndDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
  capacityIssue: { type: String, trim: true, maxlength: 500, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

batchSchema.index({ branch: 1, code: 1 }, { unique: true });
batchSchema.index({ branch: 1, plan: 1, status: 1 });

module.exports = mongoose.model("Batch", batchSchema);

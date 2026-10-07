const mongoose = require("mongoose");

const attendanceCorrectionSchema = new mongoose.Schema({
  attendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  requestedAt: { type: Date, required: true, default: Date.now },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  original: { type: mongoose.Schema.Types.Mixed, required: true },
  proposed: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"], default: "PENDING", required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
  final: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

attendanceCorrectionSchema.index({ attendance: 1, createdAt: -1 });
attendanceCorrectionSchema.index({ branch: 1, status: 1, createdAt: -1 });
attendanceCorrectionSchema.index({ attendance: 1 }, { unique: true, partialFilterExpression: { status: "PENDING" }, name: "uniq_pending_attendance_correction" });

const immutableCorrectionFields = new Set(["attendance", "student", "branch", "requestedBy", "requestedAt", "reason", "original", "proposed"]);
attendanceCorrectionSchema.pre("save", function protectCorrectionEvidence() {
  if (!this.isNew && this.modifiedPaths().some((path) => immutableCorrectionFields.has(path))) {
    throw new Error("Attendance correction evidence is immutable.");
  }
});
const rejectCorrectionMutation = function rejectCorrectionMutation() { throw new Error("Attendance correction history cannot be overwritten or deleted."); };
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete", "bulkWrite"]) {
  attendanceCorrectionSchema.pre(operation, rejectCorrectionMutation);
}

module.exports = mongoose.model("AttendanceCorrection", attendanceCorrectionSchema);

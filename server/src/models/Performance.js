const mongoose = require("mongoose");

const performanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    attendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", required: true, index: true },
    enrollment: { type: mongoose.Schema.Types.ObjectId, default: null },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    sessionTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true, index: true },
    sessionSlotId: { type: mongoose.Schema.Types.ObjectId, default: null },

    planDay: {
      type: Number,
      required: true,
      min: 1,
    },

    curriculumTitle: {
      type: String,
      required: true,
      trim: true,
    },

    skill: {
      type: String,
      required: true,
      trim: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    remarks: {
      type: String,
      trim: true,
    },

    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    evaluationDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

performanceSchema.index({ attendance: 1, skill: 1 }, { unique: true, partialFilterExpression: { attendance: { $type: "objectId" } } });
performanceSchema.index({ branch: 1, evaluationDate: -1 });
performanceSchema.index({ student: 1, evaluationDate: -1 });

module.exports = mongoose.model("Performance", performanceSchema);

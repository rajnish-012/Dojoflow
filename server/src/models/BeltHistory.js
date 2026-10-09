const mongoose = require("mongoose");

const beltHistorySchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    sessionTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", default: null, index: true },
    gradingEvent: { type: mongoose.Schema.Types.ObjectId, ref: "GradingEvent", default: null, index: true },

    fromBelt: {
      type: String,
      trim: true,
      default: "",
    },

    toBelt: {
      type: String,
      required: true,
      trim: true,
    },

    milestoneDay: {
      type: Number,
      min: 1,
      default: null,
    },
    curriculumMilestone: { type: mongoose.Schema.Types.ObjectId, ref: "StudentCurriculumMilestone", default: null, index: true },
    curriculum: { type: mongoose.Schema.Types.ObjectId, ref: "Curriculum", default: null },
    curriculumStepId: { type: String, trim: true, default: "" },

    skill: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },
    reason: { type: String, trim: true, maxlength: 300, default: "" },

    promotedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

/*
 * A student should not receive the same belt
 * through the same promotion flow more than once.
 */
beltHistorySchema.index(
  {
    student: 1,
    sessionTypeId: 1,
    toBelt: 1,
  },
  {
    unique: true,
  },
);

beltHistorySchema.index({
  branch: 1,
  promotedAt: -1,
});

beltHistorySchema.index({
  student: 1,
  promotedAt: -1,
});

const immutableHistoryWrite = function rejectBeltHistoryMutation() {
  throw new Error("Belt history is immutable.");
};
beltHistorySchema.pre("save", function rejectHistorySave() {
  if (!this.isNew) throw new Error("Belt history is immutable.");
});
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  beltHistorySchema.pre(operation, immutableHistoryWrite);
}
beltHistorySchema.pre("bulkWrite", immutableHistoryWrite);

module.exports = mongoose.model("BeltHistory", beltHistorySchema);

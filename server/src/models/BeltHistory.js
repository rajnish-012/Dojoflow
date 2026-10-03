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
      required: true,
      min: 1,
    },

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

module.exports = mongoose.model("BeltHistory", beltHistorySchema);

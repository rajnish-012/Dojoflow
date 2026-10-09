const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
    },

    belt: {
      type: String,
      required: true,
      trim: true,
    },

    skill: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const curriculumSchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    skill: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const programPlanSchema = new mongoose.Schema({
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  weeklyLimit: { type: Number, min: 1, default: null },
  curriculum: { type: [curriculumSchema], default: [] },
}, { _id: false });

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    durationUnit: {
      type: String,
      enum: ["MONTHS", "DAYS"],
      default: "MONTHS",
    },

    classesPerWeek: {
      type: Number,
      default: 4,
      min: 1,
    },
    // Serializes FeeTerm schedule writes without embedding FeeTerms in Plan.
    feeTermsRevision: { type: Number, default: 0, min: 0, select: false },
    // Shared write-conflict point for published Curriculum capacity changes.
    curriculumRevision: { type: Number, default: 0, min: 0 },

    // Programs included in this plan. Legacy plans may have an empty list
    // until an administrator assigns their existing students' programs.
    programs: { type: [programPlanSchema], default: [] },

    startingBelt: {
      type: String,
      default: "White",
      trim: true,
    },

    progressReports: {
      type: String,
      default: "Monthly",
      trim: true,
    },

    // Deprecated Plan-wide thresholds. Preserved for historical reads only;
    // curriculum and promotion services must not use this legacy field.
    milestones: {
      type: [milestoneSchema],
      default: [],
    },

    curriculum: {
      type: [curriculumSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },  
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Plan", planSchema);

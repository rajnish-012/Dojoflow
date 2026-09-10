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

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
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
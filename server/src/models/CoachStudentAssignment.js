const mongoose = require("mongoose");

const coachStudentAssignmentSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

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

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },

    assignedAt: {
      type: Date,
      default: Date.now,
    },

    unassignedAt: {
      type: Date,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

coachStudentAssignmentSchema.index(
  {
    coach: 1,
    student: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "ACTIVE",
    },
  },
);

coachStudentAssignmentSchema.index({
  coach: 1,
  status: 1,
});

coachStudentAssignmentSchema.index({
  student: 1,
  status: 1,
});

coachStudentAssignmentSchema.index({
  branch: 1,
  status: 1,
});

module.exports = mongoose.model(
  "CoachStudentAssignment",
  coachStudentAssignmentSchema,
);

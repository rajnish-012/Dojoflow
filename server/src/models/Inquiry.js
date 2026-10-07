const mongoose = require("mongoose");

const preferredSessionSchema = new mongoose.Schema(
  {
    sessionName: { type: String, default: "", trim: true },
    sessionTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", default: null },
    sessionTypeName: { type: String, default: "", trim: true },
    startTime: { type: String, default: "", trim: true },
    endTime: { type: String, default: "", trim: true },
    dayName: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const preferredWeeklySessionSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    dayName: { type: String, default: "", trim: true },
    sessionName: { type: String, default: "", trim: true },
    sessionTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
    sessionTypeName: { type: String, default: "", trim: true },
    startTime: { type: String, default: "", trim: true },
    endTime: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const inquirySchema = new mongoose.Schema(
  {
    source: { type: String, trim: true, maxlength: 80, default: "WEBSITE" },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    nextFollowUpAt: { type: Date, default: null, index: true },
    followUps: [{
      note: { type: String, required: true, trim: true, maxlength: 2000 },
      dueAt: { type: Date, default: null },
      assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      createdAt: { type: Date, default: Date.now },
    }],
    statusHistory: [{
      from: { type: String, default: null },
      to: { type: String, required: true },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      changedAt: { type: Date, default: Date.now },
      note: { type: String, trim: true, maxlength: 500, default: "" },
    }],
    convertedStudent: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    convertedEnrollment: { type: mongoose.Schema.Types.ObjectId, default: null },
    convertedInvoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    convertedAt: { type: Date, default: null, index: true },
    conversionLock: { type: String, default: null, select: false },
    conversionLockAt: { type: Date, default: null, select: false },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    age: {
      type: Number,
      min: 3,
      max: 100,
    },

    currentBelt: {
      type: String,
      default: "Beginner",
      trim: true,
    },

    experience: {
      type: String,
      default: "",
      trim: true,
    },

    preferredBatch: {
      type: String,
      default: "",
      trim: true,
    },

    // Text shown to staff (the branch name)
    preferredBranch: {
      type: String,
      default: "",
      trim: true,
    },

    // Real link to the branch, used to limit who can see the inquiry
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingSessionType",
      default: null,
    },
    programName: { type: String, default: "", trim: true },
    programs: {
      type: [{ program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType" }, name: { type: String, trim: true } }],
      default: [],
    },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    planName: { type: String, default: "", trim: true },
    preferredDate: { type: String, default: "", trim: true },
    preferredSession: { type: preferredSessionSchema, default: null },
    preferredWeeklySessions: { type: [preferredWeeklySessionSchema], default: [] },

    message: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["NEW", "CONTACTED", "TRIAL_SCHEDULED", "TRIAL_COMPLETED", "INTERESTED", "NOT_INTERESTED", "CONVERTED", "LOST", "ENROLLED", "CLOSED"],
      default: "NEW",
    },
  },
  {
    timestamps: true,
  },
);

inquirySchema.index({ email: 1, phone: 1, createdAt: -1 });
inquirySchema.index({ branch: 1, status: 1, createdAt: -1 });
inquirySchema.index({ branch: 1, createdAt: -1 });
inquirySchema.index({ assignedTo: 1, createdAt: -1 });
inquirySchema.index({ branch: 1, nextFollowUpAt: 1, assignedTo: 1 });

module.exports = mongoose.model("Inquiry", inquirySchema);

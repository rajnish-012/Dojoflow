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
      enum: ["NEW", "CONTACTED", "ENROLLED", "CLOSED"],
      default: "NEW",
    },
  },
  {
    timestamps: true,
  },
);

inquirySchema.index({ email: 1, phone: 1, createdAt: -1 });

module.exports = mongoose.model("Inquiry", inquirySchema);

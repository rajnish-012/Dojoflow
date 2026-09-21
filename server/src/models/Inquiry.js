const mongoose = require("mongoose");

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

module.exports = mongoose.model("Inquiry", inquirySchema);

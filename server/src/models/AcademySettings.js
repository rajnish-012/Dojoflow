const mongoose = require("mongoose");

const academySettingsSchema = new mongoose.Schema(
  {
    academyName: {
      type: String,
      required: true,
      trim: true,
      default: "DojoFlow Academy",
    },

    tagline: {
      type: String,
      trim: true,
      default: "Train with purpose. Manage with clarity.",
    },

    logoUrl: {
      type: String,
      trim: true,
      default: "",
    },

    faviconUrl: {
      type: String,
      trim: true,
      default: "",
    },

    primaryColor: {
      type: String,
      trim: true,
      default: "#D7A84B",
    },

    secondaryColor: {
      type: String,
      trim: true,
      default: "#101A33",
    },

    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    contactPhone: {
      type: String,
      trim: true,
      default: "",
    },

    website: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    timezone: {
      type: String,
      trim: true,
      default: "Asia/Kolkata",
    },

    currency: {
      type: String,
      trim: true,
      default: "INR",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("AcademySettings", academySettingsSchema);

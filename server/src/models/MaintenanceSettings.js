const mongoose = require("mongoose");

const maintenanceSettingsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default:
        "ForceStrike CRM is temporarily unavailable while we perform system maintenance. Please try again shortly.",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "MaintenanceSettings",
  maintenanceSettingsSchema,
);

const mongoose = require("mongoose");

const emailSystemSettingsSchema = new mongoose.Schema(
  {
    settingsKey: { type: String, default: "primary", unique: true, immutable: true },
    smtpHost: { type: String, required: true, trim: true, maxlength: 255 },
    smtpPort: { type: Number, required: true, min: 1, max: 65535, default: 465 },
    smtpSecure: { type: Boolean, default: true },
    smtpUsername: { type: String, required: true, trim: true, maxlength: 320 },
    smtpPasswordEncrypted: { type: String, required: true, select: false },
    fromName: { type: String, trim: true, maxlength: 120, default: "" },
    fromEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    notificationEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("EmailSystemSettings", emailSystemSettingsSchema);

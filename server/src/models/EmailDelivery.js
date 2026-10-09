const mongoose = require("mongoose");

const emailDeliverySchema = new mongoose.Schema({
  recipient: { type: String, required: true, trim: true, lowercase: true, maxlength: 150 },
  eventKey: { type: String, required: true, trim: true, maxlength: 240 },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  status: { type: String, enum: ["PENDING", "SENT", "FAILED"], required: true },
  subject: { type: String, trim: true, maxlength: 250, default: "" },
  lastError: { type: String, trim: true, maxlength: 500, default: "" },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

emailDeliverySchema.index({ recipient: 1, eventKey: 1 }, { unique: true, name: "uniq_email_delivery_recipient_event" });

module.exports = mongoose.model("EmailDelivery", emailDeliverySchema);

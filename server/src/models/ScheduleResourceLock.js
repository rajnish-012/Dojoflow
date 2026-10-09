const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  token: { type: String, default: null },
  lockedUntil: { type: Date, default: null },
  deleteAfter: { type: Date, default: null },
}, { timestamps: true });

schema.index({ deleteAfter: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model("ScheduleResourceLock", schema);

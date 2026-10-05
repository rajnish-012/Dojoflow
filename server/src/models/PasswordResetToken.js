const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true, expires: 0 },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("PasswordResetToken", schema);

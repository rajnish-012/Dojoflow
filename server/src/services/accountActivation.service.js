const crypto = require("crypto");
const PasswordResetToken = require("../models/PasswordResetToken");
const User = require("../models/User");
const { sendAccountActivationEmail } = require("./inquiryEmail.service");

function resetUrl(token) {
  const clientOrigin = String(process.env.CLIENT_URL || "http://localhost:3000").split(",")[0].trim().replace(/\/$/, "");
  return `${clientOrigin}/reset-password#token=${encodeURIComponent(token)}`;
}

function createBootstrapPassword() {
  return crypto.randomBytes(24).toString("base64url");
}

async function sendAccountActivation(user) {
  await PasswordResetToken.deleteMany({ user: user._id, consumedAt: null });
  const token = crypto.randomBytes(32).toString("base64url");
  const resetRecord = await PasswordResetToken.create({
    user: user._id,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  try {
    await sendAccountActivationEmail({
      to: user.email,
      name: user.name,
      role: user.role,
      activationUrl: resetUrl(token),
    });
    await User.updateOne({ _id: user._id }, { $set: { mustResetPassword: true } });
    return true;
  } catch (error) {
    await PasswordResetToken.deleteOne({ _id: resetRecord._id, consumedAt: null }).catch(() => {});
    throw error;
  }
}

module.exports = { sendAccountActivation, createBootstrapPassword };

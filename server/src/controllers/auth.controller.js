const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");
const Branch = require("../models/Branch");
const PasswordResetToken = require("../models/PasswordResetToken");
const { validatePassword, sessionInvalidationTime } = require("../utils/passwordPolicy");
const { sendPasswordResetEmail } = require("../services/inquiryEmail.service");

const SESSION_COOKIE = "forcestrike_session";
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 12);
const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
const clearSessionCookie = (res) =>
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

/* =========================================================
   HELPERS
========================================================= */

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
};

/* =========================================================
   REGISTER
   Not exposed on any route — admin creates users directly.
   Kept here for internal use / future admin panel.
========================================================= */

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: "STUDENT",
      branch: null,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================================================
   LOGIN
========================================================= */

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email || !password || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    /*
     * Normalize email to lowercase so "User@example.com"
     * and "user@example.com" resolve to the same account.
     */
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    /*
     * Reject deactivated accounts before checking the password.
     * This prevents timing attacks that could reveal whether
     * an email address exists in the system.
     */
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.mustResetPassword) {
      return res.status(403).json({
        success: false,
        message: "Password reset required. Use Forgot password to recover account access.",
      });
    }

    /*
     * Update lastLogin timestamp without triggering
     * a full document validation cycle.
     */
    await User.updateOne({ _id: user._id }, { lastLogin: new Date() });

    const role = await Role.findOne({
      key: String(user.role || "").toUpperCase(),
    }).select("key permissions dataScope");

    const permissions = Array.isArray(role?.permissions)
      ? Array.from(new Set(role.permissions))
      : [];

    const token = generateToken(user);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    const branchRecord = user.branch
      ? await Branch.findById(user.branch).select("name").lean()
      : null;

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        branchName: branchRecord?.name || null,
        dataScope:
          String(user.role || "").toUpperCase() === "SUPER_ADMIN"
            ? "ALL"
            : role?.dataScope === "ALL"
              ? "ALL"
              : "BRANCH",
        permissions,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const logout = (req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// One-time bridge for sessions created before the HttpOnly-cookie migration.
const migrateLegacySession = async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!token)
      return res
        .status(400)
        .json({ success: false, message: "Legacy session is missing" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (
      !user ||
      user.isActive === false ||
      (user.passwordChangedAt &&
        decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000))
    ) {
      clearSessionCookie(res);
      return res
        .status(401)
        .json({
          success: false,
          message: "Session expired. Please log in again.",
        });
    }
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return res.status(204).end();
  } catch {
    clearSessionCookie(res);
    return res
      .status(401)
      .json({
        success: false,
        message: "Session expired. Please log in again.",
      });
  }
};

/* =========================================================
   CHANGE PASSWORD
   PATCH /api/auth/change-password
   Any authenticated user can change their own password.
========================================================= */

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
      });
    }

    /*
     * Re-fetch with the password field included
     * (it is excluded from all other queries by default).
     */
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    user.passwordChangedAt = sessionInvalidationTime();
    user.mustResetPassword = false;

    await user.save();
    clearSessionCookie(res);

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};

const requestPasswordReset = async (req, res) => {
  const genericResponse = {
    success: true,
    message: "If an active account matches that email, password reset instructions will be sent.",
  };
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    res.status(202).json(genericResponse);
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    const user = await User.findOne({ email, isActive: { $ne: false } }).select("_id").lean();
    if (!user) return;

    await PasswordResetToken.deleteMany({ user: user._id, consumedAt: null });
    const token = crypto.randomBytes(32).toString("base64url");
    const resetRecord = await PasswordResetToken.create({
      user: user._id,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    const clientOrigin = process.env.CLIENT_URL.split(",")[0].trim().replace(/\/$/, "");
    const resetUrl = `${clientOrigin}/reset-password#token=${encodeURIComponent(token)}`;
    void sendPasswordResetEmail(email, resetUrl).catch(async () => {
      await PasswordResetToken.deleteOne({ _id: resetRecord._id, consumedAt: null });
      console.error("Password reset email could not be sent.");
    });
  } catch {
    // Keep account-existence and mail-provider state out of the public response.
    console.error("Password reset request could not be completed.");
  }
};

const resetPassword = async (req, res) => {
  let claimedReset = null;
  let passwordWasUpdated = false;
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const newPassword = req.body?.newPassword;
    const passwordError = validatePassword(newPassword);
    if (!token || token.length > 128) return res.status(400).json({ success: false, message: "Reset link is invalid or expired." });
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const reset = await PasswordResetToken.findOneAndUpdate(
      { tokenHash, consumedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { consumedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!reset) return res.status(400).json({ success: false, message: "Reset link is invalid or expired." });
    claimedReset = reset;

    const user = await User.findById(reset.user);
    if (!user || user.isActive === false) return res.status(400).json({ success: false, message: "Reset link is invalid or expired." });
    user.password = newPassword;
    user.passwordChangedAt = sessionInvalidationTime();
    user.mustResetPassword = false;
    // Validate the fields changed in this reset. Legacy profile data may not
    // satisfy newer unrelated validators, and should not block account recovery.
    await user.save({ validateModifiedOnly: true });
    passwordWasUpdated = true;
    try {
      await PasswordResetToken.deleteMany({ user: user._id });
    } catch (cleanupError) {
      console.error("Other password reset tokens could not be invalidated.", {
        name: cleanupError?.name || "Error",
        code: cleanupError?.code,
      });
    }
    return res.status(200).json({ success: true, message: "Password reset successfully. Please sign in with your new password." });
  } catch (error) {
    if (claimedReset && !passwordWasUpdated) {
      try {
        await PasswordResetToken.updateOne(
          { _id: claimedReset._id, consumedAt: claimedReset.consumedAt },
          { $set: { consumedAt: null } },
        );
      } catch (releaseError) {
        console.error("Failed password reset could not release its token.", {
          name: releaseError?.name || "Error",
          code: releaseError?.code,
        });
      }
    }
    console.error("Password reset could not be completed.", {
      name: error?.name || "Error",
      code: error?.code,
      validationPaths: Object.keys(error?.errors || {}),
    });
    return res.status(500).json({ success: false, message: "Unable to reset password right now." });
  }
};

module.exports = {
  register,
  login,
  changePassword,
  logout,
  migrateLegacySession,
  requestPasswordReset,
  resetPassword,
};

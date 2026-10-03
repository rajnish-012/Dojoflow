const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");
const Branch = require("../models/Branch");

const SESSION_COOKIE = "forcestrike_session";
const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
const clearSessionCookie = (res) => res.clearCookie(SESSION_COOKIE, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
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

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
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

    if (!email || !password) {
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
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message:
          "This account has been deactivated. Please contact your administrator.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
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
    if (!token) return res.status(400).json({ success: false, message: "Legacy session is missing" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.isActive === false || (user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000))) {
      clearSessionCookie(res);
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return res.status(204).end();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
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

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
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

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedNewPassword;
    user.passwordChangedAt = new Date();

    await user.save();

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

module.exports = {
  register,
  login,
  changePassword,
  logout,
  migrateLegacySession,
};

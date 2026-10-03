const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Role = require("../models/Role");

/**
 * Resolve the current database role.
 */
const resolveRole = async (user) => {
  const roleKey = String(user?.role || "").toUpperCase();

  if (!roleKey) {
    return null;
  }

  return Role.findOne({
    key: roleKey,
  }).select("key name permissions dataScope isSystem");
};

/**
 * JWT authentication middleware.
 *
 * The JWT authenticates the identity only.
 *
 * Current role, permissions and data scope are resolved
 * from MongoDB on every authenticated request.
 *
 * Browser-accessible storage and client-supplied role values are never trusted.
 */
const protect = async (req, res, next) => {
  try {
    const cookieHeader = req.headers.cookie || "";
    const sessionCookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith("forcestrike_session="));
    const cookieToken = sessionCookie ? decodeURIComponent(sessionCookie.slice("forcestrike_session=".length)) : "";
    const token = cookieToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      res.clearCookie("forcestrike_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    if (
      user.passwordChangedAt &&
      Number.isInteger(decoded.iat) &&
      decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      res.clearCookie("forcestrike_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
      });
    }

    if (user.isActive === false) {
      res.clearCookie("forcestrike_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(401).json({
        success: false,
        message:
          "This account has been deactivated. Please contact your administrator.",
      });
    }

    const role = await resolveRole(user);

    const roleKey = String(user.role || "").toUpperCase();

    /*
     * Fail closed for permissions if the role cannot
     * currently be resolved.
     */
    const permissions = Array.isArray(role?.permissions)
      ? Array.from(new Set(role.permissions))
      : [];

    user.role = roleKey;

    user.permissions = permissions;

    user.dataScope =
      roleKey === "SUPER_ADMIN"
        ? "ALL"
        : role?.dataScope === "ALL"
          ? "ALL"
          : "BRANCH";

    /*
     * Internal request-only reference.
     * Not persisted to MongoDB.
     */
    user.roleRecord = role;

    req.user = user;

    next();
  } catch (error) {
    res.clearCookie("forcestrike_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = protect;

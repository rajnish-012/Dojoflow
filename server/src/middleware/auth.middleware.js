const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");

/**
 * Resolves whether the user's role can see every branch
 * ("ALL") or only their own branch ("BRANCH").
 *
 * SUPER_ADMIN always gets global scope without a DB lookup.
 */
const resolveDataScope = async (user) => {
  if (user.role === "SUPER_ADMIN") {
    return "ALL";
  }

  const role = await Role.findOne({ key: user.role }).select("dataScope");

  return role?.dataScope === "ALL" ? "ALL" : "BRANCH";
};

/**
 * protect — JWT authentication middleware.
 *
 * Verifies the Bearer token, fetches the User from the DB,
 * and attaches req.user for downstream handlers.
 *
 * Also checks req.user.isActive so that deactivated accounts
 * are rejected even while their token is still technically valid.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
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
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
      });
    }

    /*
     * Reject deactivated accounts even if the JWT is still valid.
     * This allows administrators to immediately block access
     * without waiting for token expiry.
     */
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message:
          "This account has been deactivated. Please contact your administrator.",
      });
    }

    user.dataScope = await resolveDataScope(user);

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = protect;

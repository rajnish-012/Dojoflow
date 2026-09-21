const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");

/**
 * Finds out whether the user's role can see every branch
 * ("ALL") or only their own branch ("BRANCH").
 */
const resolveDataScope = async (user) => {
  if (user.role === "SUPER_ADMIN") {
    return "ALL";
  }

  const role = await Role.findOne({ key: user.role }).select(
    "dataScope"
  );

  return role?.dataScope === "ALL" ? "ALL" : "BRANCH";
};

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

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
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
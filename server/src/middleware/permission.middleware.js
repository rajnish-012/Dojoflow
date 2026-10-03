const Role = require("../models/Role");

const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

const getRoleForUser = async (user) => {
  if (!user?.role) {
    return null;
  }

  return Role.findOne({
    key: String(user.role).toUpperCase(),
  }).select("key permissions dataScope isSystem");
};

/**
 * Central database-backed permission authorization.
 *
 * Example:
 *
 * router.get(
 *   "/",
 *   protect,
 *   authorizePermission("student.view"),
 *   handler
 * );
 *
 * SUPER_ADMIN is an explicit system-role bypass.
 *
 * Every other role must have the requested permission
 * in its database Role document.
 */
const authorizePermission = (requiredPermission, options = {}) => {
  const { requireBranch = false } = options;

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const normalizedPermission = String(requiredPermission || "").trim();

    if (!normalizedPermission) {
      return res.status(500).json({
        success: false,
        message: "Authorization configuration error",
      });
    }

    try {
      const roleKey = String(req.user.role || "").toUpperCase();

      /*
       * SUPER_ADMIN is the protected system role.
       *
       * Its permissions cannot accidentally remove
       * its system-level access.
       */
      if (roleKey === SUPER_ADMIN_ROLE) {
        if (requireBranch && !req.user.branch) {
          return res.status(403).json({
            success: false,
            message: "A branch is required for this resource",
          });
        }

        return next();
      }

      const role = await getRoleForUser(req.user);

      if (!role) {
        return res.status(403).json({
          success: false,
          message: "Your account role is not configured",
        });
      }

      const permissions = Array.isArray(role.permissions)
        ? role.permissions
        : [];

      if (!permissions.includes(normalizedPermission)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource",
        });
      }

      if (requireBranch && !req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "A branch is required for this resource",
        });
      }

      next();
    } catch (error) {
      console.error("Permission authorization error:", error);

      return res.status(500).json({
        success: false,
        message: "Authorization service unavailable",
      });
    }
  };
};

/**
 * Resolve effective permissions from the database.
 */
const getEffectivePermissions = async (user) => {
  if (!user?.role) {
    return [];
  }

  const role = await getRoleForUser(user);

  return Array.from(new Set(role?.permissions || []));
};

const getEffectiveRole = getRoleForUser;

module.exports = {
  authorizePermission,
  getEffectivePermissions,
  getEffectiveRole,
};

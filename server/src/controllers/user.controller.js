const mongoose = require("mongoose");

const User = require("../models/User");
const Branch = require("../models/Branch");
const Role = require("../models/Role");
const { validatePassword, sessionInvalidationTime } = require("../utils/passwordPolicy");
const { normalizePhone } = require("../utils/phone");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");

const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

const STUDENT_ROLE = "STUDENT";

const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const getRole = async (roleKey) => {
  return Role.findOne({
    key: String(roleKey || "")
      .trim()
      .toUpperCase(),
  });
};

const isStaffRole = (role) => Boolean(role && role.key !== STUDENT_ROLE);

const hasAllDataScope = (user) =>
  String(user?.role || "").toUpperCase() === SUPER_ADMIN_ROLE ||
  String(user?.dataScope || "BRANCH").toUpperCase() === "ALL";

const getUserBranchId = (user) => {
  if (!user?.branch) {
    return null;
  }

  return String(user.branch._id || user.branch);
};

const canManageUser = (actor, target) => {
  if (hasAllDataScope(actor)) {
    return true;
  }

  const actorBranchId = getUserBranchId(actor);
  const targetBranchId = getUserBranchId(target);

  return Boolean(actorBranchId && actorBranchId === targetBranchId);
};

const canAssignRoleAndBranch = (actor, role, branch) => {
  const isSuperAdmin =
    String(actor?.role || "").toUpperCase() === SUPER_ADMIN_ROLE;
  const actorPermissions = new Set(
    Array.isArray(actor?.permissions) ? actor.permissions : [],
  );
  const targetPermissions = Array.isArray(role?.permissions)
    ? role.permissions
    : [];

  if (
    !isSuperAdmin &&
    !targetPermissions.every((permission) => actorPermissions.has(permission))
  ) {
    return "You cannot assign a role with permissions your role does not have";
  }

  // The route already requires user.create or user.update. This helper
  // additionally enforces data-scope and permission-grant boundaries.
  if (hasAllDataScope(actor)) {
    return null;
  }

  const actorBranchId = getUserBranchId(actor);

  if (!actorBranchId) {
    return "Your account must be assigned to a branch to manage staff";
  }

  if (String(role.dataScope || "BRANCH").toUpperCase() !== "BRANCH") {
    return "Branch-scoped administrators can only assign branch-scoped roles";
  }

  if (!branch || String(branch._id || branch) !== actorBranchId) {
    return "You can only assign staff to your own branch";
  }

  return null;
};

/**
 * Validate a role assignment.
 *
 * SUPER_ADMIN can never be assigned through
 * Staff Management.
 */
const validateStaffRole = async (roleKey) => {
  const normalized = String(roleKey || "")
    .trim()
    .toUpperCase();

  const role = await getRole(normalized);

  if (!role) {
    return {
      error: "Selected role does not exist",
    };
  }

  if (normalized === SUPER_ADMIN_ROLE) {
    return {
      error: "A Super Admin cannot be assigned from Staff Management",
    };
  }

  if (normalized === STUDENT_ROLE) {
    return {
      error: "Student role cannot be assigned as a staff role",
    };
  }

  return {
    role,
  };
};

/**
 * Validate branch assignment against
 * the role's database data scope.
 */
const validateBranchForRole = async (role, branchId) => {
  if (role.dataScope === "BRANCH") {
    if (!branchId) {
      return {
        error: "A branch is required for this role",
      };
    }
  }

  if (!branchId) {
    return {
      branch: null,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    return {
      error: "Selected branch ID is invalid",
    };
  }

  const branch = await Branch.findById(branchId);

  if (!branch) {
    return {
      error: "Selected branch not found",
    };
  }

  if (branch.isActive === false) {
    return {
      error: "Selected branch is inactive",
    };
  }

  return {
    branch,
  };
};

/**
 * Get all staff users.
 *
 * Any database role except STUDENT is considered
 * a staff role.
 */
const getStaffUsers = async (req, res) => {
  try {
    const roles = await Role.find({
      key: {
        $ne: STUDENT_ROLE,
      },
    }).select("key");

    const roleKeys = roles.map((role) => role.key);

    const userFilter = {
      role: {
        $in: roleKeys,
      },
    };

    if (!hasAllDataScope(req.user)) {
      const branchId = getUserBranchId(req.user);

      if (!branchId) {
        return sendError(
          res,
          403,
          "Your account must be assigned to a branch to view staff",
        );
      }

      userFilter.branch = branchId;
    }

    const users =
      roleKeys.length > 0
        ? await User.find(userFilter)
            .populate("branch", "name address phone")
            .select("-password")
            .sort({
              createdAt: -1,
            })
        : [];

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get staff users error:", error);

    sendError(res, 500, "Server error");
  }
};

/**
 * Create staff user.
 */
const createStaffUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, branch } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return sendError(res, 400, "Name, email, phone, password and role are required");
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return sendError(res, 400, "Enter a valid phone number with its country code.");

    const passwordError = validatePassword(password);
    if (passwordError) return sendError(res, 400, passwordError);

    const roleResult = await validateStaffRole(role);

    if (roleResult.error) {
      return sendError(res, 400, roleResult.error);
    }

    const selectedRole = roleResult.role;

    const branchResult = await validateBranchForRole(selectedRole, branch);

    if (branchResult.error) {
      return sendError(res, 400, branchResult.error);
    }

    const assignmentError = canAssignRoleAndBranch(
      req.user,
      selectedRole,
      branchResult.branch,
    );

    if (assignmentError) {
      return sendError(res, 403, assignmentError);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return sendError(res, 409, "A user with this email already exists");
    }

    const hashedPassword = String(password);

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      role: selectedRole.key,
      branch: branchResult.branch ? branchResult.branch._id : null,
    });
    await auditService.record({ req, action: AUDIT_ACTIONS.USER_ROLE_CHANGED, entityType: "USER", entityId: user._id, branchId: user.branch, before: { role: null, branchId: null }, after: { role: user.role, branchId: user.branch }, metadata: { operation: "USER_CREATED" } });

    const populatedUser = await User.findById(user._id)
      .populate("branch", "name address phone")
      .select("-password");

    return res.status(201).json({
      success: true,
      message: "Staff user created successfully",
      user: populatedUser,
    });
  } catch (error) {
    console.error("Create staff user error:", error);

    sendError(res, 500, "Server error");
  }
};

/**
 * Update staff user.
 */
const updateStaffUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { name, email, phone, password, role, branch } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid staff user ID");
    }

    const user = await User.findById(id);

    if (!user) {
      return sendError(res, 404, "Staff user not found");
    }
    const priorRole = user.role;
    const priorBranch = user.branch ? String(user.branch) : null;
    const priorPasswordChangedAt = user.passwordChangedAt || null;

    /*
     * Existing SUPER_ADMIN accounts cannot be
     * edited through Staff Management.
     */
    if (user.role === SUPER_ADMIN_ROLE) {
      return sendError(res, 400, "Super Admin account cannot be edited here");
    }

    if (!canManageUser(req.user, user)) {
      return sendError(res, 403, "You can only manage staff in your own branch");
    }

    if (!name || !email || !phone || !role) {
      return sendError(res, 400, "Name, email, phone and role are required");
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return sendError(res, 400, "Enter a valid phone number with its country code.");

    const roleResult = await validateStaffRole(role);

    if (roleResult.error) {
      return sendError(res, 400, roleResult.error);
    }

    const selectedRole = roleResult.role;

    const branchResult = await validateBranchForRole(selectedRole, branch);

    if (branchResult.error) {
      return sendError(res, 400, branchResult.error);
    }

    const assignmentError = canAssignRoleAndBranch(
      req.user,
      selectedRole,
      branchResult.branch,
    );

    if (assignmentError) {
      return sendError(res, 403, assignmentError);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: {
        $ne: id,
      },
    });

    if (existingUser) {
      return sendError(res, 409, "A user with this email already exists");
    }

    user.name = String(name).trim();

    user.email = normalizedEmail;
    user.phone = normalizedPhone;

    user.role = selectedRole.key;

    user.branch = branchResult.branch ? branchResult.branch._id : null;

    /*
     * Password is optional during edit.
     */
    if (password && String(password).trim().length > 0) {
      const nextPassword = String(password);
      const passwordError = validatePassword(nextPassword);
      if (passwordError) return sendError(res, 400, passwordError);

      user.password = nextPassword;

      /*
       * Existing password-session invalidation
       * remains intact.
       */
      user.passwordChangedAt = sessionInvalidationTime();
      user.mustResetPassword = false;
    }

    await user.save();
    if (priorRole !== user.role) await auditService.record({ req, action: AUDIT_ACTIONS.USER_ROLE_CHANGED, entityType: "USER", entityId: user._id, branchId: user.branch || priorBranch, before: { role: priorRole }, after: { role: user.role } });
    const nextBranch = user.branch ? String(user.branch) : null;
    if (priorBranch !== nextBranch) await auditService.record({ req, action: AUDIT_ACTIONS.USER_BRANCH_CHANGED, entityType: "USER", entityId: user._id, branchId: nextBranch || priorBranch, before: { branchId: priorBranch }, after: { branchId: nextBranch } });
    if (password && String(password).trim()) {
      await auditService.record({ req, action: AUDIT_ACTIONS.PASSWORD_CHANGED, entityType: "USER", entityId: user._id, branchId: user.branch, before: { passwordChangedAt: priorPasswordChangedAt }, after: { passwordChangedAt: user.passwordChangedAt }, metadata: { changedByAdministrator: true, sessionsInvalidated: true } });
      await auditService.record({ req, action: AUDIT_ACTIONS.SESSION_INVALIDATED, entityType: "USER", entityId: user._id, branchId: user.branch, metadata: { reason: "ADMIN_PASSWORD_CHANGE" } });
    }

    const updatedUser = await User.findById(user._id)
      .populate("branch", "name address phone")
      .select("-password");

    return res.status(200).json({
      success: true,
      message: "Staff user updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update staff user error:", error);

    sendError(res, 500, "Server error");
  }
};

/**
 * Deactivate staff user.
 *
 * Historical data is preserved.
 */
const deleteStaffUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid staff user ID");
    }

    if (req.user._id.toString() === id) {
      return sendError(res, 400, "You cannot deactivate your own account");
    }

    const user = await User.findById(id);

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    if (user.role === SUPER_ADMIN_ROLE) {
      return sendError(
        res,
        400,
        "A Super Admin account cannot be deactivated here",
      );
    }

    if (!canManageUser(req.user, user)) {
      return sendError(res, 403, "You can only manage staff in your own branch");
    }

    const role = await getRole(user.role);

    if (!isStaffRole(role)) {
      return sendError(res, 400, "This account is not a staff account");
    }

    /*
     * Soft deactivation.
     *
     * Do NOT delete the user because historical
     * attendance, promotion, audit and other records
     * may reference this account.
     */
    user.isActive = false;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Staff user deactivated successfully",
      user: {
        _id: user._id,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Delete staff user error:", error);

    sendError(res, 500, "Server error");
  }
};

module.exports = {
  getStaffUsers,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
};

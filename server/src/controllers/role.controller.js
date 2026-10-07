const mongoose = require("mongoose");

const Role = require("../models/Role");
const User = require("../models/User");
const Module = require("../models/Module");

const {
  ALL_PERMISSIONS,
  PERMISSION_MODULE_KEYS,
} = require("../config/permissions");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");

const DATA_SCOPES = ["ALL", "BRANCH"];

const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

const SUPER_ADMIN_ROLE = "SUPER_ADMIN";


const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const toRoleKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    return null;
  }

  return Array.from(
    new Set(
      permissions
        .filter(
          (permission) =>
            typeof permission === "string" && permission.trim().length > 0,
        )
        .map((permission) => permission.trim()),
    ),
  );
};

const getInvalidPermissions = (permissions) => {
  return permissions.filter(
    (permission) => !ALL_PERMISSIONS.includes(permission),
  );
};

const actorCanGrantPermissions = (req, permissions) => {
  if (String(req.user?.role || "").toUpperCase() === SUPER_ADMIN_ROLE) {
    return true;
  }

  const actorPermissions = new Set(
    Array.isArray(req.user?.permissions) ? req.user.permissions : [],
  );

  return permissions.every((permission) => actorPermissions.has(permission));
};

const actorCanGrantScope = (req, dataScope) =>
  String(req.user?.role || "").toUpperCase() === SUPER_ADMIN_ROLE ||
  dataScope !== "ALL" ||
  String(req.user?.dataScope || "BRANCH").toUpperCase() === "ALL";

const getPermissionsWhoseModuleIsHidden = async (roleKey, permissions) => {
  if (String(roleKey).toUpperCase() === SUPER_ADMIN_ROLE) return [];

  const candidates = permissions.filter((permission) =>
    Object.prototype.hasOwnProperty.call(PERMISSION_MODULE_KEYS, permission),
  );
  if (!candidates.length) return [];

  const keys = [...new Set(candidates.map((p) => PERMISSION_MODULE_KEYS[p]))];
  const modules = await Module.find({
    $or: [
      { key: { $in: keys.filter((key) => key !== "website-homepage") } },
      { href: "/website/homepage" },
    ],
    isActive: { $ne: false },
  })
    .select("key href allowedRoles")
    .lean();

  return candidates.filter((permission) => {
    const moduleKey = PERMISSION_MODULE_KEYS[permission];
    const moduleDoc = moduleKey === "website-homepage"
      ? modules.find((item) => item.href === "/website/homepage")
      : modules.find((item) => item.key === moduleKey);
    if (!moduleDoc) return true; // Fail closed if the mapped module is missing.
    const allowedRoles = Array.isArray(moduleDoc.allowedRoles)
      ? moduleDoc.allowedRoles
      : [];
    return allowedRoles.length > 0 && !allowedRoles.includes(roleKey);
  });
};

const rejectPermissionsForHiddenModules = async (res, roleKey, permissions) => {
  const denied = await getPermissionsWhoseModuleIsHidden(roleKey, permissions);
  if (!denied.length) return false;
  sendError(
    res,
    403,
    `Enable the related sidebar module for ${roleKey} before granting: ${denied.join(", ")}`,
  );
  return true;
};

const withUserCount = async (role) => {
  const plain = role.toObject ? role.toObject() : role;

  return {
    ...plain,
    permissions: Array.isArray(plain.permissions) ? plain.permissions : [],
    userCount: await User.countDocuments({
      role: role.key,
    }),
  };
};

/**
 * GET /api/roles
 *
 * Super Admin only.
 */
const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({
      isSystem: -1,
      createdAt: 1,
      _id: 1,
    });

    const result = await Promise.all(roles.map(withUserCount));

    return res.status(200).json({
      success: true,
      count: result.length,
      roles: result,
    });
  } catch (error) {
    console.error("Get roles error:", error);

    return sendError(res, 500, "Server error");
  }
};

/**
 * GET /api/roles/permissions
 *
 * Returns the canonical permission catalog.
 */
const getPermissions = async (req, res) => {
  return res.status(200).json({
    success: true,
    permissions: ALL_PERMISSIONS,
  });
};

/**
 * POST /api/roles
 *
 * Body:
 * {
 *   name,
 *   description?,
 *   dataScope?,
 *   permissions?
 * }
 */
const createRole = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();

    const description = String(req.body.description || "").trim();

    const dataScope = req.body.dataScope || "BRANCH";

    if (!name) {
      return sendError(res, 400, "Role name is required");
    }

    if (name.length > 40) {
      return sendError(res, 400, "Role name must be 40 characters or less");
    }

    if (!DATA_SCOPES.includes(dataScope)) {
      return sendError(res, 400, "Invalid data scope");
    }

    if (!actorCanGrantScope(req, dataScope)) {
      return sendError(
        res,
        403,
        "You cannot grant a broader data scope than your own",
      );
    }


    const key = toRoleKey(name);

    if (!KEY_PATTERN.test(key)) {
      return sendError(res, 400, "Role name must start with a letter");
    }

    /*
     * A custom role must never be able to become
     * the SUPER_ADMIN role through key manipulation.
     */
    if (key === SUPER_ADMIN_ROLE) {
      return sendError(res, 400, "SUPER_ADMIN is a protected system role");
    }

    let permissions = [];

    if (req.body.permissions !== undefined) {
      permissions = normalizePermissions(req.body.permissions);

      if (!permissions) {
        return sendError(res, 400, "Permissions must be an array");
      }

      const invalid = getInvalidPermissions(permissions);

      if (invalid.length > 0) {
        return sendError(
          res,
          400,
          `Invalid permissions: ${invalid.join(", ")}`,
        );
      }

      if (!actorCanGrantPermissions(req, permissions)) {
        return sendError(
          res,
          403,
          "You cannot grant permissions that your role does not have",
        );
      }

      if (await rejectPermissionsForHiddenModules(res, key, permissions)) return;

    }

    const existing = await Role.findOne({
      key,
    });

    if (existing) {
      return sendError(res, 409, "A role with a similar name already exists");
    }

    const created = await Role.create({
      key,
      name,
      description,
      dataScope,
      permissions,
      permissionsVersion: 1,
      isSystem: false,
    });
    await auditService.record({ req, action: AUDIT_ACTIONS.ROLE_CREATED, entityType: "ROLE", entityId: created._id, branchId: req.user.branch, after: { key: created.key, name: created.name, dataScope: created.dataScope, permissions: created.permissions } });

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      role: await withUserCount(created),
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, "A role with a similar name already exists");
    }

    if (error.name === "ValidationError") {
      return sendError(res, 400, process.env.NODE_ENV === "production" ? "Invalid role data." : error.message);
    }

    console.error("Create role error:", error);

    return sendError(res, 500, "Server error");
  }
};

/**
 * PUT /api/roles/:id
 *
 * Custom roles:
 * - name
 * - description
 * - dataScope
 * - permissions
 *
 * Built-in roles may have their permission sets configured, but their
 * identity and data scope remain protected. SUPER_ADMIN remains immutable.
 */
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid role id");
    }

    const role = await Role.findById(id);

    if (!role) {
      return sendError(res, 404, "Role not found");
    }

    const { name, description, dataScope, permissions } = req.body;

    const changesAuthorization =
      dataScope !== undefined || permissions !== undefined;

    if (
      changesAuthorization &&
      !actorCanGrantScope(req, dataScope || role.dataScope)
    ) {
      return sendError(
        res,
        403,
        "You cannot change authorization for a role with broader data scope than your own",
      );
    }
    const auditBefore = { key: role.key, name: role.name, dataScope: role.dataScope, permissions: [...(role.permissions || [])] };

    if (
      changesAuthorization &&
      String(req.user?.role || "").toUpperCase() !== SUPER_ADMIN_ROLE &&
      String(req.user?.dataScope || "BRANCH").toUpperCase() !== "ALL"
    ) {
      if (!req.user?.branch) {
        return sendError(
          res,
          403,
          "Your account must have a branch to manage branch-scoped roles",
        );
      }

      const roleUsedOutsideBranch = await User.exists({
        role: role.key,
        branch: { $ne: req.user.branch },
      });

      if (roleUsedOutsideBranch) {
        return sendError(
          res,
          403,
          "You cannot change permissions for a role assigned outside your branch",
        );
      }
    }

    if (role.key === SUPER_ADMIN_ROLE) {
      /*
       * SUPER_ADMIN remains fully privileged.
       * Do not allow its permissions to be edited.
       */
      if (permissions !== undefined) {
        return sendError(
          res,
          400,
          "SUPER_ADMIN permissions cannot be modified",
        );
      }
    }

    if (name !== undefined) {
      const trimmed = String(name).trim();

      if (!trimmed || trimmed.length > 40) {
        return sendError(
          res,
          400,
          "Role name is required (40 characters or less)",
        );
      }

      const nextKey = toRoleKey(trimmed);

      if (!KEY_PATTERN.test(nextKey)) {
        return sendError(res, 400, "Role name must start with a letter");
      }

      if (nextKey !== role.key) {
        const collision = await Role.findOne({
          key: nextKey,
          _id: {
            $ne: role._id,
          },
        });

        if (collision) {
          return sendError(
            res,
            409,
            "A role with a similar name already exists",
          );
        }

        /*
         * Do not rename role keys once users depend on them.
         * The role key is the stable identity stored in User.role.
         */
        return sendError(
          res,
          400,
          "A role's stable key cannot be changed after creation",
        );
      }

      role.name = trimmed;
    }

    if (description !== undefined) {
      role.description = String(description).trim().slice(0, 200);
    }

    if (dataScope !== undefined && dataScope !== role.dataScope) {
      if (role.isSystem) {
        return sendError(
          res,
          400,
          "The data scope of a built-in role cannot be changed",
        );
      }

      if (!DATA_SCOPES.includes(dataScope)) {
        return sendError(res, 400, "Invalid data scope");
      }

      if (!actorCanGrantScope(req, dataScope)) {
        return sendError(
          res,
          403,
          "You cannot grant a broader data scope than your own",
        );
      }


      /*
       * BRANCH roles require every assigned user
       * to have a branch.
       */
      if (dataScope === "BRANCH") {
        const withoutBranch = await User.countDocuments({
          role: role.key,
          branch: null,
          isActive: {
            $ne: false,
          },
        });

        if (withoutBranch > 0) {
          return sendError(
            res,
            409,
            `${withoutBranch} user(s) with this role have no branch. Assign a branch to them first.`,
          );
        }
      }

      role.dataScope = dataScope;
    }

    if (permissions !== undefined) {
      const normalized = normalizePermissions(permissions);

      if (!normalized) {
        return sendError(res, 400, "Permissions must be an array");
      }

      const invalid = getInvalidPermissions(normalized);

      if (invalid.length > 0) {
        return sendError(
          res,
          400,
          `Invalid permissions: ${invalid.join(", ")}`,
        );
      }


      /*
       * Only known catalog permissions are changed.
       *
       * Unknown legacy permissions are preserved so an
       * older permission value is never silently deleted.
       */
      const existingUnknown = Array.isArray(role.permissions)
        ? role.permissions.filter(
            (permission) => !ALL_PERMISSIONS.includes(permission),
          )
        : [];

      const resultingPermissions = Array.from(
        new Set([...normalized, ...existingUnknown]),
      );

      if (!actorCanGrantPermissions(req, resultingPermissions)) {
        return sendError(
          res,
          403,
          "You cannot grant permissions that your role does not have",
        );
      }

      // Enforce the visibility rule only for newly added grants. Existing
      // hidden-module grants are grandfathered so admins can still edit or
      // remove them without an unrelated save failing.
      const newlyGranted = normalized.filter(
        (permission) => !role.permissions?.includes(permission),
      );
      if (await rejectPermissionsForHiddenModules(res, role.key, newlyGranted)) return;

      role.permissions = resultingPermissions;
    }

    await role.save();

    const auditAfter = { key: role.key, name: role.name, dataScope: role.dataScope, permissions: [...(role.permissions || [])] };
    await auditService.record({ req, action: AUDIT_ACTIONS.ROLE_UPDATED, entityType: "ROLE", entityId: role._id, branchId: req.user.branch, before: auditBefore, after: auditAfter });
    const previous = new Set(auditBefore.permissions); const next = new Set(auditAfter.permissions);
    for (const permission of next) if (!previous.has(permission) && ALL_PERMISSIONS.includes(permission)) await auditService.record({ req, action: AUDIT_ACTIONS.PERMISSION_ASSIGNED, entityType: "ROLE", entityId: role._id, branchId: req.user.branch, before: { permission, assigned: false }, after: { permission, assigned: true } });
    for (const permission of previous) if (!next.has(permission) && ALL_PERMISSIONS.includes(permission)) await auditService.record({ req, action: AUDIT_ACTIONS.PERMISSION_REVOKED, entityType: "ROLE", entityId: role._id, branchId: req.user.branch, before: { permission, assigned: true }, after: { permission, assigned: false } });

    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      role: await withUserCount(role),
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, "A role with a similar name already exists");
    }

    console.error("Update role error:", error);

    return sendError(res, 500, "Server error");
  }
};

/**
 * DELETE /api/roles/:id
 */
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid role id");
    }

    const role = await Role.findById(id);

    if (!role) {
      return sendError(res, 404, "Role not found");
    }

    if (role.isSystem) {
      return sendError(res, 400, "Built-in roles cannot be deleted");
    }

    const userCount = await User.countDocuments({
      role: role.key,
    });

    if (userCount > 0) {
      return sendError(
        res,
        409,
        `${userCount} user(s) still use this role. Change their role first.`,
      );
    }

    await Role.findByIdAndDelete(id);
    await auditService.record({ req, action: AUDIT_ACTIONS.ROLE_DELETED, entityType: "ROLE", entityId: role._id, branchId: req.user.branch, before: { key: role.key, name: role.name, dataScope: role.dataScope, permissions: role.permissions } });

    /*
     * Keep existing module configuration consistent.
     */
    await Module.updateMany(
      {},
      {
        $pull: {
          allowedRoles: role.key,
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    console.error("Delete role error:", error);

    return sendError(res, 500, "Server error");
  }
};

module.exports = {
  getRoles,
  getPermissions,
  createRole,
  updateRole,
  deleteRole,
};

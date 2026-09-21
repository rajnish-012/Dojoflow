const mongoose = require("mongoose");

const Role = require("../models/Role");
const User = require("../models/User");
const Module = require("../models/Module");

const DATA_SCOPES = ["ALL", "BRANCH"];
const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

// "Front Desk" -> "FRONT_DESK"
const toRoleKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const withUserCount = async (role) => {
  const plain = role.toObject ? role.toObject() : role;

  return {
    ...plain,
    userCount: await User.countDocuments({ role: role.key }),
  };
};

/**
 * GET /api/roles
 */
const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({
      isSystem: -1,
      createdAt: 1,
      _id: 1,
    });

    const result = await Promise.all(roles.map(withUserCount));

    res.status(200).json({
      success: true,
      count: result.length,
      roles: result,
    });
  } catch (error) {
    console.error("Get roles error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * POST /api/roles
 * Body: { name, description?, dataScope? }
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
      return sendError(
        res,
        400,
        "Role name must be 40 characters or less"
      );
    }

    if (!DATA_SCOPES.includes(dataScope)) {
      return sendError(res, 400, "Invalid data scope");
    }

    const key = toRoleKey(name);

    if (!KEY_PATTERN.test(key)) {
      return sendError(
        res,
        400,
        "Role name must start with a letter"
      );
    }

    const created = await Role.create({
      key,
      name,
      description,
      dataScope,
      isSystem: false,
    });

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      role: await withUserCount(created),
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "A role with a similar name already exists"
      );
    }

    if (error.name === "ValidationError") {
      return sendError(res, 400, error.message);
    }

    console.error("Create role error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * PUT /api/roles/:id
 * Built-in roles: only name and description can change.
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

    const { name, description, dataScope } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();

      if (!trimmed || trimmed.length > 40) {
        return sendError(
          res,
          400,
          "Role name is required (40 characters or less)"
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
          "The data scope of a built-in role cannot be changed"
        );
      }

      if (!DATA_SCOPES.includes(dataScope)) {
        return sendError(res, 400, "Invalid data scope");
      }

      // Users of a branch-only role must have a branch.
      if (dataScope === "BRANCH") {
        const withoutBranch = await User.countDocuments({
          role: role.key,
          branch: null,
        });

        if (withoutBranch > 0) {
          return sendError(
            res,
            409,
            `${withoutBranch} user(s) with this role have no branch. Assign a branch to them first.`
          );
        }
      }

      role.dataScope = dataScope;
    }

    await role.save();

    res.status(200).json({
      success: true,
      message: "Role updated successfully",
      role: await withUserCount(role),
    });
  } catch (error) {
    console.error("Update role error:", error);
    sendError(res, 500, "Server error");
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
      return sendError(
        res,
        400,
        "Built-in roles cannot be deleted"
      );
    }

    const userCount = await User.countDocuments({ role: role.key });

    if (userCount > 0) {
      return sendError(
        res,
        409,
        `${userCount} user(s) still use this role. Change their role first.`
      );
    }

    await Role.findByIdAndDelete(id);

    // Remove the role from every module's "Visible to" list.
    await Module.updateMany(
      {},
      { $pull: { allowedRoles: role.key } }
    );

    res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    console.error("Delete role error:", error);
    sendError(res, 500, "Server error");
  }
};

module.exports = {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
};
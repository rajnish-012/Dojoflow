const mongoose = require("mongoose");

const Module = require("../models/Module");

const ROLE_KEY_PATTERN = /^[A-Z0-9_]+$/;
const HREF_PATTERN = /^\/[a-zA-Z0-9\-_/]*$/;
const KEY_PATTERN = /^[a-z0-9-]+$/;

// These modules hold the management pages themselves.
// Super Admin must always keep access to them.
const LOCKED_MODULE_KEYS = ["modules", "roles"];

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

const normalizeHref = (value) => {
  const href = String(value || "").trim();

  if (href.length > 1 && href.endsWith("/")) {
    return href.slice(0, -1);
  }

  return href;
};

const normalizeRoles = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const roles = value.map((role) => String(role).trim().toUpperCase());

  if (!roles.every((role) => ROLE_KEY_PATTERN.test(role))) {
    return null;
  }

  return [...new Set(roles)];
};

/**
 * GET /api/modules/navigation
 * Modules the logged-in user can see in the sidebar.
 */
const getMyNavigation = async (req, res) => {
  try {
    const modules = await Module.find({
      isActive: true,
      allowedRoles: req.user.role,
    })
      .sort({ order: 1, label: 1 })
      .select("key label href icon order");

    res.status(200).json({
      success: true,
      modules,
    });
  } catch (error) {
    console.error("Get navigation error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * GET /api/modules
 * Every module (Super Admin only).
 */
const getModules = async (req, res) => {
  try {
    const modules = await Module.find().sort({
      order: 1,
      label: 1,
    });

    res.status(200).json({
      success: true,
      count: modules.length,
      modules,
    });
  } catch (error) {
    console.error("Get modules error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * POST /api/modules
 */
const createModule = async (req, res) => {
  try {
    const { key, label, icon, order } = req.body;

    const href = normalizeHref(req.body.href);
    const allowedRoles = normalizeRoles(req.body.allowedRoles ?? []);

    if (!key || !label || !href) {
      return sendError(res, 400, "Key, label and route are required");
    }

    if (!KEY_PATTERN.test(String(key).trim().toLowerCase())) {
      return sendError(
        res,
        400,
        "Key can only contain lowercase letters, numbers and hyphens",
      );
    }

    if (!HREF_PATTERN.test(href) || href === "/") {
      return sendError(
        res,
        400,
        "Route must start with / and use letters, numbers, - or _ (example: /reports)",
      );
    }

    if (allowedRoles === null) {
      return sendError(res, 400, "Invalid roles list");
    }

    let nextOrder = Number(order);

    if (!Number.isFinite(nextOrder)) {
      const last = await Module.findOne().sort({ order: -1 });
      nextOrder = last ? last.order + 10 : 10;
    }

    const created = await Module.create({
      key: String(key).trim().toLowerCase(),
      label: String(label).trim(),
      href,
      icon: icon ? String(icon).trim() : undefined,
      order: nextOrder,
      allowedRoles,
      isActive: true,
      isSystem: false,
    });

    res.status(201).json({
      success: true,
      message: "Module created successfully",
      module: created,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "A module with this key or route already exists",
      );
    }

    if (error.name === "ValidationError") {
      return sendError(res, 400, error.message);
    }

    console.error("Create module error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * PUT /api/modules/:id
 */
const updateModule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid module id");
    }

    const moduleDoc = await Module.findById(id);

    if (!moduleDoc) {
      return sendError(res, 404, "Module not found");
    }

    const { label, icon, order, isActive } = req.body;

    if (label !== undefined) {
      const trimmed = String(label).trim();

      if (!trimmed) {
        return sendError(res, 400, "Label cannot be empty");
      }

      moduleDoc.label = trimmed;
    }

    if (icon !== undefined) {
      moduleDoc.icon = String(icon).trim() || "LayoutDashboard";
    }

    if (order !== undefined) {
      const nextOrder = Number(order);

      if (!Number.isFinite(nextOrder)) {
        return sendError(res, 400, "Order must be a number");
      }

      moduleDoc.order = nextOrder;
    }

    // The route of a system module is tied to real pages in the app.
    if (req.body.href !== undefined) {
      const href = normalizeHref(req.body.href);

      if (href !== moduleDoc.href) {
        if (moduleDoc.isSystem) {
          return sendError(
            res,
            400,
            "The route of a system module cannot be changed",
          );
        }

        if (!HREF_PATTERN.test(href) || href === "/") {
          return sendError(
            res,
            400,
            "Route must start with / and use letters, numbers, - or _",
          );
        }

        moduleDoc.href = href;
      }
    }

    if (req.body.allowedRoles !== undefined) {
      const roles = normalizeRoles(req.body.allowedRoles);

      if (roles === null) {
        return sendError(res, 400, "Invalid roles list");
      }

      if (
        LOCKED_MODULE_KEYS.includes(moduleDoc.key) &&
        !roles.includes("SUPER_ADMIN")
      ) {
        roles.push("SUPER_ADMIN");
      }

      moduleDoc.allowedRoles = roles;
    }

    if (isActive !== undefined) {
      if (moduleDoc.isSystem && isActive === false) {
        return sendError(res, 400, "System modules cannot be deactivated");
      }

      moduleDoc.isActive = Boolean(isActive);
    }

    await moduleDoc.save();

    res.status(200).json({
      success: true,
      message: "Module updated successfully",
      module: moduleDoc,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, "Another module already uses this route");
    }

    console.error("Update module error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * DELETE /api/modules/:id
 */
const deleteModule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid module id");
    }

    const moduleDoc = await Module.findById(id);

    if (!moduleDoc) {
      return sendError(res, 404, "Module not found");
    }

    if (moduleDoc.isSystem) {
      return sendError(res, 400, "System modules cannot be deleted");
    }

    await Module.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Module deleted successfully",
    });
  } catch (error) {
    console.error("Delete module error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * PUT /api/modules/reorder
 * Body: { items: [{ id, order }] }
 */
const reorderModules = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 400, "Items are required");
    }

    const valid = items.every(
      (item) =>
        mongoose.isValidObjectId(item?.id) &&
        Number.isFinite(Number(item?.order)),
    );

    if (!valid) {
      return sendError(res, 400, "Invalid reorder data");
    }

    await Module.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { order: Number(item.order) } },
        },
      })),
    );

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
    });
  } catch (error) {
    console.error("Reorder modules error:", error);
    sendError(res, 500, "Server error");
  }
};

module.exports = {
  getMyNavigation,
  getModules,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
};

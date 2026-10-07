const mongoose = require("mongoose");

const Module = require("../models/Module");
const { ALL_PERMISSIONS } = require("../config/permissions");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");

/*
 * =========================================================
 * VALIDATION PATTERNS
 * =========================================================
 */

const ROLE_KEY_PATTERN = /^[A-Z0-9_]+$/;

const HREF_PATTERN = /^\/[a-zA-Z0-9\-_\/]*$/;

const KEY_PATTERN = /^[a-z0-9-]+$/;
/*
 * =========================================================
 * SYSTEM MODULES
 * =========================================================
 */

const LOCKED_MODULE_KEYS = ["modules", "roles"];

/*
 * =========================================================
 * MODULE -> PERMISSION MAP
 * =========================================================
 *
 * These are the standard ForceStrike navigation modules.
 *
 * Authorization is ultimately based on:
 *
 * User
 *   -> Role
 *      -> Role.permissions
 *
 * and then:
 *
 * Module.requiredPermission
 */
const MODULE_PERMISSIONS = Object.freeze({
  dashboard: "dashboard.view",

  students: "student.view",

  memberships: "membership.view",

  plans: "plan.view",

  curriculum: "curriculum.view",

  attendance: "attendance.view",

  holidays: "holiday.view",

  performance: "performance.view",

  makeups: "makeup.view",

  promotions: "promotion.view",

  reports: "report.view",

  fees: "finance.view",

  inquiries: "inquiry.view",

  notifications: "notification.view",

  notification: "notification.view",

  branches: "branch.view",

  "branch-schedules": "branch_schedule.view",

  settings: "settings.view",

  "settings-branding": "settings.view",

  "settings-staff": "user.view",

  "settings-maintenance": "maintenance.view",

  "settings-email": "settings.manage",

  "website-homepage": "website.view",

  roles: "role.view",

  modules: "module.view",

  // Viewing the page is distinct from managing assignments.
  "coach-assignments": "coach_assignment.view",
});

const STUDENT_DASHBOARD_KEY = "student-dashboard";

/*
 * =========================================================
 * RESPONSE HELPERS
 * =========================================================
 */

const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

/*
 * =========================================================
 * NORMALIZATION
 * =========================================================
 */

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

const normalizePermission = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const permission = String(value).trim();

  return permission || null;
};

const normalizeGroup = (value) => {
  if (value === null || value === undefined) return null;
  const group = String(value).trim();
  return group || undefined;
};

/*
 * =========================================================
 * USER AUTH HELPERS
 * =========================================================
 */

const getRoleKey = (req) =>
  String(req.user?.role || "")
    .trim()
    .toUpperCase();

const isSuperAdmin = (req) => getRoleKey(req) === "SUPER_ADMIN";

const getUserPermissions = (req) => {
  if (!Array.isArray(req.user?.permissions)) {
    return [];
  }

  return Array.from(
    new Set(
      req.user.permissions
        .filter(
          (permission) =>
            typeof permission === "string" && permission.trim().length > 0,
        )
        .map((permission) => permission.trim()),
    ),
  );
};

/*
 * =========================================================
 * REQUIRED PERMISSION RESOLUTION
 * =========================================================
 */

const getModuleRequiredPermission = (moduleDoc) => {
  /*
   * First preference:
   *
   * Explicit permission stored on the module.
   */
  const explicitPermission =
    typeof moduleDoc?.requiredPermission === "string"
      ? moduleDoc.requiredPermission.trim()
      : "";

  if (explicitPermission) {
    return explicitPermission;
  }

  /*
   * Backward-compatible fallback:
   *
   * Existing modules created before requiredPermission was
   * introduced can still resolve their permission from the
   * standard module key.
   */
  const key = String(moduleDoc?.key || "")
    .trim()
    .toLowerCase();

  return MODULE_PERMISSIONS[key] || null;
};

/*
 * =========================================================
 * MODULE ACCESS
 * =========================================================
 */

const canAccessModule = (req, moduleDoc) => {
  /*
   * SUPER_ADMIN is a protected system role.
   *
   * Its access must never depend on editable Role.permissions
   * or Module.allowedRoles.
   */
  if (isSuperAdmin(req)) {
    return moduleDoc?.key !== STUDENT_DASHBOARD_KEY;
  }

  /*
   * Student dashboard is intentionally separate.
   */
  if (moduleDoc?.key === STUDENT_DASHBOARD_KEY) {
    return getRoleKey(req) === "STUDENT";
  }

  /*
   * Student users must not receive admin modules.
   */
  if (getRoleKey(req) === "STUDENT") {
    return false;
  }

  // allowedRoles controls sidebar visibility as configured in the Modules UI.
  // An empty list means all roles; permissions still remain independently
  // required below for standard modules.
  const allowedRoles = Array.isArray(moduleDoc?.allowedRoles)
    ? moduleDoc.allowedRoles
    : [];
  if (allowedRoles.length > 0 && !allowedRoles.includes(getRoleKey(req))) {
    return false;
  }

  /*
   * The Settings section contains branding, staff, maintenance, and email pages.
   * Allow users who can access any one of those sections to reach its
   * shared route base; each page and API keeps its own permission checks.
   */
  if (
    moduleDoc?.key === "settings" &&
    getModuleRequiredPermission(moduleDoc) === "settings.view"
  ) {
    const permissions = getUserPermissions(req);
    return (
      permissions.includes("settings.view") ||
      permissions.includes("settings.manage") ||
      permissions.includes("user.view") ||
      permissions.includes("maintenance.view")
    );
  }

  const requiredPermission = getModuleRequiredPermission(moduleDoc);

  /*
   * Fail closed if a module has no permission mapping.
   */
  if (!requiredPermission) {
    return false;
  }

  return getUserPermissions(req).includes(requiredPermission);
};

/*
 * =========================================================
 * REPAIR / MIGRATION
 * =========================================================
 *
 * Existing installations may have modules created before
 * requiredPermission was introduced.
 *
 * We do NOT overwrite custom configuration.
 *
 * We only add the correct permission when the field is
 * missing.
 */
const ensureModulePermission = async (moduleDoc) => {
  if (!moduleDoc || moduleDoc.requiredPermission) {
    return moduleDoc;
  }

  const permission = MODULE_PERMISSIONS[moduleDoc.key];

  if (!permission) {
    return moduleDoc;
  }

  moduleDoc.requiredPermission = permission;

  await moduleDoc.save();

  return moduleDoc;
};

/*
 * =========================================================
 * GET /api/modules/navigation
 * =========================================================
 *
 * Modules visible to the authenticated user.
 *
 * Sidebar visibility requires both the configured role visibility and the
 * user's required permission. Page/API access remains permission-enforced by
 * each route.
 */
const getMyNavigation = async (req, res) => {
  try {
    const modules = await Module.find({
      isActive: true,
    })
      .sort({
        order: 1,
        label: 1,
      })
      .select("key label href icon order requiredPermission allowedRoles group")
      .lean();

    const visibleModules = modules.filter((moduleDoc) =>
      canAccessModule(req, moduleDoc),
    );

    res.status(200).json({
      success: true,
      modules: visibleModules,
    });
  } catch (error) {
    console.error("Get navigation error:", error);

    sendError(res, 500, "Server error");
  }
};

/*
 * =========================================================
 * GET /api/modules
 * =========================================================
 *
 * All modules.
 *
 * Route-level authorization is handled by the module route
 * middleware.
 */
const getModules = async (req, res) => {
  try {
    const modules = await Module.find()
      .sort({
        order: 1,
        label: 1,
      })
      .lean();

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

/*
 * =========================================================
 * POST /api/modules
 * =========================================================
 */

const createModule = async (req, res) => {
  try {
    const { key, label, icon, order } = req.body;

    const href = normalizeHref(req.body.href);

    const allowedRoles = normalizeRoles(req.body.allowedRoles ?? []);

    let requiredPermission = normalizePermission(req.body.requiredPermission);
    const group = normalizeGroup(req.body.group);

    if (!key || !label || !href) {
      return sendError(res, 400, "Key, label and route are required");
    }

    const normalizedKey = String(key).trim().toLowerCase();

    if (!KEY_PATTERN.test(normalizedKey)) {
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

    if (!group) {
      return sendError(res, 400, "Sidebar section is required");
    }

    if (requiredPermission && !ALL_PERMISSIONS.includes(requiredPermission)) {
      return sendError(
        res,
        400,
        "requiredPermission must exist in the permission catalog",
      );
    }

    /*
     * Automatically assign the standard permission for
     * known ForceStrike modules.
     */
    if (!requiredPermission && MODULE_PERMISSIONS[normalizedKey]) {
      requiredPermission = MODULE_PERMISSIONS[normalizedKey];
    }

    /*
     * Every custom admin module needs a permission.
     *
     * Student dashboard is the only exception.
     */
    if (!requiredPermission && normalizedKey !== STUDENT_DASHBOARD_KEY) {
      return sendError(
        res,
        400,
        "A requiredPermission is required for custom modules",
      );
    }

    let nextOrder = Number(order);

    if (!Number.isFinite(nextOrder)) {
      const last = await Module.findOne().sort({
        order: -1,
      });

      nextOrder = last ? last.order + 10 : 10;
    }

    const moduleData = {
      key: normalizedKey,

      label: String(label).trim(),

      href,

      icon: icon ? String(icon).trim() : undefined,

      order: nextOrder,

      requiredPermission,

      group,

      allowedRoles,

      isActive: true,

      isSystem: false,
    };

    const created = await Module.create(moduleData);
    await auditService.record({ req, action: AUDIT_ACTIONS.MODULE_CREATED, entityType: "MODULE", entityId: created._id, after: { key: created.key, label: created.label, href: created.href, requiredPermission: created.requiredPermission, group: created.group, allowedRoles: created.allowedRoles } });

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
      return sendError(res, 400, process.env.NODE_ENV === "production" ? "Invalid module data." : error.message);
    }

    console.error("Create module error:", error);

    sendError(res, 500, "Server error");
  }
};

/*
 * =========================================================
 * PUT /api/modules/:id
 * =========================================================
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

    /*
     * System module routes cannot be changed.
     */
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

    /*
     * requiredPermission is now the primary module
     * authorization configuration.
     */
    if (req.body.requiredPermission !== undefined) {
      const permission = normalizePermission(req.body.requiredPermission);

      if (!permission && moduleDoc.key !== STUDENT_DASHBOARD_KEY) {
        return sendError(res, 400, "requiredPermission cannot be empty");
      }

      if (permission && !ALL_PERMISSIONS.includes(permission)) {
        return sendError(
          res,
          400,
          "requiredPermission must exist in the permission catalog",
        );
      }

      moduleDoc.requiredPermission = permission;
    }
    const auditBefore = { label: moduleDoc.label, href: moduleDoc.href, isActive: moduleDoc.isActive, requiredPermission: moduleDoc.requiredPermission, group: moduleDoc.group, allowedRoles: moduleDoc.allowedRoles };

    if (req.body.group !== undefined) {
      const group = normalizeGroup(req.body.group);
      if (!group) {
        return sendError(res, 400, "Sidebar section cannot be empty");
      }
      moduleDoc.group = group;
    }

    /*
     * If this is a standard module and no explicit
     * permission was supplied, restore its standard
     * permission mapping.
     */
    if (!moduleDoc.requiredPermission && MODULE_PERMISSIONS[moduleDoc.key]) {
      moduleDoc.requiredPermission = MODULE_PERMISSIONS[moduleDoc.key];
    }

    /*
     * Keep allowedRoles for backward compatibility.
     *
     * It is NOT used by getMyNavigation().
     */
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

    /*
     * System modules cannot be deactivated.
     */
    if (isActive !== undefined) {
      if (moduleDoc.isSystem && isActive === false) {
        return sendError(res, 400, "System modules cannot be deactivated");
      }

      moduleDoc.isActive = Boolean(isActive);
    }

    /*
     * Roles and Modules are protected management
     * modules.
     */
    if (LOCKED_MODULE_KEYS.includes(moduleDoc.key)) {
      const roles = Array.isArray(moduleDoc.allowedRoles)
        ? moduleDoc.allowedRoles
        : [];

      if (!roles.includes("SUPER_ADMIN")) {
        roles.push("SUPER_ADMIN");
      }

      moduleDoc.allowedRoles = roles;
    }

    await moduleDoc.save();
    const auditAfter = { label: moduleDoc.label, href: moduleDoc.href, isActive: moduleDoc.isActive, requiredPermission: moduleDoc.requiredPermission, group: moduleDoc.group, allowedRoles: moduleDoc.allowedRoles };
    if (JSON.stringify(auditBefore) !== JSON.stringify(auditAfter)) await auditService.record({ req, action: AUDIT_ACTIONS.MODULE_UPDATED, entityType: "MODULE", entityId: moduleDoc._id, before: auditBefore, after: auditAfter });

    res.status(200).json({
      success: true,
      message: "Module updated successfully",
      module: moduleDoc,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, "Another module already uses this route");
    }

    if (error.name === "ValidationError") {
      return sendError(res, 400, error.message);
    }

    console.error("Update module error:", error);

    sendError(res, 500, "Server error");
  }
};

/*
 * =========================================================
 * DELETE /api/modules/:id
 * =========================================================
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
    await auditService.record({ req, action: AUDIT_ACTIONS.MODULE_DELETED, entityType: "MODULE", entityId: moduleDoc._id, before: { key: moduleDoc.key, label: moduleDoc.label, href: moduleDoc.href, requiredPermission: moduleDoc.requiredPermission, group: moduleDoc.group, allowedRoles: moduleDoc.allowedRoles } });

    res.status(200).json({
      success: true,
      message: "Module deleted successfully",
    });
  } catch (error) {
    console.error("Delete module error:", error);

    sendError(res, 500, "Server error");
  }
};

/*
 * =========================================================
 * PUT /api/modules/reorder
 * =========================================================
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

    const previousModules = await Module.find({ _id: { $in: items.map((item) => item.id) } }).select("_id key order group").lean();
    const previousById = new Map(previousModules.map((item) => [String(item._id), item]));
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Module.bulkWrite(items.map((item) => ({ updateOne: { filter: { _id: item.id }, update: { $set: { order: Number(item.order) } } } })), { session });
        for (const item of items) {
          const previous = previousById.get(String(item.id));
          if (previous && Number(previous.order) !== Number(item.order)) await auditService.record({ req, session, action: AUDIT_ACTIONS.MODULE_UPDATED, entityType: "MODULE", entityId: item.id, before: { key: previous.key, order: previous.order, group: previous.group }, after: { key: previous.key, order: Number(item.order), group: previous.group }, metadata: { change: "SIDEBAR_ORDER" } });
        }
      });
    } finally { await session.endSession(); }

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

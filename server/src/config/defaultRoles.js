const Role = require("../models/Role");

const {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
} = require("./permissions");

const PERMISSIONS_VERSION = 5;

const DEFAULT_ROLES = [
  {
    key: "SUPER_ADMIN",
    name: "Super Admin",
    description: "Full access to every branch and setting.",
    dataScope: "ALL",
    isSystem: true,
  },

  {
    key: "BRANCH_ADMIN",
    name: "Branch Admin",
    description: "Manages one branch.",
    dataScope: "BRANCH",
    isSystem: true,
  },

  {
    key: "COACH",
    name: "Coach",
    description: "Trains students of one branch.",
    dataScope: "BRANCH",
    isSystem: true,
  },

  {
    key: "STUDENT",
    name: "Student",
    description: "Student and parent login.",
    dataScope: "BRANCH",
    isSystem: true,
  },
];

/**
 * Ensure built-in roles exist and have their initial
 * database-backed permission set.
 *
 * IMPORTANT:
 * - Missing roles are created.
 * - Existing roles and explicit permissions are preserved, except for the
 *   one-time additive migration from shared permissions to new feature scopes.
 * - Custom roles are never touched.
 */
const ensureDefaultRoles = async () => {
  try {
    for (const role of DEFAULT_ROLES) {
      const existing = await Role.findOne({
        key: role.key,
      });

      if (!existing) {
        await Role.create({
          ...role,
          permissions: DEFAULT_ROLE_PERMISSIONS[role.key] || [],
          permissionsVersion: PERMISSIONS_VERSION,
        });

        continue;
      }

      if (
        !Array.isArray(existing.permissions) ||
        existing.permissions.length === 0
      ) {
        existing.permissions = DEFAULT_ROLE_PERMISSIONS[role.key] || [];
        existing.permissionsVersion = PERMISSIONS_VERSION;

        await existing.save();
        continue;
      }

      let permissionsChanged = false;
      const currentPermissions = new Set(existing.permissions);

      // Preserve the access existing roles had before these features were
      // separated into their own permission pairs. This migration runs once;
      // subsequent administrator edits are never silently undone at startup.
      if ((existing.permissionsVersion || 0) < PERMISSIONS_VERSION) {
        if (role.key === "BRANCH_ADMIN") {
          currentPermissions.add(PERMISSIONS.FINANCE_VIEW);
          currentPermissions.add(PERMISSIONS.FINANCE_MANAGE);
          currentPermissions.add(PERMISSIONS.FINANCE_COLLECT);
          currentPermissions.add(PERMISSIONS.FINANCE_REFUND);
          currentPermissions.add(PERMISSIONS.FINANCE_REPORT);
        }
        if (role.key === "STUDENT") currentPermissions.add(PERMISSIONS.STUDENT_FINANCE_VIEW);
        if (["BRANCH_ADMIN", "COACH"].includes(role.key)) {
          currentPermissions.add(PERMISSIONS.NOTIFICATION_VIEW);
        }
        if (currentPermissions.has(PERMISSIONS.ATTENDANCE_MANAGE)) {
          currentPermissions.add(PERMISSIONS.HOLIDAY_VIEW);
          currentPermissions.add(PERMISSIONS.HOLIDAY_MANAGE);
        }

        if (currentPermissions.has(PERMISSIONS.BRANCH_MANAGE)) {
          currentPermissions.add(PERMISSIONS.BRANCH_SCHEDULE_VIEW);
          currentPermissions.add(PERMISSIONS.BRANCH_SCHEDULE_MANAGE);
        }
        if (currentPermissions.has(PERMISSIONS.BRANCH_SCHEDULE_VIEW)) currentPermissions.add(PERMISSIONS.TRAINING_SESSION_TYPE_VIEW);

        if (currentPermissions.has(PERMISSIONS.SETTINGS_VIEW)) {
          currentPermissions.add(PERMISSIONS.WEBSITE_VIEW);
        }

        if (currentPermissions.has(PERMISSIONS.SETTINGS_MANAGE)) {
          currentPermissions.add(PERMISSIONS.WEBSITE_MANAGE);
        }

        if (role.key === "SUPER_ADMIN") {
          currentPermissions.add(PERMISSIONS.MAINTENANCE_VIEW);
          currentPermissions.add(PERMISSIONS.MAINTENANCE_HEALTH);
          currentPermissions.add(PERMISSIONS.MAINTENANCE_MODE);
          currentPermissions.add(PERMISSIONS.MAINTENANCE_BACKUP);
          currentPermissions.add(PERMISSIONS.MAINTENANCE_RESTORE);
          currentPermissions.add(PERMISSIONS.MAINTENANCE_CLEANUP);
          currentPermissions.add(PERMISSIONS.MAINTENANCE_CACHE);
          currentPermissions.add(PERMISSIONS.MAINTENANCE_LOGS);
        }

        permissionsChanged = true;
        existing.permissionsVersion = PERMISSIONS_VERSION;
      }

      // The protected root role always has the entire current catalog.
      if (role.key === "SUPER_ADMIN") {
        const isCurrentCatalog =
          existing.permissions.length === ALL_PERMISSIONS.length &&
          ALL_PERMISSIONS.every((permission) => currentPermissions.has(permission));
        if (!isCurrentCatalog) {
          existing.permissions = [...ALL_PERMISSIONS];
          permissionsChanged = false;
        }
      } else if (permissionsChanged) {
        existing.permissions = [...currentPermissions];
      }

      if (permissionsChanged || role.key === "SUPER_ADMIN") {
        await existing.save();
      }
    }

    // Preserve equivalent access for existing custom roles as well. New roles
    // are stamped with the current permission version at creation time.
    const legacyCustomRoles = await Role.find({
      key: { $nin: DEFAULT_ROLES.map((role) => role.key) },
      $or: [
        { permissionsVersion: { $lt: PERMISSIONS_VERSION } },
        { permissionsVersion: { $exists: false } },
      ],
    });

    for (const role of legacyCustomRoles) {
      const permissions = new Set(role.permissions || []);

      if (permissions.has(PERMISSIONS.ATTENDANCE_MANAGE)) {
        permissions.add(PERMISSIONS.HOLIDAY_VIEW);
        permissions.add(PERMISSIONS.HOLIDAY_MANAGE);
      }

      if (permissions.has(PERMISSIONS.BRANCH_MANAGE)) {
        permissions.add(PERMISSIONS.BRANCH_SCHEDULE_VIEW);
        permissions.add(PERMISSIONS.BRANCH_SCHEDULE_MANAGE);
      }
      if (permissions.has(PERMISSIONS.BRANCH_SCHEDULE_VIEW)) permissions.add(PERMISSIONS.TRAINING_SESSION_TYPE_VIEW);

      if (permissions.has(PERMISSIONS.SETTINGS_VIEW)) {
        permissions.add(PERMISSIONS.WEBSITE_VIEW);
      }

      if (permissions.has(PERMISSIONS.SETTINGS_MANAGE)) {
        permissions.add(PERMISSIONS.WEBSITE_MANAGE);
      }

      role.permissions = [...permissions];
      role.permissionsVersion = PERMISSIONS_VERSION;
      await role.save();
    }

    console.log("Built-in roles and permissions checked");
  } catch (error) {
    console.error("Default role seeding failed:", error);
  }
};

module.exports = {
  DEFAULT_ROLES,
  ensureDefaultRoles,
};

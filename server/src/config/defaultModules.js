const Module = require("../models/Module");

/*
 * =========================================================
 * LEGACY ROLE LIST
 * =========================================================
 *
 * Kept for backward compatibility with existing Module
 * documents.
 *
 * IMPORTANT:
 *
 * New authorization is based on requiredPermission.
 */
const ALL_STAFF = ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"];

/*
 * =========================================================
 * DEFAULT MODULES
 * =========================================================
 *
 * Every standard admin module now has a requiredPermission.
 *
 * Authorization flow:
 *
 * User
 *   ↓
 * Role
 *   ↓
 * Role.permissions
 *   ↓
 * Module.requiredPermission
 *   ↓
 * Navigation visibility
 */
const DEFAULT_MODULES = [
  // =========================================================
  // CORE
  // =========================================================

  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    order: 10,

    requiredPermission: "dashboard.view",

    allowedRoles: ALL_STAFF,

    isSystem: true,
  },

  {
    key: "students",
    label: "Students",
    href: "/students",
    icon: "Users",
    order: 20,

    requiredPermission: "student.view",

    allowedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },

  /*
   * Assignment permissions are intentionally separate from student updates.
   */
  {
    key: "coach-assignments",
    label: "Coach Assignments",
    href: "/coach-assignments",
    icon: "Users",
    order: 25,

    requiredPermission: "coach_assignment.view",

  },

  {
    key: "plans",
    label: "Plans",
    href: "/plans",
    icon: "ClipboardList",
    order: 30,

    requiredPermission: "plan.view",

    allowedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },

  {
    key: "curriculum",
    label: "Curriculum",
    href: "/curriculum",
    icon: "BookOpen",
    order: 40,

    requiredPermission: "curriculum.view",

    allowedRoles: ALL_STAFF,
  },

  // =========================================================
  // ATTENDANCE / TRAINING
  // =========================================================

  {
    key: "attendance",
    label: "Attendance",
    href: "/attendance",
    icon: "CalendarCheck",
    order: 50,

    requiredPermission: "attendance.view",

    allowedRoles: ALL_STAFF,
  },

  /*
   * Holidays have their own access and management permissions.
   */
  {
    key: "holidays",
    label: "Holidays",
    href: "/holidays",
    icon: "CalendarOff",
    order: 55,

    requiredPermission: "holiday.view",

    allowedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },

  {
    key: "performance",
    label: "Performance",
    href: "/performance",
    icon: "BarChart3",
    order: 60,

    requiredPermission: "performance.view",

    allowedRoles: ALL_STAFF,
  },

  {
    key: "makeups",
    label: "Makeups",
    href: "/makeups",
    icon: "RefreshCw",
    order: 70,

    requiredPermission: "makeup.view",

    allowedRoles: ALL_STAFF,
  },

  // =========================================================
  // ENQUIRIES
  // =========================================================

  {
    key: "inquiries",
    label: "Inquiries",
    href: "/inquiries",
    icon: "FileText",
    order: 80,

    requiredPermission: "inquiry.view",

    allowedRoles: ALL_STAFF,
  },

  // =========================================================
  // BRANCH MANAGEMENT
  // =========================================================

  {
    key: "branches",
    label: "Branches",
    href: "/branches",
    icon: "Building2",
    order: 90,

    requiredPermission: "branch.view",

    allowedRoles: ["SUPER_ADMIN"],
  },

  /*
   * Branch Schedule Management
   *
   * Schedule visibility and schedule changes are independently authorized.
   */
  {
    key: "branch-schedules",
    label: "Branch Schedules",
    href: "/branch-schedules",
    icon: "CalendarClock",
    order: 95,

    requiredPermission: "branch_schedule.view",

    allowedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },

  {
    key: "training-session-types",
    label: "Category/Program",
    href: "/training-session-types",
    icon: "Tags",
    order: 96,
    requiredPermission: "training_session_type.view",
    allowedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },

  // =========================================================
  // SYSTEM / ADMINISTRATION
  // =========================================================

  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    icon: "Settings",
    order: 100,

    requiredPermission: "settings.view",

    allowedRoles: ["SUPER_ADMIN"],

    isSystem: true,
  },

  {
    key: "roles",
    label: "Roles",
    href: "/roles",
    icon: "ShieldCheck",
    order: 105,

    requiredPermission: "role.view",

    allowedRoles: ["SUPER_ADMIN"],

    isSystem: true,
  },

  {
    key: "modules",
    label: "Modules",
    href: "/modules",
    icon: "LayoutGrid",
    order: 110,

    requiredPermission: "module.view",

    allowedRoles: ["SUPER_ADMIN"],

    isSystem: true,
  },

  // =========================================================
  // STUDENT
  // =========================================================

  {
    key: "student-dashboard",
    label: "My Dashboard",
    href: "/student-dashboard",
    icon: "LayoutDashboard",
    order: 10,

    /*
     * Student dashboard is intentionally separate from
     * staff/admin permission navigation.
     */
    requiredPermission: null,

    allowedRoles: ["STUDENT"],

    isSystem: true,
  },
];

/*
 * =========================================================
 * REQUIRED MODULES
 * =========================================================
 *
 * These modules must always exist because they are needed
 * to administer/recover the application's configuration.
 */
const REQUIRED_MODULE_KEYS = [
  "modules",
  "roles",
  "coach-assignments",
  "holidays",
  "branch-schedules",
  "training-session-types",
];

/*
 * Exact pre-split permission values for built-in modules. Only these values
 * are migrated; other administrator-customized module permissions remain
 * untouched.
 */
const OBSOLETE_DEFAULT_MODULE_PERMISSIONS = Object.freeze({
  "coach-assignments": "student.update",
  holidays: "attendance.manage",
  "branch-schedules": "branch.manage",
});

/*
 * =========================================================
 * SEED / REPAIR DEFAULT MODULES
 * =========================================================
 *
 * Behaviour:
 *
 * 1. Empty collection
 *    -> Insert all default modules.
 *
 * 2. Existing collection
 *    -> Do not overwrite administrator customizations.
 *    -> Only insert missing required modules.
 *
 * IMPORTANT:
 *
 * Existing modules are intentionally NOT overwritten.
 *
 * This prevents an existing production configuration from
 * suddenly changing when the server restarts.
 */
const ensureDefaultModules = async () => {
  try {
    const count = await Module.countDocuments();

    // -----------------------------------------------------
    // First installation
    // -----------------------------------------------------

    if (count === 0) {
      await Module.insertMany(DEFAULT_MODULES);

      console.log(
        `Seeded ${DEFAULT_MODULES.length} default ForceStrike modules`,
      );

      return;
    }

    // -----------------------------------------------------
    // Existing installation
    // -----------------------------------------------------

    const requiredModules = DEFAULT_MODULES.filter((module) =>
      REQUIRED_MODULE_KEYS.includes(module.key),
    );

    // The homepage editor may have a customized module key; migrate the
    // exact route/permission pair without replacing its other settings.
    await Module.updateMany(
      {
        href: "/website/homepage",
        requiredPermission: "settings.view",
      },
      {
        $set: { requiredPermission: "website.view" },
      },
    );

    for (const module of requiredModules) {
      const obsoletePermission =
        OBSOLETE_DEFAULT_MODULE_PERMISSIONS[module.key];

      if (obsoletePermission) {
        await Module.updateOne(
          {
            key: module.key,
            requiredPermission: obsoletePermission,
          },
          {
            $set: {
              requiredPermission: module.requiredPermission,
            },
          },
        );
      }

      await Module.updateOne(
        {
          key: module.key,
        },
        {
          $setOnInsert: module,
        },
        {
          upsert: true,
        },
      );
    }

    console.log("Default ForceStrike modules verified");
  } catch (error) {
    console.error("Default module seeding failed:", error);
  }
};

module.exports = {
  DEFAULT_MODULES,
  REQUIRED_MODULE_KEYS,
  ensureDefaultModules,
};

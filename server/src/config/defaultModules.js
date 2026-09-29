const Module = require("../models/Module");

const ALL_STAFF = ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"];

/**
 * Default modules available in the ForceStrike application.
 *
 * These modules are used to build the dynamic sidebar/navigation.
 *
 * Role meanings:
 * - SUPER_ADMIN  -> Full academy/system access
 * - BRANCH_ADMIN -> Branch-level management
 * - COACH        -> Training/attendance/performance access
 * - STUDENT      -> Student-facing dashboard
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
    allowedRoles: ALL_STAFF,
    isSystem: true,
  },

  {
    key: "students",
    label: "Students",
    href: "/students",
    icon: "Users",
    order: 20,
    allowedRoles: ALL_STAFF,
  },

  {
    key: "coach-assignments",
    label: "Coach Assignments",
    href: "/coach-assignments",
    icon: "Users",
    order: 25,
    allowedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },

  {
    key: "plans",
    label: "Plans",
    href: "/plans",
    icon: "ClipboardList",
    order: 30,
    allowedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },

  {
    key: "curriculum",
    label: "Curriculum",
    href: "/curriculum",
    icon: "BookOpen",
    order: 40,
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
    allowedRoles: ALL_STAFF,
  },

  {
    key: "holidays",
    label: "Holidays",
    href: "/holidays",
    icon: "CalendarOff",
    order: 55,
    allowedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"],
  },

  {
    key: "performance",
    label: "Performance",
    href: "/performance",
    icon: "BarChart3",
    order: 60,
    allowedRoles: ALL_STAFF,
  },

  {
    key: "makeups",
    label: "Makeups",
    href: "/makeups",
    icon: "RefreshCw",
    order: 70,
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
    allowedRoles: ["SUPER_ADMIN"],
  },

  /**
   * Branch Schedule Management
   *
   * Allows administrators to manage the normal weekly
   * training availability for every branch.
   *
   * Examples:
   * - Monday 06:00 AM - 07:00 AM
   * - Monday 07:00 AM - 08:00 AM
   * - Tuesday 05:00 PM - 06:00 PM
   *
   * SUPER_ADMIN:
   * - Can manage schedules for all branches.
   *
   * BRANCH_ADMIN:
   * - Can manage schedules for assigned branch(es),
   *   according to backend authorization rules.
   */
  {
    key: "branch-schedules",
    label: "Branch Schedules",
    href: "/branch-schedules",
    icon: "CalendarClock",
    order: 95,
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
    allowedRoles: ["SUPER_ADMIN"],
    isSystem: true,
  },

  {
    key: "roles",
    label: "Roles",
    href: "/roles",
    icon: "ShieldCheck",
    order: 105,
    allowedRoles: ["SUPER_ADMIN"],
    isSystem: true,
  },

  {
    key: "modules",
    label: "Modules",
    href: "/modules",
    icon: "LayoutGrid",
    order: 110,
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
    allowedRoles: ["STUDENT"],
    isSystem: true,
  },
];

/**
 * Modules that must always exist.
 *
 * These modules are required for administration and
 * recovery of the application's module configuration.
 */
const REQUIRED_MODULE_KEYS = [
  "modules",
  "roles",
  "coach-assignments",
  "holidays",
  "branch-schedules",
];

/**
 * Seed / repair default modules.
 *
 * Behaviour:
 *
 * 1. Empty collection
 *    -> Insert all default modules.
 *
 * 2. Existing collection
 *    -> Do not overwrite existing module configuration.
 *    -> Only insert missing required modules.
 *
 * This is important because administrators may customize
 * modules from the Modules management page.
 */
const ensureDefaultModules = async () => {
  try {
    const count = await Module.countDocuments();

    // ---------------------------------------------------------
    // First installation
    // ---------------------------------------------------------

    if (count === 0) {
      await Module.insertMany(DEFAULT_MODULES);

      console.log(
        `Seeded ${DEFAULT_MODULES.length} default ForceStrike modules`,
      );

      return;
    }

    // ---------------------------------------------------------
    // Existing installation
    // ---------------------------------------------------------

    const requiredModules = DEFAULT_MODULES.filter((module) =>
      REQUIRED_MODULE_KEYS.includes(module.key),
    );

    for (const module of requiredModules) {
      await Module.updateOne(
        { key: module.key },
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

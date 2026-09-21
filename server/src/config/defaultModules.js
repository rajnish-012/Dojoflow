const Module = require("../models/Module");

const ALL_STAFF = ["SUPER_ADMIN", "BRANCH_ADMIN", "COACH"];

// The modules the sidebar used to have hard-coded.
const DEFAULT_MODULES = [
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
  {
    key: "attendance",
    label: "Attendance",
    href: "/attendance",
    icon: "CalendarCheck",
    order: 50,
    allowedRoles: ALL_STAFF,
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
  {
    key: "inquiries",
    label: "Inquiries",
    href: "/inquiries",
    icon: "FileText",
    order: 80,
    allowedRoles: ALL_STAFF,
  },
  {
    key: "branches",
    label: "Branches",
    href: "/branches",
    icon: "Trophy",
    order: 90,
    allowedRoles: ["SUPER_ADMIN"],
  },
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
    key: "modules",
    label: "Modules",
    href: "/modules",
    icon: "LayoutGrid",
    order: 110,
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
 * Runs once when the server starts.
 *
 * - Empty collection  -> insert every default module.
 * - Otherwise         -> only make sure the "modules" management
 *                        module exists, so the Super Admin can never
 *                        be locked out of the page that fixes things.
 */
const ensureDefaultModules = async () => {
  try {
    const count = await Module.countDocuments();

    if (count === 0) {
      await Module.insertMany(DEFAULT_MODULES);
      console.log(
        `Seeded ${DEFAULT_MODULES.length} default modules`
      );
      return;
    }

    // Pages the Super Admin must never lose access to.
    const mustExist = DEFAULT_MODULES.filter((item) =>
      ["modules", "roles"].includes(item.key)
    );

    for (const item of mustExist) {
      await Module.updateOne(
        { key: item.key },
        { $setOnInsert: item },
        { upsert: true }
      );
    }
  } catch (error) {
    console.error("Default module seeding failed:", error);
  }
};

module.exports = {
  DEFAULT_MODULES,
  ensureDefaultModules,
};

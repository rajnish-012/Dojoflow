const Role = require("../models/Role");

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
 * Runs when the server starts.
 * Inserts any built-in role that is missing and never
 * overwrites a role that already exists.
 */
const ensureDefaultRoles = async () => {
  try {
    for (const role of DEFAULT_ROLES) {
      await Role.updateOne(
        { key: role.key },
        { $setOnInsert: role },
        { upsert: true }
      );
    }

    console.log("Built-in roles checked");
  } catch (error) {
    console.error("Default role seeding failed:", error);
  }
};

module.exports = {
  DEFAULT_ROLES,
  ensureDefaultRoles,
};
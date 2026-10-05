/**
 * Canonical ForceStrike backend permissions.
 *
 * These names intentionally match the existing frontend
 * permission names.
 */

const PERMISSIONS = Object.freeze({
  // Dashboard
  DASHBOARD_VIEW: "dashboard.view",

  // Students
  STUDENT_VIEW: "student.view",
  STUDENT_CREATE: "student.create",
  STUDENT_UPDATE: "student.update",
  STUDENT_DELETE: "student.delete",

  // Coach assignments
  COACH_ASSIGNMENT_VIEW: "coach_assignment.view",
  COACH_ASSIGNMENT_MANAGE: "coach_assignment.manage",

  // Plans
  PLAN_VIEW: "plan.view",
  PLAN_MANAGE: "plan.manage",

  // Curriculum
  CURRICULUM_VIEW: "curriculum.view",
  CURRICULUM_MANAGE: "curriculum.manage",

  // Attendance
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_MANAGE: "attendance.manage",

  // Holidays
  HOLIDAY_VIEW: "holiday.view",
  HOLIDAY_MANAGE: "holiday.manage",

  // Branch schedules
  BRANCH_SCHEDULE_VIEW: "branch_schedule.view",
  BRANCH_SCHEDULE_MANAGE: "branch_schedule.manage",
  TRAINING_SESSION_TYPE_VIEW: "training_session_type.view",
  TRAINING_SESSION_TYPE_CREATE: "training_session_type.create",
  TRAINING_SESSION_TYPE_UPDATE: "training_session_type.update",
  TRAINING_SESSION_TYPE_DELETE: "training_session_type.delete",

  // Performance
  PERFORMANCE_VIEW: "performance.view",
  PERFORMANCE_MANAGE: "performance.manage",

  // Makeups
  MAKEUP_VIEW: "makeup.view",
  MAKEUP_MANAGE: "makeup.manage",

  // Promotions
  PROMOTION_VIEW: "promotion.view",
  PROMOTION_MANAGE: "promotion.manage",

  // Reports
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",

  // Financial records. Student permission is limited to their linked profile.
  FINANCE_VIEW: "finance.view",
  FINANCE_MANAGE: "finance.manage",
  FINANCE_COLLECT: "finance.collect",
  FINANCE_REFUND: "finance.refund",
  FINANCE_REPORT: "finance.report",
  STUDENT_FINANCE_VIEW: "student.finance.view",

  // Inquiries
  INQUIRY_VIEW: "inquiry.view",
  INQUIRY_UPDATE: "inquiry.update",

  // Notifications
  NOTIFICATION_VIEW: "notification.view",

  // Branches
  BRANCH_VIEW: "branch.view",
  BRANCH_MANAGE: "branch.manage",


  // Users / Staff
  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",

  // Roles
  ROLE_VIEW: "role.view",
  ROLE_MANAGE: "role.manage",

  // Modules
  MODULE_VIEW: "module.view",
  MODULE_MANAGE: "module.manage",

  // Settings
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",

  // Maintenance
  MAINTENANCE_VIEW: "maintenance.view",
  MAINTENANCE_HEALTH: "maintenance.health",
  MAINTENANCE_MODE: "maintenance.mode",
  MAINTENANCE_BACKUP: "maintenance.backup",
  MAINTENANCE_RESTORE: "maintenance.restore",
  MAINTENANCE_CLEANUP: "maintenance.cleanup",
  MAINTENANCE_CACHE: "maintenance.cache",
  MAINTENANCE_LOGS: "maintenance.logs",

  // Website content management
  WEBSITE_VIEW: "website.view",
  WEBSITE_MANAGE: "website.manage",

});

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

// Sidebar module that must be enabled for a role before its permissions can
// be newly granted. User/staff access is managed from the Settings module;
// website permissions belong to the configurable Homepage CMS module.
const PERMISSION_MODULE_KEYS = Object.freeze({
  "dashboard.view": "dashboard",
  "student.view": "students",
  "student.create": "students",
  "student.update": "students",
  "student.delete": "students",
  "coach_assignment.view": "coach-assignments",
  "coach_assignment.manage": "coach-assignments",
  "plan.view": "plans",
  "plan.manage": "plans",
  "curriculum.view": "curriculum",
  "curriculum.manage": "curriculum",
  "attendance.view": "attendance",
  "attendance.manage": "attendance",
  "holiday.view": "holidays",
  "holiday.manage": "holidays",
  "branch_schedule.view": "branch-schedules",
  "branch_schedule.manage": "branch-schedules",
  "training_session_type.view": "training-session-types",
  "training_session_type.create": "training-session-types",
  "training_session_type.update": "training-session-types",
  "training_session_type.delete": "training-session-types",
  "performance.view": "performance",
  "performance.manage": "performance",
  "makeup.view": "makeups",
  "makeup.manage": "makeups",
  "promotion.view": "promotions",
  "promotion.manage": "promotions",
  "report.view": "reports",
  "report.export": "reports",
  "finance.view": "fees",
  "finance.manage": "fees",
  "finance.collect": "fees",
  "finance.refund": "fees",
  "finance.report": "fees",
  "student.finance.view": "student-dashboard",
  "inquiry.view": "inquiries",
  "inquiry.update": "inquiries",
  "notification.view": "notifications",
  "branch.view": "branches",
  "branch.manage": "branches",
  "user.view": "settings-staff",
  "user.create": "settings-staff",
  "user.update": "settings-staff",
  "user.delete": "settings-staff",
  "role.view": "roles",
  "role.manage": "roles",
  "module.view": "modules",
  "module.manage": "modules",
  "settings.view": "settings-branding",
  "settings.manage": "settings-email",
  "maintenance.view": "settings-maintenance",
  "maintenance.health": "settings-maintenance",
  "maintenance.mode": "settings-maintenance",
  "maintenance.backup": "settings-maintenance",
  "maintenance.restore": "settings-maintenance",
  "maintenance.cleanup": "settings-maintenance",
  "maintenance.cache": "settings-maintenance",
  "maintenance.logs": "settings-maintenance",
  "website.view": "website-homepage",
  "website.manage": "website-homepage",
});

/*
 * Built-in role permissions.
 *
 * These initialize existing roles only when their permission
 * list has not yet been populated.
 *
 * Existing non-empty permission lists are never overwritten.
 */
const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  SUPER_ADMIN: ALL_PERMISSIONS,

  BRANCH_ADMIN: [
    PERMISSIONS.DASHBOARD_VIEW,

    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_CREATE,
    PERMISSIONS.STUDENT_UPDATE,
    PERMISSIONS.STUDENT_DELETE,

    PERMISSIONS.COACH_ASSIGNMENT_VIEW,
    PERMISSIONS.COACH_ASSIGNMENT_MANAGE,

    PERMISSIONS.PLAN_VIEW,
    PERMISSIONS.PLAN_MANAGE,

    PERMISSIONS.CURRICULUM_VIEW,
    PERMISSIONS.CURRICULUM_MANAGE,

    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE,

    PERMISSIONS.HOLIDAY_VIEW,
    PERMISSIONS.HOLIDAY_MANAGE,

    PERMISSIONS.BRANCH_SCHEDULE_VIEW,
    PERMISSIONS.BRANCH_SCHEDULE_MANAGE,
    PERMISSIONS.TRAINING_SESSION_TYPE_VIEW,

    PERMISSIONS.PERFORMANCE_VIEW,
    PERMISSIONS.PERFORMANCE_MANAGE,

    PERMISSIONS.MAKEUP_VIEW,
    PERMISSIONS.MAKEUP_MANAGE,

    PERMISSIONS.PROMOTION_VIEW,
    PERMISSIONS.PROMOTION_MANAGE,

    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,

    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.FINANCE_COLLECT,
    PERMISSIONS.FINANCE_REFUND,
    PERMISSIONS.FINANCE_REPORT,

    PERMISSIONS.INQUIRY_VIEW,
    PERMISSIONS.INQUIRY_UPDATE,

    PERMISSIONS.NOTIFICATION_VIEW,

    PERMISSIONS.BRANCH_VIEW,
    PERMISSIONS.BRANCH_MANAGE,

    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,

    PERMISSIONS.ROLE_VIEW,
  ],

  COACH: [
    PERMISSIONS.DASHBOARD_VIEW,

    // Branch-scoped branch lookup is used by holiday management and profile UI.
    PERMISSIONS.BRANCH_VIEW,

    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_UPDATE,

    PERMISSIONS.CURRICULUM_VIEW,

    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE,
    PERMISSIONS.HOLIDAY_VIEW,

    PERMISSIONS.PERFORMANCE_VIEW,
    PERMISSIONS.PERFORMANCE_MANAGE,

    PERMISSIONS.MAKEUP_VIEW,
    PERMISSIONS.MAKEUP_MANAGE,

    PERMISSIONS.PROMOTION_VIEW,
    PERMISSIONS.PROMOTION_MANAGE,

    PERMISSIONS.REPORT_VIEW,

    PERMISSIONS.NOTIFICATION_VIEW,

  ],

  STUDENT: [PERMISSIONS.STUDENT_FINANCE_VIEW],
});

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_MODULE_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
};

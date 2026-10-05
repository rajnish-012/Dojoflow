"use client";

import { useCurrentUser } from "@/lib/current-user";

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  STUDENT_VIEW: "student.view",
  STUDENT_CREATE: "student.create",
  STUDENT_UPDATE: "student.update",
  STUDENT_DELETE: "student.delete",

  COACH_ASSIGNMENT_VIEW: "coach_assignment.view",
  COACH_ASSIGNMENT_MANAGE: "coach_assignment.manage",

  PLAN_VIEW: "plan.view",
  PLAN_MANAGE: "plan.manage",

  CURRICULUM_VIEW: "curriculum.view",
  CURRICULUM_MANAGE: "curriculum.manage",

  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_MANAGE: "attendance.manage",

  HOLIDAY_VIEW: "holiday.view",
  HOLIDAY_MANAGE: "holiday.manage",

  BRANCH_SCHEDULE_VIEW: "branch_schedule.view",
  BRANCH_SCHEDULE_MANAGE: "branch_schedule.manage",
  TRAINING_SESSION_TYPE_VIEW: "training_session_type.view",
  TRAINING_SESSION_TYPE_CREATE: "training_session_type.create",
  TRAINING_SESSION_TYPE_UPDATE: "training_session_type.update",
  TRAINING_SESSION_TYPE_DELETE: "training_session_type.delete",

  PERFORMANCE_VIEW: "performance.view",
  PERFORMANCE_MANAGE: "performance.manage",

  MAKEUP_VIEW: "makeup.view",
  MAKEUP_MANAGE: "makeup.manage",

  PROMOTION_VIEW: "promotion.view",
  PROMOTION_MANAGE: "promotion.manage",

  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",

  FINANCE_VIEW: "finance.view",
  FINANCE_MANAGE: "finance.manage",
  FINANCE_COLLECT: "finance.collect",
  FINANCE_REFUND: "finance.refund",
  FINANCE_REPORT: "finance.report",
  STUDENT_FINANCE_VIEW: "student.finance.view",

  INQUIRY_VIEW: "inquiry.view",
  INQUIRY_UPDATE: "inquiry.update",

  NOTIFICATION_VIEW: "notification.view",

  BRANCH_VIEW: "branch.view",
  BRANCH_MANAGE: "branch.manage",

  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",

  ROLE_VIEW: "role.view",
  ROLE_MANAGE: "role.manage",

  MODULE_VIEW: "module.view",
  MODULE_MANAGE: "module.manage",

  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",

  MAINTENANCE_VIEW: "maintenance.view",
  MAINTENANCE_HEALTH: "maintenance.health",
  MAINTENANCE_MODE: "maintenance.mode",
  MAINTENANCE_BACKUP: "maintenance.backup",
  MAINTENANCE_RESTORE: "maintenance.restore",
  MAINTENANCE_CLEANUP: "maintenance.cleanup",
  MAINTENANCE_CACHE: "maintenance.cache",
  MAINTENANCE_LOGS: "maintenance.logs",

  WEBSITE_VIEW: "website.view",
  WEBSITE_MANAGE: "website.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionKey = Permission | (string & {});

export const NAVIGATION_PERMISSIONS: Record<string, PermissionKey | null> = {
  dashboard: PERMISSIONS.DASHBOARD_VIEW,
  students: PERMISSIONS.STUDENT_VIEW,
  plans: PERMISSIONS.PLAN_VIEW,
  curriculum: PERMISSIONS.CURRICULUM_VIEW,
  attendance: PERMISSIONS.ATTENDANCE_VIEW,
  performance: PERMISSIONS.PERFORMANCE_VIEW,
  makeups: PERMISSIONS.MAKEUP_VIEW,
  promotions: PERMISSIONS.PROMOTION_VIEW,
  reports: PERMISSIONS.REPORT_VIEW,
  fees: PERMISSIONS.FINANCE_VIEW,
  inquiries: PERMISSIONS.INQUIRY_VIEW,
  notifications: PERMISSIONS.NOTIFICATION_VIEW,
  notification: PERMISSIONS.NOTIFICATION_VIEW,
  "coach-assignments": PERMISSIONS.COACH_ASSIGNMENT_VIEW,
  holidays: PERMISSIONS.HOLIDAY_VIEW,
  "branch-schedules": PERMISSIONS.BRANCH_SCHEDULE_VIEW,
  "training-session-types": PERMISSIONS.TRAINING_SESSION_TYPE_VIEW,
  branches: PERMISSIONS.BRANCH_VIEW,
  // The backend exposes this shared page for settings.view OR user.view.
  // Its tabs and APIs enforce their own permissions.
  settings: null,
  "settings-branding": PERMISSIONS.SETTINGS_VIEW,
  "settings-staff": PERMISSIONS.USER_VIEW,
  "settings-maintenance": PERMISSIONS.MAINTENANCE_VIEW,
  "settings-email": PERMISSIONS.SETTINGS_MANAGE,
  "website-homepage": PERMISSIONS.WEBSITE_VIEW,
  modules: PERMISSIONS.MODULE_VIEW,
  roles: PERMISSIONS.ROLE_VIEW,
  "student-dashboard": null,
};

export function normalizeRole(role?: string | null): string | null {
  if (!role || typeof role !== "string") {
    return null;
  }

  return role
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function getUserPermissions(
  user: {
    role?: string | null;
    permissions?: string[];
  } | null,
): PermissionKey[] {
  if (!user) {
    return [];
  }

  if (!Array.isArray(user.permissions)) {
    return [];
  }

  return Array.from(
    new Set(
      user.permissions
        .filter(
          (permission): permission is string =>
            typeof permission === "string" && permission.trim().length > 0,
        )
        .map((permission) => permission.trim()),
    ),
  );
}

export function hasPermission(
  user: {
    role?: string | null;
    permissions?: string[];
  } | null,
  permission: PermissionKey,
): boolean {
  if (!permission) {
    return false;
  }

  /*
   * This controls client-side visibility only. The backend remains the
   * authorization boundary, where SUPER_ADMIN receives the same explicit
   * system-role bypass.
   */
  if (normalizeRole(user?.role) === "SUPER_ADMIN") {
    return true;
  }

  const permissions = getUserPermissions(user);
  if (
    permission === PERMISSIONS.SETTINGS_VIEW &&
    permissions.includes(PERMISSIONS.SETTINGS_MANAGE)
  ) {
    return true;
  }
  return permissions.includes(permission);
}

export function useCurrentRole(): string | null {
  const user = useCurrentUser();

  return normalizeRole(user?.role);
}

export function useCan(permission: PermissionKey): boolean {
  const user = useCurrentUser();

  return hasPermission(user, permission);
}

export function useCanAny(permissions: PermissionKey[]): boolean {
  const user = useCurrentUser();

  if (!permissions.length) {
    return false;
  }

  return permissions.some((permission) => hasPermission(user, permission));
}

export function useCanAll(permissions: PermissionKey[]): boolean {
  const user = useCurrentUser();

  if (!permissions.length) {
    return true;
  }

  return permissions.every((permission) => hasPermission(user, permission));
}

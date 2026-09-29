"use client";

import { useCurrentUser } from "@/lib/current-user";

/**
 * Central permission catalog for the ForceStrike frontend.
 *
 * IMPORTANT:
 * These permissions control frontend visibility and navigation.
 * Backend authorization remains the final security boundary.
 */

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: "dashboard.view",

  // Students
  STUDENT_VIEW: "student.view",
  STUDENT_CREATE: "student.create",
  STUDENT_UPDATE: "student.update",
  STUDENT_DELETE: "student.delete",

  // Plans
  PLAN_VIEW: "plan.view",
  PLAN_MANAGE: "plan.manage",

  // Curriculum
  CURRICULUM_VIEW: "curriculum.view",
  CURRICULUM_MANAGE: "curriculum.manage",

  // Attendance
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_MANAGE: "attendance.manage",

  // Performance
  PERFORMANCE_VIEW: "performance.view",
  PERFORMANCE_MANAGE: "performance.manage",

  // Makeups
  MAKEUP_VIEW: "makeup.view",
  MAKEUP_MANAGE: "makeup.manage",

  // Promotions / belts
  PROMOTION_VIEW: "promotion.view",
  PROMOTION_MANAGE: "promotion.manage",

  // Reports
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",

  // Inquiries
  INQUIRY_VIEW: "inquiry.view",
  INQUIRY_UPDATE: "inquiry.update",

  // Branches
  BRANCH_VIEW: "branch.view",
  BRANCH_MANAGE: "branch.manage",

  // Users / staff
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
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionKey =
  | Permission
  | (string & {});

/**
 * Which permission controls each sidebar module.
 *
 * The backend still controls which modules are returned.
 * This map adds the frontend permission layer.
 */
export const NAVIGATION_PERMISSIONS: Record<
  string,
  PermissionKey | null
> = {
  dashboard: PERMISSIONS.DASHBOARD_VIEW,

  students: PERMISSIONS.STUDENT_VIEW,

  plans: PERMISSIONS.PLAN_VIEW,

  curriculum: PERMISSIONS.CURRICULUM_VIEW,

  attendance: PERMISSIONS.ATTENDANCE_VIEW,

  performance: PERMISSIONS.PERFORMANCE_VIEW,

  makeups: PERMISSIONS.MAKEUP_VIEW,

  promotions: PERMISSIONS.PROMOTION_VIEW,

  reports: PERMISSIONS.REPORT_VIEW,

  inquiries: PERMISSIONS.INQUIRY_VIEW,

  branches: PERMISSIONS.BRANCH_VIEW,

  settings: PERMISSIONS.SETTINGS_VIEW,

  modules: PERMISSIONS.MODULE_VIEW,

  roles: PERMISSIONS.ROLE_VIEW,

  /*
   * Student dashboard is handled separately because
   * students currently have their own dashboard role.
   */
  "student-dashboard": null,
};

/**
 * Built-in fallback permissions.
 *
 * These are only used when /auth/me does not yet provide
 * an explicit permissions array.
 *
 * The backend remains the final authorization layer.
 */
const ROLE_PERMISSIONS: Record<
  string,
  PermissionKey[]
> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),

  BRANCH_ADMIN: [
    PERMISSIONS.DASHBOARD_VIEW,

    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_CREATE,
    PERMISSIONS.STUDENT_UPDATE,
    PERMISSIONS.STUDENT_DELETE,

    PERMISSIONS.PLAN_VIEW,
    PERMISSIONS.PLAN_MANAGE,

    PERMISSIONS.CURRICULUM_VIEW,
    PERMISSIONS.CURRICULUM_MANAGE,

    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE,

    PERMISSIONS.PERFORMANCE_VIEW,
    PERMISSIONS.PERFORMANCE_MANAGE,

    PERMISSIONS.MAKEUP_VIEW,
    PERMISSIONS.MAKEUP_MANAGE,

    PERMISSIONS.PROMOTION_VIEW,
    PERMISSIONS.PROMOTION_MANAGE,

    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,

    PERMISSIONS.INQUIRY_VIEW,
    PERMISSIONS.INQUIRY_UPDATE,

    PERMISSIONS.BRANCH_VIEW,

    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,

    PERMISSIONS.ROLE_VIEW,
  ],

  COACH: [
    PERMISSIONS.DASHBOARD_VIEW,

    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_UPDATE,

    PERMISSIONS.CURRICULUM_VIEW,

    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE,

    PERMISSIONS.PERFORMANCE_VIEW,
    PERMISSIONS.PERFORMANCE_MANAGE,

    PERMISSIONS.MAKEUP_VIEW,
    PERMISSIONS.MAKEUP_MANAGE,

    PERMISSIONS.PROMOTION_VIEW,
    PERMISSIONS.PROMOTION_MANAGE,

    PERMISSIONS.REPORT_VIEW,
  ],

  /*
   * Students use the dedicated student dashboard.
   * They intentionally do not receive staff permissions.
   */
  STUDENT: [],
};

/**
 * Normalize a role.
 */
export function normalizeRole(
  role?: string | null,
): string | null {
  if (!role || typeof role !== "string") {
    return null;
  }

  return role.trim().toUpperCase();
}

/**
 * Get fallback permissions for a built-in role.
 */
export function getRolePermissions(
  role?: string | null,
): PermissionKey[] {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return [];
  }

  return ROLE_PERMISSIONS[normalizedRole] || [];
}

/**
 * Get the authenticated user's effective permissions.
 *
 * Explicit permissions returned by /auth/me have priority.
 * Built-in role permissions are used as a fallback.
 */
export function getUserPermissions(
  user: {
    role?: string | null;
    permissions?: string[];
  } | null,
): PermissionKey[] {
  if (!user) {
    return [];
  }

  if (Array.isArray(user.permissions)) {
    return Array.from(
      new Set(
        user.permissions
          .filter(
            (permission): permission is string =>
              typeof permission === "string" &&
              permission.trim().length > 0,
          )
          .map((permission) => permission.trim()),
      ),
    );
  }

  return getRolePermissions(user.role);
}

/**
 * Non-React permission check.
 */
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

  return getUserPermissions(user).includes(
    permission,
  );
}

/**
 * Current user's role.
 */
export function useCurrentRole(): string | null {
  const user = useCurrentUser();

  return normalizeRole(user?.role);
}

/**
 * Check one permission.
 */
export function useCan(
  permission: PermissionKey,
): boolean {
  const user = useCurrentUser();

  return hasPermission(user, permission);
}

/**
 * Check whether the user has at least one permission.
 */
export function useCanAny(
  permissions: PermissionKey[],
): boolean {
  const user = useCurrentUser();

  if (!permissions.length) {
    return false;
  }

  return permissions.some((permission) =>
    hasPermission(user, permission),
  );
}

/**
 * Check whether the user has every permission.
 */
export function useCanAll(
  permissions: PermissionKey[],
): boolean {
  const user = useCurrentUser();

  if (!permissions.length) {
    return true;
  }

  return permissions.every((permission) =>
    hasPermission(user, permission),
  );
}
"use client";

import type { ReactNode } from "react";

import {
  useCan,
  useCanAll,
  useCanAny,
  type PermissionKey,
} from "@/lib/permissions";

type PermissionGateProps = {
  children: ReactNode;

  /**
   * Single permission requirement.
   *
   * Example:
   * permission="student.create"
   */
  permission?: PermissionKey;

  /**
   * User must have at least one of these permissions.
   */
  anyOf?: PermissionKey[];

  /**
   * User must have every permission in this list.
   */
  allOf?: PermissionKey[];

  /**
   * Optional fallback shown when access is denied.
   */
  fallback?: ReactNode;
};

/**
 * Controls visibility of UI based on the authenticated
 * user's frontend permissions.
 *
 * IMPORTANT:
 * This component is only a frontend access-control layer.
 * Backend authorization remains the final security boundary.
 */
export default function PermissionGate({
  children,
  permission,
  anyOf,
  allOf,
  fallback = null,
}: PermissionGateProps) {
  const hasSinglePermission = useCan(
    permission ?? "",
  );

  const hasAnyPermission = useCanAny(
    anyOf ?? [],
  );

  const hasAllPermissions = useCanAll(
    allOf ?? [],
  );

  let allowed = false;

  if (permission) {
    allowed = hasSinglePermission;
  } else if (anyOf?.length) {
    allowed = hasAnyPermission;
  } else if (allOf?.length) {
    allowed = hasAllPermissions;
  }

  /*
   * No permission rule was supplied.
   *
   * Fail closed instead of accidentally exposing
   * protected content.
   */
  if (
    !permission &&
    !anyOf?.length &&
    !allOf?.length
  ) {
    return <>{fallback}</>;
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

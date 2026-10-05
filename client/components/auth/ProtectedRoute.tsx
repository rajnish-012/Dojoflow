"use client";

import { type ReactNode, useEffect } from "react";

import { usePathname, useRouter } from "next/navigation";

import {
  useCan,
  useCanAll,
  useCanAny,
  type PermissionKey,
} from "@/lib/permissions";

import { useAuth } from "@/hooks/userAuth";

type ProtectedRouteProps = {
  children: ReactNode;

  /**
   * Single permission required for the route.
   */
  permission?: PermissionKey;

  /**
   * User must have at least one permission.
   */
  anyOf?: PermissionKey[];

  /**
   * User must have all permissions.
   */
  allOf?: PermissionKey[];

  /**
   * Optional loading UI.
   */
  loadingFallback?: ReactNode;
};

/**
 * Protects an application route at the frontend level.
 *
 * Authentication:
 *     No valid session → /login
 *
 * Authorization:
 *     Authenticated but missing permission → /unauthorized
 *
 * Backend authorization remains the actual security boundary.
 */
export default function ProtectedRoute({
  children,
  permission,
  anyOf,
  allOf,
  loadingFallback,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, isLoading, isAuthenticated } = useAuth();

  const hasSinglePermission = useCan(permission ?? "");

  const hasAnyPermission = useCanAny(anyOf ?? []);

  const hasAllPermissions = useCanAll(allOf ?? []);

  let authorized = false;

  /*
   * If no permission requirement is provided,
   * authentication alone protects the route.
   */
  if (!permission && !anyOf?.length && !allOf?.length) {
    authorized = isAuthenticated;
  } else if (permission) {
    authorized = isAuthenticated && hasSinglePermission;
  } else if (anyOf?.length) {
    authorized = isAuthenticated && hasAnyPermission;
  } else if (allOf?.length) {
    authorized = isAuthenticated && hasAllPermissions;
  }

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !user) {
      const loginUrl =
        pathname && pathname !== "/login"
          ? `/login?redirect=${encodeURIComponent(pathname)}`
          : "/login";

      router.replace(loginUrl);

      return;
    }

    /*
     * The user is authenticated but doesn't have
     * the permission required by this route.
     */
    if (!authorized) {
      router.replace("/unauthorized");
    }
  }, [isLoading, isAuthenticated, user, authorized, pathname, router]);

  /*
   * Do not render protected content while authentication
   * is being resolved.
   */
  if (isLoading) {
    if (loadingFallback) {
      return <>{loadingFallback}</>;
    }

    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]"
            aria-hidden="true"
          />

          <span>Checking access...</span>
        </div>
      </div>
    );
  }

  /*
   * Prevent protected content from flashing before
   * the redirect completes.
   */
  if (!isAuthenticated || !user || !authorized) {
    return null;
  }

  return <>{children}</>;
}

import { useCurrentUser } from "@/lib/current-user";

/*
 * What each role may DO in the screens.
 *
 * These rules mirror what the API already enforces, so a button is
 * hidden when the server would refuse it anyway. The API stays the
 * real security; this file only keeps the screen honest.
 */
export type PermissionAction =
  | "student.create"
  | "student.update"
  | "plan.manage"
  | "branch.manage"
  | "inquiry.update";

const RULES: Record<PermissionAction, string[]> = {
  "student.create": ["SUPER_ADMIN", "BRANCH_ADMIN"],
  "student.update": ["SUPER_ADMIN", "BRANCH_ADMIN"],
  "plan.manage": ["SUPER_ADMIN"],
  "branch.manage": ["SUPER_ADMIN"],
  "inquiry.update": ["SUPER_ADMIN", "BRANCH_ADMIN"],
};

/** Role key of the logged-in user, e.g. "COACH". */
export function useCurrentRole(): string | null {
  const user = useCurrentUser();

  return typeof user?.role === "string" ? user.role.toUpperCase() : null;
}

/** true when the logged-in user is allowed to do this action. */
export function useCan(action: PermissionAction): boolean {
  const role = useCurrentRole();

  return role !== null && RULES[action].includes(role);
}
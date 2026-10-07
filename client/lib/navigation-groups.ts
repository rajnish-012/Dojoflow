import {
  Building2,
  FileText,
  Folder,
  Layers,
  Settings,
  ShieldCheck,
} from "lucide-react";

export const NAVIGATION_GROUPS = [
  {
    id: "academy",
    label: "Academy",
    icon: Building2,
    keys: [
      "students",
      "plans",
      "curriculum",
      "attendance",
      "performance",
      "promotions",
      "progress",
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Layers,
    keys: [
      "makeups",
      "inquiries",
      "coach-assignments",
      "holidays",
      "branch-schedules",
    ],
  },
  {
    id: "content",
    label: "Content",
    icon: Folder,
    keys: ["website", "homepage", "gallery", "news", "sponsors"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileText,
    keys: ["reports", "analytics", "fees"],
  },
  {
    id: "administration",
    label: "Administration",
    icon: ShieldCheck,
    keys: [
      "branches",
      "roles",
      "modules",
      "users",
      "staff",
      "permissions",
      "training-session-types",
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    keys: [
      "settings",
      "academy-settings",
      "branding",
      "settings-branding",
      "settings-staff",
      "settings-maintenance",
      "settings-email",
    ],
  },
] as const;

export type NavigationGroupId = (typeof NAVIGATION_GROUPS)[number]["id"];
export type ModuleGroup = NavigationGroupId | "ungrouped";

export function getNavigationGroupId(item: {
  key: string;
  href: string;
  group?: string | null;
}): string | undefined {
  const explicitGroup = item.group?.trim();
  if (explicitGroup) {
    if (explicitGroup.toLowerCase() === "ungrouped") return undefined;
    const knownGroup = NAVIGATION_GROUPS.find(
      (group) => group.id === explicitGroup.toLowerCase() || group.label.toLowerCase() === explicitGroup.toLowerCase(),
    );
    return knownGroup?.id || `custom:${explicitGroup.toLocaleLowerCase()}`;
  }

  const key = item.key.toLowerCase();
  const href = item.href.toLowerCase();
  return NAVIGATION_GROUPS.find((group) =>
    group.keys.some(
      (candidate) =>
        key === candidate ||
        key.startsWith(`${candidate}-`) ||
        href.startsWith(`/website/${candidate}`),
    ),
  )?.id;
}

export function getNavigationSectionLabel(item: {
  key: string;
  href: string;
  group?: string | null;
}) {
  const explicitGroup = item.group?.trim();
  if (explicitGroup) {
    if (explicitGroup.toLowerCase() === "ungrouped") return "Other links";
    return NAVIGATION_GROUPS.find(
      (group) => group.id === explicitGroup.toLowerCase() || group.label.toLowerCase() === explicitGroup.toLowerCase(),
    )?.label || explicitGroup;
  }
  const groupId = getNavigationGroupId({ ...item, group: null });
  return NAVIGATION_GROUPS.find((group) => group.id === groupId)?.label || "Other links";
}

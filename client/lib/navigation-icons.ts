import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Dumbbell,
  FileText,
  Folder,
  GraduationCap,
  Home,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

/*
 * The sidebar stores only the icon NAME in the database.
 * Add an icon here to make it available in the Modules page.
 */
export const NAVIGATION_ICONS: Record<string, LucideIcon> = {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Dumbbell,
  FileText,
  Folder,
  GraduationCap,
  Home,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Users,
  Wallet,
};

export const NAVIGATION_ICON_NAMES = Object.keys(
  NAVIGATION_ICONS,
).sort();

export function getNavigationIcon(name?: string): LucideIcon {
  if (name && NAVIGATION_ICONS[name]) {
    return NAVIGATION_ICONS[name];
  }

  return LayoutGrid;
}
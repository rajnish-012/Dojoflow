"use client";

import { useMemo } from "react";
import {
  Award,
  CalendarDays,
  CalendarOff,
  GraduationCap,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge, EmptyState } from "@/components/ui";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendarApi";

type AcademyCalendarProps = {
  month: Date;
  events: CalendarEvent[];
  mode: "month" | "agenda";
  onSelect: (event: CalendarEvent) => void;
};

const EVENT_PRESENTATION: Record<CalendarEventType, { label: string; icon: typeof CalendarDays; className: string }> = {
  CLASS: { label: "Class", icon: GraduationCap, className: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200" },
  HOLIDAY: { label: "Holiday", icon: CalendarOff, className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200" },
  MAKEUP: { label: "Makeup", icon: RefreshCw, className: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200" },
  TRIAL: { label: "Trial", icon: Users, className: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200" },
  GRADING: { label: "Grading", icon: Award, className: "bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-200" },
  PROMOTION: { label: "Promotion", icon: Sparkles, className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" },
  ACADEMY_EVENT: { label: "Academy event", icon: CalendarDays, className: "bg-(--accent-soft) text-(--accent)" },
  COACH_LEAVE: { label: "Coach unavailable", icon: ShieldAlert, className: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200" },
  ANNOUNCEMENT: { label: "Announcement", icon: Megaphone, className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100" },
};

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(value: string) {
  if (!value) return "All day";
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

export function getCalendarEventPresentation(type: CalendarEventType) {
  return EVENT_PRESENTATION[type];
}

function EventButton({ item, onSelect, compact = false }: { item: CalendarEvent; onSelect: (event: CalendarEvent) => void; compact?: boolean }) {
  const presentation = EVENT_PRESENTATION[item.type];
  const Icon = presentation.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs font-semibold transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) ${presentation.className}`}
      title={`${presentation.label}: ${item.title}`}
    >
      <Icon size={compact ? 12 : 14} className="shrink-0" aria-hidden />
      <span className="truncate">{compact && item.start.time ? `${item.start.time} ` : ""}{item.title}</span>
    </button>
  );
}

export default function AcademyCalendar({ month, events, mode, onSelect }: AcademyCalendarProps) {
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const item of events) {
      const items = grouped.get(item.start.date) || [];
      items.push(item);
      grouped.set(item.start.date, items);
    }
    return grouped;
  }, [events]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const leading = first.getDay();
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: leading + lastDay }, (_, index) => index < leading ? null : new Date(month.getFullYear(), month.getMonth(), index - leading + 1));
  }, [month]);

  if (mode === "agenda") {
    return (
      <div className="space-y-3">
        {events.length ? events.map((item) => {
          const presentation = EVENT_PRESENTATION[item.type];
          const Icon = presentation.icon;
          return (
            <button key={item.id} type="button" onClick={() => onSelect(item)} className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-(--line) bg-(--card) p-4 text-left transition hover:border-(--line-strong) hover:bg-(--hover-bg)">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${presentation.className}`}><Icon size={19} aria-hidden /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-(--foreground)">{item.title}</p><Badge variant="neutral">{presentation.label}</Badge><Badge variant={item.status === "CANCELLED" ? "danger" : item.status === "COMPLETED" ? "success" : "neutral"}>{item.status.replaceAll("_", " ")}</Badge></div>
                <p className="mt-1 text-sm text-(--ink-muted)">{formatDate(item.start.date)} · {formatTime(item.start.time)}{item.end.time ? ` – ${formatTime(item.end.time)}` : ""}</p>
                <p className="mt-1 truncate text-xs text-(--ink-muted)">{[item.branch?.name, item.program?.name, item.coach?.name, item.location].filter(Boolean).join(" · ") || item.description}</p>
              </div>
            </button>
          );
        }) : <EmptyState icon={<CalendarDays size={24} />} title="No events in this range" description="Try another month or adjust the calendar filters." />}
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-(--line) bg-(--card)">
      <div className="min-w-[680px] md:min-w-0">
      <div className="grid grid-cols-7 border-b border-(--line) bg-(--surface) text-center text-[11px] font-bold uppercase tracking-wide text-(--ink-muted)">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => <div key={name} className="px-1 py-3 sm:px-3">{name}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          if (!day) return <div key={`blank-${index}`} className="min-h-[124px] border-b border-r border-(--line) bg-(--surface-muted)" aria-hidden />;
          const key = localDateKey(day);
          const items = eventsByDate.get(key) || [];
          const today = localDateKey(new Date()) === key;
          return (
            <div key={key} className="min-h-[124px] min-w-0 border-b border-r border-(--line) p-1.5 sm:p-2">
              <div className="mb-1 flex justify-end"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${today ? "bg-(--accent) text-white" : "text-(--ink-muted)"}`}>{day.getDate()}</span></div>
              <div className="space-y-1">{items.slice(0, 3).map((item) => <EventButton key={item.id} item={item} onSelect={onSelect} compact />)}{items.length > 3 && <button type="button" className="px-1 text-xs font-semibold text-(--accent)" onClick={() => onSelect(items[3])}>+{items.length - 3} more</button>}</div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-(--line) p-3 text-xs text-(--ink-muted)">{Object.entries(EVENT_PRESENTATION).filter(([type]) => events.some((item) => item.type === type)).map(([type, presentation]) => { const Icon = presentation.icon; return <span key={type} className="flex items-center gap-1.5"><Icon size={13} className="text-(--accent)" aria-hidden />{presentation.label}</span>; })}</div>
      </div>
    </div>
  );
}

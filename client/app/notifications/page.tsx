"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  CalendarCheck,
  Check,
  Clock3,
  Megaphone,
  Trophy,
  UserRoundPlus,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/notificationsApi";

type ReadFilter = "all" | "unread";

function iconForType(type: string) {
  if (type.startsWith("ATTENDANCE")) return CalendarCheck;
  if (type.startsWith("MAKEUP")) return Clock3;
  if (type.startsWith("PROMOTION")) return Trophy;
  if (type === "INQUIRY_RECEIVED") return Megaphone;
  if (type.startsWith("STUDENT")) return UserRoundPlus;
  return Activity;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<ReadFilter>("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getNotifications({
        page,
        limit: 20,
        read: filter === "unread" ? "false" : undefined,
      });
      setItems(result.notifications || []);
      setTotal(result.pagination?.total || 0);
      setUnreadCount(result.unreadCount || 0);
      setHasMore(Boolean(result.pagination?.hasMore));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const markRead = async (item: NotificationItem) => {
    if (item.read || savingId) return;
    setSavingId(item._id);
    try {
      await markNotificationRead(item._id);
      setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, read: true } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update notification.");
    } finally {
      setSavingId(null);
    }
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.read) await markRead(item);
    if (item.actionUrl?.startsWith("/") && !item.actionUrl.startsWith("//")) {
      router.push(item.actionUrl);
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update notifications.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="UPDATES"
        title="Notifications"
        description="Review important student, attendance, makeup, and academy activity."
        actions={(
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-(--line) bg-(--card) px-4 py-2.5 text-sm font-bold text-(--foreground-soft) shadow-sm hover:bg-(--hover-bg) disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={16} /> Mark all as read
          </button>
        )}
      />

      <section className="mt-6 overflow-hidden rounded-2xl border border-(--line) bg-(--card) shadow-sm">
        <div className="flex flex-col gap-3 border-b border-(--line) px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-base font-extrabold text-(--foreground)">Activity</h2>
            <p className="mt-1 text-xs text-(--ink-muted)">{unreadCount} unread · {total} shown in this view</p>
          </div>
          <div className="inline-flex w-fit rounded-xl border border-(--line) bg-(--surface) p-1" aria-label="Notification filter">
            {(["all", "unread"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => { setFilter(value); setPage(1); }}
                className={`rounded-lg px-3 py-2 text-xs font-bold capitalize transition ${filter === value ? "bg-(--accent) text-white shadow-sm" : "text-(--ink-muted) hover:text-(--foreground)"}`}
              >
                {value === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16"><LoadingSpinner text="Loading notifications..." /></div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm font-bold text-(--foreground)">Unable to load notifications.</p>
            <p className="mt-1 text-xs text-(--ink-muted)">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-4 rounded-lg bg-(--primary) px-4 py-2 text-sm font-bold text-(--primary-foreground)">Retry</button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Bell size={22} />}
              title={filter === "unread" ? "No unread notifications" : "You're all caught up."}
              description={filter === "unread" ? "Notifications that need your attention will appear here." : "New academy activity will appear here when it happens."}
            />
          </div>
        ) : (
          <div className="divide-y divide-(--line)">
            {items.map((item) => {
              const Icon = iconForType(item.type);
              const tone = item.severity === "ERROR" ? "text-(--danger) bg-(--danger-soft)" : item.severity === "WARNING" ? "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40" : item.severity === "SUCCESS" ? "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/40" : "text-(--accent) bg-(--accent-soft)";
              return (
                <article key={item._id} className={`flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-6 ${item.read ? "" : "bg-(--accent-soft)/25"}`}>
                  <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-sm font-bold text-(--foreground)">{item.title}</h3>
                      {!item.read && <span className="rounded-full bg-(--accent-soft) px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-(--accent)">Unread</span>}
                    </div>
                    <p className="mt-1 break-words text-sm leading-6 text-(--ink-muted)">{item.message}</p>
                    <time className="mt-2 block text-xs text-(--ink-faint)" dateTime={item.createdAt}>{formatTimestamp(item.createdAt)}</time>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {item.actionUrl && <button type="button" onClick={() => void openItem(item)} className="rounded-lg px-2.5 py-2 text-xs font-bold text-(--accent) hover:bg-(--accent-soft)">Open</button>}
                    {!item.read && <button type="button" disabled={savingId === item._id} onClick={() => void markRead(item)} aria-label={`Mark ${item.title} as read`} className="inline-flex items-center gap-1.5 rounded-lg border border-(--line) px-2.5 py-2 text-xs font-semibold text-(--foreground-soft) hover:bg-(--hover-bg) disabled:opacity-50"><Check size={13} /><span className="hidden sm:inline">Mark read</span></button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between border-t border-(--line) px-4 py-3 sm:px-6">
            <span className="text-xs text-(--ink-muted)">Page {page}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-(--line) px-3 py-2 text-xs font-bold text-(--foreground-soft) disabled:opacity-40">Previous</button>
              <button type="button" disabled={!hasMore} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-(--line) px-3 py-2 text-xs font-bold text-(--foreground-soft) disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

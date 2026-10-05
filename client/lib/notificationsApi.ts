import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

export type NotificationItem = {
  _id: string;
  type: string;
  title: string;
  message: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  read: boolean;
  readAt?: string | null;
  actionUrl?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type NotificationPage = {
  notifications: NotificationItem[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithSession(`${API_URL}/notifications${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to load notifications.");
  return data as T;
}

export function getNotifications(options: { page?: number; limit?: number; read?: "true" | "false" } = {}) {
  const query = new URLSearchParams();
  query.set("page", String(options.page || 1));
  query.set("limit", String(options.limit || 20));
  if (options.read) query.set("read", options.read);
  return request<NotificationPage>(`/?${query.toString()}`);
}

export function getUnreadNotificationCount() {
  return request<{ unreadCount: number }>("/unread-count");
}

export function markNotificationRead(id: string) {
  return request<{ notification: { _id: string; read: boolean; actionUrl?: string } }>(`/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead() {
  return request<{ modifiedCount: number }>("/read-all", { method: "PATCH" });
}

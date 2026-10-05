"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, Send, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  LoadingSpinner,
  PageHeader,
} from "@/components/ui";
import { fetchWithSession } from "@/lib/sessionFetch";
import { useCurrentUser } from "@/lib/current-user";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { toast } from "@/lib/toast";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

type EmailSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  fromName: string;
  fromEmail: string;
  notificationEmail: string;
  passwordConfigured: boolean;
  updatedAt?: string;
};

type EmailForm = Omit<EmailSettings, "passwordConfigured" | "updatedAt"> & {
  smtpPassword: string;
};

const emptyForm: EmailForm = {
  smtpHost: "smtp.gmail.com",
  smtpPort: 465,
  smtpSecure: true,
  smtpUsername: "",
  smtpPassword: "",
  fromName: "",
  fromEmail: "",
  notificationEmail: "",
};

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetchWithSession(
    `${API_URL}/settings/email-system${path}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || "Email settings request failed.");
  return data;
}

export default function EmailSystemSettings() {
  const user = useCurrentUser();
  const canManage = hasPermission(user, PERMISSIONS.SETTINGS_MANAGE);
  const [form, setForm] = useState<EmailForm>(emptyForm);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const data = await request("");
      const settings = data.settings as EmailSettings | null;
      if (settings) {
        setForm({
          smtpHost: settings.smtpHost || "",
          smtpPort: Number(settings.smtpPort) || 465,
          smtpSecure: Boolean(settings.smtpSecure),
          smtpUsername: settings.smtpUsername || "",
          smtpPassword: "",
          fromName: settings.fromName || "",
          fromEmail: settings.fromEmail || "",
          notificationEmail: settings.notificationEmail || "",
        });
        setPasswordConfigured(Boolean(settings.passwordConfigured));
        setDirty(false);
      } else {
        setForm(emptyForm);
        setPasswordConfigured(false);
        setDirty(false);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load email system settings.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (field: keyof EmailForm, value: string | number | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const data = await request("", "PUT", form);
      setPasswordConfigured(Boolean(data.settings?.passwordConfigured));
      setForm((current) => ({ ...current, smtpPassword: "" }));
      setDirty(false);
      toast.success("Email system settings saved.");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Unable to save email settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    try {
      setSendingTest(true);
      const data = await request("/test", "POST", {});
      toast.success(data.message || "Test email sent.");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Unable to send test email.",
      );
    } finally {
      setSendingTest(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  if (!canManage)
    return (
      <ErrorState
        title="Email settings unavailable"
        message="Your role does not have permission to manage email settings."
      />
    );
  if (error && !passwordConfigured && !form.smtpUsername) {
    return (
      <ErrorState
        title="Email settings unavailable"
        message={error}
        action={
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Workspace Settings"
        title="Email System"
        description="Configure the sender and recipient used for public inquiry notifications."
        actions={
          <Button
            variant="outline"
            onClick={() => void load(true)}
            disabled={refreshing}
            leftIcon={<RefreshCw size={15} />}
          >
            Refresh
          </Button>
        }
      />
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-(--line) p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
              <Mail size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-(--foreground)">
                SMTP connection
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-(--ink-muted)">
                SMTP credentials are encrypted in the database. The saved
                password is never displayed; leave it blank to keep the current
                one.
              </p>
            </div>
          </div>
          <Badge variant={passwordConfigured ? "success" : "warning"}>
            {passwordConfigured ? "Configured" : "Not configured"}
          </Badge>
        </div>

        <form onSubmit={save} className="space-y-6 p-5 sm:p-6">
          <fieldset disabled={!canManage || saving} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-(--foreground)">
                SMTP host <span className="text-red-600">*</span>
                <Input
                  required
                  maxLength={255}
                  autoComplete="url"
                  placeholder="smtp.gmail.com"
                  value={form.smtpHost}
                  onChange={(event) => update("smtpHost", event.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-(--foreground)">
                SMTP port <span className="text-red-600">*</span>
                <Input
                  required
                  type="number"
                  min={1}
                  max={65535}
                  value={form.smtpPort}
                  onChange={(event) =>
                    update("smtpPort", Number(event.target.value))
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-(--foreground)">
                SMTP username <span className="text-red-600">*</span>
                <Input
                  required
                  maxLength={320}
                  autoComplete="username"
                  placeholder="mailbox@example.com"
                  value={form.smtpUsername}
                  onChange={(event) =>
                    update("smtpUsername", event.target.value)
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-(--foreground)">
                SMTP password{" "}
                {!passwordConfigured && <span className="text-red-600">*</span>}
                <Input
                  required={!passwordConfigured}
                  type="password"
                  maxLength={500}
                  autoComplete="new-password"
                  placeholder={
                    passwordConfigured
                      ? "Saved securely — enter a new value to replace"
                      : "Enter SMTP or app password"
                  }
                  value={form.smtpPassword}
                  onChange={(event) =>
                    update("smtpPassword", event.target.value)
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-(--foreground)">
                Sender name
                <Input
                  maxLength={120}
                  placeholder="Your Academy"
                  value={form.fromName}
                  onChange={(event) => update("fromName", event.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-(--foreground)">
                Sender email <span className="text-red-600">*</span>
                <Input
                  required
                  type="email"
                  maxLength={320}
                  autoComplete="email"
                  placeholder="academy@example.com"
                  value={form.fromEmail}
                  onChange={(event) => update("fromEmail", event.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-(--foreground) sm:col-span-2">
                Inquiry notification email{" "}
                <span className="text-red-600">*</span>
                <Input
                  required
                  type="email"
                  maxLength={320}
                  autoComplete="email"
                  placeholder="Where new inquiries should be delivered"
                  value={form.notificationEmail}
                  onChange={(event) =>
                    update("notificationEmail", event.target.value)
                  }
                />
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-(--line) p-4 text-sm text-(--foreground)">
              <input
                className="mt-0.5 h-4 w-4 accent-(--accent)"
                type="checkbox"
                checked={form.smtpSecure}
                onChange={(event) => update("smtpSecure", event.target.checked)}
              />
              <span>
                <span className="block font-semibold">
                  Use secure SMTP connection (TLS)
                </span>
                <span className="mt-1 block text-(--ink-muted)">
                  Typically enabled for port 465; for port 587, use the
                  provider’s STARTTLS configuration.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex flex-col-reverse gap-3 border-t border-(--line) pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-(--ink-muted)">
              <ShieldCheck size={15} /> Password is encrypted and never sent
              back to this page.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={
                  !canManage ||
                  !passwordConfigured ||
                  dirty ||
                  sendingTest ||
                  saving
                }
                loading={sendingTest}
                leftIcon={<Send size={15} />}
                onClick={() => void sendTest()}
              >
                Send test email
              </Button>
              <Button
                type="submit"
                disabled={!canManage || saving}
                loading={saving}
              >
                Save email settings
              </Button>
            </div>
          </div>
          {dirty && passwordConfigured && (
            <p className="text-right text-xs text-(--ink-muted)">
              Save your changes before sending a test email.
            </p>
          )}
        </form>
      </Card>
      <p className="mt-4 text-xs leading-5 text-(--ink-muted)">
        For Gmail, use an App Password with 2-Step Verification enabled. Email
        is sent only after the inquiry has been saved; a mail delivery issue
        will not discard the inquiry.
      </p>
    </div>
  );
}

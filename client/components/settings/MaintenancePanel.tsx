"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Database, RefreshCw, ShieldAlert } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingSpinner,
  Modal,
  Textarea,
} from "@/components/ui";
import {
  getMaintenanceState,
  getSystemHealth,
  updateMaintenanceState,
} from "@/lib/maintenanceApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";

type MaintenanceState = {
  enabled: boolean;
  message: string;
  startedAt?: string | null;
  endsAt?: string | null;
  updatedAt?: string | null;
};

type HealthItem = {
  status: string;
  detail: string;
  name?: string | null;
};

type Health = {
  api: HealthItem;
  database: HealthItem;
  authentication: HealthItem;
  checkedAt: string;
};

function badgeVariant(
  status?: string,
): "success" | "danger" | "warning" | "neutral" {
  if (status === "HEALTHY" || status === "CONNECTED") return "success";
  if (status === "ERROR") return "danger";
  if (status === "DEGRADED") return "warning";
  return "neutral";
}

const unavailableServices = [
  { label: "Storage", detail: "Storage monitoring has not been configured." },
  {
    label: "Background jobs",
    detail: "Job monitoring has not been configured.",
  },
] as const;

export default function MaintenancePanel() {
  const canCheckHealth = useCan(PERMISSIONS.MAINTENANCE_HEALTH);
  const canManageMode = useCan(PERMISSIONS.MAINTENANCE_MODE);
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError("");

        const settingsResult = await getMaintenanceState();
        const settings = settingsResult.settings as MaintenanceState;
        setState(settings);
        setMessage(settings?.message ?? "");

        if (canCheckHealth) {
          const healthResult = await getSystemHealth();
          setHealth((healthResult.health as Health) ?? null);
        } else {
          setHealth(null);
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load maintenance settings.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canCheckHealth],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const saveMode = async () => {
    if (!state) return;

    try {
      setSaving(true);
      setError("");
      const result = await updateMaintenanceState({
        enabled: !state.enabled,
        message,
      });
      const settings = result.settings as MaintenanceState;
      setState(settings);
      setMessage(settings.message);
      setIsModalOpen(false);
      toast.success(
        settings.enabled
          ? "Maintenance mode enabled."
          : "Maintenance mode disabled.",
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Unable to update maintenance mode.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex min-h-56 items-center justify-center">
        <LoadingSpinner />
      </Card>
    );
  }

  if (error && !state) {
    return (
      <ErrorState
        title="Maintenance settings unavailable"
        message={error}
        action={
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        }
      />
    );
  }

  const maintenanceEnabled = Boolean(state?.enabled);
  const healthItems = health
    ? [
        { label: "API", item: health.api },
        { label: "Database", item: health.database },
        { label: "Authentication", item: health.authentication },
      ]
    : [];

  return (
    <div className="space-y-5">
      {error && (
        <ErrorState
          title="Update failed"
          message={error}
          action={
            <Button variant="outline" onClick={() => void load(true)}>
              Refresh status
            </Button>
          }
        />
      )}

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => void load(true)}
          loading={refreshing}
        >
          <RefreshCw size={16} />
          Refresh status
        </Button>
      </div>

      {canCheckHealth && (
        <Card className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[var(--accent-soft)] p-2.5 text-[var(--accent)]">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text)]">
                System health
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                Current status of core ForceStrike services.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {healthItems.map(({ label, item }) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--line)] p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium text-[var(--text)]">{label}</p>
                  <Badge variant={badgeVariant(item.status)}>
                    {item.status}
                  </Badge>
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  {item.detail}
                </p>
                {item.name && (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {item.name}
                  </p>
                )}
              </div>
            ))}
          </div>

          {health?.checkedAt && (
            <p className="text-xs text-[var(--text-muted)]">
              Last checked {new Date(health.checkedAt).toLocaleString()}
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[var(--danger-soft)] p-2.5 text-[var(--danger)]">
              <ShieldAlert size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text)]">
                  Maintenance mode
                </h3>
                <Badge variant={maintenanceEnabled ? "warning" : "success"}>
                  {maintenanceEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Temporarily restrict access while important operational work is
                in progress.
              </p>
            </div>
          </div>

          {state?.updatedAt && (
            <p className="text-sm text-[var(--text-muted)]">
              Last updated {new Date(state.updatedAt).toLocaleString()}
            </p>
          )}

          {canManageMode && (
            <Button
              variant={maintenanceEnabled ? "outline" : "danger"}
              onClick={() => setIsModalOpen(true)}
            >
              {maintenanceEnabled
                ? "Disable maintenance mode"
                : "Enable maintenance mode"}
            </Button>
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 text-[var(--text-muted)]">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text)]">
                Operational services
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                Additional integrations.
              </p>
            </div>
          </div>
          {unavailableServices.map((service) => (
            <div
              key={service.label}
              className="rounded-lg border border-[var(--line)] p-3"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-medium text-[var(--text)]">
                  {service.label}
                </p>
                <Badge variant="neutral">Not configured</Badge>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {service.detail}
              </p>
            </div>
          ))}
        </Card>
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={
          maintenanceEnabled
            ? "Disable maintenance mode?"
            : "Enable maintenance mode?"
        }
        description={
          maintenanceEnabled
            ? "Normal access will be restored for users."
            : "Use this only when planned work requires a temporary maintenance window."
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant={maintenanceEnabled ? "primary" : "danger"}
              onClick={() => void saveMode()}
              loading={saving}
            >
              {maintenanceEnabled ? "Disable mode" : "Enable mode"}
            </Button>
          </>
        }
      >
        <label className="block space-y-2 text-sm font-medium text-[var(--text)]">
          Maintenance message
          <Textarea
            className="min-h-24"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={500}
            placeholder="Tell users what is happening and when to return."
          />
        </label>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Users,
  X,
  XCircle,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  PageHeader,
  SummaryCard,
} from "@/components/ui";

import {
  getMakeups,
  completeMakeup,
  cancelMakeup,
  type Makeup,
  type MakeupStatus,
} from "@/lib/api";

type FilterStatus = "ALL" | MakeupStatus;

function getStudentName(makeup: Makeup) {
  if (
    typeof makeup.student === "object" &&
    makeup.student !== null
  ) {
    return makeup.student.name;
  }

  return "Unknown Student";
}

function getStudentPhone(makeup: Makeup) {
  if (
    typeof makeup.student === "object" &&
    makeup.student !== null
  ) {
    return makeup.student.phone || "";
  }

  return "";
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST"
  );
}

function formatDate(date?: string) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusVariant(status: MakeupStatus) {
  switch (status) {
    case "SCHEDULED":
      return "warning" as const;

    case "COMPLETED":
      return "success" as const;

    case "CANCELLED":
      return "danger" as const;

    default:
      return "neutral" as const;
  }
}

function getStatusIcon(status: MakeupStatus) {
  switch (status) {
    case "SCHEDULED":
      return <Clock3 size={13} />;

    case "COMPLETED":
      return <Check size={13} />;

    case "CANCELLED":
      return <X size={13} />;

    default:
      return null;
  }
}

function getStatusLabel(status: MakeupStatus) {
  return (
    status.charAt(0) +
    status.slice(1).toLowerCase()
  );
}

export default function MakeupsPage() {
  const [makeups, setMakeups] = useState<Makeup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<FilterStatus>("ALL");

  const [search, setSearch] = useState("");

  async function loadMakeups(
    showRefreshLoader = false,
  ) {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await getMakeups();

      setMakeups(
        Array.isArray(response?.makeups)
          ? response.makeups
          : [],
      );
    } catch (loadError: unknown) {
      console.error(
        "Makeups loading error:",
        loadError,
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load makeup classes.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadMakeups();
  }, []);

  async function handleComplete(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to mark this makeup class as completed?",
    );

    if (!confirmed) return;

    try {
      setActionLoading(id);
      setError("");
      setSuccess("");

      await completeMakeup(id);

      setSuccess(
        "Makeup class marked as completed successfully.",
      );

      await loadMakeups();
    } catch (completeError: unknown) {
      console.error(
        "Complete makeup error:",
        completeError,
      );

      setError(
        completeError instanceof Error
          ? completeError.message
          : "Failed to complete makeup class.",
      );
    } finally {
      setActionLoading("");
    }
  }

  async function handleCancel(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this makeup class?",
    );

    if (!confirmed) return;

    try {
      setActionLoading(id);
      setError("");
      setSuccess("");

      await cancelMakeup(id);

      setSuccess(
        "Makeup class cancelled successfully.",
      );

      await loadMakeups();
    } catch (cancelError: unknown) {
      console.error(
        "Cancel makeup error:",
        cancelError,
      );

      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Failed to cancel makeup class.",
      );
    } finally {
      setActionLoading("");
    }
  }

  const statistics = useMemo(
    () => ({
      total: makeups.length,
      scheduled: makeups.filter(
        (makeup) => makeup.status === "SCHEDULED",
      ).length,
      completed: makeups.filter(
        (makeup) => makeup.status === "COMPLETED",
      ).length,
      cancelled: makeups.filter(
        (makeup) => makeup.status === "CANCELLED",
      ).length,
    }),
    [makeups],
  );

  const filteredMakeups = useMemo(() => {
    const searchValue = search
      .toLowerCase()
      .trim();

    return makeups.filter((makeup) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        makeup.status === statusFilter;

      const studentName =
        getStudentName(makeup).toLowerCase();

      const studentPhone =
        getStudentPhone(makeup).toLowerCase();

      const matchesSearch =
        !searchValue ||
        studentName.includes(searchValue) ||
        studentPhone.includes(searchValue);

      return matchesStatus && matchesSearch;
    });
  }, [makeups, statusFilter, search]);

  const scheduledPercentage =
    statistics.total > 0
      ? Math.round(
          (statistics.scheduled /
            statistics.total) *
            100,
        )
      : 0;

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6">
        <LoadingSpinner
          text="Loading makeup classes..."
        />
      </div>
    );
  }

  return (
    <div
      className="
        min-h-screen
        bg-(--background)
        px-4
        py-6
        text-(--foreground)
        transition-colors
        duration-300
        sm:px-6
        lg:px-8
      "
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <PageHeader
          eyebrow="Academy Management"
          title="Makeup Classes"
          description="Manage scheduled, completed, and cancelled makeup classes."
          actions={
            <Button
              variant="secondary"
              onClick={() => void loadMakeups(true)}
              disabled={refreshing}
              leftIcon={
                <RefreshCw
                  size={17}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />
              }
            >
              Refresh
            </Button>
          }
        />

        {error && (
          <div
            className="
              mb-6
              flex
              items-start
              justify-between
              gap-4
              rounded-2xl
              border
              border-(--danger-border)
              bg-(--danger-soft)
              p-4
              text-(--danger)
            "
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 transition hover:bg-(--danger-soft)"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div
            className="
              mb-6
              flex
              items-start
              justify-between
              gap-4
              rounded-2xl
              border
              border-(--success-border)
              bg-(--success-soft)
              p-4
              text-(--success)
            "
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">
                {success}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="rounded-lg p-1 transition hover:bg-(--success-soft)"
              aria-label="Dismiss success message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Makeups"
            value={statistics.total}
            subtitle="All makeup class records"
            icon={<Users size={20} />}
          />

          <SummaryCard
            title="Scheduled"
            value={statistics.scheduled}
            subtitle="Upcoming makeup classes"
            icon={<Clock3 size={20} />}
          />

          <SummaryCard
            title="Completed"
            value={statistics.completed}
            subtitle="Successfully completed classes"
            icon={<CheckCircle2 size={20} />}
          />

          <SummaryCard
            title="Cancelled"
            value={statistics.cancelled}
            subtitle="Cancelled makeup classes"
            icon={<XCircle size={20} />}
          />
        </div>

        <Card className="mb-6 p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  "ALL",
                  "SCHEDULED",
                  "COMPLETED",
                  "CANCELLED",
                ] as FilterStatus[]
              ).map((status) => {
                const active =
                  statusFilter === status;

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      setStatusFilter(status)
                    }
                    className={`
                      rounded-xl
                      border
                      px-4
                      py-2.5
                      text-sm
                      font-semibold
                      transition
                      ${
                        active
                          ? "border-(--foreground) bg-(--foreground) text-(--background)"
                          : "border-(--line) bg-(--surface) text-(--ink-muted) hover:border-(--accent) hover:text-(--foreground)"
                      }
                    `}
                  >
                    {status === "ALL"
                      ? "All"
                      : getStatusLabel(status)}
                  </button>
                );
              })}
            </div>

            <div className="w-full lg:w-80">
              <Input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search student..."
                leftIcon={
                  <Search size={17} />
                }
              />
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-col justify-between gap-3 border-b border-(--line) px-6 py-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-(--accent)">
                  Recent Records
                </p>

                <h2 className="mt-1 text-lg font-bold text-(--foreground)">
                  Makeup Records
                </h2>

                <p className="mt-1 text-sm text-(--ink-muted)">
                  Manage all scheduled and completed makeup classes.
                </p>
              </div>

              <Badge variant="accent">
                {filteredMakeups.length} Records
              </Badge>
            </div>

            {filteredMakeups.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={26} />}
                title="No makeup classes found"
                description="Try changing the filter or search term."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full">
                  <thead>
                    <tr className="border-b border-(--line) bg-(--surface)">
                      {[
                        "Student",
                        "Original Date",
                        "Makeup Date",
                        "Plan Day",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="
                            px-6
                            py-4
                            text-left
                            text-xs
                            font-bold
                            uppercase
                            tracking-[0.08em]
                            text-(--ink-muted)
                          "
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMakeups.map(
                      (makeup) => {
                        const studentName =
                          getStudentName(makeup);

                        const phone =
                          getStudentPhone(makeup);

                        const isActionLoading =
                          actionLoading ===
                          makeup._id;

                        return (
                          <tr
                            key={makeup._id}
                            className="
                              border-b
                              border-(--line)
                              transition
                              last:border-b-0
                              hover:bg-(--hover-bg)
                            "
                          >
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div
                                  className="
                                    flex
                                    h-10
                                    w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-full
                                    border
                                    border-(--line)
                                    bg-(--accent-soft)
                                    text-xs
                                    font-bold
                                    text-(--accent)
                                  "
                                >
                                  {getInitials(
                                    studentName,
                                  )}
                                </div>

                                <div>
                                  <p className="text-sm font-bold text-(--foreground)">
                                    {studentName}
                                  </p>

                                  {phone && (
                                    <p className="mt-1 text-xs text-(--ink-muted)">
                                      {phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="whitespace-nowrap px-6 py-5 text-sm text-(--ink-muted)">
                              {formatDate(
                                makeup.originalDate,
                              )}
                            </td>

                            <td className="whitespace-nowrap px-6 py-5 text-sm text-(--ink-muted)">
                              {formatDate(
                                makeup.makeupDate,
                              )}
                            </td>

                            <td className="whitespace-nowrap px-6 py-5 text-sm font-semibold text-(--foreground)">
                              Day {makeup.planDay}
                            </td>

                            <td className="px-6 py-5">
                              <Badge
                                variant={getStatusVariant(
                                  makeup.status,
                                )}
                                className="gap-1.5"
                              >
                                {getStatusIcon(
                                  makeup.status,
                                )}
                                {getStatusLabel(
                                  makeup.status,
                                )}
                              </Badge>
                            </td>

                            <td className="px-6 py-5">
                              {makeup.status ===
                              "SCHEDULED" ? (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="success"
                                    disabled={
                                      isActionLoading
                                    }
                                    onClick={() =>
                                      void handleComplete(
                                        makeup._id,
                                      )
                                    }
                                    leftIcon={
                                      isActionLoading ? (
                                        <RefreshCw
                                          size={14}
                                          className="animate-spin"
                                        />
                                      ) : (
                                        <Check
                                          size={14}
                                        />
                                      )
                                    }
                                  >
                                    Complete
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="danger"
                                    disabled={
                                      isActionLoading
                                    }
                                    onClick={() =>
                                      void handleCancel(
                                        makeup._id,
                                      )
                                    }
                                    leftIcon={
                                      <X size={14} />
                                    }
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-(--ink-faint)">
                                  No actions
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-(--line) px-6 py-4">
              <p className="text-sm text-(--ink-muted)">
                Showing{" "}
                <span className="font-bold text-(--foreground)">
                  {filteredMakeups.length}
                </span>{" "}
                of{" "}
                <span className="font-bold text-(--foreground)">
                  {makeups.length}
                </span>{" "}
                makeup classes
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div>
              <p className="text-sm font-semibold text-(--accent)">
                Overview
              </p>

              <h2 className="mt-1 text-lg font-bold text-(--foreground)">
                Makeup Overview
              </h2>

              <p className="mt-1 text-sm text-(--ink-muted)">
                Summary of your makeup class records
              </p>
            </div>

            <div className="mt-8 flex justify-center">
              <div
                className="
                  relative
                  flex
                  h-44
                  w-44
                  items-center
                  justify-center
                  rounded-full
                "
                style={{
                  background:
                    statistics.total > 0
                      ? `conic-gradient(var(--gold) ${scheduledPercentage}%, var(--line) 0)`
                      : "var(--line)",
                }}
              >
                <div
                  className="
                    flex
                    h-36
                    w-36
                    flex-col
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-(--line)
                    bg-(--card)
                  "
                >
                  <span className="text-3xl font-bold text-(--foreground)">
                    {scheduledPercentage}%
                  </span>

                  <span className="mt-1 text-sm text-(--ink-muted)">
                    Scheduled
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-(--surface) px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-(--gold)" />
                  <span className="text-sm text-(--ink-muted)">
                    Scheduled
                  </span>
                </div>

                <span className="text-sm font-bold text-(--foreground)">
                  {statistics.scheduled}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-(--surface) px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-(--green)" />
                  <span className="text-sm text-(--ink-muted)">
                    Completed
                  </span>
                </div>

                <span className="text-sm font-bold text-(--foreground)">
                  {statistics.completed}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-(--surface) px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-(--danger)" />
                  <span className="text-sm text-(--ink-muted)">
                    Cancelled
                  </span>
                </div>

                <span className="text-sm font-bold text-(--foreground)">
                  {statistics.cancelled}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-(--line) pt-5">
                <span className="text-sm text-(--ink-muted)">
                  Total Records
                </span>

                <span className="text-sm font-bold text-(--foreground)">
                  {statistics.total}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

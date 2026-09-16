"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  RefreshCw,
  Search,
  Users,
  X,
  XCircle,
} from "lucide-react";

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
  if (!date) {
    return "—";
  }

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

function getStatusClasses(status: MakeupStatus) {
  switch (status) {
    case "SCHEDULED":
      return "bg-amber-50 text-amber-700";

    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700";

    case "CANCELLED":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
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

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_4px_18px_rgba(16,26,51,0.035)]">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <span className="text-sm font-medium text-slate-400">
          DojoFlow
        </span>
      </div>

      <div className="mt-5">
        <p className="text-sm text-slate-500">
          {title}
        </p>

        <p className="mt-1 text-2xl font-bold text-slate-900">
          {value}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {description}
        </p>
      </div>
    </div>
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

      setMakeups(response.makeups || []);
    } catch (loadError) {
      console.error("Makeups loading error:", loadError);

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
    loadMakeups();
  }, []);

  async function handleComplete(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to mark this makeup class as completed?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(id);
      setError("");
      setSuccess("");

      await completeMakeup(id);

      setSuccess(
        "Makeup class marked as completed successfully.",
      );

      await loadMakeups();
    } catch (completeError) {
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

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(id);
      setError("");
      setSuccess("");

      await cancelMakeup(id);

      setSuccess("Makeup class cancelled successfully.");

      await loadMakeups();
    } catch (cancelError) {
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

  const statistics = useMemo(() => {
    return {
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
    };
  }, [makeups]);

  const filteredMakeups = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

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

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading makeup classes...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
              <ClipboardCheck className="h-4 w-4" />
              Academy Management
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Makeup Classes
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage scheduled, completed, and cancelled makeup classes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadMakeups(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={
                refreshing ? "animate-spin" : ""
              }
            />
            Refresh
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <p className="text-sm text-emerald-700">
                {success}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="text-emerald-600 hover:text-emerald-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Makeups"
            value={statistics.total}
            description="All makeup class records"
            icon={Users}
            iconClass="bg-slate-100 text-slate-700"
          />

          <SummaryCard
            title="Scheduled"
            value={statistics.scheduled}
            description="Upcoming makeup classes"
            icon={Clock3}
            iconClass="bg-amber-50 text-amber-600"
          />

          <SummaryCard
            title="Completed"
            value={statistics.completed}
            description="Successfully completed classes"
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Cancelled"
            value={statistics.cancelled}
            description="Cancelled makeup classes"
            icon={XCircle}
            iconClass="bg-red-50 text-red-600"
          />
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  "ALL",
                  "SCHEDULED",
                  "COMPLETED",
                  "CANCELLED",
                ] as FilterStatus[]
              ).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    statusFilter === status
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {status === "ALL"
                    ? "All"
                    : getStatusLabel(status)}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-80">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search student..."
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-orange-600">
                  Recent Records
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Makeup Records
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Manage all scheduled and completed makeup classes.
                </p>
              </div>

              <span className="w-fit rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">
                {filteredMakeups.length} Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Student
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Original Date
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Makeup Date
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Plan Day
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredMakeups.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-16 text-center"
                      >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <CalendarDays size={27} />
                        </div>

                        <p className="mt-4 text-sm font-semibold text-slate-800">
                          No makeup classes found
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Try changing the filter or search term.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredMakeups.map((makeup) => {
                      const studentName =
                        getStudentName(makeup);

                      const isActionLoading =
                        actionLoading === makeup._id;

                      return (
                        <tr
                          key={makeup._id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                                {getInitials(studentName)}
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {studentName}
                                </p>

                                {getStudentPhone(makeup) && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {getStudentPhone(makeup)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-600">
                            {formatDate(makeup.originalDate)}
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-600">
                            {formatDate(makeup.makeupDate)}
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-600">
                            Day {makeup.planDay}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${getStatusClasses(
                                makeup.status,
                              )}`}
                            >
                              {getStatusIcon(makeup.status)}
                              {getStatusLabel(makeup.status)}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            {makeup.status === "SCHEDULED" ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={isActionLoading}
                                  onClick={() =>
                                    handleComplete(makeup._id)
                                  }
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isActionLoading ? (
                                    <RefreshCw
                                      size={14}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Check size={14} />
                                  )}

                                  Complete
                                </button>

                                <button
                                  type="button"
                                  disabled={isActionLoading}
                                  onClick={() =>
                                    handleCancel(makeup._id)
                                  }
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <X size={14} />
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                No actions
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {filteredMakeups.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {makeups.length}
                </span>{" "}
                makeup classes
              </p>
            </div>
          </div>

          {/* Overview */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium text-orange-600">
                Overview
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-950">
                Makeup Overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Summary of your makeup class records
              </p>
            </div>

            <div className="mt-8 flex justify-center">
              <div
                className="relative flex h-44 w-44 items-center justify-center rounded-full"
                style={{
                  background:
                    statistics.total > 0
                      ? `conic-gradient(#f59e0b ${
                          (statistics.scheduled /
                            statistics.total) *
                          100
                        }%, #e2e8f0 0)`
                      : "#e2e8f0",
                }}
              >
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-3xl font-bold text-slate-900">
                    {statistics.total > 0
                      ? Math.round(
                          (statistics.scheduled /
                            statistics.total) *
                            100,
                        )
                      : 0}
                    %
                  </span>

                  <span className="mt-1 text-sm text-slate-500">
                    Scheduled
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-sm text-slate-600">
                    Scheduled
                  </span>
                </div>

                <span className="text-sm font-semibold text-slate-900">
                  {statistics.scheduled}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-600">
                    Completed
                  </span>
                </div>

                <span className="text-sm font-semibold text-slate-900">
                  {statistics.completed}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-sm text-slate-600">
                    Cancelled
                  </span>
                </div>

                <span className="text-sm font-semibold text-slate-900">
                  {statistics.cancelled}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <span className="text-sm text-slate-600">
                  Total Records
                </span>

                <span className="text-sm font-semibold text-slate-900">
                  {statistics.total}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
} from "@/components/ui";

import {
  getInquiries,
  updateInquiryStatus,
} from "@/lib/api";

type UserRole =
  | "SUPER_ADMIN"
  | "BRANCH_ADMIN"
  | "COACH"
  | "STUDENT";

type InquiryStatus =
  | "NEW"
  | "CONTACTED"
  | "ENROLLED"
  | "CLOSED";

type Inquiry = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  age?: number;
  currentBelt?: string;
  experience?: string;
  preferredBatch?: string;
  preferredBranch?: string;
  message?: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
};

const STATUS_ORDER: InquiryStatus[] = [
  "NEW",
  "CONTACTED",
  "ENROLLED",
  "CLOSED",
];

const STATUS_CONFIG: Record<
  InquiryStatus,
  {
    label: string;
    description: string;
    icon: typeof Clock3;
  }
> = {
  NEW: {
    label: "New",
    description: "Awaiting first contact",
    icon: AlertCircle,
  },
  CONTACTED: {
    label: "Contacted",
    description: "Follow-up in progress",
    icon: Clock3,
  },
  ENROLLED: {
    label: "Enrolled",
    description: "Ready for admission",
    icon: CheckCircle2,
  },
  CLOSED: {
    label: "Closed",
    description: "Completed or inactive",
    icon: CheckCircle2,
  },
};

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function formatDate(date?: string) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date?: string) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRelativeTime(date?: string) {
  if (!date) {
    return "";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const difference = Date.now() - parsed.getTime();

  if (difference < 60 * 1000) {
    return "Just now";
  }

  const minutes = Math.floor(
    difference / (60 * 1000),
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 30) {
    return `${days}d ago`;
  }

  return formatDate(date);
}

function getStatusClasses(status: InquiryStatus) {
  switch (status) {
    case "NEW":
      return {
        wrapper:
          "border-blue-200 bg-blue-50 text-blue-700",
        icon: "bg-blue-100 text-blue-700",
      };

    case "CONTACTED":
      return {
        wrapper:
          "border-amber-200 bg-amber-50 text-amber-700",
        icon: "bg-amber-100 text-amber-700",
      };

    case "ENROLLED":
      return {
        wrapper:
          "border-green-200 bg-green-50 text-green-700",
        icon: "bg-green-100 text-green-700",
      };

    case "CLOSED":
    default:
      return {
        wrapper:
          "border-(--line) bg-(--surface) text-(--ink-muted)",
        icon:
          "bg-(--background) text-(--ink-muted)",
      };
  }
}

function StatusBadge({
  status,
}: {
  status: InquiryStatus;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const classes = getStatusClasses(status);

  return (
    <span
      className={`
        inline-flex
        items-center
        gap-1.5
        rounded-full
        border
        px-3
        py-1.5
        text-xs
        font-bold
        ${classes.wrapper}
      `}
    >
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function TableHeading({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`
        px-6
        py-4
        text-[11px]
        font-black
        uppercase
        tracking-[0.14em]
        text-(--ink-muted)
        ${align === "right" ? "text-right" : "text-left"}
      `}
    >
      {children}
    </th>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-(--accent-soft)
          text-(--accent)
        "
      >
        <Icon size={16} />
      </div>

      <div className="min-w-0">
        <p
          className="
            text-[10px]
            font-bold
            uppercase
            tracking-[0.14em]
            text-(--ink-faint)
          "
        >
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-semibold text-(--foreground)">
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="
        rounded-xl
        border
        border-(--line)
        bg-(--surface)
        p-4
      "
    >
      <p
        className="
          text-[10px]
          font-bold
          uppercase
          tracking-[0.14em]
          text-(--ink-faint)
        "
      >
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-semibold text-(--foreground)">
        {value}
      </p>
    </div>
  );
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<
    Inquiry[]
  >([]);

  const [selectedInquiry, setSelectedInquiry] =
    useState<Inquiry | null>(null);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<"ALL" | InquiryStatus>("ALL");

  const [userRole, setUserRole] =
    useState<UserRole | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [isUpdatingStatus, setIsUpdatingStatus] =
    useState(false);

  const [error, setError] = useState("");

  const [statusError, setStatusError] =
    useState("");

  useEffect(() => {
    const storedUser =
      localStorage.getItem("user") ||
      localStorage.getItem("dojoUser") ||
      localStorage.getItem("currentUser");

    if (!storedUser) {
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);

      if (parsedUser?.role) {
        setUserRole(
          parsedUser.role as UserRole,
        );
      }
    } catch (parseError) {
      console.error(
        "Failed to read stored user:",
        parseError,
      );
    }
  }, []);

  const fetchInquiries = async (
    isRefresh = false,
  ) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError("");

    try {
      const data = await getInquiries();

      setInquiries(
        Array.isArray(data?.inquiries)
          ? data.inquiries
          : [],
      );
    } catch (fetchError: unknown) {
      console.error(
        "Fetch inquiries error:",
        fetchError,
      );

      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load inquiries.",
      );
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchInquiries();
  }, []);

  const canUpdateStatus =
    userRole === "SUPER_ADMIN" ||
    userRole === "BRANCH_ADMIN";

  const filteredInquiries = useMemo(() => {
    const search =
      searchTerm.trim().toLowerCase();

    return inquiries.filter((inquiry) => {
      const matchesSearch =
        !search ||
        inquiry.fullName
          .toLowerCase()
          .includes(search) ||
        inquiry.email
          .toLowerCase()
          .includes(search) ||
        inquiry.phone
          .toLowerCase()
          .includes(search) ||
        Boolean(
          inquiry.preferredBranch
            ?.toLowerCase()
            .includes(search),
        ) ||
        Boolean(
          inquiry.currentBelt
            ?.toLowerCase()
            .includes(search),
        ) ||
        Boolean(
          inquiry.preferredBatch
            ?.toLowerCase()
            .includes(search),
        );

      const matchesStatus =
        statusFilter === "ALL" ||
        inquiry.status === statusFilter;

      return (
        matchesSearch && matchesStatus
      );
    });
  }, [
    inquiries,
    searchTerm,
    statusFilter,
  ]);

  const statusCounts = useMemo(() => {
    return {
      total: inquiries.length,
      new: inquiries.filter(
        (item) => item.status === "NEW",
      ).length,
      contacted: inquiries.filter(
        (item) => item.status === "CONTACTED",
      ).length,
      enrolled: inquiries.filter(
        (item) => item.status === "ENROLLED",
      ).length,
      closed: inquiries.filter(
        (item) => item.status === "CLOSED",
      ).length,
    };
  }, [inquiries]);

  const handleStatusUpdate = async (
    newStatus: InquiryStatus,
  ) => {
    if (!selectedInquiry) {
      return;
    }

    if (!canUpdateStatus) {
      return;
    }

    if (
      selectedInquiry.status === newStatus
    ) {
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError("");

    try {
      const data =
        await updateInquiryStatus(
          selectedInquiry._id,
          newStatus,
        );

      const updatedInquiry: Inquiry =
        data?.inquiry;

      if (!updatedInquiry) {
        throw new Error(
          "The server did not return the updated inquiry.",
        );
      }

      setInquiries(
        (currentInquiries) =>
          currentInquiries.map(
            (inquiry) =>
              inquiry._id ===
              updatedInquiry._id
                ? updatedInquiry
                : inquiry,
          ),
      );

      setSelectedInquiry(updatedInquiry);
    } catch (updateError: unknown) {
      console.error(
        "Update inquiry status error:",
        updateError,
      );

      setStatusError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update inquiry status.",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
  };

  const closeModal = () => {
    setSelectedInquiry(null);
    setStatusError("");
  };

  return (
    <main>
      <div className="df-page">
        <PageHeader
          eyebrow="Academy Management"
          title="Student Inquiries"
          description="Manage prospective students from first enquiry through follow-up and enrolment."
          actions={
            <Button
              variant="outline"
              disabled={
                isLoading || refreshing
              }
              onClick={() =>
                void fetchInquiries(true)
              }
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              <span className="hidden sm:inline">
                Refresh
              </span>
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
            "
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={19}
                className="mt-0.5 shrink-0 text-(--danger)"
              />

              <div>
                <p className="text-sm font-semibold text-(--danger)">
                  Unable to load inquiries
                </p>

                <p className="mt-1 text-xs text-(--danger)">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="
                rounded-lg
                p-1
                text-(--danger)
                transition
                hover:bg-(--danger-soft)
              "
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Total Inquiries"
            value={statusCounts.total}
            subtitle="All submitted enquiries"
            icon={<UserRound size={20} />}
          />

          <SummaryCard
            title="New"
            value={statusCounts.new}
            subtitle="Awaiting first contact"
            icon={<AlertCircle size={20} />}
          />

          <SummaryCard
            title="Contacted"
            value={statusCounts.contacted}
            subtitle="Follow-up in progress"
            icon={<Clock3 size={20} />}
          />

          <SummaryCard
            title="Enrolled"
            value={statusCounts.enrolled}
            subtitle="Converted enquiries"
            icon={<CheckCircle2 size={20} />}
          />

          <SummaryCard
            title="Closed"
            value={statusCounts.closed}
            subtitle="Completed or inactive"
            icon={<CheckCircle2 size={20} />}
          />
        </div>

        {/* Pipeline */}
        <Card
          padding="md"
          className="mb-6"
        >
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--accent)">
              Lead Pipeline
            </p>

            <h2 className="mt-1 text-xl font-black tracking-tight text-(--foreground)">
              Enquiry Progress
            </h2>

            <p className="mt-1 text-sm text-(--ink-muted)">
              Track prospective students from first
              enquiry to final outcome.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATUS_ORDER.map(
              (status, index) => {
                const config =
                  STATUS_CONFIG[status];

                const Icon = config.icon;

                const count =
                  status === "NEW"
                    ? statusCounts.new
                    : status === "CONTACTED"
                      ? statusCounts.contacted
                      : status === "ENROLLED"
                        ? statusCounts.enrolled
                        : statusCounts.closed;

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      setStatusFilter(status)
                    }
                    className="
                      group
                      relative
                      rounded-2xl
                      border
                      border-(--line)
                      bg-(--surface)
                      p-4
                      text-left
                      transition
                      hover:-translate-y-0.5
                      hover:border-(--accent)
                    "
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-xl
                          bg-(--accent-soft)
                          text-(--accent)
                        "
                      >
                        <Icon size={18} />
                      </div>

                      <span className="text-2xl font-black text-(--foreground)">
                        {count}
                      </span>
                    </div>

                    <p className="mt-4 text-sm font-bold text-(--foreground)">
                      {config.label}
                    </p>

                    <p className="mt-1 text-xs text-(--ink-muted)">
                      {config.description}
                    </p>

                    {index <
                      STATUS_ORDER.length -
                        1}
                  </button>
                );
              },
            )}
          </div>
        </Card>

        {/* Search and filters */}
        <Card
          padding="md"
          className="mb-6"
        >
          <div
            className="
              flex
              flex-col
              justify-between
              gap-5
              lg:flex-row
              lg:items-center
            "
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--accent)">
                Lead Management
              </p>

              <h2 className="mt-1 text-xl font-black tracking-tight text-(--foreground)">
                Inquiry Records
              </h2>

              <p className="mt-1 text-sm text-(--ink-muted)">
                Search by student, contact, branch,
                belt or batch.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative w-full sm:w-80">
                <Search
                  size={17}
                  className="
                    pointer-events-none
                    absolute
                    left-3.5
                    top-1/2
                    -translate-y-1/2
                    text-(--ink-faint)
                  "
                />

                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value,
                    )
                  }
                  placeholder="Search inquiries..."
                  className="pl-10"
                />
              </div>

              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | "ALL"
                      | InquiryStatus,
                  )
                }
                className="h-10 sm:w-44"
              >
                <option value="ALL">
                  All statuses
                </option>

                <option value="NEW">
                  New
                </option>

                <option value="CONTACTED">
                  Contacted
                </option>

                <option value="ENROLLED">
                  Enrolled
                </option>

                <option value="CLOSED">
                  Closed
                </option>
              </Select>
            </div>
          </div>

          {(searchTerm ||
            statusFilter !== "ALL") && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-(--line) pt-4">
              <span className="text-xs text-(--ink-muted)">
                Active filters:
              </span>

              {searchTerm && (
                <span className="rounded-full bg-(--accent-soft) px-3 py-1.5 text-xs font-semibold text-(--accent)">
                  Search: {searchTerm}
                </span>
              )}

              {statusFilter !== "ALL" && (
                <span className="rounded-full bg-(--accent-soft) px-3 py-1.5 text-xs font-semibold text-(--accent)">
                  Status:{" "}
                  {
                    STATUS_CONFIG[
                      statusFilter
                    ].label
                  }
                </span>
              )}

              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 text-xs font-semibold text-(--danger) hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </Card>

        {/* Inquiry table */}
        <Card
          padding="none"
          className="overflow-hidden"
        >
          <div
            className="
              flex
              flex-col
              gap-3
              border-b
              border-(--line)
              px-6
              py-5
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div>
              <p className="text-sm font-semibold text-(--accent)">
                Inquiry Directory
              </p>

              <h2 className="mt-1 text-lg font-black text-(--foreground)">
                Prospective Students
              </h2>

              <p className="mt-1 text-sm text-(--ink-muted)">
                {filteredInquiries.length} record
                {filteredInquiries.length !==
                1
                  ? "s"
                  : ""}{" "}
                found
              </p>
            </div>

            <span
              className="
                w-fit
                rounded-full
                border
                border-(--line)
                bg-(--accent-soft)
                px-3
                py-1.5
                text-xs
                font-bold
                text-(--accent)
              "
            >
              {filteredInquiries.length} Records
            </span>
          </div>

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <div
                  className="
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-2xl
                    bg-(--accent-soft)
                    text-(--accent)
                  "
                >
                  <RefreshCw
                    size={21}
                    className="animate-spin"
                  />
                </div>

                <p className="text-sm font-semibold text-(--foreground)">
                  Loading inquiries...
                </p>

                <p className="text-xs text-(--ink-muted)">
                  Fetching the latest enquiry records.
                </p>
              </div>
            </div>
          ) : filteredInquiries.length ===
            0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div
                className="
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-2xl
                  bg-(--surface)
                  text-(--ink-faint)
                "
              >
                <UserRound size={25} />
              </div>

              <h3 className="mt-4 text-base font-bold text-(--foreground)">
                No inquiries found
              </h3>

              <p className="mt-1 max-w-sm text-sm text-(--ink-muted)">
                Try changing the search term or
                status filter. New student enquiries
                will appear here automatically.
              </p>

              {(searchTerm ||
                statusFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-[1050px] w-full text-left">
                  <thead>
                    <tr className="border-b border-(--line) bg-(--surface)">
                      <TableHeading>
                        Student
                      </TableHeading>

                      <TableHeading>
                        Contact
                      </TableHeading>

                      <TableHeading>
                        Training Preference
                      </TableHeading>

                      <TableHeading>
                        Status
                      </TableHeading>

                      <TableHeading>
                        Submitted
                      </TableHeading>

                      <TableHeading align="right">
                        Action
                      </TableHeading>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredInquiries.map(
                      (inquiry) => (
                        <tr
                          key={inquiry._id}
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
                                  text-sm
                                  font-black
                                  text-(--accent)
                                "
                              >
                                {getInitials(
                                  inquiry.fullName,
                                )}
                              </div>

                              <div>
                                <p className="font-bold text-(--foreground)">
                                  {
                                    inquiry.fullName
                                  }
                                </p>

                                <p className="mt-1 text-xs text-(--ink-faint)">
                                  {inquiry.age
                                    ? `${inquiry.age} years`
                                    : "Age not provided"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5">
                            <a
                              href={`mailto:${inquiry.email}`}
                              className="block max-w-[230px] truncate text-sm font-semibold text-(--foreground) hover:text-(--accent)"
                            >
                              {inquiry.email}
                            </a>

                            <a
                              href={`tel:${inquiry.phone}`}
                              className="mt-1 block text-sm text-(--ink-muted) hover:text-(--accent)"
                            >
                              {inquiry.phone}
                            </a>
                          </td>

                          <td className="px-6 py-5">
                            <p className="text-sm font-semibold text-(--foreground)">
                              {inquiry.preferredBatch ||
                                "Flexible"}
                            </p>

                            <p className="mt-1 max-w-[220px] truncate text-xs text-(--ink-muted)">
                              {inquiry.preferredBranch ||
                                "Branch not specified"}
                            </p>
                          </td>

                          <td className="px-6 py-5">
                            <StatusBadge
                              status={
                                inquiry.status
                              }
                            />
                          </td>

                          <td className="whitespace-nowrap px-6 py-5">
                            <p className="text-sm text-(--foreground)">
                              {formatDate(
                                inquiry.createdAt,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-(--ink-faint)">
                              {getRelativeTime(
                                inquiry.createdAt,
                              )}
                            </p>
                          </td>

                          <td className="px-6 py-5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setSelectedInquiry(
                                  inquiry,
                                )
                              }
                            >
                              View
                              <ArrowRight
                                size={14}
                              />
                            </Button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile / tablet */}
              <div className="divide-y divide-(--line) lg:hidden">
                {filteredInquiries.map(
                  (inquiry) => (
                    <button
                      key={inquiry._id}
                      type="button"
                      onClick={() =>
                        setSelectedInquiry(
                          inquiry,
                        )
                      }
                      className="
                        block
                        w-full
                        p-5
                        text-left
                        transition
                        hover:bg-(--hover-bg)
                      "
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="
                              flex
                              h-11
                              w-11
                              shrink-0
                              items-center
                              justify-center
                              rounded-full
                              border
                              border-(--line)
                              bg-(--accent-soft)
                              text-sm
                              font-black
                              text-(--accent)
                            "
                          >
                            {getInitials(
                              inquiry.fullName,
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-bold text-(--foreground)">
                              {
                                inquiry.fullName
                              }
                            </p>

                            <p className="mt-1 text-xs text-(--ink-muted)">
                              {inquiry.age
                                ? `${inquiry.age} years`
                                : "Age not provided"}
                            </p>
                          </div>
                        </div>

                        <StatusBadge
                          status={
                            inquiry.status
                          }
                        />
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Mail
                            size={15}
                            className="shrink-0 text-(--accent)"
                          />

                          <span className="truncate text-sm text-(--ink-muted)">
                            {inquiry.email}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone
                            size={15}
                            className="shrink-0 text-(--accent)"
                          />

                          <span className="text-sm text-(--ink-muted)">
                            {inquiry.phone}
                          </span>
                        </div>

                        <div className="flex min-w-0 items-center gap-2">
                          <MapPin
                            size={15}
                            className="shrink-0 text-(--accent)"
                          />

                          <span className="truncate text-sm text-(--ink-muted)">
                            {inquiry.preferredBranch ||
                              "Branch not specified"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock3
                            size={15}
                            className="shrink-0 text-(--accent)"
                          />

                          <span className="text-sm text-(--ink-muted)">
                            {inquiry.preferredBatch ||
                              "Flexible"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-(--line) pt-4">
                        <span className="text-xs text-(--ink-faint)">
                          {formatDateTime(
                            inquiry.createdAt,
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1 text-xs font-bold text-(--accent)">
                          View details
                          <ArrowRight size={13} />
                        </span>
                      </div>
                    </button>
                  ),
                )}
              </div>
            </>
          )}

          {!isLoading && (
            <div className="border-t border-(--line) px-6 py-4">
              <p className="text-xs text-(--ink-muted)">
                Showing{" "}
                <span className="font-bold text-(--foreground)">
                  {filteredInquiries.length}
                </span>{" "}
                of{" "}
                <span className="font-bold text-(--foreground)">
                  {inquiries.length}
                </span>{" "}
                inquiries
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Details modal */}
      <Modal
        open={Boolean(selectedInquiry)}
        onClose={closeModal}
        title={
          selectedInquiry?.fullName ||
          "Inquiry Details"
        }
        description={
          selectedInquiry
            ? `Submitted on ${formatDateTime(
                selectedInquiry.createdAt,
              )}`
            : undefined
        }
        size="lg"
        footer={
          <Button
            variant="outline"
            onClick={closeModal}
          >
            Close
          </Button>
        }
      >
        {selectedInquiry && (
          <div className="space-y-7">
            {/* Profile */}
            <div
              className="
                flex
                flex-col
                gap-5
                rounded-2xl
                border
                border-(--line)
                bg-(--surface)
                p-5
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div className="flex items-center gap-4">
                <div
                  className="
                    flex
                    h-14
                    w-14
                    shrink-0
                    items-center
                    justify-center
                    rounded-2xl
                    bg-(--accent-soft)
                    text-lg
                    font-black
                    text-(--accent)
                  "
                >
                  {getInitials(
                    selectedInquiry.fullName,
                  )}
                </div>

                <div>
                  <p className="text-xl font-black text-(--foreground)">
                    {selectedInquiry.fullName}
                  </p>

                  <p className="mt-1 text-sm text-(--ink-muted)">
                    Prospective student
                  </p>
                </div>
              </div>

              <StatusBadge
                status={
                  selectedInquiry.status
                }
              />
            </div>

            {/* Quick actions */}
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={`tel:${selectedInquiry.phone}`}
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-(--line)
                  bg-(--surface)
                  px-4
                  py-3
                  text-sm
                  font-semibold
                  text-(--foreground)
                  transition
                  hover:border-(--accent)
                  hover:bg-(--accent-soft)
                  hover:text-(--accent)
                "
              >
                <Phone size={16} />
                Call Student
              </a>

              <a
                href={`mailto:${selectedInquiry.email}`}
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-(--line)
                  bg-(--surface)
                  px-4
                  py-3
                  text-sm
                  font-semibold
                  text-(--foreground)
                  transition
                  hover:border-(--accent)
                  hover:bg-(--accent-soft)
                  hover:text-(--accent)
                "
              >
                <Mail size={16} />
                Send Email
              </a>
            </div>

            {/* Contact information */}
            <section>
              <p
                className="
                  mb-4
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-(--ink-faint)
                "
              >
                Contact Information
              </p>

              <div className="grid gap-5 sm:grid-cols-2">
                <DetailItem
                  icon={Mail}
                  label="Email"
                  value={
                    selectedInquiry.email ||
                    "Not provided"
                  }
                />

                <DetailItem
                  icon={Phone}
                  label="Phone"
                  value={
                    selectedInquiry.phone ||
                    "Not provided"
                  }
                />

                <DetailItem
                  icon={UserRound}
                  label="Age"
                  value={
                    selectedInquiry.age
                      ? `${selectedInquiry.age} years`
                      : "Not provided"
                  }
                />

                <DetailItem
                  icon={MapPin}
                  label="Preferred Branch"
                  value={
                    selectedInquiry.preferredBranch ||
                    "Not specified"
                  }
                />
              </div>
            </section>

            {/* Training */}
            <section>
              <p
                className="
                  mb-4
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-(--ink-faint)
                "
              >
                Training Preferences
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <InfoBox
                  label="Current Belt"
                  value={
                    selectedInquiry.currentBelt ||
                    "Beginner"
                  }
                />

                <InfoBox
                  label="Experience"
                  value={
                    selectedInquiry.experience ||
                    "Not specified"
                  }
                />

                <InfoBox
                  label="Preferred Batch"
                  value={
                    selectedInquiry.preferredBatch ||
                    "Flexible"
                  }
                />
              </div>
            </section>

            {/* Timeline */}
            <section>
              <p
                className="
                  mb-4
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-(--ink-faint)
                "
              >
                Inquiry Timeline
              </p>

              <div className="rounded-2xl border border-(--line) bg-(--surface) p-5">
                <div className="space-y-5">
                  {STATUS_ORDER.map(
                    (status, index) => {
                      const config =
                        STATUS_CONFIG[status];

                      const Icon = config.icon;

                      const currentIndex =
                        STATUS_ORDER.indexOf(
                          selectedInquiry.status,
                        );

                      const itemIndex =
                        STATUS_ORDER.indexOf(
                          status,
                        );

                      const isCurrent =
                        status ===
                        selectedInquiry.status;

                      const isCompleted =
                        itemIndex < currentIndex;

                      return (
                        <div
                          key={status}
                          className="relative flex items-start gap-4"
                        >
                          {index <
                            STATUS_ORDER.length -
                              1 && (
                            <div
                              className="
                                absolute
                                left-4
                                top-8
                                h-8
                                w-px
                                bg-(--line)
                              "
                            />
                          )}

                          <div
                            className={`
                              relative
                              z-10
                              flex
                              h-8
                              w-8
                              shrink-0
                              items-center
                              justify-center
                              rounded-full
                              border
                              ${
                                isCurrent ||
                                isCompleted
                                  ? "border-(--accent) bg-(--accent-soft) text-(--accent)"
                                  : "border-(--line) bg-(--background) text-(--ink-faint)"
                              }
                            `}
                          >
                            <Icon size={14} />
                          </div>

                          <div>
                            <p
                              className={`
                                text-sm
                                font-bold
                                ${
                                  isCurrent
                                    ? "text-(--accent)"
                                    : "text-(--foreground)"
                                }
                              `}
                            >
                              {config.label}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-(--ink-muted)">
                              {config.description}
                            </p>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </section>

            {/* Status */}
            <section
              className="
                rounded-2xl
                border
                border-(--line)
                bg-(--surface)
                p-5
              "
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-(--foreground)">
                    Inquiry Status
                  </p>

                  <p className="mt-1 text-xs text-(--ink-muted)">
                    Update the current follow-up
                    stage.
                  </p>
                </div>

                {canUpdateStatus ? (
                  <Select
                    value={
                      selectedInquiry.status
                    }
                    disabled={
                      isUpdatingStatus
                    }
                    onChange={(event) =>
                      void handleStatusUpdate(
                        event.target
                          .value as InquiryStatus,
                      )
                    }
                    className="w-full sm:w-48"
                  >
                    <option value="NEW">
                      New
                    </option>

                    <option value="CONTACTED">
                      Contacted
                    </option>

                    <option value="ENROLLED">
                      Enrolled
                    </option>

                    <option value="CLOSED">
                      Closed
                    </option>
                  </Select>
                ) : (
                  <StatusBadge
                    status={
                      selectedInquiry.status
                    }
                  />
                )}
              </div>

              {isUpdatingStatus && (
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-(--ink-muted)">
                  <RefreshCw
                    size={14}
                    className="animate-spin"
                  />
                  Updating status...
                </div>
              )}

              {statusError && (
                <div
                  className="
                    mt-4
                    rounded-xl
                    border
                    border-(--danger-border)
                    bg-(--danger-soft)
                    px-4
                    py-3
                    text-xs
                    font-medium
                    text-(--danger)
                  "
                >
                  {statusError}
                </div>
              )}

              {!canUpdateStatus && (
                <p className="mt-3 text-xs text-(--ink-muted)">
                  Only Super Admin and Branch Admin
                  can update inquiry status.
                </p>
              )}
            </section>

            {/* Enrolled notice */}
            {selectedInquiry.status ===
              "ENROLLED" && (
              <div
                className="
                  rounded-2xl
                  border
                  border-green-200
                  bg-green-50
                  p-5
                "
              >
                <div className="flex items-start gap-3">
                  <div
                    className="
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      bg-green-600
                      text-white
                    "
                  >
                    <CheckCircle2 size={17} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-green-700">
                      Ready for admission conversion
                    </p>

                    <p className="mt-1 text-xs leading-6 text-green-700">
                      This inquiry is marked as
                      enrolled. The next step is to
                      connect it with the admission,
                      registration and payment flow.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Message */}
            <section>
              <p
                className="
                  mb-4
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-(--ink-faint)
                "
              >
                Additional Message
              </p>

              <div
                className="
                  rounded-2xl
                  border
                  border-(--line)
                  bg-(--surface)
                  p-5
                "
              >
                <div className="flex items-start gap-3">
                  <div
                    className="
                      mt-0.5
                      flex
                      h-8
                      w-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-lg
                      bg-(--accent-soft)
                      text-(--accent)
                    "
                  >
                    <MessageSquareText
                      size={15}
                    />
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-7 text-(--ink-muted)">
                    {selectedInquiry.message ||
                      "No additional message provided."}
                  </p>
                </div>
              </div>
            </section>

            {/* Metadata */}
            <div className="grid gap-4 border-t border-(--line) pt-6 sm:grid-cols-2">
              <InfoBox
                label="Submitted"
                value={formatDateTime(
                  selectedInquiry.createdAt,
                )}
              />

              <InfoBox
                label="Last Updated"
                value={formatDateTime(
                  selectedInquiry.updatedAt,
                )}
              />
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}

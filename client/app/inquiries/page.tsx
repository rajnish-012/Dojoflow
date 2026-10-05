"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "@/lib/toast";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
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
  DataFilters,
  DataSort,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
  TableHeading,
  TablePagination,
  type ActiveFilter,
} from "@/components/ui";

import { getInquiries, updateInquiryStatus } from "@/lib/api";

import { PERMISSIONS, useCan } from "@/lib/permissions";

type InquiryStatus = "NEW" | "CONTACTED" | "ENROLLED" | "CLOSED";

type Inquiry = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  age?: number;
  preferredBatch?: string;
  preferredBranch?: string;
  programName?: string;
  planName?: string;
  preferredWeeklySessions?: {
    dayName?: string;
    sessionName?: string;
    sessionTypeName?: string;
    startTime?: string;
    endTime?: string;
  }[];
  preferredSession?: {
    sessionName?: string;
    sessionTypeName?: string;
    startTime?: string;
    endTime?: string;
  };
  message?: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
};

type InquirySort =
  | "createdAt-desc"
  | "createdAt-asc"
  | "name-asc"
  | "name-desc"
  | "status-asc"
  | "status-desc";

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
  const parts = name.trim().split(/\s+/).filter(Boolean);

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

  const minutes = Math.floor(difference / (60 * 1000));

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
        wrapper: "border-blue-200 bg-blue-50 text-blue-700",
        icon: "bg-blue-100 text-blue-700",
      };

    case "CONTACTED":
      return {
        wrapper: "border-amber-200 bg-amber-50 text-amber-700",
        icon: "bg-amber-100 text-amber-700",
      };

    case "ENROLLED":
      return {
        wrapper: "border-green-200 bg-green-50 text-green-700",
        icon: "bg-green-100 text-green-700",
      };

    case "CLOSED":
    default:
      return {
        wrapper: "border-(--line) bg-(--surface) text-(--ink-muted)",
        icon: "bg-(--background) text-(--ink-muted)",
      };
  }
}

function StatusBadge({ status }: { status: InquiryStatus }) {
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

        <p
          className="
            mt-1
            break-words
            text-sm
            font-semibold
            text-(--foreground)
          "
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
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

      <p
        className="
          mt-2
          break-words
          text-sm
          font-semibold
          text-(--foreground)
        "
      >
        {value}
      </p>
    </div>
  );
}

export default function InquiriesPage() {
  const canViewInquiries = useCan(PERMISSIONS.INQUIRY_VIEW);

  const canUpdateStatus = useCan(PERMISSIONS.INQUIRY_UPDATE);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState<"ALL" | InquiryStatus>(
    "ALL",
  );

  const [branchFilter, setBranchFilter] = useState("");

  const [batchFilter, setBatchFilter] = useState("");

  const [submittedFrom, setSubmittedFrom] = useState("");

  const [submittedTo, setSubmittedTo] = useState("");

  const [sort, setSort] = useState<InquirySort>("createdAt-desc");

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(25);

  const [isLoading, setIsLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [error, setError] = useState("");

  const [statusError, setStatusError] = useState("");

  const fetchInquiries = async (isRefresh = false) => {
    if (!canViewInquiries) {
      setInquiries([]);
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError("");

    try {
      const data = await getInquiries();

      setInquiries(Array.isArray(data?.inquiries) ? data.inquiries : []);
    } catch (fetchError: unknown) {
      console.error("Fetch inquiries error:", fetchError);

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
  }, [canViewInquiries]);

  /*
   * Reset to page 1 whenever the visible dataset
   * changes because of search, filtering or sorting.
   */
  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    statusFilter,
    branchFilter,
    batchFilter,
    submittedFrom,
    submittedTo,
    sort,
    pageSize,
  ]);

  /*
   * Filter options are generated from the currently
   * available inquiry data so they stay in sync with
   * the actual academy records.
   */
  const branchOptions = useMemo(
    () =>
      Array.from(
        new Set(
          inquiries
            .map((inquiry) => inquiry.preferredBranch?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [inquiries],
  );

  const batchOptions = useMemo(
    () =>
      Array.from(
        new Set(
          inquiries
            .map((inquiry) => inquiry.preferredBatch?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [inquiries],
  );

  const filteredInquiries = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const fromTimestamp = submittedFrom
      ? new Date(`${submittedFrom}T00:00:00`).getTime()
      : null;

    const toTimestamp = submittedTo
      ? new Date(`${submittedTo}T23:59:59.999`).getTime()
      : null;

    const filtered = inquiries.filter((inquiry) => {
      const createdTimestamp = new Date(inquiry.createdAt).getTime();

      const matchesSearch =
        !search ||
        inquiry.fullName.toLowerCase().includes(search) ||
        inquiry.email.toLowerCase().includes(search) ||
        inquiry.phone.toLowerCase().includes(search) ||
        Boolean(inquiry.preferredBranch?.toLowerCase().includes(search)) ||
        Boolean(inquiry.preferredBatch?.toLowerCase().includes(search)) ||
        Boolean(inquiry.programName?.toLowerCase().includes(search)) ||
        Boolean(inquiry.planName?.toLowerCase().includes(search));

      const matchesStatus =
        statusFilter === "ALL" || inquiry.status === statusFilter;

      const matchesBranch =
        !branchFilter || inquiry.preferredBranch === branchFilter;

      const matchesBatch =
        !batchFilter || inquiry.preferredBatch === batchFilter;

      const matchesSubmittedFrom =
        fromTimestamp === null || createdTimestamp >= fromTimestamp;

      const matchesSubmittedTo =
        toTimestamp === null || createdTimestamp <= toTimestamp;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesBranch &&
        matchesBatch &&
        matchesSubmittedFrom &&
        matchesSubmittedTo
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "createdAt-asc":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

        case "name-asc":
          return a.fullName.localeCompare(b.fullName);

        case "name-desc":
          return b.fullName.localeCompare(a.fullName);

        case "status-asc":
          return STATUS_CONFIG[a.status].label.localeCompare(
            STATUS_CONFIG[b.status].label,
          );

        case "status-desc":
          return STATUS_CONFIG[b.status].label.localeCompare(
            STATUS_CONFIG[a.status].label,
          );

        case "createdAt-desc":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });
  }, [
    inquiries,
    searchTerm,
    statusFilter,
    branchFilter,
    batchFilter,
    submittedFrom,
    submittedTo,
    sort,
  ]);

  const totalFiltered = filteredInquiries.length;

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  const currentPage = Math.min(page, totalPages);

  const paginatedInquiries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return filteredInquiries.slice(start, start + pageSize);
  }, [filteredInquiries, currentPage, pageSize]);

  const showingFrom =
    totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;

  const showingTo =
    totalFiltered === 0 ? 0 : Math.min(currentPage * pageSize, totalFiltered);

  const statusCounts = useMemo(() => {
    return {
      total: inquiries.length,

      new: inquiries.filter((item) => item.status === "NEW").length,

      contacted: inquiries.filter((item) => item.status === "CONTACTED").length,

      enrolled: inquiries.filter((item) => item.status === "ENROLLED").length,

      closed: inquiries.filter((item) => item.status === "CLOSED").length,
    };
  }, [inquiries]);

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];

    if (searchTerm.trim()) {
      filters.push({
        id: "search",
        label: `Search: ${searchTerm.trim()}`,
        onClear: () => setSearchTerm(""),
      });
    }

    if (branchFilter) {
      filters.push({
        id: "branch",
        label: `Branch: ${branchFilter}`,
        onClear: () => setBranchFilter(""),
      });
    }

    if (batchFilter) {
      filters.push({
        id: "batch",
        label: `Training: ${batchFilter}`,
        onClear: () => setBatchFilter(""),
      });
    }

    if (statusFilter !== "ALL") {
      filters.push({
        id: "status",
        label: `Status: ${STATUS_CONFIG[statusFilter].label}`,
        onClear: () => setStatusFilter("ALL"),
      });
    }

    if (submittedFrom) {
      filters.push({
        id: "submitted-from",
        label: `From: ${submittedFrom}`,
        onClear: () => setSubmittedFrom(""),
      });
    }

    if (submittedTo) {
      filters.push({
        id: "submitted-to",
        label: `To: ${submittedTo}`,
        onClear: () => setSubmittedTo(""),
      });
    }

    return filters;
  }, [
    searchTerm,
    branchFilter,
    batchFilter,
    statusFilter,
    submittedFrom,
    submittedTo,
  ]);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setBranchFilter("");
    setBatchFilter("");
    setSubmittedFrom("");
    setSubmittedTo("");
    setPage(1);
  };

  const handleStatusUpdate = async (newStatus: InquiryStatus) => {
    if (!selectedInquiry) {
      return;
    }

    if (!canUpdateStatus) {
      return;
    }

    if (selectedInquiry.status === newStatus) {
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError("");

    try {
      const data = await updateInquiryStatus(selectedInquiry._id, newStatus);

      const updatedInquiry: Inquiry = data?.inquiry;

      if (!updatedInquiry) {
        throw new Error("The server did not return the updated inquiry.");
      }

      setInquiries((currentInquiries) =>
        currentInquiries.map((inquiry) =>
          inquiry._id === updatedInquiry._id ? updatedInquiry : inquiry,
        ),
      );

      setSelectedInquiry(updatedInquiry);
      toast.success("Inquiry status updated.");
    } catch (updateError: unknown) {
      console.error("Update inquiry status error:", updateError);

      toast.error(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update inquiry status.",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const closeModal = () => {
    setSelectedInquiry(null);
    setStatusError("");
  };

  if (!canViewInquiries) {
    return (
      <div className="df-page">
        <PageHeader
          eyebrow="Authorization"
          title="Student Inquiries"
          description="Your role does not include permission to view inquiries."
        />
      </div>
    );
  }

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
              disabled={isLoading || refreshing}
              onClick={() => void fetchInquiries(true)}
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />

              <span className="hidden sm:inline">Refresh</span>
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
                className="
                  mt-0.5
                  shrink-0
                  text-(--danger)
                "
              />

              <div>
                <p
                  className="
                    text-sm
                    font-semibold
                    text-(--danger)
                  "
                >
                  Unable to load inquiries
                </p>

                <p
                  className="
                    mt-1
                    text-xs
                    text-(--danger)
                  "
                >
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
        <div
          className="
            mb-6
            grid
            gap-4
            sm:grid-cols-2
            xl:grid-cols-5
          "
        >
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



        {/* Unified inquiry table */}
        <Card padding="none" className="overflow-hidden">
          <div
            className="
              flex
              flex-col
              justify-between
              gap-5
              border-b
              border-(--line)
              px-5
              py-5
              sm:px-6
              lg:flex-row
              lg:items-center
            "
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-xl
                    bg-(--accent-soft)
                    text-(--accent)
                  "
                >
                  <UserRound size={18} />
                </div>

                <div>
                  <h2
                    className="
                      text-xl
                      font-extrabold
                      tracking-tight
                      text-(--foreground)
                    "
                  >
                    All inquiries
                  </h2>

                  <p
                    className="
                      mt-0.5
                      text-xs
                      text-(--ink-muted)
                      sm:text-sm
                    "
                  >
                    View and manage every prospective student enquiry in your
                    academy.
                  </p>
                </div>
              </div>
            </div>

            <div
              className="
                flex
                w-full
                flex-col
                gap-2
                lg:w-auto
                lg:flex-row
                lg:items-start
              "
            >
              {/* Search */}
              <div
                className="
                  relative
                  w-full
                  lg:w-[340px]
                "
              >
                <Search
                  size={17}
                  aria-hidden="true"
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
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search inquiries..."
                  aria-label="Search inquiries"
                  className="h-11 pl-10"
                />

                {searchTerm && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    title="Clear search"
                    onClick={() => setSearchTerm("")}
                    className="
                      absolute
                      right-2.5
                      top-1/2
                      flex
                      h-7
                      w-7
                      -translate-y-1/2
                      items-center
                      justify-center
                      rounded-lg
                      text-(--ink-faint)
                      transition
                      hover:bg-(--hover-bg)
                      hover:text-(--foreground)
                    "
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Filters */}
              <DataFilters
                activeFilters={activeFilters}
                onClearAll={clearFilters}
              >
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Branch
                  <Select
                    value={branchFilter}
                    onChange={(event) => setBranchFilter(event.target.value)}
                  >
                    <option value="">All branches</option>

                    {branchOptions.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Training batch
                  <Select
                    value={batchFilter}
                    onChange={(event) => setBatchFilter(event.target.value)}
                  >
                    <option value="">All batches</option>

                    {batchOptions.map((batch) => (
                      <option key={batch} value={batch}>
                        {batch}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Status
                  <Select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as "ALL" | InquiryStatus,
                      )
                    }
                  >
                    <option value="ALL">All statuses</option>
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="ENROLLED">Enrolled</option>
                    <option value="CLOSED">Closed</option>
                  </Select>
                </label>

                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Submitted from
                  <Input
                    type="date"
                    value={submittedFrom}
                    onChange={(event) => setSubmittedFrom(event.target.value)}
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Submitted to
                  <Input
                    type="date"
                    value={submittedTo}
                    onChange={(event) => setSubmittedTo(event.target.value)}
                  />
                </label>
              </DataFilters>

              {/* Sort */}
              <DataSort
                value={sort}
                onChange={(value) => setSort(value as InquirySort)}
                options={[
                  {
                    value: "createdAt-desc",
                    label: "Newest first",
                  },
                  {
                    value: "createdAt-asc",
                    label: "Oldest first",
                  },
                  {
                    value: "name-asc",
                    label: "Name: A to Z",
                  },
                  {
                    value: "name-desc",
                    label: "Name: Z to A",
                  },
                  {
                    value: "status-asc",
                    label: "Status: A to Z",
                  },
                  {
                    value: "status-desc",
                    label: "Status: Z to A",
                  },
                ]}
              />
            </div>
          </div>

          {/* Active filters */}
          {activeFilters.length > 0 && (
            <div
              className="
                border-b
                border-(--line)
                px-5
                py-3
                sm:px-6
              "
            >
              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >
                <span
                  className="
                    text-xs
                    font-medium
                    text-(--ink-faint)
                  "
                >
                  Active filters:
                </span>

                {activeFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={filter.onClear}
                    className="
                      inline-flex
                      items-center
                      gap-1
                      rounded-full
                      border
                      border-(--line)
                      bg-(--surface)
                      px-2.5
                      py-1
                      text-xs
                      font-semibold
                      text-(--foreground-soft)
                      transition
                      hover:border-(--line-strong)
                      hover:bg-(--hover-bg)
                    "
                  >
                    {filter.label}
                    <X size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoading ? (
            <div
              className="
                flex
                min-h-[320px]
                items-center
                justify-center
              "
            >
              <div
                className="
                  flex
                  flex-col
                  items-center
                  gap-3
                  text-center
                "
              >
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
                  <RefreshCw size={21} className="animate-spin" />
                </div>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-(--foreground)
                  "
                >
                  Loading inquiries...
                </p>

                <p
                  className="
                    text-xs
                    text-(--ink-muted)
                  "
                >
                  Fetching the latest enquiry records.
                </p>
              </div>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div
              className="
                flex
                min-h-[320px]
                flex-col
                items-center
                justify-center
                px-6
                text-center
              "
            >
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

              <h3
                className="
                  mt-4
                  text-base
                  font-bold
                  text-(--foreground)
                "
              >
                No inquiries found
              </h3>

              <p
                className="
                  mt-1
                  max-w-sm
                  text-sm
                  text-(--ink-muted)
                "
              >
                Try changing your search or filters. New student enquiries will
                appear here automatically.
              </p>

              {activeFilters.length > 0 && (
                <Button variant="ghost" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div
                className="
                  hidden
                  overflow-x-auto
                  md:block
                "
              >
                <table
                  className="
                    w-full
                    min-w-[1050px]
                  "
                >
                  <thead
                    className="
                      border-b
                      border-(--line)
                      bg-(--surface)
                    "
                  >
                    <tr>
                      <TableHeading>Student</TableHeading>
                      <TableHeading>Contact</TableHeading>
                      <TableHeading>Training Preference</TableHeading>
                      <TableHeading>Status</TableHeading>
                      <TableHeading>Submitted</TableHeading>
                      <TableHeading align="right">Action</TableHeading>
                    </tr>
                  </thead>

                  <tbody
                    className="
                      divide-y
                      divide-(--line)
                    "
                  >
                    {paginatedInquiries.map((inquiry) => (
                      <tr
                        key={inquiry._id}
                        className="
                          group
                          transition-colors
                          duration-200
                          hover:bg-(--surface)
                        "
                      >
                        <td className="px-6 py-5">
                          <button
                            type="button"
                            onClick={() => setSelectedInquiry(inquiry)}
                            className="
                              flex
                              items-center
                              gap-3
                              text-left
                            "
                          >
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
                                bg-(--sidebar-logo-bg)
                                text-xs
                                font-black
                                text-(--gold)
                              "
                            >
                              {getInitials(inquiry.fullName)}
                            </div>

                            <div className="min-w-0">
                              <p
                                className="
                                  truncate
                                  text-[15px]
                                  leading-5
                                  font-bold
                                  text-(--foreground-soft)
                                  transition-colors
                                  group-hover:text-(--accent)
                                "
                              >
                                {inquiry.fullName}
                              </p>

                              <p
                                className="
                                  mt-1
                                  text-sm
                                  leading-5
                                  text-(--ink-muted)
                                "
                              >
                                {inquiry.age
                                  ? `${inquiry.age} years`
                                  : "Age not provided"}
                              </p>
                            </div>
                          </button>
                        </td>

                        <td className="px-6 py-5">
                          <a
                            href={`mailto:${inquiry.email}`}
                            className="
                              block
                              max-w-[230px]
                              truncate
                              text-[15px]
                              leading-5
                              font-semibold
                              text-(--foreground-soft)
                              hover:text-(--accent)
                            "
                          >
                            {inquiry.email || "No email"}
                          </a>

                          <a
                            href={`tel:${inquiry.phone}`}
                            className="
                              mt-1
                              block
                              text-sm
                              leading-5
                              text-(--ink-muted)
                              hover:text-(--accent)
                            "
                          >
                            {inquiry.phone || "No phone"}
                          </a>
                        </td>

                        <td className="px-6 py-5">
                          <p
                            className="
                              text-[15px]
                              leading-5
                              font-medium
                              text-(--foreground-soft)
                            "
                          >
                            {inquiry.preferredBatch || "Flexible"}
                          </p>

                          <p
                            className="
                              mt-1
                              max-w-[220px]
                              truncate
                              text-sm
                              leading-5
                              text-(--ink-muted)
                            "
                          >
                            {inquiry.preferredBranch || "Branch not specified"}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <StatusBadge status={inquiry.status} />
                        </td>

                        <td
                          className="
                            whitespace-nowrap
                            px-6
                            py-5
                          "
                        >
                          <p
                            className="
                              text-[15px]
                              leading-5
                              text-(--foreground-soft)
                            "
                          >
                            {formatDate(inquiry.createdAt)}
                          </p>

                          <p
                            className="
                              mt-1
                              text-sm
                              leading-5
                              text-(--ink-faint)
                            "
                          >
                            {getRelativeTime(inquiry.createdAt)}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <IconButton
                            label={`View ${inquiry.fullName}`}
                            title={`View ${inquiry.fullName}`}
                            onClick={() => setSelectedInquiry(inquiry)}
                          >
                            <Eye size={16} />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile / tablet */}
              <div
                className="
                  space-y-3
                  p-4
                  md:hidden
                "
              >
                {paginatedInquiries.map((inquiry) => (
                  <button
                    key={inquiry._id}
                    type="button"
                    onClick={() => setSelectedInquiry(inquiry)}
                    className="
                      group
                      block
                      w-full
                      rounded-2xl
                      border
                      border-(--line)
                      bg-(--surface)
                      p-4
                      text-left
                      transition-all
                      duration-200
                      hover:-translate-y-0.5
                      hover:border-(--line-strong)
                      hover:bg-(--card)
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                        gap-3
                      "
                    >
                      <div
                        className="
                          flex
                          min-w-0
                          items-center
                          gap-3
                        "
                      >
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
                            bg-(--sidebar-logo-bg)
                            text-xs
                            font-black
                            text-(--gold)
                          "
                        >
                          {getInitials(inquiry.fullName)}
                        </div>

                        <div className="min-w-0">
                          <p
                            className="
                              truncate
                              text-sm
                              font-bold
                              text-(--foreground-soft)
                            "
                          >
                            {inquiry.fullName}
                          </p>

                          <p
                            className="
                              mt-1
                              text-xs
                              text-(--ink-muted)
                            "
                          >
                            {inquiry.age
                              ? `${inquiry.age} years`
                              : "Age not provided"}
                          </p>
                        </div>
                      </div>

                      <StatusBadge status={inquiry.status} />
                    </div>

                    <div
                      className="
                        mt-4
                        grid
                        gap-3
                        sm:grid-cols-2
                      "
                    >
                      <div
                        className="
                          flex
                          min-w-0
                          items-center
                          gap-2
                        "
                      >
                        <Mail
                          size={15}
                          className="
                            shrink-0
                            text-(--accent)
                          "
                        />

                        <span
                          className="
                            truncate
                            text-sm
                            text-(--ink-muted)
                          "
                        >
                          {inquiry.email || "No email"}
                        </span>
                      </div>

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <Phone
                          size={15}
                          className="
                            shrink-0
                            text-(--accent)
                          "
                        />

                        <span
                          className="
                            text-sm
                            text-(--ink-muted)
                          "
                        >
                          {inquiry.phone || "No phone"}
                        </span>
                      </div>

                      <div
                        className="
                          flex
                          min-w-0
                          items-center
                          gap-2
                        "
                      >
                        <MapPin
                          size={15}
                          className="
                            shrink-0
                            text-(--accent)
                          "
                        />

                        <span
                          className="
                            truncate
                            text-sm
                            text-(--ink-muted)
                          "
                        >
                          {inquiry.preferredBranch || "Branch not specified"}
                        </span>
                      </div>

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <Clock3
                          size={15}
                          className="
                            shrink-0
                            text-(--accent)
                          "
                        />

                        <span
                          className="
                            text-sm
                            text-(--ink-muted)
                          "
                        >
                          {inquiry.preferredBatch || "Flexible"}
                        </span>
                      </div>
                    </div>

                    <div
                      className="
                        mt-4
                        flex
                        items-center
                        justify-between
                        gap-3
                        border-t
                        border-(--line)
                        pt-4
                      "
                    >
                      <span
                        className="
                          text-xs
                          text-(--ink-faint)
                        "
                      >
                        {formatDateTime(inquiry.createdAt)}
                      </span>

                      <span
                        className="
                          inline-flex
                          items-center
                          gap-1
                          text-xs
                          font-bold
                          text-(--accent)
                        "
                      >
                        View details
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {!isLoading && (
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalFiltered}
              visibleItems={filteredInquiries.length}
              pageSize={pageSize}
              entityLabel="inquiries"
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
              onPageSizeChange={setPageSize}
            />
          )}
        </Card>
      </div>

      {/* Inquiry details modal */}
      <Modal
        open={Boolean(selectedInquiry)}
        onClose={closeModal}
        title={selectedInquiry?.fullName || "Inquiry Details"}
        description={
          selectedInquiry
            ? `Submitted on ${formatDateTime(selectedInquiry.createdAt)}`
            : undefined
        }
        size="lg"
        footer={
          <Button variant="outline" onClick={closeModal}>
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
                  {getInitials(selectedInquiry.fullName)}
                </div>

                <div>
                  <p
                    className="
                      text-xl
                      font-black
                      text-(--foreground)
                    "
                  >
                    {selectedInquiry.fullName}
                  </p>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-(--ink-muted)
                    "
                  >
                    Prospective student
                  </p>
                </div>
              </div>

              <StatusBadge status={selectedInquiry.status} />
            </div>

            {/* Quick actions */}
            <div
              className="
                grid
                gap-3
                sm:grid-cols-2
              "
            >
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

              <div
                className="
                  grid
                  gap-5
                  sm:grid-cols-2
                "
              >
                {selectedInquiry.email && <DetailItem
                  icon={Mail}
                  label="Email"
                  value={selectedInquiry.email}
                />}

                {selectedInquiry.phone && <DetailItem
                  icon={Phone}
                  label="Phone"
                  value={selectedInquiry.phone}
                />}

                {selectedInquiry.age != null && <DetailItem
                  icon={UserRound}
                  label="Age"
                  value={`${selectedInquiry.age} years`}
                />}

                {selectedInquiry.preferredBranch && <DetailItem
                  icon={MapPin}
                  label="Preferred Branch"
                  value={selectedInquiry.preferredBranch}
                />}
              </div>
            </section>

            {/* Training */}
            {(selectedInquiry.programName || selectedInquiry.planName || selectedInquiry.preferredWeeklySessions?.length || selectedInquiry.preferredSession) && <section>
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

              <div
                className="
                  grid
                  gap-4
                  sm:grid-cols-2
                "
              >
                {selectedInquiry.programName && <InfoBox label="Program" value={selectedInquiry.programName} />}
                {selectedInquiry.planName && <InfoBox label="Training Plan" value={selectedInquiry.planName} />}
                {selectedInquiry.preferredSession && <InfoBox label="Preferred Session" value={`${selectedInquiry.preferredSession.sessionName || selectedInquiry.preferredSession.sessionTypeName || "Training"}${selectedInquiry.preferredSession.startTime ? ` · ${selectedInquiry.preferredSession.startTime}` : ""}${selectedInquiry.preferredSession.endTime ? `–${selectedInquiry.preferredSession.endTime}` : ""}`} />}
                {!!selectedInquiry.preferredWeeklySessions?.length && <InfoBox label="Weekly Schedule" value={selectedInquiry.preferredWeeklySessions.map((item) => `${item.dayName}: ${item.sessionName || item.sessionTypeName} (${item.startTime}–${item.endTime})`).join(" · ")} />}
              </div>
            </section>}

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

              <div
                className="
                  rounded-2xl
                  border
                  border-(--line)
                  bg-(--surface)
                  p-5
                "
              >
                <div className="space-y-5">
                  {STATUS_ORDER.map((status, index) => {
                    const config = STATUS_CONFIG[status];

                    const Icon = config.icon;

                    const currentIndex = STATUS_ORDER.indexOf(
                      selectedInquiry.status,
                    );

                    const itemIndex = STATUS_ORDER.indexOf(status);

                    const isCurrent = status === selectedInquiry.status;

                    const isCompleted = itemIndex < currentIndex;

                    return (
                      <div
                        key={status}
                        className="
                          relative
                          flex
                          items-start
                          gap-4
                        "
                      >
                        {index < STATUS_ORDER.length - 1 && (
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
                              isCurrent || isCompleted
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

                          <p
                            className="
                              mt-1
                              text-xs
                              leading-5
                              text-(--ink-muted)
                            "
                          >
                            {config.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
              <div
                className="
                  flex
                  flex-col
                  gap-4
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >
                <div>
                  <p
                    className="
                      text-sm
                      font-bold
                      text-(--foreground)
                    "
                  >
                    Inquiry Status
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-(--ink-muted)
                    "
                  >
                    Update the current follow-up stage.
                  </p>
                </div>

                {canUpdateStatus ? (
                  <Select
                    value={selectedInquiry.status}
                    disabled={isUpdatingStatus}
                    onChange={(event) =>
                      void handleStatusUpdate(
                        event.target.value as InquiryStatus,
                      )
                    }
                    className="
                      w-full
                      sm:w-48
                    "
                  >
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="ENROLLED">Enrolled</option>
                    <option value="CLOSED">Closed</option>
                  </Select>
                ) : (
                  <StatusBadge status={selectedInquiry.status} />
                )}
              </div>

              {isUpdatingStatus && (
                <div
                  className="
                    mt-3
                    flex
                    items-center
                    gap-2
                    text-xs
                    font-medium
                    text-(--ink-muted)
                  "
                >
                  <RefreshCw size={14} className="animate-spin" />
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
                <p
                  className="
                    mt-3
                    text-xs
                    text-(--ink-muted)
                  "
                >
                  Your role does not include permission to update inquiry
                  status.
                </p>
              )}
            </section>

            {/* Enrolled notice */}
            {selectedInquiry.status === "ENROLLED" && (
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
                    <p
                      className="
                        text-sm
                        font-bold
                        text-green-700
                      "
                    >
                      Ready for admission conversion
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        leading-6
                        text-green-700
                      "
                    >
                      This inquiry is marked as enrolled. The next step is to
                      connect it with the admission, registration and payment
                      flow.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Message */}
            {selectedInquiry.message?.trim() && <section>
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
                    <MessageSquareText size={15} />
                  </div>

                  <p
                    className="
                      whitespace-pre-wrap
                      text-sm
                      leading-7
                      text-(--ink-muted)
                    "
                  >
                    {selectedInquiry.message}
                  </p>
                </div>
              </div>
            </section>}

            {/* Metadata */}
            <div
              className="
                grid
                gap-4
                border-t
                border-(--line)
                pt-6
                sm:grid-cols-2
              "
            >
              <InfoBox
                label="Submitted"
                value={formatDateTime(selectedInquiry.createdAt)}
              />

              <InfoBox
                label="Last Updated"
                value={formatDateTime(selectedInquiry.updatedAt)}
              />
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}

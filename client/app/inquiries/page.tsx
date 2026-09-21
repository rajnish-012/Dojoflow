"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  MessageSquareText,
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

const statusConfig: Record<
  InquiryStatus,
  {
    label: string;
    icon: typeof Clock3;
  }
> = {
  NEW: {
    label: "New",
    icon: AlertCircle,
  },
  CONTACTED: {
    label: "Contacted",
    icon: Clock3,
  },
  ENROLLED: {
    label: "Enrolled",
    icon: CheckCircle2,
  },
  CLOSED: {
    label: "Closed",
    icon: CheckCircle2,
  },
};

function getStatusTone(status: InquiryStatus) {
  switch (status) {
    case "NEW":
      return {
        background: "var(--blue-soft)",
        color: "var(--blue)",
        border: "var(--line)",
      };

    case "CONTACTED":
      return {
        background: "var(--gold-soft)",
        color: "var(--gold-dark)",
        border: "var(--line)",
      };

    case "ENROLLED":
      return {
        background: "var(--green-soft)",
        color: "var(--green)",
        border: "var(--line)",
      };

    case "CLOSED":
    default:
      return {
        background: "var(--surface)",
        color: "var(--ink-muted)",
        border: "var(--line)",
      };
  }
}

function StatusBadge({
  status,
}: {
  status: InquiryStatus;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const tone = getStatusTone(status);

  return (
    <span
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-full
        border
        px-3
        py-1.5
        text-xs
        font-bold
      "
      style={{
        background: tone.background,
        color: tone.color,
        borderColor: tone.border,
      }}
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
  children: React.ReactNode;
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

      <p className="mt-2 text-sm font-semibold text-(--foreground)">
        {value}
      </p>
    </div>
  );
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] =
    useState<Inquiry | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<"ALL" | InquiryStatus>("ALL");

  const [userRole, setUserRole] =
    useState<UserRole | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isUpdatingStatus, setIsUpdatingStatus] =
    useState(false);

  const [error, setError] = useState("");
  const [statusError, setStatusError] =
    useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  useEffect(() => {
    const storedUser =
      localStorage.getItem("user") ||
      localStorage.getItem("dojoUser") ||
      localStorage.getItem("currentUser");

    if (!storedUser) return;

    try {
      const user = JSON.parse(storedUser);

      if (user?.role) {
        setUserRole(user.role as UserRole);
      }
    } catch (parseError) {
      console.error(
        "Failed to load user role:",
        parseError,
      );
    }
  }, []);

  const fetchInquiries = async (
    showRefresh = false,
  ) => {
    if (showRefresh) {
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

  const filteredInquiries = useMemo(() => {
    const normalizedSearch =
      searchTerm.toLowerCase().trim();

    return inquiries.filter((inquiry) => {
      const matchesSearch =
        !normalizedSearch ||
        inquiry.fullName
          .toLowerCase()
          .includes(normalizedSearch) ||
        inquiry.email
          .toLowerCase()
          .includes(normalizedSearch) ||
        inquiry.phone
          .toLowerCase()
          .includes(normalizedSearch) ||
        Boolean(
          inquiry.preferredBranch
            ?.toLowerCase()
            .includes(normalizedSearch),
        );

      const matchesStatus =
        statusFilter === "ALL" ||
        inquiry.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    inquiries,
    searchTerm,
    statusFilter,
  ]);

  const statusCounts = useMemo(
    () => ({
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
    }),
    [inquiries],
  );

  const canUpdateStatus =
    userRole === "SUPER_ADMIN" ||
    userRole === "BRANCH_ADMIN";

  const formatDate = (date?: string) => {
    if (!date) return "—";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "—";
    }

    return parsedDate.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
  };

  const handleStatusUpdate = async (
    newStatus: InquiryStatus,
  ) => {
    if (
      !selectedInquiry ||
      !canUpdateStatus ||
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
        data.inquiry;

      setInquiries(
        (previousInquiries) =>
          previousInquiries.map(
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

  return (
    <main>
      <div className="df-page">
        <PageHeader
          eyebrow="Academy Management"
          title="Student Inquiries"
          description="Review student enquiries and follow up with prospective students."
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
                  isLoading || refreshing
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
              className="rounded-lg p-1 text-(--danger) transition hover:bg-(--danger-soft)"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

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
              <p
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.18em]
                  text-(--accent)
                "
              >
                Lead management
              </p>

              <h2 className="mt-1 text-xl font-black tracking-tight text-(--foreground)">
                Inquiry Records
              </h2>

              <p className="mt-1 text-sm text-(--ink-muted)">
                Search and filter prospective students.
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
                <option value="NEW">New</option>
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
        </Card>

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
                {filteredInquiries.length !== 1
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
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left">
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
                              {inquiry.fullName
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <p className="font-bold text-(--foreground)">
                                {inquiry.fullName}
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
                          <p className="text-sm font-semibold text-(--foreground)">
                            {inquiry.email}
                          </p>

                          <p className="mt-1 text-sm text-(--ink-muted)">
                            {inquiry.phone}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <p className="text-sm font-semibold text-(--foreground)">
                            {inquiry.preferredBatch ||
                              "Flexible"}
                          </p>

                          <p className="mt-1 text-xs text-(--ink-muted)">
                            {inquiry.preferredBranch ||
                              "Branch not specified"}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <StatusBadge
                            status={inquiry.status}
                          />
                        </td>

                        <td className="whitespace-nowrap px-6 py-5 text-sm text-(--ink-muted)">
                          {formatDate(
                            inquiry.createdAt,
                          )}
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
                          </Button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
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

      <Modal
        open={Boolean(selectedInquiry)}
        onClose={() => {
          setSelectedInquiry(null);
          setStatusError("");
        }}
        title={
          selectedInquiry?.fullName ||
          "Inquiry details"
        }
        description={
          selectedInquiry
            ? `Submitted on ${formatDate(
                selectedInquiry.createdAt,
              )}`
            : undefined
        }
        size="lg"
        footer={
          <Button
            variant="outline"
            onClick={() => {
              setSelectedInquiry(null);
              setStatusError("");
            }}
          >
            Close
          </Button>
        }
      >
        {selectedInquiry && (
          <div className="space-y-7">
            <div>
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
                  value={selectedInquiry.email}
                />

                <DetailItem
                  icon={Phone}
                  label="Phone"
                  value={selectedInquiry.phone}
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
            </div>

            <div>
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
            </div>

            <div
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
                    Update the current follow-up stage.
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
                    className="w-full sm:w-44"
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
                  Only Super Admin and Branch
                  Admin can update inquiry status.
                </p>
              )}
            </div>

            <div>
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

                  <p className="text-sm leading-7 text-(--ink-muted)">
                    {selectedInquiry.message ||
                      "No additional message provided."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}

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
  X,
} from "lucide-react";

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
    className: string;
    icon: typeof Clock3;
  }
> = {
  NEW: {
    label: "New",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: AlertCircle,
  },
  CONTACTED: {
    label: "Contacted",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  ENROLLED: {
    label: "Enrolled",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  CLOSED: {
    label: "Closed",
    className: "bg-slate-100 text-slate-600 border-slate-200",
    icon: CheckCircle2,
  },
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] =
    useState<Inquiry | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "ALL" | InquiryStatus
  >("ALL");

  const [userRole, setUserRole] =
    useState<UserRole | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      setUserRole(user.role as UserRole);
    } catch (parseError) {
      console.error("Failed to load user role:", parseError);
    }
  }, []);

  const fetchInquiries = async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await getInquiries();
      setInquiries(data.inquiries || []);
    } catch (fetchError) {
      console.error("Fetch inquiries error:", fetchError);

      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load inquiries."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const filteredInquiries = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    return inquiries.filter((inquiry) => {
      const matchesSearch =
        !normalizedSearch ||
        inquiry.fullName
          .toLowerCase()
          .includes(normalizedSearch) ||
        inquiry.email
          .toLowerCase()
          .includes(normalizedSearch) ||
        inquiry.phone.includes(normalizedSearch) ||
        inquiry.preferredBranch
          ?.toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "ALL" ||
        inquiry.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [inquiries, searchTerm, statusFilter]);

  const statusCounts = {
    total: inquiries.length,

    new: inquiries.filter(
      (item) => item.status === "NEW"
    ).length,

    contacted: inquiries.filter(
      (item) => item.status === "CONTACTED"
    ).length,

    enrolled: inquiries.filter(
      (item) => item.status === "ENROLLED"
    ).length,

    closed: inquiries.filter(
      (item) => item.status === "CLOSED"
    ).length,
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const canUpdateStatus =
    userRole === "SUPER_ADMIN" ||
    userRole === "BRANCH_ADMIN";

  const handleStatusUpdate = async (
    newStatus: InquiryStatus
  ) => {
    if (!selectedInquiry || !canUpdateStatus) {
      return;
    }

    if (selectedInquiry.status === newStatus) {
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError("");

    try {
      const data = await updateInquiryStatus(
        selectedInquiry._id,
        newStatus
      );

      const updatedInquiry: Inquiry = data.inquiry;

      setInquiries((previousInquiries) =>
        previousInquiries.map((inquiry) =>
          inquiry._id === updatedInquiry._id
            ? updatedInquiry
            : inquiry
        )
      );

      setSelectedInquiry(updatedInquiry);
    } catch (updateError) {
      console.error(
        "Update inquiry status error:",
        updateError
      );

      setStatusError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update inquiry status."
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            Admission management
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Student Inquiries
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Review student enquiries and follow up with
            prospective students.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchInquiries}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              isLoading ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total inquiries"
          value={statusCounts.total}
          className="bg-white"
        />

        <SummaryCard
          label="New inquiries"
          value={statusCounts.new}
          className="bg-blue-50"
        />

        <SummaryCard
          label="Contacted"
          value={statusCounts.contacted}
          className="bg-amber-50"
        />

        <SummaryCard
          label="Enrolled"
          value={statusCounts.enrolled}
          className="bg-emerald-50"
        />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search by name, email, phone or branch..."
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | "ALL"
                  | InquiryStatus
              )
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          >
            <option value="ALL">All statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="ENROLLED">Enrolled</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={fetchInquiries}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Inquiry Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="font-semibold text-slate-950">
            Inquiry Records
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {filteredInquiries.length} record
            {filteredInquiries.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-500">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading inquiries...
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <UserRound className="mx-auto h-10 w-10 text-slate-300" />

            <h3 className="mt-4 font-semibold text-slate-900">
              No inquiries found
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              New student enquiries will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <TableHeading>Student</TableHeading>
                  <TableHeading>Contact</TableHeading>
                  <TableHeading>Preference</TableHeading>
                  <TableHeading>Status</TableHeading>
                  <TableHeading>Submitted</TableHeading>

                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredInquiries.map((inquiry) => {
                  const status =
                    statusConfig[inquiry.status];

                  const StatusIcon = status.icon;

                  return (
                    <tr
                      key={inquiry._id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                            {inquiry.fullName
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900">
                              {inquiry.fullName}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {inquiry.age
                                ? `${inquiry.age} years`
                                : "Age not provided"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-sm text-slate-700">
                          {inquiry.email}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {inquiry.phone}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-sm font-medium text-slate-700">
                          {inquiry.preferredBatch ||
                            "Flexible"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {inquiry.preferredBranch ||
                            "Branch not specified"}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${status.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-500">
                        {formatDate(inquiry.createdAt)}
                      </td>

                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedInquiry(inquiry)
                          }
                          className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 sm:px-8">
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  Inquiry details
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {selectedInquiry.fullName}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedInquiry(null)
                }
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close inquiry details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-7 px-6 py-6 sm:px-8">
              {/* Contact Details */}
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
                  label="Preferred branch"
                  value={
                    selectedInquiry.preferredBranch ||
                    "Not specified"
                  }
                />
              </div>

              {/* Preference Information */}
              <div className="grid gap-5 sm:grid-cols-3">
                <InfoBox
                  label="Current belt"
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
                  label="Preferred batch"
                  value={
                    selectedInquiry.preferredBatch ||
                    "Flexible"
                  }
                />
              </div>

              {/* Status Update Section */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Inquiry status
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Update the current follow-up stage.
                    </p>
                  </div>

                  {canUpdateStatus ? (
                    <select
                      value={selectedInquiry.status}
                      disabled={isUpdatingStatus}
                      onChange={(event) =>
                        handleStatusUpdate(
                          event.target.value as InquiryStatus
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="NEW">New</option>
                      <option value="CONTACTED">
                        Contacted
                      </option>
                      <option value="ENROLLED">
                        Enrolled
                      </option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        statusConfig[
                          selectedInquiry.status
                        ].className
                      }`}
                    >
                      {
                        statusConfig[
                          selectedInquiry.status
                        ].label
                      }
                    </span>
                  )}
                </div>

                {isUpdatingStatus && (
                  <p className="mt-3 text-xs text-slate-500">
                    Updating status...
                  </p>
                )}

                {statusError && (
                  <p className="mt-3 text-xs font-medium text-red-600">
                    {statusError}
                  </p>
                )}

                {!canUpdateStatus && (
                  <p className="mt-3 text-xs text-slate-500">
                    Only Super Admin and Branch Admin can
                    update inquiry status.
                  </p>
                )}
              </div>

              {/* Additional Message */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Additional message
                </p>

                <div className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                  {selectedInquiry.message ||
                    "No additional message provided."}
                </div>
              </div>

              {/* Submitted Date */}
              <div className="border-t border-slate-100 pt-5 text-xs text-slate-400">
                Submitted on{" "}
                {formatDate(selectedInquiry.createdAt)}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4 sm:px-8">
              <button
                type="button"
                onClick={() =>
                  setSelectedInquiry(null)
                }
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 p-5 shadow-sm ${className}`}
    >
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function TableHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
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
      <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-medium text-slate-800">
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}
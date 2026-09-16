"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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

import { getInquiries, updateInquiryStatus } from "@/lib/api";

type UserRole = "SUPER_ADMIN" | "BRANCH_ADMIN" | "COACH" | "STUDENT";

type InquiryStatus = "NEW" | "CONTACTED" | "ENROLLED" | "CLOSED";

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
    className: "border-[#d9e5ff] bg-[#eef3ff] text-[#496bb1]",
    icon: AlertCircle,
  },
  CONTACTED: {
    label: "Contacted",
    className: "border-[#f5dfad] bg-[#fff6e7] text-[#b67b1d]",
    icon: Clock3,
  },
  ENROLLED: {
    label: "Enrolled",
    className: "border-[#ccebd9] bg-[#edf8f1] text-[#32915b]",
    icon: CheckCircle2,
  },
  CLOSED: {
    label: "Closed",
    className: "border-[#e1e5eb] bg-[#f5f7fb] text-[#697386]",
    icon: CheckCircle2,
  },
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState<"ALL" | InquiryStatus>(
    "ALL",
  );

  const [userRole, setUserRole] = useState<UserRole | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) return;

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
          : "Unable to load inquiries.",
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
        inquiry.fullName.toLowerCase().includes(normalizedSearch) ||
        inquiry.email.toLowerCase().includes(normalizedSearch) ||
        inquiry.phone.includes(normalizedSearch) ||
        inquiry.preferredBranch?.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "ALL" || inquiry.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [inquiries, searchTerm, statusFilter]);

  const statusCounts = {
    total: inquiries.length,
    new: inquiries.filter((item) => item.status === "NEW").length,
    contacted: inquiries.filter((item) => item.status === "CONTACTED").length,
    enrolled: inquiries.filter((item) => item.status === "ENROLLED").length,
    closed: inquiries.filter((item) => item.status === "CLOSED").length,
  };

  const canUpdateStatus =
    userRole === "SUPER_ADMIN" || userRole === "BRANCH_ADMIN";

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleStatusUpdate = async (newStatus: InquiryStatus) => {
    if (!selectedInquiry || !canUpdateStatus) return;

    if (selectedInquiry.status === newStatus) return;

    setIsUpdatingStatus(true);
    setStatusError("");

    try {
      const data = await updateInquiryStatus(selectedInquiry._id, newStatus);

      const updatedInquiry: Inquiry = data.inquiry;

      setInquiries((previousInquiries) =>
        previousInquiries.map((inquiry) =>
          inquiry._id === updatedInquiry._id ? updatedInquiry : inquiry,
        ),
      );

      setSelectedInquiry(updatedInquiry);
    } catch (updateError) {
      console.error("Update inquiry status error:", updateError);

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
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
              <MessageSquareText size={16} />
              Academy Management
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Student Inquiries
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Review student enquiries and follow up with prospective students.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchInquiries}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe5ed] bg-white px-5 py-3 text-sm font-semibold text-[#34445d] shadow-lg transition hover:border-[#d7a84b] hover:text-[#a87418] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={17} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Total Inquiries"
            value={statusCounts.total}
            description="All submitted enquiries"
            icon={UserRound}
            iconClass="bg-[#edf3ff] text-[#4774c8]"
          />

          <SummaryCard
            title="New"
            value={statusCounts.new}
            description="Awaiting first contact"
            icon={AlertCircle}
            iconClass="bg-[#edf3ff] text-[#4774c8]"
          />

          <SummaryCard
            title="Contacted"
            value={statusCounts.contacted}
            description="Follow-up in progress"
            icon={Clock3}
            iconClass="bg-[#fff6e8] text-[#c78316]"
          />

          {/* Summary Cards */}
          <SummaryCard
            title="Enrolled"
            value={statusCounts.enrolled}
            description="Converted enquiries"
            icon={CheckCircle2}
            iconClass="bg-[#edf9f2] text-[#29945d]"
          />

          <SummaryCard
            title="Closed"
            value={statusCounts.closed}
            description="Completed or inactive"
            icon={CheckCircle2}
            iconClass="bg-[#f3edff] text-[#8055c9]"
          />
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-[#dfe5ed] bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-5 px-6 py-5 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-black tracking-[-0.02em] text-[#101a33]">
                Inquiry records
              </h2>

              <p className="mt-1 text-sm text-[#697386]">
                Search and filter prospective students.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative w-full sm:w-80">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91a0b5]"
                />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search inquiries..."
                  className="h-12 w-full rounded-xl border border-[#dfe5ed] bg-[#fbfcfe] pl-10 pr-4 text-sm text-[#34445d] outline-none transition placeholder:text-[#91a0b5] focus:border-[#b67b1d] focus:bg-white focus:ring-4 focus:ring-[#b67b1d]/10"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "ALL" | InquiryStatus)
                }
                className="h-12 rounded-xl border border-[#dfe5ed] bg-[#fbfcfe] px-4 text-sm font-semibold text-[#34445d] outline-none transition focus:border-[#b67b1d] focus:bg-white focus:ring-4 focus:ring-[#b67b1d]/10"
              >
                <option value="ALL">All statuses</option>
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
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
        <div className="overflow-hidden rounded-2xl border border-[#dfe5ed] bg-white shadow-sm">
          <div className="border-b border-[#edf0f4] px-6 py-5">
            <h2 className="text-xl font-black tracking-[-0.02em] text-[#101a33]">
              Inquiry directory
            </h2>

            <p className="mt-1 text-sm text-[#697386]">
              {filteredInquiries.length} record
              {filteredInquiries.length !== 1 ? "s" : ""} found
            </p>
          </div>

          {isLoading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-[#697386]">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#dfe5ed] border-t-[#b67b1d]" />
                Loading inquiries...
              </div>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5f7fb]">
                <UserRound className="h-6 w-6 text-[#91a0b5]" />
              </div>

              <h3 className="mt-4 font-bold text-[#101a33]">
                No inquiries found
              </h3>

              <p className="mt-2 text-sm text-[#697386]">
                New student enquiries will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead className="bg-[#fbfcfe]">
                  <tr className="border-b border-[#edf0f4]">
                    <TableHeading>Student</TableHeading>
                    <TableHeading>Contact</TableHeading>
                    <TableHeading>Plan / Branch</TableHeading>
                    <TableHeading>Status</TableHeading>
                    <TableHeading>Submitted</TableHeading>

                    <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.14em] text-[#8190a5]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf0f4]">
                  {filteredInquiries.map((inquiry) => {
                    const status = statusConfig[inquiry.status];

                    const StatusIcon = status.icon;

                    return (
                      <tr
                        key={inquiry._id}
                        className="transition hover:bg-[#fbfcfe]"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef3ff] text-sm font-black text-[#496bb1]">
                              {inquiry.fullName.charAt(0).toUpperCase()}
                            </div>

                            <div>
                              <p className="font-bold text-[#101a33]">
                                {inquiry.fullName}
                              </p>

                              <p className="mt-1 text-xs text-[#91a0b5]">
                                {inquiry.age
                                  ? `${inquiry.age} years`
                                  : "Age not provided"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <p className="text-sm font-medium text-[#34445d]">
                            {inquiry.email}
                          </p>

                          <p className="mt-1 text-sm text-[#91a0b5]">
                            {inquiry.phone}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <p className="text-sm font-medium text-[#34445d]">
                            {inquiry.preferredBatch || "Flexible"}
                          </p>

                          <p className="mt-1 text-xs text-[#91a0b5]">
                            {inquiry.preferredBranch || "Branch not specified"}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${status.className}`}
                          >
                            <StatusIcon size={13} />
                            {status.label}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-sm text-[#697386]">
                          {formatDate(inquiry.createdAt)}
                        </td>

                        <td className="px-6 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedInquiry(inquiry)}
                            className="inline-flex items-center gap-1 text-sm font-bold text-[#b67b1d] transition hover:text-[#8f5e0d]"
                          >
                            View
                            <span className="text-base">↗</span>
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

        {!isLoading && (
          <p className="text-xs text-[#91a0b5]">
            Showing {filteredInquiries.length} of {inquiries.length} inquiries
          </p>
        )}
      </div>

      {/* Details Modal */}
      {selectedInquiry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setSelectedInquiry(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#b67b1d]">
                  Inquiry details
                </p>

                <h2 className="text-xl font-bold text-slate-900">
                  {selectedInquiry.fullName}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Submitted on {formatDate(selectedInquiry.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-7 px-6 py-6">
              {/* Contact Information */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                    value={selectedInquiry.preferredBranch || "Not specified"}
                  />
                </div>
              </div>

              {/* Training Preferences */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Training Preferences
                </p>

                <div className="grid gap-4 sm:grid-cols-3">
                  <InfoBox
                    label="Current Belt"
                    value={selectedInquiry.currentBelt || "Beginner"}
                  />

                  <InfoBox
                    label="Experience"
                    value={selectedInquiry.experience || "Not specified"}
                  />

                  <InfoBox
                    label="Preferred Batch"
                    value={selectedInquiry.preferredBatch || "Flexible"}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="rounded-xl border border-slate-200 bg-[#fbfcfe] p-4">
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
                        handleStatusUpdate(event.target.value as InquiryStatus)
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#b67b1d] focus:ring-4 focus:ring-[#b67b1d]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="ENROLLED">Enrolled</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  ) : (
                    <StatusBadge status={selectedInquiry.status} />
                  )}
                </div>

                {isUpdatingStatus && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Updating status...
                  </div>
                )}

                {statusError && (
                  <p className="mt-3 text-xs font-medium text-red-600">
                    {statusError}
                  </p>
                )}

                {!canUpdateStatus && (
                  <p className="mt-3 text-xs text-slate-500">
                    Only Super Admin and Branch Admin can update inquiry status.
                  </p>
                )}
              </div>

              {/* Message */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Additional Message
                </p>

                <div className="rounded-xl bg-[#fbfcfe] p-4 text-sm leading-7 text-slate-600">
                  {selectedInquiry.message || "No additional message provided."}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="rounded-xl bg-[#101a33] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1b2947]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
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
  value: number;
  description: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <Icon size={21} />
        </div>

        <span className="text-xs font-medium text-slate-400">DojoFlow</span>
      </div>

      <p className="text-sm font-medium text-slate-500">{title}</p>

      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>

      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}
function TableHeading({ children }: { children: ReactNode }) {
  return (
    <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-[#8190a5]">
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
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-medium text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: InquiryStatus }) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${config.className}`}
    >
      <StatusIcon size={13} />
      {config.label}
    </span>
  );
}

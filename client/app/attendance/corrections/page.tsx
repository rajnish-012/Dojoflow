"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardCheck,ArrowLeft, RefreshCw, X } from "lucide-react";
import {
  Badge,
  Button,
  DataTableSection,
  EmptyState,
  ErrorState,
  LoadingSpinner,
  Modal,
  PageHeader,
  TableHeading,
  TablePagination,
  Textarea,
} from "@/components/ui";
import Link from "next/link";
import {
  decideAttendanceCorrection,
  getAttendanceCorrections,
  type AttendanceCorrection,
} from "@/lib/attendanceApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";

export default function AttendanceCorrectionsPage() {
  const canApprove = useCan(PERMISSIONS.ATTENDANCE_CORRECT_APPROVE);
  const [items, setItems] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<AttendanceCorrection | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAttendanceCorrections("PENDING", page);
      setItems(result.corrections);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load correction requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    if (!canApprove) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [canApprove, load]);
  const act = async (
    item: AttendanceCorrection,
    decision: "approve" | "reject",
    reason = "",
  ) => {
    setSaving(true);
    try {
      await decideAttendanceCorrection(item._id, decision, reason);
      setSelected(null);
      setRejectionReason("");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to decide correction request.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (!canApprove)
    return (
      <div className="df-page">
        <ErrorState
          title="Access denied"
          message="Your account does not have permission to approve attendance corrections."
        />
      </div>
    );
  return (
    <div className="df-page">
      <PageHeader
        eyebrow="Training operations"
        title="Attendance corrections"
        description="Review historical attendance changes and their supporting reasons."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/attendance">
            <Button variant="back">
              <ArrowLeft size={16} />
              Back to Attendance
            </Button>
          </Link>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={16} /> Refresh
            </Button>
          </div>
        }
      />
      <DataTableSection
        title="Pending requests"
        description="Approval and attendance changes are recorded together in the audit history."
        icon={<ClipboardCheck size={18} />}
      >
        {error ? (
          <div className="p-5">
            <ErrorState
              title="Correction requests unavailable"
              message={error}
              action={
                <Button variant="outline" onClick={() => void load()}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : loading ? (
          <div className="p-12">
            <LoadingSpinner text="Loading requests" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No pending requests"
              description="Historical attendance correction requests will appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-(--surface)">
                <tr>
                  <TableHeading>Student</TableHeading>
                  <TableHeading>Branch</TableHeading>
                  <TableHeading>Date</TableHeading>
                  <TableHeading>Change</TableHeading>
                  <TableHeading>Reason</TableHeading>
                  <TableHeading>Requested by</TableHeading>
                  <TableHeading align="right">Decision</TableHeading>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-t border-(--line)">
                    <td className="px-6 py-4 text-sm font-semibold">
                      {item.student?.name || "Student"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.branch?.name || "Branch"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.attendance?.date
                        ? new Date(item.attendance.date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">{item.original.status}</span>
                      <span className="mx-2 text-(--ink-faint)">→</span>
                      <Badge variant="warning">{item.proposed.status}</Badge>
                    </td>
                    <td className="max-w-[240px] px-6 py-4 text-sm text-(--ink-muted)">
                      {item.reason}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.requestedBy?.name || "Staff"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => void act(item, "approve")}
                          disabled={saving}
                        >
                          <Check size={15} /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(item);
                            setRejectionReason("");
                          }}
                          disabled={saving}
                        >
                          <X size={15} /> Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              visibleItems={items.length}
              pageSize={25}
              entityLabel="requests"
              onPrevious={() => setPage((n) => Math.max(1, n - 1))}
              onNext={() => setPage((n) => Math.min(totalPages, n + 1))}
            />
          </div>
        )}
      </DataTableSection>
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Reject correction request"
        description="A rejection reason is required and will be retained with the request."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setSelected(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                selected && void act(selected, "reject", rejectionReason)
              }
              disabled={saving || !rejectionReason.trim()}
            >
              {saving ? "Saving…" : "Reject request"}
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-(--ink-muted)">
              {selected.student?.name}: {selected.original.status} →{" "}
              {selected.proposed.status}
            </p>
            <label className="block text-xs font-semibold text-(--ink-muted)">
              Rejection reason
              <Textarea
                className="mt-1 min-h-28"
                maxLength={500}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain why this correction is rejected"
              />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

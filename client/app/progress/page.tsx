"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, TrendingUp } from "lucide-react";

import { getStudents, type StudentRecord } from "@/lib/api";
import {
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  PageHeader,
  TablePagination,
} from "@/components/ui";

const PAGE_SIZE = 25;

export default function ProgressPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void getStudents({ page, limit: PAGE_SIZE, search: search.trim() })
        .then((result) => {
          if (cancelled) return;
          setStudents(result.students);
          setTotal(result.pagination?.total ?? result.students.length);
          setTotalPages(result.pagination?.pages ?? 1);
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setError(
            reason instanceof Error ? reason.message : "Unable to load students.",
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, search]);

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Academy"
        title="Student Progress"
        description="Choose a student to review their training, attendance, performance, and belt progression."
      />

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-(--line) p-4 sm:p-5">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search students"
            aria-label="Search students"
            leftIcon={<Search size={17} />}
          />
        </div>

        {loading ? (
          <div className="p-10"><LoadingSpinner text="Loading students" /></div>
        ) : error ? (
          <div className="p-5"><ErrorState title="Progress unavailable" message={error} /></div>
        ) : students.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={search ? "No matching students" : "No students found"}
              description={search ? "Try another name or search term." : "Students will appear here when they are added to your academy."}
              icon={<TrendingUp size={22} />}
            />
          </div>
        ) : (
          <>
            <div className="divide-y divide-(--line)">
              {students.map((student) => (
                <Link
                  key={student._id}
                  href={`/students/${student._id}/progress`}
                  className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-(--hover-bg) sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-(--foreground)">{student.name}</p>
                    <p className="mt-1 truncate text-xs text-(--ink-muted)">
                      {[student.branch?.name, student.plan?.name, student.currentBelt && `${student.currentBelt} belt`]
                        .filter(Boolean)
                        .join(" · ") || "Training progress"}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-(--accent)">
                    View progress <ArrowUpRight size={15} />
                  </span>
                </Link>
              ))}
            </div>
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              visibleItems={students.length}
              pageSize={PAGE_SIZE}
              entityLabel="students"
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          </>
        )}
      </Card>
    </div>
  );
}

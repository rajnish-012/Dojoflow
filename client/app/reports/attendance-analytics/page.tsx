"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  LoadingSpinner,
  PageHeader,
  Select,
  SummaryCard,
} from "@/components/ui";
import { fetchWithSession } from "@/lib/sessionFetch";
import { PERMISSIONS, useCan } from "@/lib/permissions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
type Option = { _id: string; name: string };
type AnalyticsRow = {
  _id: string;
  name: string;
  branch?: { name?: string };
  plan?: { name?: string };
  total: number;
  present: number;
  absent: number;
  attendanceRate: number | null;
  absenceRate: number | null;
  lastAttendedDate: string | null;
  consecutiveAbsences: number;
  pendingMakeups: number;
  completedMakeups: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
};
type Analytics = {
  options?: {
    branches: Option[];
    programs: Option[];
    coaches: Option[];
    students: Option[];
  };
  summary: {
    attendanceRate: number;
    absenceRate: number;
    total: number;
    pendingMakeups: number;
    completedMakeups: number;
    atRiskStudents: number;
  };
  students: AnalyticsRow[];
  atRiskStudents: AnalyticsRow[];
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetchWithSession(`${API_URL}${path}`, {
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || "Unable to load attendance analytics.");
  return data;
}

export default function AttendanceAnalyticsPage() {
  const canView = useCan(PERMISSIONS.REPORT_VIEW);
  const [filters, setFilters] = useState({
    branch: "",
    program: "",
    coach: "",
    student: "",
    from: "",
    to: "",
  });
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canView) return;
    getJson<Analytics>("/reports/attendance-analytics")
      .then(setData)
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Unable to load attendance analytics.",
        ),
      );
  }, [canView]);

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value),
      );
      setData(
        await getJson<Analytics>(
          `/reports/attendance-analytics?${query.toString()}`,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load attendance analytics.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!canView)
    return (
      <div className="df-page">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view attendance analytics."
        />
      </div>
    );
  return (
    <div className="df-page">
      <PageHeader
        eyebrow="Attendance"
        title="Attendance Analytics"
        description="Attendance rates, absence trends, makeup workload, and reliable at-risk indicators."
        actions={
          <Link href="/reports">
            <Button variant="outline">
              <ArrowLeft size={16} />
              Reports
            </Button>
          </Link>
        }
      />
      <Card className="mb-5" padding="md">
        <form
          onSubmit={load}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
        >
          <label className="text-xs font-semibold text-(--ink-muted)">
            Branch
            <Select
              value={filters.branch}
              onChange={(e) =>
                setFilters({ ...filters, branch: e.target.value })
              }
            >
              <option value="">All accessible</option>
              {(data?.options?.branches || []).map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold text-(--ink-muted)">
            Program
            <Select
              value={filters.program}
              onChange={(e) =>
                setFilters({ ...filters, program: e.target.value })
              }
            >
              <option value="">All programs</option>
              {(data?.options?.programs || []).map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold text-(--ink-muted)">
            Coach
            <Select
              value={filters.coach}
              onChange={(e) =>
                setFilters({ ...filters, coach: e.target.value })
              }
            >
              <option value="">All coaches</option>
              {(data?.options?.coaches || []).map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold text-(--ink-muted)">
            Student
            <Select
              value={filters.student}
              onChange={(e) =>
                setFilters({ ...filters, student: e.target.value })
              }
            >
              <option value="">All students</option>
              {(data?.options?.students || []).map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold text-(--ink-muted)">
            From
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-(--ink-muted)">
            To
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </label>
          <div className="xl:col-span-6">
            <Button type="submit" loading={loading}>
              <RefreshCw size={16} />
              Apply filters
            </Button>
          </div>
        </form>
      </Card>
      {error && (
        <div className="mb-5">
          <ErrorState
            title="Attendance analytics unavailable"
            message={error}
          />
        </div>
      )}
      {loading && !data ? (
        <LoadingSpinner text="Loading attendance analytics..." />
      ) : (
        data && (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                title="Attendance rate"
                value={`${data.summary.attendanceRate}%`}
                subtitle={`${data.summary.total} regular sessions`}
              />
              <SummaryCard
                title="Absence rate"
                value={`${data.summary.absenceRate}%`}
                subtitle="Of recorded regular sessions"
              />
              <SummaryCard
                title="At-risk students"
                value={data.summary.atRiskStudents}
                subtitle="Minimum 3 recorded sessions"
              />
              <SummaryCard
                title="Makeups pending"
                value={data.summary.pendingMakeups}
                subtitle="Scheduled or awaiting a date"
              />
              <SummaryCard
                title="Makeups completed"
                value={data.summary.completedMakeups}
                subtitle="In selected date range"
              />
            </div>
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-(--line) bg-(--surface-muted) text-xs uppercase text-(--ink-muted)">
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Branch / Program</th>
                      <th className="px-4 py-3">Attendance</th>
                      <th className="px-4 py-3">Last attended</th>
                      <th className="px-4 py-3">Consecutive absences</th>
                      <th className="px-4 py-3">Makeups pending / done</th>
                      <th className="px-4 py-3">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((row) => (
                      <tr
                        key={row._id}
                        className="border-b border-(--line) last:border-0"
                      >
                        <td className="px-4 py-3 font-semibold">
                          <Link
                            href={`/students/${row._id}`}
                            className="text-(--accent) hover:underline"
                          >
                            {row.name}
                          </Link>
                          <p className="text-xs text-(--ink-muted)">
                            {row.present} present · {row.absent} absent
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {row.branch?.name || "—"}
                          <p className="text-xs text-(--ink-muted)">
                            {row.plan?.name || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {row.attendanceRate === null
                            ? "No data"
                            : `${row.attendanceRate}%`}
                        </td>
                        <td className="px-4 py-3">
                          {row.lastAttendedDate
                            ? new Date(row.lastAttendedDate).toLocaleDateString(
                                "en-IN",
                              )
                            : "Never"}
                        </td>
                        <td className="px-4 py-3">{row.consecutiveAbsences}</td>
                        <td className="px-4 py-3">
                          {row.pendingMakeups} / {row.completedMakeups}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              row.riskLevel === "HIGH"
                                ? "danger"
                                : row.riskLevel === "MEDIUM"
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {row.riskLevel}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )
      )}
    </div>
  );
}

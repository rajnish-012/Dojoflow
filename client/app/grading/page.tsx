"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, CalendarDays, FileBadge, Plus, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { getBranches } from "@/lib/api";
import { getTrainingSessionTypes } from "@/lib/trainingSessionTypeApi";
import {
  createGradingEvent,
  getEligibleForGrading,
  getGradingEvents,
  getGradingStaff,
  type Candidate,
  type GradingEvent,
  type StaffRecord,
} from "@/lib/gradingApi";
import { toast } from "@/lib/toast";
import { PERMISSIONS, useCan } from "@/lib/permissions";

const dateValue = () => new Date().toISOString().slice(0, 10);
type BranchChoice = { _id: string; name: string };
type ProgramChoice = { _id: string; name: string; isActive: boolean };

export default function GradingPage() {
  const router = useRouter();
  const canView = useCan(PERMISSIONS.GRADING_VIEW);
  const canCreate = useCan(PERMISSIONS.GRADING_CREATE);
  const canViewCertificates = useCan(PERMISSIONS.CERTIFICATE_VIEW);
  const [events, setEvents] = useState<GradingEvent[]>([]);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [branches, setBranches] = useState<BranchChoice[]>([]);
  const [programs, setPrograms] = useState<ProgramChoice[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [date, setDate] = useState(dateValue());
  const [branch, setBranch] = useState("");
  const [program, setProgram] = useState("");
  const [examiner, setExaminer] = useState("");
  const [notes, setNotes] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getGradingEvents();
      setEvents(result.events || []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load grading events.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    const timer = setTimeout(() => void loadEvents(), 0);
    return () => clearTimeout(timer);
  }, [canView, loadEvents]);
  useEffect(() => {
    if (!creating) return;
    let live = true;
    Promise.all([getBranches(), getTrainingSessionTypes(), getGradingStaff()])
      .then(([branchData, programData, staffData]) => {
        if (!live) return;
        setBranches((branchData.branches || []).map(({ _id, name }) => ({ _id, name })));
        setPrograms(programData.filter((item) => item.isActive).map(({ _id, name, isActive }) => ({ _id, name, isActive })));
        setStaff(staffData);
      })
      .catch((reason) => {
        if (live)
          toast.error(
            reason instanceof Error
              ? reason.message
              : "Unable to load grading setup.",
          );
      });
    return () => {
      live = false;
    };
  }, [creating]);
  useEffect(() => {
    if (!creating || !branch || !program || !date) return;
    let live = true;
    const timer = setTimeout(() => {
    setLoadingCandidates(true);
    getEligibleForGrading(branch, program, date)
      .then((result) => {
        if (live) {
          setCandidates(result.students || []);
          setSelected([]);
        }
      })
      .catch((reason) => {
        if (live)
          toast.error(
            reason instanceof Error
              ? reason.message
              : "Unable to check eligibility.",
          );
      })
      .finally(() => {
        if (live) setLoadingCandidates(false);
      });
    }, 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [creating, branch, program, date]);

  const eligible = useMemo(
    () => candidates.filter((item) => item.eligible),
    [candidates],
  );
  async function submitEvent() {
    if (!date || !branch || !program || !examiner || selected.length === 0) {
      toast.error(
        "Choose the event details and at least one eligible student.",
      );
      return;
    }
    try {
      setSaving(true);
      const result = await createGradingEvent({
        date,
        branch,
        program,
        examiner,
        studentIds: selected,
        notes,
      });
      toast.success("Grading event scheduled.");
      router.push(`/grading/${result.event._id}`);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Unable to create grading event.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Grading & certificates"
        description="Schedule belt examinations, record results, and issue academy certificates."
        eyebrow="Student progression"
        actions={
          <div className="flex flex-wrap gap-2">
          {canViewCertificates && <Link href="/certificates"><Button variant="outline" leftIcon={<FileBadge size={16} />}>Certificates</Button></Link>}
          {canCreate ? (
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => setCreating((value) => !value)}
            >
              {creating ? "Close setup" : "Schedule grading"}
            </Button>
          ) : null}
          </div>
        }
      />
      {creating && (
        <Card className="mb-6 p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold">New grading event</h2>
            <p className="mt-1 text-sm text-(--ink-muted)">
              Only students who meet the existing promotion eligibility rules
              can be selected.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-(--ink-muted)">
              Date
              <Input
                className="mt-1"
                type="date"
                value={date}
                onChange={(event) => { setDate(event.target.value); setCandidates([]); setSelected([]); }}
              />
            </label>
            <label className="text-xs font-semibold text-(--ink-muted)">
              Branch
              <Select
                className="mt-1"
                value={branch}
                onChange={(event) => { setBranch(event.target.value); setCandidates([]); setSelected([]); }}
              >
                <option value="">Choose branch</option>
                {branches.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-semibold text-(--ink-muted)">
              Program
              <Select
                className="mt-1"
                value={program}
                onChange={(event) => { setProgram(event.target.value); setCandidates([]); setSelected([]); }}
              >
                <option value="">Choose program</option>
                {programs.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-semibold text-(--ink-muted)">
              Coach / examiner
              <Select
                className="mt-1"
                value={examiner}
                onChange={(event) => setExaminer(event.target.value)}
              >
                <option value="">Choose examiner</option>
                {staff.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name} · {String(item.role).replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <label className="mt-4 block text-xs font-semibold text-(--ink-muted)">
            Notes
            <Textarea
              className="mt-1"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional event notes"
            />
          </label>
          <div className="mt-5 border-t border-(--line) pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Eligible students</h3>
              <span className="text-xs text-(--ink-muted)">
                {selected.length} selected · {eligible.length} eligible
              </span>
            </div>
            {!branch || !program ? (
              <p className="rounded-xl bg-(--hover-bg) p-4 text-sm text-(--ink-muted)">
                Choose a branch, program, and date to check student eligibility.
              </p>
            ) : loadingCandidates ? (
              <div className="flex justify-center p-6">
                <LoadingSpinner />
              </div>
            ) : eligible.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {eligible.map((item) => (
                  <label
                    key={item.student._id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-(--line) p-3 hover:bg-(--hover-bg)"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(item.student._id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, item.student._id]
                            : current.filter((id) => id !== item.student._id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {item.student.name}
                      </span>
                      <span className="text-xs text-(--ink-muted)">
                        {item.student.currentBelt || "White"} belt · milestone:{" "}
                        {item.milestone?.belt || "—"}
                      </span>
                    </span>
                    <Badge variant="success">Eligible</Badge>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-(--hover-bg) p-4 text-sm text-(--ink-muted)">
                {candidates.length
                  ? "No eligible students are available for this date."
                  : "No active students found."}
              </div>
            )}
            {!!candidates.filter((item) => !item.eligible).length && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-(--ink-muted)">
                  Ineligible students (
                  {candidates.filter((item) => !item.eligible).length})
                </summary>
                <div className="mt-2 space-y-2">
                  {candidates
                    .filter((item) => !item.eligible)
                    .map((item) => (
                      <div
                        key={item.student._id}
                        className="flex justify-between gap-3 rounded-lg border border-(--line) px-3 py-2 text-sm"
                      >
                        <span>{item.student.name}</span>
                        <span className="text-right text-(--ink-muted)">
                          {item.reason}
                        </span>
                      </div>
                    ))}
                </div>
              </details>
            )}
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              loading={saving}
              disabled={saving || selected.length === 0}
              onClick={() => void submitEvent()}
            >
              Create grading event
            </Button>
          </div>
        </Card>
      )}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <ErrorState
          title="Grading events unavailable"
          message={error}
          action={
            <Button variant="outline" onClick={() => void loadEvents()}>
              Try again
            </Button>
          }
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Award size={24} />}
          title="No grading events yet"
          description="Schedule an examination to begin evaluating eligible students."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-(--line)">
            {events.map((event) => (
              <Link
                key={event._id}
                href={`/grading/${event._id}`}
                className="flex flex-col gap-3 p-4 transition hover:bg-(--hover-bg) sm:flex-row sm:items-center sm:px-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                  <CalendarDays size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">
                      {event.program?.name || "Grading"}
                    </p>
                    <Badge
                      variant={
                        event.status === "COMPLETED"
                          ? "success"
                          : event.status === "CANCELLED"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {event.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-(--ink-muted)">
                    {new Date(event.date).toLocaleDateString("en-IN", {
                      dateStyle: "medium",
                    })}{" "}
                    · {event.branch?.name || "Branch"} · Examiner:{" "}
                    {event.examiner?.name || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-(--ink-muted)">
                  <Users size={16} />
                  {event.students?.length || 0} students
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

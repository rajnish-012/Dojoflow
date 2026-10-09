"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  RefreshCw,
  CalendarDays,
  Users,
} from "lucide-react";

import AcademyCalendar, {
  getCalendarEventPresentation,
} from "@/components/calendar/AcademyCalendar";
import {
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  DataFilters,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  Textarea,
  type ActiveFilter,
} from "@/components/ui";
import {
  CalendarRequestError,
  cancelAcademyEvent,
  completeAcademyEvent,
  createAcademyEvent,
  getAcademyEvent,
  getCalendar,
  previewAcademyEventConflicts,
  registerStudentForAcademyEvent,
  updateTrainingSessionStatus,
  type AcademyEventDetail,
  type AcademyEventInput,
  type CalendarEvent,
  type CalendarEventType,
  updateAcademyEvent,
} from "@/lib/calendarApi";
import { getBranches, getStudents, type StudentRecord } from "@/lib/api";
import { getCoachAssignmentCoaches } from "@/lib/coachAssignmentApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";
import { getTrainingSessionTypes } from "@/lib/trainingSessionTypeApi";

type Choice = { _id: string; name: string };
type LifecycleAction = "cancel" | "complete" | null;

const EVENT_TYPES: Array<{ value: "" | CalendarEventType; label: string }> = [
  { value: "", label: "All event types" },
  { value: "CLASS", label: "Classes" },
  { value: "HOLIDAY", label: "Holidays" },
  { value: "MAKEUP", label: "Makeups" },
  { value: "TRIAL", label: "Trials" },
  { value: "GRADING", label: "Grading" },
  { value: "PROMOTION", label: "Promotions" },
  { value: "ACADEMY_EVENT", label: "Academy events" },
  { value: "COACH_LEAVE", label: "Coach leave" },
  { value: "ANNOUNCEMENT", label: "Announcements" },
];

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function monthBounds(value: Date) {
  return {
    start: localDateKey(new Date(value.getFullYear(), value.getMonth(), 1)),
    end: localDateKey(new Date(value.getFullYear(), value.getMonth() + 1, 0)),
  };
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string) {
  if (!value) return "All day";
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
}

function newForm(branch = ""): AcademyEventInput {
  const today = localDateKey(new Date());
  return {
    name: "",
    description: "",
    category: "ACADEMY_EVENT",
    branch,
    startDate: today,
    endDate: today,
    startTime: "09:00",
    endTime: "10:00",
    program: "",
    coach: "",
    capacity: null,
    location: "",
    registrationRequired: false,
    registrationDeadline: "",
    status: "DRAFT",
  };
}

function valueFromMetadata(item: CalendarEvent, key: string) {
  const value = item.metadata?.[key];
  return value === undefined || value === null ? "" : String(value);
}

export default function AcademyCalendarPage() {
  const canView = useCan(PERMISSIONS.CALENDAR_VIEW);
  const canManage = useCan(PERMISSIONS.EVENT_MANAGE);
  const canRegister = useCan(PERMISSIONS.EVENT_REGISTER);
  const canManageSessions = useCan(PERMISSIONS.BRANCH_SCHEDULE_MANAGE);
  const canViewTrainingAvailability = useCan(PERMISSIONS.BRANCH_SCHEDULE_VIEW);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [view, setView] = useState<"month" | "agenda">("agenda");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [branches, setBranches] = useState<Choice[]>([]);
  const [programs, setPrograms] = useState<Choice[]>([]);
  const [coaches, setCoaches] = useState<Choice[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [filters, setFilters] = useState({
    type: "",
    branch: "",
    program: "",
    coach: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [detail, setDetail] = useState<AcademyEventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AcademyEventInput>(() => newForm());
  const [saving, setSaving] = useState(false);
  const [conflictMessages, setConflictMessages] = useState<string[]>([]);
  const [confirmConflicts, setConfirmConflicts] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction>(null);
  const [registering, setRegistering] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [sessionCloseOpen, setSessionCloseOpen] = useState(false);
  const [sessionCloseReason, setSessionCloseReason] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const syncView = () => setView(media.matches ? "month" : "agenda");
    const timer = window.setTimeout(syncView, 0);
    media.addEventListener("change", syncView);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", syncView);
    };
  }, []);

  const loadReferenceData = useCallback(async () => {
    const results = await Promise.allSettled([
      getBranches(),
      getTrainingSessionTypes(),
      getCoachAssignmentCoaches(),
    ]);
    const branchResult = results[0];
    if (branchResult.status === "fulfilled") {
      setBranches(
        branchResult.value.branches.map((branch) => ({
          _id: branch._id,
          name: branch.name,
        })),
      );
    }
    const programResult = results[1];
    if (programResult.status === "fulfilled") {
      setPrograms(
        programResult.value
          .filter((program) => program.isActive)
          .map((program) => ({ _id: program._id, name: program.name })),
      );
    }
    const coachResult = results[2];
    if (coachResult.status === "fulfilled") {
      const available = Array.isArray(coachResult.value?.coaches)
        ? coachResult.value.coaches
        : [];
      setCoaches(
        available.map((coach: Choice) => ({
          _id: coach._id,
          name: coach.name,
        })),
      );
    }
  }, []);

  const loadCalendar = useCallback(
    async (refresh = false) => {
      if (!canView) return;
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError("");
        const bounds = monthBounds(month);
        const data = await getCalendar({
          ...bounds,
          branch: filters.branch,
          types: filters.type,
          program: filters.program,
          coach: filters.coach,
        });
        setEvents(data.events);
        if (!branches.length && data.branches.length)
          setBranches(
            data.branches.map((branch) => ({
              _id: branch.id,
              name: branch.name,
            })),
          );
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load academy calendar.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branches.length, canView, filters, month],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReferenceData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadReferenceData]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadCalendar(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCalendar]);

  const monthTitle = useMemo(
    () => month.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    [month],
  );
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const next: ActiveFilter[] = [];
    const eventType = EVENT_TYPES.find(
      (item) => item.value === filters.type,
    )?.label;
    const branch = branches.find((item) => item._id === filters.branch)?.name;
    const program = programs.find((item) => item._id === filters.program)?.name;
    const coach = coaches.find((item) => item._id === filters.coach)?.name;
    if (filters.type)
      next.push({
        id: "type",
        label: eventType || "Event type",
        onClear: () => setFilters((current) => ({ ...current, type: "" })),
      });
    if (filters.branch)
      next.push({
        id: "branch",
        label: branch || "Branch",
        onClear: () => setFilters((current) => ({ ...current, branch: "" })),
      });
    if (filters.program)
      next.push({
        id: "program",
        label: program || "Program",
        onClear: () => setFilters((current) => ({ ...current, program: "" })),
      });
    if (filters.coach)
      next.push({
        id: "coach",
        label: coach || "Coach",
        onClear: () => setFilters((current) => ({ ...current, coach: "" })),
      });
    return next;
  }, [branches, coaches, filters, programs]);
  const selectedPresentation = selected
    ? getCalendarEventPresentation(selected.type)
    : null;

  async function openDetails(item: CalendarEvent) {
    setSelected(item);
    setDetail(null);
    setStudentId("");
    if (item.source !== "academy_event") return;
    try {
      setDetailLoading(true);
      const response = await getAcademyEvent(item.sourceId);
      setDetail(response.event);
      if (canRegister && response.event.registrationRequired) {
        const data = await getStudents({
          branch: response.event.branch,
          status: "ACTIVE",
          limit: 100,
        });
        setStudents(data.students || []);
      }
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Unable to load event details.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setConflictMessages([]);
    setForm(newForm(filters.branch || branches[0]?._id || ""));
    setFormOpen(true);
  }

  function openEdit() {
    if (!selected || !detail) return;
    setEditingId(detail._id);
    setConflictMessages([]);
    setForm({
      name: detail.name,
      description: detail.description,
      category: detail.category,
      branch: detail.branch,
      startDate: detail.startDate,
      endDate: detail.endDate,
      startTime: detail.startTime,
      endTime: detail.endTime,
      program: detail.program || "",
      coach: detail.coach || "",
      capacity: detail.capacity,
      location: detail.location,
      registrationRequired: detail.registrationRequired,
      registrationDeadline: detail.registrationDeadline || "",
      status:
        detail.status === "OPEN"
          ? "OPEN"
          : detail.status === "SCHEDULED"
            ? "SCHEDULED"
            : "DRAFT",
    });
    setFormOpen(true);
  }

  async function saveEvent(confirmed = false) {
    try {
      setSaving(true);
      const preview = await previewAcademyEventConflicts(
        form,
        editingId || undefined,
      );
      if (preview.blocking.length) {
        setConflictMessages(
          preview.blocking.map((conflict) => conflict.message),
        );
        toast.error("Resolve the blocking calendar conflicts before saving.");
        return;
      }
      if (preview.warnings.length && !confirmed) {
        setConflictMessages(
          preview.warnings.map((conflict) => conflict.message),
        );
        setConfirmConflicts(true);
        return;
      }
      if (editingId)
        await updateAcademyEvent(editingId, {
          ...form,
          confirmConflicts: confirmed,
        });
      else await createAcademyEvent({ ...form, confirmConflicts: confirmed });
      toast.success(
        editingId ? "Academy event updated." : "Academy event created.",
      );
      setFormOpen(false);
      setConfirmConflicts(false);
      setSelected(null);
      await loadCalendar(true);
    } catch (reason) {
      if (reason instanceof CalendarRequestError && reason.conflicts.length)
        setConflictMessages(
          reason.conflicts.map((conflict) => conflict.message),
        );
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Unable to save academy event.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function runLifecycle() {
    if (!selected || !lifecycleAction) return;
    try {
      setSaving(true);
      if (lifecycleAction === "cancel")
        await cancelAcademyEvent(selected.sourceId);
      else await completeAcademyEvent(selected.sourceId);
      toast.success(
        lifecycleAction === "cancel"
          ? "Academy event cancelled."
          : "Academy event completed.",
      );
      setLifecycleAction(null);
      setSelected(null);
      await loadCalendar(true);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Unable to update academy event.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function registerStudent() {
    if (!selected || !studentId) return;
    try {
      setRegistering(true);
      await registerStudentForAcademyEvent(selected.sourceId, studentId);
      toast.success("Student registered for the event.");
      setStudentId("");
      await openDetails(selected);
      await loadCalendar(true);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Unable to register student.",
      );
    } finally {
      setRegistering(false);
    }
  }

  async function changeSessionStatus(status: "CLOSED" | "SCHEDULED") {
    if (!selected || !["session", "batch_occurrence"].includes(selected.source))
      return;
    try {
      setSaving(true);
      const occurrence =
        selected.source === "batch_occurrence"
          ? {
              branchId: selected.branch?.id || "",
              date: valueFromMetadata(selected, "trainingDate"),
              slotId: valueFromMetadata(selected, "slotId"),
              batchId: valueFromMetadata(selected, "batchId"),
            }
          : undefined;
      const result = await updateTrainingSessionStatus(
        valueFromMetadata(selected, "sessionId") || selected.sourceId,
        status,
        status === "CLOSED" ? sessionCloseReason : "",
        occurrence,
      );
      setSelected({
        ...selected,
        source: "session",
        sourceId: result.session?._id || selected.sourceId,
        status,
        metadata: {
          ...selected.metadata,
          sessionId: result.session?._id || "",
        },
      });
      setSessionCloseOpen(false);
      setSessionCloseReason("");
      if (result?.batch?.capacityIssue) toast.error(result.batch.capacityIssue);
      else
        toast.success(
          status === "CLOSED"
            ? "Session closed and Batch completion recalculated."
            : "Session reopened and Batch completion recalculated.",
        );
      await loadCalendar(true);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Unable to update Session status.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Calendar access unavailable"
          message="Your role does not include the academy calendar."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <LoadingSpinner text="Loading academy calendar..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Calendar unavailable"
          message={error}
          action={
            <Button variant="outline" onClick={() => void loadCalendar()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Academy operations"
        title="Academy calendar"
        description="The unified academy timeline for classes, holidays, leave, student activity, grading, promotions, and events. Use Training Availability for Branch operating days and Batch schedule details."
        actions={
          <div className="flex flex-wrap gap-2">
            {canViewTrainingAvailability && (
              <Link href="/branch-schedules">
                <Button variant="outline">Training Availability</Button>
              </Link>
            )}
            {canManage && (
              <Button
                className="max-w-full"
                leftIcon={<Plus size={16} />}
                onClick={openCreate}
              >
                Add academy event
              </Button>
            )}
          </div>
        }
      />

      <Card className="mb-5 min-w-0 max-w-full overflow-hidden" padding="none">
        <div className="border-b border-(--line) p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--accent)">
                Academy calendar
              </p>
              <h2 className="mt-1 text-2xl font-bold text-(--foreground)">
                {monthTitle}
              </h2>
              <p className="mt-1 text-sm text-(--ink-muted)">
                {events.length} event{events.length === 1 ? "" : "s"} in this
                month
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                aria-label="Previous month"
                onClick={() =>
                  setMonth(
                    (value) =>
                      new Date(value.getFullYear(), value.getMonth() - 1, 1),
                  )
                }
              >
                <ChevronLeft size={17} />
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setMonth(
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1,
                    ),
                  )
                }
              >
                Today
              </Button>
              <Button
                variant="outline"
                aria-label="Next month"
                onClick={() =>
                  setMonth(
                    (value) =>
                      new Date(value.getFullYear(), value.getMonth() + 1, 1),
                  )
                }
              >
                <ChevronRight size={17} />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-start justify-end gap-2 p-4 sm:p-5">
          <DataFilters
            activeFilters={activeFilters}
            onClearAll={() =>
              setFilters({ type: "", branch: "", program: "", coach: "" })
            }
            panelWidth={420}
            contentClassName="grid gap-4 sm:grid-cols-2"
          >
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-(--foreground-soft)">
              Event type
              <Select
                value={filters.type}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    type: event.target.value,
                  }))
                }
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type.value || "all"} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-(--foreground-soft)">
              Branch
              <Select
                value={filters.branch}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    branch: event.target.value,
                  }))
                }
              >
                <option value="">All permitted branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-(--foreground-soft)">
              Program
              <Select
                value={filters.program}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    program: event.target.value,
                  }))
                }
              >
                <option value="">All programs</option>
                {programs.map((program) => (
                  <option key={program._id} value={program._id}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-(--foreground-soft)">
              Coach
              <Select
                value={filters.coach}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    coach: event.target.value,
                  }))
                }
              >
                <option value="">All coaches</option>
                {coaches.map((coach) => (
                  <option key={coach._id} value={coach._id}>
                    {coach.name}
                  </option>
                ))}
              </Select>
            </label>
          </DataFilters>
          <Button
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={() => void loadCalendar(true)}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />{" "}
            Refresh
          </Button>
        </div>
      </Card>

      <div className="mb-4 flex min-w-0 justify-end">
        <div className="flex shrink-0 rounded-xl border border-(--line) bg-(--card) p-1">
          <Button
            variant={view === "month" ? "primary" : "ghost"}
            className="hidden md:inline-flex"
            onClick={() => setView("month")}
          >
            <CalendarDays size={16} /> Month
          </Button>
          <Button
            variant={view === "agenda" ? "primary" : "ghost"}
            onClick={() => setView("agenda")}
          >
            <List size={16} /> Agenda
          </Button>
        </div>
      </div>
      <AcademyCalendar
        month={month}
        events={events}
        mode={view}
        onSelect={(item) => void openDetails(item)}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setDetail(null);
        }}
        title={selected?.title || "Calendar event"}
        eyebrow={selectedPresentation?.label || "Calendar event"}
        description={
          selected
            ? `${selectedPresentation?.label || "Event"} · ${formatDate(selected.start.date)}${selected.start.time ? ` · ${formatTime(selected.start.time)}` : ""}`
            : ""
        }
        size="lg"
        footer={
          selected ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setSelected(null);
                  setDetail(null);
                }}
              >
                Close
              </Button>
              {selected.source === "academy_event" &&
              canManage &&
              detail &&
              !["CANCELLED", "COMPLETED"].includes(selected.status) ? (
                <>
                  <Button variant="outline" onClick={openEdit}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLifecycleAction("complete")}
                  >
                    Complete
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setLifecycleAction("cancel")}
                  >
                    Cancel
                  </Button>
                </>
              ) : null}
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{selectedPresentation?.label}</Badge>
              <Badge
                variant={
                  selected.status === "CANCELLED"
                    ? "danger"
                    : selected.status === "COMPLETED"
                      ? "success"
                      : "neutral"
                }
              >
                {selected.status.replaceAll("_", " ")}
              </Badge>
              {selected.branch ? (
                <Badge variant="info">{selected.branch.name}</Badge>
              ) : null}
            </div>
            {selected.description ? (
              <p className="text-sm leading-6 text-(--ink-muted)">
                {selected.description}
              </p>
            ) : null}
            {selected.status === "CLOSED" &&
            valueFromMetadata(selected, "closureReason") ? (
              <div className="rounded-xl border border-(--danger)/25 bg-(--danger-soft) p-3 text-sm">
                <span className="font-semibold">Closure reason: </span>
                {valueFromMetadata(selected, "closureReason")}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [
                  "Date",
                  `${formatDate(selected.start.date)}${selected.end.date !== selected.start.date ? ` – ${formatDate(selected.end.date)}` : ""}`,
                ],
                [
                  "Time",
                  `${formatTime(selected.start.time)}${selected.end.time ? ` – ${formatTime(selected.end.time)}` : ""}`,
                ],
                [
                  "Program",
                  selected.program?.name || "Not specific to a program",
                ],
                ["Coach", selected.coach?.name || "Not assigned"],
                [
                  "Capacity",
                  selected.capacity === null
                    ? "Not limited"
                    : String(selected.capacity),
                ],
                [
                  "room",
                  selected.location ||
                    valueFromMetadata(selected, "location") ||
                    "Not specified",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-(--line) bg-(--surface) p-3"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-(--ink-muted)">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-(--foreground)">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {selected.source === "session" &&
            (valueFromMetadata(selected, "plannedContent") ||
              valueFromMetadata(selected, "curriculumName")) ? (
              <div className="rounded-xl border border-(--line) bg-(--surface) p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-(--ink-muted)">
                  Planned curriculum content
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {valueFromMetadata(selected, "plannedContent") ||
                    "No learning steps selected"}
                </p>
                {valueFromMetadata(selected, "curriculumName") ? (
                  <p className="mt-1 text-xs text-(--ink-muted)">
                    {valueFromMetadata(selected, "curriculumName")} · Version{" "}
                    {valueFromMetadata(selected, "curriculumVersion")}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-(--ink-muted)">
                  Planned content does not mark a student as having completed a
                  learning step.
                </p>
              </div>
            ) : null}
            {selected.source === "academy_event" && detailLoading ? (
              <LoadingSpinner />
            ) : null}
            {selected.source === "academy_event" &&
            detail?.registrationRequired ? (
              <div className="rounded-xl border border-(--line) p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Users size={17} className="text-(--accent)" />
                  <h3 className="font-bold">Event registration</h3>
                </div>
                <p className="mb-3 text-sm text-(--ink-muted)">
                  {valueFromMetadata(selected, "registered") || "0"} registered
                  {selected.capacity !== null
                    ? ` · ${valueFromMetadata(selected, "available") || "0"} places available`
                    : ""}
                </p>
                {canRegister &&
                !["CANCELLED", "COMPLETED"].includes(selected.status) ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      value={studentId}
                      onChange={(event) => setStudentId(event.target.value)}
                    >
                      <option value="">Choose active student</option>
                      {students.map((student) => (
                        <option key={student._id} value={student._id}>
                          {student.name}
                          {student.currentBelt
                            ? ` · ${student.currentBelt}`
                            : ""}
                        </option>
                      ))}
                    </Select>
                    <Button
                      disabled={!studentId}
                      loading={registering}
                      onClick={() => void registerStudent()}
                    >
                      Register
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {selected.actionUrl ? (
              <Link
                href={selected.actionUrl}
                className="inline-flex items-center text-sm font-bold text-(--accent) hover:underline"
              >
                Open source workflow
              </Link>
            ) : null}
            {(selected.source === "session" ||
              selected.source === "batch_occurrence") &&
            canManageSessions &&
            selected.status === "SCHEDULED" ? (
              <Button
                variant="danger"
                onClick={() => setSessionCloseOpen(true)}
              >
                Close Session
              </Button>
            ) : null}
            {selected.source === "session" &&
            canManageSessions &&
            selected.status === "CLOSED" ? (
              <Button
                variant="outline"
                onClick={() => void changeSessionStatus("SCHEDULED")}
                disabled={saving}
              >
                Reopen Session
              </Button>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        open={sessionCloseOpen}
        onClose={() => !saving && setSessionCloseOpen(false)}
        title="Close scheduled Session"
        description="The closure remains in Session history and the Batch completion date will be recalculated around this missed occurrence."
        footer={
          <>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setSessionCloseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={saving || !sessionCloseReason.trim()}
              onClick={() => void changeSessionStatus("CLOSED")}
            >
              Close Session
            </Button>
          </>
        }
      >
        <label className="block text-sm font-semibold">
          Reason
          <Input
            className="mt-1"
            maxLength={500}
            value={sessionCloseReason}
            onChange={(event) => setSessionCloseReason(event.target.value)}
            placeholder="Why is this Session being closed?"
          />
        </label>
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editingId ? "Edit academy event" : "Add academy event"}
        eyebrow="Academy operations"
        description="Generic events are the only calendar records created here. Classes, holidays, makeups, trials, grading, and promotions stay in their own workflows."
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveEvent(false)}>
              {editingId ? "Save changes" : "Create event"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold">
              Event name
              <Input
                className="mt-1"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold">
              Category
              <Select
                className="mt-1"
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target
                      .value as AcademyEventInput["category"],
                  }))
                }
              >
                {[
                  "ACADEMY_EVENT",
                  "TOURNAMENT",
                  "SEMINAR",
                  "WORKSHOP",
                  "COMPETITION",
                ].map((category) => (
                  <option key={category} value={category}>
                    {category.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-semibold">
              Status
              <Select
                className="mt-1"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as AcademyEventInput["status"],
                  }))
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="OPEN">Open</option>
              </Select>
            </label>
            <label className="text-sm font-semibold">
              Branch
              <Select
                className="mt-1"
                value={form.branch}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    branch: event.target.value,
                  }))
                }
              >
                <option value="">Choose branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-semibold">
              Program
              <Select
                className="mt-1"
                value={form.program || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    program: event.target.value,
                  }))
                }
              >
                <option value="">Any program</option>
                {programs.map((program) => (
                  <option key={program._id} value={program._id}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-semibold">
              Coach
              <Select
                className="mt-1"
                value={form.coach || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    coach: event.target.value,
                  }))
                }
              >
                <option value="">No coach assigned</option>
                {coaches
                  .filter((coach) => !form.branch || true)
                  .map((coach) => (
                    <option key={coach._id} value={coach._id}>
                      {coach.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="text-sm font-semibold">
              Start date
              <Input
                className="mt-1"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                    endDate:
                      current.endDate < event.target.value
                        ? event.target.value
                        : current.endDate,
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold">
              End date
              <Input
                className="mt-1"
                type="date"
                value={form.endDate || form.startDate}
                min={form.startDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold">
              Start time
              <Input
                className="mt-1"
                type="time"
                value={form.startTime}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startTime: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold">
              End time
              <Input
                className="mt-1"
                type="time"
                value={form.endTime}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endTime: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold">
              Location
              <Input
                className="mt-1"
                value={form.location || ""}
                placeholder="Room or venue"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-semibold">
              Capacity
              <Input
                className="mt-1"
                type="number"
                min="1"
                value={form.capacity ?? ""}
                placeholder="No limit"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    capacity: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Description
            <Textarea
              className="mt-1"
              rows={3}
              value={form.description || ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-(--line) p-3 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={form.registrationRequired}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  registrationRequired: event.target.checked,
                }))
              }
            />
            <span>
              <span className="font-semibold">Registration required</span>
              <span className="mt-0.5 block text-(--ink-muted)">
                Manage eligible student registrations and attendance for this
                event.
              </span>
            </span>
          </label>
          {form.registrationRequired ? (
            <label className="block max-w-xs text-sm font-semibold">
              Registration deadline
              <Input
                className="mt-1"
                type="date"
                max={form.startDate}
                value={form.registrationDeadline || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    registrationDeadline: event.target.value,
                  }))
                }
              />
            </label>
          ) : null}
          {conflictMessages.length ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-bold">Schedule review</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {conflictMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmationDialog
        open={confirmConflicts}
        title="Confirm schedule warning"
        description={
          <div className="space-y-2">
            <p>These events may run at the same branch and time.</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-(--ink-muted)">
              {conflictMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        }
        confirmLabel="Save event"
        confirmVariant="primary"
        loading={saving}
        onClose={() => setConfirmConflicts(false)}
        onConfirm={() => void saveEvent(true)}
      />
      <ConfirmationDialog
        open={lifecycleAction !== null}
        title={
          lifecycleAction === "cancel"
            ? "Cancel academy event"
            : "Complete academy event"
        }
        description={
          lifecycleAction === "cancel"
            ? "The event will remain visible in calendar history and registered students will be notified."
            : "Mark this event as completed. It will remain in calendar history."
        }
        confirmLabel={
          lifecycleAction === "cancel" ? "Cancel event" : "Complete event"
        }
        confirmVariant={lifecycleAction === "cancel" ? "danger" : "primary"}
        loading={saving}
        onClose={() => setLifecycleAction(null)}
        onConfirm={() => void runLifecycle()}
      />
    </div>
  );
}

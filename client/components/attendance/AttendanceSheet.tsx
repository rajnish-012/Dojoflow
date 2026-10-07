"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CalendarOff,
  ClipboardCheck,
  Clock3,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";

import {
  Badge,
  Button,
  DataTableSection,
  DataFilters,
  DataSort,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Select,
  TableHeading,
  TablePagination,
  type ActiveFilter,
} from "@/components/ui";

import AttendanceRow, { type DailyAttendanceRow } from "./AttendanceRow";

type AttendanceSheetProps = {
  rows: DailyAttendanceRow[];
  loading: boolean;
  error: string;
  savingStudentId: string | null;
  canManage: boolean;

  onMark: (row: DailyAttendanceRow, status: "PRESENT" | "ABSENT") => void;
  onUndo: (row: DailyAttendanceRow) => void;
  canRequestCorrection?: boolean;
  onRequestCorrection?: (row: DailyAttendanceRow) => void;
};

type AttendanceFilter = "ALL" | "PRESENT" | "ABSENT" | "NOT_MARKED" | "HOLIDAY";

const BELT_OPTIONS = [
  "White",
  "Yellow",
  "Orange",
  "Green",
  "Blue",
  "Purple",
  "Brown",
  "Black",
];

function formatTime(value?: string) {
  if (!value) return "";
  const [rawHour, minute] = value.split(":");
  const hour = Number(rawHour);
  if (!Number.isInteger(hour) || !minute) return value;
  return `${String(hour % 12 || 12).padStart(2, "0")}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

function getAttendanceStatus(
  row: DailyAttendanceRow,
): Exclude<AttendanceFilter, "ALL"> {
  if (row.holiday) return "HOLIDAY";
  if (row.attendance?.status === "PRESENT") return "PRESENT";
  if (row.attendance?.status === "ABSENT") return "ABSENT";
  return "NOT_MARKED";
}

export default function AttendanceSheet({
  rows,
  loading,
  error,
  savingStudentId,
  canManage,
  onMark,
  onUndo,
  canRequestCorrection = false,
  onRequestCorrection,
}: AttendanceSheetProps) {
  const [search, setSearch] = useState("");

  const [branchFilter, setBranchFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [trainingDayFilter, setTrainingDayFilter] = useState("");
  const [beltFilter, setBeltFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceFilter>("ALL");
  const [sort, setSort] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const branches = useMemo(
    () =>
      Array.from(
        new Map(
          rows.flatMap((row) =>
            row.student.branch
              ? [[row.student.branch._id, row.student.branch.name]]
              : [],
          ),
        ).entries(),
      )
        .map(([id, name]) => ({ id, name }))
        .sort((first, second) => first.name.localeCompare(second.name)),
    [rows],
  );

  const plans = useMemo(
    () =>
      Array.from(
        new Map(
          rows.flatMap((row) =>
            row.student.plan
              ? [[row.student.plan._id, row.student.plan.name]]
              : [],
          ),
        ).entries(),
      )
        .map(([id, name]) => ({ id, name }))
        .sort((first, second) => first.name.localeCompare(second.name)),
    [rows],
  );

  const trainingDays = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => Number(row.planDay))
            .filter((day) => Number.isInteger(day) && day > 0),
        ),
      ).sort((first, second) => first - second),
    [rows],
  );

  const belts = useMemo(
    () =>
      Array.from(
        new Set([
          ...BELT_OPTIONS,
          ...rows.map((row) => row.student.currentBelt || "White"),
        ]),
      ).filter(Boolean),
    [rows],
  );

  /* ==========================================
      FILTER ROWS
    ========================================== */

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        const matchesSearch =
          !normalizedSearch ||
          row.student.name?.toLowerCase().includes(normalizedSearch) ||
          row.student.phone?.toLowerCase().includes(normalizedSearch) ||
          row.student.plan?.name?.toLowerCase().includes(normalizedSearch) ||
          row.student.branch?.name?.toLowerCase().includes(normalizedSearch) ||
          row.curriculum?.title?.toLowerCase().includes(normalizedSearch) ||
          row.curriculum?.skill?.toLowerCase().includes(normalizedSearch) ||
          row.holiday?.name?.toLowerCase().includes(normalizedSearch) ||
          `day ${row.planDay}`.toLowerCase().includes(normalizedSearch);

        if (!matchesSearch) {
          return false;
        }

        if (branchFilter && row.student.branch?._id !== branchFilter)
          return false;
        if (planFilter && row.student.plan?._id !== planFilter) return false;
        if (
          trainingDayFilter &&
          Number(row.planDay) !== Number(trainingDayFilter)
        )
          return false;
        if (beltFilter && (row.student.currentBelt || "White") !== beltFilter)
          return false;

        return (
          statusFilter === "ALL" || getAttendanceStatus(row) === statusFilter
        );
      })
      .sort((first, second) => {
        if (sort === "name-desc")
          return second.student.name.localeCompare(first.student.name);
        if (sort === "trainingDay-asc")
          return Number(first.planDay || 0) - Number(second.planDay || 0);
        if (sort === "trainingDay-desc")
          return Number(second.planDay || 0) - Number(first.planDay || 0);
        if (sort === "branch-asc")
          return (first.student.branch?.name || "").localeCompare(
            second.student.branch?.name || "",
          );
        if (sort === "plan-asc")
          return (first.student.plan?.name || "").localeCompare(
            second.student.plan?.name || "",
          );
        if (sort === "status-asc")
          return getAttendanceStatus(first).localeCompare(
            getAttendanceStatus(second),
          );
        return first.student.name.localeCompare(second.student.name);
      });
  }, [
    beltFilter,
    branchFilter,
    planFilter,
    rows,
    search,
    sort,
    statusFilter,
    trainingDayFilter,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [
    search,
    branchFilter,
    planFilter,
    trainingDayFilter,
    beltFilter,
    statusFilter,
    sort,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function clearFilters() {
    setSearch("");
    setBranchFilter("");
    setPlanFilter("");
    setTrainingDayFilter("");
    setBeltFilter("");
    setStatusFilter("ALL");
  }

  const activeFilters: ActiveFilter[] = [];

  if (search.trim()) {
    activeFilters.push({
      id: "search",
      label: `Search: ${search.trim()}`,
      onClear: () => setSearch(""),
    });
  }

  const branch = branches.find((item) => item.id === branchFilter);
  const plan = plans.find((item) => item.id === planFilter);

  if (branch)
    activeFilters.push({
      id: "branch",
      label: branch.name,
      onClear: () => setBranchFilter(""),
    });
  if (plan)
    activeFilters.push({
      id: "plan",
      label: plan.name,
      onClear: () => setPlanFilter(""),
    });
  if (trainingDayFilter)
    activeFilters.push({
      id: "training-day",
      label: `Day ${trainingDayFilter}`,
      onClear: () => setTrainingDayFilter(""),
    });
  if (beltFilter)
    activeFilters.push({
      id: "belt",
      label: `${beltFilter} belt`,
      onClear: () => setBeltFilter(""),
    });

  if (statusFilter !== "ALL") {
    activeFilters.push({
      id: "status",
      label:
        statusFilter === "NOT_MARKED"
          ? "Not marked"
          : statusFilter[0] + statusFilter.slice(1).toLowerCase(),
      onClear: () => setStatusFilter("ALL"),
    });
  }

  return (
    <DataTableSection className="mt-6" title="Daily attendance" description="Mark attendance for active students and track their training progress." icon={<ClipboardCheck size={18} />} toolbar={
          <div
            className="
                flex w-full
                flex-col gap-2
                lg:w-auto
                lg:flex-row
                lg:items-start
              "
          >
            {/* SEARCH */}

            <div
              className="
                  relative
                  w-full
                  lg:w-[320px]
                "
            >
              <Search
                size={17}
                className="
                    pointer-events-none
                    absolute left-3
                    top-1/2
                    -translate-y-1/2
                    text-(--ink-faint)
                  "
              />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students..."
                className="pl-10"
              />
            </div>

            {/* FILTERS */}

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
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                Training plan
                <Select
                  value={planFilter}
                  onChange={(event) => setPlanFilter(event.target.value)}
                >
                  <option value="">All plans</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                Training day
                <Select
                  value={trainingDayFilter}
                  onChange={(event) => setTrainingDayFilter(event.target.value)}
                >
                  <option value="">All training days</option>
                  {trainingDays.map((day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                Belt
                <Select
                  value={beltFilter}
                  onChange={(event) => setBeltFilter(event.target.value)}
                >
                  <option value="">All belts</option>
                  {belts.map((belt) => (
                    <option key={belt} value={belt}>
                      {belt}
                    </option>
                  ))}
                </Select>
              </label>

              <label
                className="
                    grid gap-1.5
                    text-xs font-bold
                    text-(--foreground-soft)
                  "
              >
                Attendance status
                <Select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as AttendanceFilter)
                  }
                >
                  <option value="ALL">All statuses</option>

                  <option value="NOT_MARKED">Not marked</option>

                  <option value="PRESENT">Present</option>

                  <option value="ABSENT">Absent</option>

                  <option value="HOLIDAY">Holiday</option>
                </Select>
              </label>
            </DataFilters>
            <DataSort
              value={sort}
              onChange={setSort}
              options={[
                { value: "name-asc", label: "Student name: A to Z" },
                { value: "name-desc", label: "Student name: Z to A" },
                {
                  value: "trainingDay-asc",
                  label: "Training day: low to high",
                },
                {
                  value: "trainingDay-desc",
                  label: "Training day: high to low",
                },
                { value: "branch-asc", label: "Branch: A to Z" },
                { value: "plan-asc", label: "Plan: A to Z" },
                { value: "status-asc", label: "Attendance status" },
              ]}
            />
          </div>
      }>

      {/* ======================================
            LOADING
        ====================================== */}

      {loading && (
        <div
          className="
              flex min-h-[320px]
              items-center
              justify-center
              px-5 py-12
            "
        >
          <LoadingSpinner size="md" text="Loading attendance..." />
        </div>
      )}

      {/* ======================================
            ERROR
        ====================================== */}

      {!loading && error && (
        <div className="p-5 sm:p-6">
          <ErrorState title="Unable to load attendance" message={error} />
        </div>
      )}

      {/* ======================================
            NO ACTIVE STUDENTS
        ====================================== */}

      {!loading && !error && rows.length === 0 && (
        <div className="p-5 sm:p-6">
          <EmptyState
            title="No active students"
            description="No active students are available for attendance."
            icon={<UserRound size={22} />}
          />
        </div>
      )}

      {/* ======================================
            NO SEARCH RESULTS
        ====================================== */}

      {!loading && !error && rows.length > 0 && filteredRows.length === 0 && (
        <div
          className="
                flex min-h-[280px]
                flex-col
                items-center
                justify-center
                px-5 py-12
                text-center
              "
        >
          <div
            className="
                  flex h-12 w-12
                  items-center justify-center
                  rounded-2xl
                  bg-(--accent-soft)
                  text-(--accent)
                "
          >
            <Search size={21} />
          </div>

          <h3
            className="
                  mt-4 text-base
                  font-bold
                  text-(--foreground)
                "
          >
            No students found
          </h3>

          <p
            className="
                  mt-1 max-w-sm
                  text-sm
                  text-(--ink-muted)
                "
          >
            Try a different student name, phone number, plan, branch, holiday or
            attendance status.
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* ======================================
            DESKTOP TABLE
        ====================================== */}

      {!loading && !error && filteredRows.length > 0 && (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1250px]">
              <thead
                className="
                      border-b border-(--line)
                      bg-(--surface)
                    "
              >
                <tr>
                  <TableHeading>Student</TableHeading>

                  <TableHeading>Contact</TableHeading>

                  <TableHeading>Training</TableHeading>

                  <TableHeading>Today&apos;s step</TableHeading>

                  <TableHeading>Status</TableHeading>

                  <TableHeading align="right">Action</TableHeading>
                </tr>
              </thead>

              <tbody
                className="
                      divide-y
                      divide-(--line)
                    "
              >
                {paginatedRows.map((row) => (
                  <AttendanceRow
                    key={row.student._id}
                    row={row}
                    canManage={canManage}
                    saving={savingStudentId === row.student._id}
                    onMark={onMark}
                    onUndo={onUndo}
                    canRequestCorrection={canRequestCorrection}
                    onRequestCorrection={onRequestCorrection}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ==================================
                  MOBILE
              ================================== */}

          <div
            className="
                  space-y-3
                  p-4
                  md:hidden
                "
          >
            {paginatedRows.map((row) => (
              <AttendanceMobileCard
                key={row.student._id}
                row={row}
                canManage={canManage}
                saving={savingStudentId === row.student._id}
                onMark={onMark}
                onUndo={onUndo}
                canRequestCorrection={canRequestCorrection}
                onRequestCorrection={onRequestCorrection}
              />
            ))}
          </div>
        </>
      )}
      {!loading && !error && (
        <TablePagination
          totalItems={filteredRows.length}
          visibleItems={paginatedRows.length}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          entityLabel="students"
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      )}
    </DataTableSection>
  );
}

/* ==========================================
    MOBILE CARD
  ========================================== */

function AttendanceMobileCard({
  row,
  canManage,
  saving,
  onMark,
  onUndo,
  canRequestCorrection = false,
  onRequestCorrection,
}: {
  row: DailyAttendanceRow;
  canManage: boolean;
  saving: boolean;

  onMark: (row: DailyAttendanceRow, status: "PRESENT" | "ABSENT") => void;
  onUndo: (row: DailyAttendanceRow) => void;
  canRequestCorrection?: boolean;
  onRequestCorrection?: (row: DailyAttendanceRow) => void;
}) {
  const status = row.attendance?.status;

  const isHoliday = Boolean(row.holiday);
  const isBranchClosed =
    !isHoliday &&
    row.branchSchedule?.configured === true &&
    row.branchSchedule.isOpen === false;
  const scheduledSessions = (row.branchSchedule?.slots || []).filter(
    (slot) => slot.entitled && slot.curriculumAvailable,
  );
  const selectedSession = (row.branchSchedule?.slots || []).find(
    (slot) =>
      String(slot._id || "") === String(row.attendance?.sessionSlotId || ""),
  );
  const sessionName =
    row.attendance?.sessionName || selectedSession?.sessionName;
  const sessionStart =
    row.attendance?.sessionStartTime || selectedSession?.startTime;
  const sessionEnd = row.attendance?.sessionEndTime || selectedSession?.endTime;
  const canMarkSession = scheduledSessions.some((slot) => !slot.attendance);

  return (
    <div
      className="
          group
          rounded-2xl
          border border-(--line)
          bg-(--surface)
          p-4
          transition-all
          duration-200
          hover:-translate-y-0.5
          hover:border-(--line-strong)
          hover:bg-(--card)
          hover:shadow-[0_8px_25px_var(--shadow-color)]
        "
    >
      {/* TOP */}

      <div
        className="
            flex items-start
            justify-between gap-3
          "
      >
        <div
          className="
              flex min-w-0
              items-center gap-3
            "
        >
          <div
            className="
                flex h-10 w-10 shrink-0
                items-center justify-center
                rounded-full
                border border-(--line)
                bg-(--sidebar-logo-bg)
                text-xs font-black
                text-(--gold)
              "
          >
            {row.student.name
              .split(" ")
              .filter(Boolean)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div className="min-w-0">
            <p
              className="
                  break-words text-sm
                  font-bold
                  text-(--foreground-soft)
                "
            >
              {row.student.name}
            </p>

            <p
              className="
                  mt-1 text-xs
                  text-(--ink-muted)
                "
            >
              Age {row.student.age ?? "—"}
            </p>
          </div>
        </div>

        {isHoliday && (
          <Badge variant="default">
            <span className="inline-flex items-center gap-1.5">
              <CalendarOff size={12} />
              HOLIDAY
            </span>
          </Badge>
        )}

        {!isHoliday && status === "PRESENT" && (
          <Badge variant="success">Present</Badge>
        )}

        {!isHoliday && status === "ABSENT" && (
          <Badge variant="danger">Absent</Badge>
        )}

        {!isHoliday && isBranchClosed && (
          <Badge variant="default">Closed</Badge>
        )}

        {!isHoliday && !isBranchClosed && status === "PARTIAL" && (
          <Badge variant="warning">Partial</Badge>
        )}
        {!isHoliday && !isBranchClosed && !status && (
          <Badge variant={row.curriculumComplete ? "warning" : "default"}>
            {row.curriculumComplete ? "Curriculum complete" : "Not marked"}
          </Badge>
        )}
      </div>

      {/* HOLIDAY MESSAGE */}

      {isHoliday && (
        <div
          className="
              mt-4
              flex items-start gap-2
              rounded-xl
              border border-(--line)
              bg-(--accent-soft)
              px-3 py-3
            "
        >
          <CalendarOff
            size={16}
            className="
                mt-0.5
                shrink-0
                text-(--accent)
              "
          />

          <div className="min-w-0">
            <p
              className="
                  text-sm font-bold
                  text-(--accent)
                "
            >
              {row.holiday?.name || "Holiday"}
            </p>

            <p
              className="
                  mt-1 text-xs
                  leading-5
                  text-(--ink-muted)
                "
            >
              {row.holiday?.description || "No training session on this date."}
            </p>
          </div>
        </div>
      )}

      {/* DETAILS */}

      <div
        className="
            mt-4
            grid grid-cols-2
            gap-x-4 gap-y-4
            border-t border-(--line)
            pt-4
          "
      >
        <MobileDetail label="Contact" value={row.student.phone || "No phone"} />

        <MobileDetail label="Training" value={`Day ${row.planDay}`} />

        <MobileDetail
          label="Plan"
          value={row.student.plan?.name || "No plan"}
        />

        <MobileDetail
          label="Branch"
          value={row.student.branch?.name || "No branch"}
        />

        <div className="col-span-2">
          <MobileDetail
            label={isHoliday ? "Status" : "Today's step"}
            value={
              isHoliday
                ? "HOLIDAY — no attendance"
                : row.curriculum?.title ||
                  (row.curriculumComplete
                    ? "Program curriculum complete"
                    : "No curriculum configured")
            }
          />
        </div>
        {!isHoliday && row.curriculum?.skill && (
          <div className="col-span-2 -mt-2 break-words text-xs text-(--ink-muted)">
            {row.curriculum.skill}
          </div>
        )}
        {!isHoliday && !isBranchClosed && (
          <div className="col-span-2 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-(--ink-faint)">
              Selected session
            </p>
            {row.attendance ? (
              <p className="mt-1 flex items-start gap-1.5 break-words text-sm font-semibold text-(--accent)">
                <Clock3 size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">
                  {sessionName || "Session details unavailable"}
                  {(sessionStart || sessionEnd) &&
                    ` · ${formatTime(sessionStart)} – ${formatTime(sessionEnd)}`}
                  {selectedSession?.capacity != null && ` · ${selectedSession.currentEnrollment ?? 0}/${selectedSession.capacity} enrolled · ${selectedSession.availableSeats ?? 0} seats available`}
                </span>
              </p>
            ) : scheduledSessions.length ? (
              <div className="mt-1 flex flex-col gap-1.5">
                {scheduledSessions.map((session, index) => (
                  <p
                    key={session._id || `${session.sessionName}-${index}`}
                    className="flex items-start gap-1.5 break-words text-xs font-medium text-(--ink-muted)"
                  >
                    <Clock3
                      size={13}
                      className="mt-0.5 shrink-0 text-(--accent)"
                    />
                    <span className="min-w-0 break-words">
                      {session.sessionName ||
                        session.programName ||
                        "Training session"}
                      {` · ${formatTime(session.startTime)} – ${formatTime(session.endTime)}`}
                      {session.capacity != null && ` · ${session.currentEnrollment ?? 0}/${session.capacity} enrolled · ${session.availableSeats ?? 0} seats available`}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-(--ink-muted)">
                No matching session scheduled.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ACTIONS */}

      <div
        className="
            mt-4
            flex items-center
            justify-between gap-3
            border-t border-(--line)
            pt-4
          "
      >
        <span
          className="
              text-xs
              text-(--ink-faint)
            "
        >
          Day {row.planDay}
        </span>

        {!isHoliday && row.attendance && canRequestCorrection && row.attendance.attendanceType !== "MAKEUP" ? (
          <button type="button" disabled={saving || !row.attendance._id} onClick={() => onRequestCorrection?.(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-(--line) px-3 py-2 text-xs font-bold text-(--foreground-soft) hover:bg-(--hover-bg) disabled:opacity-50"><ClipboardCheck size={14}/> Request correction</button>
        ) : !isHoliday && row.attendance && canManage && row.attendance.attendanceType !== "MAKEUP" ? (
          <button
            type="button"
            disabled={saving || !row.attendance._id}
            onClick={() => onUndo(row)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-(--line) px-3 py-2 text-xs font-bold text-(--foreground-soft) hover:bg-(--hover-bg) disabled:opacity-50"
          >
            <RotateCcw size={14} /> Undo
          </button>
        ) : !isHoliday && !row.attendance && canManage ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={
                  saving ||
                  Boolean(row.attendance) ||
                  !canMarkSession ||
                  isHoliday ||
                  Boolean(
                    row.branchSchedule?.configured &&
                    !row.branchSchedule.isOpen,
                  )
                }
                aria-pressed={status === "PRESENT"}
                onClick={() => onMark(row, "PRESENT")}
                className={`
                  inline-flex
                  items-center gap-1.5
                  rounded-lg
                  px-3 py-2
                  text-xs font-bold
                  transition-colors
                  ${
                    status === "PRESENT"
                      ? "bg-(--primary) text-(--primary-foreground) disabled:opacity-100"
                      : "border border-(--line) text-(--foreground-soft) hover:bg-(--hover-bg)"
                  }
                `}
              >
                Present
              </button>

              <button
                type="button"
                disabled={
                  saving ||
                  Boolean(row.attendance) ||
                  !canMarkSession ||
                  isHoliday ||
                  Boolean(
                    row.branchSchedule?.configured &&
                    !row.branchSchedule.isOpen,
                  )
                }
                aria-pressed={status === "ABSENT"}
                onClick={() => onMark(row, "ABSENT")}
                className={`
                  inline-flex
                  items-center gap-1.5
                  rounded-lg
                  px-3 py-2
                  text-xs font-bold
                  transition-colors
                  ${
                    status === "ABSENT"
                      ? "bg-(--danger) text-white disabled:opacity-100"
                      : "border border-(--line) text-(--foreground-soft) hover:bg-(--hover-bg)"
                  }
                `}
              >
                Absent
              </button>
            </div>
        ) : null}

        {isHoliday && (
          <span
            className="
                inline-flex
                items-center gap-1.5
                rounded-lg
                border border-(--line)
                bg-(--surface)
                px-3 py-2
                text-xs font-bold
                text-(--ink-muted)
              "
          >
            <CalendarOff size={14} />
            No attendance
          </span>
        )}
      </div>
    </div>
  );
}

/* ==========================================
    MOBILE DETAIL
  ========================================== */

function MobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p
        className="
            text-[9px] font-black
            uppercase
            tracking-[0.12em]
            text-(--ink-faint)
          "
      >
        {label}
      </p>

      <p
        className="
            mt-1 break-words
            text-sm font-medium
            text-(--foreground-soft)
          "
      >
        {value}
      </p>
    </div>
  );
}

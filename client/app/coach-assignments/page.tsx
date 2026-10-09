"use client";
import { confirmAction, toast } from "@/lib/toast";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  Link2,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserRound,
  UserX,
  Users,
  X,
} from "lucide-react";

import {
  assignStudentToCoach,
  getCoachAssignmentCoaches,
  getCoachAssignments,
  unassignStudentFromCoach,
  type CoachAssignment,
  type CoachAssignmentCoach,
  type CoachAssignmentStudent,
} from "@/lib/coachAssignmentApi";

import { getBranches, getStudents } from "@/lib/api";

import { useCurrentUser } from "@/lib/current-user";
import { PERMISSIONS, useCan } from "@/lib/permissions";

import {
  Badge,
  Button,
  DataTableSection,
  DataTableToolbar,
  DataFilters,
  DataSort,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
  TableHeading,
  TablePagination,
  type ActiveFilter,
} from "@/components/ui";

type Branch = {
  _id: string;
  name: string;
  isActive?: boolean;
};

export default function CoachAssignmentsPage() {
  const user = useCurrentUser();

  const canViewAssignments = useCan(PERMISSIONS.COACH_ASSIGNMENT_VIEW);

  const canManageAssignments = useCan(PERMISSIONS.COACH_ASSIGNMENT_MANAGE);

  const [coaches, setCoaches] = useState<CoachAssignmentCoach[]>([]);

  const [students, setStudents] = useState<CoachAssignmentStudent[]>([]);

  const [branches, setBranches] = useState<Branch[]>([]);

  const [assignments, setAssignments] = useState<CoachAssignment[]>([]);

  const [selectedCoach, setSelectedCoach] = useState("");

  const [selectedStudent, setSelectedStudent] = useState("");

  const [search, setSearch] = useState("");

  const [coachFilter, setCoachFilter] = useState("");

  const [studentFilter, setStudentFilter] = useState("");

  const [branchFilter, setBranchFilter] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "ACTIVE" | "INACTIVE" | "ALL"
  >("ACTIVE");

  const [sort, setSort] = useState("assignedAt-desc");

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 1,
  });

  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const [showAssignModal, setShowAssignModal] = useState(false);

  const [error, setError] = useState("");


  const hasMountedSearch = useRef(false);

  /*
   * ---------------------------------------------------------
   * Initial data
   * ---------------------------------------------------------
   */

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [coachData, studentData, assignmentData, branchData] =
        await Promise.all([
          getCoachAssignmentCoaches(),
          getStudents(),
          getCoachAssignments({
            status: "ACTIVE",
            page: 1,
            limit: 25,
            sortBy: "assignedAt",
            sortOrder: "desc",
          }),
          user?.dataScope === "ALL"
            ? getBranches()
            : Promise.resolve({
                branches: [],
              }),
        ]);

      setCoaches(coachData.coaches || []);

      setStudents(studentData.students || []);

      setAssignments(assignmentData.assignments || []);

      setPagination(
        assignmentData.pagination || {
          page: 1,
          limit: 25,
          total: assignmentData.assignments?.length || 0,
          pages: 1,
        },
      );

      setBranches(branchData.branches || []);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load coach assignments.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canViewAssignments) {
      void loadData();
    } else if (user) {
      setLoading(false);
    }
  }, [canViewAssignments, user]);

  /*
   * ---------------------------------------------------------
   * Assignment list
   * ---------------------------------------------------------
   */

  async function loadAssignments(page = 1, limit = pagination.limit) {
    try {
      setError("");

      const data = await getCoachAssignments({
        coach: coachFilter || undefined,

        student: studentFilter || undefined,

        branch:
          user?.dataScope === "ALL" ? branchFilter || undefined : undefined,

        status: statusFilter,

        search: search.trim() || undefined,

        page,
        limit,

        sortBy: sort.split("-")[0] as
          | "assignedAt"
          | "createdAt"
          | "updatedAt"
          | "status",

        sortOrder: sort.endsWith("-asc") ? "asc" : "desc",
      });

      setAssignments(data.assignments || []);

      setPagination(
        data.pagination || {
          page,
          limit,
          total: data.assignments?.length || 0,
          pages: 1,
        },
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load coach assignments.",
      );
    }
  }

  useEffect(() => {
    if (canViewAssignments && !loading) {
      void loadAssignments(1);
    }
  }, [coachFilter, studentFilter, branchFilter, statusFilter, sort]);

  useEffect(() => {
    if (!hasMountedSearch.current) {
      hasMountedSearch.current = true;
      return;
    }

    const timer = window.setTimeout(
      () => void loadAssignments(1),
      search ? 250 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [search]);

  /*
   * ---------------------------------------------------------
   * Available students
   * ---------------------------------------------------------
   */

  const assignedStudentIds = useMemo(
    () => new Set(assignments.map((item) => item.student?._id).filter(Boolean)),
    [assignments],
  );

  const availableStudents = useMemo(
    () => students.filter((student) => !assignedStudentIds.has(student._id)),
    [students, assignedStudentIds],
  );

  /*
   * ---------------------------------------------------------
   * Filters
   * ---------------------------------------------------------
   */

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];

    const coach = coaches.find((item) => item._id === coachFilter);

    const student = students.find((item) => item._id === studentFilter);

    const branch = branches.find((item) => item._id === branchFilter);

    if (coach) {
      filters.push({
        id: "coach",
        label: coach.name,
        onClear: () => setCoachFilter(""),
      });
    }

    if (student) {
      filters.push({
        id: "student",
        label: student.name,
        onClear: () => setStudentFilter(""),
      });
    }

    if (branch) {
      filters.push({
        id: "branch",
        label: branch.name,
        onClear: () => setBranchFilter(""),
      });
    }

    if (statusFilter !== "ACTIVE") {
      filters.push({
        id: "status",
        label: statusFilter === "ALL" ? "All statuses" : "Inactive",
        onClear: () => setStatusFilter("ACTIVE"),
      });
    }

    return filters;
  }, [
    branches,
    branchFilter,
    coachFilter,
    coaches,
    statusFilter,
    studentFilter,
    students,
  ]);

  const clearAssignmentFilters = () => {
    setCoachFilter("");
    setStudentFilter("");
    setBranchFilter("");
    setStatusFilter("ACTIVE");
  };

  /*
   * ---------------------------------------------------------
   * Modal
   * ---------------------------------------------------------
   */

  const openAssignModal = () => {
    if (!canManageAssignments) {
      toast.error("You do not have permission to perform this action.");
      return;
    }

    setSelectedCoach("");
    setSelectedStudent("");
    setNote("");
    setError("");
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    if (saving) return;

    setShowAssignModal(false);
    setSelectedCoach("");
    setSelectedStudent("");
    setNote("");
  };

  /*
   * ---------------------------------------------------------
   * Assign
   * ---------------------------------------------------------
   */

  async function handleAssign() {
    setError("");

    if (!canManageAssignments) {
      toast.error("You do not have permission to perform this action.");
      return;
    }

    if (!selectedCoach) {
      setError("Please select a coach.");
      return;
    }

    if (!selectedStudent) {
      setError("Please select a student.");
      return;
    }

    try {
      setSaving(true);

      const data = await assignStudentToCoach({
        coach: selectedCoach,
        student: selectedStudent,
        note: note.trim(),
      });

      setShowAssignModal(false);

      setSelectedCoach("");
      setSelectedStudent("");
      setNote("");

      toast.success("Student assigned to coach successfully.");

      await loadAssignments(1, pagination.limit);
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to assign student.");
    } finally {
      setSaving(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * Unassign
   * ---------------------------------------------------------
   */

  async function handleUnassign(assignment: CoachAssignment) {
    if (!canManageAssignments) {
      toast.error("You do not have permission to perform this action.");
      return;
    }

    const confirmed = await confirmAction({ title: "Unassign student?", message: `Unassign ${assignment.student?.name} from ${assignment.coach?.name}?`, confirmLabel: "Unassign", destructive: true });

    if (!confirmed) {
      return;
    }

    try {
      setRemovingId(assignment._id);

      setError("");

      await unassignStudentFromCoach(assignment._id);

      toast.success("Student unassigned successfully.");

      await loadAssignments(pagination.page, pagination.limit);
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Failed to unassign student.");
    } finally {
      setRemovingId(null);
    }
  }

  /*
   * ---------------------------------------------------------
   * Access / Loading
   * ---------------------------------------------------------
   */

  if (!canViewAssignments && !loading) {
    return (
      <div className="df-page">
        <ErrorState
          title="Access denied"
          message="Your role does not include permission to view coach assignments."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="df-page">
        <LoadingSpinner fullPage text="Loading coach assignments..." />
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * Page
   * ---------------------------------------------------------
   */

  return (
    <div className="df-page">
      <PageHeader
        eyebrow="Staff management"
        title="Coach Assignments"
        description="Assign students to coaches and control which students each coach can access."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void loadData()}>
              <RefreshCw size={17} />
              Refresh
            </Button>

            {canManageAssignments && (
              <Button variant="primary" size="lg" onClick={openAssignModal}>
                <Plus size={18} />
                Assign student
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div
          className="
            mb-5 rounded-xl
            border border-(--danger-border)
            bg-(--danger-soft)
            px-4 py-3
            text-sm font-semibold
            text-(--danger)
          "
        >
          {error}
        </div>
      )}


      {/* Summary */}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Coaches"
          value={coaches.length}
          subtitle="Available coaches"
          icon={<UserRound size={20} />}
        />

        <SummaryCard
          title="Assigned Students"
          value={pagination.total}
          subtitle="Currently assigned"
          icon={<UserCheck size={20} />}
        />

        <SummaryCard
          title="Unassigned Students"
          value={availableStudents.length}
          subtitle="Ready for assignment"
          icon={<Users size={20} />}
        />
      </div>

      {/* Main table */}

      <DataTableSection className="mt-6" title="All assignments" description="View and manage every coach-student assignment." icon={<UserCheck size={18} />} toolbar={
          <DataTableToolbar>
            <div
              data-toolbar-search
              className="
                relative w-full
                lg:w-[340px]
              "
            >
              <Search
                size={17}
                aria-hidden="true"
                className="
                  pointer-events-none
                  absolute left-3.5
                  top-1/2
                  -translate-y-1/2
                  text-(--ink-faint)
                "
              />

              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search coach or student..."
                aria-label="Search coach or student"
                className="h-11 pl-10"
              />

              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setSearch("")}
                  className="
                    absolute right-2.5
                    top-1/2
                    flex h-7 w-7
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

            <DataFilters
              activeFilters={activeFilters}
              onClearAll={clearAssignmentFilters}
              responsiveToolbar
            >
              <label
                className="
                  grid gap-1.5
                  text-xs font-bold
                  text-(--foreground-soft)
                "
              >
                Coach
                <Select
                  value={coachFilter}
                  onChange={(event) => setCoachFilter(event.target.value)}
                >
                  <option value="">All coaches</option>

                  {coaches.map((coach) => (
                    <option key={coach._id} value={coach._id}>
                      {coach.name}
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
                Student
                <Select
                  value={studentFilter}
                  onChange={(event) => setStudentFilter(event.target.value)}
                >
                  <option value="">All students</option>

                  {students.map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.name}
                    </option>
                  ))}
                </Select>
              </label>

              {user?.dataScope === "ALL" && (
                <label
                  className="
                    grid gap-1.5
                    text-xs font-bold
                    text-(--foreground-soft)
                  "
                >
                  Branch
                  <Select
                    value={branchFilter}
                    onChange={(event) => setBranchFilter(event.target.value)}
                  >
                    <option value="">All branches</option>

                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                </label>
              )}

              <label
                className="
                  grid gap-1.5
                  text-xs font-bold
                  text-(--foreground-soft)
                "
              >
                Assignment status
                <Select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as "ACTIVE" | "INACTIVE" | "ALL",
                    )
                  }
                >
                  <option value="ALL">All statuses</option>

                  <option value="ACTIVE">Active</option>

                  <option value="INACTIVE">Inactive</option>
                </Select>
              </label>
            </DataFilters>

            <DataSort
              value={sort}
              onChange={setSort}
              options={[
                {
                  value: "assignedAt-desc",
                  label: "Recently assigned",
                },
                {
                  value: "assignedAt-asc",
                  label: "Oldest assignments",
                },
                {
                  value: "status-asc",
                  label: "Status: active first",
                },
              ]}
            />
        </DataTableToolbar>
      }>

        {/* Desktop table */}

        <div className="hidden overflow-x-auto md:block">
          <AssignmentTable
            assignments={assignments}
            canManage={canManageAssignments}
            removingId={removingId}
            onUnassign={handleUnassign}
          />
        </div>

        {/* Mobile cards */}

        <div className="space-y-3 p-4 md:hidden">
          {assignments.length === 0 ? (
            <EmptyState
              title="No assignments found"
              description={
                pagination.total === 0
                  ? "No students are currently assigned to coaches."
                  : "Try changing your search or filters."
              }
              icon={<UserX size={22} />}
            />
          ) : (
            assignments.map((assignment) => (
              <AssignmentMobileCard
                key={assignment._id}
                assignment={assignment}
                canManage={canManageAssignments}
                removingId={removingId}
                onUnassign={handleUnassign}
              />
            ))
          )}
        </div>

        {/* Footer */}

        {!loading && !error && (
          <TablePagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            visibleItems={assignments.length}
            pageSize={pagination.limit}
            entityLabel="assignments"
            onPrevious={() => void loadAssignments(pagination.page - 1)}
            onNext={() => void loadAssignments(pagination.page + 1)}
            onPageSizeChange={(pageSize) => void loadAssignments(1, pageSize)}
          />
        )}
      </DataTableSection>

      {/* Assign modal */}

      <Modal
        open={showAssignModal}
        onClose={closeAssignModal}
        title="Assign student"
        description="
          Assign a student to a coach and optionally add a note.
        "
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={closeAssignModal}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={() => void handleAssign()}
              loading={saving}
              disabled={!canManageAssignments}
            >
              <Link2 size={17} />
              {saving ? "Assigning..." : "Assign student"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div
            className="
              rounded-xl
              border border-(--line)
              bg-(--surface)
              p-4
            "
          >
            <div
              className="
                flex items-start
                gap-3
              "
            >
              <div
                className="
                  flex h-10 w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-(--accent-soft)
                  text-(--accent)
                "
              >
                <UserCheck size={19} />
              </div>

              <div>
                <p
                  className="
                    text-sm font-bold
                    text-(--foreground)
                  "
                >
                  Create coach assignment
                </p>

                <p
                  className="
                    mt-1 text-xs
                    leading-5
                    text-(--ink-muted)
                  "
                >
                  Select a coach and an unassigned student. The assignment will
                  immediately become active.
                </p>
              </div>
            </div>
          </div>

          <div
            className="
              grid gap-5
              sm:grid-cols-2
            "
          >
            <div>
              <label
                htmlFor="assignment-coach"
                className="
                  mb-2 block
                  text-sm font-bold
                  text-(--foreground-soft)
                "
              >
                Coach
              </label>

              <Select
                id="assignment-coach"
                value={selectedCoach}
                onChange={(event) => setSelectedCoach(event.target.value)}
              >
                <option value="">Select coach</option>

                {coaches.map((coach) => (
                  <option key={coach._id} value={coach._id}>
                    {coach.name}
                    {coach.branch?.name ? ` · ${coach.branch.name}` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label
                htmlFor="assignment-student"
                className="
                  mb-2 block
                  text-sm font-bold
                  text-(--foreground-soft)
                "
              >
                Student
              </label>

              <Select
                id="assignment-student"
                value={selectedStudent}
                onChange={(event) => setSelectedStudent(event.target.value)}
              >
                <option value="">Select student</option>

                {availableStudents.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.name}
                    {student.branch?.name ? ` · ${student.branch.name}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label
              htmlFor="assignment-note"
              className="
                mb-2 block
                text-[15px] font-semibold leading-5
                text-(--foreground-soft)
              "
            >
              Note{" "}
              <span
                className="
                  font-normal
                  text-(--ink-faint)
                "
              >
                (optional)
              </span>
            </label>

            <Input
              id="assignment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Evening batch"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/*
 * ===========================================================
 * Desktop Assignment Table
 * ===========================================================
 */

function AssignmentTable({
  assignments,
  canManage,
  removingId,
  onUnassign,
}: {
  assignments: CoachAssignment[];
  canManage: boolean;
  removingId: string | null;
  onUnassign: (assignment: CoachAssignment) => void;
}) {
  return (
    <table className="w-full min-w-[1000px]">
      <thead
        className="
          border-b border-(--line)
          bg-(--surface)
        "
      >
        <tr>
          <TableHeading>Student</TableHeading>

          <TableHeading>Coach</TableHeading>

          <TableHeading>Branch</TableHeading>

          <TableHeading>Status</TableHeading>

          <TableHeading>Assigned</TableHeading>

          <TableHeading align="right">Action</TableHeading>
        </tr>
      </thead>

      <tbody className="divide-y divide-(--line)">
        {assignments.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-8">
              <EmptyState
                title="No assignments found"
                description="
                  Try changing your search or filters.
                "
                icon={<UserX size={22} />}
              />
            </td>
          </tr>
        ) : (
          assignments.map((assignment) => (
            <AssignmentTableRow
              key={assignment._id}
              assignment={assignment}
              canManage={canManage}
              removingId={removingId}
              onUnassign={onUnassign}
            />
          ))
        )}
      </tbody>
    </table>
  );
}

/*
 * ===========================================================
 * Desktop Row
 * ===========================================================
 */

function AssignmentTableRow({
  assignment,
  canManage,
  removingId,
  onUnassign,
}: {
  assignment: CoachAssignment;
  canManage: boolean;
  removingId: string | null;
  onUnassign: (assignment: CoachAssignment) => void;
}) {
  const studentName = assignment.student?.name || "Unknown student";

  const coachName = assignment.coach?.name || "Unknown coach";

  const branchName =
    assignment.branch?.name ||
    assignment.student?.branch?.name ||
    assignment.coach?.branch?.name ||
    "No branch";

  return (
    <tr
      className="
        group
        transition-colors
        duration-200
        hover:bg-(--surface)
      "
    >
      {/* Student */}

      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <AssignmentAvatar name={studentName} />

          <div className="min-w-0">
            <p
              className="
                truncate
                text-[15px] font-semibold leading-5
                text-(--foreground-soft)
                transition-colors
                group-hover:text-(--accent)
              "
            >
              {studentName}
            </p>

            {assignment.student?.phone && (
              <p
                className="
                  mt-1 text-sm leading-5
                  text-(--ink-muted)
                "
              >
                {assignment.student.phone}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Coach */}

      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className="
              flex h-9 w-9
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-(--accent-soft)
              text-(--accent)
            "
          >
            <UserRound size={16} />
          </div>

          <div className="min-w-0">
            <p
              className="
                truncate
                text-[15px] font-semibold leading-5
                text-(--foreground-soft)
              "
            >
              {coachName}
            </p>

            {assignment.coach?.branch?.name && (
              <p
                className="
                  mt-1 truncate
                  text-sm leading-5
                  text-(--ink-muted)
                "
              >
                {assignment.coach.branch.name}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Branch */}

      <td className="px-6 py-5">
        <p
          className="
            text-[15px] font-medium leading-5
            text-(--foreground-soft)
          "
        >
          {branchName}
        </p>

        {assignment.note && (
          <p
            className="
              mt-1 max-w-[220px]
              truncate text-sm leading-5
              text-(--ink-muted)
            "
            title={assignment.note}
          >
            {assignment.note}
          </p>
        )}
      </td>

      {/* Status */}

      <td className="px-6 py-5">
        <Badge variant={assignment.status === "ACTIVE" ? "success" : "neutral"}>
          {assignment.status === "ACTIVE" ? "Active" : "Inactive"}
        </Badge>
      </td>

      {/* Assigned */}

      <td
        className="
          whitespace-nowrap
          px-6 py-5
          text-[15px] leading-5
          text-(--ink-muted)
        "
      >
        {formatDate(assignment.assignedAt)}
      </td>

      {/* Action */}

      <td className="px-6 py-5 text-right">
        {assignment.status === "ACTIVE" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={!canManage || removingId === assignment._id}
            onClick={() => onUnassign(assignment)}
          >
            <UserX size={15} />

            {removingId === assignment._id ? "Removing..." : "Unassign"}
          </Button>
        ) : (
          <span className="text-xs text-(--ink-faint)">—</span>
        )}
      </td>
    </tr>
  );
}

/*
 * ===========================================================
 * Mobile Assignment Card
 * ===========================================================
 */

function AssignmentMobileCard({
  assignment,
  canManage,
  removingId,
  onUnassign,
}: {
  assignment: CoachAssignment;
  canManage: boolean;
  removingId: string | null;
  onUnassign: (assignment: CoachAssignment) => void;
}) {
  const studentName = assignment.student?.name || "Unknown student";

  const coachName = assignment.coach?.name || "Unknown coach";

  const branchName =
    assignment.branch?.name ||
    assignment.student?.branch?.name ||
    assignment.coach?.branch?.name ||
    "No branch";

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
      <div
        className="
          flex items-start
          justify-between gap-3
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <AssignmentAvatar name={studentName} />

          <div className="min-w-0">
            <p
              className="
                truncate
                text-sm font-bold
                text-(--foreground-soft)
                group-hover:text-(--accent)
              "
            >
              {studentName}
            </p>

            <p
              className="
                mt-1 text-xs
                text-(--ink-muted)
              "
            >
              Coach: {coachName}
            </p>
          </div>
        </div>

        <Badge variant={assignment.status === "ACTIVE" ? "success" : "neutral"}>
          {assignment.status === "ACTIVE" ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div
        className="
          mt-4
          grid grid-cols-2
          gap-x-4 gap-y-4
          border-t border-(--line)
          pt-4
        "
      >
        <MobileDetail label="Coach" value={coachName} />

        <MobileDetail label="Branch" value={branchName} />

        <MobileDetail
          label="Assigned"
          value={formatDate(assignment.assignedAt)}
        />

        <MobileDetail label="Note" value={assignment.note || "No note"} />
      </div>

      {assignment.status === "ACTIVE" && canManage && (
        <div
          className="
              mt-4
              border-t border-(--line)
              pt-4
            "
        >
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={removingId === assignment._id}
            onClick={() => onUnassign(assignment)}
          >
            <UserX size={15} />

            {removingId === assignment._id ? "Removing..." : "Unassign student"}
          </Button>
        </div>
      )}
    </div>
  );
}

/*
 * ===========================================================
 * Small reusable visual helpers
 * ===========================================================
 */

function AssignmentAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="
        flex h-10 w-10
        shrink-0
        items-center
        justify-center
        rounded-full
        border border-(--line)
        bg-(--sidebar-logo-bg)
        text-xs font-black
        text-(--gold)
      "
    >
      {initials || "ST"}
    </div>
  );
}

function MobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p
        className="
          text-[9px]
          font-black
          uppercase
          tracking-[0.12em]
          text-(--ink-faint)
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          truncate
          text-sm
          font-medium
          text-(--foreground-soft)
        "
      >
        {value}
      </p>
    </div>
  );
}

function formatDate(date?: string) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

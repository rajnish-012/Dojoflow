"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  Link2,
  RefreshCw,
  Search,
  UserCheck,
  UserRound,
  UserX,
  Users,
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

import { getStudents } from "@/lib/api";

import { useCurrentUser } from "@/lib/current-user";

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
  SummaryCard,
} from "@/components/ui";

export default function CoachAssignmentsPage() {
  const user = useCurrentUser();

  const [coaches, setCoaches] =
    useState<CoachAssignmentCoach[]>(
      [],
    );

  const [students, setStudents] =
    useState<CoachAssignmentStudent[]>(
      [],
    );

  const [assignments, setAssignments] =
    useState<CoachAssignment[]>(
      [],
    );

  const [selectedCoach, setSelectedCoach] =
    useState("");

  const [selectedStudent, setSelectedStudent] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [note, setNote] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [removingId, setRemovingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const role =
    String(
      user?.role || "",
    ).toUpperCase();

  const isAllowed =
    role === "SUPER_ADMIN" ||
    role === "BRANCH_ADMIN";

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        coachData,
        studentData,
        assignmentData,
      ] = await Promise.all([
        getCoachAssignmentCoaches(),
        getStudents(),
        getCoachAssignments(),
      ]);

      setCoaches(
        coachData.coaches || [],
      );

      setStudents(
        studentData.students || [],
      );

      setAssignments(
        assignmentData.assignments || [],
      );
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
    if (isAllowed) {
      void loadData();
    } else if (user) {
      setLoading(false);
    }
  }, [
    isAllowed,
    user,
  ]);

  const assignedStudentIds =
    useMemo(
      () =>
        new Set(
          assignments.map(
            (item) =>
              item.student?._id,
          ),
        ),
      [assignments],
    );

  const availableStudents =
    useMemo(
      () =>
        students.filter(
          (student) =>
            !assignedStudentIds.has(
              student._id,
            ),
        ),
      [
        students,
        assignedStudentIds,
      ],
    );

  const filteredAssignments =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return assignments;
      }

      return assignments.filter(
        (assignment) =>
          assignment.student?.name
            ?.toLowerCase()
            .includes(query) ||
          assignment.coach?.name
            ?.toLowerCase()
            .includes(query) ||
          assignment.branch?.name
            ?.toLowerCase()
            .includes(query),
      );
    }, [
      assignments,
      search,
    ]);

  async function handleAssign() {
    setError("");
    setSuccess("");

    if (!selectedCoach) {
      setError(
        "Please select a coach.",
      );
      return;
    }

    if (!selectedStudent) {
      setError(
        "Please select a student.",
      );
      return;
    }

    try {
      setSaving(true);

      const data =
        await assignStudentToCoach({
          coach: selectedCoach,
          student: selectedStudent,
          note: note.trim(),
        });

      setAssignments(
        (current) => [
          data.assignment,
          ...current,
        ],
      );

      setSelectedStudent("");
      setNote("");

      setSuccess(
        "Student assigned to coach successfully.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to assign student.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUnassign(
    assignment: CoachAssignment,
  ) {
    const confirmed =
      window.confirm(
        `Unassign ${assignment.student?.name} from ${assignment.coach?.name}?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingId(
        assignment._id,
      );

      setError("");
      setSuccess("");

      await unassignStudentFromCoach(
        assignment._id,
      );

      setAssignments(
        (current) =>
          current.filter(
            (item) =>
              item._id !==
              assignment._id,
          ),
      );

      setSuccess(
        "Student unassigned successfully.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to unassign student.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  if (
    !isAllowed &&
    !loading
  ) {
    return (
      <div className="df-page">
        <ErrorState
          title="Access denied"
          message="Only Super Admin and Branch Admin accounts can manage coach assignments."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="df-page">
        <LoadingSpinner
          fullPage
          text="Loading coach assignments..."
        />
      </div>
    );
  }

  return (
    <div className="df-page">
      <PageHeader
        eyebrow="Staff management"
        title="Coach Assignments"
        description="Assign students to coaches and control which students each coach can access."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              void loadData()
            }
          >
            <RefreshCw
              size={17}
            />
            Refresh
          </Button>
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

      {success && (
        <div
          className="
            mb-5 rounded-xl
            border border-(--success-border)
            bg-(--success-soft)
            px-4 py-3
            text-sm font-semibold
            text-(--success)
          "
        >
          <div className="flex items-center gap-2">
            <CheckCircle2
              size={17}
            />
            {success}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Coaches"
          value={coaches.length}
          subtitle="Available coaches"
          icon={
            <UserRound
              size={20}
            />
          }
        />

        <SummaryCard
          title="Assigned Students"
          value={
            assignments.length
          }
          subtitle="Currently assigned"
          icon={
            <UserCheck
              size={20}
            />
          }
        />

        <SummaryCard
          title="Unassigned Students"
          value={
            availableStudents.length
          }
          subtitle="Ready for assignment"
          icon={
            <Users
              size={20}
            />
          }
        />
      </div>

      <div
        className="
          mt-6 grid gap-6
          xl:grid-cols-[0.75fr_1.25fr]
        "
      >
        <Card padding="lg">
          <div>
            <p
              className="
                text-[11px] font-black
                uppercase tracking-[0.18em]
                text-(--accent)
              "
            >
              New assignment
            </p>

            <h2
              className="
                mt-2 text-xl font-black
                text-(--foreground)
              "
            >
              Assign a student
            </h2>

            <p
              className="
                mt-1 text-sm
                text-(--ink-muted)
              "
            >
              Coaches can access only
              their active assignments.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="coach"
                className="
                  mb-2 block text-sm
                  font-bold text-(--foreground-soft)
                "
              >
                Coach
              </label>

              <Select
                id="coach"
                value={selectedCoach}
                onChange={(event) =>
                  setSelectedCoach(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select coach
                </option>

                {coaches.map(
                  (coach) => (
                    <option
                      key={coach._id}
                      value={coach._id}
                    >
                      {coach.name}
                      {coach.branch?.name
                        ? ` · ${coach.branch.name}`
                        : ""}
                    </option>
                  ),
                )}
              </Select>
            </div>

            <div>
              <label
                htmlFor="student"
                className="
                  mb-2 block text-sm
                  font-bold text-(--foreground-soft)
                "
              >
                Student
              </label>

              <Select
                id="student"
                value={selectedStudent}
                onChange={(event) =>
                  setSelectedStudent(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select student
                </option>

                {availableStudents.map(
                  (student) => (
                    <option
                      key={student._id}
                      value={student._id}
                    >
                      {student.name}
                      {student.branch?.name
                        ? ` · ${student.branch.name}`
                        : ""}
                    </option>
                  ),
                )}
              </Select>
            </div>

            <div>
              <label
                htmlFor="assignment-note"
                className="
                  mb-2 block text-sm
                  font-bold text-(--foreground-soft)
                "
              >
                Note (optional)
              </label>

              <Input
                id="assignment-note"
                value={note}
                onChange={(event) =>
                  setNote(
                    event.target.value,
                  )
                }
                placeholder="e.g. Evening batch"
              />
            </div>

            <Button
              variant="primary"
              className="w-full"
              disabled={saving}
              onClick={() =>
                void handleAssign()
              }
            >
              <Link2
                size={17}
              />

              {saving
                ? "Assigning..."
                : "Assign Student"}
            </Button>
          </div>
        </Card>

        <Card padding="none">
          <div
            className="
              border-b border-(--line)
              px-5 py-5 sm:px-6
            "
          >
            <div
              className="
                flex flex-col gap-4
                sm:flex-row sm:items-center
                sm:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-[11px] font-black
                    uppercase tracking-[0.18em]
                    text-(--accent)
                  "
                >
                  Current assignments
                </p>

                <h2
                  className="
                    mt-2 text-xl font-black
                    text-(--foreground)
                  "
                >
                  Coach student list
                </h2>
              </div>

              <div
                className="
                  w-full sm:max-w-xs
                "
              >
                <Input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search coach or student..."
                  leftIcon={
                    <Search
                      size={16}
                    />
                  }
                />
              </div>
            </div>
          </div>

          {filteredAssignments.length ===
          0 ? (
            <EmptyState
              icon={
                <UserX
                  size={22}
                />
              }
              title="No active assignments"
              description="Assign students to coaches to start managing coach-specific access."
            />
          ) : (
            <div
              className="
                divide-y
                divide-(--line)
              "
            >
              {filteredAssignments.map(
                (assignment) => (
                  <div
                    key={
                      assignment._id
                    }
                    className="
                      flex flex-col gap-4
                      px-5 py-4
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                      sm:px-6
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
                          flex h-10 w-10
                          shrink-0 items-center
                          justify-center
                          rounded-full
                          bg-(--accent-soft)
                          text-(--accent)
                        "
                      >
                        <UserCheck
                          size={18}
                        />
                      </div>

                      <div className="min-w-0">
                        <p
                          className="
                            truncate text-sm
                            font-bold
                            text-(--foreground)
                          "
                        >
                          {
                            assignment
                              .student
                              ?.name
                          }
                        </p>

                        <p
                          className="
                            mt-1 truncate
                            text-xs
                            text-(--ink-muted)
                          "
                        >
                          Coach:{" "}
                          {
                            assignment
                              .coach
                              ?.name
                          }
                        </p>

                        <p
                          className="
                            mt-1 truncate
                            text-[10px]
                            text-(--ink-faint)
                          "
                        >
                          {
                            assignment
                              .branch
                              ?.name
                          }

                          {assignment.note
                            ? ` · ${assignment.note}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div
                      className="
                        flex items-center gap-3
                        sm:shrink-0
                      "
                    >
                      <Badge variant="success">
                        Active
                      </Badge>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          removingId ===
                          assignment._id
                        }
                        onClick={() =>
                          void handleUnassign(
                            assignment,
                          )
                        }
                      >
                        <UserX
                          size={15}
                        />

                        {removingId ===
                        assignment._id
                          ? "Removing..."
                          : "Unassign"}
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
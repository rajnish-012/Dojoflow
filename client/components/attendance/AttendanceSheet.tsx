"use client";

import { useMemo, useState } from "react";

import {
  CalendarOff,
  ClipboardCheck,
  Search,
  UserRound,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
} from "@/components/ui";

import AttendanceRow, {
  type DailyAttendanceRow,
} from "./AttendanceRow";

type AttendanceSheetProps = {
  rows: DailyAttendanceRow[];
  loading: boolean;
  error: string;
  savingStudentId: string | null;

  onMark: (
    row: DailyAttendanceRow,
    status: "PRESENT" | "ABSENT",
  ) => void;
};

type AttendanceFilter =
  | "ALL"
  | "PRESENT"
  | "ABSENT"
  | "NOT_MARKED"
  | "HOLIDAY";

export default function AttendanceSheet({
  rows,
  loading,
  error,
  savingStudentId,
  onMark,
}: AttendanceSheetProps) {
  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<AttendanceFilter>(
      "ALL",
    );

  /* ==========================================
     FILTER ROWS
  ========================================== */

  const filteredRows = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        row.student.name
          ?.toLowerCase()
          .includes(
            normalizedSearch,
          ) ||
        row.student.phone
          ?.toLowerCase()
          .includes(
            normalizedSearch,
          ) ||
        row.student.plan?.name
          ?.toLowerCase()
          .includes(
            normalizedSearch,
          ) ||
        row.student.branch?.name
          ?.toLowerCase()
          .includes(
            normalizedSearch,
          ) ||
        row.curriculum?.title
          ?.toLowerCase()
          .includes(
            normalizedSearch,
          ) ||
        row.curriculum?.skill
          ?.toLowerCase()
          .includes(
            normalizedSearch,
          ) ||
        row.holiday?.name
          ?.toLowerCase()
          .includes(
            normalizedSearch,
          ) ||
        `day ${row.planDay}`
          .toLowerCase()
          .includes(
            normalizedSearch,
          );

      if (!matchesSearch) {
        return false;
      }

      if (filter === "ALL") {
        return true;
      }

      if (filter === "HOLIDAY") {
        return Boolean(
          row.holiday,
        );
      }

      if (filter === "PRESENT") {
        return (
          !row.holiday &&
          row.attendance?.status ===
            "PRESENT"
        );
      }

      if (filter === "ABSENT") {
        return (
          !row.holiday &&
          row.attendance?.status ===
            "ABSENT"
        );
      }

      if (filter === "NOT_MARKED") {
        return (
          !row.holiday &&
          !row.attendance
        );
      }

      return true;
    });
  }, [
    rows,
    search,
    filter,
  ]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    filter !== "ALL";

  function clearFilters() {
    setSearch("");
    setFilter("ALL");
  }

  return (
    <Card
      padding="none"
      className="mt-6 overflow-hidden"
    >
      {/* ======================================
          HEADER
      ====================================== */}

      <div
        className="
          border-b border-(--line)
          px-5 py-5
          sm:px-6
        "
      >
        <div
          className="
            flex flex-col
            gap-5
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >
          {/* TITLE */}

          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="
                  flex h-9 w-9 shrink-0
                  items-center justify-center
                  rounded-xl
                  bg-(--accent-soft)
                  text-(--accent)
                "
              >
                <ClipboardCheck
                  size={18}
                />
              </div>

              <div>
                <h2
                  className="
                    text-xl font-extrabold
                    tracking-tight
                    text-(--foreground)
                  "
                >
                  Daily attendance
                </h2>

                <p
                  className="
                    mt-0.5 text-xs
                    text-(--ink-muted)
                    sm:text-sm
                  "
                >
                  Mark attendance for active
                  students and track their
                  training progress.
                </p>
              </div>
            </div>
          </div>

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
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search students..."
              className="pl-10"
            />
          </div>
        </div>

        {/* ====================================
            FILTERS
        ==================================== */}

        <div
          className="
            mt-5
            flex flex-col
            gap-3
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div
            className="
              flex flex-wrap
              items-center gap-2
            "
          >
            <FilterButton
              active={
                filter === "ALL"
              }
              onClick={() =>
                setFilter("ALL")
              }
            >
              All
            </FilterButton>

            <FilterButton
              active={
                filter ===
                "NOT_MARKED"
              }
              onClick={() =>
                setFilter(
                  "NOT_MARKED",
                )
              }
            >
              Not marked
            </FilterButton>

            <FilterButton
              active={
                filter ===
                "PRESENT"
              }
              onClick={() =>
                setFilter("PRESENT")
              }
            >
              Present
            </FilterButton>

            <FilterButton
              active={
                filter ===
                "ABSENT"
              }
              onClick={() =>
                setFilter("ABSENT")
              }
            >
              Absent
            </FilterButton>

            <FilterButton
              active={
                filter ===
                "HOLIDAY"
              }
              onClick={() =>
                setFilter("HOLIDAY")
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <CalendarOff
                  size={13}
                />

                Holiday
              </span>
            </FilterButton>
          </div>

          <div
            className="
              flex items-center
              justify-between
              gap-3
              text-xs
              text-(--ink-muted)
              sm:justify-end
            "
          >
            <span>
              Showing{" "}
              <strong className="text-(--foreground-soft)">
                {
                  filteredRows.length
                }
              </strong>{" "}
              of{" "}
              <strong className="text-(--foreground-soft)">
                {rows.length}
              </strong>
            </span>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={
                  clearFilters
                }
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

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
          <LoadingSpinner
            size="md"
            text="Loading attendance..."
          />
        </div>
      )}

      {/* ======================================
          ERROR
      ====================================== */}

      {!loading && error && (
        <div className="p-5 sm:p-6">
          <ErrorState
            title="Unable to load attendance"
            message={error}
          />
        </div>
      )}

      {/* ======================================
          NO ACTIVE STUDENTS
      ====================================== */}

      {!loading &&
        !error &&
        rows.length === 0 && (
          <div className="p-5 sm:p-6">
            <EmptyState
              title="No active students"
              description="No active students are available for attendance."
              icon={
                <UserRound
                  size={22}
                />
              }
            />
          </div>
        )}

      {/* ======================================
          NO SEARCH RESULTS
      ====================================== */}

      {!loading &&
        !error &&
        rows.length > 0 &&
        filteredRows.length === 0 && (
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
              Try a different student name,
              phone number, plan, branch,
              holiday or attendance status.
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={
                clearFilters
              }
            >
              Clear filters
            </Button>
          </div>
        )}

      {/* ======================================
          DESKTOP TABLE
      ====================================== */}

      {!loading &&
        !error &&
        filteredRows.length > 0 && (
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
                    <TableHeading>
                      Student
                    </TableHeading>

                    <TableHeading>
                      Contact
                    </TableHeading>

                    <TableHeading>
                      Training
                    </TableHeading>

                    <TableHeading>
                      Today&apos;s step
                    </TableHeading>

                    <TableHeading>
                      Status
                    </TableHeading>

                    <TableHeading align="right">
                      Action
                    </TableHeading>
                  </tr>
                </thead>

                <tbody
                  className="
                    divide-y
                    divide-(--line)
                  "
                >
                  {filteredRows.map(
                    (row) => (
                      <AttendanceRow
                        key={
                          row.student
                            ._id
                        }
                        row={row}
                        saving={
                          savingStudentId ===
                          row.student
                            ._id
                        }
                        onMark={
                          onMark
                        }
                      />
                    ),
                  )}
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
              {filteredRows.map(
                (row) => (
                  <AttendanceMobileCard
                    key={
                      row.student
                        ._id
                    }
                    row={row}
                    saving={
                      savingStudentId ===
                      row.student
                        ._id
                    }
                    onMark={onMark}
                  />
                ),
              )}
            </div>
          </>
        )}
    </Card>
  );
}

/* ==========================================
   FILTER BUTTON
========================================== */

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex
        items-center
        justify-center
        rounded-lg
        border
        px-3 py-2
        text-xs font-bold
        transition-all
        duration-200
        ${
          active
            ? `
              border-(--accent)
              bg-(--accent-soft)
              text-(--accent)
            `
            : `
              border-(--line)
              bg-(--surface)
              text-(--ink-muted)
              hover:border-(--line-strong)
              hover:bg-(--hover-bg)
              hover:text-(--foreground-soft)
            `
        }
      `}
    >
      {children}
    </button>
  );
}

/* ==========================================
   TABLE HEADING
========================================== */

function TableHeading({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`
        px-6 py-4
        text-[10px] font-black
        uppercase
        tracking-[0.16em]
        text-(--ink-faint)
        ${
          align === "right"
            ? "text-right"
            : "text-left"
        }
      `}
    >
      {children}
    </th>
  );
}

/* ==========================================
   MOBILE CARD
========================================== */

function AttendanceMobileCard({
  row,
  saving,
  onMark,
}: {
  row: DailyAttendanceRow;
  saving: boolean;

  onMark: (
    row: DailyAttendanceRow,
    status: "PRESENT" | "ABSENT",
  ) => void;
}) {
  const status =
    row.attendance?.status;

  const isHoliday =
    Boolean(row.holiday);

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
              .map(
                (part) =>
                  part[0],
              )
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div className="min-w-0">
            <p
              className="
                truncate text-sm
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
              Age{" "}
              {row.student.age ??
                "—"}
            </p>
          </div>
        </div>

        {isHoliday && (
          <Badge variant="default">
            <span className="inline-flex items-center gap-1.5">
              <CalendarOff
                size={12}
              />

              HOLIDAY
            </span>
          </Badge>
        )}

        {!isHoliday &&
          status === "PRESENT" && (
            <Badge variant="success">
              Present
            </Badge>
          )}

        {!isHoliday &&
          status === "ABSENT" && (
            <Badge variant="danger">
              Absent
            </Badge>
          )}

        {!isHoliday && !status && (
          <Badge variant="default">
            Not marked
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
              {row.holiday?.name ||
                "Holiday"}
            </p>

            <p
              className="
                mt-1 text-xs
                leading-5
                text-(--ink-muted)
              "
            >
              {row.holiday
                ?.description ||
                "No training session on this date."}
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
        <MobileDetail
          label="Contact"
          value={
            row.student.phone ||
            "No phone"
          }
        />

        <MobileDetail
          label="Training"
          value={`Day ${row.planDay}`}
        />

        <MobileDetail
          label="Plan"
          value={
            row.student.plan
              ?.name ||
            "No plan"
          }
        />

        <MobileDetail
          label="Branch"
          value={
            row.student.branch
              ?.name ||
            "No branch"
          }
        />

        <div className="col-span-2">
          <MobileDetail
            label={
              isHoliday
                ? "Status"
                : "Today's step"
            }
            value={
              isHoliday
                ? "HOLIDAY — no attendance"
                : row.curriculum
                    ?.title ||
                  "No curriculum configured"
            }
          />
        </div>
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

        {!isHoliday && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={
                saving ||
                Boolean(
                  row.attendance,
                )
              }
              onClick={() =>
                onMark(
                  row,
                  "PRESENT",
                )
              }
              className={`
                inline-flex
                items-center gap-1.5
                rounded-lg
                px-3 py-2
                text-xs font-bold
                transition-colors
                ${
                  status ===
                  "PRESENT"
                    ? "bg-(--primary) text-(--primary-foreground)"
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
                Boolean(
                  row.attendance,
                )
              }
              onClick={() =>
                onMark(
                  row,
                  "ABSENT",
                )
              }
              className={`
                inline-flex
                items-center gap-1.5
                rounded-lg
                px-3 py-2
                text-xs font-bold
                transition-colors
                ${
                  status ===
                  "ABSENT"
                    ? "bg-(--danger) text-white"
                    : "border border-(--line) text-(--foreground-soft) hover:bg-(--hover-bg)"
                }
              `}
            >
              Absent
            </button>
          </div>
        )}

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
            <CalendarOff
              size={14}
            />

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

function MobileDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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
          mt-1 truncate
          text-sm font-medium
          text-(--foreground-soft)
        "
      >
        {value}
      </p>
    </div>
  );
}
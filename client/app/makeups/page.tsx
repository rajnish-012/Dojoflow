"use client";

import { fetchWithSession } from "@/lib/sessionFetch";
import { confirmAction, toast } from "@/lib/toast";

import { useEffect, useMemo, useState } from "react";

import {
  CalendarDays,
  CalendarOff,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import {
  Badge,
  Button,
  DataTableSection,
  DataTableToolbar,
  DataFilters,
  DataSort,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
  TablePagination,
  TableHeading,
  Textarea,
  type ActiveFilter,
} from "@/components/ui";

import {
  cancelMakeup,
  completeMakeup,
  getMakeups,
  scheduleMakeup,
  type BranchScheduleSlot,
  type Makeup,
  type MakeupStudent,
  type MakeupDateAvailability,
  type MakeupStatus,
} from "@/lib/makeupApi";
import { getBranchMonthCalendar } from "@/lib/branchScheduleApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";

type FilterStatus = "ALL" | MakeupStatus;

type Holiday = {
  _id: string;

  date: string;

  name: string;

  description?: string;

  branch?:
    | string
    | {
        _id: string;
        name: string;
      }
    | null;

  isActive?: boolean;
};

type HolidayMap = Record<string, Holiday>;

/* ======================================================
   DATE HELPERS
====================================================== */

function getLocalDate(daysFromToday = 0) {
  const date = new Date();

  date.setDate(date.getDate() + daysFromToday);

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMinimumMakeupDate(originalDate: string) {
  return originalDate > getLocalDate() ? originalDate : getLocalDate();
}

function getCalendarDate(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  /*
   * Date-only strings should never
   * be converted through UTC because
   * that can move the calendar date.
   */
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "";

  const month = parts.find((part) => part.type === "month")?.value || "";

  const day = parts.find((part) => part.type === "day")?.value || "";

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const calendarDate = getCalendarDate(value);

  if (!calendarDate) {
    return "—";
  }

  const parsedDate = new Date(`${calendarDate}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ======================================================
   TIME HELPERS
====================================================== */

function formatTime(time?: string | null) {
  if (!time) {
    return "—";
  }

  const match = /^(\d{2}):(\d{2})$/.exec(time);

  if (!match) {
    return time;
  }

  const hours = Number(match[1]);

  const minutes = Number(match[2]);

  const suffix = hours >= 12 ? "PM" : "AM";

  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatTimeRange(slot: BranchScheduleSlot) {
  return `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`;
}

/* ======================================================
   STUDENT / BRANCH HELPERS
====================================================== */

function getStudentName(makeup: Makeup) {
  if (typeof makeup.student === "object" && makeup.student !== null) {
    return makeup.student.name;
  }

  return "Unknown Student";
}

function getStudentAge(makeup: Makeup) {
  if (
    typeof makeup.student === "object" &&
    makeup.student !== null &&
    makeup.student.age
  ) {
    return makeup.student.age;
  }

  return null;
}

function getStudentPhone(makeup: Makeup) {
  if (typeof makeup.student === "object" && makeup.student !== null) {
    return makeup.student.phone || "No phone";
  }

  return "No phone";
}

function getStudentEmail(makeup: Makeup) {
  if (typeof makeup.student === "object" && makeup.student !== null) {
    return makeup.student.email || "No email";
  }

  return "No email";
}

function getBranchName(makeup: Makeup) {
  if (typeof makeup.branch === "object" && makeup.branch !== null) {
    return makeup.branch.name;
  }

  return "No branch";
}

function getBranchId(makeup: Makeup) {
  if (typeof makeup.branch === "object" && makeup.branch !== null) {
    return makeup.branch._id;
  }

  if (typeof makeup.branch === "string") {
    return makeup.branch;
  }

  return "";
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST"
  );
}

/* ======================================================
   STATUS
====================================================== */

function getStatusConfig(status: MakeupStatus) {
  const config = {
    SCHEDULED: {
      label: "Scheduled",
      variant: "warning" as const,
      icon: <Clock3 size={13} />,
    },

    COMPLETED: {
      label: "Completed",
      variant: "success" as const,
      icon: <Check size={13} />,
    },

    CANCELLED: {
      label: "Cancelled",
      variant: "danger" as const,
      icon: <X size={13} />,
    },
  };

  return config[status];
}

/* ======================================================
   AUTH
====================================================== */


/* ======================================================
   HOLIDAYS
====================================================== */

async function getHolidaysForMakeups(): Promise<Holiday[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

  const response = await fetchWithSession(`${apiUrl}/holidays`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : "Failed to fetch holidays.";

    throw new Error(message);
  }

  if (
    typeof data === "object" &&
    data !== null &&
    "holidays" in data &&
    Array.isArray(data.holidays)
  ) {
    return data.holidays as Holiday[];
  }

  return [];
}

function createHolidayMap(holidays: Holiday[]) {
  return holidays.reduce<HolidayMap>((map, holiday) => {
    if (holiday.isActive === false) {
      return map;
    }

    const date = getCalendarDate(holiday.date);

    if (!date) {
      return map;
    }

    if (!map[date]) {
      map[date] = holiday;
    }

    return map;
  }, {});
}

function getHolidayForDate(
  date: string,
  holidayMap: HolidayMap,
  branchId: string,
) {
  const holiday = holidayMap[date];

  if (!holiday) {
    return null;
  }

  /*
   * Global holiday.
   */
  if (!holiday.branch) {
    return holiday;
  }

  const holidayBranchId =
    typeof holiday.branch === "string" ? holiday.branch : holiday.branch._id;

  if (holidayBranchId && branchId && holidayBranchId === branchId) {
    return holiday;
  }

  return null;
}

function getHolidayForMakeup(makeup: Makeup, holidayMap: HolidayMap) {
  if (!makeup.makeupDate) {
    return null;
  }

  return getHolidayForDate(
    getCalendarDate(makeup.makeupDate),
    holidayMap,
    getBranchId(makeup),
  );
}

/* ======================================================
   PAGE
====================================================== */

export default function MakeupsPage() {
  const canViewMakeups = useCan(PERMISSIONS.MAKEUP_VIEW);
  const canManageMakeups = useCan(PERMISSIONS.MAKEUP_MANAGE);

  const [makeups, setMakeups] = useState<Makeup[]>([]);

  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [studentFilter, setStudentFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [sort, setSort] = useState("makeupDate-desc");

  const [actionLoading, setActionLoading] = useState("");


  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [scheduleTarget, setScheduleTarget] = useState<Makeup | null>(null);

  const [scheduleDate, setScheduleDate] = useState("");

  const [scheduleSessionSlotId, setScheduleSessionSlotId] = useState("");

  const [scheduleNotes, setScheduleNotes] = useState("");

  const [scheduleError, setScheduleError] = useState("");

  const [scheduleHoliday, setScheduleHoliday] = useState<Holiday | null>(null);

  const [dateAvailability, setDateAvailability] =
    useState<MakeupDateAvailability | null>(null);

  const [scheduleLoading, setScheduleLoading] = useState(false);

  /* ====================================================
     LOAD MAKEUPS
  ==================================================== */

  const loadMakeups = async (showRefreshLoader = false, page = 1, limit = pagination.limit) => {
    if (!canViewMakeups) {
      setMakeups([]);
      setHolidays([]);
      setHolidayMap({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [makeupResponse, holidayResponse] = await Promise.all([
        getMakeups({
          status: statusFilter === "ALL" ? undefined : statusFilter,
          student: studentFilter || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          search: search.trim() || undefined,
          page,
          limit,
          sortBy: sort.split("-")[0] as "makeupDate" | "originalDate" | "createdAt" | "updatedAt" | "status",
          sortOrder: sort.endsWith("-asc") ? "asc" : "desc",
        }),
        getHolidaysForMakeups(),
      ]);

      const loadedMakeups = makeupResponse.makeups || [];

      const loadedHolidays = holidayResponse || [];

      setMakeups(loadedMakeups);
      setPagination(makeupResponse.pagination || { page, limit, total: loadedMakeups.length, pages: 1 });

      setHolidays(loadedHolidays);

      setHolidayMap(createHolidayMap(loadedHolidays));
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error ? err.message : "Failed to load makeup classes.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMakeups(false, 1), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [canViewMakeups, fromDate, search, sort, statusFilter, studentFilter, toDate]);

  /* ====================================================
     FILTER
  ==================================================== */

  const filteredMakeups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return makeups.filter((makeup) => {
      const matchesStatus =
        statusFilter === "ALL" || makeup.status === statusFilter;

      if (!query) {
        return matchesStatus;
      }

      const studentName = getStudentName(makeup).toLowerCase();

      const phone = getStudentPhone(makeup).toLowerCase();

      const email = getStudentEmail(makeup).toLowerCase();

      const branch = getBranchName(makeup).toLowerCase();

      const curriculum = makeup.curriculumTitle?.toLowerCase().trim() || "";

      const holiday = getHolidayForMakeup(makeup, holidayMap);

      const holidayName = holiday?.name?.toLowerCase() || "";

      const matchesSearch =
        studentName.includes(query) ||
        phone.includes(query) ||
        email.includes(query) ||
        branch.includes(query) ||
        curriculum.includes(query) ||
        holidayName.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [makeups, search, statusFilter, holidayMap]);

  const filterStudents = useMemo(() => {
    const seen = new Set<string>();
    return makeups
      .map((makeup) => (typeof makeup.student === "string" ? null : makeup.student))
      .filter((student): student is MakeupStudent => Boolean(student && !seen.has(student._id) && seen.add(student._id)));
  }, [makeups]);

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    const student = filterStudents.find((item) => item._id === studentFilter);
    if (statusFilter !== "ALL") filters.push({ id: "status", label: statusFilter, onClear: () => setStatusFilter("ALL") });
    if (student) filters.push({ id: "student", label: student.name, onClear: () => setStudentFilter("") });
    if (fromDate) filters.push({ id: "from-date", label: `From ${fromDate}`, onClear: () => setFromDate("") });
    if (toDate) filters.push({ id: "to-date", label: `To ${toDate}`, onClear: () => setToDate("") });
    return filters;
  }, [filterStudents, fromDate, statusFilter, studentFilter, toDate]);

  const clearFilters = () => {
    setStatusFilter("ALL");
    setStudentFilter("");
    setFromDate("");
    setToDate("");
  };

  /* ====================================================
     SUMMARY
  ==================================================== */

  const scheduledCount = makeups.filter(
    (makeup) => makeup.status === "SCHEDULED",
  ).length;

  const completedCount = makeups.filter(
    (makeup) => makeup.status === "COMPLETED",
  ).length;

  const cancelledCount = makeups.filter(
    (makeup) => makeup.status === "CANCELLED",
  ).length;

  const overdueCount = makeups.filter((makeup) => {
    if (makeup.status !== "SCHEDULED" || !makeup.makeupDate) {
      return false;
    }

    const makeupHoliday = getHolidayForMakeup(makeup, holidayMap);

    if (makeupHoliday) {
      return false;
    }

    return getCalendarDate(makeup.makeupDate) < getLocalDate();
  }).length;

  /* ====================================================
     LOAD DATE AVAILABILITY
  ==================================================== */

  const loadDateAvailability = async (
    date: string,
    target: Makeup,
  ): Promise<MakeupDateAvailability | null> => {
    if (!date) {
      setDateAvailability(null);
      setScheduleHoliday(null);
      return null;
    }

    const branchId = getBranchId(target);

    if (!branchId) {
      setDateAvailability(null);

      setScheduleError(
        "This student is not assigned to a branch. A branch training schedule cannot be checked.",
      );

      return null;
    }

    setScheduleLoading(true);

    try {
      const [year, month] = date.split("-").map(Number);
      const calendar = await getBranchMonthCalendar(branchId, year, month);
      const calendarDay = calendar.days.find((day) => day.date === date);

      if (!calendarDay) {
        throw new Error("Could not resolve this date on the branch calendar.");
      }

      const activeSlots = calendarDay.slots.filter(
        (slot) => slot && slot.isActive !== false && slot.startTime && slot.endTime,
      );
      const holiday =
        getHolidayForDate(date, holidayMap, branchId) ||
        (calendarDay.holiday
          ? {
              ...calendarDay.holiday,
              date,
              isActive: true,
            }
          : null);
      const availability: MakeupDateAvailability = {
        date,
        dayOfWeek: calendarDay.dayOfWeek,
        dayName: calendarDay.dayName,
        configured: calendarDay.scheduleConfigured,
        isOpen:
          calendarDay.isTrainingDay && activeSlots.length > 0 && !holiday,
        isClosed: calendarDay.isClosed || activeSlots.length === 0,
        openingTime: calendarDay.openingTime,
        closingTime: calendarDay.closingTime,
        slots: activeSlots,
        holiday: holiday || undefined,
      };

      setDateAvailability(availability);

      const targetProgramId = typeof target.sessionTypeId === "object" ? target.sessionTypeId?._id : target.sessionTypeId;
      const compatibleSlots = activeSlots.filter((slot) => {
        const slotProgramId = slot.sessionTypeId || "";
        return Boolean(slot._id && slotProgramId && (!targetProgramId || String(slotProgramId) === String(targetProgramId)));
      });
      setScheduleSessionSlotId((current) => compatibleSlots.some((slot) => slot._id === current) ? current : compatibleSlots[0]?._id || "");

      setScheduleHoliday(holiday);

      /*
       * Holiday takes priority over
       * weekly availability.
       */
      if (holiday) {
        setScheduleError(
          `"${holiday.name}" is a holiday on ${formatDate(
            date,
          )}. A makeup class cannot be scheduled on a holiday.`,
        );

        return availability;
      }

      /*
       * The backend requires an active session before it
       * accepts a makeup date.
       */
      if (!availability.configured && activeSlots.length === 0) {
        setScheduleError(
          "This branch has no training schedule configured. Configure a training session before scheduling a makeup.",
        );
        return availability;
      }

      if (!availability.isOpen) {
        setScheduleError(
          `${availability.dayName} is closed for this branch. No training session is scheduled.`,
        );

        return availability;
      }

      setScheduleError("");
      return availability;
    } catch (err) {
      console.error(err);

      setDateAvailability(null);

      setScheduleError(
        err instanceof Error
          ? err.message
          : "Failed to check branch training availability.",
      );
      return null;
    } finally {
      setScheduleLoading(false);
    }
  };

  /* ====================================================
     OPEN SCHEDULE MODAL
  ==================================================== */

  const openScheduleModal = async (makeup: Makeup) => {
    if (!canManageMakeups) return;

    const existingDate = getCalendarDate(makeup.makeupDate);
    const minimumDate = getMinimumMakeupDate(
      getCalendarDate(makeup.originalDate),
    );
    const defaultDate =
      existingDate && existingDate >= minimumDate
        ? existingDate
        : getLocalDate(1) >= minimumDate
          ? getLocalDate(1)
          : minimumDate;

    setScheduleTarget(makeup);

    setScheduleDate(defaultDate);
    setScheduleSessionSlotId(makeup.sessionSlotId || "");

    setScheduleNotes(makeup.notes || "");

    setScheduleError("");

    setScheduleHoliday(null);

    setDateAvailability(null);

    setError("");

    setShowScheduleModal(true);

    await loadDateAvailability(defaultDate, makeup);
  };

  /* ====================================================
     CLOSE MODAL
  ==================================================== */

  const closeScheduleModal = () => {
    if (actionLoading || scheduleLoading) {
      return;
    }

    setShowScheduleModal(false);

    setScheduleTarget(null);

    setScheduleDate("");
    setScheduleSessionSlotId("");

    setScheduleNotes("");

    setScheduleError("");

    setScheduleHoliday(null);

    setDateAvailability(null);
  };

  /* ====================================================
     DATE CHANGE
  ==================================================== */

  const handleScheduleDateChange = async (value: string) => {
    setScheduleDate(value);

    setScheduleError("");

    setScheduleHoliday(null);

    setDateAvailability(null);
    setScheduleSessionSlotId("");

    if (!value || !scheduleTarget) {
      return;
    }

    const originalDate = getCalendarDate(scheduleTarget.originalDate);

    if (originalDate && value < originalDate) {
      setScheduleError(
        "Makeup date cannot be before the original missed date.",
      );

      return;
    }

    if (value < getLocalDate()) {
      setScheduleError("Makeup date cannot be in the past.");
      return;
    }

    await loadDateAvailability(value, scheduleTarget);
  };

  /* ====================================================
     HANDLE SCHEDULE
  ==================================================== */

  const handleSchedule = async () => {
    if (!canManageMakeups) return;

    if (!scheduleTarget) {
      return;
    }

    setScheduleError("");

    if (!scheduleDate) {
      setScheduleError("Please select a makeup date.");

      return;
    }

    const originalDate = getCalendarDate(scheduleTarget.originalDate);

    if (originalDate && scheduleDate < originalDate) {
      setScheduleError(
        "Makeup date cannot be before the original missed date.",
      );

      return;
    }

    if (scheduleDate < getLocalDate()) {
      setScheduleError("Makeup date cannot be in the past.");
      return;
    }

    const branchId = getBranchId(scheduleTarget);

    /*
     * Always perform a final
     * client-side availability check.
     */
    let verifiedAvailability = dateAvailability;
    if (
      !verifiedAvailability ||
      verifiedAvailability.date !== scheduleDate
    ) {
      verifiedAvailability = await loadDateAvailability(
        scheduleDate,
        scheduleTarget,
      );
      if (!verifiedAvailability) return;
    }

    const selectedHoliday = getHolidayForDate(
      scheduleDate,
      holidayMap,
      branchId,
    );

    if (selectedHoliday) {
      setScheduleHoliday(selectedHoliday);

      setScheduleError(
        `"${selectedHoliday.name}" is a holiday on ${formatDate(
          scheduleDate,
        )}. A makeup class cannot be scheduled on a holiday.`,
      );

      return;
    }

    if (!verifiedAvailability.isOpen) {
      setScheduleError(
        `${verifiedAvailability.dayName} has no active training session. Select another date.`,
      );

      return;
    }

    try {
      setActionLoading(scheduleTarget._id);

      setError("");


      await scheduleMakeup(scheduleTarget._id, {
        makeupDate: scheduleDate,
        sessionSlotId: scheduleSessionSlotId,
        notes: scheduleNotes.trim() || undefined,
      });

      closeScheduleModal();

      toast.success("Makeup class scheduled successfully.");

      await loadMakeups();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to schedule makeup class.";

      toast.error(message, "Unable to schedule makeup");
    } finally {
      setActionLoading("");
    }
  };

  /* ====================================================
     COMPLETE
  ==================================================== */

  const handleComplete = async (makeup: Makeup) => {
    if (!canManageMakeups) return;

    const holiday = getHolidayForMakeup(makeup, holidayMap);

    if (makeup.status === "SCHEDULED" && holiday) {
      toast.warning(`"${holiday.name}" is a holiday on ${formatDate(makeup.makeupDate)}. Reschedule this makeup before completing it.`);

      return;
    }

    const confirmed = await confirmAction({ title: "Complete makeup class?", message: `Mark ${getStudentName(makeup)}'s makeup class as completed?`, confirmLabel: "Mark complete" });

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(makeup._id);

      setError("");


      await completeMakeup(makeup._id);

      toast.success("Makeup class marked as completed successfully.");

      await loadMakeups();
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "Failed to complete makeup class.";

      toast.error(message.toLowerCase().includes("holiday") ? `${message} Please reschedule the makeup.` : message);
    } finally {
      setActionLoading("");
    }
  };

  /* ====================================================
     CANCEL
  ==================================================== */

  const handleCancel = async (makeup: Makeup) => {
    if (!canManageMakeups) return;

    const confirmed = await confirmAction({ title: "Cancel makeup class?", message: `Cancel ${getStudentName(makeup)}'s makeup class?`, confirmLabel: "Cancel makeup", destructive: true });

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(makeup._id);

      setError("");


      await cancelMakeup(makeup._id);

      toast.success("Makeup class cancelled successfully.");

      await loadMakeups();
    } catch (err) {
      console.error(err);

      toast.error(err instanceof Error ? err.message : "Failed to cancel makeup class.");
    } finally {
      setActionLoading("");
    }
  };

  /* ====================================================
     LOADING
  ==================================================== */

  if (loading) {
    return (
      <main>
        <div className="df-page">
          <LoadingSpinner fullPage size="lg" text="Loading makeup classes..." />
        </div>
      </main>
    );
  }

  if (!canViewMakeups) {
    return (
      <main>
        <div className="df-page">
          <PageHeader
            eyebrow="Authorization"
            title="Makeup Classes"
            description="Your role does not include permission to view makeup classes."
          />
        </div>
      </main>
    );
  }

  /* ====================================================
     UI
  ==================================================== */

  return (
    <main>
      <div className="df-page">
        <PageHeader
          eyebrow="Attendance management"
          title="Makeup Classes"
          description="
            Track missed classes, schedule makeup sessions
            and manage training recovery.
          "
          actions={
            <Button
              variant="outline"
              size="lg"
              onClick={() => loadMakeups(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={18}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </Button>
          }
        />

        {error && (
          <div className="mt-5">
            <ErrorState
              title="Unable to complete the request"
              message={error}
            />
          </div>
        )}


        <MakeupSummary
          total={makeups.length}
          scheduled={scheduledCount}
          completed={completedCount}
          cancelled={cancelledCount}
          overdue={overdueCount}
        />

        <DataTableSection className="mt-6" title="Missed classes" description="View and manage every makeup class in your academy." icon={<CalendarDays size={18} />} toolbar={
            <DataTableToolbar>
              <div data-toolbar-search className="relative w-full lg:w-[340px]">
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
                  placeholder="Search students..."
                  aria-label="Search makeup classes"
                  className="h-11 pl-10"
                />

                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    title="Clear search"
                    onClick={() => setSearch("")}
                    className="
                      absolute right-2.5 top-1/2
                      flex h-7 w-7
                      -translate-y-1/2
                      items-center justify-center
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

              <DataFilters activeFilters={activeFilters} onClearAll={clearFilters} responsiveToolbar>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Status
                  <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}>
                    <option value="ALL">All statuses</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  Student
                  <Select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
                    <option value="">All students</option>
                    {filterStudents.map((student) => <option key={student._id} value={student._id}>{student.name}</option>)}
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  From date
                  <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-(--foreground-soft)">
                  To date
                  <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </label>
              </DataFilters>
              <DataSort
                value={sort}
                onChange={setSort}
                options={[
                  { value: "makeupDate-desc", label: "Makeup date: newest" },
                  { value: "makeupDate-asc", label: "Makeup date: oldest" },
                  { value: "createdAt-desc", label: "Recently created" },
                  { value: "status-asc", label: "Status: A to Z" },
                ]}
              />
            </DataTableToolbar>
        }>

          {!loading && !error && (
            <>
              <div className="hidden overflow-x-auto md:block">
                <MakeupTable
                  makeups={filteredMakeups}
                  holidayMap={holidayMap}
                  actionLoading={actionLoading}
                  onSchedule={openScheduleModal}
                  onComplete={handleComplete}
                  onCancel={handleCancel}
                  canManage={canManageMakeups}
                />
              </div>

              <div className="space-y-3 p-4 md:hidden">
                <MakeupMobileList
                  makeups={filteredMakeups}
                  totalMakeups={makeups.length}
                  holidayMap={holidayMap}
                  actionLoading={actionLoading}
                  onSchedule={openScheduleModal}
                  onComplete={handleComplete}
                  onCancel={handleCancel}
                  canManage={canManageMakeups}
                />
              </div>
            </>
          )}

          {!loading && !error && filteredMakeups.length > 0 && (
            <TablePagination
              currentPage={pagination.page}
              pageSize={pagination.limit}
              totalItems={pagination.total}
              totalPages={pagination.pages}
              visibleItems={filteredMakeups.length}
              entityLabel="makeup classes"
              onPrevious={() => void loadMakeups(false, pagination.page - 1)}
              onNext={() => void loadMakeups(false, pagination.page + 1)}
              onPageSizeChange={(pageSize) => void loadMakeups(false, 1, pageSize)}
            />
          )}
        </DataTableSection>
      </div>

      {/* ==================================================
          SCHEDULE MODAL
      ================================================== */}

      <Modal
        open={showScheduleModal}
        onClose={closeScheduleModal}
        title="Schedule makeup class"
        description={
          scheduleTarget
            ? `Schedule a recovery class for ${getStudentName(scheduleTarget)}.`
            : undefined
        }
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={closeScheduleModal}
              disabled={Boolean(actionLoading) || scheduleLoading}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              loading={Boolean(actionLoading)}
              onClick={handleSchedule}
              disabled={
                Boolean(scheduleHoliday) ||
                !dateAvailability ||
                dateAvailability.date !== scheduleDate ||
                !dateAvailability.isOpen ||
                !scheduleSessionSlotId ||
                scheduleLoading
              }
            >
              <CalendarDays size={17} />
              Schedule makeup
            </Button>
          </>
        }
      >
        {scheduleTarget && (
          <div className="space-y-6">
            {/* STUDENT */}
            <div
              className="
                rounded-xl
                border border-(--line)
                bg-(--surface)
                p-4
              "
            >
              <div className="flex items-center gap-3">
                <MakeupAvatar name={getStudentName(scheduleTarget)} />

                <div className="min-w-0">
                  <p className="text-sm font-bold text-(--foreground-soft)">
                    {getStudentName(scheduleTarget)}
                  </p>

                  <p className="mt-1 text-xs text-(--ink-muted)">
                    Missed {formatDate(scheduleTarget.originalDate)} · Day{" "}
                    {scheduleTarget.planDay}
                  </p>

                  <p className="mt-1 text-xs text-(--ink-faint)">
                    {getBranchName(scheduleTarget)}
                  </p>
                </div>
              </div>
            </div>

            {/* DATE */}
            <div>
              <label
                htmlFor="makeup-date"
                className="
                  mb-2 block text-xs
                  font-bold
                  text-(--foreground-soft)
                "
              >
                Makeup date
              </label>

              <Input
                id="makeup-date"
                type="date"
                value={scheduleDate}
                min={getMinimumMakeupDate(
                  getCalendarDate(scheduleTarget.originalDate),
                )}
                onChange={(event) =>
                  handleScheduleDateChange(event.target.value)
                }
              />

              <p className="mt-2 text-xs text-(--ink-faint)">
                Select a date on which this branch has a training session.
              </p>
            </div>

            {/* AVAILABILITY */}
            {scheduleDate && (
              <ScheduleAvailabilityCard
                loading={scheduleLoading}
                availability={dateAvailability}
                holiday={scheduleHoliday}
                error={scheduleError}
              />
            )}

            {dateAvailability?.isOpen && scheduleTarget && (
              <label className="grid gap-2 text-xs font-bold text-(--foreground-soft)">
                Program session
                <Select value={scheduleSessionSlotId} onChange={(event) => setScheduleSessionSlotId(event.target.value)}>
                  <option value="">Select a session</option>
                  {(dateAvailability.slots || []).filter((slot) => {
                    const slotProgram = typeof slot.sessionTypeId === "object" ? slot.sessionTypeId?._id : slot.sessionTypeId;
                    const makeupProgram = typeof scheduleTarget.sessionTypeId === "object" ? scheduleTarget.sessionTypeId?._id : scheduleTarget.sessionTypeId;
                    return slot._id && slotProgram && (!makeupProgram || String(slotProgram) === String(makeupProgram));
                  }).map((slot) => <option key={slot._id} value={slot._id}>{slot.sessionName} ({slot.startTime}–{slot.endTime})</option>)}
                </Select>
                <span className="font-normal text-(--ink-muted)">Choose an active session for the same program as the missed class.</span>
              </label>
            )}

            {/* NOTES */}
            <div>
              <label
                htmlFor="makeup-notes"
                className="
                  mb-2 block text-xs
                  font-bold
                  text-(--foreground-soft)
                "
              >
                Notes
              </label>

              <Textarea
                id="makeup-notes"
                value={scheduleNotes}
                onChange={(event) => setScheduleNotes(event.target.value)}
                rows={4}
                placeholder="Optional notes..."
                className="
                  min-h-[110px]
                  resize-none
                "
              />
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}

/* ======================================================
   SCHEDULE AVAILABILITY CARD
====================================================== */

function ScheduleAvailabilityCard({
  loading,
  availability,
  holiday,
  error,
}: {
  loading: boolean;

  availability: MakeupDateAvailability | null;

  holiday: Holiday | null;

  error: string;
}) {
  if (loading) {
    return (
      <div
        className="
          rounded-xl
          border border-(--line)
          bg-(--surface)
          px-4 py-4
        "
      >
        <div className="flex items-center gap-3">
          <RefreshCw size={17} className="animate-spin text-(--accent)" />

          <div>
            <p className="text-sm font-bold text-(--foreground-soft)">
              Checking training availability
            </p>

            <p className="mt-1 text-xs text-(--ink-muted)">
              Checking this branch's schedule and holidays...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (holiday) {
    return (
      <div
        className="
          rounded-xl
          border border-(--danger)/20
          bg-(--danger-soft)
          px-4 py-4
        "
      >
        <div className="flex items-start gap-3">
          <CalendarOff size={18} className="mt-0.5 shrink-0 text-(--danger)" />

          <div>
            <p className="text-sm font-bold text-(--danger)">Holiday</p>

            <p className="mt-1 text-xs leading-5 text-(--danger)">
              {holiday.name}
            </p>

            {holiday.description && (
              <p className="mt-1 text-xs leading-5 text-(--ink-muted)">
                {holiday.description}
              </p>
            )}

            <p className="mt-2 text-xs font-semibold text-(--danger)">
              Select another date.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* A date override can be open even if no weekly schedule exists. */
  if (availability && !availability.configured && !availability.isOpen) {
    return (
      <div
        className="
          rounded-xl
          border border-(--line)
          bg-(--surface)
          px-4 py-4
        "
      >
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-(--accent)" />

          <div>
            <p className="text-sm font-bold text-(--foreground-soft)">
              Training schedule not configured
            </p>

            <p className="mt-1 text-xs leading-5 text-(--ink-muted)">
              This branch does not have a weekly training schedule configured
              yet, and no active session is available on this date.
            </p>

            <p className="mt-2 text-xs font-semibold text-(--accent)">
              Configure a session or choose another date.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (availability && !availability.isOpen) {
    return (
      <div
        className="
          rounded-xl
          border border-(--danger)/20
          bg-(--danger-soft)
          px-4 py-4
        "
      >
        <div className="flex items-start gap-3">
          <CalendarOff size={18} className="mt-0.5 shrink-0 text-(--danger)" />

          <div>
            <p className="text-sm font-bold text-(--danger)">Branch closed</p>

            <p className="mt-1 text-xs leading-5 text-(--danger)">
              {availability.dayName} is closed for this branch.
            </p>

            <p className="mt-1 text-xs text-(--ink-muted)">
              No training session is scheduled for this date.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (availability && availability.isOpen) {
    return (
      <div
        className="
          rounded-xl
          border border-(--success)/20
          bg-(--success-soft)
          px-4 py-4
        "
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0 text-(--success)"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-(--success)">
                  Training available
                </p>

                <p className="mt-1 text-xs text-(--ink-muted)">
                  {availability.dayName} · Branch operating hours{" "}
                  {formatTime(availability.openingTime)} –{" "}
                  {formatTime(availability.closingTime)}
                </p>
              </div>

              <Badge variant="success">Available</Badge>
            </div>

            <div className="mt-4 space-y-2">
              {availability.slots.map((slot) => (
                <div
                  key={
                    slot._id ||
                    `${slot.sessionName}-${slot.startTime}-${slot.endTime}`
                  }
                  className="
                      flex items-center
                      justify-between gap-3
                      rounded-lg
                      border border-(--success)/15
                      bg-(--card)
                      px-3 py-2.5
                    "
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Clock3 size={15} className="shrink-0 text-(--success)" />

                    <span className="truncate text-xs font-bold text-(--foreground-soft)">
                      {slot.sessionName}
                    </span>
                  </div>

                  <span className="shrink-0 text-xs font-semibold text-(--ink-muted)">
                    {formatTimeRange(slot)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="
          rounded-xl
          border border-(--danger)/20
          bg-(--danger-soft)
          px-4 py-4
        "
      >
        <p className="text-xs font-semibold leading-5 text-(--danger)">
          {error}
        </p>
      </div>
    );
  }

  return null;
}

/* ======================================================
   SUMMARY
====================================================== */

function MakeupSummary({
  total,
  scheduled,
  completed,
  cancelled,
  overdue,
}: {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  overdue: number;
}) {
  return (
    <div
      className="
        grid gap-4
        sm:grid-cols-2
        xl:grid-cols-5
      "
    >
      <SummaryCard
        title="Total Makeups"
        value={total}
        subtitle="Missed classes"
        icon={<CalendarDays size={20} />}
      />

      <SummaryCard
        title="Scheduled"
        value={scheduled}
        subtitle="Awaiting recovery"
        icon={<Clock3 size={20} />}
      />

      <SummaryCard
        title="Completed"
        value={completed}
        subtitle="Training recovered"
        icon={<CheckCircle2 size={20} />}
      />

      <SummaryCard
        title="Overdue"
        value={overdue}
        subtitle="Scheduled date passed"
        icon={<Clock3 size={20} />}
      />

      <SummaryCard
        title="Cancelled"
        value={cancelled}
        subtitle="Cancelled sessions"
        icon={<XCircle size={20} />}
      />
    </div>
  );
}

/* ======================================================
   TABLE
====================================================== */

function MakeupTable({
  makeups,
  holidayMap,
  actionLoading,
  onSchedule,
  onComplete,
  onCancel,
  canManage,
}: {
  makeups: Makeup[];
  holidayMap: HolidayMap;
  actionLoading: string;
  onSchedule: (makeup: Makeup) => void;
  onComplete: (makeup: Makeup) => void;
  onCancel: (makeup: Makeup) => void;
  canManage: boolean;
}) {
  return (
    <table className="w-full min-w-[1150px]">
      <thead
        className="
          border-b border-(--line)
          bg-(--surface)
        "
      >
        <tr>
          <TableHeading>Student</TableHeading>

          <TableHeading>Missed Class</TableHeading>

          <TableHeading>Makeup Date</TableHeading>

          <TableHeading>Plan / Branch</TableHeading>

          <TableHeading>Status</TableHeading>

          <TableHeading align="right">Action</TableHeading>
        </tr>
      </thead>

      <tbody className="divide-y divide-(--line)">
        {makeups.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-8">
              <EmptyState
                title="No makeup classes found"
                description="
                  Try changing your search or status filter.
                "
                icon={<CalendarDays size={22} />}
              />
            </td>
          </tr>
        ) : (
          makeups.map((makeup) => (
            <MakeupTableRow
              key={makeup._id}
              makeup={makeup}
              holidayMap={holidayMap}
              actionLoading={actionLoading}
              onSchedule={onSchedule}
              onComplete={onComplete}
              onCancel={onCancel}
              canManage={canManage}
            />
          ))
        )}
      </tbody>
    </table>
  );
}

/* ======================================================
   TABLE ROW
====================================================== */

function MakeupTableRow({
  makeup,
  holidayMap,
  actionLoading,
  onSchedule,
  onComplete,
  onCancel,
  canManage,
}: {
  makeup: Makeup;
  holidayMap: HolidayMap;
  actionLoading: string;
  onSchedule: (makeup: Makeup) => void;
  onComplete: (makeup: Makeup) => void;
  onCancel: (makeup: Makeup) => void;
  canManage: boolean;
}) {
  const name = getStudentName(makeup);

  const status = getStatusConfig(makeup.status);

  const isLoading = actionLoading === makeup._id;

  const holiday = getHolidayForMakeup(makeup, holidayMap);

  const isHoliday = Boolean(holiday);

  const isOverdue =
    makeup.status === "SCHEDULED" &&
    Boolean(makeup.makeupDate) &&
    !isHoliday &&
    getCalendarDate(makeup.makeupDate) < getLocalDate();

  return (
    <tr
      className={`
        group
        transition-colors
        duration-200
        hover:bg-(--surface)
        ${isHoliday ? "bg-(--danger-soft)/40" : ""}
      `}
    >
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <MakeupAvatar name={name} />

          <div className="min-w-0">
            <p
              className="
                truncate text-[15px]
                font-semibold leading-5
                text-(--foreground-soft)
                transition-colors
                group-hover:text-(--accent)
              "
            >
              {name}
            </p>

            <p
              className="
                mt-1 text-sm leading-5
                text-(--ink-muted)
              "
            >
              {getStudentAge(makeup)
                ? `Age ${getStudentAge(makeup)}`
                : getStudentPhone(makeup)}
            </p>
          </div>
        </div>
      </td>

      <td className="px-6 py-5">
        <p className="text-[15px] font-medium leading-5 text-(--foreground-soft)">
          {formatDate(makeup.originalDate)}
        </p>

        <p className="mt-1 max-w-[230px] truncate text-sm leading-5 text-(--ink-muted)">
          {makeup.curriculumTitle || "Curriculum step"}
        </p>
      </td>

      <td className="px-6 py-5">
        {isHoliday ? (
          <div>
            <div className="flex items-center gap-2">
              <CalendarOff size={15} className="text-(--danger)" />

              <p className="text-[15px] font-semibold leading-5 text-(--danger)">
                {formatDate(makeup.makeupDate)}
              </p>
            </div>

            <p className="mt-1 text-sm font-semibold leading-5 text-(--danger)">
              {holiday?.name}
            </p>

            <p className="mt-1 text-sm leading-5 text-(--ink-muted)">
              Reschedule required
            </p>
          </div>
        ) : (
          <>
            <p
              className={`
                text-[15px] font-medium leading-5
                ${isOverdue ? "text-(--danger)" : "text-(--foreground-soft)"}
              `}
            >
              {formatDate(makeup.makeupDate)}
            </p>

            {isOverdue && (
              <p className="mt-1 text-sm font-semibold leading-5 text-(--danger)">
                Overdue
              </p>
            )}
          </>
        )}
      </td>

      <td className="px-6 py-5">
        <p className="text-[15px] font-medium leading-5 text-(--foreground-soft)">
          Day {makeup.planDay}
        </p>

        <p className="mt-1 text-sm leading-5 text-(--ink-muted)">
          {getBranchName(makeup)}
        </p>
      </td>

      <td className="px-6 py-5">
        {isHoliday && makeup.status === "SCHEDULED" ? (
          <div className="space-y-2">
            <Badge variant="danger">
              <span className="mr-1 inline-flex">
                <CalendarOff size={13} />
              </span>
              Holiday
            </Badge>

            <div>
              <Badge variant="warning">Scheduled</Badge>
            </div>
          </div>
        ) : (
          <Badge variant={status.variant}>
            <span className="mr-1 inline-flex">{status.icon}</span>

            {status.label}
          </Badge>
        )}
      </td>

      <td className="px-6 py-5 text-right">
        {makeup.status === "SCHEDULED" && canManage ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant={isHoliday ? "primary" : "outline"}
              disabled={isLoading}
              onClick={() => onSchedule(makeup)}
            >
              <CalendarDays size={15} />

              {isHoliday
                ? "Reschedule"
                : makeup.makeupDate
                  ? "Reschedule"
                  : "Schedule"}
            </Button>

            {makeup.makeupDate && !isHoliday && (
              <Button
                size="sm"
                variant="primary"
                loading={isLoading}
                onClick={() => onComplete(makeup)}
              >
                <Check size={15} />
                Complete
              </Button>
            )}

            <IconButton
              variant="ghost"
              label={`Cancel makeup for ${name}`}
              disabled={isLoading}
              onClick={() => onCancel(makeup)}
            >
              <X size={16} />
            </IconButton>
          </div>
        ) : (
          <span className="text-xs text-(--ink-faint)">—</span>
        )}
      </td>
    </tr>
  );
}

/* ======================================================
   MOBILE
====================================================== */

function MakeupMobileList({
  makeups,
  totalMakeups,
  holidayMap,
  actionLoading,
  onSchedule,
  onComplete,
  onCancel,
  canManage,
}: {
  makeups: Makeup[];
  totalMakeups: number;
  holidayMap: HolidayMap;
  actionLoading: string;
  onSchedule: (makeup: Makeup) => void;
  onComplete: (makeup: Makeup) => void;
  onCancel: (makeup: Makeup) => void;
  canManage: boolean;
}) {
  if (makeups.length === 0) {
    return (
      <EmptyState
        title="No makeup classes found"
        description={
          totalMakeups === 0
            ? "No missed classes have been marked for makeup yet."
            : "Try changing your search or status filter."
        }
        icon={<CalendarDays size={22} />}
      />
    );
  }

  return (
    <>
      {makeups.map((makeup) => (
        <MakeupMobileCard
          key={makeup._id}
          makeup={makeup}
          holidayMap={holidayMap}
          actionLoading={actionLoading}
          onSchedule={onSchedule}
          onComplete={onComplete}
          onCancel={onCancel}
          canManage={canManage}
        />
      ))}
    </>
  );
}

function MakeupMobileCard({
  makeup,
  holidayMap,
  actionLoading,
  onSchedule,
  onComplete,
  onCancel,
  canManage,
}: {
  makeup: Makeup;
  holidayMap: HolidayMap;
  actionLoading: string;
  onSchedule: (makeup: Makeup) => void;
  onComplete: (makeup: Makeup) => void;
  onCancel: (makeup: Makeup) => void;
  canManage: boolean;
}) {
  const name = getStudentName(makeup);

  const status = getStatusConfig(makeup.status);

  const isLoading = actionLoading === makeup._id;

  const holiday = getHolidayForMakeup(makeup, holidayMap);

  const isHoliday = Boolean(holiday);

  return (
    <div
      className={`
        group
        block
        rounded-2xl
        border
        ${
          isHoliday
            ? "border-(--danger)/30 bg-(--danger-soft)/30"
            : "border-(--line) bg-(--surface)"
        }
        p-4
        transition-all
        duration-200
        hover:-translate-y-0.5
        hover:border-(--line-strong)
        hover:bg-(--card)
        hover:shadow-[0_8px_25px_var(--shadow-color)]
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <MakeupAvatar name={name} />

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-(--foreground-soft) group-hover:text-(--accent)">
              {name}
            </p>

            <p className="mt-1 text-xs text-(--ink-muted)">
              {getStudentPhone(makeup)}
            </p>
          </div>
        </div>

        {isHoliday && makeup.status === "SCHEDULED" ? (
          <div className="flex flex-col items-end gap-1">
            <Badge variant="danger">
              <CalendarOff size={12} />

              <span className="ml-1">Holiday</span>
            </Badge>

            <Badge variant="warning">Scheduled</Badge>
          </div>
        ) : (
          <Badge variant={status.variant}>{status.label}</Badge>
        )}
      </div>

      {isHoliday && (
        <div
          className="
            mt-4 flex items-start gap-3
            rounded-xl
            border border-(--danger)/20
            bg-(--danger-soft)
            px-3 py-3
          "
        >
          <CalendarOff size={16} className="mt-0.5 shrink-0 text-(--danger)" />

          <div>
            <p className="text-xs font-bold text-(--danger)">{holiday?.name}</p>

            <p className="mt-1 text-xs text-(--ink-muted)">
              This makeup date is now a holiday. Reschedule it before completing
              the class.
            </p>
          </div>
        </div>
      )}

      <div
        className="
          mt-4 grid
          grid-cols-2
          gap-x-4 gap-y-4
          border-t border-(--line)
          pt-4
        "
      >
        <MobileDetail label="Missed" value={formatDate(makeup.originalDate)} />

        <MobileDetail label="Plan" value={`Day ${makeup.planDay}`} />

        <MobileDetail label="Makeup" value={formatDate(makeup.makeupDate)} />

        <MobileDetail label="Branch" value={getBranchName(makeup)} />
      </div>

      <div
        className="
          mt-4
          border-t border-(--line)
          pt-4
        "
      >
        <MobileDetail
          label="Training step"
          value={makeup.curriculumTitle || "Curriculum step"}
        />
      </div>

      {makeup.status === "SCHEDULED" && canManage && (
        <div
          className="
            mt-4 flex flex-wrap
            items-center gap-2
            border-t border-(--line)
            pt-4
          "
        >
          <Button
            size="sm"
            variant={isHoliday ? "primary" : "outline"}
            disabled={isLoading}
            onClick={() => onSchedule(makeup)}
          >
            <CalendarDays size={15} />

            {isHoliday
              ? "Reschedule"
              : makeup.makeupDate
                ? "Reschedule"
                : "Schedule"}
          </Button>

          {makeup.makeupDate && !isHoliday && (
            <Button
              size="sm"
              variant="primary"
              loading={isLoading}
              onClick={() => onComplete(makeup)}
            >
              <Check size={15} />
              Complete
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            disabled={isLoading}
            onClick={() => onCancel(makeup)}
          >
            <X size={15} />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

/* ======================================================
   AVATAR
====================================================== */

function MakeupAvatar({ name }: { name: string }) {
  return (
    <div
      className="
        flex h-10 w-10
        shrink-0
        items-center justify-center
        rounded-full
        border border-(--line)
        bg-(--sidebar-logo-bg)
        text-xs font-black
        text-(--gold)
      "
    >
      {getInitials(name)}
    </div>
  );
}

/* ======================================================
   TABLE HEADING
====================================================== */

/* ======================================================
   MOBILE DETAIL
====================================================== */

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


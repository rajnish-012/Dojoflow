const mongoose = require("mongoose");

const AcademyEvent = require("../models/AcademyEvent");
const AcademyEventRegistration = require("../models/AcademyEventRegistration");
const BeltHistory = require("../models/BeltHistory");
const Branch = require("../models/Branch");
const BranchDateSchedule = require("../models/BranchDateSchedule");
const BranchSchedule = require("../models/BranchSchedule");
const Batch = require("../models/Batch");
const Session = require("../models/Session");
const CoachAvailability = require("../models/CoachAvailability");
const GradingEvent = require("../models/GradingEvent");
const Holiday = require("../models/Holiday");
const Makeup = require("../models/Makeup");
const Trial = require("../models/Trial");
const { generateSessionOccurrences } = require("./session.service");
const { findDatedSessionConflict } = require("./schedulingConflict.service");
const { formatDate, getDateRange, parseCalendarDate } = require("./branchSchedule.service");

const CALENDAR_TYPES = Object.freeze([
  "CLASS",
  "HOLIDAY",
  "MAKEUP",
  "TRIAL",
  "GRADING",
  "PROMOTION",
  "ACADEMY_EVENT",
  "COACH_LEAVE",
  "ANNOUNCEMENT",
]);

const SOURCE_PERMISSIONS = Object.freeze({
  CLASS: ["branch_schedule.view", "attendance.view"],
  HOLIDAY: ["holiday.view"],
  MAKEUP: ["makeup.view"],
  TRIAL: ["inquiry.view"],
  GRADING: ["grading.view"],
  PROMOTION: ["promotion.view"],
  ACADEMY_EVENT: ["event.view"],
  COACH_LEAVE: ["coach_assignment.view"],
});

const id = (value) => String(value?._id || value?.id || value || "");
const dayKey = (value) => formatDate(value) || "";
const dateOnly = (value) => {
  const parsed = parseCalendarDate(value);
  return parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) : null;
};
const toClockMinutes = (value) => {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const compareIds = (first, second) => id(first) === id(second);
const isAllScope = (user) => String(user?.role || "").toUpperCase() === "SUPER_ADMIN" || user?.dataScope === "ALL";
const hasPermission = (user, permission) => isAllScope(user) || (user?.permissions || []).includes(permission);

function addDays(value, amount) {
  const date = dateOnly(value);
  if (!date) return null;
  date.setDate(date.getDate() + amount);
  return date;
}

function dateRange(start, end) {
  const first = dateOnly(start);
  const last = dateOnly(end);
  if (!first || !last || first > last) return [];
  const result = [];
  for (let current = first; current <= last; current = addDays(current, 1)) {
    result.push(new Date(current));
  }
  return result;
}

function inclusiveBounds(start, end) {
  const first = getDateRange(start)?.start;
  const last = getDateRange(end)?.end;
  return first && last ? { start: first, end: last } : null;
}

function serializeBranch(branch) {
  if (!branch) return null;
  return { id: id(branch), name: branch.name || "Branch" };
}

function serializeProgram(program) {
  if (!program) return null;
  return { id: id(program), name: program.name || "Program" };
}

function serializeCoach(coach) {
  if (!coach) return null;
  return { id: id(coach), name: coach.name || "Coach" };
}

function event({
  id: eventId,
  type,
  source,
  sourceId,
  title,
  description = "",
  startDate,
  endDate = startDate,
  startTime = "",
  endTime = "",
  branch = null,
  program = null,
  coach = null,
  status = "SCHEDULED",
  capacity = null,
  location = "",
  metadata = {},
  actionUrl = "",
}) {
  const normalizedStart = dayKey(startDate);
  let normalizedEnd = dayKey(endDate || startDate);
  if (normalizedStart === normalizedEnd && startTime && endTime && endTime <= startTime) {
    normalizedEnd = dayKey(addDays(startDate, 1));
  }
  return {
    id: eventId,
    type,
    source,
    sourceId: String(sourceId),
    title,
    description,
    start: { date: normalizedStart, time: startTime || "" },
    end: { date: normalizedEnd, time: endTime || "" },
    branch: serializeBranch(branch),
    program: serializeProgram(program),
    coach: serializeCoach(coach),
    status,
    capacity,
    location,
    metadata,
    actionUrl,
  };
}

function requestedTypes(value) {
  if (!value) return null;
  const types = String(value)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => CALENDAR_TYPES.includes(item));
  return types.length ? new Set(types) : null;
}

function canReadType(user, type, studentMode = false) {
  if (studentMode) return ["CLASS", "HOLIDAY", "MAKEUP", "GRADING", "PROMOTION", "ACADEMY_EVENT"].includes(type);
  const permissions = SOURCE_PERMISSIONS[type];
  return !permissions || permissions.some((permission) => hasPermission(user, permission));
}

async function resolveBranches(user, branchId) {
  if (branchId && !mongoose.isValidObjectId(branchId)) throw new Error("Invalid branch ID.");
  if (!isAllScope(user)) {
    if (!user?.branch) throw new Error("No branch is assigned to this account.");
    if (branchId && !compareIds(branchId, user.branch)) throw new Error("You do not have access to this branch.");
    const branch = await Branch.findById(user.branch).select("_id name").lean();
    return branch ? [branch] : [];
  }
  const filter = branchId ? { _id: branchId } : {};
  return Branch.find(filter).select("_id name").sort({ name: 1 }).lean();
}

function getHolidayMap(holidays) {
  const map = new Map();
  for (const holiday of holidays) {
    const key = `${id(holiday.branch) || "global"}:${dayKey(holiday.date)}`;
    map.set(key, holiday);
  }
  return map;
}

function findHoliday(holidayMap, branchId, date) {
  return holidayMap.get(`${branchId}:${date}`) || holidayMap.get(`global:${date}`) || null;
}

function collectClassEvents({ branches, schedules, overrides, holidayMap, start, end }) {
  const scheduleByBranch = new Map(schedules.map((schedule) => [id(schedule.branch), schedule]));
  const overridesByBranchDate = new Map(overrides.map((override) => [`${id(override.branch)}:${override.date}`, override]));
  const classes = [];
  for (const branch of branches) {
    const branchId = id(branch);
    const schedule = scheduleByBranch.get(branchId);
    for (const date of dateRange(start, end)) {
      const dateValue = dayKey(date);
      if (findHoliday(holidayMap, branchId, dateValue)) continue;
      const override = overridesByBranchDate.get(`${branchId}:${dateValue}`);
      if (override?.isClosed) continue;
      const weeklyDay = schedule?.weeklySchedule?.find((item) => Number(item.dayOfWeek) === date.getDay());
      if (!override && weeklyDay?.isClosed) continue;
      const slots = override
        ? override.slots || []
        : weeklyDay?.slots || [];
      for (const slot of slots.filter((item) => item?.isActive !== false && item.startTime && item.endTime && !item.batchId)) {
        const slotId = id(slot._id);
        classes.push(event({
          id: `class:${branchId}:${dateValue}:${slotId}`,
          type: "CLASS",
          source: "branch_schedule",
          sourceId: schedule?._id || override?._id || slotId,
          title: slot.sessionName || "Training class",
          description: "Scheduled branch training session.",
          startDate: date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          branch,
          program: slot.sessionTypeId,
          coach: slot.coach,
          location: slot.roomId?.name || slot.room || "",
          capacity: Number.isFinite(slot.capacity) ? slot.capacity : null,
          metadata: {
            slotId,
            scheduleId: id(schedule?._id),
            dateOverrideId: id(override?._id),
            trainingDate: dateValue,
          },
          actionUrl: "/branch-schedules",
        }));
      }
    }
  }
  return classes;
}

async function loadBatchCalendarItems({ branches, schedules, overrides, holidays, start, end }) {
  const branchIds = branches.map((branch) => branch._id);
  const [batches, sessions] = await Promise.all([
    Batch.find({ branch: { $in: branchIds }, status: "ACTIVE" }).populate({ path: "plan", select: "isActive programs", populate: { path: "programs.program", select: "name" } }).populate("coach", "name").populate("roomId", "name").lean(),
    Session.find({ branch: { $in: branchIds }, date: { $gte: dayKey(start), $lte: dayKey(end) } }).populate("branch", "name").populate("program", "name").populate("coach", "name").populate("roomId", "name").populate("curriculum", "name version modules").populate("batch", "name code").lean(),
  ]);
  const byOccurrence = new Map(sessions.map((session) => [`${id(session.batch)}:${session.date}:${id(session.scheduleSlotId)}`, session]));
  const recurring = generateSessionOccurrences({ branches, schedules, overrides, holidays, batches: batches.filter((batch) => batch.plan?.isActive !== false), start, end });
  const today = formatDate(new Date());
  const virtual = [];
  const acceptedByDate = new Map();
  const sessionsByDate = new Map();
  for (const session of sessions) if (["SCHEDULED", "COMPLETED"].includes(session.status)) {
    const rows = sessionsByDate.get(session.date) || []; rows.push(session); sessionsByDate.set(session.date, rows);
  }
  for (const occurrence of recurring) {
    if (occurrence.date < today) continue;
    const batchId = id(occurrence.batch._id);
    const persisted = byOccurrence.get(`${batchId}:${occurrence.date}:${id(occurrence.slot._id)}`);
    if (persisted && !(persisted.status === "CANCELLED" && ["SCHEDULE_CHANGE", "SCHEDULE_OVERRIDE", "BATCH_INACTIVE", "BATCH_DATE_BOUNDARY", "HOLIDAY"].includes(persisted.cancellationSource))) continue;
    const roomId = occurrence.slot.roomId || occurrence.batch.roomId;
    const coach = occurrence.slot.coach || occurrence.batch.coach;
    const candidate = { branch: occurrence.branch._id, batch: occurrence.batch._id, roomId, coach, startTime: occurrence.slot.startTime, endTime: occurrence.slot.endTime, date: occurrence.date };
    const dateAccepted = acceptedByDate.get(occurrence.date) || [];
    if (findDatedSessionConflict(candidate, [...(sessionsByDate.get(occurrence.date) || []), ...dateAccepted])) continue;
    dateAccepted.push(candidate); acceptedByDate.set(occurrence.date, dateAccepted);
    virtual.push(occurrence);
  }
  return { sessions, virtual };
}

function eventMatchesFilters(item, filters = {}) {
  const types = requestedTypes(filters.types);
  if (types && !types.has(item.type)) return false;
  if (filters.program && id(item.program) !== String(filters.program)) return false;
  if (filters.coach && id(item.coach) !== String(filters.coach)) return false;
  return true;
}

function sortEvents(events) {
  return events.sort((first, second) => {
    const firstDate = `${first.start.date}T${first.start.time || "00:00"}`;
    const secondDate = `${second.start.date}T${second.start.time || "00:00"}`;
    return firstDate.localeCompare(secondDate) || first.title.localeCompare(second.title);
  });
}

async function loadCalendarEvents({ user, start, end, filters = {}, student = null }) {
  const bounds = inclusiveBounds(start, end);
  if (!bounds) throw new Error("Calendar dates must use YYYY-MM-DD and form a valid range.");
  const spanDays = dateRange(start, end).length;
  if (spanDays > 93) throw new Error("Calendar queries are limited to 93 days.");

  const branches = await resolveBranches(user, filters.branch || student?.branch);
  const branchIds = branches.map((branch) => branch._id);
  if (!branches.length) return { branches: [], events: [], conflicts: [] };
  const branchFilter = { $in: branchIds };
  const visible = (type) => canReadType(user, type, Boolean(student));
  const loads = await Promise.all([
    visible("CLASS") ? BranchSchedule.find({ branch: branchFilter }).populate("weeklySchedule.slots.sessionTypeId", "name").populate("weeklySchedule.slots.coach", "name").populate("weeklySchedule.slots.roomId", "name").lean() : [],
    visible("CLASS") ? BranchDateSchedule.find({ branch: branchFilter, date: { $gte: dayKey(start), $lte: dayKey(end) } }).populate("slots.sessionTypeId", "name").populate("slots.coach", "name").populate("slots.roomId", "name").lean() : [],
    visible("HOLIDAY") ? Holiday.find({ isActive: true, date: { $gte: bounds.start, $lte: bounds.end }, $or: [{ branch: null }, { branch: branchFilter }] }).populate("branch", "name").lean() : [],
    visible("MAKEUP") ? Makeup.find({ branch: branchFilter, makeupDate: { $gte: bounds.start, $lte: bounds.end } }).populate("branch", "name").populate("student", "name").populate("sessionTypeId", "name").lean() : [],
    visible("TRIAL") ? Trial.find({ branch: branchFilter, trialDate: { $gte: bounds.start, $lte: bounds.end } }).populate("branch", "name").populate("program", "name").populate("coach", "name").populate("lead", "fullName").lean() : [],
    visible("GRADING") ? GradingEvent.find({ branch: branchFilter, date: { $gte: bounds.start, $lte: bounds.end } }).populate("branch", "name").populate("program", "name").populate("examiner", "name").lean() : [],
    visible("PROMOTION") ? BeltHistory.find({ branch: branchFilter, promotedAt: { $gte: bounds.start, $lte: bounds.end } }).populate("branch", "name").populate("student", "name").populate("sessionTypeId", "name").lean() : [],
    visible("COACH_LEAVE") ? CoachAvailability.find({ branch: branchFilter }).populate("branch", "name").populate("coach", "name").lean() : [],
    visible("ACADEMY_EVENT") ? AcademyEvent.find({ branch: branchFilter, startDate: { $lte: bounds.end }, endDate: { $gte: bounds.start } }).populate("branch", "name").populate("program", "name").populate("coach", "name").lean() : [],
  ]);
  const [schedules, overrides, holidays, makeups, trials, gradings, promotions, availability, academyEvents] = loads;
  const batchCalendarItems = visible("CLASS") ? await loadBatchCalendarItems({ branches, schedules, overrides, holidays, start, end }) : { sessions: [], virtual: [] };
  const holidayMap = getHolidayMap(holidays);
  const events = [];
  const isStudent = Boolean(student);
  const studentId = id(student?._id);
  const programIds = new Set((student?.planEnrollments || []).filter((enrollment) => enrollment.status === "ACTIVE").flatMap((enrollment) => (enrollment.programs || []).map((item) => id(item.program))).filter(Boolean));
  const batchIds = new Set((student?.planEnrollments || []).filter((enrollment) => enrollment.status === "ACTIVE").map((enrollment) => id(enrollment.batch)).filter(Boolean));

  if (visible("CLASS")) {
    const classes = collectClassEvents({ branches, schedules, overrides, holidayMap, start, end });
    const persistedClasses = batchCalendarItems.sessions
      // A future Session suppressed by a Holiday is operational history for
      // reconciliation, not a second visible class beside the Holiday event.
      // Keep past records visible so calendar history remains intact.
      .filter((session) => !(session.status === "CANCELLED" && session.cancellationSource === "HOLIDAY" && session.date >= dayKey(new Date())))
      .map((session) => event({
      id: `session:${id(session._id)}`,
      type: "CLASS",
      source: "session",
      sourceId: session._id,
      title: session.sessionName || session.batch?.name || "Training class",
      description: `${session.batch?.name || "Batch"} · ${session.program?.name || "Program"}`,
      location: session.roomId?.name || session.room || "",
      startDate: dateOnly(session.date),
      startTime: session.startTime,
      endTime: session.endTime,
      branch: session.branch,
      program: session.program,
      coach: session.coach,
      status: session.status,
      capacity: session.capacity,
      metadata: { batchId: id(session.batch), batchName: session.batch?.name || "", sessionId: id(session._id), slotId: id(session.scheduleSlotId), trainingDate: session.date, closureReason: session.closureReason || "", curriculumName: session.curriculum?.name || "", curriculumVersion: session.curriculum?.version || null, plannedContent: (session.curriculum?.modules || []).flatMap((module) => (module.steps || []).filter((step) => (session.plannedStepIds || []).includes(id(step._id))).map((step) => step.title)).filter(Boolean).join(", ") },
      actionUrl: "/attendance",
      }));
    const virtualBatchClasses = batchCalendarItems.virtual.map(({ branch, batch, slot, date }) => event({
      id: `occurrence:${id(batch._id)}:${date}:${id(slot._id)}`,
      type: "CLASS", source: "batch_occurrence", sourceId: `${id(batch._id)}:${date}:${id(slot._id)}`,
      title: slot.sessionName || batch.name || "Training class", description: `${batch.name || "Batch"} · ${slot.sessionTypeId?.name || "Program"}`,
      startDate: date, startTime: slot.startTime, endTime: slot.endTime, branch, program: slot.sessionTypeId, coach: slot.coach || batch.coach,
      status: "SCHEDULED", capacity: batch.capacity, location: slot.roomId?.name || slot.room || batch.roomId?.name || batch.room || "",
      metadata: { batchId: id(batch._id), batchName: batch.name || "", slotId: id(slot._id), trainingDate: date, virtual: true },
      actionUrl: `/branches/${id(branch)}/schedule?batch=${id(batch._id)}`,
    }));
    const legacyVisible = isStudent && batchIds.size ? classes.filter((item) => programIds.has(id(item.program))) : classes;
    const persistedVisible = isStudent && batchIds.size ? persistedClasses.filter((item) => batchIds.has(id(item.metadata.batchId))) : persistedClasses;
    const virtualVisible = isStudent && batchIds.size ? virtualBatchClasses.filter((item) => batchIds.has(id(item.metadata.batchId))) : virtualBatchClasses;
    events.push(...legacyVisible, ...persistedVisible, ...virtualVisible);
  }
  if (visible("HOLIDAY")) {
    events.push(...holidays.map((holiday) => event({
      id: `holiday:${id(holiday._id)}`,
      type: "HOLIDAY",
      source: "holiday",
      sourceId: holiday._id,
      title: holiday.name,
      description: holiday.description || "Academy holiday.",
      startDate: holiday.date,
      branch: holiday.branch,
      status: holiday.isActive ? "ACTIVE" : "INACTIVE",
      metadata: { scope: holiday.branch ? "BRANCH" : "ALL_BRANCHES" },
      actionUrl: "/holidays",
    })));
  }
  if (visible("MAKEUP")) {
    events.push(...makeups.filter((makeup) => !isStudent || compareIds(makeup.student, studentId)).map((makeup) => event({
      id: `makeup:${id(makeup._id)}`,
      type: "MAKEUP",
      source: "makeup",
      sourceId: makeup._id,
      title: `Makeup: ${makeup.student?.name || "Student"}`,
      description: makeup.notes || `Recovery for ${dayKey(makeup.originalDate)}.`,
      startDate: makeup.makeupDate,
      branch: makeup.branch,
      program: makeup.sessionTypeId,
      status: makeup.status,
      metadata: { studentName: makeup.student?.name || "", originalDate: dayKey(makeup.originalDate), planDay: makeup.planDay },
      actionUrl: "/makeups",
    })));
  }
  if (visible("TRIAL")) {
    events.push(...trials.map((trial) => event({
      id: `trial:${id(trial._id)}`,
      type: "TRIAL",
      source: "trial",
      sourceId: trial._id,
      title: `Trial: ${trial.lead?.fullName || "Prospect"}`,
      description: trial.notes || "Scheduled trial class.",
      startDate: trial.trialDate,
      startTime: trial.startTime,
      endTime: trial.endTime || "",
      branch: trial.branch,
      program: trial.program,
      coach: trial.coach,
      status: trial.status,
      metadata: { prospectName: trial.lead?.fullName || "", attendance: trial.attendance || null },
      actionUrl: "/crm",
    })));
  }
  if (visible("GRADING")) {
    events.push(...gradings.filter((grading) => !isStudent || grading.students.some((participant) => compareIds(participant.student, studentId))).map((grading) => event({
      id: `grading:${id(grading._id)}`,
      type: "GRADING",
      source: "grading",
      sourceId: grading._id,
      title: `${grading.program?.name || "Program"} grading`,
      description: grading.notes || "Belt grading event.",
      startDate: grading.date,
      branch: grading.branch,
      program: grading.program,
      coach: grading.examiner,
      status: grading.status,
      capacity: grading.students.length,
      metadata: { eligibleStudents: grading.students.length, examiner: grading.examiner?.name || "" },
      actionUrl: isStudent ? "/student-dashboard" : `/grading/${id(grading._id)}`,
    })));
  }
  if (visible("PROMOTION")) {
    events.push(...promotions.filter((promotion) => !isStudent || compareIds(promotion.student, studentId)).map((promotion) => event({
      id: `promotion:${id(promotion._id)}`,
      type: "PROMOTION",
      source: "promotion",
      sourceId: promotion._id,
      title: `Promotion: ${promotion.student?.name || "Student"}`,
      description: `${promotion.fromBelt || "Previous belt"} to ${promotion.toBelt}.`,
      startDate: promotion.promotedAt,
      branch: promotion.branch,
      program: promotion.sessionTypeId,
      status: "COMPLETED",
      metadata: { studentName: promotion.student?.name || "", fromBelt: promotion.fromBelt || "", toBelt: promotion.toBelt, gradingEventId: id(promotion.gradingEvent) || null },
      actionUrl: isStudent ? "/student-dashboard" : "/promotions",
    })));
  }
  if (visible("COACH_LEAVE")) {
    for (const record of availability) {
      if (String(user?.role || "").toUpperCase() === "COACH" && !compareIds(record.coach, user._id)) continue;
      for (const leave of record.leave || []) {
        const leaveStart = dayKey(leave.startDate);
        const leaveEnd = dayKey(leave.endDate);
        if (leaveEnd < dayKey(start) || leaveStart > dayKey(end)) continue;
        events.push(event({
          id: `coach-leave:${id(record._id)}:${id(leave._id)}`,
          type: "COACH_LEAVE",
          source: "coach_availability",
          sourceId: record._id,
          title: `${record.coach?.name || "Coach"} unavailable`,
          description: leave.reason || "Coach leave.",
          startDate: leave.startDate,
          endDate: leave.endDate,
          branch: record.branch,
          coach: record.coach,
          status: "UNAVAILABLE",
          metadata: { reason: leave.reason || "", kind: "LEAVE" },
          actionUrl: `/coach-assignments/${id(record.coach)}`,
        }));
      }
      for (const slot of record.unavailableSlots || []) {
        const applicableDates = slot.date
          ? [dateOnly(slot.date)]
          : dateRange(start, end).filter((date) => Number(slot.dayOfWeek) === date.getDay());
        for (const slotDate of applicableDates) {
          if (!slotDate) continue;
          events.push(event({
            id: `coach-unavailable:${id(record._id)}:${id(slot._id)}:${dayKey(slotDate)}`,
            type: "COACH_LEAVE",
            source: "coach_availability",
            sourceId: record._id,
            title: `${record.coach?.name || "Coach"} unavailable`,
            description: slot.reason || "Coach unavailable.",
            startDate: slotDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            branch: record.branch,
            coach: record.coach,
            status: "UNAVAILABLE",
            metadata: { reason: slot.reason || "", kind: "UNAVAILABLE_SLOT" },
            actionUrl: `/coach-assignments/${id(record.coach)}`,
          }));
        }
      }
    }
  }
  if (visible("ACADEMY_EVENT")) {
    const eventIds = academyEvents.map((item) => item._id);
    const registrationRows = eventIds.length
      ? await AcademyEventRegistration.aggregate([
        { $match: { event: { $in: eventIds }, status: { $in: ["REGISTERED", "ATTENDED"] } } },
        { $group: { _id: "$event", count: { $sum: 1 } } },
      ])
      : [];
    const registrationsByEvent = new Map(registrationRows.map((row) => [id(row._id), row.count]));
    const registeredIds = isStudent && eventIds.length
      ? new Set((await AcademyEventRegistration.find({ event: { $in: eventIds }, student: student._id, status: { $ne: "CANCELLED" } }).select("event").lean()).map((registration) => id(registration.event)))
      : null;
    events.push(...academyEvents.filter((academyEvent) => !isStudent || !academyEvent.registrationRequired || registeredIds?.has(id(academyEvent._id))).map((academyEvent) => {
      const registered = registrationsByEvent.get(id(academyEvent._id)) || 0;
      return event({
        id: `academy-event:${id(academyEvent._id)}`,
        type: "ACADEMY_EVENT",
        source: "academy_event",
        sourceId: academyEvent._id,
        title: academyEvent.name,
        description: academyEvent.description || "Academy event.",
        startDate: academyEvent.startDate,
        endDate: academyEvent.endDate,
        startTime: academyEvent.startTime,
        endTime: academyEvent.endTime,
        branch: academyEvent.branch,
        program: academyEvent.program,
        coach: academyEvent.coach,
        status: academyEvent.status,
        capacity: academyEvent.capacity,
        metadata: {
          category: academyEvent.category,
          location: academyEvent.location || "",
          registrationRequired: academyEvent.registrationRequired,
          registrationDeadline: academyEvent.registrationDeadline ? dayKey(academyEvent.registrationDeadline) : null,
          registered,
          available: academyEvent.capacity === null ? null : Math.max(academyEvent.capacity - registered, 0),
        },
        actionUrl: isStudent ? "/student-dashboard" : "/calendar",
      });
    }));
  }
  return { branches: branches.map(serializeBranch), events: sortEvents(events.filter((item) => eventMatchesFilters(item, filters))), conflicts: [] };
}

function eventIntervals(item) {
  const start = dateOnly(item.startDate || item.start?.date);
  let end = dateOnly(item.endDate || item.end?.date || item.startDate || item.start?.date);
  const startTime = item.startTime || item.start?.time || "00:00";
  const endTime = item.endTime || item.end?.time || "23:59";
  const startMinute = toClockMinutes(startTime) ?? 0;
  const endMinute = toClockMinutes(endTime) ?? 1439;
  if (!start || !end) return [];
  if (end < start) end = start;
  const intervals = [];
  for (const date of dateRange(start, end)) {
    const key = dayKey(date);
    const isFirst = key === dayKey(start);
    const isLast = key === dayKey(end);
    let from = isFirst ? startMinute : 0;
    let to = isLast ? endMinute : 1440;
    if (dayKey(start) === dayKey(end) && endMinute <= startMinute) {
      intervals.push({ date: key, from: startMinute, to: 1440 });
      const next = addDays(start, 1);
      intervals.push({ date: dayKey(next), from: 0, to: endMinute });
      break;
    }
    if (to > from) intervals.push({ date: key, from, to });
  }
  return intervals;
}

function eventsOverlap(first, second) {
  const firstIntervals = eventIntervals(first);
  const secondIntervals = eventIntervals(second);
  return firstIntervals.some((left) => secondIntervals.some((right) => left.date === right.date && left.from < right.to && left.to > right.from));
}

async function detectAcademyEventConflicts({ draft, excludeId = null }) {
  const bounds = inclusiveBounds(draft.startDate, draft.endDate);
  if (!bounds || !draft.branch) return [];
  const calendar = await loadCalendarEvents({
    user: { role: "SUPER_ADMIN", dataScope: "ALL", permissions: [] },
    start: dayKey(draft.startDate),
    end: dayKey(draft.endDate),
    filters: { branch: id(draft.branch) },
  });
  const draftEvent = { startDate: draft.startDate, endDate: draft.endDate, startTime: draft.startTime, endTime: draft.endTime };
  const conflicts = [];
  const seen = new Set();
  for (const current of calendar.events) {
    if (current.source === "academy_event" && compareIds(current.sourceId, excludeId)) continue;
    const currentInterval = { startDate: current.start.date, endDate: current.end.date, startTime: current.start.time, endTime: current.end.time };
    if (!eventsOverlap(draftEvent, currentInterval)) continue;
    const key = `${current.source}:${current.sourceId}`;
    if (draft.coach && current.coach && compareIds(draft.coach, current.coach) && !seen.has(`coach:${key}`)) {
      conflicts.push({ severity: "BLOCKING", type: "COACH", message: `${current.coach.name || "This coach"} is already assigned to ${current.title}.`, source: current.source, sourceId: current.sourceId });
      seen.add(`coach:${key}`);
    }
    if (draft.location && current.source === "academy_event" && String(current.metadata?.location || "").trim().toLowerCase() === String(draft.location).trim().toLowerCase() && !seen.has(`room:${key}`)) {
      conflicts.push({ severity: "BLOCKING", type: "LOCATION", message: `${draft.location} is already used by ${current.title}.`, source: current.source, sourceId: current.sourceId });
      seen.add(`room:${key}`);
    }
    if (current.source === "academy_event" && !seen.has(`branch:${key}`)) {
      conflicts.push({ severity: "WARNING", type: "BRANCH", message: `${current.title} is also scheduled at this branch. Confirm that both events can run together.`, source: current.source, sourceId: current.sourceId });
      seen.add(`branch:${key}`);
    }
  }
  if (excludeId && Number.isFinite(draft.capacity)) {
    const registrations = await AcademyEventRegistration.countDocuments({ event: excludeId, status: { $in: ["REGISTERED", "ATTENDED"] } });
    if (registrations > draft.capacity) conflicts.push({ severity: "BLOCKING", type: "CAPACITY", message: `Capacity cannot be lower than the ${registrations} active registrations.`, source: "academy_event", sourceId: String(excludeId) });
  }
  return conflicts;
}

module.exports = {
  CALENDAR_TYPES,
  SOURCE_PERMISSIONS,
  dayKey,
  dateOnly,
  eventIntervals,
  eventsOverlap,
  hasPermission,
  loadCalendarEvents,
  detectAcademyEventConflicts,
};

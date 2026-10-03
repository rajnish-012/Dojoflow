const mongoose = require("mongoose");

const Makeup = require("../models/Makeup");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const {
  validateMakeupDate: validateCentralMakeupDate,
} = require("../services/branchSchedule.service");

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/* =========================================================
   BRANCH ACCESS
   ========================================================= */

function checkBranchAccess(req, branchId) {
  if (!req.user) {
    return {
      status: 401,
      message: "Authentication required",
    };
  }

  /*
   * Branch access is now determined by the database-backed
   * role dataScope, not by hardcoded role names.
   *
   * SUPER_ADMIN resolves to ALL in auth.middleware.
   */
  if (req.user.dataScope === "ALL") {
    return null;
  }

  if (!req.user.branch) {
    return {
      status: 403,
      message: "No branch is assigned to this account",
    };
  }

  if (!branchId) {
    return {
      status: 403,
      message: "Branch information is missing",
    };
  }

  if (branchId.toString() !== req.user.branch.toString()) {
    return {
      status: 403,
      message: "You do not have access to this branch",
    };
  }

  return null;
}

async function checkCoachStudentAccess(req, studentId) {
  if (req.user.role !== "COACH") return null;

  const assignment = await CoachStudentAssignment.findOne({
    coach: req.user._id,
    student: studentId,
    status: "ACTIVE",
  }).select("_id");

  return assignment
    ? null
    : {
        status: 403,
        message: "You do not have access to this student",
      };
}

/* =========================================================
   DATE HELPERS
   ========================================================= */

/*
 * Treat YYYY-MM-DD as a local calendar date.
 *
 * IMPORTANT:
 *
 * Do not use:
 *
 * new Date("2026-09-16")
 *
 * because JavaScript interprets YYYY-MM-DD as UTC.
 *
 * That can result in the previous calendar date in India.
 */

function parseCalendarDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return date;
      }

      return null;
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStartOfDay(value) {
  return parseCalendarDate(value);
}

function getEndOfDay(value) {
  const start = parseCalendarDate(value);

  if (!start) {
    return null;
  }

  const end = new Date(start);

  end.setHours(23, 59, 59, 999);

  return end;
}

function getDateRange(value) {
  const start = getStartOfDay(value);

  if (!start) {
    return {
      start: null,
      end: null,
    };
  }

  return {
    start,
    end: getEndOfDay(value),
  };
}

function formatDate(value) {
  const date = parseCalendarDate(value);

  if (!date) {
    return null;
  }

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validateDateFormat(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return Boolean(parseCalendarDate(value));
}

/* =========================================================
   CENTRAL MAKEUP DATE VALIDATION
   ========================================================= */

async function validateMakeupAvailability(
  branchId,
  makeupDate,
  originalDate,
  options,
) {
  const result = await validateCentralMakeupDate(
    branchId,
    makeupDate,
    originalDate,
    options,
  );

  const availability = result.availability || null;

  const holiday = availability?.holiday
    ? {
        _id: availability.holiday._id,
        name: availability.holiday.name,
        description: availability.holiday.description || "",
        date: availability.holiday.date
          ? formatDate(availability.holiday.date)
          : availability.date,
      }
    : null;

  return {
    allowed: result.allowed,
    reason: availability?.reason || null,
    message: result.message || null,
    holiday,
    schedule: availability
      ? {
          date: availability.date,
          dayOfWeek: availability.dayOfWeek,
          dayName: availability.dayName,
          configured: availability.scheduleConfigured,
          isOpen: availability.isTrainingDay,
          isTrainingDay: availability.isTrainingDay,
          isClosed: availability.isClosed,
          isHoliday: availability.isHoliday,
          holiday,
          slots: Array.isArray(availability.slots) ? availability.slots : [],
          openingTime: availability.openingTime || null,
          closingTime: availability.closingTime || null,
          isDateOverride: availability.isDateOverride,
          dateOverrideId: availability.dateOverrideId,
          reason: availability.reason,
        }
      : null,
  };
}

/* =========================================================
   POPULATE MAKEUP
   ========================================================= */

function populateMakeup(query) {
  return query
    .populate("student", "name age phone email currentBelt status")
    .populate("branch", "name address")
    .populate(
      "originalAttendance",
      "date planDay curriculumTitle curriculumSkill status makeupRequired makeupCompleted sessionTypeId sessionName",
    )
    .populate("sessionTypeId", "name")
    .populate("makeupAttendance")
    .populate("markedBy", "name email")
    .populate("completedBy", "name email");
}

/* =========================================================
   GET ALL MAKEUPS
   =========================================================
 *
 * GET /api/makeups
 *
 * Supported:
 *
 * ?status=SCHEDULED
 * ?student=<studentId>
 * ?fromDate=YYYY-MM-DD
 * ?toDate=YYYY-MM-DD
 */

const getMakeups = async (req, res) => {
  try {
    const { status, student, fromDate, toDate, search, page, limit, sortBy, sortOrder } = req.query;

    const filter = {};

    /*
     * Branch restriction.
     */
    if (req.user.dataScope !== "ALL") {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    if (req.user.role === "COACH") {
      const assignments = await CoachStudentAssignment.find({
        coach: req.user._id,
        status: "ACTIVE",
      }).select("student");

      const assignedIds = assignments.map((item) => item.student);
      const assignedIdSet = new Set(assignedIds.map((id) => id.toString()));

      if (student && !assignedIdSet.has(String(student))) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }

      filter.student = student || { $in: assignedIds };
    }

    /*
     * Status filter.
     */
    if (status) {
      const allowedStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED"];

      if (!allowedStatuses.includes(String(status))) {
        return res.status(400).json({
          success: false,
          message: "Status must be SCHEDULED, COMPLETED or CANCELLED",
        });
      }

      filter.status = String(status);
    }

    /*
     * Student filter.
     */
    if (student) {
      if (!mongoose.Types.ObjectId.isValid(student)) {
        return res.status(400).json({
          success: false,
          message: "Invalid student ID",
        });
      }

      filter.student = student;
    }

    /*
     * Makeup date range.
     */
    if (fromDate || toDate) {
      filter.makeupDate = {};

      if (fromDate) {
        if (!validateDateFormat(String(fromDate))) {
          return res.status(400).json({
            success: false,
            message: "fromDate must be in YYYY-MM-DD format",
          });
        }

        filter.makeupDate.$gte = getStartOfDay(String(fromDate));
      }

      if (toDate) {
        if (!validateDateFormat(String(toDate))) {
          return res.status(400).json({
            success: false,
            message: "toDate must be in YYYY-MM-DD format",
          });
        }

        filter.makeupDate.$lte = getEndOfDay(String(toDate));
      }
    }

    if (String(search || "").trim()) {
      const expression = new RegExp(
        String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      const students = await Student.find({
        $or: [{ name: expression }, { phone: expression }, { email: expression }],
      }).select("_id").lean();

      const matchingIds = students.map((item) => item._id.toString());

      if (filter.student && typeof filter.student === "object" && Array.isArray(filter.student.$in)) {
        filter.student = {
          $in: filter.student.$in.filter((id) => matchingIds.includes(id.toString())),
        };
      } else if (filter.student) {
        filter.student = matchingIds.includes(filter.student.toString())
          ? filter.student
          : { $in: [] };
      } else {
        filter.student = { $in: students.map((item) => item._id) };
      }
    }

    const shouldPaginate = page !== undefined || limit !== undefined;
    const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
    const sortField = ["makeupDate", "originalDate", "createdAt", "updatedAt", "status"].includes(sortBy)
      ? sortBy
      : "makeupDate";
    const sortDirection = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const total = await Makeup.countDocuments(filter);

    let makeupQuery = populateMakeup(Makeup.find(filter)).sort({ [sortField]: sortDirection, _id: -1 });

    if (shouldPaginate) {
      makeupQuery = makeupQuery.skip((pageNumber - 1) * pageSize).limit(pageSize);
    }

    const makeups = await makeupQuery;

    return res.status(200).json({
      success: true,
      count: makeups.length,
      makeups,
      pagination: {
        page: shouldPaginate ? pageNumber : 1,
        limit: shouldPaginate ? pageSize : total,
        total,
        pages: shouldPaginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
      },
    });
  } catch (error) {
    console.error("Get makeups error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch makeup classes",
      makeups: [],
    });
  }
};

/* =========================================================
   GET MAKEUP BY ID
   =========================================================
 *
 * GET /api/makeups/:id
 */

const getMakeupById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid makeup ID",
      });
    }

    const makeup = await populateMakeup(Makeup.findById(id));

    if (!makeup) {
      return res.status(404).json({
        success: false,
        message: "Makeup class not found",
      });
    }

    const branchAccessError = checkBranchAccess(
      req,
      makeup.branch?._id || makeup.branch,
    );

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    const coachAccessError = await checkCoachStudentAccess(
      req,
      makeup.student?._id || makeup.student,
    );

    if (coachAccessError) {
      return res.status(coachAccessError.status).json({
        success: false,
        message: coachAccessError.message,
      });
    }

    return res.status(200).json({
      success: true,
      makeup,
    });
  } catch (error) {
    console.error("Get makeup by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch makeup class",
    });
  }
};

/* =========================================================
   CREATE / SCHEDULE MAKEUP
   =========================================================
 *
 * POST /api/makeups
 *
 * Used when an existing absent attendance
 * record is manually scheduled.
 */

const createMakeup = async (req, res) => {
  try {
    const { student, originalAttendance, makeupDate, notes } = req.body;

    if (!student || !originalAttendance || !makeupDate) {
      return res.status(400).json({
        success: false,
        message: "student, originalAttendance and makeupDate are required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(student) ||
      !mongoose.Types.ObjectId.isValid(originalAttendance)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid student or attendance ID",
      });
    }

    if (!validateDateFormat(String(makeupDate))) {
      return res.status(400).json({
        success: false,
        message: "makeupDate must be in YYYY-MM-DD format",
      });
    }

    /*
     * Student.
     */
    const studentRecord = await Student.findById(student);

    if (!studentRecord) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /*
     * Branch access.
     */
    const branchAccessError = checkBranchAccess(req, studentRecord.branch);

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    const coachAccessError = await checkCoachStudentAccess(
      req,
      studentRecord._id,
    );

    if (coachAccessError) {
      return res.status(coachAccessError.status).json({
        success: false,
        message: coachAccessError.message,
      });
    }

    if (studentRecord.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Makeups can only be scheduled for active students",
      });
    }

    /* Verify the original attendance only after student access is confirmed. */
    const attendance = await Attendance.findById(originalAttendance);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Original attendance record not found",
      });
    }

    if (attendance.student.toString() !== student.toString()) {
      return res.status(400).json({
        success: false,
        message: "Attendance record does not belong to this student",
      });
    }

    if (attendance.status !== "ABSENT") {
      return res.status(400).json({
        success: false,
        message: "A makeup can only be created for an absent attendance record",
      });
    }

    /*
     * Central date + holiday + schedule validation.
     */
    const availability = await validateMakeupAvailability(
      studentRecord.branch,
      String(makeupDate),
      attendance.date,
    );

    if (!availability.allowed) {
      return res.status(409).json({
        success: false,
        message: availability.message,
        reason: availability.reason,
        holiday: availability.holiday,
        branchSchedule: availability.schedule,
      });
    }

    /*
     * Existing makeup for the
     * original absence.
     */
    const existingMakeup = await Makeup.findOne({
      originalAttendance,
      status: {
        $in: ["SCHEDULED", "COMPLETED"],
      },
    });

    if (existingMakeup) {
      return res.status(409).json({
        success: false,
        message: "A makeup already exists for this attendance record",
        makeup: await populateMakeup(Makeup.findById(existingMakeup._id)),
      });
    }

    /*
     * Prevent the same student from
     * having another makeup on the
     * selected date.
     */
    const selectedStart = getStartOfDay(String(makeupDate));

    const selectedEnd = getEndOfDay(String(makeupDate));

    const conflictingMakeup = await Makeup.findOne({
      student,
      makeupDate: {
        $gte: selectedStart,
        $lte: selectedEnd,
      },
      status: "SCHEDULED",
    });

    if (conflictingMakeup) {
      return res.status(409).json({
        success: false,
        message:
          "This student already has a scheduled makeup on the selected date",
        conflictingMakeup: conflictingMakeup._id,
      });
    }

    /*
     * Create makeup.
     */
    const makeup = await Makeup.create({
      student,
      branch: studentRecord.branch,
      originalAttendance,
      originalDate: attendance.date,
      makeupDate: selectedStart,
      status: "SCHEDULED",
      notes: notes || "",
      markedBy: req.user._id,
    });

    /*
     * Synchronize attendance.
     */
    await Attendance.findByIdAndUpdate(originalAttendance, {
      $set: {
        makeupRequired: true,
        makeupCompleted: false,
        makeup: makeup._id,
      },
    });

    const populatedMakeup = await populateMakeup(Makeup.findById(makeup._id));

    return res.status(201).json({
      success: true,
      message: "Makeup class scheduled successfully",
      makeup: populatedMakeup,
      branchSchedule: availability.schedule,
    });
  } catch (error) {
    console.error("Create makeup error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to create makeup class"
          : error.message || "Failed to create makeup class",
    });
  }
};

/* =========================================================
   SCHEDULE / RESCHEDULE MAKEUP
   =========================================================
 *
 * PATCH /api/makeups/:id/schedule
 */

const scheduleMakeup = async (req, res) => {
  try {
    const { id } = req.params;

    const { makeupDate, notes, sessionSlotId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid makeup ID",
      });
    }

    if (!makeupDate) {
      return res.status(400).json({
        success: false,
        message: "makeupDate is required",
      });
    }

    if (!validateDateFormat(String(makeupDate))) {
      return res.status(400).json({
        success: false,
        message: "makeupDate must be in YYYY-MM-DD format",
      });
    }

    const makeup = await Makeup.findById(id);

    if (!makeup) {
      return res.status(404).json({
        success: false,
        message: "Makeup class not found",
      });
    }

    const branchAccessError = checkBranchAccess(req, makeup.branch);

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    const studentRecord = await Student.findById(makeup.student).select(
      "status plan planEnrollments",
    ).populate("plan", "classesPerWeek programs");

    if (!studentRecord || studentRecord.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Makeups can only be scheduled for active students",
      });
    }

    const coachAccessError = await checkCoachStudentAccess(req, makeup.student);

    if (coachAccessError) {
      return res.status(coachAccessError.status).json({
        success: false,
        message: coachAccessError.message,
      });
    }

    if (makeup.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "A completed makeup cannot be rescheduled",
      });
    }

    if (makeup.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "A cancelled makeup cannot be scheduled",
      });
    }

    /*
     * Central date + holiday + schedule validation.
     */
    const availability = await validateMakeupAvailability(
      makeup.branch,
      String(makeupDate),
      makeup.originalDate,
    );

    if (!availability.allowed) {
      return res.status(409).json({
        success: false,
        message: availability.message,
        reason: availability.reason,
        holiday: availability.holiday,
        branchSchedule: availability.schedule,
      });
    }

    const sessionSlot = (availability.schedule?.slots || []).find((slot) =>
      String(slot._id) === String(sessionSlotId),
    );
    if (!sessionSlotId || !sessionSlot) {
      return res.status(400).json({ success: false, message: "Select an active session slot for the makeup date" });
    }
    if (makeup.sessionTypeId && String(sessionSlot.sessionTypeId) !== String(makeup.sessionTypeId)) {
      return res.status(409).json({ success: false, message: "Makeup must be booked into a session for the same program as the missed class" });
    }
    const selectedStart = getStartOfDay(String(makeupDate));
    const selectedEnd = getEndOfDay(String(makeupDate));
    const enrollment = (studentRecord.planEnrollments || []).find((item) => item.status === "ACTIVE" && new Date(item.startDate) <= selectedEnd && (!item.endDate || new Date(item.endDate) > selectedStart));
    if (studentRecord.planEnrollments?.length && !enrollment) {
      return res.status(409).json({ success: false, message: "The student has no active plan enrollment on the selected makeup date" });
    }
    const originalAttendance = await Attendance.findById(makeup.originalAttendance).select("sessionTypeId sessionSlotId enrollment plan").lean();
    const assignedProgramId = makeup.sessionTypeId || originalAttendance?.sessionTypeId || sessionSlot.sessionTypeId;
    if (String(sessionSlot.sessionTypeId) !== String(assignedProgramId)) return res.status(409).json({ success: false, message: "Makeup must be booked into a session for the same program as the missed class" });
    makeup.sessionTypeId = assignedProgramId;
    if (makeup.sessionSlotId == null && originalAttendance?.sessionSlotId) makeup.sessionSlotId = originalAttendance.sessionSlotId;
    const planEntitlement = studentRecord.plan?.programs?.find((item) => String(item.program?._id || item.program) === String(assignedProgramId));
    const enrollmentEntitlement = enrollment?.programs?.find((item) => String(item.program?._id || item.program) === String(assignedProgramId));
    if ((enrollment?.programs?.length || studentRecord.plan?.programs?.length) && !enrollmentEntitlement && !planEntitlement) {
      return res.status(409).json({ success: false, message: "The student's active plan does not include this training program" });
    }
    if (enrollment) {
      makeup.enrollment = enrollment._id;
      makeup.plan = enrollment.plan;
    }

    const weekStart = new Date(selectedStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const [weekAttendance, otherScheduledMakeups] = await Promise.all([
      Attendance.countDocuments({ student: makeup.student, date: { $gte: weekStart, $lt: weekEnd }, status: "PRESENT" }),
      Makeup.find({ _id: { $ne: makeup._id }, student: makeup.student, status: "SCHEDULED", makeupDate: { $gte: weekStart, $lt: weekEnd } }).select("sessionTypeId").lean(),
    ]);
    const sharedLimit = enrollment?.classesPerWeek ?? studentRecord.plan?.classesPerWeek;
    const scheduledMakeupCount = otherScheduledMakeups.length;
    if (Number(sharedLimit) > 0 && weekAttendance + scheduledMakeupCount >= Number(sharedLimit)) {
      return res.status(409).json({ success: false, message: `The student's plan allows ${sharedLimit} sessions per week, including makeups. This makeup would exceed the weekly limit.` });
    }
    const programLimit = enrollmentEntitlement?.weeklyLimit ?? planEntitlement?.weeklyLimit;
    const programScheduledCount = otherScheduledMakeups.filter((item) => String(item.sessionTypeId) === String(assignedProgramId)).length;
    const programAttendance = await Attendance.countDocuments({ student: makeup.student, sessionTypeId: assignedProgramId, date: { $gte: weekStart, $lt: weekEnd }, status: "PRESENT" });
    if (Number(programLimit) > 0 && programAttendance + programScheduledCount >= Number(programLimit)) {
      return res.status(409).json({ success: false, message: `The plan allows ${programLimit} weekly sessions for this program, including makeups. This makeup would exceed the program limit.` });
    }

    /*
     * A student may attend more than one
     * program on a date, but only one makeup
     * can occupy a specific session slot.
     */
    const conflictingMakeup = await Makeup.findOne({
      _id: {
        $ne: makeup._id,
      },
      student: makeup.student,
      sessionSlotId: sessionSlot._id,
      makeupDate: {
        $gte: selectedStart,
        $lte: selectedEnd,
      },
      status: "SCHEDULED",
    });

    if (conflictingMakeup) {
      return res.status(409).json({
        success: false,
        message:
          "This student already has a scheduled makeup in this session slot on the selected date",
        conflictingMakeup: conflictingMakeup._id,
      });
    }

    makeup.makeupDate = selectedStart;
    makeup.sessionSlotId = sessionSlot._id;

    makeup.status = "SCHEDULED";

    if (typeof notes === "string") {
      makeup.notes = notes;
    }

    await makeup.save();

    /*
     * Synchronize original attendance.
     */
    await Attendance.findByIdAndUpdate(makeup.originalAttendance, {
      $set: {
        makeupRequired: true,
        makeupCompleted: false,
        makeup: makeup._id,
      },
    });

    const populatedMakeup = await populateMakeup(Makeup.findById(makeup._id));

    return res.status(200).json({
      success: true,
      message: "Makeup class scheduled successfully",
      makeup: populatedMakeup,
      branchSchedule: availability.schedule,
    });
  } catch (error) {
    console.error("Schedule makeup error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to schedule makeup class"
          : error.message || "Failed to schedule makeup class",
    });
  }
};

/* =========================================================
   COMPLETE MAKEUP
   =========================================================
 *
 * PATCH /api/makeups/:id/complete
 */

const completeMakeup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid makeup ID",
      });
    }

    const makeup = await Makeup.findById(id);

    if (!makeup) {
      return res.status(404).json({
        success: false,
        message: "Makeup class not found",
      });
    }

    const branchAccessError = checkBranchAccess(req, makeup.branch);

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    const coachAccessError = await checkCoachStudentAccess(req, makeup.student);

    if (coachAccessError) {
      return res.status(coachAccessError.status).json({
        success: false,
        message: coachAccessError.message,
      });
    }

    if (makeup.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Makeup class is already completed",
      });
    }

    if (makeup.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "A cancelled makeup cannot be completed",
      });
    }

    if (!makeup.makeupDate) {
      return res.status(400).json({
        success: false,
        message: "Schedule a makeup date before completing the class",
      });
    }

    if (!makeup.sessionSlotId || !makeup.sessionTypeId) {
      return res.status(409).json({ success: false, message: "This makeup has no program session assigned. Reschedule it into a valid program session first." });
    }

    /*
     * Before completing, verify that
     * the scheduled date was actually
     * a valid training date.
     *
     * This protects against an old record
     * that was scheduled before the branch
     * schedule/holiday system existed.
     */
    const availability = await validateMakeupAvailability(
      makeup.branch,
      makeup.makeupDate,
      makeup.originalDate,
      { allowPast: true },
    );

    if (!availability.allowed) {
      return res.status(409).json({
        success: false,
        message: `This makeup cannot be completed because ${availability.message}`,
        reason: availability.reason,
        holiday: availability.holiday,
        branchSchedule: availability.schedule,
      });
    }

    const sessionSlot = (availability.schedule?.slots || []).find((slot) =>
      String(slot._id) === String(makeup.sessionSlotId),
    );
    if (!sessionSlot || String(sessionSlot.sessionTypeId) !== String(makeup.sessionTypeId)) {
      return res.status(409).json({ success: false, message: "The selected makeup session is no longer available for this program. Reschedule the makeup." });
    }

    const dayStart = getStartOfDay(formatDate(makeup.makeupDate));
    const dayEnd = getEndOfDay(formatDate(makeup.makeupDate));
    const existingAttendance = await Attendance.findOne({ student: makeup.student, date: { $gte: dayStart, $lte: dayEnd }, sessionSlotId: makeup.sessionSlotId }).select("_id");
    if (existingAttendance) {
      return res.status(409).json({ success: false, message: "Attendance is already recorded for this student in the selected session" });
    }
    const student = await Student.findById(makeup.student).select("status planEnrollments plan").populate("plan", "classesPerWeek programs");
    if (!student || student.status !== "ACTIVE") {
      return res.status(400).json({ success: false, message: "Only active students can complete a makeup" });
    }
    const enrollment = (student.planEnrollments || []).find((item) =>
      item.status === "ACTIVE" && new Date(item.startDate) <= dayEnd && (!item.endDate || new Date(item.endDate) > dayStart),
    );
    if (enrollment && makeup.enrollment && String(enrollment._id) !== String(makeup.enrollment)) {
      return res.status(409).json({ success: false, message: "The student's plan enrollment changed after this makeup was scheduled. Review the plan before completing it." });
    }
    if (student.planEnrollments?.length && !enrollment) {
      return res.status(409).json({ success: false, message: "The student has no active plan enrollment on the makeup date" });
    }
    const planEntitlement = student.plan?.programs?.find((item) => String(item.program?._id || item.program) === String(makeup.sessionTypeId));
    const entitlement = enrollment?.programs?.find((item) => String(item.program?._id || item.program) === String(makeup.sessionTypeId)) || planEntitlement;
    if ((enrollment?.programs?.length || student.plan?.programs?.length) && !entitlement) {
      return res.status(409).json({ success: false, message: "The active plan does not include this training program" });
    }
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weeklyAttendance = await Attendance.find({ student: makeup.student, date: { $gte: weekStart, $lt: weekEnd }, status: "PRESENT" }).select("sessionTypeId").lean();
    const classesLimit = enrollment?.classesPerWeek ?? student.plan?.classesPerWeek;
    if (Number.isFinite(Number(classesLimit)) && Number(classesLimit) > 0 && weeklyAttendance.length >= Number(classesLimit)) {
      return res.status(409).json({ success: false, message: `The student's plan allows ${classesLimit} attended sessions per week; this makeup would exceed that limit` });
    }
    if (Number.isFinite(Number(entitlement?.weeklyLimit)) && Number(entitlement.weeklyLimit) > 0 && weeklyAttendance.filter((item) => String(item.sessionTypeId) === String(makeup.sessionTypeId)).length >= Number(entitlement.weeklyLimit)) {
      return res.status(409).json({ success: false, message: `The plan allows ${entitlement.weeklyLimit} weekly sessions for this program; this makeup would exceed that limit` });
    }
    const makeupAttendance = await Attendance.create({
      student: makeup.student,
      branch: makeup.branch,
      date: dayStart,
      status: "PRESENT",
      markedBy: req.user._id,
      sessionTypeId: makeup.sessionTypeId,
      sessionSlotId: makeup.sessionSlotId,
      sessionName: sessionSlot.sessionName || "",
      enrollment: enrollment?._id || makeup.enrollment || null,
      plan: enrollment?.plan || makeup.plan || student.plan,
      planDay: makeup.planDay,
      curriculumTitle: makeup.curriculumTitle || "Makeup session",
      curriculumSkill: makeup.curriculumSkill || "",
      curriculumDescription: "",
      makeupRequired: false,
      makeupCompleted: false,
    });

    makeup.status = "COMPLETED";
    makeup.makeupAttendance = makeupAttendance._id;

    makeup.completedBy = req.user._id;

    makeup.completedAt = new Date();

    await makeup.save();

    /*
     * Synchronize original attendance.
     */
    await Attendance.findByIdAndUpdate(makeup.originalAttendance, {
      $set: {
        makeupCompleted: true,
        makeupAttendance: makeupAttendance._id,
      },
    });

    const populatedMakeup = await populateMakeup(Makeup.findById(makeup._id));

    return res.status(200).json({
      success: true,
      message: "Makeup class completed successfully",
      makeup: populatedMakeup,
    });
  } catch (error) {
    console.error("Complete makeup error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to complete makeup class"
          : error.message || "Failed to complete makeup class",
    });
  }
};

/* =========================================================
   CANCEL MAKEUP
   =========================================================
 *
 * PATCH /api/makeups/:id/cancel
 */

const cancelMakeup = async (req, res) => {
  try {
    const { id } = req.params;

    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid makeup ID",
      });
    }

    const makeup = await Makeup.findById(id);

    if (!makeup) {
      return res.status(404).json({
        success: false,
        message: "Makeup class not found",
      });
    }

    const branchAccessError = checkBranchAccess(req, makeup.branch);

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    const coachAccessError = await checkCoachStudentAccess(req, makeup.student);

    if (coachAccessError) {
      return res.status(coachAccessError.status).json({
        success: false,
        message: coachAccessError.message,
      });
    }

    if (makeup.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "A completed makeup cannot be cancelled",
      });
    }

    if (makeup.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Makeup class is already cancelled",
      });
    }

    makeup.status = "CANCELLED";

    makeup.cancelledBy = req.user._id;

    makeup.cancelledAt = new Date();

    if (typeof reason === "string") {
      makeup.cancelReason = reason.trim();
    }

    await makeup.save();

    /*
     * Keep the original attendance
     * marked as requiring makeup,
     * because cancellation does not
     * make the original missed class
     * completed.
     */
    await Attendance.findByIdAndUpdate(makeup.originalAttendance, {
      $set: {
        makeupRequired: true,
        makeupCompleted: false,
      },
    });

    const populatedMakeup = await populateMakeup(Makeup.findById(makeup._id));

    return res.status(200).json({
      success: true,
      message: "Makeup class cancelled successfully",
      makeup: populatedMakeup,
    });
  } catch (error) {
    console.error("Cancel makeup error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to cancel makeup class"
          : error.message || "Failed to cancel makeup class",
    });
  }
};

/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {
  getMakeups,
  getMakeupById,
  createMakeup,
  scheduleMakeup,
  completeMakeup,
  cancelMakeup,
};

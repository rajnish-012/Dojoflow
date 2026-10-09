const mongoose = require("mongoose");

const Attendance = require("../models/Attendance");
const Makeup = require("../models/Makeup");
const Student = require("../models/Student");
const Branch = require("../models/Branch");
const Plan = require("../models/Plan");
const Batch = require("../models/Batch");
const Curriculum = require("../models/Curriculum");
const Session = require("../models/Session");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const { getProgramLearningProgress } = require("../services/programProgress.service");
const { safelyNotify } = require("../services/notification.service");
const { resolveProgramCurriculum } = require("../services/curriculumResolver.service");
const { withAttendanceSessionDetails } = require("../utils/attendanceSession");
const { resolveSessionForSlot } = require("../services/session.service");

const {
  getBranchDateAvailability,
  validateAttendanceDate,
} = require("../services/branchSchedule.service");
const { isBranchScoped } = require("../utils/access");
const { findEnrollmentForDate } = require("../services/enrollmentLifecycle.service");
const auditService = require("../services/audit.service");
const { recalculateEnrollmentFirstAttendedClassDate } = require("../services/enrollmentAttendance.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");

/* =========================================================
DATE HELPERS
========================================================= */

const parseCalendarDate = (value) => {
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
};

const startOfDay = (value) => {
  return parseCalendarDate(value);
};

const getDateRange = (date) => {
  const start = parseCalendarDate(date);

  if (!start) {
    return {
      start: null,
      end: null,
    };
  }

  const end = new Date(start);

  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
  };
};

const formatDate = (date) => {
  const value = parseCalendarDate(date);

  if (!value) {
    return null;
  }

  const year = value.getFullYear();

  const month = String(value.getMonth() + 1).padStart(2, "0");

  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const validateDateFormat = (date) => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  return Boolean(parseCalendarDate(date));
};

/* =========================================================
CENTRAL SCHEDULE SERVICE ADAPTERS
========================================================= */

/*

* Attendance must never maintain its own holiday or weekly
* schedule rules.
*
* All calendar availability is resolved by:
*
* branchSchedule.service.js
*
* Resolution order:
*
* Holiday
* Date override
* Weekly schedule
  */

const getApplicableHoliday = async (date, branchId) => {
  const availability = await getBranchDateAvailability(branchId, date);

  return availability.holiday || null;
};

const getBranchScheduleForDate = async (branchId, date) => {
  const availability = await getBranchDateAvailability(branchId, date);

  return {
    configured: availability.scheduleConfigured,

    isOpen: availability.isTrainingDay,

    isClosed: availability.isClosed,

    isHoliday: availability.isHoliday,

    holiday: availability.holiday || null,

    dayOfWeek: availability.dayOfWeek,

    dayName: availability.dayName,

    slots: Array.isArray(availability.slots)
      ? availability.slots.map((slot) => ({
          _id: slot._id,

          sessionName: slot.sessionName || "Training Session",

          ...(slot.sessionType ? { sessionType: slot.sessionType } : {}),
          ...(slot.sessionTypeId ? { sessionTypeId: slot.sessionTypeId } : {}),

          startTime: slot.startTime,

          endTime: slot.endTime,

          isActive: slot.isActive !== false,
        }))
      : [],

    openingTime: availability.openingTime || null,

    closingTime: availability.closingTime || null,

    reason: availability.reason,

    isDateOverride: availability.isDateOverride,

    dateOverrideId: availability.dateOverrideId,
  };
};

const validateBranchScheduleForAttendance = async (branchId, date) => {
  // The schedule service accepts calendar date strings. The attendance
  // handler has already parsed the request into a Date, so convert it back
  // to the canonical local date before crossing that service boundary.
  const validation = await validateAttendanceDate(branchId, formatDate(date));

  const availability = validation.availability;

  return {
    allowed: validation.allowed,

    schedule: availability
      ? {
          configured: availability.scheduleConfigured,

          isOpen: availability.isTrainingDay,

          isClosed: availability.isClosed,

          isHoliday: availability.isHoliday,

          holiday: availability.holiday || null,

          dayOfWeek: availability.dayOfWeek,

          dayName: availability.dayName,

          slots: Array.isArray(availability.slots) ? availability.slots : [],

          openingTime: availability.openingTime || null,

          closingTime: availability.closingTime || null,

          reason: availability.reason,

          isDateOverride: availability.isDateOverride,

          dateOverrideId: availability.dateOverrideId,
        }
      : null,

    message: validation.message || null,
  };
};

/* =========================================================
BRANCH ACCESS
========================================================= */

const checkBranchAccess = (req, studentBranch) => {
  /*
   * SUPER_ADMIN and other global roles have
   * global access unless route middleware
   * has already restricted them.
   *
   * Branch-scoped custom roles are also restricted
   * to their assigned branch.
   */
  if (!isBranchScoped(req.user)) {
    return null;
  }

  if (!req.user.branch) {
    return {
      status: 403,
      message: "No branch is assigned to this account",
    };
  }

  if (
    !studentBranch ||
    studentBranch.toString() !== req.user.branch.toString()
  ) {
    return {
      status: 403,
      message: "You do not have access to this student",
    };
  }

  return null;
};

/* =========================================================
COACH ACCESS
========================================================= */

const getCoachStudentIds = async (req) => {
  if (req.user.role !== "COACH") {
    return null;
  }

  const assignments = await CoachStudentAssignment.find({
    coach: req.user._id,
    status: "ACTIVE",
  }).select("student");

  return assignments.map((item) => item.student);
};

const checkCoachStudentAccess = async (req, studentId) => {
  if (req.user.role !== "COACH") {
    return null;
  }

  const assignment = await CoachStudentAssignment.findOne({
    coach: req.user._id,
    student: studentId,
    status: "ACTIVE",
  }).select("_id");

  if (!assignment) {
    return {
      status: 403,
      message: "You do not have access to this student",
    };
  }

  return null;
};

/* =========================================================
CALCULATE TRAINING DAY
========================================================= */

const calculateTrainingDay = async (studentId, selectedDate) => {
  const student = await Student.findById(studentId).select("joinDate branch");

  if (!student) {
    return null;
  }

  const joinDate = startOfDay(student.joinDate);

  const targetDate = startOfDay(selectedDate);

  if (!joinDate || !targetDate) {
    return null;
  }

  if (targetDate.getTime() < joinDate.getTime()) {
    return null;
  }

  const { start: selectedStart, end: selectedEnd } = getDateRange(selectedDate);

  /*
   * Preserve the stored planDay when attendance
   * already exists for this exact calendar date.
   */
  const selectedRecord = await Attendance.findOne({
    student: studentId,
    attendanceType: { $ne: "MAKEUP" },
    date: {
      $gte: selectedStart,
      $lte: selectedEnd,
    },
  })
    .sort({
      createdAt: 1,
    })
    .select("date planDay status");

  if (selectedRecord) {
    const storedDay = Number(selectedRecord.planDay);

    if (Number.isInteger(storedDay) && storedDay > 0) {
      return storedDay;
    }
  }

  /*
   * Only previous attendance records are counted.
   */
  const previousRecords = await Attendance.find({
    student: studentId,
    attendanceType: { $ne: "MAKEUP" },
    status: "PRESENT",
    date: {
      $gte: joinDate,
      $lt: selectedStart,
    },
  })
    .select("date")
    .sort({
      date: 1,
      createdAt: 1,
    });

  /*
   * One unique attendance date consumes
   * one training day.
   */
  const uniqueDates = new Set();

  previousRecords.forEach((record) => {
    const key = formatDate(record.date);

    if (key) {
      uniqueDates.add(key);
    }
  });

  return uniqueDates.size + 1;
};

/* =========================================================
GET ATTENDANCE
========================================================= */

const getAttendance = async (req, res) => {
  try {
    const {
      branch,
      student,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    /*
     * Branch restrictions.
     *
     * The data scope is resolved from the database-backed
     * role by auth.middleware.js.
     */
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      query.branch = req.user.branch;
    } else if (branch) {
      query.branch = branch;
    }

    /*
     * Coach assigned-student restriction remains a
     * coach-specific business/data rule.
     */
    if (req.user.role === "COACH") {
      const coachStudentIds = await getCoachStudentIds(req);
      const allowedIds = new Set(coachStudentIds.map((id) => id.toString()));

      if (student && !allowedIds.has(String(student))) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }

      query.student = student || { $in: coachStudentIds };
    } else if (student) {
      if (!mongoose.Types.ObjectId.isValid(student)) {
        return res.status(400).json({
          success: false,
          message: "Invalid student ID",
        });
      }

      query.student = student;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        const parsed = parseCalendarDate(startDate);

        if (!parsed) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate",
          });
        }

        query.date.$gte = parsed;
      }

      if (endDate) {
        const parsed = parseCalendarDate(endDate);

        if (!parsed) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate",
          });
        }

        parsed.setHours(23, 59, 59, 999);

        query.date.$lte = parsed;
      }
    }

    const pageNumber = Math.max(Number(page) || 1, 1);

    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const skip = (pageNumber - 1) * pageSize;

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .populate("student", "name age phone currentBelt status")
        .populate("branch", "name address")
        .populate("markedBy", "name email")
        .sort({
          date: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(pageSize)
        .lean(),

      Attendance.countDocuments(query),
    ]);

    return res.json({
      success: true,

      attendance,

      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get attendance error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to fetch attendance"
          : error.message || "Failed to fetch attendance",
    });
  }
};

/* =========================================================
GET MY ATTENDANCE
========================================================= */

const getMyAttendance = async (req, res) => {
  try {
    // The canonical relationship is Student.user. User intentionally does
    // not embed a student ID, so resolve the profile from that reference.
    const linkedStudent = await Student.findOne({
      user: req.user._id,
    }).select("_id");

    // Keep compatibility with legacy user documents that stored this field.
    const studentId =
      linkedStudent?._id || req.user.student || req.user.studentId;

    if (!studentId) {
      return res.status(404).json({
        success: false,
        message: "Student profile is not linked to this account",
      });
    }

    const { startDate, endDate, status } = req.query;

    const query = {
      student: studentId,
    };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        const parsed = parseCalendarDate(startDate);

        if (!parsed) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate",
          });
        }

        query.date.$gte = parsed;
      }

      if (endDate) {
        const parsed = parseCalendarDate(endDate);

        if (!parsed) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate",
          });
        }

        parsed.setHours(23, 59, 59, 999);

        query.date.$lte = parsed;
      }
    }

    const attendance = await Attendance.find(query)
      .populate("branch", "name address")
      .populate("markedBy", "name email")
      .sort({
        date: -1,
      })
      .lean();

    return res.json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error("Get my attendance error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to fetch attendance"
          : error.message || "Failed to fetch attendance",
    });
  }
};

/* =========================================================
GET ATTENDANCE BY STUDENT
========================================================= */

const getAttendanceByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(studentId)
      .select("name branch plan joinDate currentBelt status")
      .populate("branch", "name address")
      .populate("plan", "name duration curriculum");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const branchAccessError = checkBranchAccess(
      req,
      student.branch?._id || student.branch,
    );

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    const coachAccessError = await checkCoachStudentAccess(req, studentId);

    if (coachAccessError) {
      return res.status(coachAccessError.status).json({
        success: false,
        message: coachAccessError.message,
      });
    }

    const attendance = await Attendance.find({
      student: studentId,
    })
      .populate("markedBy", "name email")
      .populate("sessionTypeId", "name")
      .populate("plan", "name")
      .sort({
        date: 1,
      })
      .lean();
    const attendanceWithSessions = await withAttendanceSessionDetails(
      attendance,
      student.branch?._id || student.branch,
    );

    return res.json({
      success: true,

      student,

      attendance: attendanceWithSessions,
    });
  } catch (error) {
    console.error("Get attendance by student error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to fetch student attendance"
          : error.message || "Failed to fetch student attendance",
    });
  }
};

/* =========================================================
GET ATTENDANCE BY ID
========================================================= */

const getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance ID",
      });
    }

    const attendance = await Attendance.findById(id)
      .populate(
        "student",
        "name age phone currentBelt status branch plan joinDate",
      )
      .populate("branch", "name address")
      .populate("markedBy", "name email")
      .lean();

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    const studentBranch =
      attendance.student?.branch || attendance.branch?._id || attendance.branch;

    const branchAccessError = checkBranchAccess(req, studentBranch);

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    const coachAccessError = await checkCoachStudentAccess(
      req,
      attendance.student?._id || attendance.student,
    );

    if (coachAccessError) {
      return res.status(coachAccessError.status).json({
        success: false,
        message: coachAccessError.message,
      });
    }

    return res.json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error("Get attendance by ID error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to fetch attendance"
          : error.message || "Failed to fetch attendance",
    });
  }
};

/* =========================================================
GET DAILY ATTENDANCE SHEET
========================================================= */

const getDailyAttendanceSheet = async (req, res) => {
  try {
    const { date, branch, search, status } = req.query;

    const requestedDate = date
      ? parseCalendarDate(date)
      : startOfDay(new Date());

    if (!requestedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use YYYY-MM-DD.",
      });
    }

    const selectedDate = formatDate(requestedDate);
    const { start, end } = getDateRange(requestedDate);

    let branchId = branch || null;

    /*
     * Branch-restricted roles must use
     * their assigned branch.
     *
     * This now comes from Role.dataScope, so
     * custom BRANCH-scoped roles are protected too.
     */
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      branchId = req.user.branch;
    }

    /*
     * If a coach does not explicitly supply a
     * branch, use the coach's branch.
     */
    if (req.user.role === "COACH" && !branchId) {
      branchId = req.user.branch;
    }

    const studentQuery = {
      status: {
        $nin: ["INACTIVE", "COMPLETED", "DELETED"],
      },
      joinDate: { $lte: end },
    };

    if (branchId) {
      studentQuery.branch = branchId;
    }

    if (search) {
      studentQuery.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    /*
     * Coaches only see their assigned students.
     */
    const coachStudentIds = await getCoachStudentIds(req);

    if (Array.isArray(coachStudentIds)) {
      if (coachStudentIds.length === 0) {
        return res.json({
          success: true,

          date: selectedDate,

          branch: branchId || null,

          students: [],

          rows: [],

          summary: {
            total: 0,
            present: 0,
            absent: 0,
            holiday: 0,
            unmarked: 0,
          },
        });
      }

      studentQuery._id = {
        $in: coachStudentIds,
      };
    }

    const students = await Student.find(studentQuery)
      .populate("branch", "name address")
      .populate("plan", "name curriculum programs")
      .populate("plan.programs.program", "name")
      .populate("planEnrollments.programs.program", "name")
      .sort({
        name: 1,
      })
      .lean();

    /*
     * Existing attendance records for the
     * selected calendar date.
     */
    const attendanceQuery = {
      attendanceType: { $ne: "MAKEUP" },
      date: {
        $gte: start,
        $lte: end,
      },
    };

    if (branchId) {
      attendanceQuery.branch = branchId;
    }

    const existingAttendance = await Attendance.find(attendanceQuery)
      .populate("markedBy", "name email")
      .lean();

    const attendanceByStudent = new Map();

    existingAttendance.forEach((record) => {
      const key = record.student.toString();

      const records = attendanceByStudent.get(key) || [];
      records.push(record);
      attendanceByStudent.set(key, records);
    });

    /*
     * Cache the centralized schedule service
     * per branch/date.
     */
    const scheduleCache = new Map();
    const cancelledSlotCache = new Map();

    const holidayCache = new Map();

    const getCachedSchedule = async (currentBranchId) => {
      const key = currentBranchId.toString();

      if (scheduleCache.has(key)) {
        return scheduleCache.get(key);
      }

      const promise = (async () => {
        const schedule = await getBranchScheduleForDate(currentBranchId, selectedDate);
        const unavailableBatchSlots = new Set();
        const datedSessionsBySlot = new Map();
        for (const slot of schedule?.slots || []) {
          if (!slot.batchId || !slot._id) continue;
          const datedSession = await resolveSessionForSlot({ branchId: currentBranchId, date: selectedDate, slot });
          if (!datedSession) unavailableBatchSlots.add(String(slot._id));
          else datedSessionsBySlot.set(String(slot._id), datedSession);
        }
        const curriculumIds = [...new Set([...datedSessionsBySlot.values()].map((session) => String(session.curriculum || "")).filter(Boolean))];
        const curricula = curriculumIds.length ? await Curriculum.find({ _id: { $in: curriculumIds } }).lean() : [];
        const curriculumById = new Map(curricula.map((item) => [String(item._id), item]));
        schedule.slots = (schedule.slots || []).map((slot) => {
          const session = datedSessionsBySlot.get(String(slot._id || ""));
          const curriculum = session?.curriculum ? curriculumById.get(String(session.curriculum)) : null;
          const plannedSteps = curriculum ? curriculum.modules.flatMap((module) => module.steps.filter((step) => (session.plannedStepIds || []).includes(String(step._id))).map((step) => ({ _id: String(step._id), moduleId: String(module._id), moduleName: module.name, title: step.title, description: step.description, completionCriteria: step.completionCriteria }))) : [];
          return { ...slot, datedSessionId: session?._id || null, plannedCurriculumVersion: curriculum ? { _id: curriculum._id, name: curriculum.name, version: curriculum.version } : null, plannedCurriculum: plannedSteps };
        });
        const batchIds = [...new Set((schedule?.slots || []).map((slot) => String(slot.batchId || "")).filter(Boolean))];
        if (batchIds.length) {
          const batches = await Batch.find({ _id: { $in: batchIds }, branch: currentBranchId }).select("_id name code").lean();
          const names = new Map(batches.map((batch) => [String(batch._id), `${batch.name}${batch.code ? ` (${batch.code})` : ""}`]));
          schedule.slots = (schedule.slots || []).map((slot) => ({ ...slot, batchName: names.get(String(slot.batchId || "")) || "Batch unavailable" }));
        }
        cancelledSlotCache.set(key, unavailableBatchSlots);
        return schedule;
      })();

      scheduleCache.set(key, promise);

      return promise;
    };

    const getCachedHoliday = async (currentBranchId) => {
      const key = currentBranchId.toString();

      if (holidayCache.has(key)) {
        return holidayCache.get(key);
      }

      const promise = getApplicableHoliday(selectedDate, currentBranchId);

      holidayCache.set(key, promise);

      return promise;
    };

    /*
     * Build daily rows.
     */
    const rows = await Promise.all(
      students.map(async (student) => {
        const studentId = student._id.toString();

        const studentAttendance = attendanceByStudent.get(studentId) || [];

        const currentBranchId = student.branch?._id || student.branch;

        /*
         * Central schedule resolution.
         */
        const branchSchedule = currentBranchId
          ? await getCachedSchedule(currentBranchId)
          : {
              configured: false,
              isOpen: true,
              isClosed: false,
              isHoliday: false,
              holiday: null,
              dayOfWeek: requestedDate.getDay(),

              dayName: [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ][requestedDate.getDay()],
              slots: [],
              openingTime: null,
              closingTime: null,
            };

        const datedEnrollment = findEnrollmentForDate(student.planEnrollments, start, end);
        const planEntitlements = datedEnrollment?.programs?.length
          ? datedEnrollment.programs
          : datedEnrollment || !(student.planEnrollments || []).length
            ? (student.plan?.programs || [])
            : [];
        const branchProgramSlots = (branchSchedule.slots || []).filter((slot) => slot.isActive !== false && slot.sessionTypeId && slot._id);
        const matchesEnrollmentBatch = (slot) => datedEnrollment?.batch ? String(datedEnrollment.batch) === String(slot.batchId || "") : !slot.batchId;
        const scheduledSlots = branchProgramSlots.filter((slot) => matchesEnrollmentBatch(slot) && planEntitlements.some((item) => String(item.program?._id || item.program) === String(slot.sessionTypeId)));
        const sessionSlots = await Promise.all((branchSchedule.slots || []).map(async (slot) => {
          const batchEligible = matchesEnrollmentBatch(slot);
          const record = studentAttendance.find((item) => String(item.sessionSlotId || "") === String(slot._id || "")) || (scheduledSlots.length === 1 ? studentAttendance.find((item) => !item.sessionSlotId) : null);
          const entitlement = batchEligible ? planEntitlements.find((item) => String(item.program?._id || item.program) === String(slot.sessionTypeId)) : null;
          const planProgram = student.plan?.programs?.find((item) => String(item.program?._id || item.program) === String(slot.sessionTypeId));
          const slotCurriculum = resolveProgramCurriculum(entitlement, planProgram, student.plan?.curriculum);
          const learning = slot.sessionTypeId && entitlement ? await getProgramLearningProgress({ studentId: student._id, programId: slot.sessionTypeId, enrollmentId: datedEnrollment?._id, enrollmentStartDate: datedEnrollment?.startDate, enrollmentEndDate: datedEnrollment?.endDate, curriculum: slotCurriculum, asOfDate: selectedDate }) : null;
          const planDayForSlot = record?.planDay || learning?.nextDay || null;
          const configuredCurriculum = slotCurriculum.find((item) => Number(item.day) === Number(planDayForSlot)) || null;
          const curriculumForSlot = record ? { title: record.curriculumTitle, skill: record.curriculumSkill, description: record.curriculumDescription } : configuredCurriculum;
          const unavailableBatchSession = cancelledSlotCache.get(String(currentBranchId))?.has(String(slot._id || ""));
          return { ...slot, attendance: record || null, entitled: Boolean(entitlement && !unavailableBatchSession), curriculumAvailable: Boolean(entitlement && !unavailableBatchSession && configuredCurriculum), unavailableBatchSession: Boolean(unavailableBatchSession), curriculumComplete: Boolean(entitlement && slotCurriculum.length > 0 && learning && !learning.nextDay && !record), planDay: planDayForSlot, curriculum: curriculumForSlot, programName: entitlement?.program?.name || "" };
        }));
        // The sheet records one attendance decision per student per date.
        // A schedule may offer several program slots, but once the student is
        // marked in one slot, lock both actions for that date.
        const attendance = studentAttendance.find((record) => scheduledSlots.some((slot) => String(slot._id) === String(record.sessionSlotId))) || studentAttendance[0] || null;
        const completeForDate = Boolean(attendance);
        const entitledSlots = sessionSlots.filter((slot) => slot.entitled);
        const curriculumComplete = entitledSlots.length > 0 && entitledSlots.every((slot) => slot.curriculumComplete || slot.attendance);

        /*
         * Holiday comes from the same
         * centralized service.
         */
        const holiday = currentBranchId
          ? await getCachedHoliday(currentBranchId)
          : null;

        /*
         * Calculate training day from
         * actual attendance history.
         */
        let planDay = await calculateTrainingDay(student._id, selectedDate);

        if (!Number.isInteger(Number(planDay)) || Number(planDay) < 1) {
          planDay = 1;
        }

        const nextEligibleSlot = sessionSlots.find((slot) => slot.entitled && !slot.attendance && slot.curriculumAvailable);
        let preview = null;
        if (!nextEligibleSlot && planEntitlements.length) {
          for (const entitlement of planEntitlements) {
            const programId = entitlement.program?._id || entitlement.program;
            if (!programId) continue;
            const planProgram = student.plan?.programs?.find((item) => String(item.program?._id || item.program) === String(programId));
            const curriculum = resolveProgramCurriculum(entitlement, planProgram, student.plan?.curriculum);
            const learning = await getProgramLearningProgress({ studentId: student._id, programId, enrollmentId: datedEnrollment?._id, enrollmentStartDate: datedEnrollment?.startDate, enrollmentEndDate: datedEnrollment?.endDate, curriculum, asOfDate: selectedDate });
            if (!learning.nextDay) continue;
            const item = curriculum.find((lesson) => Number(lesson.day) === Number(learning.nextDay));
            if (item) {
              preview = { planDay: learning.nextDay, curriculum: item, programName: entitlement.program?.name || planProgram?.program?.name || "" };
              break;
            }
          }
        }
        const curriculum = nextEligibleSlot?.curriculum || preview?.curriculum || null;
        const displayedPlanDay = nextEligibleSlot?.planDay || preview?.planDay || attendance?.planDay || planDay;

        return {
          student,
          attendance,
          planDay: Number(displayedPlanDay),
          curriculum,
          curriculumScheduled: Boolean(nextEligibleSlot),
          holiday: holiday
            ? {
                _id: holiday._id,
                name: holiday.name,
                description: holiday.description || "",
                date: formatDate(holiday.date),
              }
            : null,
          branchSchedule: { ...branchSchedule, slots: sessionSlots },
          attendanceComplete: Boolean(completeForDate),
          curriculumComplete,
          sessionAttendanceCount: sessionSlots.filter((slot) => slot.entitled && slot.attendance).length,
          sessionAttendanceTotal: scheduledSlots.length,
          isHoliday: Boolean(holiday),
          isTrainingDay: Boolean(branchSchedule.isOpen && !holiday),
          isClosed: Boolean(branchSchedule.isClosed),
          status:
            attendance?.status || (sessionSlots.some((slot) => slot.attendance) ? "PARTIAL" : null) ||
            (holiday
              ? "HOLIDAY"
              : branchSchedule.isClosed
                ? "CLOSED"
                : "UNMARKED"),
        };
      }),
    );

    const capacityStudentQuery = { ...studentQuery, status: "ACTIVE" };
    delete capacityStudentQuery.$or;
    const capacityStudents = await Student.find(capacityStudentQuery).select("branch plan planEnrollments").populate("plan", "programs").lean();
    const currentEnrollmentByBranchProgram = new Map();
    for (const rosterStudent of capacityStudents) {
      const datedEnrollment = findEnrollmentForDate(rosterStudent.planEnrollments, start, end);
      const programs = datedEnrollment?.programs?.length
        ? datedEnrollment.programs
        : datedEnrollment || !(rosterStudent.planEnrollments || []).length
          ? (rosterStudent.plan?.programs || [])
          : [];
      for (const entitlement of programs) {
        const programId = String(entitlement.program?._id || entitlement.program || "");
        if (!programId) continue;
        const key = `${String(rosterStudent.branch)}:${programId}`;
        currentEnrollmentByBranchProgram.set(key, (currentEnrollmentByBranchProgram.get(key) || 0) + 1);
      }
    }
    for (const row of rows) {
      row.branchSchedule.slots = (row.branchSchedule.slots || []).map((slot) => {
        const key = `${String(row.student.branch?._id || row.student.branch)}:${String(slot.sessionTypeId || "")}`;
        const currentEnrollment = currentEnrollmentByBranchProgram.get(key) || 0;
        const capacity = Number.isInteger(Number(slot.capacity)) && slot.capacity != null ? Number(slot.capacity) : null;
        return { ...slot, currentEnrollment: slot.entitled ? currentEnrollment : 0, availableSeats: capacity == null ? null : Math.max(0, capacity - (slot.entitled ? currentEnrollment : 0)) };
      });
    }

    /*
     * Optional status filter is applied after
     * calculating the complete daily state.
     */
    const filteredRows = status
      ? rows.filter((row) => row.status === status)
      : rows;

    const summary = {
      total: rows.length,
      present: rows.filter((row) => row.attendance?.status === "PRESENT")
        .length,
      absent: rows.filter((row) => row.attendance?.status === "ABSENT").length,
      holiday: rows.filter((row) => row.isHoliday).length,
      unmarked: rows.filter(
        (row) => !row.attendance && !row.isHoliday && !row.isClosed,
      ).length,
      closed: rows.filter(
        (row) => !row.attendance && !row.isHoliday && row.isClosed,
      ).length,
    };

    return res.json({
      success: true,
      date: selectedDate,
      branch: branchId || null,
      students: filteredRows.map((row) => row.student),
      rows: filteredRows,
      summary,
    });
  } catch (error) {
    console.error("Get daily attendance sheet error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to fetch daily attendance sheet"
          : error.message || "Failed to fetch daily attendance sheet",
    });
  }
};

/* =========================================================
MARK ATTENDANCE
========================================================= */

const markAttendance = async (req, res) => {
  try {
    const { student, date, status, makeupRequired = false, sessionSlotId: requestedSessionSlotId } = req.body;

    /*
     * Basic validation.
     */
    if (!student) {
      return res.status(400).json({
        success: false,
        message: "Student is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(student)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    if (!date || !validateDateFormat(date)) {
      return res.status(400).json({
        success: false,
        message: "Date is required in YYYY-MM-DD format",
      });
    }

    const allowedStatuses = ["PRESENT", "ABSENT"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    const requestedDate = parseCalendarDate(date);

    if (!requestedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date",
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

    if (!studentRecord.branch) {
      return res.status(400).json({
        success: false,
        message: "Student is not assigned to a branch",
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

    const branchAccessError = checkBranchAccess(req, studentRecord.branch);

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    if (studentRecord.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Attendance can only be marked for active students",
      });
    }

    /*
     * Registration/join date check.
     */
    const registrationDate = startOfDay(studentRecord.joinDate);

    if (!registrationDate) {
      return res.status(400).json({
        success: false,
        message: "Student does not have a valid registration date",
      });
    }

    if (requestedDate.getTime() < registrationDate.getTime()) {
      return res.status(400).json({
        success: false,
        message: `Attendance cannot be marked before the student's registration date (${formatDate(
          registrationDate,
        )}).`,
      });
    }

    /* =====================================================
   CENTRAL SCHEDULE + HOLIDAY CHECK
===================================================== */

    /*
     * IMPORTANT:
     *
     * Holiday, date-specific override and weekly
     * schedule are all resolved by one service.
     */
    const scheduleValidation = await validateBranchScheduleForAttendance(
      studentRecord.branch,
      requestedDate,
    );

    /*
     * Holiday gets a dedicated response so the
     * frontend can display the holiday state.
     */
    if (scheduleValidation.schedule?.isHoliday) {
      const holiday = scheduleValidation.schedule.holiday;

      return res.status(409).json({
        success: false,

        message: holiday?.name
          ? `Attendance cannot be marked because ${formatDate(
              holiday.date,
            )} is a holiday: ${holiday.name}.`
          : "Attendance cannot be marked because this date is a holiday.",

        holiday: holiday
          ? {
              _id: holiday._id,
              name: holiday.name,
              description: holiday.description || "",
              date: formatDate(holiday.date),
            }
          : null,

        branchSchedule: scheduleValidation.schedule,
      });
    }

    if (!scheduleValidation.allowed) {
      return res.status(409).json({
        success: false,

        message:
          scheduleValidation.message ||
          "Attendance cannot be marked on this date.",

        branchSchedule: scheduleValidation.schedule,
      });
    }

    /* =====================================================
   BRANCH
===================================================== */

    const branch = await Branch.findById(studentRecord.branch);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Student branch not found",
      });
    }

    /* =====================================================
   PLAN
===================================================== */

    const datedEnrollment = findEnrollmentForDate(studentRecord.planEnrollments, requestedDate);
    const plan = await Plan.findById(datedEnrollment?.plan || studentRecord.plan);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Student plan not found",
      });
    }
    if (!datedEnrollment && Array.isArray(studentRecord.planEnrollments) && studentRecord.planEnrollments.length > 0) return res.status(403).json({ success: false, message: "The student has no active plan enrollment on this attendance date." });

    const activeSlots = (scheduleValidation.schedule?.slots || []).filter((slot) => slot.isActive !== false && slot.sessionTypeId);
    let selectedSlot = null;
    if (requestedSessionSlotId) {
      if (!mongoose.Types.ObjectId.isValid(requestedSessionSlotId)) return res.status(400).json({ success: false, message: "Invalid scheduled session selection." });
      selectedSlot = activeSlots.find((slot) => String(slot._id) === String(requestedSessionSlotId));
    } else {
      if (activeSlots.length === 1) selectedSlot = activeSlots[0];
      if (activeSlots.length > 1) return res.status(409).json({ success: false, message: "More than one session is scheduled for this date. Select the session before marking attendance.", sessions: activeSlots.map(({ _id, sessionName, sessionTypeId, startTime, endTime }) => ({ _id, sessionName, sessionTypeId, startTime, endTime })) });
    }
    if (!selectedSlot) return res.status(409).json({ success: false, message: "No active program session is scheduled for this branch and date." });
    if (req.user.role === "COACH") {
      const CoachAvailability = require("../models/CoachAvailability");
      const availability = await CoachAvailability.findOne({ coach: req.user._id, branch: studentRecord.branch }).lean();
      if (availability) {
        const weekday = requestedDate.getDay();
        const slotStart = Number(String(selectedSlot.startTime).slice(0, 2)) * 60 + Number(String(selectedSlot.startTime).slice(3, 5));
        const slotEnd = Number(String(selectedSlot.endTime).slice(0, 2)) * 60 + Number(String(selectedSlot.endTime).slice(3, 5));
        const worksAtTime = !availability.workingHours.length || availability.workingHours.some((hours) => hours.dayOfWeek === weekday && hours.startTime <= selectedSlot.startTime && hours.endTime >= selectedSlot.endTime);
        const unavailable = (availability.unavailableSlots || []).some((item) => {
          const dateMatches = item.date && formatDate(startOfDay(item.date)) === formatDate(requestedDate);
          const dayMatches = item.dayOfWeek === weekday;
          if (!dateMatches && !dayMatches) return false;
          const unavailableStart = Number(String(item.startTime).slice(0, 2)) * 60 + Number(String(item.startTime).slice(3, 5));
          const unavailableEnd = Number(String(item.endTime).slice(0, 2)) * 60 + Number(String(item.endTime).slice(3, 5));
          return slotStart < unavailableEnd && slotEnd > unavailableStart;
        });
        const onLeave = (availability.leave || []).some((item) => requestedDate >= startOfDay(item.startDate) && requestedDate <= startOfDay(item.endDate));
        if (!worksAtTime || unavailable || onLeave) return res.status(409).json({ success: false, code: "COACH_UNAVAILABLE", message: "This class conflicts with your working hours, unavailable time, or approved leave." });
      }
    }
    const effectivePrograms = datedEnrollment?.programs?.length ? datedEnrollment.programs : (plan.programs || []);
    if (datedEnrollment?.batch && String(datedEnrollment.batch) !== String(selectedSlot.batchId || "")) return res.status(403).json({ success: false, message: "This student is assigned to a different Batch for the selected class." });
    if (!datedEnrollment?.batch && selectedSlot.batchId) return res.status(403).json({ success: false, message: "This student has no Batch assignment for the selected class." });
    const planProgram = effectivePrograms.find((item) => String(item.program?._id || item.program) === String(selectedSlot.sessionTypeId));
    if (!planProgram) return res.status(403).json({ success: false, message: "The student's plan does not include this program. Update the plan entitlement before marking attendance." });
    const Program = require("../models/TrainingSessionType");
    const program = await Program.findById(selectedSlot.sessionTypeId).select("name isActive");
    if (!program || !program.isActive) return res.status(409).json({ success: false, message: "This program is inactive and cannot receive new attendance." });

    if (["PRESENT", "LATE"].includes(status)) {
      const weekStart = new Date(requestedDate);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const attendedThisWeek = await Attendance.countDocuments({ student, date: { $gte: weekStart, $lt: weekEnd }, status: { $in: ["PRESENT", "LATE"] } });
      const sharedAllowance = Number(datedEnrollment?.classesPerWeek || plan.classesPerWeek || 0);
      if (attendedThisWeek >= sharedAllowance) return res.status(409).json({ success: false, message: `The student's plan allows ${sharedAllowance} attended classes per week, and that allowance has been reached.` });
      if (planProgram.weeklyLimit) {
        const programAttendance = await Attendance.countDocuments({ student, sessionTypeId: selectedSlot.sessionTypeId, date: { $gte: weekStart, $lt: weekEnd }, status: { $in: ["PRESENT", "LATE"] } });
        if (programAttendance >= Number(planProgram.weeklyLimit)) return res.status(409).json({ success: false, message: `The plan allows ${planProgram.weeklyLimit} attended ${program.name} sessions per week, and that program allowance has been reached.` });
      }
    }

    /* =====================================================
   EXACT-DATE DUPLICATE CHECK
===================================================== */

    const { start, end } = getDateRange(date);

    const existingAttendance = await Attendance.findOne({
      student,
      attendanceType: { $ne: "MAKEUP" },
      date: {
        $gte: start,
        $lte: end,
      },
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        code: "ATTENDANCE_ALREADY_MARKED",
        message: "Attendance has already been marked for this student on this date.",
        attendance: existingAttendance,
      });
    }

    if (status === "PRESENT" && Number.isInteger(Number(selectedSlot.capacity)) && Number(selectedSlot.capacity) > 0) {
      const canOverrideCapacity = req.user.role === "SUPER_ADMIN" || (req.user.permissions || []).includes("branch_schedule.capacity.override");
      if (!canOverrideCapacity) {
        const occupiedSeats = await Attendance.countDocuments({ branch: studentRecord.branch, date: { $gte: start, $lte: end }, sessionSlotId: selectedSlot._id, status: "PRESENT", attendanceType: { $ne: "MAKEUP" } });
        if (occupiedSeats >= Number(selectedSlot.capacity)) return res.status(409).json({ success: false, code: "SESSION_CAPACITY_REACHED", message: `This session has reached its capacity of ${selectedSlot.capacity}.`, capacity: Number(selectedSlot.capacity), occupiedSeats });
      }
    }

    /* =====================================================
   SERVER-CALCULATED TRAINING DAY
===================================================== */

    const configuredPlanProgram = (plan.programs || []).find((item) => String(item.program?._id || item.program) === String(selectedSlot.sessionTypeId));
    const planCurriculum = resolveProgramCurriculum(planProgram, configuredPlanProgram, plan.curriculum);
    const learningProgress = await getProgramLearningProgress({
      studentId: studentRecord._id,
      programId: selectedSlot.sessionTypeId,
      enrollmentId: datedEnrollment?._id,
      enrollmentStartDate: datedEnrollment?.startDate,
      enrollmentEndDate: datedEnrollment?.endDate,
      curriculum: planCurriculum,
      asOfDate: requestedDate,
    });
    const normalizedPlanDay = learningProgress.nextDay;
    if (!normalizedPlanDay) return res.status(409).json({ success: false, message: "The student has completed this program curriculum. Add the next curriculum day before marking more attendance." });

    /* =====================================================
   CURRICULUM
===================================================== */

    const curriculumItem = Array.isArray(planCurriculum)
      ? planCurriculum.find((item) => Number(item.day) === Number(normalizedPlanDay))
      : null;

    if (!curriculumItem) {
      return res.status(400).json({
        success: false,
        message: `No curriculum step is configured for training Day ${normalizedPlanDay}.`,
      });
    }

    /* =====================================================
   MAKEUP
===================================================== */

    // Absence recovery is mandatory; retain the request field for compatibility.
    const shouldCreateMakeup = status === "ABSENT";

    /* =====================================================
   CREATE ATTENDANCE
===================================================== */

    const attendanceDate = new Date(requestedDate);
    const datedSession = selectedSlot.batchId ? await resolveSessionForSlot({ branchId: studentRecord.branch, date, slot: selectedSlot }) : null;
    if (selectedSlot.batchId && !datedSession) return res.status(409).json({ success: false, message: "The selected Batch session is no longer active." });

    const attendance = await Attendance.create({
      student,
      enrollment: datedEnrollment?._id || null,
      session: datedSession?._id || null,
      batch: datedSession?.batch || null,
      plan: plan._id,
      branch: studentRecord.branch,
      sessionTypeId: selectedSlot.sessionTypeId,
      sessionSlotId: selectedSlot._id,
      sessionName: selectedSlot.sessionName,
      sessionStartTime: selectedSlot.startTime,
      sessionEndTime: selectedSlot.endTime,
      date: attendanceDate,
      planDay: normalizedPlanDay,
      curriculumTitle: curriculumItem.title,
      curriculumSkill: curriculumItem.skill || "",
      curriculumDescription: curriculumItem.description || "",
      status,
      attendanceType: "REGULAR",
      markedBy: req.user._id,
      makeupRequired: shouldCreateMakeup,
      makeupCompleted: false,
    });

    /* =====================================================
   CREATE MAKEUP
===================================================== */

    let makeup = null;
    if (shouldCreateMakeup) {
      try {
      makeup = await Makeup.create({
        student,
        enrollment: datedEnrollment?._id || null,
        originalSession: datedSession?._id || null,
        plan: plan._id,
        sessionTypeId: selectedSlot.sessionTypeId,
        sessionSlotId: selectedSlot._id,
        branch: studentRecord.branch,
        originalAttendance: attendance._id,
        planDay: normalizedPlanDay,
        originalDate: attendanceDate,
        makeupDate: null,
        status: "SCHEDULED",
        curriculumTitle: curriculumItem.title,
        curriculumSkill: curriculumItem.skill || "",
        markedBy: req.user._id,
      });
      } catch (writeError) {
        await Attendance.deleteOne({ _id: attendance._id });
        throw writeError;
      }
    }

    try {
      await auditService.record({ req, action: AUDIT_ACTIONS.ATTENDANCE_MARKED, entityType: "ATTENDANCE", entityId: attendance._id, branchId: studentRecord.branch, after: { studentId: studentRecord._id, status, attendanceType: "REGULAR", date: attendanceDate, makeupRequired: shouldCreateMakeup } });
    } catch (auditError) {
      if (makeup) await Makeup.deleteOne({ _id: makeup._id });
      await Attendance.deleteOne({ _id: attendance._id });
      throw auditError;
    }

    const firstAttendedClassDate = status === "PRESENT" && datedEnrollment?._id
      ? await recalculateEnrollmentFirstAttendedClassDate({ studentId: studentRecord._id, enrollmentId: datedEnrollment._id })
      : datedEnrollment?.firstAttendedClassDate || null;

    if (status === "ABSENT") {
      await safelyNotify({
        type: "ATTENDANCE_ABSENT",
        title: "Attendance marked absent",
        message: `${studentRecord.name} was marked absent for Training Day ${normalizedPlanDay}.`,
        severity: "WARNING",
        branch: studentRecord.branch,
        student: studentRecord._id,
        entityType: "ATTENDANCE",
        entityId: attendance._id,
        eventKey: `attendance:${attendance._id}:absent`,
        actionUrl: `/attendance?date=${encodeURIComponent(date)}`,
      });
      if (makeup) {
        await safelyNotify({
          type: "MAKEUP_CREATED",
          title: "Makeup class required",
          message: `${studentRecord.name} missed Training Day ${normalizedPlanDay}. A makeup class has been created.`,
          severity: "WARNING",
          branch: studentRecord.branch,
          student: studentRecord._id,
          entityType: "MAKEUP",
          entityId: makeup._id,
          eventKey: `makeup:${makeup._id}:created`,
          actionUrl: "/makeups",
        });
      }
    }

    /* =====================================================
   POPULATE RESPONSE
===================================================== */

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("markedBy", "name email");

    return res.status(201).json({
      success: true,

      message: makeup
        ? "Attendance marked and makeup class created successfully"
        : "Attendance marked successfully",

      attendance: populatedAttendance,
      makeup,
      firstAttendedClassDate,
      progression: {
        consumedDay: normalizedPlanDay,
        nextDay: (await getProgramLearningProgress({
          studentId: studentRecord._id,
          programId: selectedSlot.sessionTypeId,
          enrollmentId: datedEnrollment?._id,
          enrollmentStartDate: datedEnrollment?.startDate,
          enrollmentEndDate: datedEnrollment?.endDate,
          curriculum: planCurriculum,
          asOfDate: requestedDate,
        })).nextDay,
      },
      branchSchedule: scheduleValidation.schedule,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        code: "ATTENDANCE_ALREADY_MARKED",
        message: "Attendance has already been marked for this student on this date.",
      });
    }

    console.error("Mark attendance error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to mark attendance"
          : error.message || "Failed to mark attendance",
    });
  }
};

/* =========================================================
UNDO REGULAR ATTENDANCE
========================================================= */

const undoAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Attendance record ID is invalid." });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: "Attendance record was not found." });
    }
    const branchError = checkBranchAccess(req, attendance.branch);
    if (branchError) return res.status(branchError.status).json({ success: false, message: branchError.message });
    const coachError = await checkCoachStudentAccess(req, attendance.student);
    if (coachError) return res.status(coachError.status).json({ success: false, message: coachError.message });

    if (attendance.attendanceType !== "REGULAR") {
      return res.status(409).json({ success: false, code: "MAKEUP_ATTENDANCE_CANNOT_BE_UNDONE", message: "Makeup attendance is part of the recovery history and cannot be undone here." });
    }

    if (startOfDay(attendance.date).getTime() < startOfDay(new Date()).getTime()) {
      return res.status(409).json({ success: false, code: "HISTORICAL_ATTENDANCE_REQUIRES_CORRECTION", message: "Historical attendance cannot be deleted. Submit a correction request for approval." });
    }

    const Performance = require("../models/Performance");
    if (await Performance.exists({ attendance: attendance._id })) {
      return res.status(409).json({ success: false, code: "ATTENDANCE_HAS_PERFORMANCE", message: "This attendance has a performance evaluation. Remove or correct that evaluation before undoing attendance." });
    }

    const makeup = await Makeup.findOne({ originalAttendance: attendance._id });
    if (makeup?.status === "COMPLETED" || makeup?.makeupAttendance) {
      return res.status(409).json({ success: false, code: "ATTENDANCE_HAS_COMPLETED_MAKEUP", message: "This absence has a completed makeup recovery and cannot be undone." });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Delete the dependent scheduled/cancelled absence recovery before its source.
        if (makeup) await Makeup.deleteOne({ _id: makeup._id }, { session });
        const deleted = await Attendance.deleteOne({ _id: attendance._id, attendanceType: "REGULAR" }, { session });
        if (!deleted.deletedCount) throw new Error("Attendance changed while undoing.");
        if (attendance.enrollment) await recalculateEnrollmentFirstAttendedClassDate({ studentId: attendance.student, enrollmentId: attendance.enrollment, session });
        await auditService.record({ req, session, action: AUDIT_ACTIONS.ATTENDANCE_UNDONE, entityType: "ATTENDANCE", entityId: attendance._id, branchId: attendance.branch, before: { status: attendance.status, date: attendance.date, makeupRequired: attendance.makeupRequired }, after: { deleted: true } });
      });
    } finally { await session.endSession(); }

    return res.json({ success: true, message: "Attendance was undone.", attendanceId: id });
  } catch (error) {
    console.error("Undo attendance error:", error);
    return res.status(500).json({ success: false, message: process.env.NODE_ENV === "production" ? "Failed to undo attendance." : error.message || "Failed to undo attendance." });
  }
};

/* =========================================================
MARK ALL ELIGIBLE STUDENTS PRESENT
========================================================= */

const markAllAttendancePresent = async (req, res) => {
  try {
    const { date } = req.body || {};

    if (!date || !validateDateFormat(date)) {
      return res.status(400).json({
        success: false,
        message: "Date is required in YYYY-MM-DD format",
      });
    }

    const requestedDate = parseCalendarDate(date);
    const today = startOfDay(new Date());

    if (requestedDate > today) {
      return res.status(400).json({
        success: false,
        message: "Future attendance cannot be marked.",
      });
    }

    // Use the existing daily sheet to apply the user's data scope and
    // centralized holiday and branch schedule resolution.
    const sheetResponse = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    await getDailyAttendanceSheet(
      { ...req, query: { date } },
      sheetResponse,
    );

    if (sheetResponse.statusCode >= 400 || !sheetResponse.body?.success) {
      return res.status(sheetResponse.statusCode || 500).json(
        sheetResponse.body || {
          success: false,
          message: "Unable to load attendance eligibility for this date.",
        },
      );
    }

    const rows = Array.isArray(sheetResponse.body.rows)
      ? sheetResponse.body.rows
      : [];

    const eligibleRows = rows.flatMap((row) => {
      const student = row.student;
      const branchSchedule = row.branchSchedule;
      const eligible = (
        student?.status === "ACTIVE" &&
        !row.attendanceComplete &&
        !row.holiday &&
        !(branchSchedule?.configured === true && branchSchedule.isOpen === false)
      );
      if (!eligible) return [];
      const slots = (branchSchedule?.slots || []).filter((slot) => slot.entitled && slot.curriculumAvailable && slot.sessionTypeId && slot._id && !slot.attendance);
      return slots.length ? [{ row, sessionSlotId: slots[0]._id }] : [];
    });

    let marked = 0;
    let failed = 0;

    // Delegate each write to the established single-student handler so all
    // registration, branch access, plan, curriculum, schedule and duplicate
    // checks remain authoritative. Limit concurrency to avoid overwhelming
    // schedule and attendance queries on larger academies.
    let nextIndex = 0;
    const workerCount = Math.min(5, eligibleRows.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < eligibleRows.length) {
          const task = eligibleRows[nextIndex];
          const { row, sessionSlotId } = task;
          nextIndex += 1;

          const markResponse = {
            statusCode: 200,
            body: null,
            status(code) {
              this.statusCode = code;
              return this;
            },
            json(body) {
              this.body = body;
              return this;
            },
          };

          await markAttendance(
            {
              ...req,
              body: {
                student: row.student._id,
                sessionSlotId,
                date,
                status: "PRESENT",
                makeupRequired: false,
              },
            },
            markResponse,
          );

          if (markResponse.statusCode >= 200 && markResponse.statusCode < 300) {
            marked += 1;
          } else if (markResponse.statusCode >= 500) {
            failed += 1;
          }
        }
      }),
    );

    const skipped = Math.max(0, eligibleRows.length - marked - failed);

    return res.json({
      success: true,
      date,
      marked,
      skipped,
      failed,
      message:
        marked === 0
          ? "No sessions were marked. All eligible attendance is already completed or unavailable for this date."
          : `${marked} program sessions marked Present. ${skipped} eligible sessions skipped.`,
    });
  } catch (error) {
    console.error("Mark all attendance present error:", error);

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to mark eligible attendance"
          : error.message || "Failed to mark eligible attendance",
    });
  }
};

/* =========================================================
EXPORTS
========================================================= */

module.exports = {
  getAttendance,
  getMyAttendance,
  getAttendanceByStudent,
  getAttendanceById,
  getDailyAttendanceSheet,
  markAttendance,
  markAllAttendancePresent,
  undoAttendance,
};

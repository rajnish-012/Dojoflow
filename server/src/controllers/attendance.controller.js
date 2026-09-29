const mongoose = require("mongoose");

const Attendance = require("../models/Attendance");
const Makeup = require("../models/Makeup");
const Student = require("../models/Student");
const Branch = require("../models/Branch");
const Plan = require("../models/Plan");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");

const {
  getBranchDateAvailability,
  validateAttendanceDate,
} = require("../services/branchSchedule.service");

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
  */
  if (!["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
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
     */
    if (["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
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
    const studentId = linkedStudent?._id || req.user.student || req.user.studentId;

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
      .sort({
        date: 1,
      })
      .lean();

    return res.json({
      success: true,

      student,

      attendance,
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

    let branchId = branch || null;

    /*
     * Branch-restricted roles must use
     * their assigned branch.
     */
    if (["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
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
      .populate("plan", "name curriculum")
      .sort({
        name: 1,
      })
      .lean();

    /*
     * Existing attendance records for the
     * selected calendar date.
     */
    const { start, end } = getDateRange(requestedDate);

    const attendanceQuery = {
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

      if (!attendanceByStudent.has(key)) {
        attendanceByStudent.set(key, record);
      }
    });

    /*
     * Cache the centralized schedule service
     * per branch/date.
     */
    const scheduleCache = new Map();

    const holidayCache = new Map();

    const getCachedSchedule = async (currentBranchId) => {
      const key = currentBranchId.toString();

      if (scheduleCache.has(key)) {
        return scheduleCache.get(key);
      }

      const promise = getBranchScheduleForDate(currentBranchId, selectedDate);

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

        const attendance = attendanceByStudent.get(studentId) || null;

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

        const curriculum =
          student.plan?.curriculum?.find(
            (item) => Number(item.day) === Number(planDay),
          ) || null;

        return {
          student,
          attendance,
          planDay: Number(planDay),
          curriculum,
          holiday: holiday
            ? {
                _id: holiday._id,
                name: holiday.name,
                description: holiday.description || "",
                date: formatDate(holiday.date),
              }
            : null,
          branchSchedule,
          isHoliday: Boolean(holiday),
          isTrainingDay: Boolean(branchSchedule.isOpen && !holiday),
          isClosed: Boolean(branchSchedule.isClosed),
          status:
            attendance?.status ||
            (holiday
              ? "HOLIDAY"
              : branchSchedule.isClosed
                ? "CLOSED"
                : "UNMARKED"),
        };
      }),
    );

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
    const { student, date, status, makeupRequired = false } = req.body;

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

    const allowedStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

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

    const plan = await Plan.findById(studentRecord.plan);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Student plan not found",
      });
    }

    /* =====================================================
   EXACT-DATE DUPLICATE CHECK
===================================================== */

    const { start, end } = getDateRange(date);

    const existingAttendance = await Attendance.findOne({
      student,
      date: {
        $gte: start,
        $lte: end,
      },
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for this date",
        attendance: existingAttendance,
      });
    }

    /* =====================================================
   SERVER-CALCULATED TRAINING DAY
===================================================== */

    const calculatedPlanDay = await calculateTrainingDay(
      studentRecord._id,
      date,
    );

    if (
      !Number.isInteger(Number(calculatedPlanDay)) ||
      Number(calculatedPlanDay) < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Unable to calculate the training day for this attendance date",
      });
    }

    const normalizedPlanDay = Number(calculatedPlanDay);

    /* =====================================================
   CURRICULUM
===================================================== */

    const curriculumItem = Array.isArray(plan.curriculum)
      ? plan.curriculum.find((item) => Number(item.day) === normalizedPlanDay)
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

    const shouldCreateMakeup = status === "ABSENT" && makeupRequired === true;

    /* =====================================================
   CREATE ATTENDANCE
===================================================== */

    const attendanceDate = new Date(requestedDate);
    const attendance = await Attendance.create({
      student,
      branch: studentRecord.branch,
      date: attendanceDate,
      planDay: normalizedPlanDay,
      curriculumTitle: curriculumItem.title,
      status,
      markedBy: req.user._id,
      makeupRequired: shouldCreateMakeup,
      makeupCompleted: false,
    });

    /* =====================================================
   CREATE MAKEUP
===================================================== */

    let makeup = null;
    if (shouldCreateMakeup) {
      makeup = await Makeup.create({
        student,
        branch: studentRecord.branch,
        originalAttendance: attendance._id,
        planDay: normalizedPlanDay,
        originalDate: attendanceDate,
        makeupDate: null,
        status: "SCHEDULED",
        curriculumTitle: curriculumItem.title,
        markedBy: req.user._id,
      });
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
      branchSchedule: scheduleValidation.schedule,
    });
  } catch (error) {
    console.error("Mark attendance error:", error);

    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance already exists for this student and date",
      });
    }

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
EXPORTS
========================================================= */

module.exports = {
  getAttendance,
  getMyAttendance,
  getAttendanceByStudent,
  getAttendanceById,
  getDailyAttendanceSheet,
  markAttendance,
};

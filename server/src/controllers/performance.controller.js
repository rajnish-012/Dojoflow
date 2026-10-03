const mongoose = require("mongoose");

const Performance = require("../models/Performance");
const Student = require("../models/Student");
const Branch = require("../models/Branch");
const Attendance = require("../models/Attendance");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");

/* ==========================================
   USER SCOPE HELPERS
========================================== */

/**
 * Returns true when the authenticated user's
 * database Role restricts them to their branch.
 *
 * Authorization itself is handled by
 * permission.middleware.js.
 *
 * This helper only handles data visibility.
 */
const isBranchScopedUser = (user) => {
  if (!user) {
    return false;
  }

  if (String(user.role || "").toUpperCase() === "SUPER_ADMIN") {
    return false;
  }

  return String(user.dataScope || "").toUpperCase() === "BRANCH";
};

/* ==========================================
   COACH ASSIGNMENT HELPERS
========================================== */

/**
 * Coach assignment is a business/data restriction.
 *
 * A COACH can only access students actively assigned
 * to that coach.
 *
 * This is intentionally kept separate from the
 * database permission check.
 */
const getCoachStudentIds = async (req) => {
  if (String(req.user?.role || "").toUpperCase() !== "COACH") {
    return null;
  }

  const assignments = await CoachStudentAssignment.find({
    coach: req.user._id,
    status: "ACTIVE",
  }).select("student");

  return assignments.map((item) => item.student);
};

/**
 * Check whether a COACH has access to a student.
 *
 * Other roles return null because they are controlled
 * by permission + branch scope instead.
 */
const checkCoachStudentAccess = async (req, studentId) => {
  if (String(req.user?.role || "").toUpperCase() !== "COACH") {
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

/**
 * Check whether a branch-scoped user can access
 * the supplied branch.
 *
 * SUPER_ADMIN / ALL scope users are not restricted.
 */
const hasBranchAccess = (user, branchId) => {
  if (!isBranchScopedUser(user)) {
    return true;
  }

  if (!user.branch) {
    return false;
  }

  if (!branchId) {
    return false;
  }

  return branchId.toString() === user.branch.toString();
};

/* ==========================================
   GET ALL PERFORMANCE
========================================== */

const getPerformance = async (req, res) => {
  try {
    const filter = {};

    /*
     * COACH:
     * Only actively assigned students.
     */
    if (String(req.user?.role || "").toUpperCase() === "COACH") {
      const studentIds = await getCoachStudentIds(req);

      filter.student = {
        $in: Array.isArray(studentIds) ? studentIds : [],
      };
    }

    /*
     * DATABASE ROLE DATA SCOPE:
     *
     * Any custom role configured with BRANCH scope
     * is restricted to the authenticated user's branch.
     *
     * This replaces the previous hardcoded
     * BRANCH_ADMIN-only check.
     */
    if (isBranchScopedUser(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    const performance = await Performance.find(filter)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("evaluatedBy", "name email")
      .populate("sessionTypeId", "name")
      .sort({
        evaluationDate: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: performance.length,
      performance,
    });
  } catch (error) {
    console.error("Get performance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch performance records",
      performance: [],
    });
  }
};

/* ==========================================
   GET LOGGED-IN STUDENT PERFORMANCE
========================================== */

const getMyPerformance = async (req, res) => {
  try {
    const student = await Student.findOne({
      user: req.user._id,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
        performance: [],
      });
    }

    const performance = await Performance.find({
      student: student._id,
    })
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("evaluatedBy", "name email")
      .populate("sessionTypeId", "name")
      .sort({
        evaluationDate: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: performance.length,
      performance,
    });
  } catch (error) {
    console.error("Get my performance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your performance records",
      performance: [],
    });
  }
};

/* ==========================================
   GET PERFORMANCE BY STUDENT ID
========================================== */

const getPerformanceByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /*
     * COACH assignment restriction.
     */
    const coachAccessError = await checkCoachStudentAccess(req, student._id);

    if (coachAccessError) {
      return res.status(coachAccessError.status).json({
        success: false,
        message: coachAccessError.message,
      });
    }

    /*
     * Database Role branch-scope restriction.
     */
    if (isBranchScopedUser(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (!hasBranchAccess(req.user, student.branch)) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    const performance = await Performance.find({
      student: studentId,
    })
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("evaluatedBy", "name email")
      .populate("sessionTypeId", "name")
      .sort({
        evaluationDate: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: performance.length,
      performance,
    });
  } catch (error) {
    console.error("Get performance by student error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student performance",
      performance: [],
    });
  }
};

/* ==========================================
   GET PERFORMANCE BY ID
========================================== */

const getPerformanceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid performance ID",
      });
    }

    const performance = await Performance.findById(id)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("evaluatedBy", "name email")
      .populate("sessionTypeId", "name");

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found",
      });
    }

    /*
     * COACH assignment restriction.
     */
    const coachAccessError = await checkCoachStudentAccess(
      req,
      performance.student?._id,
    );

    if (coachAccessError) {
      return res.status(coachAccessError.status).json({
        success: false,
        message: "You do not have access to this performance record",
      });
    }

    /*
     * Database Role branch-scope restriction.
     */
    if (isBranchScopedUser(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (
        !performance.branch ||
        !hasBranchAccess(req.user, performance.branch._id)
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this performance record",
        });
      }
    }

    return res.status(200).json({
      success: true,
      performance,
    });
  } catch (error) {
    console.error("Get performance by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch performance record",
    });
  }
};

/* ==========================================
   CREATE PERFORMANCE RECORD
========================================== */

const createPerformance = async (req, res) => {
  try {
    const {
      student,
      attendanceId,
      skill,
      rating,
      remarks,
      evaluationDate,
    } = req.body;

    if (
      !student ||
      !attendanceId ||
      rating === undefined ||
      !evaluationDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "student, attendanceId, rating and evaluationDate are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(student)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) return res.status(400).json({ success: false, message: "Invalid attendance ID" });

    const numericRating = Number(rating);

    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    if (
      typeof evaluationDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(evaluationDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "evaluationDate must be in YYYY-MM-DD format",
      });
    }

    const studentRecord = await Student.findById(student);

    if (!studentRecord) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /*
     * COACH assignment restriction.
     *
     * This remains role-specific business logic,
     * not authorization.
     */
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

    /*
     * Database Role branch-scope restriction.
     *
     * This applies to BRANCH_ADMIN and custom roles
     * configured with dataScope = BRANCH.
     */
    if (isBranchScopedUser(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (!hasBranchAccess(req.user, studentRecord.branch)) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    const branch = await Branch.findById(studentRecord.branch);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Student branch not found",
      });
    }

    const parsedEvaluationDate = new Date(`${evaluationDate}T00:00:00`);

    if (Number.isNaN(parsedEvaluationDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid evaluation date",
      });
    }

    /*
     * A student can only be evaluated
     * for a training day for which
     * attendance was marked as PRESENT.
     */
    const attendanceForDay = await Attendance.findById(attendanceId);

    if (!attendanceForDay || String(attendanceForDay.student) !== String(studentRecord._id)) return res.status(404).json({ success: false, message: "The selected attendance record was not found for this student." });

    if (attendanceForDay.status !== "PRESENT") {
      return res.status(400).json({
        success: false,
        message: "Performance can only be evaluated for a present session.",
      });
    }

    if (!attendanceForDay.sessionTypeId) return res.status(409).json({ success: false, message: "This legacy attendance record is not linked to a program session and cannot receive a program-specific evaluation." });
    const skillName = typeof skill === "string" && skill.trim() ? skill.trim() : attendanceForDay.curriculumSkill || attendanceForDay.curriculumTitle;
    if (!skillName) return res.status(400).json({ success: false, message: "Skill is required." });
    const sessionDate = new Date(attendanceForDay.date); sessionDate.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (parsedEvaluationDate < sessionDate || parsedEvaluationDate > today) return res.status(400).json({ success: false, message: "Evaluation date must be on or after the attended session and cannot be in the future." });

    const performance = await Performance.create({
      student: studentRecord._id,
      branch: studentRecord.branch,
      attendance: attendanceForDay._id,
      enrollment: attendanceForDay.enrollment || null,
      plan: attendanceForDay.plan || studentRecord.plan,
      sessionTypeId: attendanceForDay.sessionTypeId,
      sessionSlotId: attendanceForDay.sessionSlotId || null,
      planDay: attendanceForDay.planDay,
      curriculumTitle: attendanceForDay.curriculumTitle,
      skill: skillName,
      rating: numericRating,
      remarks: remarks ? remarks.trim() : "",
      evaluatedBy: req.user._id,
      evaluationDate: parsedEvaluationDate,
    });

    const populatedPerformance = await Performance.findById(performance._id)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("evaluatedBy", "name email")
      .populate("sessionTypeId", "name");

    return res.status(201).json({
      success: true,
      message: "Performance recorded successfully",
      performance: populatedPerformance,
    });
  } catch (error) {
    console.error("Create performance error:", error);

    if (error?.code === 11000) return res.status(409).json({ success: false, message: "This skill has already been evaluated for the selected session." });

    return res.status(500).json({
      success: false,
      message: "Failed to record performance",
    });
  }
};

module.exports = {
  getPerformance,
  getMyPerformance,
  getPerformanceByStudent,
  getPerformanceById,
  createPerformance,
};

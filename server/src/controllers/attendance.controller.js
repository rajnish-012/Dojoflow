const mongoose = require("mongoose");

const Attendance = require("../models/Attendance");
const Makeup = require("../models/Makeup");
const Student = require("../models/Student");
const Branch = require("../models/Branch");
const Plan = require("../models/Plan");

// ==============================
// Helper: Check branch access
// ==============================
const checkBranchAccess = (req, studentBranch) => {
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

// ==============================
// Helper: Validate date format
// ==============================
const validateDateFormat = (date) => {
  if (typeof date !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00`);

  return !Number.isNaN(parsedDate.getTime());
};

// ==============================
// GET ALL ATTENDANCE
// ==============================
const getAttendance = async (req, res) => {
  try {
    const filter = {};

    // Branch Admins and Coaches can only see their own branch
    if (["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    // Filter by selected date
    if (req.query.date) {
      const selectedDate = String(req.query.date);

      if (!validateDateFormat(selectedDate)) {
        return res.status(400).json({
          success: false,
          message: "Date must be in YYYY-MM-DD format",
        });
      }

      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(`${selectedDate}T23:59:59.999`);

      filter.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const attendance = await Attendance.find(filter)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("markedBy", "name email")
      .sort({ date: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    console.error("Get attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
    });
  }
};

// ==============================
// GET LOGGED-IN STUDENT'S ATTENDANCE
// ==============================
const getMyAttendance = async (req, res) => {
  try {
    // Find the Student document connected to the logged-in User
    const student = await Student.findOne({
      user: req.user._id,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
        attendance: [],
      });
    }

    // Fetch only this student's attendance
    const attendance = await Attendance.find({
      student: student._id,
    })
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("markedBy", "name email")
      .sort({ date: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    console.error("Get my attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your attendance",
      attendance: [],
    });
  }
};

// ==============================
// GET ATTENDANCE BY STUDENT ID
// ==============================
const getAttendanceByStudent = async (req, res) => {
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

    // Branch-level access
    const branchAccessError = checkBranchAccess(req, student.branch);

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    const attendance = await Attendance.find({
      student: studentId,
    })
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("markedBy", "name email")
      .sort({ date: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    console.error("Get attendance by student error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student attendance",
      attendance: [],
    });
  }
};

// ==============================
// GET ATTENDANCE BY ID
// ==============================
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
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("markedBy", "name email");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Branch-level access
    if (["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (
        !attendance.branch ||
        attendance.branch._id.toString() !== req.user.branch.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this attendance record",
        });
      }
    }

    return res.status(200).json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error("Get attendance by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance record",
    });
  }
};

// ==============================
// MARK ATTENDANCE
// ==============================
const markAttendance = async (req, res) => {
  try {
    const {
      student,
      date,
      planDay,
      curriculumTitle,
      status,
      makeupRequired,
    } = req.body;

    // ==============================
    // Basic validation
    // ==============================
    if (!student || !date || planDay === undefined || !status) {
      return res.status(400).json({
        success: false,
        message: "student, date, planDay and status are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(student)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    if (!["PRESENT", "ABSENT"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be PRESENT or ABSENT",
      });
    }

    if (!validateDateFormat(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format",
      });
    }

    if (!Number.isInteger(Number(planDay)) || Number(planDay) < 1) {
      return res.status(400).json({
        success: false,
        message: "planDay must be a positive integer",
      });
    }

    const normalizedPlanDay = Number(planDay);

    // ==============================
    // Find student
    // ==============================
    const studentRecord = await Student.findById(student);

    if (!studentRecord) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // ==============================
    // Prevent attendance before registration
    // ==============================
    const registrationDate = new Date(studentRecord.registrationDate);
    const selectedAttendanceDate = new Date(`${date}T00:00:00`);

    // Compare calendar dates only
    registrationDate.setHours(0, 0, 0, 0);

    if (selectedAttendanceDate < registrationDate) {
      return res.status(400).json({
        success: false,
        message: `Attendance cannot be marked before the student's registration date (${
          registrationDate.toISOString().split("T")[0]
        }).`,
      });
    }

    // ==============================
    // Branch-level access
    // ==============================
    const branchAccessError = checkBranchAccess(
      req,
      studentRecord.branch
    );

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    // ==============================
    // Validate branch
    // ==============================
    const branch = await Branch.findById(studentRecord.branch);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Student branch not found",
      });
    }

    // ==============================
    // Validate student plan
    // ==============================
    const plan = await Plan.findById(studentRecord.plan);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Student plan not found",
      });
    }

    const attendanceDate = new Date(`${date}T00:00:00`);

    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59.999`);

    // ==============================
    // Prevent duplicate attendance
    // for the same student/date
    // ==============================
    const existingAttendance = await Attendance.findOne({
      student,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for this date",
      });
    }

    // ==============================
    // Allow a new student to start
    // directly from any training day
    // ==============================
    const hasAnyAttendance = await Attendance.exists({
      student,
    });

    // ==============================
    // Prevent skipping training days
    // only after the first attendance
    // ==============================
    if (hasAnyAttendance && normalizedPlanDay > 1) {
      const previousTrainingDay = await Attendance.findOne({
        student,
        planDay: normalizedPlanDay - 1,
      });

      if (!previousTrainingDay) {
        return res.status(400).json({
          success: false,
          message: `Please mark attendance for training Day ${
            normalizedPlanDay - 1
          } before marking Day ${normalizedPlanDay}.`,
        });
      }
    }

    // ==============================
    // Prevent duplicate attendance
    // for the same student/training day
    // ==============================
    const existingTrainingDayAttendance = await Attendance.findOne({
      student,
      planDay: normalizedPlanDay,
    });

    if (existingTrainingDayAttendance) {
      return res.status(409).json({
        success: false,
        message: `Attendance for training Day ${normalizedPlanDay} has already been marked for this student.`,
      });
    }

    // ==============================
    // Makeup logic
    // ==============================
    const shouldCreateMakeup =
      status === "ABSENT" && makeupRequired === true;

    // ==============================
    // Create attendance
    // ==============================
    const attendance = await Attendance.create({
      student,
      branch: studentRecord.branch,
      date: attendanceDate,
      planDay: normalizedPlanDay,
      curriculumTitle: curriculumTitle
        ? String(curriculumTitle).trim()
        : "",
      status,
      markedBy: req.user._id,
      makeupRequired: shouldCreateMakeup,
      makeupCompleted: false,
    });

    let makeup = null;

    // ==============================
    // Create makeup record if needed
    // ==============================
    if (shouldCreateMakeup) {
      makeup = await Makeup.create({
        student,
        branch: studentRecord.branch,
        originalAttendance: attendance._id,
        planDay: normalizedPlanDay,
        originalDate: attendanceDate,
        makeupDate: null,
        status: "SCHEDULED",
        curriculumTitle: curriculumTitle
          ? String(curriculumTitle).trim()
          : "",
        markedBy: req.user._id,
      });
    }

    // ==============================
    // Populate created attendance
    // ==============================
    const populatedAttendance = await Attendance.findById(
      attendance._id
    )
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
    });
  } catch (error) {
    console.error("Mark attendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to mark attendance",
    });
  }
};

module.exports = {
  getAttendance,
  getMyAttendance,
  getAttendanceByStudent,
  getAttendanceById,
  markAttendance,
};
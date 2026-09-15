const mongoose = require("mongoose");

const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Branch = require("../models/Branch");
const Plan = require("../models/Plan");

// ==============================
// GET ALL ATTENDANCE
// ==============================
const getAttendance = async (req, res) => {
  try {
    const filter = {};

    // Branch admin can only see their branch
    if (req.user.role === "BRANCH_ADMIN") {
      filter.branch = req.user.branch;
    }

    // Coach can only see their branch
    if (req.user.role === "COACH") {
      filter.branch = req.user.branch;
    }

    // Filter by selected date
    if (req.query.date) {
      const selectedDate = String(req.query.date);

      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(`${selectedDate}T23:59:59.999`);

      if (
        Number.isNaN(startOfDay.getTime()) ||
        Number.isNaN(endOfDay.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }

      filter.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const attendance = await Attendance.find(filter)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("markedBy", "name email")
      .sort({ date: -1 });

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

    // Fetch attendance using the Student ID
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
    if (
      ["BRANCH_ADMIN", "COACH"].includes(req.user.role) &&
      attendance.branch &&
      req.user.branch &&
      attendance.branch._id.toString() !==
        req.user.branch.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this attendance record",
      });
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
      makeupCompleted,
    } = req.body;

    if (
      !student ||
      !date ||
      planDay === undefined ||
      !status
    ) {
      return res.status(400).json({
        success: false,
        message:
          "student, date, planDay and status are required",
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

    const studentRecord = await Student.findById(student);

    if (!studentRecord) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Branch-level access
    if (
      ["BRANCH_ADMIN", "COACH"].includes(req.user.role) &&
      req.user.branch &&
      studentRecord.branch.toString() !==
        req.user.branch.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    const branch = await Branch.findById(studentRecord.branch);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Student branch not found",
      });
    }

    const plan = await Plan.findById(studentRecord.plan);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Student plan not found",
      });
    }

    // Validate attendance date
    const attendanceDate = new Date(date);

    if (Number.isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date",
      });
    }

    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59.999`);

    // Prevent duplicate attendance for same student/date
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

    const attendance = await Attendance.create({
      student,
      branch: studentRecord.branch,
      date: attendanceDate,
      planDay,
      curriculumTitle: curriculumTitle
        ? curriculumTitle.trim()
        : "",
      status,
      markedBy: req.user._id,
      makeupRequired:
        makeupRequired !== undefined
          ? makeupRequired
          : status === "ABSENT",
      makeupCompleted: makeupCompleted || false,
    });

    const populatedAttendance = await Attendance.findById(
      attendance._id
    )
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("markedBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      attendance: populatedAttendance,
    });
  } catch (error) {
    console.error("Mark attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark attendance",
    });
  }
};

module.exports = {
  getAttendance,
  getMyAttendance,
  getAttendanceById,
  markAttendance,
};
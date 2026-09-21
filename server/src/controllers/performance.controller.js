const mongoose = require("mongoose");

const { isBranchScoped } = require("../utils/access");
const Performance = require("../models/Performance");
const Student = require("../models/Student");
const Branch = require("../models/Branch");
const Attendance = require("../models/Attendance");

// ==============================
// GET ALL PERFORMANCE RECORDS
// ==============================
const getPerformance = async (req, res) => {
  try {
    const filter = {};

    // Branch admins and coaches can only see
    // performance records from their assigned branch
    if (isBranchScoped(req.user)) {
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
      .sort({ evaluationDate: -1, createdAt: -1 });

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

// ==============================
// GET LOGGED-IN STUDENT'S PERFORMANCE
// ==============================
const getMyPerformance = async (req, res) => {
  try {
    // Find the Student document connected
    // to the logged-in User
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
      .sort({ evaluationDate: -1, createdAt: -1 });

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

// ==============================
// GET PERFORMANCE BY STUDENT ID
// ==============================
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

    // Branch admins and coaches can only access
    // students from their assigned branch
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (
        !student.branch ||
        student.branch.toString() !== req.user.branch.toString()
      ) {
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
      .sort({ evaluationDate: -1, createdAt: -1 });

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

// ==============================
// GET PERFORMANCE BY ID
// ==============================
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
      .populate("evaluatedBy", "name email");

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found",
      });
    }

    // Branch admins and coaches can only access
    // performance records from their assigned branch
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (
        !performance.branch ||
        performance.branch._id.toString() !==
          req.user.branch.toString()
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

// ==============================
// CREATE PERFORMANCE RECORD
// ==============================
const createPerformance = async (req, res) => {
  try {
    const {
      student,
      planDay,
      curriculumTitle,
      skill,
      rating,
      remarks,
      evaluationDate,
    } = req.body;

    if (
      !student ||
      planDay === undefined ||
      !curriculumTitle ||
      !skill ||
      rating === undefined ||
      !evaluationDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "student, planDay, curriculumTitle, skill, rating and evaluationDate are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(student)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    // Validate plan day
    if (
      !Number.isInteger(Number(planDay)) ||
      Number(planDay) < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "planDay must be a positive integer",
      });
    }

    // Validate rating
    const numericRating = Number(rating);

    if (
      Number.isNaN(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Validate evaluation date format
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

    // Branch admins and coaches can only create
    // performance records for their own branch
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (
        !studentRecord.branch ||
        studentRecord.branch.toString() !==
          req.user.branch.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    // Verify that the student's branch exists
    const branch = await Branch.findById(studentRecord.branch);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Student branch not found",
      });
    }

    const parsedEvaluationDate = new Date(
      `${evaluationDate}T00:00:00`
    );

    if (Number.isNaN(parsedEvaluationDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid evaluation date",
      });
    }

    // ==============================
    // A student can only be evaluated for a
    // training day they were actually present for
    // ==============================
    const attendanceForDay = await Attendance.findOne({
      student: studentRecord._id,
      planDay: Number(planDay),
    });

    if (!attendanceForDay) {
      return res.status(400).json({
        success: false,
        message: `Attendance has not been marked for Day ${planDay}. Mark attendance before submitting a performance evaluation.`,
      });
    }

    if (attendanceForDay.status !== "PRESENT") {
      return res.status(400).json({
        success: false,
        message: `This student was marked absent for Day ${planDay} and cannot be evaluated for that day.`,
      });
    }

    const performance = await Performance.create({
      student: studentRecord._id,
      branch: studentRecord.branch,
      planDay: Number(planDay),
      curriculumTitle: curriculumTitle.trim(),
      skill: skill.trim(),
      rating: numericRating,
      remarks: remarks ? remarks.trim() : "",
      evaluatedBy: req.user._id,
      evaluationDate: parsedEvaluationDate,
    });

    const populatedPerformance = await Performance.findById(
      performance._id
    )
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate("evaluatedBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Performance recorded successfully",
      performance: populatedPerformance,
    });
  } catch (error) {
    console.error("Create performance error:", error);

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
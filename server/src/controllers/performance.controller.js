const mongoose = require("mongoose");

const Performance = require("../models/Performance");
const Student = require("../models/Student");
const Branch = require("../models/Branch");

// ==============================
// GET ALL PERFORMANCE RECORDS
// ==============================
const getPerformance = async (req, res) => {
  try {
    const filter = {};

    // Branch-level access
    if (["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
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
    // Find the Student document connected to the logged-in User
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

    // Find performance records using the Student ID
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

    // Branch-level access
    if (["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
      if (
        !performance.branch ||
        !req.user.branch ||
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

    const studentRecord = await Student.findById(student);

    if (!studentRecord) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Branch-level access
    if (["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
      if (
        !req.user.branch ||
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

    const branch = await Branch.findById(studentRecord.branch);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Student branch not found",
      });
    }

    const parsedEvaluationDate = new Date(evaluationDate);

    if (Number.isNaN(parsedEvaluationDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid evaluation date",
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
  getPerformanceById,
  createPerformance,
};
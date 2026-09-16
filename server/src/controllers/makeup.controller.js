const mongoose = require("mongoose");

const Makeup = require("../models/Makeup");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Branch = require("../models/Branch");

// ==============================
// Helper: Branch access validation
// ==============================
const checkBranchAccess = (req, branchId) => {
  if (!["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
    return null;
  }

  if (!req.user.branch) {
    return {
      status: 403,
      message: "No branch is assigned to this account",
    };
  }

  if (!branchId || branchId.toString() !== req.user.branch.toString()) {
    return {
      status: 403,
      message: "You do not have access to this branch",
    };
  }

  return null;
};

// ==============================
// Helper: Validate date format
// ==============================
const isValidDateFormat = (date) => {
  return (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(new Date(`${date}T00:00:00`).getTime())
  );
};

// ==============================
// GET ALL MAKEUPS
// ==============================
const getMakeups = async (req, res) => {
  try {
    const filter = {};

    // Branch-level filtering
    if (["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    // Optional status filter
    if (req.query.status) {
      const allowedStatuses = [
        "SCHEDULED",
        "COMPLETED",
        "CANCELLED",
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid makeup status",
        });
      }

      filter.status = req.query.status;
    }

    // Optional student filter
    if (req.query.studentId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.studentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid student ID",
        });
      }

      filter.student = req.query.studentId;
    }

    const makeups = await Makeup.find(filter)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate(
        "originalAttendance",
        "date planDay status curriculumTitle"
      )
      .populate("markedBy", "name email")
      .populate("completedBy", "name email")
      .sort({ makeupDate: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: makeups.length,
      makeups,
    });
  } catch (error) {
    console.error("Get makeups error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch makeups",
    });
  }
};

// ==============================
// GET MAKEUP BY ID
// ==============================
const getMakeupById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid makeup ID",
      });
    }

    const makeup = await Makeup.findById(id)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate(
        "originalAttendance",
        "date planDay status curriculumTitle"
      )
      .populate("markedBy", "name email")
      .populate("completedBy", "name email");

    if (!makeup) {
      return res.status(404).json({
        success: false,
        message: "Makeup record not found",
      });
    }

    const branchAccessError = checkBranchAccess(req, makeup.branch?._id);

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
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
      message: "Failed to fetch makeup record",
    });
  }
};

// ==============================
// CREATE / SCHEDULE MAKEUP
// ==============================
const createMakeup = async (req, res) => {
  try {
    const {
      student,
      originalAttendance,
      makeupDate,
      curriculumTitle,
      notes,
    } = req.body;

    if (!student || !originalAttendance || !makeupDate) {
      return res.status(400).json({
        success: false,
        message:
          "student, originalAttendance and makeupDate are required",
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

    if (!isValidDateFormat(makeupDate)) {
      return res.status(400).json({
        success: false,
        message: "makeupDate must be in YYYY-MM-DD format",
      });
    }

    const studentRecord = await Student.findById(student);

    if (!studentRecord) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

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

    const branch = await Branch.findById(studentRecord.branch);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Student branch not found",
      });
    }

    const attendance = await Attendance.findById(originalAttendance);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Original attendance record not found",
      });
    }

    // Ensure the attendance belongs to the selected student
    if (attendance.student.toString() !== studentRecord._id.toString()) {
      return res.status(400).json({
        success: false,
        message:
          "Original attendance does not belong to this student",
      });
    }

    // Ensure attendance belongs to the same branch
    if (
      attendance.branch &&
      attendance.branch.toString() !== studentRecord.branch.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "Attendance and student branch do not match",
      });
    }

    // Only absences can receive makeup
    if (attendance.status !== "ABSENT") {
      return res.status(400).json({
        success: false,
        message: "Makeup can only be scheduled for absent attendance",
      });
    }

    if (attendance.makeupCompleted) {
      return res.status(400).json({
        success: false,
        message: "Makeup is already completed for this absence",
      });
    }

    const originalDate = new Date(attendance.date);
    const scheduledMakeupDate = new Date(`${makeupDate}T00:00:00`);

    // Makeup cannot be before the original class
    if (scheduledMakeupDate < originalDate) {
      return res.status(400).json({
        success: false,
        message:
          "Makeup date cannot be earlier than the original attendance date",
      });
    }

    // Prevent multiple active makeups for the same absence
    const existingMakeup = await Makeup.findOne({
      originalAttendance,
      status: {
        $in: ["SCHEDULED", "COMPLETED"],
      },
    });

    if (existingMakeup) {
      return res.status(409).json({
        success: false,
        message:
          "A makeup already exists for this attendance record",
      });
    }

    const makeup = await Makeup.create({
      student: studentRecord._id,
      branch: studentRecord.branch,
      originalAttendance: attendance._id,
      planDay: attendance.planDay,
      originalDate: attendance.date,
      makeupDate: scheduledMakeupDate,
      status: "SCHEDULED",
      curriculumTitle: curriculumTitle
        ? String(curriculumTitle).trim()
        : attendance.curriculumTitle || "",
      markedBy: req.user._id,
      notes: notes ? String(notes).trim() : "",
    });

    const populatedMakeup = await Makeup.findById(makeup._id)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate(
        "originalAttendance",
        "date planDay status curriculumTitle"
      )
      .populate("markedBy", "name email")
      .populate("completedBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Makeup scheduled successfully",
      makeup: populatedMakeup,
    });
  } catch (error) {
    console.error("Create makeup error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to schedule makeup",
    });
  }
};

// ==============================
// COMPLETE MAKEUP
// ==============================
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
        message: "Makeup record not found",
      });
    }

    const branchAccessError = checkBranchAccess(
      req,
      makeup.branch
    );

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    if (makeup.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Makeup is already completed",
      });
    }

    if (makeup.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cancelled makeup cannot be completed",
      });
    }

    makeup.status = "COMPLETED";
    makeup.completedBy = req.user._id;
    makeup.completedAt = new Date();

    await makeup.save();

    // Update the original absence
    await Attendance.findByIdAndUpdate(
      makeup.originalAttendance,
      {
        makeupCompleted: true,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    const populatedMakeup = await Makeup.findById(makeup._id)
      .populate("student", "name age phone currentBelt status")
      .populate("branch", "name address")
      .populate(
        "originalAttendance",
        "date planDay status curriculumTitle"
      )
      .populate("markedBy", "name email")
      .populate("completedBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Makeup completed successfully",
      makeup: populatedMakeup,
    });
  } catch (error) {
    console.error("Complete makeup error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to complete makeup",
    });
  }
};

// ==============================
// CANCEL MAKEUP
// ==============================
const cancelMakeup = async (req, res) => {
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
        message: "Makeup record not found",
      });
    }

    const branchAccessError = checkBranchAccess(
      req,
      makeup.branch
    );

    if (branchAccessError) {
      return res.status(branchAccessError.status).json({
        success: false,
        message: branchAccessError.message,
      });
    }

    if (makeup.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Completed makeup cannot be cancelled",
      });
    }

    if (makeup.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Makeup is already cancelled",
      });
    }

    makeup.status = "CANCELLED";

    await makeup.save();

    return res.status(200).json({
      success: true,
      message: "Makeup cancelled successfully",
      makeup,
    });
  } catch (error) {
    console.error("Cancel makeup error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel makeup",
    });
  }
};

module.exports = {
  getMakeups,
  getMakeupById,
  createMakeup,
  completeMakeup,
  cancelMakeup,
};
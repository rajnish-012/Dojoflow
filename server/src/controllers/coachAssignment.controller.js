const mongoose = require("mongoose");

const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const User = require("../models/User");
const Student = require("../models/Student");
const { isBranchScoped } = require("../utils/access");

const checkBranchAccess = (req, branchId) => {
  if (!isBranchScoped(req.user)) {
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

/* =========================================================
   GET COACHES
========================================================= */

const getCoaches = async (req, res) => {
  try {
    const filter = {
      role: "COACH",
    };

    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    const coaches = await User.find(filter)
      .populate("branch", "name")
      .select("name email role branch")
      .sort({
        name: 1,
      });

    return res.status(200).json({
      success: true,
      count: coaches.length,
      coaches,
    });
  } catch (error) {
    console.error("Get coaches error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch coaches",
    });
  }
};

/* =========================================================
   GET ASSIGNMENTS
========================================================= */

const getAssignments = async (req, res) => {
  try {
    const filter = {};

    if (req.query.coach) {
      if (!mongoose.isValidObjectId(req.query.coach)) {
        return res.status(400).json({
          success: false,
          message: "Invalid coach ID",
        });
      }

      filter.coach = req.query.coach;
    }

    if (req.query.student) {
      if (!mongoose.isValidObjectId(req.query.student)) {
        return res.status(400).json({
          success: false,
          message: "Invalid student ID",
        });
      }

      filter.student = req.query.student;
    }

    filter.status = String(req.query.status || "ACTIVE").toUpperCase();

    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    const assignments = await CoachStudentAssignment.find(filter)
      .populate("coach", "name email role branch")
      .populate("student", "name age phone currentBelt status branch plan")
      .populate("branch", "name")
      .populate("assignedBy", "name email")
      .sort({
        assignedAt: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("Get coach assignments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch coach assignments",
    });
  }
};

/* =========================================================
   CREATE ASSIGNMENT
========================================================= */

const createAssignment = async (req, res) => {
  try {
    const { coach, student, note = "" } = req.body;

    if (!coach || !student) {
      return res.status(400).json({
        success: false,
        message: "Coach and student are required",
      });
    }

    if (
      !mongoose.isValidObjectId(coach) ||
      !mongoose.isValidObjectId(student)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid coach or student ID",
      });
    }

    const coachUser = await User.findOne({
      _id: coach,
      role: "COACH",
    });

    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

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

    const branchError = checkBranchAccess(req, studentRecord.branch);

    if (branchError) {
      return res.status(branchError.status).json({
        success: false,
        message: branchError.message,
      });
    }

    if (
      !coachUser.branch ||
      coachUser.branch.toString() !== studentRecord.branch.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "Coach and student must belong to the same branch",
      });
    }

    const existing = await CoachStudentAssignment.findOne({
      coach,
      student,
      status: "ACTIVE",
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This student is already assigned to this coach",
        assignment: existing,
      });
    }

    const assignment = await CoachStudentAssignment.create({
      coach,
      student,
      branch: studentRecord.branch,
      assignedBy: req.user._id,
      status: "ACTIVE",
      assignedAt: new Date(),
      note: String(note || "").trim(),
    });

    const populated = await CoachStudentAssignment.findById(assignment._id)
      .populate("coach", "name email role branch")
      .populate("student", "name age phone currentBelt status branch plan")
      .populate("branch", "name")
      .populate("assignedBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Student assigned to coach successfully",
      assignment: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This student is already assigned to this coach",
      });
    }

    console.error("Create coach assignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign student to coach",
    });
  }
};

/* =========================================================
   UNASSIGN
========================================================= */

const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID",
      });
    }

    const assignment = await CoachStudentAssignment.findById(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    const branchError = checkBranchAccess(req, assignment.branch);

    if (branchError) {
      return res.status(branchError.status).json({
        success: false,
        message: branchError.message,
      });
    }

    if (assignment.status === "INACTIVE") {
      return res.status(200).json({
        success: true,
        message: "Assignment is already inactive",
        assignment,
      });
    }

    assignment.status = "INACTIVE";
    assignment.unassignedAt = new Date();

    await assignment.save();

    return res.status(200).json({
      success: true,
      message: "Student unassigned from coach successfully",
      assignment,
    });
  } catch (error) {
    console.error("Delete coach assignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to unassign student",
    });
  }
};

/* =========================================================
   COACH'S OWN STUDENTS
========================================================= */

const getMyAssignedStudents = async (req, res) => {
  try {
    const assignments = await CoachStudentAssignment.find({
      coach: req.user._id,
      status: "ACTIVE",
    })
      .populate(
        "student",
        "name age phone email currentBelt status branch plan",
      )
      .populate("branch", "name")
      .sort({
        createdAt: -1,
      });

    const students = assignments
      .map((assignment) => assignment.student)
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
      assignments,
    });
  } catch (error) {
    console.error("Get my assigned students error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned students",
    });
  }
};

module.exports = {
  getCoaches,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getMyAssignedStudents,
};

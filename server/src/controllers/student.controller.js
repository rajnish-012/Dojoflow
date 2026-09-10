const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Student = require("../models/Student");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Branch = require("../models/Branch");

// ==============================
// GET ALL STUDENTS
// ==============================
const getStudents = async (req, res) => {
  try {
    const filter = {};

    // Branch Admins and Coaches only see their branch
    if (
      req.user.role === "BRANCH_ADMIN" ||
      req.user.role === "COACH"
    ) {
      filter.branch = req.user.branch;
    }

    const students = await Student.find(filter)
      .populate("branch", "name address")
      .populate(
        "plan",
        "name price duration startingBelt"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Get students error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch students",
    });
  }
};

// ==============================
// GET SINGLE STUDENT
// ==============================
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(id)
      .populate("branch", "name address")
      .populate("plan");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Branch-level access
    if (
      req.user.role !== "SUPER_ADMIN" &&
      student.branch._id.toString() !==
        req.user.branch?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Get student error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch student",
    });
  }
};

// ==============================
// GET LOGGED-IN STUDENT
// ==============================
const getMyStudentProfile = async (req, res) => {
  try {
    // Only student accounts can use this endpoint
    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only for students",
      });
    }

    const student = await Student.findOne({
      user: req.user._id,
    })
      .populate("branch", "name address")
      .populate("plan");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error(
      "Get my student profile error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch student profile",
    });
  }
};

// ==============================
// CREATE STUDENT
// ==============================
const createStudent = async (req, res) => {
  let createdUser = null;

  try {
    const {
      name,
      age,
      phone,
      email,
      loginEmail,
      loginPassword,
      branch,
      plan,
      joinDate,
    } = req.body;

    // Required fields
    if (
      !name ||
      !age ||
      !phone ||
      !branch ||
      !plan ||
      !loginEmail ||
      !loginPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, age, phone, branch, plan, login email and login password are required",
      });
    }

    // Password validation
    if (loginPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Student login password must be at least 6 characters",
      });
    }

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(branch) ||
      !mongoose.Types.ObjectId.isValid(plan)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch or plan ID",
      });
    }

    // Branch Admin can only create students in own branch
    if (
      req.user.role === "BRANCH_ADMIN" &&
      req.user.branch?.toString() !== branch
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only add students to your branch",
      });
    }

    // Check branch
    const selectedBranch = await Branch.findById(branch);

    if (!selectedBranch) {
      return res.status(404).json({
        success: false,
        message: "Selected branch not found",
      });
    }

    // Check plan
    const selectedPlan = await Plan.findById(plan);

    if (!selectedPlan) {
      return res.status(404).json({
        success: false,
        message: "Selected plan not found",
      });
    }

    if (!selectedPlan.isActive) {
      return res.status(400).json({
        success: false,
        message: "Selected plan is inactive",
      });
    }

    // Check login email
    const normalizedLoginEmail =
      loginEmail.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedLoginEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "A user account with this login email already exists",
      });
    }

    // Check whether another student already uses this login email
    const existingStudent = await Student.findOne({
      email: normalizedLoginEmail,
    });

    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message:
          "A student already exists with this email",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      loginPassword,
      10
    );

    // Create student User account
    createdUser = await User.create({
      name: name.trim(),
      email: normalizedLoginEmail,
      password: hashedPassword,
      role: "STUDENT",
      branch,
    });

    // Create Student profile
    const student = await Student.create({
      user: createdUser._id,
      name: name.trim(),
      age: Number(age),
      phone: phone.trim(),
      email: email
        ? email.trim().toLowerCase()
        : undefined,
      branch,
      plan,
      joinDate: joinDate || new Date(),
      currentBelt:
        selectedPlan.startingBelt || "White",
      status: "ACTIVE",
    });

    const populatedStudent = await Student.findById(
      student._id
    )
      .populate("branch", "name address")
      .populate(
        "plan",
        "name price duration startingBelt"
      );

    res.status(201).json({
      success: true,
      message:
        "Student admitted and login account created successfully",
      student: populatedStudent,
    });
  } catch (error) {
    console.error("Create student error:", error);

    // Prevent orphan User account if Student creation fails
    if (createdUser) {
      try {
        await User.findByIdAndDelete(
          createdUser._id
        );
      } catch (cleanupError) {
        console.error(
          "Failed to cleanup student user:",
          cleanupError
        );
      }
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A user or student with this email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create student",
    });
  }
};

// ==============================
// UPDATE STUDENT
// ==============================
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Branch-level access
    if (
      req.user.role !== "SUPER_ADMIN" &&
      student.branch.toString() !==
        req.user.branch?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    const allowedFields = [
      "name",
      "age",
      "phone",
      "email",
      "plan",
      "currentBelt",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        student[field] = req.body[field];
      }
    });

    await student.save();

    const updatedStudent = await Student.findById(id)
      .populate("branch", "name address")
      .populate(
        "plan",
        "name price duration startingBelt"
      );

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Update student error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update student",
    });
  }
};

// ==============================
// DELETE STUDENT
// ==============================
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Only Super Admin can delete
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Only Super Admin can delete students",
      });
    }

    // Delete linked student login account too
    if (student.user) {
      await User.findByIdAndDelete(student.user);
    }

    await Student.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message:
        "Student and linked login account deleted successfully",
    });
  } catch (error) {
    console.error("Delete student error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete student",
    });
  }
};

module.exports = {
  getStudents,
  getStudentById,
  getMyStudentProfile,
  createStudent,
  updateStudent,
  deleteStudent,
};
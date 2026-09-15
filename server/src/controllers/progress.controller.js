const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Student = require("../models/Student");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");

// ==============================
// GET ALL STUDENTS
// ==============================

const getStudents = async (req, res) => {
  try {
    const filter = {};

    // Branch admins and coaches can only see students
    // belonging to their own branch
    if (
      ["BRANCH_ADMIN", "COACH"].includes(req.user.role) &&
      req.user.branch
    ) {
      filter.branch = req.user.branch;
    }

    const students = await Student.find(filter)
      .populate("user", "name email role")
      .populate("branch", "name address")
      .populate("plan")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch students",
    });
  }
};

// ==============================
// GET STUDENT BY ID
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
      .populate("user", "name email role")
      .populate("branch", "name address")
      .populate("plan");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Branch admins and coaches can only access
    // students from their own branch
    if (
      ["BRANCH_ADMIN", "COACH"].includes(req.user.role) &&
      req.user.branch
    ) {
      if (
        !student.branch ||
        student.branch._id.toString() !== req.user.branch.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Get student error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student",
    });
  }
};

// ==============================
// GET STUDENT'S OWN PROFILE
// ==============================

const getMyStudentProfile = async (req, res) => {
  try {
    const student = await Student.findOne({
      user: req.user._id,
    })
      .populate("user", "name email role")
      .populate("branch", "name address")
      .populate("plan");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Get my student profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your student profile",
    });
  }
};

// ==============================
// CREATE STUDENT
// ==============================

const createStudent = async (req, res) => {
  try {
    const {
      name,
      age,
      phone,
      email,
      branch,
      plan,
      joinDate,
      currentBelt,
      status,
      user,
    } = req.body;

    if (!name || !age || !phone || !branch || !plan) {
      return res.status(400).json({
        success: false,
        message: "Name, age, phone, branch and plan are required",
      });
    }

    // Branch admins can only create students in their own branch
    if (
      req.user.role === "BRANCH_ADMIN" &&
      req.user.branch &&
      branch.toString() !== req.user.branch.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only create students in your own branch",
      });
    }

    const student = await Student.create({
      name: name.trim(),
      age,
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : "",
      branch,
      plan,
      joinDate: joinDate || Date.now(),
      currentBelt: currentBelt || "White",
      status: status || "ACTIVE",
      user: user || null,
    });

    const populatedStudent = await Student.findById(student._id)
      .populate("user", "name email role")
      .populate("branch", "name address")
      .populate("plan");

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      student: populatedStudent,
    });
  } catch (error) {
    console.error("Create student error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create student",
    });
  }
};

// ==============================
// UPDATE STUDENT
// Includes linked login password
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

    const {
      name,
      age,
      phone,
      email,
      branch,
      plan,
      joinDate,
      currentBelt,
      status,
      password,
    } = req.body;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Branch admins can only update students
    // belonging to their own branch
    if (req.user.role === "BRANCH_ADMIN") {
      if (
        !req.user.branch ||
        student.branch.toString() !== req.user.branch.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }

      // A branch admin cannot move a student
      // to another branch
      if (
        branch !== undefined &&
        branch.toString() !== req.user.branch.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot assign this student to another branch",
        });
      }
    }

    // Update student fields only when provided
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Student name cannot be empty",
        });
      }

      student.name = name.trim();
    }

    if (age !== undefined) {
      student.age = age;
    }

    if (phone !== undefined) {
      student.phone = phone.trim();
    }

    if (email !== undefined) {
      student.email = email
        ? email.trim().toLowerCase()
        : "";
    }

    if (branch !== undefined) {
      student.branch = branch;
    }

    if (plan !== undefined) {
      student.plan = plan;
    }

    if (joinDate !== undefined) {
      student.joinDate = joinDate;
    }

    if (currentBelt !== undefined) {
      student.currentBelt = currentBelt.trim();
    }

    if (status !== undefined) {
      student.status = status;
    }

    await student.save();

    // ==============================
    // UPDATE LINKED USER ACCOUNT
    // ==============================

    if (student.user) {
      const user = await User.findById(student.user);

      if (user) {
        if (name !== undefined && name.trim()) {
          user.name = name.trim();
        }

        if (email !== undefined && email.trim()) {
          user.email = email.trim().toLowerCase();
        }

        // Password is optional.
        // Empty password means keep the existing password.
        if (password && password.trim().length > 0) {
          user.password = await bcrypt.hash(
            password.trim(),
            10
          );
        }

        await user.save();
      }
    }

    const updatedStudent = await Student.findById(id)
      .populate("user", "name email role")
      .populate("branch", "name address")
      .populate("plan");

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Update student error:", error);

    return res.status(500).json({
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

    await Student.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Delete student error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete student",
    });
  }
};

// ==============================
// GET STUDENT PROGRESS
// ==============================

const getStudentProgress = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(studentId)
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
      ["BRANCH_ADMIN", "COACH"].includes(req.user.role) &&
      req.user.branch &&
      student.branch &&
      student.branch._id.toString() !== req.user.branch.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    const attendance = await Attendance.find({
      student: studentId,
    }).sort({ date: 1 });

    const performance = await Performance.find({
      student: studentId,
    }).sort({ evaluationDate: -1 });

    const presentClasses = attendance.filter(
      (record) => record.status === "PRESENT"
    );

    const absentClasses = attendance.filter(
      (record) => record.status === "ABSENT"
    );

    const pendingMakeups = attendance.filter(
      (record) =>
        record.makeupRequired === true &&
        record.makeupCompleted === false
    );

    const completedMakeups = attendance.filter(
      (record) =>
        record.makeupRequired === true &&
        record.makeupCompleted === true
    );

    /*
      A training day is considered completed when:
      - Attendance is PRESENT
      - OR an ABSENT class has its makeup completed
    */

    const completedTrainingDays = attendance
      .filter(
        (record) =>
          record.status === "PRESENT" ||
          (record.makeupRequired === true &&
            record.makeupCompleted === true)
      )
      .map((record) => record.planDay);

    const uniqueCompletedDays = [
      ...new Set(completedTrainingDays),
    ];

    const currentTrainingDay =
      uniqueCompletedDays.length > 0
        ? Math.max(...uniqueCompletedDays)
        : 0;

    // Find the next milestone
    const nextMilestone = student.plan.milestones
      .filter((milestone) => milestone.day > currentTrainingDay)
      .sort((a, b) => a.day - b.day)[0] || null;

    // Find the last achieved milestone
    const achievedMilestone = student.plan.milestones
      .filter((milestone) => milestone.day <= currentTrainingDay)
      .sort((a, b) => b.day - a.day)[0] || null;

    const averageRating =
      performance.length > 0
        ? Number(
            (
              performance.reduce(
                (sum, record) => sum + record.rating,
                0
              ) / performance.length
            ).toFixed(2)
          )
        : null;

    const currentCurriculum = student.plan.curriculum.find(
      (lesson) => lesson.day === currentTrainingDay + 1
    ) || null;

    return res.status(200).json({
      success: true,
      progress: {
        student: {
          id: student._id,
          name: student.name,
          currentBelt: student.currentBelt,
          status: student.status,
        },
        plan: {
          id: student.plan._id,
          name: student.plan.name,
          duration: student.plan.duration,
          durationUnit: student.plan.durationUnit,
        },
        training: {
          currentTrainingDay,
          completedDays: uniqueCompletedDays.length,
          totalCurriculumDays: student.plan.curriculum.length,
          presentClasses: presentClasses.length,
          absentClasses: absentClasses.length,
          pendingMakeups: pendingMakeups.length,
          completedMakeups: completedMakeups.length,
        },
        currentCurriculum,
        milestone: {
          achieved: achievedMilestone,
          next: nextMilestone,
        },
        performance: {
          totalEvaluations: performance.length,
          averageRating,
          latest: performance[0] || null,
        },
      },
    });
  } catch (error) {
    console.error("Get student progress error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student progress",
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
  getStudentProgress,
};
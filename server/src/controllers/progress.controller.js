const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Student = require("../models/Student");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");

// =========================================================
// SHARED BRANCH ACCESS HELPER
// =========================================================

const canAccessStudent = (user, student) => {
  if (!user || !student) {
    return false;
  }

  // Super Admin can access every student.
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  // Branch-level staff must have an assigned branch.
  if (["BRANCH_ADMIN", "COACH"].includes(user.role)) {
    if (!user.branch || !student.branch) {
      return false;
    }

    return (
      user.branch.toString() ===
      student.branch.toString()
    );
  }

  return false;
};

// =========================================================
// GET ALL STUDENTS
// =========================================================

const getStudents = async (req, res) => {
  try {
    const filter = {};

    // Branch Admin and Coach can only see their own branch.
    if (["BRANCH_ADMIN", "COACH"].includes(req.user.role)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message:
            "Your account is not assigned to a branch",
        });
      }

      filter.branch = req.user.branch;
    }

    const students = await Student.find(filter)
      .populate("branch", "name address")
      .populate(
        "plan",
        "name price duration durationUnit startingBelt"
      )
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
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

// =========================================================
// GET STUDENT BY ID
// =========================================================

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
      .populate(
        "plan",
        "name price duration durationUnit startingBelt"
      )
      .populate("user", "name email role");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (!canAccessStudent(req.user, student)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Get student by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student",
    });
  }
};

// =========================================================
// GET MY STUDENT PROFILE
// =========================================================

const getMyStudentProfile = async (req, res) => {
  try {
    const student = await Student.findOne({
      user: req.user._id,
    })
      .populate("branch", "name address")
      .populate(
        "plan",
        "name price duration durationUnit startingBelt"
      )
      .populate("user", "name email role");

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
      message: "Failed to fetch your profile",
    });
  }
};

// =========================================================
// CREATE STUDENT
// =========================================================

const createStudent = async (req, res) => {
  try {
    const {
      name,
      age,
      phone,
      email,
      branch,
      plan,
      loginEmail,
      loginPassword,
    } = req.body;

    if (
      !name ||
      age === undefined ||
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

    if (!mongoose.Types.ObjectId.isValid(branch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    if (Number(age) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Age must be greater than zero",
      });
    }

    if (loginPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Login password must be at least 6 characters",
      });
    }

    // Branch Admin can only create students in their branch.
    if (req.user.role === "BRANCH_ADMIN") {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message:
            "Your account is not assigned to a branch",
        });
      }

      if (
        req.user.branch.toString() !== branch.toString()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only create students in your branch",
        });
      }
    }

    const Branch = require("../models/Branch");

    const branchExists = await Branch.findOne({
      _id: branch,
      isActive: true,
    });

    if (!branchExists) {
      return res.status(404).json({
        success: false,
        message: "Active branch not found",
      });
    }

    const planExists = await Plan.findOne({
      _id: plan,
      isActive: true,
    });

    if (!planExists) {
      return res.status(404).json({
        success: false,
        message: "Active plan not found",
      });
    }

    const normalizedLoginEmail = loginEmail
      .trim()
      .toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedLoginEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Login email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      loginPassword,
      10
    );

    const user = await User.create({
      name: name.trim(),
      email: normalizedLoginEmail,
      password: hashedPassword,
      role: "STUDENT",
      branch,
    });

    try {
      const student = await Student.create({
        user: user._id,
        name: name.trim(),
        age: Number(age),
        phone: phone.trim(),
        email: email ? email.trim() : "",
        branch,
        plan,
        currentBelt:
          planExists.startingBelt || "White",
        status: "ACTIVE",
        joinDate: new Date(),
      });

      const populatedStudent = await Student.findById(
        student._id
      )
        .populate("branch", "name address")
        .populate(
          "plan",
          "name price duration durationUnit startingBelt"
        )
        .populate("user", "name email role");

      return res.status(201).json({
        success: true,
        message: "Student created successfully",
        student: populatedStudent,
      });
    } catch (studentError) {
      // Remove the user if student creation fails.
      await User.findByIdAndDelete(user._id);
      throw studentError;
    }
  } catch (error) {
    console.error("Create student error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Login email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create student",
    });
  }
};

// =========================================================
// UPDATE STUDENT
// =========================================================

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

    if (!canAccessStudent(req.user, student)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    const {
      name,
      age,
      phone,
      email,
      branch,
      plan,
      currentBelt,
      status,
      joinDate,
      password,
      loginEmail,
    } = req.body;

    // Only Super Admin can change the branch.
    if (
      branch !== undefined &&
      req.user.role !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Super Admin can change a student's branch",
      });
    }

    if (name !== undefined) {
      student.name = name.trim();
    }

    if (age !== undefined) {
      if (Number(age) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Age must be greater than zero",
        });
      }

      student.age = Number(age);
    }

    if (phone !== undefined) {
      student.phone = phone.trim();
    }

    if (email !== undefined) {
      student.email = email.trim();
    }

    if (branch !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(branch)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      const Branch = require("../models/Branch");

      const branchExists = await Branch.findOne({
        _id: branch,
        isActive: true,
      });

      if (!branchExists) {
        return res.status(404).json({
          success: false,
          message: "Active branch not found",
        });
      }

      student.branch = branch;
    }

    if (plan !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(plan)) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan ID",
        });
      }

      const planExists = await Plan.findOne({
        _id: plan,
        isActive: true,
      });

      if (!planExists) {
        return res.status(404).json({
          success: false,
          message: "Active plan not found",
        });
      }

      student.plan = plan;
    }

    if (currentBelt !== undefined) {
      student.currentBelt = currentBelt;
    }

    if (status !== undefined) {
      student.status = status;
    }

    if (joinDate !== undefined) {
      const parsedJoinDate = new Date(joinDate);

      if (Number.isNaN(parsedJoinDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid join date",
        });
      }

      student.joinDate = parsedJoinDate;
    }

    await student.save();

    // Update linked login account.
    if (student.user) {
      const user = await User.findById(student.user);

      if (user) {
        if (loginEmail !== undefined) {
          const normalizedLoginEmail = loginEmail
            .trim()
            .toLowerCase();

          const existingUser = await User.findOne({
            email: normalizedLoginEmail,
            _id: { $ne: user._id },
          });

          if (existingUser) {
            return res.status(409).json({
              success: false,
              message: "Login email already exists",
            });
          }

          user.email = normalizedLoginEmail;
        }

        if (
          password !== undefined &&
          password.trim().length > 0
        ) {
          if (password.trim().length < 6) {
            return res.status(400).json({
              success: false,
              message:
                "Password must be at least 6 characters",
            });
          }

          user.password = await bcrypt.hash(
            password.trim(),
            10
          );
        }

        if (name !== undefined) {
          user.name = name.trim();
        }

        if (branch !== undefined) {
          user.branch = branch;
        }

        await user.save();
      }
    }

    const updatedStudent = await Student.findById(id)
      .populate("user", "name email role")
      .populate("branch", "name address")
      .populate(
        "plan",
        "name price duration durationUnit startingBelt"
      );

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

// =========================================================
// DELETE STUDENT
// =========================================================

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

    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Only Super Admin can delete students",
      });
    }

    // Delete linked student login account too.
    if (student.user) {
      await User.findByIdAndDelete(student.user);
    }

    await Student.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Student and linked login account deleted successfully",
    });
  } catch (error) {
    console.error("Delete student error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete student",
    });
  }
};

// =========================================================
// GET STUDENT PROGRESS
// =========================================================

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

    // Branch-level access.
    // This also blocks staff accounts that have no branch.
    if (!canAccessStudent(req.user, student)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    // A student without a plan cannot have curriculum progress.
    if (!student.plan) {
      return res.status(200).json({
        success: true,
        progress: {
          student: {
            id: student._id,
            name: student.name,
            currentBelt: student.currentBelt,
            status: student.status,
          },
          plan: null,
          training: {
            currentTrainingDay: 0,
            completedDays: 0,
            totalCurriculumDays: 0,
            presentClasses: 0,
            absentClasses: 0,
            pendingMakeups: 0,
            completedMakeups: 0,
          },
          currentCurriculum: null,
          milestone: {
            achieved: null,
            next: null,
          },
          performance: {
            totalEvaluations: 0,
            averageRating: null,
            latest: null,
          },
        },
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
      .map((record) => record.planDay)
      .filter(
        (planDay) =>
          typeof planDay === "number" &&
          Number.isFinite(planDay)
      );

    const uniqueCompletedDays = [
      ...new Set(completedTrainingDays),
    ];

    const currentTrainingDay =
      uniqueCompletedDays.length > 0
        ? Math.max(...uniqueCompletedDays)
        : 0;

    const milestones = Array.isArray(
      student.plan.milestones
    )
      ? student.plan.milestones
      : [];

    const curriculum = Array.isArray(
      student.plan.curriculum
    )
      ? student.plan.curriculum
      : [];

    // Find the next milestone.
    const nextMilestone =
      milestones
        .filter(
          (milestone) =>
            milestone.day > currentTrainingDay
        )
        .sort((a, b) => a.day - b.day)[0] || null;

    // Find the last achieved milestone.
    const achievedMilestone =
      milestones
        .filter(
          (milestone) =>
            milestone.day <= currentTrainingDay
        )
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

    const currentCurriculum =
      curriculum.find(
        (lesson) =>
          lesson.day === currentTrainingDay + 1
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
          totalCurriculumDays: curriculum.length,
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

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  getStudents,
  getStudentById,
  getMyStudentProfile,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentProgress,
};
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const { isBranchScoped } = require("../utils/access");
const Student = require("../models/Student");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const { getProgramLearningProgress } = require("../services/programProgress.service");
const { resolveProgramCurriculum } = require("../services/curriculumResolver.service");

// =========================================================
// SHARED BRANCH ACCESS HELPER
// =========================================================

const canAccessStudent = async (user, student) => {
  if (!user || !student) {
    return false;
  }

  if (user.role === "COACH") {
    const assignment = await CoachStudentAssignment.findOne({
      coach: user._id,
      student: student._id,
      status: "ACTIVE",
    }).select("_id");

    if (!assignment) return false;
  }

  // Roles that can see every branch.
  if (!isBranchScoped(user)) {
    return true;
  }

  // Branch-only roles must have an assigned branch.
  if (!user.branch || !student.branch) {
    return false;
  }

  // student.branch can be an id or a populated branch.
  const studentBranchId = student.branch._id || student.branch;

  return user.branch.toString() === studentBranchId.toString();
};

// =========================================================
// GET ALL STUDENTS
// =========================================================

const getStudents = async (req, res) => {
  try {
    const filter = {};

    // Branch Admin and Coach can only see their own branch.
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "Your account is not assigned to a branch",
        });
      }

      filter.branch = req.user.branch;
    }

    const students = await Student.find(filter)
      .populate("branch", "name address")
      .populate("plan", "name price duration durationUnit startingBelt")
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
      .populate("plan", "name price duration durationUnit startingBelt")
      .populate("user", "name email role");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (!(await canAccessStudent(req.user, student))) {
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
      .populate("plan", "name price duration durationUnit startingBelt")
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
    const { name, age, phone, email, branch, plan, loginEmail, loginPassword } =
      req.body;

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
        message: "Login password must be at least 6 characters",
      });
    }

    // Branch Admin can only create students in their branch.
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "Your account is not assigned to a branch",
        });
      }

      if (req.user.branch.toString() !== branch.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only create students in your branch",
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

    const normalizedLoginEmail = loginEmail.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedLoginEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Login email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(loginPassword, 10);

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
        currentBelt: planExists.startingBelt || "White",
        status: "ACTIVE",
        joinDate: new Date(),
      });

      const populatedStudent = await Student.findById(student._id)
        .populate("branch", "name address")
        .populate("plan", "name price duration durationUnit startingBelt")
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

    if (!(await canAccessStudent(req.user, student))) {
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
    if (branch !== undefined && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can change a student's branch",
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
          const normalizedLoginEmail = loginEmail.trim().toLowerCase();

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

        if (password !== undefined && password.trim().length > 0) {
          if (password.trim().length < 6) {
            return res.status(400).json({
              success: false,
              message: "Password must be at least 6 characters",
            });
          }

          user.password = await bcrypt.hash(password.trim(), 10);
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
      .populate("plan", "name price duration durationUnit startingBelt");

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
        message: "Only Super Admin can delete students",
      });
    }

    // Delete linked student login account too.
    if (student.user) {
      await User.findByIdAndDelete(student.user);
    }

    await Student.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Student and linked login account deleted successfully",
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
      .populate("plan")
      .populate("plan.programs.program", "name slug")
      .populate("planEnrollments.programs.program", "name slug");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Branch-level access.
    // This also blocks staff accounts that have no branch.
    if (!(await canAccessStudent(req.user, student))) {
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

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const currentEnrollment = (student.planEnrollments || []).find((item) => {
      const start = new Date(item.startDate); const end = item.endDate ? new Date(item.endDate) : null;
      return start <= today && (!end || today < end);
    });
    const entitlements = currentEnrollment?.programs?.length
      ? currentEnrollment.programs
      : student.plan.programs || [];
    const tracks = await Promise.all(entitlements.map(async (entitlement) => {
      const programId = String(entitlement.program?._id || entitlement.program);
      const configuredPlanProgram = (student.plan.programs || []).find((item) => String(item.program?._id || item.program) === programId);
      const curriculum = resolveProgramCurriculum(entitlement, configuredPlanProgram, student.plan.curriculum);
      const milestones = student.plan.milestones || [];
      const [learning, attendance, performance] = await Promise.all([
        getProgramLearningProgress({ studentId, programId, enrollmentId: currentEnrollment?._id, enrollmentStartDate: currentEnrollment?.startDate, enrollmentEndDate: currentEnrollment?.endDate, curriculum, asOfDate: today }),
        Attendance.find({ student: studentId, sessionTypeId: programId, ...(currentEnrollment?._id ? { $or: [{ enrollment: currentEnrollment._id }, { enrollment: null, date: { $gte: currentEnrollment.startDate, ...(currentEnrollment.endDate ? { $lt: currentEnrollment.endDate } : {}), $lte: new Date() } }] } : { date: { $lte: new Date() } }) }).sort({ date: 1 }).lean(),
        Performance.find({ student: studentId, sessionTypeId: programId, ...(currentEnrollment?._id ? { $or: [{ enrollment: currentEnrollment._id }, { enrollment: null, evaluationDate: { $gte: currentEnrollment.startDate, ...(currentEnrollment.endDate ? { $lt: currentEnrollment.endDate } : {}), $lte: new Date() } }] } : { evaluationDate: { $lte: new Date() } }) }).sort({ evaluationDate: -1 }).lean(),
      ]);
      const currentTrainingDay = learning.currentTrainingDay;
      const nextMilestone = milestones.filter((item) => Number(item.day) > currentTrainingDay).sort((a, b) => a.day - b.day)[0] || null;
      const achievedMilestone = milestones.filter((item) => Number(item.day) <= currentTrainingDay).sort((a, b) => b.day - a.day)[0] || null;
      const averageRating = performance.length ? Number((performance.reduce((sum, item) => sum + Number(item.rating), 0) / performance.length).toFixed(2)) : null;
      return {
        program: entitlement.program,
        currentBelt: student.programBelts?.find((item) => String(item.program) === programId)?.belt || (entitlements.length === 1 ? student.currentBelt : currentEnrollment?.startingBelt) || student.plan.startingBelt || "White",
        training: {
          currentTrainingDay,
          completedDays: learning.completedDays.length,
          totalCurriculumDays: curriculum.length,
          presentClasses: attendance.filter((item) => item.status === "PRESENT").length,
          absentClasses: attendance.filter((item) => item.status === "ABSENT").length,
          pendingMakeups: attendance.filter((item) => item.makeupRequired && !item.makeupCompleted).length,
          completedMakeups: attendance.filter((item) => item.makeupRequired && item.makeupCompleted).length,
        },
        currentCurriculum: curriculum.find((item) => Number(item.day) === Number(learning.nextDay)) || null,
        curriculum,
        milestone: { achieved: achievedMilestone, next: nextMilestone },
        performance: { totalEvaluations: performance.length, averageRating, latest: performance[0] || null },
      };
    }));

    const requestedProgramId = req.query.programId;
    const selectedTrack = requestedProgramId
      ? tracks.find((item) => String(item.program?._id || item.program) === String(requestedProgramId))
      : tracks[0];
    if (requestedProgramId && !selectedTrack) return res.status(404).json({ success: false, message: "Program is not included in the student's active plan." });
    const activeTrack = selectedTrack || {
      training: { currentTrainingDay: 0, completedDays: 0, totalCurriculumDays: 0, presentClasses: 0, absentClasses: 0, pendingMakeups: 0, completedMakeups: 0 },
      currentCurriculum: null, milestone: { achieved: null, next: null }, performance: { totalEvaluations: 0, averageRating: null, latest: null },
    };

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
          programs: entitlements.map((item) => item.program),
        },
        selectedProgram: activeTrack.program || null,
        currentBelt: activeTrack.currentBelt || student.currentBelt || "White",
        tracks,
        curriculum: activeTrack.curriculum || [],
        training: activeTrack.training,
        currentCurriculum: activeTrack.currentCurriculum,
        milestone: activeTrack.milestone,
        performance: activeTrack.performance,
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

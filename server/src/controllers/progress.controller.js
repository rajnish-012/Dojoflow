const mongoose = require("mongoose");
const { isBranchScoped } = require("../utils/access");
const { validatePassword, sessionInvalidationTime } = require("../utils/passwordPolicy");
const { normalizePhone } = require("../utils/phone");
const Student = require("../models/Student");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");
const Makeup = require("../models/Makeup");
const StudentCurriculumMilestone = require("../models/StudentCurriculumMilestone");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const { getProgramLearningProgress } = require("../services/programProgress.service");
const { resolveProgramCurriculum } = require("../services/curriculumResolver.service");
const { withAttendanceSessionDetails } = require("../utils/attendanceSession");
const { findEnrollmentForDate } = require("../services/enrollmentLifecycle.service");

const indiaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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
      .populate("plan", "name duration durationUnit startingBelt")
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
      .populate("plan", "name duration durationUnit startingBelt")
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
      .populate("plan", "name duration durationUnit startingBelt")
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
    const normalizedPhone = normalizePhone(phone);

    if (
      !name ||
      age === undefined ||
      !normalizedPhone ||
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

    const passwordError = validatePassword(loginPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
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

    const user = await User.create({
      name: name.trim(),
      email: normalizedLoginEmail,
      phone: normalizedPhone,
      password: loginPassword,
      role: "STUDENT",
      branch,
    });

    try {
      const student = await Student.create({
        user: user._id,
        name: name.trim(),
        age: Number(age),
        phone: normalizedPhone,
        email: email ? email.trim() : "",
        branch,
        plan,
        currentBelt: planExists.startingBelt || "White",
        status: "ACTIVE",
        joinDate: new Date(),
      });

      const populatedStudent = await Student.findById(student._id)
        .populate("branch", "name address")
        .populate("plan", "name duration durationUnit startingBelt")
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
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ message: "Enter a valid phone number with its country code." });
      }
      student.phone = normalizedPhone;
      if (student.user) await User.updateOne({ _id: student.user }, { $set: { phone: normalizedPhone } });
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

        if (typeof password === "string" && password.length > 0) {
          const passwordError = validatePassword(password);
          if (passwordError) return res.status(400).json({ success: false, message: passwordError });
          user.password = password;
          user.passwordChangedAt = sessionInvalidationTime();
          user.mustResetPassword = false;
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
      .populate("plan", "name duration durationUnit startingBelt");

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
            unscheduledMakeups: 0,
            completedMakeups: 0,
            scheduledMakeups: 0,
          },
          attendance: [],
          makeups: [],
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
    const currentEnrollment = findEnrollmentForDate(student.planEnrollments, today);
    const entitlements = currentEnrollment?.programs?.length
      ? currentEnrollment.programs
      : student.plan.programs || [];
    const tracks = await Promise.all(entitlements.map(async (entitlement) => {
      const programId = String(entitlement.program?._id || entitlement.program);
      const configuredPlanProgram = (student.plan.programs || []).find((item) => String(item.program?._id || item.program) === programId);
      const curriculum = resolveProgramCurriculum(entitlement, configuredPlanProgram, student.plan.curriculum);
      const [learning, attendance, performance, makeups] = await Promise.all([
        getProgramLearningProgress({ studentId, programId, enrollmentId: currentEnrollment?._id, enrollmentStartDate: currentEnrollment?.startDate, enrollmentEndDate: currentEnrollment?.endDate, curriculum, asOfDate: today }),
        Attendance.find({ student: studentId, sessionTypeId: programId, ...(currentEnrollment?._id ? { $or: [{ enrollment: currentEnrollment._id }, { enrollment: null, date: { $gte: currentEnrollment.startDate, ...(currentEnrollment.endDate ? { $lt: currentEnrollment.endDate } : {}), $lte: new Date() } }] } : { date: { $lte: new Date() } }) }).sort({ date: 1, createdAt: 1, _id: 1 }).lean(),
        Performance.find({ student: studentId, sessionTypeId: programId, ...(currentEnrollment?._id ? { $or: [{ enrollment: currentEnrollment._id }, { enrollment: null, evaluationDate: { $gte: currentEnrollment.startDate, ...(currentEnrollment.endDate ? { $lt: currentEnrollment.endDate } : {}), $lte: new Date() } }] } : { evaluationDate: { $lte: new Date() } }) }).sort({ evaluationDate: -1 }).lean(),
        Makeup.find({ student: studentId, sessionTypeId: programId, ...(currentEnrollment?._id ? { $or: [{ enrollment: currentEnrollment._id }, { enrollment: null, originalDate: { $gte: currentEnrollment.startDate, ...(currentEnrollment.endDate ? { $lt: currentEnrollment.endDate } : {}), $lte: new Date() } }] } : { originalDate: { $lte: new Date() } }) }).select("_id status originalDate makeupDate planDay curriculumTitle").sort({ originalDate: -1, _id: -1 }).lean(),
      ]);
      const currentTrainingDay = learning.currentTrainingDay;
      const countedRegularDates = new Set();
      const regularAttendance = attendance.filter((item) => {
        if (item.attendanceType === "MAKEUP" || !["PRESENT", "ABSENT"].includes(item.status)) return false;
        const date = new Date(item.date);
        if (Number.isNaN(date.getTime())) return false;
        const dateKey = indiaDateFormatter.format(date);
        if (countedRegularDates.has(dateKey)) return false;
        countedRegularDates.add(dateKey);
        return true;
      });
      const attendanceWithSessions = await withAttendanceSessionDetails(
        regularAttendance,
        student.branch?._id || student.branch,
      );
      const curriculumVersionId = entitlement.curriculumVersion?._id || entitlement.curriculumVersion;
      const curriculumMilestones = currentEnrollment?._id && curriculumVersionId
        ? await StudentCurriculumMilestone.find({ student: studentId, enrollment: currentEnrollment._id, program: programId, curriculum: curriculumVersionId }).sort({ criteriaMetAt: -1, createdAt: -1 }).lean()
        : [];
      const achievedRecord = curriculumMilestones.find((item) => item.status === "EARNED") || null;
      const nextRecord = curriculumMilestones.find((item) => item.status === "PENDING_APPROVAL") || curriculumMilestones.find((item) => item.status === "EARNED" && (item.rewards || []).some((reward) => ["AWAITING_GRADING", "AWAITING_PROMOTION_APPROVAL"].includes(reward.status))) || null;
      const toMilestoneSummary = (item) => item ? { belt: (item.rewards || []).find((reward) => reward.type === "BELT_PROGRESSION")?.targetBelt || "", skill: item.milestoneName || "", description: item.milestoneDescription || item.milestoneCriteria || "", status: item.status === "PENDING_APPROVAL" ? "AWAITING_APPROVAL" : ((item.rewards || []).find((reward) => reward.type === "BELT_PROGRESSION")?.status || item.status) } : null;
      const nextMilestone = toMilestoneSummary(nextRecord);
      const achievedMilestone = toMilestoneSummary(achievedRecord);
      const averageRating = performance.length ? Number((performance.reduce((sum, item) => sum + Number(item.rating), 0) / performance.length).toFixed(2)) : null;
      return {
        program: entitlement.program,
        currentBelt: student.programBelts?.find((item) => String(item.program) === programId)?.belt || (entitlements.length === 1 ? student.currentBelt : currentEnrollment?.startingBelt) || student.plan.startingBelt || "White",
        training: {
          currentTrainingDay,
          completedDays: learning.completedDays.length,
          totalCurriculumDays: curriculum.length,
          presentClasses: regularAttendance.filter((item) => item.status === "PRESENT").length,
          absentClasses: regularAttendance.filter((item) => item.status === "ABSENT").length,
          pendingMakeups: makeups.filter((item) => item.status === "SCHEDULED").length,
          unscheduledMakeups: makeups.filter((item) => item.status === "SCHEDULED" && !item.makeupDate).length,
          scheduledMakeups: makeups.filter((item) => item.status === "SCHEDULED" && Boolean(item.makeupDate)).length,
          completedMakeups: makeups.filter((item) => item.status === "COMPLETED").length,
        },
        attendance: attendanceWithSessions,
        makeups,
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
      training: { currentTrainingDay: 0, completedDays: 0, totalCurriculumDays: 0, presentClasses: 0, absentClasses: 0, pendingMakeups: 0, unscheduledMakeups: 0, scheduledMakeups: 0, completedMakeups: 0 },
      currentCurriculum: null, milestone: { achieved: null, next: null }, performance: { totalEvaluations: 0, averageRating: null, latest: null },
      attendance: [], makeups: [],
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
        attendance: activeTrack.attendance || [],
        makeups: activeTrack.makeups || [],
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

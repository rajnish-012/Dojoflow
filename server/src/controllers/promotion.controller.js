const mongoose = require("mongoose");

const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const BeltHistory = require("../models/BeltHistory");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const { getProgramLearningProgress } = require("../services/programProgress.service");
const { resolveProgramCurriculum } = require("../services/curriculumResolver.service");
const { safelyNotify } = require("../services/notification.service");
const { findEnrollmentForDate } = require("../services/enrollmentLifecycle.service");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");

/* ======================================================
   HELPERS
====================================================== */

/**
 * SUPER_ADMIN:
 *   Full academy access.
 *
 * Branch-scoped users:
 *   Access only their assigned branch.
 *
 * The branch scope is now driven by the resolved
 * database Role.dataScope rather than requiring a
 * specific role name such as BRANCH_ADMIN.
 *
 * Legacy COACH behavior is also preserved because
 * coaches already have branch + assignment restrictions.
 */
function isBranchScopedUser(user) {
  if (!user) {
    return false;
  }

  if (String(user.role || "").toUpperCase() === "SUPER_ADMIN") {
    return false;
  }

  return (
    String(user.dataScope || "BRANCH").toUpperCase() !== "ALL"
  );
}

/**
 * Check whether a user can access a branch.
 *
 * SUPER_ADMIN / ALL scope:
 *   Full academy access.
 *
 * BRANCH scope:
 *   Own assigned branch only.
 *
 * This is a data-isolation rule, not an authorization
 * permission. Permission authorization is handled by
 * the route middleware.
 */
function hasBranchAccess(user, branchId) {
  if (!isBranchScopedUser(user)) {
    return true;
  }

  if (!user.branch) {
    return false;
  }

  if (!branchId) {
    return false;
  }

  return branchId.toString() === user.branch.toString();
}

/**
 * Get active students assigned to the currently
 * logged-in legacy COACH.
 *
 * Coach assignment restrictions are preserved as a
 * business/data-scope rule.
 *
 * Custom roles do not automatically become coaches merely
 * because they have promotion permissions.
 */
async function getCoachStudentIds(user) {
  if (String(user?.role || "").toUpperCase() !== "COACH") {
    return null;
  }

  const assignments = await CoachStudentAssignment.find({
    coach: user._id,
    status: "ACTIVE",
  }).select("student");

  return assignments.map((assignment) => assignment.student);
}

/**
 * Check whether the logged-in legacy coach has an
 * active assignment for a particular student.
 */
async function hasCoachStudentAccess(user, studentId) {
  if (String(user?.role || "").toUpperCase() !== "COACH") {
    return true;
  }

  const assignment = await CoachStudentAssignment.findOne({
    coach: user._id,
    student: studentId,
    status: "ACTIVE",
  }).select("_id");

  return Boolean(assignment);
}

/**
 * Same training-day definition used by the existing
 * progress system:
 *
 * PRESENT
 * OR
 * ABSENT + makeup completed
 */
async function getCompletedTrainingDay(studentId) {
  const attendance = await Attendance.find({
    student: studentId,
  })
    .select("planDay status makeupRequired makeupCompleted")
    .lean();

  const completedDays = attendance
    .filter(
      (record) =>
        record.status === "PRESENT" ||
        (record.makeupRequired === true && record.makeupCompleted === true),
    )
    .map((record) => Number(record.planDay))
    .filter((day) => Number.isFinite(day));

  if (completedDays.length === 0) {
    return 0;
  }

  return Math.max(...completedDays);
}

/**
 * Find the next belt milestone that:
 *
 * 1. Has already been reached by training day.
 * 2. Is different from the student's current belt.
 *
 * Milestones are sorted ascending so the system
 * promotes students through the configured roadmap
 * instead of skipping directly to a later belt.
 */
function getEligibleMilestone(plan, currentBelt, trainingDay) {
  const milestones = Array.isArray(plan?.milestones) ? plan.milestones : [];

  return (
    milestones
      .filter(
        (milestone) =>
          Number(milestone.day) <= trainingDay &&
          String(milestone.belt || "")
            .trim()
            .toLowerCase() !==
            String(currentBelt || "")
              .trim()
              .toLowerCase(),
      )
      .sort((a, b) => Number(a.day) - Number(b.day))[0] || null
  );
}

/**
 * Get students visible to the authenticated user.
 *
 * SUPER_ADMIN / ALL scope:
 *   All active/non-inactive students.
 *
 * BRANCH scope:
 *   Active/non-inactive students in own branch.
 *
 * Legacy COACH:
 *   Only active/non-inactive students assigned
 *   to that coach.
 */
async function buildStudentFilter(user) {
  const filter = {
    status: {
      $ne: "INACTIVE",
    },
  };

  const normalizedRole = String(user?.role || "").toUpperCase();

  /*
   * Preserve the existing coach assignment rule.
   */
  if (normalizedRole === "COACH") {
    const studentIds = await getCoachStudentIds(user);

    filter._id = {
      $in: Array.isArray(studentIds) ? studentIds : [],
    };

    /*
     * Keep branch isolation explicit for coaches.
     */
    if (user.branch) {
      filter.branch = user.branch;
    }

    return filter;
  }

  /*
   * Database Role.dataScope controls branch
   * isolation for custom roles and existing
   * branch-scoped roles.
   */
  if (isBranchScopedUser(user)) {
    if (!user.branch) {
      filter._id = {
        $in: [],
      };

      return filter;
    }

    filter.branch = user.branch;
  }

  return filter;
}

/* ======================================================
   GET ELIGIBLE STUDENTS
   GET /api/promotions/eligible
====================================================== */

const getEligiblePromotions = async (req, res) => {
  try {
    const studentFilter = await buildStudentFilter(req.user);

    const students = await Student.find(studentFilter)
      .populate("branch", "name address")
      .populate({ path: "plan", populate: { path: "programs.program", select: "name" } })
      .sort({
        name: 1,
      })
      .lean();

    const eligible = [];

    for (const student of students) {
      if (!student.plan) {
        continue;
      }

      /*
       * Extra branch-level protection.
       */
      if (!hasBranchAccess(req.user, student.branch?._id || student.branch)) {
        continue;
      }

      /*
       * Extra coach-level protection.
       *
       * This remains intentionally checked again even
       * though the main query already filters assigned
       * students.
       */
      if (String(req.user?.role || "").toUpperCase() === "COACH") {
        const coachHasAccess = await hasCoachStudentAccess(
          req.user,
          student._id,
        );

        if (!coachHasAccess) {
          continue;
        }
      }

      const today = new Date();
      const enrollment = findEnrollmentForDate(student.planEnrollments, today);
      const entitlements = enrollment?.programs?.length
        ? enrollment.programs
        : (student.plan.programs || []).map((item) => ({ program: item.program?._id || item.program, curriculum: item.curriculum || [] }));
      for (const entitlement of entitlements) {
        const programId = entitlement.program?._id || entitlement.program;
        if (!programId) continue;
        const program = student.plan.programs?.find((item) => String(item.program?._id || item.program) === String(programId))?.program;
        const planProgram = (student.plan.programs || []).find((item) => String(item.program?._id || item.program) === String(programId));
        const curriculum = resolveProgramCurriculum(entitlement, planProgram, student.plan.curriculum);
        const { currentTrainingDay: trainingDay } = await getProgramLearningProgress({
          studentId: student._id,
          programId,
          enrollmentId: enrollment?._id,
          enrollmentStartDate: enrollment?.startDate,
          enrollmentEndDate: enrollment?.endDate,
          curriculum,
          asOfDate: today,
        });
        const currentBelt = student.programBelts?.find((item) => String(item.program) === String(programId))?.belt || (entitlements.length === 1 ? student.currentBelt : enrollment?.startingBelt) || "White";
        const milestone = getEligibleMilestone(student.plan, currentBelt, trainingDay);
        if (!milestone) continue;
        const existingHistory = await BeltHistory.findOne({ student: student._id, sessionTypeId: programId, toBelt: milestone.belt }).lean();
        if (existingHistory) continue;
        eligible.push({
        student: {
          _id: student._id,
          name: student.name,
          age: student.age,
          phone: student.phone,
          email: student.email,
          currentBelt,
        },

        branch: student.branch,

        plan: {
          _id: student.plan._id,
          name: student.plan.name,
        },

        program: { _id: String(programId), name: program?.name || "Training program" },

        trainingDay,

        milestone: {
          day: milestone.day,
          belt: milestone.belt,
          skill: milestone.skill || "",
          description: milestone.description || "",
        },
        });
      }
    }

    for (const candidate of eligible) {
      await safelyNotify({
        type: "PROMOTION_ELIGIBLE",
        title: "Promotion eligibility reached",
        message: `${candidate.student.name} is eligible for the ${candidate.milestone.belt} belt promotion.`,
        severity: "SUCCESS",
        branch: candidate.branch?._id || candidate.branch,
        student: candidate.student._id,
        entityType: "STUDENT",
        entityId: candidate.student._id,
        eventKey: `promotion-eligible:${candidate.student._id}:${candidate.program._id}:${candidate.milestone.day}:${candidate.milestone.belt}`,
        actionUrl: "/promotions",
      });
    }

    return res.status(200).json({
      success: true,
      count: eligible.length,
      eligible,
    });
  } catch (error) {
    console.error("Get eligible promotions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch eligible promotions",
    });
  }
};

/* ======================================================
   PROMOTE STUDENT
   POST /api/promotions
====================================================== */

const promoteStudent = async (req, res) => {
  try {
    const { student: studentId, programId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(studentId)
      .populate("branch", "name address")
      .populate({ path: "plan", populate: { path: "programs.program", select: "name" } });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /*
     * Preserve legacy COACH assignment protection.
     *
     * A custom role with promotion.manage does not
     * become a coach simply because it has the permission.
     */
    if (String(req.user?.role || "").toUpperCase() === "COACH") {
      const coachHasAccess = await hasCoachStudentAccess(req.user, student._id);

      if (!coachHasAccess) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    /*
     * Branch-level access now uses the resolved
     * database role dataScope.
     *
     * This covers:
     * - BRANCH_ADMIN
     * - COACH
     * - custom branch-scoped roles
     */
    if (isBranchScopedUser(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (!hasBranchAccess(req.user, student.branch?._id || student.branch)) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    if (student.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Only active students can be promoted",
      });
    }

    if (!student.plan) {
      return res.status(400).json({
        success: false,
        message: "Student does not have an assigned training plan",
      });
    }

    const today = new Date();
    const enrollment = findEnrollmentForDate(student.planEnrollments, today);
    const entitlements = enrollment?.programs?.length ? enrollment.programs : (student.plan.programs || []).map((item) => ({ program: item.program?._id || item.program, curriculum: item.curriculum || [] }));
    if (!programId && entitlements.length > 1) return res.status(400).json({ success: false, message: "programId is required when the student's plan includes multiple programs" });
    const entitlement = entitlements.find((item) => String(item.program?._id || item.program) === String(programId || item.program?._id || item.program));
    const selectedProgramId = entitlement?.program?._id || entitlement?.program;
    if (!entitlement || !selectedProgramId) return res.status(400).json({ success: false, message: "The selected program is not included in the active plan" });
    const planProgram = (student.plan.programs || []).find((item) => String(item.program?._id || item.program) === String(selectedProgramId));
    const curriculum = resolveProgramCurriculum(entitlement, planProgram, student.plan.curriculum);
    const { currentTrainingDay: trainingDay } = await getProgramLearningProgress({ studentId: student._id, programId: selectedProgramId, enrollmentId: enrollment?._id, enrollmentStartDate: enrollment?.startDate, enrollmentEndDate: enrollment?.endDate, curriculum, asOfDate: today });
    const previousBelt = student.programBelts?.find((item) => String(item.program) === String(selectedProgramId))?.belt || (entitlements.length === 1 ? student.currentBelt : enrollment?.startingBelt) || "White";
    const milestone = getEligibleMilestone(student.plan, previousBelt, trainingDay);

    if (!milestone) {
      return res.status(400).json({
        success: false,
        message: "Student is not currently eligible for a belt promotion",
      });
    }

    /*
     * Prevent duplicate promotion.
     */
    const existingHistory = await BeltHistory.findOne({
      student: student._id,
      sessionTypeId: selectedProgramId,
      toBelt: milestone.belt,
    });

    if (existingHistory) {
      return res.status(409).json({
        success: false,
        message: "This belt promotion has already been recorded",
      });
    }

    /*
     * Update student's current belt.
     */
    const existingProgramBelt = student.programBelts.find((item) => String(item.program) === String(selectedProgramId));
    if (existingProgramBelt) existingProgramBelt.belt = String(milestone.belt).trim();
    else student.programBelts.push({ program: selectedProgramId, belt: String(milestone.belt).trim() });
    if (entitlements.length === 1) student.currentBelt = String(milestone.belt).trim();

    let history;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await student.save({ session });
        [history] = await BeltHistory.create([{
          student: student._id,
          branch: student.branch?._id || student.branch,
          plan: student.plan._id,
          sessionTypeId: selectedProgramId,
          fromBelt: previousBelt,
          toBelt: milestone.belt,
          milestoneDay: milestone.day,
          skill: milestone.skill || "",
          description: milestone.description || "",
          promotedAt: new Date(),
          approvedBy: req.user._id,
        }], { session });
        await auditService.record({ req, session, action: AUDIT_ACTIONS.PROMOTION_CREATED, entityType: "PROMOTION", entityId: history._id, branchId: student.branch?._id || student.branch, before: { belt: previousBelt }, after: { belt: milestone.belt, studentId: student._id, programId: selectedProgramId, milestoneDay: milestone.day } });
      });
    } finally { await session.endSession(); }

    const populatedHistory = await BeltHistory.findById(history._id)
      .populate("student", "name age phone email currentBelt")
      .populate("branch", "name address")
      .populate("plan", "name")
      .populate("approvedBy", "name email role");

    await safelyNotify({
      type: "PROMOTION_COMPLETED",
      title: "Student promoted",
      message: `${student.name} has been promoted to ${milestone.belt}.`,
      severity: "SUCCESS",
      branch: student.branch?._id || student.branch,
      student: student._id,
      entityType: "PROMOTION",
      entityId: history._id,
      eventKey: `promotion:${history._id}:completed`,
      actionUrl: "/promotions",
    });

    return res.status(201).json({
      success: true,

      message: `${student.name} promoted from ${previousBelt} to ${milestone.belt} belt`,

      promotion: populatedHistory,
    });
  } catch (error) {
    console.error("Promote student error:", error);

    /*
     * Unique index protection.
     */
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This belt promotion has already been recorded",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to promote student"
          : error.message || "Failed to promote student",
    });
  }
};

/* ======================================================
   GET STUDENT BELT HISTORY
   GET /api/promotions/history/:studentId
====================================================== */

const getStudentBeltHistory = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(studentId)
      .select("name age phone email currentBelt branch plan")
      .populate("branch", "name address")
      .populate("plan", "name startingBelt");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /*
     * Preserve legacy coach assignment protection.
     */
    if (String(req.user?.role || "").toUpperCase() === "COACH") {
      const coachHasAccess = await hasCoachStudentAccess(req.user, student._id);

      if (!coachHasAccess) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    /*
     * Branch isolation for both existing and
     * custom branch-scoped roles.
     */
    if (!hasBranchAccess(req.user, student.branch?._id || student.branch)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    const history = await BeltHistory.find({
      student: studentId,
    })
      .populate("approvedBy", "name email role")
      .populate("sessionTypeId", "name")
      .sort({
        promotedAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,

      student: {
        _id: student._id,

        name: student.name,

        currentBelt: student.currentBelt || "White",

        branch: student.branch,

        plan: student.plan,
      },

      history,
    });
  } catch (error) {
    console.error("Get belt history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch belt history",
    });
  }
};

module.exports = {
  getEligiblePromotions,
  promoteStudent,
  getStudentBeltHistory,
};

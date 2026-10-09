const mongoose = require("mongoose");

const Student = require("../models/Student");
const BeltHistory = require("../models/BeltHistory");
const StudentCurriculumMilestone = require("../models/StudentCurriculumMilestone");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const { safelyNotify, safelyCreateNotification } = require("../services/notification.service");
const { evaluateStudentPromotionEligibility } = require("../services/promotionEligibility.service");
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
      const eligibility = await evaluateStudentPromotionEligibility(student, { asOfDate: today });
      for (const candidate of eligibility.filter((item) => item.eligible)) {
        eligible.push({
        student: {
          _id: student._id,
          name: student.name,
          age: student.age,
          phone: student.phone,
          email: student.email,
          currentBelt: candidate.currentBelt,
        },

        branch: student.branch,

        plan: {
          _id: student.plan._id,
          name: student.plan.name,
        },

        program: { _id: String(candidate.programId), name: candidate.program?.name || "Training program" },

        trainingDay: candidate.trainingDay,

        milestone: {
          belt: candidate.milestone.belt,
          skill: candidate.milestone.skill || "",
          description: candidate.milestone.description || "",
          requiresFormalGrading: candidate.milestone.requiresFormalGrading !== false,
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
        eventKey: `promotion-eligible:${candidate.student._id}:${candidate.program._id}:${candidate.milestone.belt}`,
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
    const { student: studentId, programId, gradingEventId = null } = req.body;

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
    const results = await evaluateStudentPromotionEligibility(student, { asOfDate: today, programId });
    if (!programId && results.some((item) => item.programCount > 1)) return res.status(400).json({ success: false, message: "programId is required when the student's plan includes multiple programs" });
    const candidate = results.find((item) => item.eligible);
    const selectedProgramId = candidate?.programId || results[0]?.programId;
    const previousBelt = candidate?.currentBelt || results[0]?.currentBelt || student.currentBelt || "White";
    const milestone = candidate?.milestone;
    const programCount = candidate?.programCount || results[0]?.programCount || 1;

    if (results.some((item) => item.reason === "This belt promotion has already been recorded.")) {
      return res.status(409).json({ success: false, message: "This belt promotion has already been recorded" });
    }

    if (!milestone || !candidate?.eligible) {
      return res.status(400).json({
        success: false,
        message: "Student is not currently eligible for a belt promotion",
      });
    }
    if (milestone.requiresFormalGrading !== false && !gradingEventId) {
      return res.status(409).json({ success: false, message: "This curriculum belt reward requires formal grading before promotion." });
    }

    /*
     * Prevent duplicate promotion.
     */
    /*
     * Update student's current belt.
     */
    const existingProgramBelt = student.programBelts.find((item) => String(item.program) === String(selectedProgramId));
    if (existingProgramBelt) existingProgramBelt.belt = String(milestone.belt).trim();
    else student.programBelts.push({ program: selectedProgramId, belt: String(milestone.belt).trim() });
    if (programCount === 1) student.currentBelt = String(milestone.belt).trim();

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
          gradingEvent: gradingEventId,
          fromBelt: previousBelt,
          toBelt: milestone.belt,
          milestoneDay: null,
          skill: milestone.skill || "",
          description: milestone.description || "",
          curriculumMilestone: milestone.curriculumMilestoneId,
          curriculum: milestone.curriculumId,
          curriculumStepId: milestone.curriculumStepId,
          reason: gradingEventId ? "Grading examination pass" : "Eligibility milestone approved",
          promotedAt: new Date(),
          approvedBy: req.user._id,
        }], { session });
        const achievement = await StudentCurriculumMilestone.findOne({ _id: milestone.curriculumMilestoneId, student: student._id, enrollment: candidate.enrollment?._id, program: selectedProgramId, curriculum: milestone.curriculumId, status: "EARNED" }).session(session);
        const reward = achievement?.rewards.id(milestone.curriculumRewardId);
        const allowedRewardStatuses = gradingEventId ? ["AWAITING_GRADING", "AWAITING_PROMOTION_APPROVAL"] : ["AWAITING_PROMOTION_APPROVAL"];
        if (!achievement || !reward || reward.type !== "BELT_PROGRESSION" || reward.targetBelt !== String(milestone.belt).trim() || !allowedRewardStatuses.includes(reward.status) || (!gradingEventId && reward.requiresFormalGrading !== false)) {
          const error = new Error("The curriculum belt reward changed before this promotion was recorded."); error.status = 409; throw error;
        }
        reward.status = "FULFILLED";
        reward.beltHistory = history._id;
        reward.fulfilledAt = new Date();
        reward.fulfilledBy = req.user._id;
        reward.fulfillmentNote = `Promotion recorded through ${gradingEventId ? "formal grading" : "authorized promotion approval"}.`;
        achievement.history.push({ action: "REWARD_FULFILLED", rewardId: reward.rewardId, performedBy: req.user._id, performedAt: new Date(), reason: reward.fulfillmentNote });
        await achievement.save({ session });
        await auditService.record({ req, session, action: AUDIT_ACTIONS.PROMOTION_CREATED, entityType: "PROMOTION", entityId: history._id, branchId: student.branch?._id || student.branch, before: { belt: previousBelt }, after: { belt: milestone.belt, studentId: student._id, programId: selectedProgramId, curriculumMilestoneId: achievement._id, curriculumId: achievement.curriculum, gradingEventId } });
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
    if (gradingEventId && student.user) await safelyCreateNotification({
      recipient: student.user,
      type: "STUDENT_PROMOTION_COMPLETED",
      title: "Belt promotion completed",
      message: `Your belt changed from ${previousBelt} to ${milestone.belt}.`,
      severity: "SUCCESS",
      branch: student.branch?._id || student.branch,
      student: student._id,
      entityType: "PROMOTION",
      entityId: history._id,
      eventKey: `grading-promotion:${history._id}:student-completed`,
      actionUrl: "/student-dashboard",
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
  promoteStudentForGrading: async ({ req, studentId, programId, gradingEventId }) => {
    let statusCode = 200;
    let body = null;
    const response = {
      status(code) { statusCode = code; return this; },
      json(value) { body = value; return this; },
    };
    await promoteStudent({ ...req, body: { student: studentId, programId, gradingEventId } }, response);
    return { statusCode, body };
  },
};

const mongoose = require("mongoose");

const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const BeltHistory = require("../models/BeltHistory");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");

/* ======================================================
   HELPERS
====================================================== */

/**
 * Returns true when the user is restricted to a branch.
 */
function isBranchScopedUser(user) {
  return (
    ["BRANCH_ADMIN", "COACH"].includes(user?.role) && Boolean(user?.branch)
  );
}

/**
 * Check whether a user can access a branch.
 *
 * SUPER_ADMIN:
 *   Full academy access.
 *
 * BRANCH_ADMIN:
 *   Own branch only.
 *
 * COACH:
 *   Branch is checked here, but student-level
 *   access is checked separately through
 *   CoachStudentAssignment.
 */
function hasBranchAccess(user, branchId) {
  if (!isBranchScopedUser(user)) {
    return true;
  }

  if (!user.branch) {
    return false;
  }

  return branchId?.toString() === user.branch.toString();
}

/**
 * Get active students assigned to the
 * currently logged-in coach.
 */
async function getCoachStudentIds(user) {
  if (user?.role !== "COACH") {
    return null;
  }

  const assignments = await CoachStudentAssignment.find({
    coach: user._id,
    status: "ACTIVE",
  }).select("student");

  return assignments.map((assignment) => assignment.student);
}

/**
 * Check whether the logged-in coach has
 * an active assignment for a particular student.
 */
async function hasCoachStudentAccess(user, studentId) {
  if (user?.role !== "COACH") {
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
 * Same training-day definition used by the
 * existing progress system:
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
 * 1. Has already been reached by training day
 * 2. Is different from the student's current belt
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
 * SUPER_ADMIN:
 *   All active/non-inactive students.
 *
 * BRANCH_ADMIN:
 *   Active/non-inactive students in own branch.
 *
 * COACH:
 *   Only active/non-inactive students assigned
 *   to that coach.
 */
async function buildStudentFilter(user) {
  const filter = {
    status: {
      $ne: "INACTIVE",
    },
  };

  if (user?.role === "COACH") {
    const studentIds = await getCoachStudentIds(user);

    filter._id = {
      $in: studentIds,
    };

    return filter;
  }

  if (user?.role === "BRANCH_ADMIN") {
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
      .populate("plan")
      .sort({
        name: 1,
      })
      .lean();

    const eligible = [];

    for (const student of students) {
      if (!student.plan) {
        continue;
      }

      /**
       * Extra branch-level protection.
       */
      if (!hasBranchAccess(req.user, student.branch?._id || student.branch)) {
        continue;
      }

      /**
       * Extra coach-level protection.
       *
       * This is intentionally checked again
       * even though the main query already filters
       * assigned students.
       */
      if (req.user.role === "COACH") {
        const coachHasAccess = await hasCoachStudentAccess(
          req.user,
          student._id,
        );

        if (!coachHasAccess) {
          continue;
        }
      }

      const trainingDay = await getCompletedTrainingDay(student._id);

      const milestone = getEligibleMilestone(
        student.plan,
        student.currentBelt,
        trainingDay,
      );

      if (!milestone) {
        continue;
      }

      const existingHistory = await BeltHistory.findOne({
        student: student._id,
        toBelt: milestone.belt,
      }).lean();

      if (existingHistory) {
        continue;
      }

      eligible.push({
        student: {
          _id: student._id,
          name: student.name,
          age: student.age,
          phone: student.phone,
          email: student.email,
          currentBelt: student.currentBelt || "White",
        },

        branch: student.branch,

        plan: {
          _id: student.plan._id,
          name: student.plan.name,
        },

        trainingDay,

        milestone: {
          day: milestone.day,
          belt: milestone.belt,
          skill: milestone.skill || "",
          description: milestone.description || "",
        },
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
    const { student: studentId } = req.body;

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
      .populate("plan");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /**
     * Coach access is assignment-based.
     *
     * A coach cannot promote a student
     * who is not actively assigned to them.
     */
    if (req.user.role === "COACH") {
      const coachHasAccess = await hasCoachStudentAccess(req.user, student._id);

      if (!coachHasAccess) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    /**
     * Branch-level access for Branch Admin.
     */
    if (req.user.role === "BRANCH_ADMIN") {
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

    if (
      req.user.role === "COACH" &&
      !hasBranchAccess(req.user, student.branch?._id || student.branch)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student's branch",
      });
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

    const trainingDay = await getCompletedTrainingDay(student._id);

    const milestone = getEligibleMilestone(
      student.plan,
      student.currentBelt,
      trainingDay,
    );

    if (!milestone) {
      return res.status(400).json({
        success: false,
        message: "Student is not currently eligible for a belt promotion",
      });
    }

    /**
     * Prevent duplicate promotion.
     */
    const existingHistory = await BeltHistory.findOne({
      student: student._id,
      toBelt: milestone.belt,
    });

    if (existingHistory) {
      return res.status(409).json({
        success: false,
        message: "This belt promotion has already been recorded",
      });
    }

    const previousBelt =
      student.currentBelt || student.plan.startingBelt || "White";

    /**
     * Update the student's current belt.
     */
    student.currentBelt = String(milestone.belt).trim();

    await student.save();

    /**
     * Write immutable promotion history.
     */
    const history = await BeltHistory.create({
      student: student._id,

      branch: student.branch._id || student.branch,

      plan: student.plan._id,

      fromBelt: previousBelt,

      toBelt: milestone.belt,

      milestoneDay: milestone.day,

      skill: milestone.skill || "",

      description: milestone.description || "",

      promotedAt: new Date(),

      approvedBy: req.user._id,
    });

    const populatedHistory = await BeltHistory.findById(history._id)
      .populate("student", "name age phone email currentBelt")
      .populate("branch", "name address")
      .populate("plan", "name")
      .populate("approvedBy", "name email role");

    return res.status(201).json({
      success: true,

      message: `${student.name} promoted from ${previousBelt} to ${milestone.belt} belt`,

      promotion: populatedHistory,
    });
  } catch (error) {
    console.error("Promote student error:", error);

    /**
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

    /**
     * Coach can only access history
     * of actively assigned students.
     */
    if (req.user.role === "COACH") {
      const coachHasAccess = await hasCoachStudentAccess(req.user, student._id);

      if (!coachHasAccess) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    /**
     * Branch Admin / Coach branch protection.
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

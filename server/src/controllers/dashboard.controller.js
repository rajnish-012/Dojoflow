const { isBranchScoped } = require("../utils/access");

const Student = require("../models/Student");
const Plan = require("../models/Plan");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");

// ==============================
// GET DASHBOARD SUMMARY
// ==============================

const getDashboard = async (req, res) => {
  try {
    const filter = {};

    /*
     * =====================================================
     * DATA SCOPE
     * =====================================================
     *
     * Authorization is handled by:
     *
     *   dashboard.view
     *
     * The controller is responsible only for applying
     * the user's database-backed data scope.
     *
     * ALL    -> every branch
     * BRANCH -> assigned branch only
     */
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    /*
     * =====================================================
     * COACH-SPECIFIC BUSINESS SCOPE
     * =====================================================
     *
     * Keep the existing Coach behavior:
     * a real COACH sees only students assigned to them.
     *
     * This is not the authorization mechanism.
     * The route has already been authorized through
     * dashboard.view.
     */
    let assignedStudentIds = null;

    if (req.user.role === "COACH") {
      const assignments = await CoachStudentAssignment.find({
        coach: req.user._id,
        status: "ACTIVE",
      }).select("student");

      assignedStudentIds = assignments.map((assignment) => assignment.student);

      filter._id = {
        $in: assignedStudentIds,
      };
    }

    // ==============================
    // STUDENT STATISTICS
    // ==============================

    const totalStudents = await Student.countDocuments(filter);

    const activeStudents = await Student.countDocuments({
      ...filter,
      status: "ACTIVE",
    });

    const inactiveStudents = await Student.countDocuments({
      ...filter,
      status: "INACTIVE",
    });

    const completedStudents = await Student.countDocuments({
      ...filter,
      status: "COMPLETED",
    });

    // ==============================
    // PLANS
    // ==============================

    const totalPlans = await Plan.countDocuments({
      isActive: true,
    });

    // ==============================
    // TODAY'S ATTENDANCE
    // ==============================

    const startOfDay = new Date();

    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();

    endOfDay.setHours(23, 59, 59, 999);

    /*
     * Only active students should contribute
     * to today's dashboard attendance.
     */
    const activeStudentFilter = {
      ...filter,
      status: "ACTIVE",
    };

    const activeStudentIds =
      await Student.find(activeStudentFilter).distinct("_id");

    const attendanceFilter = {
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },

      student: {
        $in: activeStudentIds,
      },
    };

    /*
     * Apply database-backed branch data scope.
     */
    if (isBranchScoped(req.user)) {
      attendanceFilter.branch = req.user.branch;
    }

    const todayPresent = await Attendance.countDocuments({
      ...attendanceFilter,
      status: "PRESENT",
    });

    const todayAbsent = await Attendance.countDocuments({
      ...attendanceFilter,
      status: "ABSENT",
    });

    // ==============================
    // PENDING MAKEUPS
    // ==============================

    const makeupFilter = {
      student: {
        $in: activeStudentIds,
      },

      makeupRequired: true,

      makeupCompleted: false,
    };

    /*
     * Apply database-backed branch data scope.
     */
    if (isBranchScoped(req.user)) {
      makeupFilter.branch = req.user.branch;
    }

    const pendingMakeups = await Attendance.countDocuments(makeupFilter);

    // ==============================
    // RECENT PERFORMANCE
    // ==============================

    const performanceFilter = {};

    /*
     * Real Coach accounts remain restricted
     * to their assigned students.
     */
    if (assignedStudentIds) {
      performanceFilter.student = {
        $in: assignedStudentIds,
      };
    }

    /*
     * Apply database-backed branch data scope.
     */
    if (isBranchScoped(req.user)) {
      performanceFilter.branch = req.user.branch;
    }

    const recentPerformance = await Performance.find(performanceFilter)
      .populate("student", "name currentBelt")
      .populate("evaluatedBy", "name")
      .sort({
        evaluationDate: -1,
      })
      .limit(5);

    // ==============================
    // RESPONSE
    // ==============================

    return res.status(200).json({
      success: true,

      dashboard: {
        students: {
          total: totalStudents,
          active: activeStudents,
          inactive: inactiveStudents,
          completed: completedStudents,
        },

        plans: {
          active: totalPlans,
        },

        attendance: {
          todayPresent,
          todayAbsent,
          pendingMakeups,
        },

        recentPerformance,
      },
    });
  } catch (error) {
    console.error("Get dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
    });
  }
};

module.exports = {
  getDashboard,
};

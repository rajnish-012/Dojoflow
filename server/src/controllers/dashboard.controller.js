const Student = require("../models/Student");
const Plan = require("../models/Plan");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");

// ==============================
// GET DASHBOARD SUMMARY
// ==============================

const getDashboard = async (req, res) => {
  try {
    const filter = {};

    // Branch-level users only see their branch
    if (
      ["BRANCH_ADMIN", "COACH"].includes(
        req.user.role,
      )
    ) {
      filter.branch = req.user.branch;
    }

    // ==============================
    // STUDENT STATISTICS
    // ==============================

    const totalStudents =
      await Student.countDocuments(filter);

    const activeStudents =
      await Student.countDocuments({
        ...filter,
        status: "ACTIVE",
      });

    const inactiveStudents =
      await Student.countDocuments({
        ...filter,
        status: "INACTIVE",
      });

    const completedStudents =
      await Student.countDocuments({
        ...filter,
        status: "COMPLETED",
      });

    // ==============================
    // PLANS
    // ==============================

    const totalPlans =
      await Plan.countDocuments({
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
     * First get the current active students.
     *
     * This prevents old attendance records belonging
     * to deleted/inactive students from being counted
     * in today's dashboard attendance.
     */
    const activeStudentFilter = {
      ...filter,
      status: "ACTIVE",
    };

    const activeStudentIds =
      await Student.find(
        activeStudentFilter,
      ).distinct("_id");

    const attendanceFilter = {
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      student: {
        $in: activeStudentIds,
      },
    };

    if (
      ["BRANCH_ADMIN", "COACH"].includes(
        req.user.role,
      )
    ) {
      attendanceFilter.branch =
        req.user.branch;
    }

    const todayPresent =
      await Attendance.countDocuments({
        ...attendanceFilter,
        status: "PRESENT",
      });

    const todayAbsent =
      await Attendance.countDocuments({
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

    if (
      ["BRANCH_ADMIN", "COACH"].includes(
        req.user.role,
      )
    ) {
      makeupFilter.branch =
        req.user.branch;
    }

    const pendingMakeups =
      await Attendance.countDocuments(
        makeupFilter,
      );

    // ==============================
    // RECENT PERFORMANCE
    // ==============================

    const performanceFilter = {};

    if (
      ["BRANCH_ADMIN", "COACH"].includes(
        req.user.role,
      )
    ) {
      performanceFilter.branch =
        req.user.branch;
    }

    const recentPerformance =
      await Performance.find(
        performanceFilter,
      )
        .populate(
          "student",
          "name currentBelt",
        )
        .populate(
          "evaluatedBy",
          "name",
        )
        .sort({
          evaluationDate: -1,
        })
        .limit(5);

    // ==============================
    // RESPONSE
    // ==============================

    res.status(200).json({
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
    console.error(
      "Get dashboard error:",
      error,
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch dashboard data",
    });
  }
};

module.exports = {
  getDashboard,
};
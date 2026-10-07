const mongoose = require("mongoose");

const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");
const BeltHistory = require("../models/BeltHistory");
const Branch = require("../models/Branch");
const User = require("../models/User");
const Makeup = require("../models/Makeup");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const BranchSchedule = require("../models/BranchSchedule");
const TrainingSessionType = require("../models/TrainingSessionType");
const { REPORT_TIME_ZONE, regularAttendanceStages } = require("../services/attendanceAnalytics.service");


function indiaYearBoundary(year) {
  // Attendance stores academy-local calendar dates as Date values. Translate
  // India midnight to UTC so Jan 1 and month boundaries are included correctly.
  return new Date(Date.UTC(year, 0, 1) - (5 * 60 + 30) * 60 * 1000);
}

let Inquiry = null;

try {
  Inquiry = require("../models/Inquiry");
} catch {
  Inquiry = null;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isValidObjectId(id) {
  return Boolean(id) && mongoose.Types.ObjectId.isValid(id);
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

/*
|--------------------------------------------------------------------------
| DATABASE-DRIVEN BRANCH SCOPE
|--------------------------------------------------------------------------
|
| Authorization middleware decides whether the user may access
| reports at all.
|
| These helpers decide WHICH data the authorized user may see.
|
| SUPER_ADMIN:
|   ALL
|
| Any database role configured with:
|   dataScope: "ALL"
|
| may access all branches.
|
| Any database role configured with:
|   dataScope: "BRANCH"
|
| is restricted to req.user.branch.
|
| This deliberately does NOT depend only on role names such as
| COACH or BRANCH_ADMIN, because custom roles may also be
| branch-scoped.
|--------------------------------------------------------------------------
*/

function isSuperAdmin(req) {
  return String(req.user?.role || "").toUpperCase() === "SUPER_ADMIN";
}

function isBranchScopedUser(req) {
  if (!req.user) {
    return true;
  }

  if (isSuperAdmin(req)) {
    return false;
  }

  return String(req.user.dataScope || "BRANCH").toUpperCase() === "BRANCH";
}

function getUserBranchId(req) {
  if (!req.user?.branch) {
    return null;
  }

  if (typeof req.user.branch === "object") {
    return req.user.branch._id || req.user.branch.id || null;
  }

  return req.user.branch;
}

function getRequestedBranchId(req) {
  /*
   * Branch-scoped users can NEVER choose another branch
   * through the query string.
   */
  if (isBranchScopedUser(req)) {
    return getUserBranchId(req);
  }

  /*
   * ALL-scope users may optionally filter by branch.
   */
  return req.query.branch || null;
}

/*
|--------------------------------------------------------------------------
| Branch match helper
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This helper is used against collections whose documents contain
| a direct "branch" field.
|--------------------------------------------------------------------------
*/

function buildBranchMatch(req) {
  const branchId = getRequestedBranchId(req);

  if (!branchId) {
    if (isBranchScopedUser(req)) {
      /*
       * A branch-scoped account without an assigned branch
       * must not receive global data.
       */
      return {
        branch: null,
      };
    }

    return {};
  }

  if (!isValidObjectId(branchId)) {
    return {
      branch: null,
    };
  }

  return {
    branch: toObjectId(branchId),
  };
}

function buildStudentMatch(req) {
  return {
    ...buildBranchMatch(req),
  };
}

/*
|--------------------------------------------------------------------------
| Query branch validation
|--------------------------------------------------------------------------
*/

function validateRequestedBranch(req, res) {
  if (!req.query.branch) {
    return true;
  }

  if (isBranchScopedUser(req)) {
    /*
     * Ignore the requested branch for branch-scoped users.
     * Their own branch is always enforced by getRequestedBranchId().
     */
    return true;
  }

  if (!isValidObjectId(req.query.branch)) {
    res.status(400).json({
      success: false,
      message: "Invalid branch filter.",
    });

    return false;
  }

  return true;
}

function getYearRange(yearValue) {
  const currentYear = new Date().getFullYear();

  const year =
    Number(yearValue) &&
    Number(yearValue) >= 2000 &&
    Number(yearValue) <= currentYear + 1
      ? Number(yearValue)
      : currentYear;

  return {
    year,
    from: indiaYearBoundary(year),
    to: indiaYearBoundary(year + 1),
  };
}

function monthName(monthNumber) {
  return [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][monthNumber - 1];
}

function safePercentage(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(1));
}

/*
|--------------------------------------------------------------------------
| Summary / Overview
|--------------------------------------------------------------------------
*/

async function getReportsSummary(req, res) {
  try {
    if (!validateRequestedBranch(req, res)) {
      return;
    }

    const { year, from, to } = getYearRange(req.query.year);

    const branchMatch = buildBranchMatch(req);

    const studentMatch = {
      ...buildStudentMatch(req),
    };

    const attendanceMatch = {
      ...branchMatch,
      date: {
        $gte: from,
        $lt: to,
      },
    };

    const performanceMatch = {
      ...branchMatch,
      evaluationDate: {
        $gte: from,
        $lt: to,
      },
    };

    const promotionMatch = {
      ...branchMatch,
      promotedAt: {
        $gte: from,
        $lt: to,
      },
    };

    const [
      totalStudents,
      activeStudents,
      inactiveStudents,
      completedStudents,
      newAdmissions,
      attendanceSummary,
      monthlyAttendance,
      studentAttendanceRows,
      studentMakeupRows,
      performanceSummary,
      totalPromotions,
      monthlyPromotions,
      makeupSummary,
      activeBranches,
    ] = await Promise.all([
      Student.countDocuments(studentMatch),

      Student.countDocuments({
        ...studentMatch,
        status: "ACTIVE",
      }),

      Student.countDocuments({
        ...studentMatch,
        status: "INACTIVE",
      }),

      Student.countDocuments({
        ...studentMatch,
        status: "COMPLETED",
      }),

      Student.countDocuments({
        ...studentMatch,
        joinDate: {
          $gte: from,
          $lt: to,
        },
      }),

      Attendance.aggregate([
        ...regularAttendanceStages(attendanceMatch),
        {
          $group: {
            _id: null,
            total: {
              $sum: 1,
            },
            present: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "PRESENT"],
                  },
                  1,
                  0,
                ],
              },
            },
            absent: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "ABSENT"],
                  },
                  1,
                  0,
                ],
              },
            },
            makeupRequired: {
              $sum: {
                $cond: ["$makeupRequired", 1, 0],
              },
            },
            makeupCompleted: {
              $sum: {
                $cond: ["$makeupCompleted", 1, 0],
              },
            },
          },
        },
      ]),

      Attendance.aggregate([
        ...regularAttendanceStages(attendanceMatch),
        {
          $group: {
            _id: {
              month: {
                $month: { date: "$date", timezone: REPORT_TIME_ZONE },
              },
              status: "$status",
            },
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            "_id.month": 1,
          },
        },
      ]),

      Attendance.aggregate([
        ...regularAttendanceStages(attendanceMatch),
        {
          $group: {
            _id: "$student",
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } },
          },
        },
      ]),

      Makeup.aggregate([
        {
          $match: {
            ...branchMatch,
            originalDate: { $gte: from, $lt: to },
            status: "SCHEDULED",
            makeupDate: null,
          },
        },
        { $group: { _id: "$student", pending: { $sum: 1 } } },
      ]),

      Performance.aggregate([
        {
          $match: performanceMatch,
        },
        {
          $group: {
            _id: null,
            averageRating: {
              $avg: "$rating",
            },
            evaluations: {
              $sum: 1,
            },
            completedSkills: {
              $sum: {
                $cond: [
                  {
                    $gte: ["$rating", 4],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      BeltHistory.countDocuments(promotionMatch),

      BeltHistory.aggregate([
        {
          $match: promotionMatch,
        },
        {
          $group: {
            _id: {
              month: {
                $month: { date: "$promotedAt", timezone: REPORT_TIME_ZONE },
              },
            },
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            "_id.month": 1,
          },
        },
      ]),

      Makeup.aggregate([
        {
          $match: {
            ...branchMatch,
            originalDate: {
              $gte: from,
              $lt: to,
            },
          },
        },
        {
          $group: {
            _id: {
              status: "$status",
              hasScheduledDate: { $ne: [{ $ifNull: ["$makeupDate", null] }, null] },
            },
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      Branch.countDocuments({
        status: { $ne: "INACTIVE" },
        ...(isBranchScopedUser(req)
          ? { _id: isValidObjectId(getUserBranchId(req)) ? toObjectId(getUserBranchId(req)) : null }
          : req.query.branch && isValidObjectId(req.query.branch)
            ? { _id: toObjectId(req.query.branch) }
            : {}),
      }),
    ]);

    const attendance = attendanceSummary[0] || {
      total: 0,
      present: 0,
      absent: 0,
      makeupRequired: 0,
      makeupCompleted: 0,
    };

    const performance = performanceSummary[0] || {
      averageRating: 0,
      evaluations: 0,
      completedSkills: 0,
    };

    const attendanceRate = safePercentage(attendance.present, attendance.total);

    const absenceRate = safePercentage(attendance.absent, attendance.total);

    const averagePerformance = Number(
      Number(performance.averageRating || 0).toFixed(2),
    );

    const skillCompletionRate = safePercentage(
      performance.completedSkills,
      performance.evaluations,
    );

    const cohortStudents = await Student.find({
      ...studentMatch,
      joinDate: {
        $gte: from,
        $lt: to,
      },
    })
      .select("status")
      .lean();

    const cohortActive = cohortStudents.filter(
      (student) => student.status === "ACTIVE",
    ).length;

    const retentionRate = safePercentage(cohortActive, cohortStudents.length);

    const attendanceTrend = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;

      const monthRecords = monthlyAttendance.filter(
        (item) => item._id.month === month,
      );

      const present =
        monthRecords.find((item) => item._id.status === "PRESENT")?.count || 0;

      const absent =
        monthRecords.find((item) => item._id.status === "ABSENT")?.count || 0;

      const total = present + absent;

      return {
        month: monthName(month),
        present,
        absent,
        total,
        attendanceRate: total > 0 ? safePercentage(present, total) : null,
      };
    });

    const promotionTrend = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;

      const record = monthlyPromotions.find((item) => item._id.month === month);

      return {
        month: monthName(month),
        count: record?.count || 0,
      };
    });

    const scheduledMakeups = makeupSummary
      .filter((item) => item._id.status === "SCHEDULED")
      .reduce((sum, item) => sum + item.count, 0);
    const makeupStats = {
      pending: makeupSummary.find((item) => item._id.status === "SCHEDULED" && !item._id.hasScheduledDate)?.count || 0,
      booked: makeupSummary.find((item) => item._id.status === "SCHEDULED" && item._id.hasScheduledDate)?.count || 0,
      scheduled: scheduledMakeups,
      completed: makeupSummary.filter((item) => item._id.status === "COMPLETED").reduce((sum, item) => sum + item.count, 0),
      cancelled: makeupSummary.filter((item) => item._id.status === "CANCELLED").reduce((sum, item) => sum + item.count, 0),
    };

    const studentIds = studentAttendanceRows.map((item) => item._id);
    const studentRecords = studentIds.length
      ? await Student.find({ ...studentMatch, _id: { $in: studentIds } })
          .select("name branch plan")
          .populate("branch", "_id name")
          .populate("plan", "_id name")
          .lean()
      : [];
    const studentById = new Map(studentRecords.map((item) => [String(item._id), item]));
    const pendingMakeupsByStudent = new Map(studentMakeupRows.map((item) => [String(item._id), item.pending]));
    const studentAttendance = studentAttendanceRows
      .map((item) => {
        const student = studentById.get(String(item._id));
        if (!student) return null;
        return {
          _id: String(student._id),
          name: student.name,
          branch: student.branch ? { _id: String(student.branch._id), name: student.branch.name } : null,
          plan: student.plan ? { _id: String(student.plan._id), name: student.plan.name } : null,
          total: item.total,
          present: item.present,
          absent: item.absent,
          attendanceRate: safePercentage(item.present, item.total),
          pendingMakeup: pendingMakeupsByStudent.get(String(item._id)) || 0,
        };
      })
      .filter(Boolean)
      .sort((first, second) => first.attendanceRate - second.attendanceRate || second.total - first.total || first.name.localeCompare(second.name));

    return res.status(200).json({
      success: true,

      data: {
        year,

        overview: {
          totalStudents,
          activeStudents,
          inactiveStudents,
          completedStudents,
          newAdmissions,
          retentionRate,
          averageAttendance: attendanceRate,
          averagePerformance,
          beltsEarned: totalPromotions,
          activeBranches,
        },

        attendance: {
          total: attendance.total,
          present: attendance.present,
          absent: attendance.absent,
          attendanceRate,
          absenceRate,
          trend: attendanceTrend,
        },

        performance: {
          averageRating: averagePerformance,
          evaluations: performance.evaluations,
          skillCompletionRate,
        },

        belts: {
          earned: totalPromotions,
          trend: promotionTrend,
        },

        makeups: makeupStats,

        students: {
          total: totalStudents,
          active: activeStudents,
          inactive: inactiveStudents,
          completed: completedStudents,
          newAdmissions,
          retentionRate,
        },

        studentAttendance,
      },
    });
  } catch (error) {
    console.error("getReportsSummary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load report summary.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Top Performers
|--------------------------------------------------------------------------
*/

async function getTopPerformers(req, res) {
  try {
    if (!validateRequestedBranch(req, res)) {
      return;
    }

    const { from, to } = getYearRange(req.query.year);

    const branchMatch = buildBranchMatch(req);

    const results = await Performance.aggregate([
      {
        $match: {
          ...branchMatch,
          evaluationDate: {
            $gte: from,
            $lt: to,
          },
        },
      },

      {
        $group: {
          _id: "$student",

          averageRating: {
            $avg: "$rating",
          },

          evaluations: {
            $sum: 1,
          },

          skillsCompleted: {
            $sum: {
              $cond: [
                {
                  $gte: ["$rating", 4],
                },
                1,
                0,
              ],
            },
          },
        },
      },

      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },

      {
        $unwind: "$student",
      },

      {
        $match: {
          "student.status": {
            $ne: "INACTIVE",
          },

          ...(req.query.branch &&
          !isBranchScopedUser(req) &&
          isValidObjectId(req.query.branch)
            ? {
                "student.branch": toObjectId(req.query.branch),
              }
            : isBranchScopedUser(req) && isValidObjectId(getUserBranchId(req))
              ? {
                  "student.branch": toObjectId(getUserBranchId(req)),
                }
              : {}),
        },
      },

      {
        $lookup: {
          from: "attendance",

          let: {
            studentId: "$_id",
          },

          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ["$student", "$$studentId"],
                    },

                    { $ne: ["$attendanceType", "MAKEUP"] },
                    { $in: ["$status", ["PRESENT", "ABSENT"]] },

                    {
                      $gte: ["$date", from],
                    },

                    {
                      $lt: ["$date", to],
                    },
                  ],
                },
              },
            },

            {
              $sort: { date: 1, createdAt: 1, _id: 1 },
            },

            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: REPORT_TIME_ZONE } },
                status: { $first: "$status" },
              },
            },

            {
              $group: {
                _id: null,

                total: {
                  $sum: 1,
                },

                present: {
                  $sum: {
                    $cond: [
                      {
                        $eq: ["$status", "PRESENT"],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],

          as: "attendance",
        },
      },

      {
        $addFields: {
          attendanceTotal: {
            $ifNull: [
              {
                $arrayElemAt: ["$attendance.total", 0],
              },
              0,
            ],
          },

          attendancePresent: {
            $ifNull: [
              {
                $arrayElemAt: ["$attendance.present", 0],
              },
              0,
            ],
          },
        },
      },

      {
        $addFields: {
          attendanceRate: {
            $cond: [
              {
                $gt: ["$attendanceTotal", 0],
              },

              {
                $multiply: [
                  {
                    $divide: ["$attendancePresent", "$attendanceTotal"],
                  },
                  100,
                ],
              },

              0,
            ],
          },
        },
      },

      {
        $addFields: {
          performanceScore: {
            $add: [
              {
                $multiply: [
                  {
                    $divide: ["$averageRating", 5],
                  },
                  60,
                ],
              },

              {
                $multiply: [
                  {
                    $divide: ["$attendanceRate", 100],
                  },
                  40,
                ],
              },
            ],
          },
        },
      },

      {
        $sort: {
          performanceScore: -1,
          averageRating: -1,
          attendanceRate: -1,
        },
      },

      {
        $limit: 10,
      },

      {
        $lookup: {
          from: "branches",
          localField: "student.branch",
          foreignField: "_id",
          as: "branch",
        },
      },

      {
        $project: {
          _id: 1,

          student: {
            _id: "$student._id",
            name: "$student.name",
            currentBelt: "$student.currentBelt",
          },

          branch: {
            $let: {
              vars: {
                branch: {
                  $arrayElemAt: ["$branch", 0],
                },
              },

              in: {
                _id: "$$branch._id",
                name: "$$branch.name",
              },
            },
          },

          averageRating: {
            $round: ["$averageRating", 2],
          },

          evaluations: 1,
          skillsCompleted: 1,

          attendanceRate: {
            $round: ["$attendanceRate", 1],
          },

          performanceScore: {
            $round: ["$performanceScore", 1],
          },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("getTopPerformers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load top performers.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Skill Completion By Belt
|--------------------------------------------------------------------------
*/

async function getSkillCompletionByBelt(req, res) {
  try {
    if (!validateRequestedBranch(req, res)) {
      return;
    }

    const { from, to } = getYearRange(req.query.year);

    const branchMatch = buildBranchMatch(req);

    const result = await Performance.aggregate([
      {
        $match: {
          ...branchMatch,
          evaluationDate: {
            $gte: from,
            $lt: to,
          },
        },
      },

      {
        $lookup: {
          from: "students",
          localField: "student",
          foreignField: "_id",
          as: "student",
        },
      },

      {
        $unwind: "$student",
      },

      {
        $group: {
          _id: {
            belt: {
              $ifNull: ["$student.currentBelt", "Unknown"],
            },
            skill: "$skill",
          },

          evaluations: {
            $sum: 1,
          },

          completed: {
            $sum: {
              $cond: [
                {
                  $gte: ["$rating", 4],
                },
                1,
                0,
              ],
            },
          },

          averageRating: {
            $avg: "$rating",
          },
        },
      },

      {
        $group: {
          _id: "$_id.belt",

          totalEvaluations: {
            $sum: "$evaluations",
          },

          totalCompleted: {
            $sum: "$completed",
          },

          averageRating: {
            $avg: "$averageRating",
          },

          skills: {
            $push: {
              skill: "$_id.skill",
              evaluations: "$evaluations",
              completed: "$completed",

              completionRate: {
                $cond: [
                  {
                    $gt: ["$evaluations", 0],
                  },

                  {
                    $multiply: [
                      {
                        $divide: ["$completed", "$evaluations"],
                      },
                      100,
                    ],
                  },

                  0,
                ],
              },
            },
          },
        },
      },

      {
        $project: {
          _id: 0,

          belt: "$_id",

          totalEvaluations: 1,
          totalCompleted: 1,

          completionRate: {
            $cond: [
              {
                $gt: ["$totalEvaluations", 0],
              },

              {
                $multiply: [
                  {
                    $divide: ["$totalCompleted", "$totalEvaluations"],
                  },
                  100,
                ],
              },

              0,
            ],
          },

          averageRating: {
            $round: ["$averageRating", 2],
          },

          skills: 1,
        },
      },

      {
        $sort: {
          belt: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getSkillCompletionByBelt error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load skill completion.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Branch Reports
|--------------------------------------------------------------------------
*/

async function getBranchReports(req, res) {
  try {
    if (!validateRequestedBranch(req, res)) {
      return;
    }

    const { from, to, year } = getYearRange(req.query.year);

    const branchFilter = {};

    if (isBranchScopedUser(req)) {
      const branchId = getUserBranchId(req);

      if (!isValidObjectId(branchId)) {
        return res.status(200).json({
          success: true,
          data: [],
          year,
        });
      }

      branchFilter._id = toObjectId(branchId);
    } else if (req.query.branch) {
      if (!isValidObjectId(req.query.branch)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch filter.",
        });
      }

      branchFilter._id = toObjectId(req.query.branch);
    }

    const branches = await Branch.find(branchFilter)
      .select("_id name address status")
      .sort({ name: 1 })
      .lean();

    const branchIds = branches.map((branch) => branch._id);

    if (!branchIds.length) {
      return res.status(200).json({
        success: true,
        data: [],
        year,
      });
    }

    const [students, attendance, performance, promotions, makeups] =
      await Promise.all([
        Student.aggregate([
          {
            $match: {
              branch: {
                $in: branchIds,
              },
            },
          },

          {
            $group: {
              _id: "$branch",

              total: {
                $sum: 1,
              },

              active: {
                $sum: {
                  $cond: [
                    {
                      $eq: ["$status", "ACTIVE"],
                    },
                    1,
                    0,
                  ],
                },
              },

              inactive: {
                $sum: {
                  $cond: [
                    {
                      $eq: ["$status", "INACTIVE"],
                    },
                    1,
                    0,
                  ],
                },
              },

              newAdmissions: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $gte: ["$joinDate", from],
                        },
                        {
                          $lt: ["$joinDate", to],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),

        Attendance.aggregate([
          ...regularAttendanceStages({ branch: { $in: branchIds }, date: { $gte: from, $lt: to } }),
          {
            $group: {
              _id: {
                branch: "$branch",
                status: "$status",
              },

              count: {
                $sum: 1,
              },
            },
          },
        ]),

        Performance.aggregate([
          {
            $match: {
              branch: {
                $in: branchIds,
              },

              evaluationDate: {
                $gte: from,
                $lt: to,
              },
            },
          },

          {
            $group: {
              _id: "$branch",

              averageRating: {
                $avg: "$rating",
              },

              evaluations: {
                $sum: 1,
              },
            },
          },
        ]),

        BeltHistory.aggregate([
          {
            $match: {
              branch: {
                $in: branchIds,
              },

              promotedAt: {
                $gte: from,
                $lt: to,
              },
            },
          },

          {
            $group: {
              _id: "$branch",

              promotions: {
                $sum: 1,
              },
            },
          },
        ]),

        Makeup.aggregate([
          {
            $match: {
              branch: {
                $in: branchIds,
              },

              originalDate: {
                $gte: from,
                $lt: to,
              },
            },
          },

          {
            $group: {
              _id: {
                branch: "$branch",
                status: "$status",
              },

              count: {
                $sum: 1,
              },
            },
          },
        ]),
      ]);

    const studentMap = new Map();

    students.forEach((item) => {
      studentMap.set(String(item._id), item);
    });

    const attendanceMap = new Map();

    attendance.forEach((item) => {
      const branchId = String(item._id.branch);

      if (!attendanceMap.has(branchId)) {
        attendanceMap.set(branchId, {
          total: 0,
          present: 0,
          absent: 0,
        });
      }

      const target = attendanceMap.get(branchId);

      target.total += item.count;

      if (item._id.status === "PRESENT") {
        target.present += item.count;
      }

      if (item._id.status === "ABSENT") {
        target.absent += item.count;
      }
    });

    const performanceMap = new Map(
      performance.map((item) => [String(item._id), item]),
    );

    const promotionMap = new Map(
      promotions.map((item) => [String(item._id), item.promotions]),
    );

    const makeupMap = new Map();

    makeups.forEach((item) => {
      const branchId = String(item._id.branch);

      if (!makeupMap.has(branchId)) {
        makeupMap.set(branchId, {
          scheduled: 0,
          completed: 0,
          cancelled: 0,
        });
      }

      const target = makeupMap.get(branchId);

      if (item._id.status === "SCHEDULED") {
        target.scheduled += item.count;
      }

      if (item._id.status === "COMPLETED") {
        target.completed += item.count;
      }

      if (item._id.status === "CANCELLED") {
        target.cancelled += item.count;
      }
    });

    const data = branches.map((branch) => {
      const id = String(branch._id);

      const student = studentMap.get(id) || {
        total: 0,
        active: 0,
        inactive: 0,
        newAdmissions: 0,
      };

      const attendanceStats = attendanceMap.get(id) || {
        total: 0,
        present: 0,
        absent: 0,
      };

      const performanceStats = performanceMap.get(id) || {
        averageRating: 0,
        evaluations: 0,
      };

      const makeupStats = makeupMap.get(id) || {
        scheduled: 0,
        completed: 0,
        cancelled: 0,
      };

      return {
        _id: branch._id,
        name: branch.name,
        address: branch.address,
        status: branch.status,

        students: {
          total: student.total,
          active: student.active,
          inactive: student.inactive,
          newAdmissions: student.newAdmissions,
        },

        attendance: {
          total: attendanceStats.total,
          present: attendanceStats.present,
          absent: attendanceStats.absent,

          attendanceRate: safePercentage(
            attendanceStats.present,
            attendanceStats.total,
          ),
        },

        performance: {
          averageRating: Number(
            Number(performanceStats.averageRating || 0).toFixed(2),
          ),

          evaluations: performanceStats.evaluations,
        },

        promotions: promotionMap.get(id) || 0,

        makeups: makeupStats,
      };
    });

    return res.status(200).json({
      success: true,
      data,
      year,
    });
  } catch (error) {
    console.error("getBranchReports error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load branch reports.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Coach Reports
|--------------------------------------------------------------------------
|
| "COACH" here is a business-data classification:
| this report lists actual users whose current stored role
| is COACH.
|
| It is NOT used as API authorization.
|--------------------------------------------------------------------------
*/

async function getCoachReports(req, res) {
  try {
    if (!validateRequestedBranch(req, res)) {
      return;
    }

    const { from, to, year } = getYearRange(req.query.year);

    const coachFilter = {
      role: "COACH",
    };

    if (isBranchScopedUser(req)) {
      const branchId = getUserBranchId(req);

      if (!isValidObjectId(branchId)) {
        return res.status(200).json({
          success: true,
          data: [],
          year,
        });
      }

      coachFilter.branch = toObjectId(branchId);
    } else if (req.query.branch) {
      if (!isValidObjectId(req.query.branch)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch filter.",
        });
      }

      coachFilter.branch = toObjectId(req.query.branch);
    }

    const coaches = await User.find(coachFilter)
      .select("_id name email branch")
      .populate("branch", "_id name")
      .sort({ name: 1 })
      .lean();

    if (!coaches.length) {
      return res.status(200).json({
        success: true,
        data: [],
        year,
      });
    }

    const coachIds = coaches.map((coach) => coach._id);

    const [attendance, performance, assignments, promotionRows] = await Promise.all([
      Attendance.aggregate([
        ...regularAttendanceStages({ markedBy: { $in: coachIds }, date: { $gte: from, $lt: to } }),
        {
          $group: {
            _id: {
              coach: "$markedBy",
              status: "$status",
            },

            count: {
              $sum: 1,
            },
          },
        },
      ]),

      Performance.aggregate([
        {
          $match: {
            evaluatedBy: {
              $in: coachIds,
            },

            evaluationDate: {
              $gte: from,
              $lt: to,
            },
          },
        },

        {
          $group: {
            _id: "$evaluatedBy",

            averageRating: {
              $avg: "$rating",
            },

            evaluations: {
              $sum: 1,
            },

            students: {
              $addToSet: "$student",
            },
          },
        },
      ]),
      CoachStudentAssignment.find({ coach: { $in: coachIds }, status: "ACTIVE", ...(isBranchScopedUser(req) ? { branch: getUserBranchId(req) || null } : req.query.branch ? { branch: toObjectId(req.query.branch) } : {}) }).select("coach student branch").lean(),
      BeltHistory.aggregate([{ $match: { approvedBy: { $in: coachIds }, promotedAt: { $gte: from, $lt: to } } }, { $group: { _id: "$approvedBy", count: { $sum: 1 } } }]),
    ]);

    const attendanceMap = new Map();

    attendance.forEach((item) => {
      const coachId = String(item._id.coach);

      if (!attendanceMap.has(coachId)) {
        attendanceMap.set(coachId, {
          total: 0,
          present: 0,
          absent: 0,
        });
      }

      const target = attendanceMap.get(coachId);

      target.total += item.count;

      if (item._id.status === "PRESENT") {
        target.present += item.count;
      }

      if (item._id.status === "ABSENT") {
        target.absent += item.count;
      }
    });

    const performanceMap = new Map();

    performance.forEach((item) => {
      performanceMap.set(String(item._id), item);
    });

    const assignedStudentIds = [...new Set(assignments.map((item) => String(item.student)))];
    const assignedStudents = assignedStudentIds.length ? await Student.find({ _id: { $in: assignedStudentIds } }).select("_id status plan").populate("plan", "programs").lean() : [];
    const assignedStudentMap = new Map(assignedStudents.map((item) => [String(item._id), item]));
    const assignmentMap = new Map();
    assignments.forEach((item) => {
      const id = String(item.coach);
      if (!assignmentMap.has(id)) assignmentMap.set(id, { ids: new Set(), active: 0, completed: 0, programs: new Set() });
      const target = assignmentMap.get(id);
      target.ids.add(String(item.student));
      const studentRecord = assignedStudentMap.get(String(item.student));
      if (studentRecord?.status === "ACTIVE") target.active += 1;
      if (studentRecord?.status === "COMPLETED") target.completed += 1;
      (studentRecord?.plan?.programs || []).forEach((entry) => { if (entry.program) target.programs.add(String(entry.program)); });
    });
    const assignedProgramIds = [...new Set([...assignmentMap.values()].flatMap((item) => [...item.programs]))];
    const programNames = assignedProgramIds.length ? await TrainingSessionType.find({ _id: { $in: assignedProgramIds } }).select("_id name").lean() : [];
    const programNameMap = new Map(programNames.map((item) => [String(item._id), item.name]));
    const promotionsByCoach = new Map(promotionRows.map((item) => [String(item._id), item.count]));

    const data = coaches.map((coach) => {
      const id = String(coach._id);

      const attendanceStats = attendanceMap.get(id) || {
        total: 0,
        present: 0,
        absent: 0,
      };

      const performanceStats = performanceMap.get(id) || {
        averageRating: 0,
        evaluations: 0,
        students: [],
      };
      const assignmentStats = assignmentMap.get(id) || { ids: new Set(), active: 0, completed: 0, programs: new Set() };

      return {
        _id: coach._id,
        name: coach.name,
        email: coach.email,

        branch: coach.branch
          ? {
              _id: coach.branch._id,
              name: coach.branch.name,
            }
          : null,

        attendance: {
          total: attendanceStats.total,
          present: attendanceStats.present,
          absent: attendanceStats.absent,

          attendanceRate: safePercentage(
            attendanceStats.present,
            attendanceStats.total,
          ),
        },

        performance: {
          averageRating: Number(
            Number(performanceStats.averageRating || 0).toFixed(2),
          ),

          evaluations: performanceStats.evaluations,
        },

        studentsEvaluated: performanceStats.students?.length || 0,
        studentsAssigned: assignmentStats.ids.size,
        activeStudents: assignmentStats.active,
        completedStudents: assignmentStats.completed,
        promotions: promotionsByCoach.get(id) || 0,
        programs: [...assignmentStats.programs].map((programId) => ({ _id: programId, name: programNameMap.get(programId) || "Program" })),
      };
    });

    return res.status(200).json({
      success: true,
      data,
      year,
    });
  } catch (error) {
    console.error("getCoachReports error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load coach reports.",
    });
  }
}

async function getAttendanceAnalytics(req, res) {
  try {
    if (!validateRequestedBranch(req, res)) return;
    const { branch, program, coach, student, from: fromValue, to: toValue } = req.query;
    for (const [label, value] of [["branch", branch], ["program", program], ["coach", coach], ["student", student]]) {
      if (value && !isValidObjectId(value)) return res.status(400).json({ success: false, message: `Invalid ${label} filter.` });
    }
    const to = toValue ? new Date(`${toValue}T23:59:59.999+05:30`) : new Date();
    const from = fromValue ? new Date(`${fromValue}T00:00:00+05:30`) : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return res.status(400).json({ success: false, message: "Enter a valid attendance date range." });
    const studentMatch = buildStudentMatch(req);
    if (branch && !isBranchScopedUser(req)) studentMatch.branch = toObjectId(branch);
    if (student) studentMatch._id = toObjectId(student);
    const optionStudentMatch = { ...buildStudentMatch(req) };
    if (branch && !isBranchScopedUser(req)) optionStudentMatch.branch = toObjectId(branch);

    let assignedStudentIds = null;
    const requestedCoach = req.user.role === "COACH" ? String(req.user._id) : coach;
    if (req.user.role === "COACH" && coach && String(coach) !== String(req.user._id)) return res.status(403).json({ success: false, message: "Coaches can only view their own students." });
    if (requestedCoach) {
      const assignmentBranch = isBranchScopedUser(req) ? getUserBranchId(req) : branch;
      const assignments = await CoachStudentAssignment.find({ coach: toObjectId(requestedCoach), status: "ACTIVE", ...(assignmentBranch && isValidObjectId(assignmentBranch) ? { branch: toObjectId(assignmentBranch) } : isBranchScopedUser(req) ? { branch: null } : {}) }).select("student").lean();
      assignedStudentIds = assignments.map((item) => item.student);
      studentMatch._id = { ...(studentMatch._id ? { $eq: studentMatch._id } : {}), $in: assignedStudentIds };
      optionStudentMatch._id = { $in: assignedStudentIds };
    }
    const scopedStudents = await Student.find(studentMatch).select("_id name branch plan status").populate("branch", "_id name").populate("plan", "_id name").lean();
    const scopedIds = scopedStudents.map((item) => item._id);
    const recordMatch = { student: { $in: scopedIds }, date: { $gte: from, $lte: to }, ...(program ? { sessionTypeId: toObjectId(program) } : {}) };
    const [attendanceRows, makeupRows] = await Promise.all([
      scopedIds.length ? Attendance.aggregate([
        ...regularAttendanceStages(recordMatch),
        { $sort: { student: 1, date: -1, createdAt: -1, _id: -1 } },
        { $group: { _id: "$student", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } }, lastAttendedDate: { $max: { $cond: [{ $eq: ["$status", "PRESENT"] }, "$date", null] } }, recentStatuses: { $push: "$status" } } },
      ]) : [],
      scopedIds.length ? Makeup.aggregate([{ $match: { student: { $in: scopedIds }, originalDate: { $gte: from, $lte: to }, ...(program ? { sessionTypeId: toObjectId(program) } : {}) } }, { $group: { _id: { student: "$student", status: "$status" }, count: { $sum: 1 } } }]) : [],
    ]);
    const attendanceByStudent = new Map(attendanceRows.map((item) => [String(item._id), item]));
    const makeupsByStudent = new Map();
    makeupRows.forEach((item) => {
      const id = String(item._id.student);
      if (!makeupsByStudent.has(id)) makeupsByStudent.set(id, { pending: 0, completed: 0 });
      const target = makeupsByStudent.get(id);
      if (item._id.status === "SCHEDULED") target.pending += item.count;
      if (item._id.status === "COMPLETED") target.completed += item.count;
    });
    const rows = scopedStudents.map((record) => {
      const item = attendanceByStudent.get(String(record._id));
      let consecutiveAbsences = 0;
      for (const status of item?.recentStatuses || []) { if (status !== "ABSENT") break; consecutiveAbsences += 1; }
      const total = item?.total || 0;
      const attendanceRate = total ? safePercentage(item.present, total) : null;
      const absenceRate = total ? safePercentage(item.absent, total) : null;
      const makeup = makeupsByStudent.get(String(record._id)) || { pending: 0, completed: 0 };
      const atRisk = total >= 3 && (attendanceRate < 75 || consecutiveAbsences >= 3);
      const riskLevel = !atRisk ? "LOW" : attendanceRate < 50 || consecutiveAbsences >= 4 ? "HIGH" : "MEDIUM";
      return { _id: record._id, name: record.name, branch: record.branch, plan: record.plan, status: record.status, total, present: item?.present || 0, absent: item?.absent || 0, attendanceRate, absenceRate, lastAttendedDate: item?.lastAttendedDate || null, consecutiveAbsences, pendingMakeups: makeup.pending, completedMakeups: makeup.completed, riskLevel };
    }).sort((a, b) => (a.attendanceRate ?? 101) - (b.attendanceRate ?? 101) || b.consecutiveAbsences - a.consecutiveAbsences || a.name.localeCompare(b.name));
    const total = rows.reduce((sum, item) => sum + item.total, 0);
    const present = rows.reduce((sum, item) => sum + item.present, 0);
    const absent = rows.reduce((sum, item) => sum + item.absent, 0);
    const branchFilter = isBranchScopedUser(req) ? { _id: getUserBranchId(req) || null } : {};
    const selectedBranchFilter = isBranchScopedUser(req) ? branchFilter : branch ? { _id: toObjectId(branch) } : branchFilter;
    const scheduleBranchQuery = selectedBranchFilter._id ? { branch: selectedBranchFilter._id } : isBranchScopedUser(req) ? { branch: null } : {};
    const [branchOptions, coachOptions, scheduledTypes] = await Promise.all([
      Branch.find(branchFilter).select("_id name").sort({ name: 1 }).lean(),
      User.find({ role: "COACH", ...(isBranchScopedUser(req) ? { branch: getUserBranchId(req) || null } : branch ? { branch: toObjectId(branch) } : {}), ...(req.user.role === "COACH" ? { _id: req.user._id } : {}) }).select("_id name").sort({ name: 1 }).lean(),
      BranchSchedule.find(scheduleBranchQuery).select("weeklySchedule.slots.sessionTypeId").lean(),
    ]);
    const scheduledProgramIds = scheduledTypes.flatMap((schedule) =>
      (schedule.weeklySchedule || []).flatMap((day) =>
        (day.slots || []).map((slot) => String(slot.sessionTypeId || "")),
      ),
    ).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const programIds = [...new Set(scheduledProgramIds)];
    const programOptions = programIds.length ? await TrainingSessionType.find({ _id: { $in: programIds } }).select("_id name").sort({ name: 1 }).lean() : [];
    const optionStudents = await Student.find(optionStudentMatch).select("_id name").sort({ name: 1 }).limit(500).lean();
    return res.json({ success: true, filters: { branch: branch || null, program: program || null, coach: requestedCoach || null, student: student || null, from, to }, options: { branches: branchOptions, coaches: coachOptions, programs: programOptions, students: optionStudents }, summary: { attendanceRate: safePercentage(present, total), absenceRate: safePercentage(absent, total), total, present, absent, pendingMakeups: rows.reduce((sum, item) => sum + item.pendingMakeups, 0), completedMakeups: rows.reduce((sum, item) => sum + item.completedMakeups, 0), atRiskStudents: rows.filter((item) => item.riskLevel !== "LOW").length }, students: rows, atRiskStudents: rows.filter((item) => item.riskLevel !== "LOW") });
  } catch (error) {
    console.error("Attendance analytics failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load attendance analytics." });
  }
}

/*
|--------------------------------------------------------------------------
| Belt Reports
|--------------------------------------------------------------------------
*/

async function getBeltReports(req, res) {
  try {
    if (!validateRequestedBranch(req, res)) {
      return;
    }

    const { from, to, year } = getYearRange(req.query.year);

    const match = {
      promotedAt: {
        $gte: from,
        $lt: to,
      },

      ...buildBranchMatch(req),
    };

    const [byBelt, byMonth, byFromTo] = await Promise.all([
      BeltHistory.aggregate([
        {
          $match: match,
        },

        {
          $group: {
            _id: "$toBelt",

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            count: -1,
          },
        },
      ]),

      BeltHistory.aggregate([
        {
          $match: match,
        },

        {
          $group: {
            _id: {
              month: {
                $month: { date: "$promotedAt", timezone: REPORT_TIME_ZONE },
              },
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            "_id.month": 1,
          },
        },
      ]),

      BeltHistory.aggregate([
        {
          $match: match,
        },

        {
          $group: {
            _id: {
              from: "$fromBelt",
              to: "$toBelt",
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            count: -1,
          },
        },
      ]),
    ]);

    const monthly = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;

      const record = byMonth.find((item) => item._id.month === month);

      return {
        month: monthName(month),
        count: record?.count || 0,
      };
    });

    const distribution = byBelt.map((item) => ({
      belt: item._id || "Unknown",
      count: item.count,
    }));

    const transitions = byFromTo.map((item) => ({
      from: item._id.from || "Starting",

      to: item._id.to || "Unknown",

      count: item.count,
    }));

    return res.status(200).json({
      success: true,

      data: {
        year,

        totalPromotions: distribution.reduce(
          (sum, item) => sum + item.count,
          0,
        ),

        distribution,
        monthly,
        transitions,
      },
    });
  } catch (error) {
    console.error("getBeltReports error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load belt reports.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Branch List For Filter
|--------------------------------------------------------------------------
*/

async function getReportBranches(req, res) {
  try {
    const filter = {};

    if (isBranchScopedUser(req)) {
      const branchId = getUserBranchId(req);

      if (!isValidObjectId(branchId)) {
        return res.status(200).json({
          success: true,
          data: [],
        });
      }

      filter._id = toObjectId(branchId);
    }

    const branches = await Branch.find(filter)
      .select("_id name status")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: branches,
    });
  } catch (error) {
    console.error("getReportBranches error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load report branches.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Admission Analytics
|--------------------------------------------------------------------------
*/

async function getAdmissionReports(req, res) {
  try {
    if (!validateRequestedBranch(req, res)) {
      return;
    }

    const { from, to, year } = getYearRange(req.query.year);

    const branchMatch = buildBranchMatch(req);

    const inquiryMatch = {
      createdAt: {
        $gte: from,
        $lt: to,
      },
    };

    /*
     * If Inquiry has a branch field, respect the same
     * branch restriction. MongoDB safely ignores the
     * additional field for documents without it.
     */
    if (isBranchScopedUser(req)) {
      const branchId = getUserBranchId(req);

      if (isValidObjectId(branchId)) {
        inquiryMatch.branch = toObjectId(branchId);
      } else {
        inquiryMatch.branch = null;
      }
    } else if (req.query.branch) {
      if (isValidObjectId(req.query.branch)) {
        inquiryMatch.branch = toObjectId(req.query.branch);
      }
    }

    const [monthlyAdmissions, pipeline] = await Promise.all([
      Student.aggregate([
        {
          $match: {
            ...branchMatch,

            joinDate: {
              $gte: from,
              $lt: to,
            },
          },
        },

        {
          $group: {
            _id: {
              month: {
                $month: { date: "$joinDate", timezone: REPORT_TIME_ZONE },
              },
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            "_id.month": 1,
          },
        },
      ]),

      Inquiry
        ? Inquiry.aggregate([
            {
              $match: inquiryMatch,
            },

            {
              $group: {
                _id: "$status",

                count: {
                  $sum: 1,
                },
              },
            },
          ])
        : [],
    ]);

    const monthly = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;

      const item = monthlyAdmissions.find((entry) => entry._id.month === month);

      return {
        month: monthName(month),
        count: item?.count || 0,
      };
    });

    return res.status(200).json({
      success: true,

      data: {
        year,

        newAdmissions: monthlyAdmissions.reduce(
          (sum, item) => sum + item.count,
          0,
        ),

        monthly,

        pipeline: {
          new: pipeline.find((item) => item._id === "NEW")?.count || 0,

          contacted:
            pipeline.find((item) => item._id === "CONTACTED")?.count || 0,

          enrolled:
            pipeline.find((item) => item._id === "ENROLLED")?.count || 0,

          closed: pipeline.find((item) => item._id === "CLOSED")?.count || 0,
        },

        pipelineAvailable: Boolean(Inquiry),
      },
    });
  } catch (error) {
    console.error("getAdmissionReports error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load admission reports.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  getReportsSummary,
  getTopPerformers,
  getSkillCompletionByBelt,
  getBranchReports,
  getCoachReports,
  getAttendanceAnalytics,
  getBeltReports,
  getReportBranches,
  getAdmissionReports,
};

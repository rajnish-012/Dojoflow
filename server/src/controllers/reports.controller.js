const mongoose = require("mongoose");

const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");
const BeltHistory = require("../models/BeltHistory");
const Branch = require("../models/Branch");
const User = require("../models/User");
const Makeup = require("../models/Makeup");

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

function isBranchScopedUser(req) {
  return req.user?.role === "BRANCH_ADMIN" || req.user?.role === "COACH";
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
   * Branch Admin / Coach must always remain inside
   * their own branch.
   */
  if (isBranchScopedUser(req)) {
    return getUserBranchId(req);
  }

  return req.query.branch || null;
}

function buildBranchMatch(req) {
  const branchId = getRequestedBranchId(req);

  if (!branchId) {
    if (isBranchScopedUser(req)) {
      return { _id: null };
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
    from: new Date(`${year}-01-01T00:00:00.000Z`),
    to: new Date(`${year + 1}-01-01T00:00:00.000Z`),
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
|
| GET /api/reports/summary?year=2026&branch=<id>
|
|--------------------------------------------------------------------------
*/

async function getReportsSummary(req, res) {
  try {
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
        {
          $match: attendanceMatch,
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
        {
          $match: attendanceMatch,
        },
        {
          $group: {
            _id: {
              month: {
                $month: "$date",
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
                $month: "$promotedAt",
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
            createdAt: {
              $gte: from,
              $lt: to,
            },
          },
        },
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      Branch.countDocuments({
        status: {
          $ne: "INACTIVE",
        },
        ...(isBranchScopedUser(req)
          ? {
              _id: isValidObjectId(getUserBranchId(req))
                ? toObjectId(getUserBranchId(req))
                : null,
            }
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

    /*
     * Cohort retention:
     * students admitted during the selected year
     * who are still ACTIVE.
     */
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

    /*
     * Monthly attendance.
     */
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
        attendanceRate: safePercentage(present, total),
      };
    });

    /*
     * Monthly promotions.
     */
    const promotionTrend = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;

      const record = monthlyPromotions.find((item) => item._id.month === month);

      return {
        month: monthName(month),
        count: record?.count || 0,
      };
    });

    const makeupStats = {
      scheduled:
        makeupSummary.find((item) => item._id === "SCHEDULED")?.count || 0,

      completed:
        makeupSummary.find((item) => item._id === "COMPLETED")?.count || 0,

      cancelled:
        makeupSummary.find((item) => item._id === "CANCELLED")?.count || 0,
    };

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
|
| Included in /summary.
|
|--------------------------------------------------------------------------
*/

async function getTopPerformers(req, res) {
  try {
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

          ...(req.query.branch && isValidObjectId(req.query.branch)
            ? {
                "student.branch": toObjectId(req.query.branch),
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
|
| "Completed" = performance rating >= 4.
|
|--------------------------------------------------------------------------
*/

async function getSkillCompletionByBelt(req, res) {
  try {
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
          {
            $match: {
              branch: {
                $in: branchIds,
              },
              date: {
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
              createdAt: {
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
*/

async function getCoachReports(req, res) {
  try {
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

    const [attendance, performance] = await Promise.all([
      Attendance.aggregate([
        {
          $match: {
            markedBy: {
              $in: coachIds,
            },
            date: {
              $gte: from,
              $lt: to,
            },
          },
        },
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

/*
|--------------------------------------------------------------------------
| Belt Reports
|--------------------------------------------------------------------------
*/

async function getBeltReports(req, res) {
  try {
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
                $month: "$promotedAt",
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
    const { from, to, year } = getYearRange(req.query.year);

    const branchMatch = buildBranchMatch(req);

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
                $month: "$joinDate",
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
              $match: {
                createdAt: {
                  $gte: from,
                  $lt: to,
                },
              },
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
  getBeltReports,
  getReportBranches,
  getAdmissionReports,
};

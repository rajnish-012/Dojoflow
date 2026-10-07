const { isBranchScoped } = require("../utils/access");

const Student = require("../models/Student");
const Plan = require("../models/Plan");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const Branch = require("../models/Branch");
const TrainingSessionType = require("../models/TrainingSessionType");
const Inquiry = require("../models/Inquiry");
const Trial = require("../models/Trial");
const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const Makeup = require("../models/Makeup");
const { regularAttendanceStages, REPORT_TIME_ZONE } = require("../services/attendanceAnalytics.service");

const INDIA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const localDateStart = (year, month, day) => new Date(Date.UTC(year, month - 1, day) - INDIA_OFFSET_MS);
const parseLocalDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = localDateStart(year, month, day);
  const check = new Date(date.getTime() + INDIA_OFFSET_MS);
  return check.getUTCFullYear() === year && check.getUTCMonth() + 1 === month && check.getUTCDate() === day ? date : null;
};
const hasPermission = (user, permission) =>
  user?.role === "SUPER_ADMIN" || user?.permissions?.includes(permission);

function dashboardDateRange(query) {
  const now = new Date();
  const nowIndia = new Date(now.getTime() + INDIA_OFFSET_MS);
  const from = query.from ? parseLocalDate(query.from) : localDateStart(nowIndia.getUTCFullYear(), 1, 1);
  const toStart = query.to ? parseLocalDate(query.to) : localDateStart(nowIndia.getUTCFullYear(), nowIndia.getUTCMonth() + 1, nowIndia.getUTCDate());
  if (!from || !toStart || from > toStart) return null;
  return { from, to: new Date(toStart.getTime() + 24 * 60 * 60 * 1000), toDate: new Date(toStart.getTime() + 24 * 60 * 60 * 1000 - 1) };
}

async function getExecutiveAnalytics({ filter, studentIds, range, req }) {
  const { from, to, toDate } = range;
  const branchScope = isBranchScoped(req.user) ? { branch: req.user.branch } : {};
  const studentScope = Object.keys(filter).length ? filter : {};
  const attendanceMatch = {
    date: { $gte: from, $lt: to },
    ...(req.user.role === "COACH" ? { student: { $in: studentIds } } : {}),
    ...(isBranchScoped(req.user) ? { branch: req.user.branch } : {}),
  };
  const attendanceFacets = req.user.role !== "COACH" || studentIds.length
    ? await Attendance.aggregate([
        ...regularAttendanceStages(attendanceMatch),
        { $facet: {
          summary: [{ $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } } } }],
          monthly: [{ $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: REPORT_TIME_ZONE } }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } } } }, { $sort: { _id: 1 } }],
          branches: [{ $group: { _id: "$branch", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } } } }, { $lookup: { from: Branch.collection.name, localField: "_id", foreignField: "_id", as: "branch" } }, { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } }, { $project: { _id: 0, name: { $ifNull: ["$branch.name", "Branch"] }, total: 1, present: 1 } }, { $sort: { name: 1 } }],
          programs: [{ $group: { _id: "$sessionTypeId", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } } } }, { $lookup: { from: TrainingSessionType.collection.name, localField: "_id", foreignField: "_id", as: "program" } }, { $unwind: { path: "$program", preserveNullAndEmptyArrays: true } }, { $project: { _id: 0, name: { $ifNull: ["$program.name", "Unassigned"] }, total: 1, present: 1 } }, { $sort: { name: 1 } }],
          risk: [
            { $sort: { date: -1, createdAt: -1, _id: -1 } },
            { $group: { _id: "$student", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } }, statuses: { $push: "$status" }, lastAttended: { $max: { $cond: [{ $eq: ["$status", "PRESENT"] }, "$date", null] } } } },
            { $match: { total: { $gte: 3 } } },
            { $addFields: {
              attendanceRate: { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
              consecutiveAbsences: { $reduce: {
                input: { $slice: ["$statuses", 10] },
                initialValue: { count: 0, continuing: true },
                in: { $cond: [
                  { $and: ["$$value.continuing", { $eq: ["$$this", "ABSENT"] }] },
                  { count: { $add: ["$$value.count", 1] }, continuing: true },
                  { count: "$$value.count", continuing: false },
                ] },
              } },
            } },
            { $match: { $expr: { $or: [{ $lt: ["$attendanceRate", 75] }, { $gte: ["$consecutiveAbsences.count", 3] }] } } },
            { $sort: { attendanceRate: 1, "consecutiveAbsences.count": -1 } },
            { $limit: 10 },
            { $lookup: { from: Student.collection.name, localField: "_id", foreignField: "_id", as: "student" } },
            { $unwind: "$student" },
            { $project: { _id: 1, name: "$student.name", attendanceRate: { $round: ["$attendanceRate", 1] }, consecutiveAbsences: "$consecutiveAbsences.count", lastAttended: 1 } },
          ],
        } },
      ]).allowDiskUse(true)
    : [{ summary: [], monthly: [], branches: [], programs: [], risk: [] }];
  const attendance = attendanceFacets[0] || { summary: [], monthly: [], branches: [], programs: [], risk: [] };
  const attendanceSummary = attendance.summary[0] || { total: 0, present: 0, absent: 0 };
  const atRisk = attendance.risk.map((item) => ({
    student: item.name,
    attendanceRate: item.attendanceRate,
    lastAttended: item.lastAttended,
    consecutiveAbsences: item.consecutiveAbsences,
  }));

  const [studentGrowth, studentStatus, branchDistribution, programDistribution] = await Promise.all([
    Student.aggregate([{ $match: { ...studentScope, joinDate: { $gte: from, $lt: to } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$joinDate", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Student.aggregate([{ $match: studentScope }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Student.aggregate([{ $match: studentScope }, { $group: { _id: "$branch", count: { $sum: 1 } } }, { $lookup: { from: Branch.collection.name, localField: "_id", foreignField: "_id", as: "branch" } }, { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } }, { $project: { _id: 0, name: { $ifNull: ["$branch.name", "Branch"] }, count: 1 } }, { $sort: { count: -1 } }]),
    Student.aggregate([{ $match: { ...studentScope, status: "ACTIVE" } }, { $lookup: { from: Plan.collection.name, localField: "plan", foreignField: "_id", as: "plan" } }, { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } }, { $unwind: { path: "$plan.programs", preserveNullAndEmptyArrays: true } }, { $group: { _id: "$plan.programs.program", count: { $sum: 1 } } }, { $lookup: { from: TrainingSessionType.collection.name, localField: "_id", foreignField: "_id", as: "program" } }, { $unwind: { path: "$program", preserveNullAndEmptyArrays: true } }, { $project: { _id: 0, name: { $ifNull: ["$program.name", "Unassigned"] }, count: 1 } }, { $sort: { count: -1 } }]),
  ]);
  const statusCounts = Object.fromEntries(studentStatus.map((row) => [row._id, row.count]));

  const canFinance = hasPermission(req.user, "finance.view") || hasPermission(req.user, "finance.manage");
  const canAdmissions = hasPermission(req.user, "inquiry.view") || hasPermission(req.user, "inquiry.manage");
  const financeStudentFilter = req.user.role === "COACH" ? { student: { $in: studentIds } } : {};
  let financial = { available: canFinance, revenue: null, outstanding: null, monthlyRevenue: [], branchRevenue: [], programRevenue: [], collectionOutstanding: [] };
  if (canFinance) {
    const paymentMatch = { ...branchScope, ...financeStudentFilter, paymentDate: { $gte: from, $lt: to }, kind: { $in: ["PAYMENT", "REFUND"] }, status: "COMPLETED" };
    const revenueExpression = { $cond: [{ $eq: ["$direction", "CREDIT"] }, "$amount", { $multiply: ["$amount", -1] }] };
    const [revenue, monthlyRevenue, branchRevenue, programRevenue, outstanding] = await Promise.all([
      Payment.aggregate([{ $match: paymentMatch }, { $group: { _id: null, amount: { $sum: revenueExpression } } }]),
      Payment.aggregate([{ $match: paymentMatch }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate", timezone: REPORT_TIME_ZONE } }, amount: { $sum: revenueExpression } } }, { $sort: { _id: 1 } }]),
      Payment.aggregate([{ $match: paymentMatch }, { $group: { _id: "$branch", amount: { $sum: revenueExpression } } }, { $lookup: { from: Branch.collection.name, localField: "_id", foreignField: "_id", as: "branch" } }, { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } }, { $project: { _id: 0, name: { $ifNull: ["$branch.name", "Branch"] }, amount: 1 } }, { $sort: { amount: -1 } }]),
      Payment.aggregate([{ $match: paymentMatch }, { $lookup: { from: Invoice.collection.name, localField: "invoice", foreignField: "_id", as: "invoice" } }, { $unwind: "$invoice" }, { $unwind: { path: "$invoice.items", preserveNullAndEmptyArrays: true } }, { $group: { _id: "$invoice.items.program", amount: { $sum: { $multiply: [revenueExpression, { $cond: [{ $gt: ["$invoice.subtotal", 0] }, { $divide: [{ $ifNull: ["$invoice.items.amount", 0] }, "$invoice.subtotal"] }, 0] }] } } } }, { $lookup: { from: TrainingSessionType.collection.name, localField: "_id", foreignField: "_id", as: "program" } }, { $unwind: { path: "$program", preserveNullAndEmptyArrays: true } }, { $project: { _id: 0, name: { $ifNull: ["$program.name", "Unassigned"] }, amount: 1 } }, { $sort: { amount: -1 } }]),
      Invoice.aggregate([
        { $match: { ...branchScope, ...financeStudentFilter, issuedAt: { $lte: toDate }, status: { $in: ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"] } } },
        { $lookup: {
          from: Payment.collection.name,
          let: { invoiceId: "$_id", asOf: toDate },
          pipeline: [
            { $match: { status: "COMPLETED", $expr: { $and: [{ $eq: ["$invoice", "$$invoiceId"] }, { $lte: ["$paymentDate", "$$asOf"] }] } } },
            { $group: { _id: null, paid: { $sum: { $cond: [{ $eq: ["$direction", "CREDIT"] }, "$amount", { $multiply: ["$amount", -1] }] } } } },
          ],
          as: "paymentsAsOf",
        } },
        { $set: { paidAsOf: { $ifNull: [{ $arrayElemAt: ["$paymentsAsOf.paid", 0] }, 0] } } },
        { $set: { outstandingAsOf: { $max: [0, { $subtract: ["$total", "$paidAsOf"] }] } } },
        { $group: { _id: null, amount: { $sum: "$outstandingAsOf" } } },
      ]),
    ]);
    financial = { available: true, revenue: Number((revenue[0]?.amount || 0).toFixed(2)), outstanding: Number((outstanding[0]?.amount || 0).toFixed(2)), monthlyRevenue, branchRevenue, programRevenue, collectionOutstanding: [{ name: "Collected", amount: Number((revenue[0]?.amount || 0).toFixed(2)) }, { name: "Outstanding", amount: Number((outstanding[0]?.amount || 0).toFixed(2)) }] };
  }

  let admissions = { available: canAdmissions, leads: 0, contacted: 0, trials: 0, trialCompleted: 0, interested: 0, converted: 0, lost: 0, conversionRate: 0, funnel: [] };
  if (canAdmissions) {
    const leadMatch = { ...branchScope, createdAt: { $gte: from, $lt: to }, ...(req.user.role === "COACH" ? { assignedTo: req.user._id } : {}) };
    const [leadStats, trialStats, convertedInRange] = await Promise.all([
      Inquiry.aggregate([{ $match: leadMatch }, { $project: { status: 1, stages: { $setUnion: [{ $concatArrays: [{ $ifNull: ["$statusHistory.to", []] }, ["$status"]] }, []] } } }, { $group: { _id: null, leads: { $sum: 1 }, contacted: { $sum: { $cond: [{ $gt: [{ $size: { $setIntersection: ["$stages", ["CONTACTED", "TRIAL_SCHEDULED", "TRIAL_COMPLETED", "INTERESTED", "CONVERTED", "ENROLLED", "LOST", "NOT_INTERESTED"]] } }, 0] }, 1, 0] } }, trials: { $sum: { $cond: [{ $gt: [{ $size: { $setIntersection: ["$stages", ["TRIAL_SCHEDULED", "TRIAL_COMPLETED"]] } }, 0] }, 1, 0] } }, trialCompleted: { $sum: { $cond: [{ $in: ["TRIAL_COMPLETED", "$stages"] }, 1, 0] } }, interested: { $sum: { $cond: [{ $in: ["INTERESTED", "$stages"] }, 1, 0] } }, converted: { $sum: { $cond: [{ $or: [{ $in: ["CONVERTED", "$stages"] }, { $in: ["ENROLLED", "$stages"] }] }, 1, 0] } }, lost: { $sum: { $cond: [{ $or: [{ $in: ["LOST", "$stages"] }, { $in: ["NOT_INTERESTED", "$stages"] }] }, 1, 0] } } } }]),
      Trial.aggregate([{ $match: { ...branchScope, ...(req.user.role === "COACH" ? { coach: req.user._id } : {}), trialDate: { $gte: from, $lt: to }, status: { $ne: "CANCELLED" } } }, { $group: { _id: null, trials: { $sum: 1 }, completed: { $sum: { $cond: [{ $in: ["$status", ["COMPLETED", "CONVERTED"]] }, 1, 0] } } } }]),
      Inquiry.countDocuments({
        ...leadMatch,
        $or: [
          { status: { $in: ["CONVERTED", "ENROLLED"] }, convertedAt: { $gte: from, $lt: to } },
          { status: { $in: ["CONVERTED", "ENROLLED"] }, convertedAt: null, updatedAt: { $gte: from, $lt: to } },
          { statusHistory: { $elemMatch: { to: { $in: ["CONVERTED", "ENROLLED"] }, changedAt: { $gte: from, $lt: to } } } },
        ],
      }),
    ]);
    const lead = leadStats[0] || {};
    const trial = trialStats[0] || {};
    lead.converted = convertedInRange;
    const funnel = [
      { name: "Leads", count: lead.leads || 0 }, { name: "Contacted", count: lead.contacted || 0 },
      { name: "Trials", count: trial.trials || 0 }, { name: "Trial completed", count: trial.completed || 0 },
      { name: "Interested", count: lead.interested || 0 }, { name: "Converted", count: lead.converted || 0 }, { name: "Lost", count: lead.lost || 0 },
    ];
    admissions = { available: true, ...lead, trials: trial.trials || 0, trialCompleted: trial.completed || 0, conversionRate: lead.leads ? Number((((lead.converted || 0) / lead.leads) * 100).toFixed(1)) : 0, funnel };
  }

  const [newStudents, admissionsCount, expiring, expired, renewed, pendingMakeups] = await Promise.all([
    Student.countDocuments({ ...studentScope, registrationDate: { $gte: from, $lt: to } }),
    Student.countDocuments({ ...studentScope, joinDate: { $gte: from, $lt: to } }),
    Student.aggregate([{ $match: studentScope }, { $unwind: "$planEnrollments" }, { $match: { "planEnrollments.status": "ACTIVE", "planEnrollments.endDate": { $gte: from, $lt: to } } }, { $count: "count" }]),
    Student.aggregate([{ $match: studentScope }, { $unwind: "$planEnrollments" }, { $match: { "planEnrollments.status": "EXPIRED", "planEnrollments.endDate": { $gte: from, $lt: to } } }, { $count: "count" }]),
    Student.aggregate([{ $match: studentScope }, { $unwind: "$planEnrollments" }, { $match: { "planEnrollments.enrollmentSource": "RENEWAL", "planEnrollments.startDate": { $gte: from, $lt: to } } }, { $count: "count" }]),
    Makeup.countDocuments({ ...branchScope, ...(req.user.role === "COACH" ? { student: { $in: studentIds } } : {}), status: "SCHEDULED", createdAt: { $gte: from, $lt: to } }),
  ]);
  const expiredCount = expired[0]?.count || 0;
  const renewedCount = renewed[0]?.count || 0;
  const trialCount = admissions.available ? admissions.trials : 0;
  const attendanceRate = attendanceSummary.total ? Number(((attendanceSummary.present / attendanceSummary.total) * 100).toFixed(1)) : 0;
  const conversionRate = admissions.available ? admissions.conversionRate : null;
  return {
    dateRange: { from, to: toDate },
    kpis: { activeStudents: statusCounts.ACTIVE || 0, newStudents, admissions: admissionsCount, trials: trialCount, conversionRate, revenue: financial.revenue, outstandingFees: financial.outstanding, attendanceRate, expiringMemberships: expiring[0]?.count || 0, pendingMakeups },
    studentAnalytics: { growth: studentGrowth, activeInactive: [{ name: "Active", count: statusCounts.ACTIVE || 0 }, { name: "Inactive", count: statusCounts.INACTIVE || 0 }], branches: branchDistribution, programs: programDistribution },
    financialAnalytics: financial,
    attendanceAnalytics: { present: attendanceSummary.present, absent: attendanceSummary.absent, rateTrend: attendance.monthly.map((row) => ({ month: row._id, rate: row.present + row.absent ? Number(((row.present / (row.present + row.absent)) * 100).toFixed(1)) : 0 })), branches: attendance.branches.map((row) => ({ ...row, rate: row.total ? Number(((row.present / row.total) * 100).toFixed(1)) : 0 })), programs: attendance.programs.map((row) => ({ ...row, rate: row.total ? Number(((row.present / row.total) * 100).toFixed(1)) : 0 })), atRisk },
    admissions,
    renewals: { expiring: expiring[0]?.count || 0, expired: expiredCount, renewed: renewedCount, renewalRate: expiredCount + renewedCount ? Number(((renewedCount / (expiredCount + renewedCount)) * 100).toFixed(1)) : 0 },
  };
}

// ==============================
// GET DASHBOARD SUMMARY
// ==============================

const getDashboard = async (req, res) => {
  try {
    const range = dashboardDateRange(req.query || {});
    if (!range) {
      return res.status(400).json({ success: false, message: "Enter a valid India-local date range." });
    }
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

    const executiveStudentIds = req.user.role === "COACH"
      ? await Student.distinct("_id", filter)
      : [];
    const executive = await getExecutiveAnalytics({
      filter,
      studentIds: executiveStudentIds,
      range,
      req,
    });

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

    const indiaNow = new Date(Date.now() + INDIA_OFFSET_MS);
    const startOfDay = localDateStart(
      indiaNow.getUTCFullYear(),
      indiaNow.getUTCMonth() + 1,
      indiaNow.getUTCDate(),
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

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
      attendanceType: { $ne: "MAKEUP" },
      status: "PRESENT",
    });

    const todayAbsent = await Attendance.countDocuments({
      ...attendanceFilter,
      attendanceType: { $ne: "MAKEUP" },
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
        executive,
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

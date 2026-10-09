const mongoose = require("mongoose");

const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Makeup = require("../models/Makeup");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const { isBranchScoped } = require("../utils/access");
const { findEnrollmentForDate } = require("../services/enrollmentLifecycle.service");
const { resolveEnrollmentFirstAttendedClassDate } = require("../services/enrollmentAttendance.service");
const { getProgramLearningProgress } = require("../services/programProgress.service");
const { resolveProgramCurriculum } = require("../services/curriculumResolver.service");
const { withAttendanceSessionDetails } = require("../utils/attendanceSession");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const BeltHistory = require("../models/BeltHistory");
const StudentCurriculumMilestone = require("../models/StudentCurriculumMilestone");

/* ============================================================
   DATE HELPERS
============================================================ */

/*
 * Important:
 * Do NOT use:
 *
 * new Date("2026-09-16")
 *
 * because JavaScript interprets YYYY-MM-DD as UTC.
 *
 * In India this can become 15 September when converted to
 * local time.
 *
 * We treat YYYY-MM-DD as a calendar date.
 */
function parseCalendarDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      return new Date(year, month - 1, day);
    }
  }

  const original = new Date(value);

  if (Number.isNaN(original.getTime())) {
    return null;
  }

  /*
   * Use the calendar components rather than blindly calling
   * setHours() on a UTC-parsed date.
   */
  return new Date(
    original.getFullYear(),
    original.getMonth(),
    original.getDate(),
  );
}

function startOfDay(value) {
  return parseCalendarDate(value);
}

function addDays(date, days) {
  const result = new Date(date);

  result.setDate(result.getDate() + Number(days));

  return result;
}

function formatDate(date) {
  const value = parseCalendarDate(date);

  if (!value) {
    return null;
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateKey(value) {
  return formatDate(value);
}

/*
 * Compare calendar dates without time.
 */
function isBeforeDate(a, b) {
  const first = startOfDay(a);
  const second = startOfDay(b);

  if (!first || !second) {
    return false;
  }

  return first.getTime() < second.getTime();
}

/* ============================================================
   ATTENDANCE STATE
============================================================ */

function getAttendanceState(record) {
  if (!record) {
    return "UPCOMING";
  }

  if (record.status === "PRESENT") {
    return "COMPLETED";
  }

  if (
    record.status === "ABSENT" &&
    record.makeupRequired &&
    record.makeupCompleted
  ) {
    return "MAKEUP_COMPLETED";
  }

  if (record.status === "ABSENT") {
    return "MISSED";
  }

  return "UPCOMING";
}

function getStatusLabel(status) {
  switch (status) {
    case "COMPLETED":
      return "Completed";

    case "MAKEUP_COMPLETED":
      return "Makeup completed";

    case "MISSED":
      return "Missed";

    case "UPCOMING":
      return "Upcoming";

    default:
      return "Upcoming";
  }
}

/* ============================================================
   COACH ACCESS
============================================================ */

async function checkCoachStudentAccess(req, studentId) {
  /*
   * Coach assignment is a business-level restriction.
   *
   * It intentionally remains based on the actual COACH role.
   * This is separate from branch/data-scope authorization.
   */
  if (req.user.role !== "COACH") {
    return true;
  }

  const assignment = await CoachStudentAssignment.findOne({
    coach: req.user._id,
    student: studentId,
    status: "ACTIVE",
  }).select("_id");

  return Boolean(assignment);
}

/* ============================================================
   GET STUDENT TRAINING TIMELINE
   GET /api/students/:id/timeline
============================================================ */

const getStudentTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    /* --------------------------------------------------------
       Validate student ID
    -------------------------------------------------------- */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    /* --------------------------------------------------------
       Get student
    -------------------------------------------------------- */

    const student = await Student.findById(id)
      .populate("branch", "name address")
      .populate("plan")
      .populate("plan.programs.program", "name")
      .populate("planEnrollments.programs.program", "name");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /* --------------------------------------------------------
       Coach assignment access
    -------------------------------------------------------- */

    const hasCoachAccess = await checkCoachStudentAccess(
      req,
      student._id,
    );

    if (!hasCoachAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    /* --------------------------------------------------------
       Database-backed branch/data-scope access
    -------------------------------------------------------- */

    /*
     * ALL-scope roles can access students across branches.
     *
     * BRANCH-scope roles can access only students belonging
     * to their assigned branch.
     *
     * This deliberately does NOT check:
     *
     *   SUPER_ADMIN
     *   BRANCH_ADMIN
     *   COACH
     *
     * because data scope belongs to the database Role record.
     */
    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      if (
        !student.branch?._id ||
        student.branch._id.toString() !==
          req.user.branch.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this student",
        });
      }
    }

    /* --------------------------------------------------------
       Training plan
    -------------------------------------------------------- */

    if (!student.plan) {
      return res.status(400).json({
        success: false,
        message: "Student does not have a training plan",
      });
    }

    const plan = student.plan;
    const today = startOfDay(new Date());
    const enrollment = findEnrollmentForDate(student.planEnrollments, today);
    const programs = enrollment?.programs?.length ? enrollment.programs : (plan.programs || []);
    const requestedProgramId = req.query.programId;
    const selectedEntitlement = requestedProgramId
      ? programs.find((item) => String(item.program?._id || item.program) === String(requestedProgramId))
      : programs[0];
    if (requestedProgramId && !selectedEntitlement) return res.status(404).json({ success: false, message: "Program is not included in the student's active plan." });
    if (!selectedEntitlement?.program) return res.status(409).json({ success: false, message: "Assign at least one training program to the student's plan before viewing a program timeline." });
    const selectedProgramId = selectedEntitlement.program?._id || selectedEntitlement.program;
    const configuredProgram = (plan.programs || []).find((item) => String(item.program?._id || item.program) === String(selectedProgramId));

    /* --------------------------------------------------------
       Curriculum
    -------------------------------------------------------- */

    const sourceCurriculum = resolveProgramCurriculum(selectedEntitlement, configuredProgram, plan.curriculum);
    const curriculum = Array.isArray(sourceCurriculum)
      ? [...sourceCurriculum].sort(
          (a, b) => Number(a.day) - Number(b.day),
        )
      : [];

    /* --------------------------------------------------------
       Milestones
    -------------------------------------------------------- */

    const curriculumMilestones = enrollment?._id && selectedEntitlement.curriculumVersion
      ? await StudentCurriculumMilestone.find({ student: student._id, enrollment: enrollment._id, program: selectedProgramId, curriculum: selectedEntitlement.curriculumVersion }).sort({ criteriaMetAt: -1, createdAt: -1 }).lean()
      : [];

    /* --------------------------------------------------------
       JOIN DATE
       
       IMPORTANT:
       Day 1 = student's actual join date.
    -------------------------------------------------------- */

    const joinDate = startOfDay(student.joinDate);

    if (!joinDate) {
      return res.status(400).json({
        success: false,
        message: "Student does not have a valid join date",
      });
    }

    /* --------------------------------------------------------
       Attendance

       Only attendance on or after the student's join date
       should participate in progress calculation.
    -------------------------------------------------------- */

    const dateRange = { ...(enrollment?.startDate ? { $gte: enrollment.startDate } : {}), ...(enrollment?.endDate ? { $lt: enrollment.endDate } : {}), $lte: new Date() };
    const enrollmentScope = enrollment?._id
      ? { $or: [{ enrollment: enrollment._id, date: dateRange }, { enrollment: null, date: dateRange }] }
      : { date: { $lte: new Date() } };
    const attendanceRecords = await Attendance.find({
      student: student._id,
      sessionTypeId: selectedProgramId,
      ...enrollmentScope,
    }).sort({
      date: 1,
      createdAt: 1,
      _id: 1,
    }).lean();
    const allAttendance = await withAttendanceSessionDetails(
      attendanceRecords,
      student.branch?._id || student.branch,
    );

    const attendance = allAttendance.filter((record) => {
      if (!record.date || record.attendanceType === "MAKEUP") {
        return false;
      }

      return !isBeforeDate(record.date, joinDate);
    });

    /* --------------------------------------------------------
       Attendance by plan day
    -------------------------------------------------------- */

    const attendanceByDay = new Map();

    const consumedAttendanceDates = new Set();
    attendance.forEach((record) => {
      const dateKey = formatDate(record.date);
      if (!dateKey || consumedAttendanceDates.has(dateKey)) return;
      consumedAttendanceDates.add(dateKey);
      const day = Number(record.planDay);

      if (!Number.isFinite(day) || day <= 0) {
        return;
      }

      /*
       * Keep the latest record for a plan day.
       */
      attendanceByDay.set(day, record);
    });

    /* --------------------------------------------------------
       Makeup records
    -------------------------------------------------------- */

    const makeupRecords = await Makeup.find({
      student: student._id,
      sessionTypeId: selectedProgramId,
      ...(enrollment?._id ? { $or: [{ enrollment: enrollment._id, originalDate: dateRange }, { enrollment: null, originalDate: dateRange }] } : {}),
    })
      .select(
        "planDay originalDate makeupDate status curriculumTitle",
      )
      .sort({
        originalDate: 1,
      });

    const makeupByDay = new Map();

    makeupRecords.forEach((record) => {
      const day = Number(record.planDay);

      if (!Number.isFinite(day) || day <= 0) {
        return;
      }

      makeupByDay.set(day, record);
    });

    /* ========================================================
       BUILD TIMELINE
    ======================================================== */

    const timeline = curriculum.map((item) => {
      const day = Number(item.day);

      const attendanceRecord =
        attendanceByDay.get(day) || null;

      const makeupRecord =
        makeupByDay.get(day) || null;

      const status =
        getAttendanceState(attendanceRecord);

      /*
       * The displayed date is the actual attendance or recovery date.
       */
      const date = attendanceRecord?.date || makeupRecord?.makeupDate || makeupRecord?.originalDate || null;

      return {
        day,

        date: date ? formatDate(date) : null,

        type: "TRAINING",

        title:
          item.title ||
          `Training Day ${day}`,

        description:
          item.description || "",

        skill:
          item.skill || "",

        status,

        statusLabel:
          getStatusLabel(status),

        attendance: attendanceRecord
          ? {
              _id: attendanceRecord._id,

              date: formatDate(
                attendanceRecord.date,
              ),

              status:
                attendanceRecord.status,

              sessionName:
                attendanceRecord.sessionName || "",

              sessionStartTime:
                attendanceRecord.sessionStartTime || "",

              sessionEndTime:
                attendanceRecord.sessionEndTime || "",

              attendanceType: "REGULAR",

              makeupRequired:
                Boolean(
                  attendanceRecord.makeupRequired,
                ),

              makeupCompleted:
                Boolean(
                  attendanceRecord.makeupCompleted,
                ),
            }
          : null,

        makeup: makeupRecord
          ? {
              _id: makeupRecord._id,

              status:
                makeupRecord.status,

              originalDate:
                formatDate(
                  makeupRecord.originalDate,
                ),

              makeupDate:
                formatDate(
                  makeupRecord.makeupDate,
                ),
            }
          : null,

        milestone: null,
      };
    });

    /* --------------------------------------------------------
       Sort timeline
    -------------------------------------------------------- */

    timeline.sort(
      (a, b) => a.day - b.day,
    );

    /* ========================================================
       CURRENT TRAINING DAY
    ======================================================== */

    const learning = await getProgramLearningProgress({ studentId: student._id, programId: selectedProgramId, enrollmentId: enrollment?._id, enrollmentStartDate: enrollment?.startDate, enrollmentEndDate: enrollment?.endDate, curriculum, asOfDate: today });
    const currentTrainingDay = learning.currentTrainingDay;
    const currentBelt = student.programBelts?.find((item) => String(item.program) === String(selectedProgramId))?.belt || (programs.length === 1 ? student.currentBelt : enrollment?.startingBelt) || plan.startingBelt || "White";

    // Read the student's activity from its source records; no duplicate event log is stored.
    const canViewFinance = req.user.role === "SUPER_ADMIN" || (req.user.permissions || []).includes("finance.view");
    const [activityAttendance, activityMakeups, beltHistory, invoices, payments] = await Promise.all([
      Attendance.find({ student: student._id }).select("_id date status sessionName attendanceType createdAt").sort({ date: -1 }).limit(200).lean(),
      Makeup.find({ student: student._id }).select("_id status originalDate makeupDate createdAt").sort({ createdAt: -1 }).limit(100).lean(),
      BeltHistory.find({ student: student._id }).select("_id fromBelt toBelt promotedAt createdAt").sort({ promotedAt: -1 }).limit(100).lean(),
      canViewFinance ? Invoice.find({ student: student._id }).select("_id invoiceNumber status total createdAt issuedAt").sort({ createdAt: -1 }).limit(100).lean() : [],
      canViewFinance ? Payment.find({ student: student._id }).select("_id amount kind paymentDate createdAt").sort({ paymentDate: -1 }).limit(100).lean() : [],
    ]);
    const activity = [{ type: "REGISTRATION", title: "Student registered", date: student.registrationDate || student.createdAt, details: student.name }];
    curriculumMilestones.forEach((item) => activity.push({ type: "CURRICULUM_MILESTONE", title: item.status === "EARNED" ? `Milestone earned: ${item.milestoneName}` : `Milestone awaiting approval: ${item.milestoneName}`, date: item.earnedAt || item.criteriaMetAt, details: item.milestoneCriteria || item.milestoneDescription || "" }));
    (student.planEnrollments || []).forEach((item) => {
      activity.push({ type: item.enrollmentSource === "RENEWAL" ? "RENEWAL" : "ENROLLMENT", title: item.enrollmentSource === "RENEWAL" ? "Enrollment renewed" : "Enrollment started", date: item.startDate || item.createdAt, details: item.plan?.name || item.enrollmentSource || "Plan" });
      (item.statusHistory || []).forEach((change) => activity.push({ type: "STATUS_CHANGE", title: `Enrollment ${String(change.to).toLowerCase()}`, date: change.changedAt, details: change.note || [change.from, change.to].filter(Boolean).join(" → ") }));
    });
    activityAttendance.forEach((item) => activity.push({ type: item.status === "ABSENT" ? "ABSENCE" : "ATTENDANCE", title: item.status === "ABSENT" ? "Class absence" : "Class attended", date: item.date || item.createdAt, details: item.sessionName || "Training session" }));
    activityMakeups.forEach((item) => activity.push({ type: "MAKEUP", title: `Makeup ${String(item.status).toLowerCase()}`, date: item.makeupDate || item.createdAt || item.originalDate, details: item.status }));
    beltHistory.forEach((item) => activity.push({ type: "PROMOTION", title: `Promoted to ${item.toBelt}`, date: item.promotedAt || item.createdAt, details: item.fromBelt ? `${item.fromBelt} → ${item.toBelt}` : item.toBelt }));
    invoices.forEach((item) => activity.push({ type: "INVOICE", title: `Invoice ${item.invoiceNumber}`, date: item.issuedAt || item.createdAt, details: `${item.status} · ${item.total}` }));
    payments.forEach((item) => activity.push({ type: "PAYMENT", title: item.kind === "REFUND" ? "Payment refunded" : "Payment received", date: item.paymentDate || item.createdAt, details: String(item.amount) }));
    const activityTimeline = activity.filter((item) => item.date && !Number.isNaN(new Date(item.date).getTime())).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 250);

    /* --------------------------------------------------------
       Current milestone
    -------------------------------------------------------- */

    const currentMilestone = curriculumMilestones.find((item) => item.status === "EARNED") || null;
    const nextMilestone = curriculumMilestones.find((item) => item.status === "PENDING_APPROVAL") || curriculumMilestones.find((item) => item.status === "EARNED" && (item.rewards || []).some((reward) => ["AWAITING_GRADING", "AWAITING_PROMOTION_APPROVAL"].includes(reward.status))) || null;
    const milestoneSummary = (item) => item ? {
      belt: (item.rewards || []).find((reward) => reward.type === "BELT_PROGRESSION")?.targetBelt || "",
      skill: item.milestoneName || "",
      description: item.milestoneDescription || item.milestoneCriteria || "",
      status: item.status === "PENDING_APPROVAL" ? "AWAITING_APPROVAL" : ((item.rewards || []).find((reward) => reward.type === "BELT_PROGRESSION")?.status || item.status),
    } : null;

    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({
      success: true,

      student: {
        _id: student._id,

        name: student.name,

        currentBelt:
          currentBelt,

        joinDate:
          formatDate(
            student.joinDate,
          ),

        firstAttendedClassDate: enrollment
          ? formatDate(await resolveEnrollmentFirstAttendedClassDate({ studentId: student._id, enrollment }))
          : null,

        status:
          student.status,

        branch: student.branch
          ? {
              _id:
                student.branch._id,

              name:
                student.branch.name,

              address:
                student.branch.address,
            }
          : null,

        plan: {
          _id: plan._id,

          name: plan.name,

          startingBelt:
            plan.startingBelt || "",

          duration:
            plan.duration || null,

          durationUnit:
            plan.durationUnit || "",

          classesPerWeek:
            plan.classesPerWeek ||
            null,
        },
        program: selectedEntitlement.program,
        programs: programs.map((item) => item.program),
      },

      summary: {
        totalTrainingDays:
          curriculum.length,

        program: selectedEntitlement.program,

        totalMilestones:
          curriculumMilestones.length,

        completedTrainingDay:
          currentTrainingDay,

        currentBelt:
          currentBelt,

        currentMilestone: milestoneSummary(currentMilestone),
        nextMilestone: nextMilestone ? { ...milestoneSummary(nextMilestone), date: null } : null,

        today:
          formatDate(today),
      },

      timeline,
      activity: activityTimeline,
    });
  } catch (error) {
    console.error(
      "Get student timeline error:",
      error,
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to generate student timeline",
    });
  }
};

module.exports = {
  getStudentTimeline,
};

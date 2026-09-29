const mongoose = require("mongoose");

const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Makeup = require("../models/Makeup");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");

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

function getTimelineType(item, milestoneDays) {
  if (milestoneDays.has(item.day)) {
    return "MILESTONE";
  }

  return "TRAINING";
}

/* ============================================================
   COACH ACCESS
============================================================ */

async function checkCoachStudentAccess(req, studentId) {
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
      .populate("plan");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /* --------------------------------------------------------
       Coach assignment access
    -------------------------------------------------------- */

    const hasCoachAccess = await checkCoachStudentAccess(req, student._id);

    if (!hasCoachAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    /* --------------------------------------------------------
       Branch-level access
    -------------------------------------------------------- */

    if (
      req.user.role !== "SUPER_ADMIN" &&
      req.user.role !== "COACH" &&
      student.branch?._id?.toString() !== req.user.branch?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
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

    /* --------------------------------------------------------
       Curriculum
    -------------------------------------------------------- */

    const curriculum = Array.isArray(plan.curriculum)
      ? [...plan.curriculum].sort((a, b) => Number(a.day) - Number(b.day))
      : [];

    /* --------------------------------------------------------
       Milestones
    -------------------------------------------------------- */

    const milestones = Array.isArray(plan.milestones)
      ? [...plan.milestones].sort((a, b) => Number(a.day) - Number(b.day))
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

       This protects us from old/incorrect records such as:

       15 Sep → planDay 6
       16 Sep → join date
       -------------------------------------------------------- */

    const allAttendance = await Attendance.find({
      student: student._id,
    }).sort({
      date: 1,
      planDay: 1,
    });

    const attendance = allAttendance.filter((record) => {
      if (!record.date) {
        return false;
      }

      return !isBeforeDate(record.date, joinDate);
    });

    /* --------------------------------------------------------
       Attendance by plan day
    -------------------------------------------------------- */

    const attendanceByDay = new Map();

    attendance.forEach((record) => {
      const day = Number(record.planDay);

      if (!Number.isFinite(day) || day <= 0) {
        return;
      }

      /*
       * Keep the latest record for a plan day.
       * This avoids an older incorrect record replacing
       * the current attendance state.
       */
      attendanceByDay.set(day, record);
    });

    /* --------------------------------------------------------
       Makeup records
    -------------------------------------------------------- */

    const makeupRecords = await Makeup.find({
      student: student._id,
    })
      .select("planDay originalDate makeupDate status curriculumTitle")
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

    /* --------------------------------------------------------
       Milestone days
    -------------------------------------------------------- */

    const milestoneDays = new Set(
      milestones.map((milestone) => Number(milestone.day)),
    );

    /* ========================================================
       BUILD TIMELINE
    ======================================================== */

    const timeline = curriculum.map((item) => {
      const day = Number(item.day);

      const attendanceRecord = attendanceByDay.get(day) || null;

      const makeupRecord = makeupByDay.get(day) || null;

      const status = getAttendanceState(attendanceRecord);

      /*
       * CORRECT DATE CALCULATION:
       *
       * Day 1 = join date
       * Day 2 = join date + 1
       * Day 3 = join date + 2
       */

      const date = addDays(joinDate, day - 1);

      const milestone = milestones.find((entry) => Number(entry.day) === day);

      return {
        day,

        date: formatDate(date),

        type: getTimelineType(item, milestoneDays),

        title: item.title || `Training Day ${day}`,

        description: item.description || "",

        skill: item.skill || "",

        status,

        statusLabel: getStatusLabel(status),

        attendance: attendanceRecord
          ? {
              _id: attendanceRecord._id,
              date: formatDate(attendanceRecord.date),
              status: attendanceRecord.status,
              makeupRequired: Boolean(attendanceRecord.makeupRequired),
              makeupCompleted: Boolean(attendanceRecord.makeupCompleted),
            }
          : null,

        makeup: makeupRecord
          ? {
              _id: makeupRecord._id,
              status: makeupRecord.status,
              originalDate: formatDate(makeupRecord.originalDate),
              makeupDate: formatDate(makeupRecord.makeupDate),
            }
          : null,

        milestone: milestone
          ? {
              day: Number(milestone.day),
              belt: milestone.belt || "",
              skill: milestone.skill || "",
              description: milestone.description || "",
            }
          : null,
      };
    });

    /* ========================================================
       ADD MILESTONES WITHOUT CURRICULUM
    ======================================================== */

    milestones.forEach((milestone) => {
      const day = Number(milestone.day);

      const exists = timeline.some((item) => item.day === day);

      if (exists) {
        return;
      }

      const attendanceRecord = attendanceByDay.get(day) || null;

      const makeupRecord = makeupByDay.get(day) || null;

      const status = getAttendanceState(attendanceRecord);

      const date = addDays(joinDate, day - 1);

      timeline.push({
        day,

        date: formatDate(date),

        type: "MILESTONE",

        title: milestone.belt
          ? `${milestone.belt} Belt Milestone`
          : `Milestone Day ${day}`,

        description: milestone.description || "",

        skill: milestone.skill || "",

        status,

        statusLabel: getStatusLabel(status),

        attendance: attendanceRecord
          ? {
              _id: attendanceRecord._id,
              date: formatDate(attendanceRecord.date),
              status: attendanceRecord.status,
              makeupRequired: Boolean(attendanceRecord.makeupRequired),
              makeupCompleted: Boolean(attendanceRecord.makeupCompleted),
            }
          : null,

        makeup: makeupRecord
          ? {
              _id: makeupRecord._id,
              status: makeupRecord.status,
              originalDate: formatDate(makeupRecord.originalDate),
              makeupDate: formatDate(makeupRecord.makeupDate),
            }
          : null,

        milestone: {
          day,

          belt: milestone.belt || "",

          skill: milestone.skill || "",

          description: milestone.description || "",
        },
      });
    });

    /* --------------------------------------------------------
       Sort timeline
    -------------------------------------------------------- */

    timeline.sort((a, b) => a.day - b.day);

    /* ========================================================
       CURRENT TRAINING DAY
       
       IMPORTANT:
       Do not use an attendance record before joinDate.
       
       Also do not allow a future attendance record to make
       the student appear to have completed that training day.
       ======================================================== */

    const today = startOfDay(new Date());

    const completedDays = timeline
      .filter((item) => {
        if (item.status !== "COMPLETED" && item.status !== "MAKEUP_COMPLETED") {
          return false;
        }

        /*
         * A training day can only be completed if its
         * scheduled calendar date has arrived.
         */
        const itemDate = startOfDay(item.date);

        if (!itemDate || !today) {
          return false;
        }

        return itemDate.getTime() <= today.getTime();
      })
      .map((item) => item.day);

    const currentTrainingDay =
      completedDays.length > 0 ? Math.max(...completedDays) : 0;

    /* --------------------------------------------------------
       Current milestone
    -------------------------------------------------------- */

    const currentMilestone =
      milestones
        .filter((milestone) => Number(milestone.day) <= currentTrainingDay)
        .sort((a, b) => Number(b.day) - Number(a.day))[0] || null;

    /* --------------------------------------------------------
       Next milestone
    -------------------------------------------------------- */

    const nextMilestone =
      milestones.find(
        (milestone) =>
          Number(milestone.day) > currentTrainingDay &&
          String(milestone.belt || "")
            .trim()
            .toLowerCase() !==
            String(student.currentBelt || "")
              .trim()
              .toLowerCase(),
      ) || null;

    const nextMilestoneDate = nextMilestone
      ? addDays(joinDate, Number(nextMilestone.day) - 1)
      : null;

    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({
      success: true,

      student: {
        _id: student._id,

        name: student.name,

        currentBelt: student.currentBelt || "White",

        joinDate: formatDate(student.joinDate),

        status: student.status,

        branch: student.branch
          ? {
              _id: student.branch._id,

              name: student.branch.name,

              address: student.branch.address,
            }
          : null,

        plan: {
          _id: plan._id,

          name: plan.name,

          startingBelt: plan.startingBelt || "",

          duration: plan.duration || null,

          durationUnit: plan.durationUnit || "",

          classesPerWeek: plan.classesPerWeek || null,
        },
      },

      summary: {
        totalTrainingDays: curriculum.length,

        totalMilestones: milestones.length,

        completedTrainingDay: currentTrainingDay,

        currentBelt: student.currentBelt || "White",

        currentMilestone: currentMilestone
          ? {
              day: Number(currentMilestone.day),

              belt: currentMilestone.belt || "",

              skill: currentMilestone.skill || "",

              description: currentMilestone.description || "",
            }
          : null,

        nextMilestone: nextMilestone
          ? {
              day: Number(nextMilestone.day),

              belt: nextMilestone.belt || "",

              skill: nextMilestone.skill || "",

              description: nextMilestone.description || "",

              date: nextMilestoneDate ? formatDate(nextMilestoneDate) : null,
            }
          : null,

        today: formatDate(today),
      },

      timeline,
    });
  } catch (error) {
    console.error("Get student timeline error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to generate student timeline",
    });
  }
};

module.exports = {
  getStudentTimeline,
};

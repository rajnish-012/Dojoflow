const mongoose = require("mongoose");

const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Makeup = require("../models/Makeup");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const { isBranchScoped } = require("../utils/access");
const { getProgramLearningProgress } = require("../services/programProgress.service");
const { resolveProgramCurriculum } = require("../services/curriculumResolver.service");
const { withAttendanceSessionDetails } = require("../utils/attendanceSession");

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
    const enrollment = (student.planEnrollments || []).find((item) => item.status === "ACTIVE" && new Date(item.startDate) <= today && (!item.endDate || today < new Date(item.endDate)));
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

    const milestones = Array.isArray(plan.milestones)
      ? [...plan.milestones].sort(
          (a, b) => Number(a.day) - Number(b.day),
        )
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

      const attendanceRecord =
        attendanceByDay.get(day) || null;

      const makeupRecord =
        makeupByDay.get(day) || null;

      const status =
        getAttendanceState(attendanceRecord);

      /*
       * Day 1 = join date
       * Day 2 = join date + 1
       * Day 3 = join date + 2
       */
      const date = attendanceRecord?.date || makeupRecord?.makeupDate || makeupRecord?.originalDate || null;

      const milestone = milestones.find(
        (entry) => Number(entry.day) === day,
      );

      return {
        day,

        date: date ? formatDate(date) : null,

        type: getTimelineType(
          item,
          milestoneDays,
        ),

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

        milestone: milestone
          ? {
              day: Number(milestone.day),

              belt:
                milestone.belt || "",

              skill:
                milestone.skill || "",

              description:
                milestone.description || "",
            }
          : null,
      };
    });

    /* ========================================================
       ADD MILESTONES WITHOUT CURRICULUM
    ======================================================== */

    milestones.forEach((milestone) => {
      const day = Number(milestone.day);

      const exists = timeline.some(
        (item) => item.day === day,
      );

      if (exists) {
        return;
      }

      const attendanceRecord =
        attendanceByDay.get(day) || null;

      const makeupRecord =
        makeupByDay.get(day) || null;

      const status =
        getAttendanceState(
          attendanceRecord,
        );

      const date = attendanceRecord?.date || makeupRecord?.makeupDate || makeupRecord?.originalDate || null;

      timeline.push({
        day,

        date: date ? formatDate(date) : null,

        type: "MILESTONE",

        title: milestone.belt
          ? `${milestone.belt} Belt Milestone`
          : `Milestone Day ${day}`,

        description:
          milestone.description || "",

        skill:
          milestone.skill || "",

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

        milestone: {
          day,

          belt:
            milestone.belt || "",

          skill:
            milestone.skill || "",

          description:
            milestone.description || "",
        },
      });
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

    /* --------------------------------------------------------
       Current milestone
    -------------------------------------------------------- */

    const currentMilestone =
      milestones
        .filter(
          (milestone) =>
            Number(milestone.day) <=
            currentTrainingDay,
        )
        .sort(
          (a, b) =>
            Number(b.day) -
            Number(a.day),
        )[0] || null;

    /* --------------------------------------------------------
       Next milestone
    -------------------------------------------------------- */

    const nextMilestone =
      milestones.find(
        (milestone) =>
          Number(milestone.day) >
            currentTrainingDay &&
          String(milestone.belt || "")
            .trim()
            .toLowerCase() !==
            String(currentBelt || "")
              .trim()
              .toLowerCase(),
      ) || null;

    // Milestones are measured in attended program sessions; without
    // a scheduled class forecast, an exact calendar date is not known.
    const nextMilestoneDate = null;

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
          milestones.length,

        completedTrainingDay:
          currentTrainingDay,

        currentBelt:
          currentBelt,

        currentMilestone:
          currentMilestone
            ? {
                day: Number(
                  currentMilestone.day,
                ),

                belt:
                  currentMilestone.belt ||
                  "",

                skill:
                  currentMilestone.skill ||
                  "",

                description:
                  currentMilestone.description ||
                  "",
              }
            : null,

        nextMilestone:
          nextMilestone
            ? {
                day: Number(
                  nextMilestone.day,
                ),

                belt:
                  nextMilestone.belt ||
                  "",

                skill:
                  nextMilestone.skill ||
                  "",

                description:
                  nextMilestone.description ||
                  "",

                date:
                  nextMilestoneDate
                    ? formatDate(
                        nextMilestoneDate,
                      )
                    : null,
              }
            : null,

        today:
          formatDate(today),
      },

      timeline,
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

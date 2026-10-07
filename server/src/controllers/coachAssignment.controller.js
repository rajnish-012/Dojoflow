const mongoose = require("mongoose");

const CoachStudentAssignment = require("../models/CoachStudentAssignment");
const User = require("../models/User");
const Student = require("../models/Student");
const CoachAvailability = require("../models/CoachAvailability");
const BranchSchedule = require("../models/BranchSchedule");
const { isBranchScoped } = require("../utils/access");

const checkBranchAccess = (req, branchId) => {
  if (!isBranchScoped(req.user)) {
    return null;
  }

  if (!req.user.branch) {
    return {
      status: 403,
      message: "No branch is assigned to this account",
    };
  }

  if (!branchId || branchId.toString() !== req.user.branch.toString()) {
    return {
      status: 403,
      message: "You do not have access to this branch",
    };
  }

  return null;
};

const canManageCoachAvailability = (req, coachId) => req.user.role === "SUPER_ADMIN" ||
  (req.user.role === "COACH" && String(req.user._id) === String(coachId)) ||
  (Array.isArray(req.user.permissions) && req.user.permissions.includes("coach_assignment.manage"));

function validClockRange(item) {
  const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return pattern.test(String(item?.startTime || "")) && pattern.test(String(item?.endTime || "")) && item.startTime < item.endTime;
}

async function getCoachAvailability(req, res) {
  try {
    const coachId = req.params.coachId;
    if (!mongoose.isValidObjectId(coachId)) return res.status(400).json({ success: false, message: "Invalid coach ID." });
    if (req.user.role === "COACH" && String(req.user._id) !== String(coachId)) return res.status(403).json({ success: false, message: "You can only view your own availability." });
    if (!canManageCoachAvailability(req, coachId) && !(req.user.permissions || []).some((permission) => ["coach_assignment.view", "report.view"].includes(permission))) return res.status(403).json({ success: false, message: "You do not have permission to view coach availability." });
    const coach = await User.findOne({ _id: coachId, role: "COACH" }).select("_id name branch").lean();
    if (!coach) return res.status(404).json({ success: false, message: "Coach not found." });
    const accessError = checkBranchAccess(req, coach.branch);
    if (accessError) return res.status(accessError.status).json({ success: false, message: accessError.message });
    const availability = await CoachAvailability.findOne({ coach: coach._id }).lean();
    const branchSchedules = await BranchSchedule.find({ branch: coach.branch, "weeklySchedule.slots.coach": coach._id }).select("weeklySchedule").lean();
    const schedule = branchSchedules.flatMap((item) => (item.weeklySchedule || []).flatMap((day) => (day.slots || []).filter((slot) => String(slot.coach || "") === String(coach._id)).map((slot) => ({ dayOfWeek: day.dayOfWeek, sessionName: slot.sessionName, startTime: slot.startTime, endTime: slot.endTime, sessionTypeId: slot.sessionTypeId }))));
    const assignments = await CoachStudentAssignment.find({ coach: coach._id, branch: coach.branch, status: "ACTIVE" }).populate({ path: "student", select: "name currentBelt status plan", populate: { path: "plan", select: "name" } }).lean();
    return res.json({ success: true, coach, schedule, assignments, availability: availability || { coach: coach._id, branch: coach.branch, workingHours: [], leave: [], unavailableSlots: [] } });
  } catch (error) {
    console.error("Get coach availability failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load coach availability." });
  }
}

async function updateCoachAvailability(req, res) {
  try {
    const coachId = req.params.coachId;
    if (!mongoose.isValidObjectId(coachId)) return res.status(400).json({ success: false, message: "Invalid coach ID." });
    if (!canManageCoachAvailability(req, coachId)) return res.status(403).json({ success: false, message: "You do not have permission to update coach availability." });
    const coach = await User.findOne({ _id: coachId, role: "COACH" }).select("_id branch").lean();
    if (!coach) return res.status(404).json({ success: false, message: "Coach not found." });
    const accessError = checkBranchAccess(req, coach.branch);
    if (accessError) return res.status(accessError.status).json({ success: false, message: accessError.message });
    const { workingHours = [], leave = [], unavailableSlots = [] } = req.body || {};
    if (![workingHours, leave, unavailableSlots].every(Array.isArray)) return res.status(400).json({ success: false, message: "Availability sections must be arrays." });
    if (workingHours.some((item) => !Number.isInteger(Number(item.dayOfWeek)) || Number(item.dayOfWeek) < 0 || Number(item.dayOfWeek) > 6 || !validClockRange(item))) return res.status(400).json({ success: false, message: "Working hours need a valid weekday and start/end times." });
    if (unavailableSlots.some((item) => (item.dayOfWeek == null && !item.date) || (item.dayOfWeek != null && (!Number.isInteger(Number(item.dayOfWeek)) || Number(item.dayOfWeek) < 0 || Number(item.dayOfWeek) > 6)) || !validClockRange(item))) return res.status(400).json({ success: false, message: "Unavailable slots need a weekday or date and valid start/end times." });
    const normalizedLeave = leave.map((item) => ({ ...item, startDate: new Date(item.startDate), endDate: new Date(item.endDate) }));
    if (normalizedLeave.some((item) => Number.isNaN(item.startDate.getTime()) || Number.isNaN(item.endDate.getTime()) || item.startDate > item.endDate)) return res.status(400).json({ success: false, message: "Leave dates must have a valid start and end date." });
    const hasOverlap = (items, dayKey) => items.some((item, index) => items.slice(index + 1).some((other) => item[dayKey] === other[dayKey] && item.startTime < other.endTime && item.endTime > other.startTime));
    if (hasOverlap(workingHours, "dayOfWeek")) return res.status(409).json({ success: false, message: "Working hours overlap for the same weekday." });
    if (hasOverlap(unavailableSlots.filter((item) => item.dayOfWeek != null), "dayOfWeek")) return res.status(409).json({ success: false, message: "Unavailable time slots overlap for the same weekday." });
    const availability = await CoachAvailability.findOneAndUpdate({ coach: coach._id }, { $set: { branch: coach.branch, workingHours, leave: normalizedLeave, unavailableSlots, updatedBy: req.user._id } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    return res.json({ success: true, availability });
  } catch (error) {
    console.error("Update coach availability failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update coach availability." });
  }
}

/* =========================================================
   GET COACHES
========================================================= */

const getCoaches = async (req, res) => {
  try {
    const filter = {
      role: "COACH",
    };

    if (req.user.role === "COACH") {
      filter._id = req.user._id;
    }

    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    const coaches = await User.find(filter)
      .populate("branch", "name")
      .select("name email role branch")
      .sort({
        name: 1,
      });

    return res.status(200).json({
      success: true,
      count: coaches.length,
      coaches,
    });
  } catch (error) {
    console.error("Get coaches error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch coaches",
    });
  }
};

/* =========================================================
   GET ASSIGNMENTS
========================================================= */

const getAssignments = async (req, res) => {
  try {
    const filter = {};
    const { search, page, limit, sortBy, sortOrder } = req.query;

    if (req.user.role === "COACH") {
      if (
        req.query.coach &&
        req.query.coach.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to another coach's assignments",
        });
      }

      filter.coach = req.user._id;
    } else if (req.query.coach) {
      if (!mongoose.isValidObjectId(req.query.coach)) {
        return res.status(400).json({
          success: false,
          message: "Invalid coach ID",
        });
      }

      filter.coach = req.query.coach;
    }

    if (req.query.student) {
      if (!mongoose.isValidObjectId(req.query.student)) {
        return res.status(400).json({
          success: false,
          message: "Invalid student ID",
        });
      }

      filter.student = req.query.student;
    }

    const requestedStatus = String(req.query.status || "ACTIVE").toUpperCase();

    if (requestedStatus !== "ALL") {
      if (!['ACTIVE', 'INACTIVE'].includes(requestedStatus)) {
        return res.status(400).json({
          success: false,
          message: "Status must be ACTIVE, INACTIVE or ALL",
        });
      }

      filter.status = requestedStatus;
    }

    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    } else if (req.query.branch) {
      if (!mongoose.isValidObjectId(req.query.branch)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      filter.branch = req.query.branch;
    }

    if (String(search || "").trim()) {
      const expression = new RegExp(
        String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      const [students, coaches] = await Promise.all([
        Student.find({ $or: [{ name: expression }, { phone: expression }] }).select("_id").lean(),
        User.find({ role: "COACH", name: expression }).select("_id").lean(),
      ]);
      const matches = [];

      if (students.length) matches.push({ student: { $in: students.map((item) => item._id) } });
      if (coaches.length) matches.push({ coach: { $in: coaches.map((item) => item._id) } });

      if (matches.length) {
        filter.$or = matches;
      } else {
        filter._id = { $in: [] };
      }
    }

    const shouldPaginate = page !== undefined || limit !== undefined;
    const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
    const sortField = ["assignedAt", "createdAt", "updatedAt", "status"].includes(sortBy)
      ? sortBy
      : "assignedAt";
    const sortDirection = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const total = await CoachStudentAssignment.countDocuments(filter);

    let assignmentQuery = CoachStudentAssignment.find(filter)
      .populate("coach", "name email role branch")
      .populate("student", "name age phone currentBelt status branch plan")
      .populate("branch", "name")
      .populate("assignedBy", "name email")
      .sort({ [sortField]: sortDirection, _id: -1 });

    if (shouldPaginate) {
      assignmentQuery = assignmentQuery.skip((pageNumber - 1) * pageSize).limit(pageSize);
    }

    const assignments = await assignmentQuery;

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
      pagination: {
        page: shouldPaginate ? pageNumber : 1,
        limit: shouldPaginate ? pageSize : total,
        total,
        pages: shouldPaginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
      },
    });
  } catch (error) {
    console.error("Get coach assignments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch coach assignments",
    });
  }
};

/* =========================================================
   CREATE ASSIGNMENT
========================================================= */

const createAssignment = async (req, res) => {
  try {
    const { coach, student, note = "" } = req.body;

    if (!coach || !student) {
      return res.status(400).json({
        success: false,
        message: "Coach and student are required",
      });
    }

    if (
      !mongoose.isValidObjectId(coach) ||
      !mongoose.isValidObjectId(student)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid coach or student ID",
      });
    }

    const coachUser = await User.findOne({
      _id: coach,
      role: "COACH",
    });

    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    const studentRecord = await Student.findById(student);

    if (!studentRecord) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (!studentRecord.branch) {
      return res.status(400).json({
        success: false,
        message: "Student is not assigned to a branch",
      });
    }

    const branchError = checkBranchAccess(req, studentRecord.branch);

    if (branchError) {
      return res.status(branchError.status).json({
        success: false,
        message: branchError.message,
      });
    }

    if (
      !coachUser.branch ||
      coachUser.branch.toString() !== studentRecord.branch.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "Coach and student must belong to the same branch",
      });
    }

    const existing = await CoachStudentAssignment.findOne({
      coach,
      student,
      status: "ACTIVE",
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This student is already assigned to this coach",
        assignment: existing,
      });
    }

    const assignment = await CoachStudentAssignment.create({
      coach,
      student,
      branch: studentRecord.branch,
      assignedBy: req.user._id,
      status: "ACTIVE",
      assignedAt: new Date(),
      note: String(note || "").trim(),
    });

    const populated = await CoachStudentAssignment.findById(assignment._id)
      .populate("coach", "name email role branch")
      .populate("student", "name age phone currentBelt status branch plan")
      .populate("branch", "name")
      .populate("assignedBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Student assigned to coach successfully",
      assignment: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This student is already assigned to this coach",
      });
    }

    console.error("Create coach assignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign student to coach",
    });
  }
};

/* =========================================================
   UNASSIGN
========================================================= */

const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID",
      });
    }

    const assignment = await CoachStudentAssignment.findById(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    const branchError = checkBranchAccess(req, assignment.branch);

    if (branchError) {
      return res.status(branchError.status).json({
        success: false,
        message: branchError.message,
      });
    }

    if (assignment.status === "INACTIVE") {
      return res.status(200).json({
        success: true,
        message: "Assignment is already inactive",
        assignment,
      });
    }

    assignment.status = "INACTIVE";
    assignment.unassignedAt = new Date();

    await assignment.save();

    return res.status(200).json({
      success: true,
      message: "Student unassigned from coach successfully",
      assignment,
    });
  } catch (error) {
    console.error("Delete coach assignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to unassign student",
    });
  }
};

/* =========================================================
   COACH'S OWN STUDENTS
========================================================= */

const getMyAssignedStudents = async (req, res) => {
  try {
    const assignments = await CoachStudentAssignment.find({
      coach: req.user._id,
      status: "ACTIVE",
    })
      .populate(
        "student",
        "name age phone email currentBelt status branch plan",
      )
      .populate("branch", "name")
      .sort({
        createdAt: -1,
      });

    const students = assignments
      .map((assignment) => assignment.student)
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
      assignments,
    });
  } catch (error) {
    console.error("Get my assigned students error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned students",
    });
  }
};

module.exports = {
  getCoaches,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getMyAssignedStudents,
  getCoachAvailability,
  updateCoachAvailability,
};

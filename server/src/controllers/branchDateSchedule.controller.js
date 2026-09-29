const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const BranchDateSchedule = require("../models/BranchDateSchedule");
const BranchSchedule = require("../models/BranchSchedule");

/* =========================================================
   CONSTANTS
========================================================= */

const WRITE_ROLES = [
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/* =========================================================
   HELPERS
========================================================= */

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function userHasGlobalAccess(req) {
  return req.user?.role === "SUPER_ADMIN";
}

function userCanWriteBranch(req, branchId) {
  if (!req.user) {
    return false;
  }

  if (userHasGlobalAccess(req)) {
    return true;
  }

  if (!WRITE_ROLES.includes(String(req.user.role || ""))) {
    return false;
  }

  if (!req.user.branch) {
    return false;
  }

  return req.user.branch.toString() === branchId.toString();
}

function timeToMinutes(value) {
  if (!TIME_PATTERN.test(String(value || ""))) {
    return null;
  }

  const [hours, minutes] = String(value)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function isValidCalendarDate(value) {
  if (
    typeof value !== "string" ||
    !DATE_PATTERN.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
  );

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function normalizeSlots(slots) {
  return (Array.isArray(slots) ? slots : [])
    .map((slot) => ({
      _id: slot?._id,
      sessionName:
        String(
          slot?.sessionName ||
            "Training Session",
        ).trim(),

      startTime: String(
        slot?.startTime || "",
      ).trim(),

      endTime: String(
        slot?.endTime || "",
      ).trim(),

      isActive:
        slot?.isActive !== false,
    }))
    .sort(
      (a, b) =>
        timeToMinutes(a.startTime) -
        timeToMinutes(b.startTime),
    );
}

/* =========================================================
   VALIDATE PAYLOAD
========================================================= */

async function validateDateSchedulePayload(
  branchId,
  date,
  body,
) {
  if (!isValidCalendarDate(date)) {
    return {
      valid: false,
      message:
        "Date must be a valid YYYY-MM-DD calendar date.",
    };
  }

  const branchSchedule =
    await BranchSchedule.findOne({
      branch: branchId,
    }).lean();

  const openingTime =
    branchSchedule?.openingTime ||
    "06:00";

  const closingTime =
    branchSchedule?.closingTime ||
    "21:00";

  const openingMinutes =
    timeToMinutes(openingTime);

  const closingMinutes =
    timeToMinutes(closingTime);

  const isClosed =
    body?.isClosed === true;

  const slots = normalizeSlots(
    body?.slots,
  );

  if (isClosed) {
    return {
      valid: true,
      isClosed: true,
      slots: [],
    };
  }

  if (slots.length === 0) {
    return {
      valid: true,
      isClosed: false,
      slots: [],
    };
  }

  for (const slot of slots) {
    if (!slot.sessionName) {
      return {
        valid: false,
        message:
          "Training session name is required.",
      };
    }

    if (
      !TIME_PATTERN.test(
        slot.startTime,
      )
    ) {
      return {
        valid: false,
        message:
          "Start time must be in HH:mm format.",
      };
    }

    if (
      !TIME_PATTERN.test(
        slot.endTime,
      )
    ) {
      return {
        valid: false,
        message:
          "End time must be in HH:mm format.",
      };
    }

    const startMinutes =
      timeToMinutes(slot.startTime);

    const endMinutes =
      timeToMinutes(slot.endTime);

    if (
      startMinutes === null ||
      endMinutes === null
    ) {
      return {
        valid: false,
        message:
          "Invalid training session time.",
      };
    }

    if (startMinutes >= endMinutes) {
      return {
        valid: false,
        message:
          `"${slot.sessionName}" must end after it starts.`,
      };
    }

    if (
      openingMinutes !== null &&
      startMinutes < openingMinutes
    ) {
      return {
        valid: false,
        message:
          `"${slot.sessionName}" starts before branch opening time (${openingTime}).`,
      };
    }

    if (
      closingMinutes !== null &&
      endMinutes > closingMinutes
    ) {
      return {
        valid: false,
        message:
          `"${slot.sessionName}" ends after branch closing time (${closingTime}).`,
      };
    }
  }

  for (
    let index = 1;
    index < slots.length;
    index += 1
  ) {
    const previous =
      slots[index - 1];

    const current =
      slots[index];

    const previousEnd =
      timeToMinutes(
        previous.endTime,
      );

    const currentStart =
      timeToMinutes(
        current.startTime,
      );

    if (
      previousEnd !== null &&
      currentStart !== null &&
      currentStart < previousEnd
    ) {
      return {
        valid: false,
        message:
          `Overlapping training sessions: "${previous.sessionName}" and "${current.sessionName}".`,
      };
    }
  }

  return {
    valid: true,
    isClosed: false,
    slots,
  };
}

/* =========================================================
   SERIALIZE
========================================================= */

function serializeDateSchedule(schedule) {
  if (!schedule) {
    return null;
  }

  return {
    _id: schedule._id,
    branch: schedule.branch,
    date: schedule.date,
    isClosed: Boolean(
      schedule.isClosed,
    ),
    slots: Array.isArray(
      schedule.slots,
    )
      ? schedule.slots
      : [],
    updatedBy:
      schedule.updatedBy || null,
    createdAt:
      schedule.createdAt || null,
    updatedAt:
      schedule.updatedAt || null,
  };
}

/* =========================================================
   GET DATE OVERRIDE
   GET /api/branch-schedules/:branchId/date/:date
========================================================= */

const getBranchDateSchedule =
  async (req, res) => {
    try {
      const {
        branchId,
        date,
      } = req.params;

      if (!isValidObjectId(branchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID.",
        });
      }

      if (!isValidCalendarDate(date)) {
        return res.status(400).json({
          success: false,
          message:
            "Date must be a valid YYYY-MM-DD date.",
        });
      }

      if (
        !userCanWriteBranch(
          req,
          branchId,
        ) &&
        req.user?.role !== "COACH"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have access to this date schedule.",
        });
      }

      const branch =
        await Branch.findById(
          branchId,
        )
          .select(
            "_id name address phone isActive",
          )
          .lean();

      if (!branch) {
        return res.status(404).json({
          success: false,
          message: "Branch not found.",
        });
      }

      const schedule =
        await BranchDateSchedule.findOne(
          {
            branch: branchId,
            date,
          },
        )
          .populate(
            "updatedBy",
            "name email role",
          )
          .lean();

      return res.status(200).json({
        success: true,
        branch,
        date,
        hasOverride: Boolean(schedule),
        schedule:
          serializeDateSchedule(
            schedule,
          ),
      });
    } catch (error) {
      console.error(
        "Get branch date schedule error:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch date-specific training schedule.",
      });
    }
  };

/* =========================================================
   SAVE DATE OVERRIDE
   PUT /api/branch-schedules/:branchId/date/:date
========================================================= */

const upsertBranchDateSchedule =
  async (req, res) => {
    try {
      const {
        branchId,
        date,
      } = req.params;

      if (!isValidObjectId(branchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID.",
        });
      }

      if (!isValidCalendarDate(date)) {
        return res.status(400).json({
          success: false,
          message:
            "Date must be a valid YYYY-MM-DD date.",
        });
      }

      if (
        !userCanWriteBranch(
          req,
          branchId,
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to manage this branch schedule.",
        });
      }

      const branch =
        await Branch.findById(
          branchId,
        );

      if (!branch) {
        return res.status(404).json({
          success: false,
          message: "Branch not found.",
        });
      }

      const validation =
        await validateDateSchedulePayload(
          branchId,
          date,
          req.body,
        );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      /*
       * Do not allow date override to
       * silently schedule a holiday.
       *
       * Holiday handling remains controlled
       * by the Holiday system.
       */

      const schedule =
        await BranchDateSchedule.findOneAndUpdate(
          {
            branch: branchId,
            date,
          },
          {
            $set: {
              isClosed:
                validation.isClosed,
              slots:
                validation.slots,
              updatedBy:
                req.user._id,
            },
            $setOnInsert: {
              branch: branchId,
              date,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        ).populate(
          "updatedBy",
          "name email role",
        );

      return res.status(200).json({
        success: true,
        message:
          "Date-specific training schedule saved successfully.",
        schedule:
          serializeDateSchedule(
            schedule.toObject(),
          ),
      });
    } catch (error) {
      console.error(
        "Save branch date schedule error:",
        error,
      );

      if (
        error?.name ===
        "ValidationError"
      ) {
        return res.status(400).json({
          success: false,
          message:
            Object.values(
              error.errors,
            )
              .map(
                (item) =>
                  item.message,
              )
              .join(", ") ||
            "Invalid date schedule.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to save date-specific training schedule.",
      });
    }
  };

/* =========================================================
   DELETE DATE OVERRIDE
   DELETE /api/branch-schedules/:branchId/date/:date
========================================================= */

const deleteBranchDateSchedule =
  async (req, res) => {
    try {
      const {
        branchId,
        date,
      } = req.params;

      if (!isValidObjectId(branchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID.",
        });
      }

      if (!isValidCalendarDate(date)) {
        return res.status(400).json({
          success: false,
          message:
            "Date must be a valid YYYY-MM-DD date.",
        });
      }

      if (
        !userCanWriteBranch(
          req,
          branchId,
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to manage this branch schedule.",
        });
      }

      const deleted =
        await BranchDateSchedule.findOneAndDelete(
          {
            branch: branchId,
            date,
          },
        );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message:
            "No date-specific schedule exists for this date.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Date-specific schedule removed. The weekly schedule will be used again.",
      });
    } catch (error) {
      console.error(
        "Delete branch date schedule error:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to remove date-specific training schedule.",
      });
    }
  };

module.exports = {
  getBranchDateSchedule,
  upsertBranchDateSchedule,
  deleteBranchDateSchedule,
};
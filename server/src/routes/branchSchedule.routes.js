const express = require("express");

const protect = require("../middleware/auth.middleware");

const { authorizePermission } = require("../middleware/permission.middleware");

const {
  getPublicBranchSchedules,
  getPublicBranchMonthCalendar,

  getBranchSchedules,
  getBranchMonthCalendar,
  getBranchSchedule,
  upsertBranchSchedule,
  deleteBranchSchedule,
} = require("../controllers/branchSchedule.controller");

const {
  getBranchDateSchedule,
  upsertBranchDateSchedule,
  deleteBranchDateSchedule,
} = require("../controllers/branchDateSchedule.controller");

const router = express.Router();

/* =========================================================
   PUBLIC ROUTES
========================================================= */

router.get("/public", getPublicBranchSchedules);

router.get("/public/:branchId/calendar", getPublicBranchMonthCalendar);

/* =========================================================
   AUTHENTICATED ADMIN ROUTES
========================================================= */

router.use(protect);

router.get("/rooms", authorizePermission("branch_schedule.view"), require("../controllers/branchSchedule.controller").listRooms);
router.post("/rooms", authorizePermission("branch_schedule.manage"), require("../controllers/branchSchedule.controller").createRoom);
router.patch("/rooms/:id", authorizePermission("branch_schedule.manage"), require("../controllers/branchSchedule.controller").setRoomStatus);
router.patch("/sessions/:sessionId/status", authorizePermission("branch_schedule.manage"), require("../controllers/branchSchedule.controller").setTrainingSessionStatus);

/* Date-specific overrides belong to the schedule resource. */
router.get(
  "/:branchId/date/:date",
  authorizePermission("branch_schedule.view"),
  getBranchDateSchedule,
);

router.put(
  "/:branchId/date/:date",
  authorizePermission("branch_schedule.manage"),
  upsertBranchDateSchedule,
);

router.delete(
  "/:branchId/date/:date",
  authorizePermission("branch_schedule.manage"),
  deleteBranchDateSchedule,
);

/* =========================================================
   WEEKLY BRANCH SCHEDULES
========================================================= */

router.get("/", authorizePermission("branch_schedule.view"), getBranchSchedules);

router.get(
  "/:branchId/calendar",
  authorizePermission("branch_schedule.view"),
  getBranchMonthCalendar,
);

router.get("/:branchId", authorizePermission("branch_schedule.view"), getBranchSchedule);

router.put(
  "/:branchId",
  authorizePermission("branch_schedule.manage"),
  upsertBranchSchedule,
);

router.delete(
  "/:branchId",
  authorizePermission("branch_schedule.manage"),
  deleteBranchSchedule,
);

module.exports = router;

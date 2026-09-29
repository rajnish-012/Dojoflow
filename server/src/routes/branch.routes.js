const express = require("express");

const protect = require("../middleware/auth.middleware");

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

/*
 * IMPORTANT:
 *
 * Public routes must stay before protect middleware.
 */

router.get("/public", getPublicBranchSchedules);

router.get("/public/:branchId/calendar", getPublicBranchMonthCalendar);

/* =========================================================
   AUTHENTICATED ROUTES
========================================================= */

router.use(protect);

/* =========================================================
   DATE-SPECIFIC SCHEDULE
========================================================= */

/*
 * GET
 *
 * /api/branch-schedules/:branchId/date/:date
 *
 * Example:
 *
 * /api/branch-schedules/68abc123/date/2026-09-30
 */
router.get("/:branchId/date/:date", getBranchDateSchedule);

/*
 * PUT
 *
 * /api/branch-schedules/:branchId/date/:date
 */
router.put("/:branchId/date/:date", upsertBranchDateSchedule);

/*
 * DELETE
 *
 * /api/branch-schedules/:branchId/date/:date
 */
router.delete("/:branchId/date/:date", deleteBranchDateSchedule);

/* =========================================================
   WEEKLY BRANCH SCHEDULES
========================================================= */

/*
 * GET
 *
 * /api/branch-schedules
 */
router.get("/", getBranchSchedules);

/*
 * GET MONTH CALENDAR
 *
 * /api/branch-schedules/:branchId/calendar
 */
router.get("/:branchId/calendar", getBranchMonthCalendar);

/*
 * GET WEEKLY SCHEDULE
 *
 * /api/branch-schedules/:branchId
 */
router.get("/:branchId", getBranchSchedule);

/*
 * UPDATE WEEKLY SCHEDULE
 *
 * /api/branch-schedules/:branchId
 */
router.put("/:branchId", upsertBranchSchedule);

/*
 * DELETE WEEKLY SCHEDULE
 *
 * /api/branch-schedules/:branchId
 */
router.delete("/:branchId", deleteBranchSchedule);

module.exports = router;

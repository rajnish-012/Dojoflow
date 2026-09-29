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

const router = express.Router();

/* =========================================================
   PUBLIC ROUTES
   ========================================================= */

/*
 * IMPORTANT:
 *
 * These routes MUST be declared BEFORE:
 *
 * router.use(protect)
 *
 * Otherwise the public inquiry page would require login.
 *
 * Express processes router middleware/routes in order.
 */

/*
 * GET /api/branch-schedules/public
 *
 * Returns active branches with their public
 * weekly training schedule.
 */
router.get("/public", getPublicBranchSchedules);

/*
 * GET /api/branch-schedules/public/:branchId/calendar
 *
 * Public monthly availability.
 *
 * Example:
 *
 * /api/branch-schedules/public/68abc123/calendar
 * ?year=2026&month=9
 */
router.get("/public/:branchId/calendar", getPublicBranchMonthCalendar);

/* =========================================================
   AUTHENTICATED ADMIN ROUTES
   ========================================================= */

router.use(protect);

/* =========================================================
   BRANCH SCHEDULES
   ========================================================= */

/*
 * GET /api/branch-schedules
 */
router.get("/", getBranchSchedules);

/*
 * GET /api/branch-schedules/:branchId/calendar
 *
 * Admin monthly calendar.
 */
router.get("/:branchId/calendar", getBranchMonthCalendar);

/*
 * GET /api/branch-schedules/:branchId
 */
router.get("/:branchId", getBranchSchedule);

/*
 * PUT /api/branch-schedules/:branchId
 */
router.put("/:branchId", upsertBranchSchedule);

/*
 * DELETE /api/branch-schedules/:branchId
 */
router.delete("/:branchId", deleteBranchSchedule);

module.exports = router;

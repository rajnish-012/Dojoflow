const express = require("express");

const {
  getMakeups,
  getMakeupById,
  createMakeup,
  scheduleMakeup,
  completeMakeup,
  cancelMakeup,
} = require("../controllers/makeup.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

const STAFF_ROLES = [
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
  "COACH",
];

/*
 * ======================================================
 * GET ALL MAKEUPS
 * ======================================================
 *
 * GET /api/makeups
 */
router.get(
  "/",
  protect,
  authorize(...STAFF_ROLES),
  getMakeups
);

/*
 * ======================================================
 * CREATE / SCHEDULE MAKEUP
 * ======================================================
 *
 * POST /api/makeups
 */
router.post(
  "/",
  protect,
  authorize(...STAFF_ROLES),
  createMakeup
);

/*
 * ======================================================
 * GET MAKEUP BY ID
 * ======================================================
 *
 * IMPORTANT:
 * This route must remain after "/" routes and before
 * no conflicting dynamic routes.
 */
router.get(
  "/:id",
  protect,
  authorize(...STAFF_ROLES),
  getMakeupById
);

/*
 * ======================================================
 * SCHEDULE AUTOMATICALLY CREATED MAKEUP
 * ======================================================
 *
 * PUT /api/makeups/:id/schedule
 */
router.put(
  "/:id/schedule",
  protect,
  authorize(...STAFF_ROLES),
  scheduleMakeup
);

/*
 * ======================================================
 * COMPLETE MAKEUP
 * ======================================================
 *
 * PUT /api/makeups/:id/complete
 */
router.put(
  "/:id/complete",
  protect,
  authorize(...STAFF_ROLES),
  completeMakeup
);

/*
 * ======================================================
 * CANCEL MAKEUP
 * ======================================================
 *
 * PUT /api/makeups/:id/cancel
 */
router.put(
  "/:id/cancel",
  protect,
  authorize(...STAFF_ROLES),
  cancelMakeup
);

module.exports = router;
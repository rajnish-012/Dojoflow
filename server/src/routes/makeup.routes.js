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
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/*
 * ======================================================
 * GET ALL MAKEUPS
 * ======================================================
 *
 * GET /api/makeups
 */
router.get("/", protect, authorizePermission("makeup.view"), getMakeups);

/*
 * ======================================================
 * CREATE / SCHEDULE MAKEUP
 * ======================================================
 *
 * POST /api/makeups
 */
router.post("/", protect, authorizePermission("makeup.manage"), createMakeup);

/*
 * ======================================================
 * GET MAKEUP BY ID
 * ======================================================
 */
router.get("/:id", protect, authorizePermission("makeup.view"), getMakeupById);

/*
 * ======================================================
 * SCHEDULE / RESCHEDULE MAKEUP
 * ======================================================
 *
 * PUT /api/makeups/:id/schedule
 */
router.put(
  "/:id/schedule",
  protect,
  authorizePermission("makeup.manage"),
  scheduleMakeup,
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
  authorizePermission("makeup.manage"),
  completeMakeup,
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
  authorizePermission("makeup.manage"),
  cancelMakeup,
);

module.exports = router;

const express = require("express");

const {
  getMakeups,
  getMakeupById,
  createMakeup,
  completeMakeup,
  cancelMakeup,
} = require("../controllers/makeup.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// View makeup records
router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getMakeups
);

// View a specific makeup
router.get(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getMakeupById
);

// Schedule a makeup
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  createMakeup
);

// Mark makeup as completed
router.put(
  "/:id/complete",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  completeMakeup
);

// Cancel a scheduled makeup
router.put(
  "/:id/cancel",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  cancelMakeup
);

module.exports = router;
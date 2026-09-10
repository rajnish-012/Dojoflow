const express = require("express");

const {
  getPerformance,
  getPerformanceById,
  createPerformance,
} = require("../controllers/performance.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Get all performance records
router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getPerformance
);

// Get performance by ID
router.get(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getPerformanceById
);

// Create performance record
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  createPerformance
);

module.exports = router;
const express = require("express");

const {
  getPerformance,
  getMyPerformance,
  getPerformanceById,
  getPerformanceByStudent,
  createPerformance,
} = require("../controllers/performance.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// ======================================================
// STUDENT'S OWN PERFORMANCE
// IMPORTANT: /me must come before /:id
// ======================================================

router.get(
  "/me",
  protect,
  authorize("STUDENT"),
  getMyPerformance
);

// ======================================================
// GET ALL PERFORMANCE RECORDS
// ======================================================

router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getPerformance
);


// ==============================
// GET PERFORMANCE BY STUDENT ID
// ==============================
router.get(
  "/student/:studentId",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getPerformanceByStudent
);


// ======================================================
// GET PERFORMANCE BY ID
// ======================================================

router.get(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getPerformanceById
);

// ======================================================
// CREATE PERFORMANCE RECORD
// ======================================================

router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  createPerformance
);

module.exports = router;
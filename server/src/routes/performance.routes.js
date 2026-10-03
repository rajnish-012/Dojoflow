const express = require("express");

const {
  getPerformance,
  getMyPerformance,
  getPerformanceById,
  getPerformanceByStudent,
  createPerformance,
} = require("../controllers/performance.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

// ======================================================
// STUDENT'S OWN PERFORMANCE
//
// Students access their own performance through /me.
// This remains role-specific business behavior because
// it is the student's personal dashboard endpoint.
//
// IMPORTANT:
// /me must come before /:id.
// ======================================================

router.get(
  "/me",
  protect,
  async (req, res, next) => {
    if (String(req.user?.role || "").toUpperCase() !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Student access required",
      });
    }

    return next();
  },
  getMyPerformance,
);

// ======================================================
// GET ALL PERFORMANCE RECORDS
//
// Requires:
//   performance.view
//
// Backend authorization is database-driven.
// Custom roles can access this endpoint when their
// database Role contains performance.view.
// ======================================================

router.get(
  "/",
  protect,
  authorizePermission("performance.view"),
  getPerformance,
);

// ======================================================
// GET PERFORMANCE BY STUDENT ID
//
// Requires:
//   performance.view
// ======================================================

router.get(
  "/student/:studentId",
  protect,
  authorizePermission("performance.view"),
  getPerformanceByStudent,
);

// ======================================================
// GET PERFORMANCE BY ID
//
// Requires:
//   performance.view
// ======================================================

router.get(
  "/:id",
  protect,
  authorizePermission("performance.view"),
  getPerformanceById,
);

// ======================================================
// CREATE PERFORMANCE RECORD
//
// Requires:
//   performance.manage
//
// View-only roles cannot create performance records.
// ======================================================

router.post(
  "/",
  protect,
  authorizePermission("performance.manage"),
  createPerformance,
);

module.exports = router;
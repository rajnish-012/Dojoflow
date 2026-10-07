const express = require("express");

const {
  getReportsSummary,
  getTopPerformers,
  getSkillCompletionByBelt,
  getBranchReports,
  getCoachReports,
  getBeltReports,
  getReportBranches,
  getAdmissionReports,
  getAttendanceAnalytics,
} = require("../controllers/reports.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

router.get("/attendance-analytics", protect, authorizePermission("report.view"), getAttendanceAnalytics);

/*
 * =========================================================
 * REPORT AUTHORIZATION
 * =========================================================
 *
 * All report APIs are protected by the database-driven
 * report.view permission.
 *
 * SUPER_ADMIN remains allowed by the centralized permission
 * middleware.
 *
 * Custom roles receive access only when their database Role
 * contains:
 *
 *   report.view
 *
 * Frontend visibility is NOT the security boundary.
 * =========================================================
 */

/*
 * =========================================================
 * OVERVIEW
 * =========================================================
 */

router.get(
  "/summary",
  protect,
  authorizePermission("report.view"),
  getReportsSummary,
);

/*
 * =========================================================
 * TOP PERFORMERS
 * =========================================================
 */

router.get(
  "/top-performers",
  protect,
  authorizePermission("report.view"),
  getTopPerformers,
);

/*
 * =========================================================
 * SKILL COMPLETION
 * =========================================================
 */

router.get(
  "/skills",
  protect,
  authorizePermission("report.view"),
  getSkillCompletionByBelt,
);

/*
 * =========================================================
 * BRANCH REPORTS
 * =========================================================
 */

router.get(
  "/branches",
  protect,
  authorizePermission("report.view"),
  getBranchReports,
);

/*
 * =========================================================
 * COACH REPORTS
 * =========================================================
 */

router.get(
  "/coaches",
  protect,
  authorizePermission("report.view"),
  getCoachReports,
);

/*
 * =========================================================
 * BELT REPORTS
 * =========================================================
 */

router.get(
  "/belts",
  protect,
  authorizePermission("report.view"),
  getBeltReports,
);

/*
 * =========================================================
 * BRANCH FILTER OPTIONS
 * =========================================================
 */

router.get(
  "/branch-options",
  protect,
  authorizePermission("report.view"),
  getReportBranches,
);

/*
 * =========================================================
 * ADMISSION REPORTS
 * =========================================================
 */

router.get(
  "/admissions",
  protect,
  authorizePermission("report.view"),
  getAdmissionReports,
);

module.exports = router;

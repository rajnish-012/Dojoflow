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
} = require("../controllers/reports.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

const reportRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "BRANCH_ADMIN",
  "COACH",
];

/*
|--------------------------------------------------------------------------
| Overview
|--------------------------------------------------------------------------
*/

router.get(
  "/summary",
  protect,
  authorize(...reportRoles),
  getReportsSummary,
);

/*
|--------------------------------------------------------------------------
| Top Performers
|--------------------------------------------------------------------------
*/

router.get(
  "/top-performers",
  protect,
  authorize(...reportRoles),
  getTopPerformers,
);

/*
|--------------------------------------------------------------------------
| Skill Completion
|--------------------------------------------------------------------------
*/

router.get(
  "/skills",
  protect,
  authorize(...reportRoles),
  getSkillCompletionByBelt,
);

/*
|--------------------------------------------------------------------------
| Branches
|--------------------------------------------------------------------------
*/

router.get(
  "/branches",
  protect,
  authorize(...reportRoles),
  getBranchReports,
);

/*
|--------------------------------------------------------------------------
| Coaches
|--------------------------------------------------------------------------
*/

router.get(
  "/coaches",
  protect,
  authorize(...reportRoles),
  getCoachReports,
);

/*
|--------------------------------------------------------------------------
| Belts
|--------------------------------------------------------------------------
*/

router.get(
  "/belts",
  protect,
  authorize(...reportRoles),
  getBeltReports,
);

/*
|--------------------------------------------------------------------------
| Branch Filter Options
|--------------------------------------------------------------------------
*/

router.get(
  "/branch-options",
  protect,
  authorize(...reportRoles),
  getReportBranches,
);

/*
|--------------------------------------------------------------------------
| Admissions
|--------------------------------------------------------------------------
*/

router.get(
  "/admissions",
  protect,
  authorize(...reportRoles),
  getAdmissionReports,
);

module.exports = router;
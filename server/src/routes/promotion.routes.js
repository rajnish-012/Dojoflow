const express = require("express");

const {
  getEligiblePromotions,
  promoteStudent,
  getStudentBeltHistory,
} = require("../controllers/promotion.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

/*
 * ======================================================
 * ELIGIBLE PROMOTIONS
 * ======================================================
 */

router.get(
  "/eligible",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH",
  ),
  getEligiblePromotions,
);

/*
 * ======================================================
 * STUDENT BELT HISTORY
 *
 * Must be before any future /:id route.
 * ======================================================
 */

router.get(
  "/history/:studentId",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
  ),
  getStudentBeltHistory,
);

/*
 * ======================================================
 * APPROVE / CREATE PROMOTION
 * ======================================================
 */

router.post(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
  ),
  promoteStudent,
);

module.exports = router;
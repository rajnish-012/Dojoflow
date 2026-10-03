const express = require("express");

const {
  getEligiblePromotions,
  promoteStudent,
  getStudentBeltHistory,
} = require("../controllers/promotion.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/*
 * ======================================================
 * ELIGIBLE PROMOTIONS
 * ======================================================
 *
 * Requires:
 *   promotion.view
 *
 * The permission is resolved from the authenticated
 * user's current database Role.
 *
 * SUPER_ADMIN remains supported by the centralized
 * permission middleware.
 */
router.get(
  "/eligible",
  protect,
  authorizePermission("promotion.view"),
  getEligiblePromotions,
);

/*
 * ======================================================
 * STUDENT BELT HISTORY
 * ======================================================
 *
 * Requires:
 *   promotion.view
 *
 * This route intentionally remains before any future
 * /:id route.
 */
router.get(
  "/history/:studentId",
  protect,
  authorizePermission("promotion.view"),
  getStudentBeltHistory,
);

/*
 * ======================================================
 * APPROVE / CREATE PROMOTION
 * ======================================================
 *
 * Requires:
 *   promotion.manage
 *
 * Reading promotion candidates and actually approving
 * a promotion are intentionally separate permissions.
 */
router.post(
  "/",
  protect,
  authorizePermission("promotion.manage"),
  promoteStudent,
);

module.exports = router;

const express = require("express");

const {
  getStaffUsers,
  createStaffUser,
  deleteStaffUser,
} = require("../controllers/user.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

/*
 * All user-management routes require authentication
 * and SUPER_ADMIN access.
 */

// Get all staff
router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN"),
  getStaffUsers,
);

// Create staff
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN"),
  createStaffUser,
);

// Delete staff
router.delete(
  "/:id",
  protect,
  authorize("SUPER_ADMIN"),
  deleteStaffUser,
);

module.exports = router;
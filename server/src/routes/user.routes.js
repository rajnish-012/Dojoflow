const express = require("express");

const {
  getStaffUsers,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
} = require("../controllers/user.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Get all staff users
router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN"),
  getStaffUsers,
);

// Create staff user
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN"),
  createStaffUser,
);

// Update staff user
router.put(
  "/:id",
  protect,
  authorize("SUPER_ADMIN"),
  updateStaffUser,
);

// Delete staff user
router.delete(
  "/:id",
  protect,
  authorize("SUPER_ADMIN"),
  deleteStaffUser,
);

module.exports = router;
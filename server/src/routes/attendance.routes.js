const express = require("express");

const {
  getAttendance,
  getAttendanceById,
  markAttendance,
} = require("../controllers/attendance.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Get all attendance
router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getAttendance
);

// Get attendance by ID
router.get(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getAttendanceById
);

// Mark attendance
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  markAttendance
);

module.exports = router;
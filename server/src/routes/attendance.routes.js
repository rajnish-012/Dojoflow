const express = require("express");

const {
  getAttendance,
  getMyAttendance,
  getAttendanceById,
  getAttendanceByStudent,
  markAttendance,
} = require("../controllers/attendance.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// ======================================================
// STUDENT'S OWN ATTENDANCE
// IMPORTANT: /me must come before /:id
// ======================================================

router.get(
  "/me",
  protect,
  authorize("STUDENT"),
  getMyAttendance
);

// ======================================================
// GET ALL ATTENDANCE
// ======================================================

router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getAttendance
);

// ======================================================
// GET ATTENDANCE BY STUDENT ID
// ======================================================

router.get(
  "/student/:studentId",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getAttendanceByStudent
);

// ======================================================
// GET ATTENDANCE BY ID
// ======================================================

router.get(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getAttendanceById
);

// ======================================================
// MARK ATTENDANCE
// ======================================================

router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  markAttendance
);

module.exports = router;
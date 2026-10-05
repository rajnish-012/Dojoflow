const express = require("express");

const {
  getAttendance,
  getMyAttendance,
  getAttendanceByStudent,
  getAttendanceById,
  getDailyAttendanceSheet,
  markAttendance,
  markAllAttendancePresent,
  undoAttendance,
} = require("../controllers/attendance.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/* ==============================
   DAILY ATTENDANCE SHEET
============================== */

router.get(
  "/daily-sheet",
  protect,
  authorizePermission("attendance.view"),
  getDailyAttendanceSheet,
);

/* ==============================
   ALL ATTENDANCE
============================== */

router.get("/", protect, authorizePermission("attendance.view"), getAttendance);

/* ==============================
   STUDENT'S OWN ATTENDANCE
============================== */

router.get("/me", protect, authorize("STUDENT"), getMyAttendance);

/* ==============================
   ATTENDANCE BY STUDENT
============================== */

router.get(
  "/student/:studentId",
  protect,
  authorizePermission("attendance.view"),
  getAttendanceByStudent,
);

/* ==============================
   ATTENDANCE BY ID
============================== */

router.get(
  "/:id",
  protect,
  authorizePermission("attendance.view"),
  getAttendanceById,
);

/* ==============================
   MARK ATTENDANCE
============================== */

router.post(
  "/",
  protect,
  authorizePermission("attendance.manage"),
  markAttendance,
);

router.post(
  "/bulk-present",
  protect,
  authorizePermission("attendance.manage"),
  markAllAttendancePresent,
);

router.post(
  "/:id/undo",
  protect,
  authorizePermission("attendance.manage"),
  undoAttendance,
);

module.exports = router;

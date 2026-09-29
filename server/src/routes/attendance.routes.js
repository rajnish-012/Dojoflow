const express = require("express");

const {
  getAttendance,
  getMyAttendance,
  getAttendanceByStudent,
  getAttendanceById,
  getDailyAttendanceSheet,
  markAttendance,
} = require("../controllers/attendance.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

/* ==============================
   DAILY ATTENDANCE SHEET
============================== */

router.get(
  "/daily-sheet",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH",
  ),
  getDailyAttendanceSheet,
);

/* ==============================
   ALL ATTENDANCE
============================== */

router.get(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH",
  ),
  getAttendance,
);

/* ==============================
   STUDENT'S OWN ATTENDANCE
============================== */

router.get(
  "/me",
  protect,
  authorize("STUDENT"),
  getMyAttendance,
);

/* ==============================
   ATTENDANCE BY STUDENT
============================== */

router.get(
  "/student/:studentId",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH",
  ),
  getAttendanceByStudent,
);

/* ==============================
   ATTENDANCE BY ID
============================== */

router.get(
  "/:id",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH",
  ),
  getAttendanceById,
);

/* ==============================
   MARK ATTENDANCE
============================== */

router.post(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH",
  ),
  markAttendance,
);

module.exports = router;
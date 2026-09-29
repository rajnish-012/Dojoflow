const express = require("express");

const {
  getHolidays,
  getHolidayByDate,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require("../controllers/holiday.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

/* ==========================================
   GET ALL HOLIDAYS
   SUPER_ADMIN / BRANCH_ADMIN / COACH
========================================== */

router.get(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH"
  ),
  getHolidays
);

/* ==========================================
   GET HOLIDAY BY DATE
========================================== */

router.get(
  "/by-date",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH"
  ),
  getHolidayByDate
);

/* ==========================================
   CREATE HOLIDAY
   SUPER_ADMIN / BRANCH_ADMIN
========================================== */

router.post(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN"
  ),
  createHoliday
);

/* ==========================================
   UPDATE HOLIDAY
========================================== */

router.put(
  "/:id",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN"
  ),
  updateHoliday
);

/* ==========================================
   DELETE HOLIDAY
========================================== */

router.delete(
  "/:id",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN"
  ),
  deleteHoliday
);

module.exports = router;
const express = require("express");

const {
  getHolidays,
  getHolidayByDate,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require("../controllers/holiday.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/* ==========================================
   GET ALL HOLIDAYS

   Requires:
   holiday.view

   Backend permission is the security boundary.
   ========================================== */

router.get("/", protect, authorizePermission("holiday.view"), getHolidays);

/* ==========================================
   GET HOLIDAY BY DATE

   Requires:
   holiday.view
   ========================================== */

router.get(
  "/by-date",
  protect,
  authorizePermission("holiday.view"),
  getHolidayByDate,
);

/* ==========================================
   CREATE HOLIDAY

   Requires:
   holiday.manage

   Branch/global restrictions are still enforced
   inside holiday.controller.js.
   ========================================== */

router.post("/", protect, authorizePermission("holiday.manage"), createHoliday);

/* ==========================================
   UPDATE HOLIDAY

   Requires:
   holiday.manage
   ========================================== */

router.put(
  "/:id",
  protect,
  authorizePermission("holiday.manage"),
  updateHoliday,
);

/* ==========================================
   DELETE HOLIDAY

   Requires:
   holiday.manage
   ========================================== */

router.delete(
  "/:id",
  protect,
  authorizePermission("holiday.manage"),
  deleteHoliday,
);

module.exports = router;

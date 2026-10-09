const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const { getCalendar, getMyCalendar } = require("../controllers/calendar.controller");

const router = express.Router();
router.use(protect);
router.get("/me", getMyCalendar);
router.get("/", authorizePermission("calendar.view"), getCalendar);

module.exports = router;

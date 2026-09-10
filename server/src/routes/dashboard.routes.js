const express = require("express");

const {
  getDashboard,
} = require("../controllers/dashboard.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Get dashboard summary
router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getDashboard
);

module.exports = router;
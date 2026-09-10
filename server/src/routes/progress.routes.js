const express = require("express");

const {
  getStudentProgress,
} = require("../controllers/progress.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Get progress of a student
router.get(
  "/student/:studentId",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getStudentProgress
);

module.exports = router;
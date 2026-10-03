const express = require("express");

const { getStudentProgress } = require("../controllers/progress.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/*
 * Student progress is protected by student.view.
 *
 * The controller still performs student/data-scope checks
 * before returning progress information.
 */
router.get(
  "/student/:studentId",
  protect,
  authorizePermission("student.view"),
  getStudentProgress,
);

module.exports = router;

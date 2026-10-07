const express = require("express");

const {
  getCoaches,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getMyAssignedStudents,
  getCoachAvailability,
  updateCoachAvailability,
} = require("../controllers/coachAssignment.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

router.get("/coaches/:coachId/availability", protect, getCoachAvailability);
router.put("/coaches/:coachId/availability", protect, updateCoachAvailability);

router.get(
  "/my-students",
  protect,
  authorizePermission("coach_assignment.view"),
  getMyAssignedStudents,
);

router.get(
  "/coaches",
  protect,
  authorizePermission("coach_assignment.view"),
  getCoaches,
);

router.get("/", protect, authorizePermission("coach_assignment.view"), getAssignments);

router.post(
  "/",
  protect,
  authorizePermission("coach_assignment.manage"),
  createAssignment,
);

router.delete(
  "/:id",
  protect,
  authorizePermission("coach_assignment.manage"),
  deleteAssignment,
);

module.exports = router;

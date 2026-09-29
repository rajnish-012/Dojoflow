const express = require("express");

const {
  getCoaches,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getMyAssignedStudents,
} = require("../controllers/coachAssignment.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

router.get(
  "/my-students",
  protect,
  authorize("COACH"),
  getMyAssignedStudents,
);

router.get(
  "/coaches",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
  ),
  getCoaches,
);

router.get(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
  ),
  getAssignments,
);

router.post(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
  ),
  createAssignment,
);

router.delete(
  "/:id",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
  ),
  deleteAssignment,
);

module.exports = router;
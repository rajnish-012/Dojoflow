const express = require("express");

const {
  getStudents,
  getStudentById,
  getMyStudentProfile,
  createStudent,
  updateStudent,
  deleteStudent,
} = require("../controllers/student.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// ==============================
// STUDENT'S OWN PROFILE
// IMPORTANT: /me must come before /:id
// ==============================
router.get(
  "/me",
  protect,
  authorize("STUDENT"),
  getMyStudentProfile
);

// ==============================
// GET ALL STUDENTS
// ==============================
router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getStudents
);

// ==============================
// GET STUDENT BY ID
// ==============================
router.get(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getStudentById
);

// ==============================
// CREATE STUDENT
// ==============================
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN"),
  createStudent
);

// ==============================
// UPDATE STUDENT
// ==============================
router.put(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN"),
  updateStudent
);

// ==============================
// DELETE STUDENT
// ==============================
router.delete(
  "/:id",
  protect,
  authorize("SUPER_ADMIN"),
  deleteStudent
);

module.exports = router;
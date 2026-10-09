const express = require("express");

const {
  getStudents,
  getStudentById,
  getMyStudentProfile,
  getAdmissionPreview,
  createStudent,
  updateStudent,
  deleteStudent,
} = require("../controllers/student.controller");

const {
  getStudentTimeline,
} = require("../controllers/studentTimeline.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

router.get("/admission-preview", protect, authorizePermission("student.create"), getAdmissionPreview);

// ==============================
// STUDENT'S OWN PROFILE
// IMPORTANT: /me must come before /:id
// ==============================
router.get("/me", protect, authorize("STUDENT"), getMyStudentProfile);

// ==============================
// GET ALL STUDENTS
// ==============================
router.get("/", protect, authorizePermission("student.view"), getStudents);

// ==============================
// GET STUDENT TIMELINE
// IMPORTANT: Must come before /:id
// ==============================
router.get(
  "/:id/timeline",
  protect,
  authorizePermission("student.view"),
  getStudentTimeline,
);

// ==============================
// GET STUDENT BY ID
// ==============================
router.get(
  "/:id",
  protect,
  authorizePermission("student.view"),
  getStudentById,
);

// ==============================
// CREATE STUDENT
// ==============================
router.post("/", protect, authorizePermission("student.create"), createStudent);

// ==============================
// UPDATE STUDENT
// ==============================
router.put(
  "/:id",
  protect,
  authorizePermission("student.update"),
  updateStudent,
);

// ==============================
// DELETE STUDENT
// ==============================
router.delete(
  "/:id",
  protect,
  authorizePermission("student.delete"),
  deleteStudent,
);

module.exports = router;

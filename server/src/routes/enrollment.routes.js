const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const controller = require("../controllers/enrollment.controller");

const router = express.Router();
router.use(protect);
router.get("/dashboard", authorizePermission("membership.view"), controller.getRenewalDashboard);
router.get("/students/:studentId", authorizePermission("membership.view"), controller.getStudentEnrollments);
router.post("/students/:studentId", authorizePermission("membership.manage"), controller.addEnrollment);
router.post("/students/:studentId/renewals", authorizePermission("membership.manage"), controller.renewEnrollment);
router.patch("/students/:studentId/:enrollmentId/status", authorizePermission("membership.manage"), controller.updateEnrollmentStatus);

module.exports = router;

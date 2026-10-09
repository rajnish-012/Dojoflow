const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const controller = require("../controllers/grading.controller");

const router = express.Router();
router.use(protect);
router.get("/eligibility", authorizePermission("grading.view"), controller.getEligibility);
router.get("/me", authorizePermission("student.grading.view"), controller.getMyResults);
router.get("/", authorizePermission("grading.view"), controller.listEvents);
router.post("/", authorizePermission("grading.create"), controller.createEvent);
router.get("/:id", authorizePermission("grading.view"), controller.getEvent);
router.put("/:id", authorizePermission("grading.update"), controller.updateEvent);
router.post("/:id/start", authorizePermission("grading.update"), (req, res) => { req.params.action = "start"; return controller.changeStatus(req, res); });
router.post("/:id/cancel", authorizePermission("grading.cancel"), (req, res) => { req.params.action = "cancel"; return controller.changeStatus(req, res); });
router.post("/:id/complete", authorizePermission("grading.finalize"), (req, res) => { req.params.action = "complete"; return controller.changeStatus(req, res); });
router.put("/:id/students/:studentId/evaluation", authorizePermission("grading.evaluate"), controller.saveEvaluation);
router.post("/:id/students/:studentId/evaluation/finalize", authorizePermission("grading.finalize"), authorizePermission("promotion.manage"), controller.finalizeEvaluation);
router.post("/:id/publish", authorizePermission("grading.publish"), controller.publishResults);

module.exports = router;

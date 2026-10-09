const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const controller = require("../controllers/academyEvent.controller");

const router = express.Router();
router.use(protect);
router.post("/validate", authorizePermission("event.manage"), controller.previewConflicts);
router.get("/", authorizePermission("event.view"), controller.listAcademyEvents);
router.post("/", authorizePermission("event.manage"), controller.createAcademyEvent);
router.get("/:id", authorizePermission("event.view"), controller.getAcademyEvent);
router.put("/:id", authorizePermission("event.manage"), controller.updateAcademyEvent);
router.post("/:id/cancel", authorizePermission("event.manage"), controller.cancelAcademyEvent);
router.post("/:id/complete", authorizePermission("event.manage"), controller.completeAcademyEvent);
router.post("/:id/registrations", authorizePermission("event.register"), controller.createRegistration);
router.patch("/:id/registrations/:registrationId", authorizePermission("event.register"), controller.updateRegistration);

module.exports = router;

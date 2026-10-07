const express = require("express");

const {
  createInquiry,
  getInquiries,
} = require("../controllers/inquiry.controller");
const crm = require("../controllers/crm.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

router.get("/pipeline", protect, authorizePermission("inquiry.view"), crm.getPipeline);
router.post("/leads", protect, authorizePermission("inquiry.update"), crm.createLead);
router.patch("/trials/:trialId", protect, authorizePermission("inquiry.update"), crm.updateTrial);
router.patch("/:id/lead", protect, authorizePermission("inquiry.update"), crm.updateLead);
router.post("/:id/follow-ups", protect, authorizePermission("inquiry.update"), crm.addFollowUp);
router.post("/:id/trials", protect, authorizePermission("inquiry.update"), crm.createTrial);
router.post("/:id/convert", protect, authorizePermission("inquiry.update"), authorizePermission("student.create"), crm.convertLead);

// Public inquiry submission.
router.post("/", createInquiry);

// Database-backed inquiry read permission.
router.get("/", protect, authorizePermission("inquiry.view"), getInquiries);

// Database-backed inquiry update permission.
router.patch(
  "/:id/status",
  protect,
  authorizePermission("inquiry.update"),
  crm.updateLead,
);

module.exports = router;

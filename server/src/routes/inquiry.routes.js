const express = require("express");

const {
  createInquiry,
  getInquiries,
  updateInquiryStatus,
} = require("../controllers/inquiry.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

// Public inquiry submission.
router.post("/", createInquiry);

// Database-backed inquiry read permission.
router.get("/", protect, authorizePermission("inquiry.view"), getInquiries);

// Database-backed inquiry update permission.
router.patch(
  "/:id/status",
  protect,
  authorizePermission("inquiry.update"),
  updateInquiryStatus,
);

module.exports = router;

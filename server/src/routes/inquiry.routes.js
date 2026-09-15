const express = require("express");

const {
  createInquiry,
  getInquiries,
  updateInquiryStatus,
} = require("../controllers/inquiry.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Public inquiry submission
router.post("/", createInquiry);

// Admin, branch admin and coach can view inquiries
router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getInquiries
);

// Only super admin and branch admin can update status
router.patch(
  "/:id/status",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN"),
  updateInquiryStatus
);

module.exports = router;
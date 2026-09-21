const express = require("express");

const {
  getBranches,
  getBranchById,
  createBranch,
  getPublicBranches,
} = require("../controllers/branch.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Public list of active branches (for the enquiry form).
// IMPORTANT: must stay above "/:id".
router.get("/public", getPublicBranches);

router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getBranches
);

// Create branch — only Super Admin
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN"),
  createBranch
);

router.get(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getBranchById
);

module.exports = router;
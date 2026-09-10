const express = require("express");

const {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} = require("../controllers/plan.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Get all plans
router.get(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH"
  ),
  getPlans
);

// Get one plan
router.get(
  "/:id",
  protect,
  authorize(
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "COACH"
  ),
  getPlanById
);

// Create plan
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN"),
  createPlan
);

// Update plan
router.put(
  "/:id",
  protect,
  authorize("SUPER_ADMIN"),
  updatePlan
);

// Delete plan
router.delete(
  "/:id",
  protect,
  authorize("SUPER_ADMIN"),
  deletePlan
);

module.exports = router;
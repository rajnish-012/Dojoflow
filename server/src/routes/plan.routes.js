const express = require("express");

const {
  getPlans,
  getPublicPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  getCurriculumPlans,
  getPlanCurriculum,
  updatePlanCurriculum,
} = require("../controllers/plan.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/*
 * =========================================================
 * PUBLIC PLANS
 * =========================================================
 *
 * Public-facing plan data.
 * No authentication required.
 */

router.get("/public", getPublicPlans);

/*
 * =========================================================
 * CURRICULUM-SPECIFIC APIs
 * =========================================================
 *
 * Curriculum is stored inside Plan.curriculum.
 *
 * These endpoints intentionally use curriculum permissions
 * instead of plan permissions.
 *
 * This keeps curriculum management separate from general
 * plan management.
 */

/*
 * Get plans available to the Curriculum page.
 *
 * Requires:
 *   curriculum.view
 *
 * This route MUST remain before /:id routes.
 */
router.get(
  "/curriculum",
  protect,
  authorizePermission("curriculum.view"),
  getCurriculumPlans,
);

/*
 * Get curriculum for one training plan.
 *
 * Requires:
 *   curriculum.view
 */
router.get(
  "/:id/curriculum",
  protect,
  authorizePermission("curriculum.view"),
  getPlanCurriculum,
);

/*
 * Replace curriculum for one training plan.
 *
 * Requires:
 *   curriculum.manage
 *
 * Only the curriculum field is modified.
 */
router.put(
  "/:id/curriculum",
  protect,
  authorizePermission("curriculum.manage"),
  updatePlanCurriculum,
);

/*
 * =========================================================
 * STANDARD PLAN APIs
 * =========================================================
 *
 * These remain separate from curriculum authorization.
 */

/*
 * Get all plans.
 *
 * Requires:
 *   plan.view
 */
router.get("/", protect, authorizePermission("plan.view"), getPlans);

/*
 * Get one plan.
 *
 * Requires:
 *   plan.view
 */
router.get("/:id", protect, authorizePermission("plan.view"), getPlanById);

/*
 * Create plan.
 *
 * Requires:
 *   plan.manage
 */
router.post("/", protect, authorizePermission("plan.manage"), createPlan);

/*
 * Update plan configuration.
 *
 * Requires:
 *   plan.manage
 *
 * Curriculum-specific changes must use:
 *
 *   PUT /:id/curriculum
 *
 * protected by curriculum.manage.
 */
router.put("/:id", protect, authorizePermission("plan.manage"), updatePlan);

/*
 * Deactivate plan.
 *
 * Requires:
 *   plan.manage
 *
 * This is a soft deactivation.
 * Historical plan data is preserved.
 */
router.delete("/:id", protect, authorizePermission("plan.manage"), deletePlan);

module.exports = router;

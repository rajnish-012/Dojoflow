const express = require("express");

const {
  getMyNavigation,
  getModules,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
} = require("../controllers/module.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/*
 * =========================================================
 * USER NAVIGATION
 * =========================================================
 *
 * The navigation endpoint is available to authenticated users.
 *
 * The controller determines which modules the current user's
 * database role/permissions allow them to see.
 *
 * Frontend navigation is NOT a security boundary.
 */
router.get("/navigation", protect, getMyNavigation);

/*
 * =========================================================
 * MODULE MANAGEMENT
 * =========================================================
 *
 * These endpoints are controlled by database permissions.
 */

/*
 * Get all configured modules.
 *
 * Requires:
 *   module.view
 */
router.get("/", protect, authorizePermission("module.view"), getModules);

/*
 * Create module.
 *
 * Requires:
 *   module.manage
 */
router.post("/", protect, authorizePermission("module.manage"), createModule);

/*
 * IMPORTANT:
 * /reorder must remain before /:id.
 *
 * Requires:
 *   module.manage
 */
router.put(
  "/reorder",
  protect,
  authorizePermission("module.manage"),
  reorderModules,
);

/*
 * Update module.
 *
 * Requires:
 *   module.manage
 */
router.put("/:id", protect, authorizePermission("module.manage"), updateModule);

/*
 * Delete module.
 *
 * Requires:
 *   module.manage
 */
router.delete(
  "/:id",
  protect,
  authorizePermission("module.manage"),
  deleteModule,
);

module.exports = router;

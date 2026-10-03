const express = require("express");

const {
  getRoles,
  getPermissions,
  createRole,
  updateRole,
  deleteRole,
} = require("../controllers/role.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/*
 * =========================================================
 * ROLE MANAGEMENT
 * =========================================================
 *
 * Authorization is database-permission based.
 *
 * SUPER_ADMIN remains protected by the centralized
 * authorization middleware and automatically retains access.
 *
 * Normal/custom roles must receive:
 *
 *   role.view
 *   role.manage
 *
 * from their database Role document.
 */

/*
 * Permission catalog.
 *
 * Reading the catalog requires role.view.
 */
router.get(
  "/permissions",
  protect,
  authorizePermission("role.view"),
  getPermissions,
);

/*
 * Get all roles.
 *
 * Requires:
 *   role.view
 */
router.get("/", protect, authorizePermission("role.view"), getRoles);

/*
 * Create custom role.
 *
 * Requires:
 *   role.manage
 */
router.post("/", protect, authorizePermission("role.manage"), createRole);

/*
 * Update custom role.
 *
 * Requires:
 *   role.manage
 */
router.put("/:id", protect, authorizePermission("role.manage"), updateRole);

/*
 * Delete custom role.
 *
 * Requires:
 *   role.manage
 */
router.delete("/:id", protect, authorizePermission("role.manage"), deleteRole);

module.exports = router;

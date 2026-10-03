const express = require("express");

const {
  getStaffUsers,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
} = require("../controllers/user.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/*
 * =========================================================
 * STAFF / USER MANAGEMENT
 * =========================================================
 *
 * Authorization is now database-permission based.
 *
 * This does NOT allow users to grant themselves permissions.
 *
 * The backend still validates:
 *
 * - selected role exists
 * - selected role is a staff role
 * - SUPER_ADMIN cannot be assigned through staff management
 * - branch requirements based on the database Role.dataScope
 * - Super Admin accounts cannot be edited/deactivated here
 */

/*
 * View staff accounts.
 *
 * Requires:
 *   user.view
 */
router.get("/", protect, authorizePermission("user.view"), getStaffUsers);

/*
 * Create staff account.
 *
 * Requires:
 *   user.create
 */
router.post("/", protect, authorizePermission("user.create"), createStaffUser);

/*
 * Update staff account.
 *
 * Requires:
 *   user.update
 */
router.put(
  "/:id",
  protect,
  authorizePermission("user.update"),
  updateStaffUser,
);

/*
 * Soft-deactivate staff account.
 *
 * Requires:
 *   user.delete
 *
 * The controller performs a soft deactivation rather than
 * deleting historical user data.
 */
router.delete(
  "/:id",
  protect,
  authorizePermission("user.delete"),
  deleteStaffUser,
);

module.exports = router;

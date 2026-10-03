const express = require("express");

const {
  getAcademySettings,
  updateAcademySettings,
  getPublicAcademySettings,
} = require("../controllers/academySettings.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/*
 * =========================================================
 * PUBLIC ACADEMY SETTINGS
 * =========================================================
 *
 * Public branding/contact information.
 *
 * No authentication required.
 */
router.get("/academy/public", getPublicAcademySettings);

/*
 * =========================================================
 * ADMIN ACADEMY SETTINGS
 * =========================================================
 *
 * GET:
 *   settings.view
 *
 * PUT:
 *   settings.manage
 *
 * SUPER_ADMIN continues to have protected system access
 * through authorizePermission().
 */

/*
 * Read academy settings.
 */
router.get(
  "/academy",
  protect,
  authorizePermission("settings.view"),
  getAcademySettings,
);

/*
 * Modify academy settings.
 */
router.put(
  "/academy",
  protect,
  authorizePermission("settings.manage"),
  updateAcademySettings,
);

module.exports = router;

const express = require("express");

const {
  getAcademySettings,
  updateAcademySettings,
  getPublicAcademySettings,
} = require("../controllers/academySettings.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router =
  express.Router();

/*
=========================================================
PUBLIC ACADEMY BRANDING
=========================================================

Used by:
- Public landing page
- Public website
- Header/branding presentation

Only public branding/contact fields are returned
by the controller.
*/

router.get(
  "/academy/public",
  getPublicAcademySettings,
);

/*
=========================================================
ADMIN ACADEMY SETTINGS
=========================================================
*/

router.get(
  "/academy",
  protect,
  authorize("SUPER_ADMIN"),
  getAcademySettings,
);

router.put(
  "/academy",
  protect,
  authorize("SUPER_ADMIN"),
  updateAcademySettings,
);

module.exports = router;
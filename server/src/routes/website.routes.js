const express = require("express");

const {
  getAdminHeroes,
  createHero,
  updateHero,
  deleteHero,

  getAdminSections,
  upsertSection,

  getAdminStatistics,
  createStatistic,
  updateStatistic,
  deleteStatistic,

  getAdminFeatures,
  createFeature,
  updateFeature,
  deleteFeature,

  getPublicWebsiteHome,
} = require("../controllers/websiteContent.controller");

const {
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} = require("../controllers/faq.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

/* =========================================================
   PUBLIC FORCESTRIKE WEBSITE
   ========================================================= */

/*
 * GET /api/website/home
 *
 * Used by the public ForceStrike website.
 *
 * No authentication required.
 *
 * Returns only active/published homepage content
 * stored in MongoDB.
 */
router.get(
  "/home",
  getPublicWebsiteHome,
);


/* =========================================================
   PROTECTED ADMIN CMS
   ========================================================= */

router.use(protect);


/* =========================================================
   HERO
   ========================================================= */

router.get(
  "/heroes",
  authorizePermission("website.view"),
  getAdminHeroes,
);

router.post(
  "/heroes",
  authorizePermission("website.manage"),
  createHero,
);

router.put(
  "/heroes/:id",
  authorizePermission("website.manage"),
  updateHero,
);

router.delete(
  "/heroes/:id",
  authorizePermission("website.manage"),
  deleteHero,
);


/* =========================================================
   HOMEPAGE SECTIONS
   ========================================================= */

router.get(
  "/sections",
  authorizePermission("website.view"),
  getAdminSections,
);

router.put(
  "/sections",
  authorizePermission("website.manage"),
  upsertSection,
);


/* =========================================================
   STATISTICS
   ========================================================= */

router.get(
  "/statistics",
  authorizePermission("website.view"),
  getAdminStatistics,
);

router.post(
  "/statistics",
  authorizePermission("website.manage"),
  createStatistic,
);

router.put(
  "/statistics/:id",
  authorizePermission("website.manage"),
  updateStatistic,
);

router.delete(
  "/statistics/:id",
  authorizePermission("website.manage"),
  deleteStatistic,
);


/* =========================================================
   FEATURES
   ========================================================= */

router.get(
  "/features",
  authorizePermission("website.view"),
  getAdminFeatures,
);

router.post(
  "/features",
  authorizePermission("website.manage"),
  createFeature,
);

router.put(
  "/features/:id",
  authorizePermission("website.manage"),
  updateFeature,
);

router.delete(
  "/features/:id",
  authorizePermission("website.manage"),
  deleteFeature,
);


/* =========================================================
   FAQ
   ========================================================= */

router.get(
  "/faqs",
  authorizePermission("website.view"),
  getFAQs,
);

router.post(
  "/faqs",
  authorizePermission("website.manage"),
  createFAQ,
);

router.put(
  "/faqs/:id",
  authorizePermission("website.manage"),
  updateFAQ,
);

router.delete(
  "/faqs/:id",
  authorizePermission("website.manage"),
  deleteFAQ,
);


module.exports = router;

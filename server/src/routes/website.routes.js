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
const authorize = require("../middleware/role.middleware");

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
router.use(authorize("SUPER_ADMIN"));


/* =========================================================
   HERO
   ========================================================= */

router.get(
  "/heroes",
  getAdminHeroes,
);

router.post(
  "/heroes",
  createHero,
);

router.put(
  "/heroes/:id",
  updateHero,
);

router.delete(
  "/heroes/:id",
  deleteHero,
);


/* =========================================================
   HOMEPAGE SECTIONS
   ========================================================= */

router.get(
  "/sections",
  getAdminSections,
);

router.put(
  "/sections",
  upsertSection,
);


/* =========================================================
   STATISTICS
   ========================================================= */

router.get(
  "/statistics",
  getAdminStatistics,
);

router.post(
  "/statistics",
  createStatistic,
);

router.put(
  "/statistics/:id",
  updateStatistic,
);

router.delete(
  "/statistics/:id",
  deleteStatistic,
);


/* =========================================================
   FEATURES
   ========================================================= */

router.get(
  "/features",
  getAdminFeatures,
);

router.post(
  "/features",
  createFeature,
);

router.put(
  "/features/:id",
  updateFeature,
);

router.delete(
  "/features/:id",
  deleteFeature,
);


/* =========================================================
   FAQ
   ========================================================= */

router.get(
  "/faqs",
  getFAQs,
);

router.post(
  "/faqs",
  createFAQ,
);

router.put(
  "/faqs/:id",
  updateFAQ,
);

router.delete(
  "/faqs/:id",
  deleteFAQ,
);


module.exports = router;
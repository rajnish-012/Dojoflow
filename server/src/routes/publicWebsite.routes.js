const express = require("express");

const {
  getPublicWebsiteHome,
} = require("../controllers/websiteContent.controller");

const {
  getPublicFAQs,
} = require("../controllers/faq.controller");

const router = express.Router();

/* =========================================================
   PUBLIC HOMEPAGE
========================================================= */

router.get(
  "/home",
  getPublicWebsiteHome,
);

/* =========================================================
   PUBLIC FAQ
========================================================= */

router.get(
  "/faqs",
  getPublicFAQs,
);

module.exports = router;
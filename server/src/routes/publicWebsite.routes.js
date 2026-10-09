const express = require("express");

const {
  getPublicWebsiteHome,
} = require("../controllers/websiteContent.controller");

const {
  getPublicFAQs,
} = require("../controllers/faq.controller");
const { getPublicProducts } = require("../controllers/inventory.controller");

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

router.get("/merchandise", getPublicProducts);

module.exports = router;

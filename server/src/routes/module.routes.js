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
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Sidebar items for the logged-in user (any role).
// IMPORTANT: must stay above "/:id" routes.
router.get("/navigation", protect, getMyNavigation);

// Everything below is Super Admin only.
router.get("/", protect, authorize("SUPER_ADMIN"), getModules);

router.post("/", protect, authorize("SUPER_ADMIN"), createModule);

// IMPORTANT: "/reorder" must stay above "/:id"
router.put(
  "/reorder",
  protect,
  authorize("SUPER_ADMIN"),
  reorderModules
);

router.put("/:id", protect, authorize("SUPER_ADMIN"), updateModule);

router.delete("/:id", protect, authorize("SUPER_ADMIN"), deleteModule);

module.exports = router;
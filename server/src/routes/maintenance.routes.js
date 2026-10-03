const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const { getHealth, getMaintenanceSettings, updateMaintenanceSettings } = require("../controllers/maintenance.controller");

const router = express.Router();

router.get("/health", protect, authorizePermission("maintenance.health"), getHealth);
router.get("/settings", protect, authorizePermission("maintenance.view"), getMaintenanceSettings);
router.put("/settings", protect, authorizePermission("maintenance.mode"), updateMaintenanceSettings);

module.exports = router;

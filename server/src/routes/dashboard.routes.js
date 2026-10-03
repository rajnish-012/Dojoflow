const express = require("express");

const { getDashboard } = require("../controllers/dashboard.controller");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");

const router = express.Router();

router.get("/", protect, authorizePermission("dashboard.view"), getDashboard);

module.exports = router;

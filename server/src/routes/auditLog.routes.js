const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const { getAuditLogs, getAuditLogById } = require("../controllers/auditLog.controller");

const router = express.Router();
router.use(protect, authorizePermission("audit.view"));
router.get("/", getAuditLogs);
router.get("/:id", getAuditLogById);
// There are intentionally no mutation routes for historical audit records.
module.exports = router;

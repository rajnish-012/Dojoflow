const express = require("express");

const {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} = require("../controllers/role.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Only the Super Admin manages roles.
router.get("/", protect, authorize("SUPER_ADMIN"), getRoles);

router.post("/", protect, authorize("SUPER_ADMIN"), createRole);

router.put("/:id", protect, authorize("SUPER_ADMIN"), updateRole);

router.delete("/:id", protect, authorize("SUPER_ADMIN"), deleteRole);

module.exports = router;
const express = require("express");

const {
  getBranches,
  getBranchById,
} = require("../controllers/branch.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

router.get(
  "/",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getBranches
);

router.get(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "BRANCH_ADMIN", "COACH"),
  getBranchById
);

module.exports = router;
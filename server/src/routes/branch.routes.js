const express = require("express");

const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const {
  getBranches,
  getPublicBranches,
  getBranchById,
  createBranch,
  updateBranch,
} = require("../controllers/branch.controller");

const router = express.Router();

/* Keep public routes before authentication middleware. */
router.get("/public", getPublicBranches);

router.use(protect);

router.get("/", authorizePermission("branch.view"), getBranches);
router.post("/", authorizePermission("branch.manage"), createBranch);
router.get("/:id", authorizePermission("branch.view"), getBranchById);
router.put("/:id", authorizePermission("branch.manage"), updateBranch);

module.exports = router;

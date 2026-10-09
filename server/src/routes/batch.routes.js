const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const controller = require("../controllers/batch.controller");

const router = express.Router();
router.use(protect);
router.get("/", controller.listBatches);
router.get("/coaches", controller.listBatchCoaches);
router.post("/", authorizePermission("plan.manage"), controller.createBatch);
router.patch("/:id", authorizePermission("plan.manage"), controller.updateBatch);

module.exports = router;

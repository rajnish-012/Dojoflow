const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const controller = require("../controllers/trainingSessionType.controller");
const router = express.Router();

router.get("/public", controller.list);
router.use(protect);
router.get("/", authorizePermission("training_session_type.view"), controller.list);
router.post("/", authorizePermission("training_session_type.create"), controller.create);
router.put("/:id", authorizePermission("training_session_type.update"), controller.update);
router.delete("/:id", authorizePermission("training_session_type.delete"), controller.remove);
module.exports = router;

const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const controller = require("../controllers/certificate.controller");

const router = express.Router();
router.use(protect);
router.get("/", authorizePermission("certificate.view"), controller.listCertificates);
router.get("/completion-eligible", authorizePermission("certificate.view"), controller.listProgramCompletionCandidates);
router.get("/me", authorizePermission("student.grading.view"), controller.getMyCertificates);
router.get("/:id", (req, res, next) => {
  const permission = req.user?.role === "STUDENT" ? "student.grading.view" : "certificate.download";
  return authorizePermission(permission)(req, res, next);
}, controller.getCertificate);
router.post("/promotions/:promotionId", authorizePermission("certificate.generate"), controller.issuePromotionCertificate);
router.post("/program-completion", authorizePermission("certificate.generate"), controller.issueProgramCompletionCertificate);
router.post("/achievements", authorizePermission("certificate.generate"), controller.issueAchievementCertificate);

module.exports = router;

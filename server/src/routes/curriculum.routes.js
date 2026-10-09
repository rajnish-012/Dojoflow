const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const controller = require("../controllers/curriculum.controller");

const router = express.Router();
router.use(protect);

router.get("/versions", authorizePermission("curriculum.view"), controller.listVersions);
router.get("/capacity", authorizePermission("curriculum.view"), controller.getCapacity);
router.post("/plans/:planId/programs/:programId/drafts", authorizePermission("curriculum.manage"), controller.createDraft);
router.put("/versions/:id", authorizePermission("curriculum.manage"), controller.updateDraft);
router.post("/versions/:id/modules", authorizePermission("curriculum.manage"), controller.appendPublishedModule);
router.post("/versions/:id/publish", authorizePermission("curriculum.manage"), controller.publish);
router.patch("/versions/:id/archive", authorizePermission("curriculum.manage"), controller.archive);

router.get("/sessions", authorizePermission("calendar.view"), controller.listSessions);
router.put("/sessions/:id/content", authorizePermission("branch_schedule.manage"), controller.updateSessionContent);

router.get("/students/:studentId/progress", (req, res, next) => {
  const permission = String(req.user?.role || "").toUpperCase() === "STUDENT" ? "curriculum.progress.view" : "student.view";
  return authorizePermission(permission)(req, res, next);
}, controller.studentCurriculumProgress);
router.put("/students/:studentId/steps/:stepId/progress", authorizePermission("attendance.manage"), controller.recordStepProgress);
router.post("/students/:studentId/milestones/:achievementId/approve", authorizePermission("attendance.manage"), controller.approveMilestone);
router.post("/students/:studentId/milestones/:achievementId/rewards/:rewardId/issue", authorizePermission("curriculum.reward.manage"), controller.issueMilestoneReward);
router.post("/students/:studentId/milestones/:achievementId/rewards/:rewardId/fulfill", authorizePermission("curriculum.reward.manage"), controller.fulfillMilestoneReward);

module.exports = router;

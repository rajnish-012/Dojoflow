const BeltHistory = require("../models/BeltHistory");
const StudentCurriculumMilestone = require("../models/StudentCurriculumMilestone");
const { getProgramLearningProgress } = require("./programProgress.service");
const { resolveProgramCurriculum } = require("./curriculumResolver.service");
const { findEnrollmentForDate } = require("./enrollmentLifecycle.service");

const id = (value) => String(value?._id || value || "");
const progressionStatuses = ["AWAITING_GRADING", "AWAITING_PROMOTION_APPROVAL"];

async function findCurriculumBeltProgression({ studentId, enrollmentId, programId, curriculumId, currentBelt }) {
  if (!studentId || !enrollmentId || !programId || !curriculumId) return null;
  const awards = await StudentCurriculumMilestone.find({
    student: studentId,
    enrollment: enrollmentId,
    program: programId,
    curriculum: curriculumId,
    $or: [
      { status: "EARNED", rewards: { $elemMatch: { type: "BELT_PROGRESSION", status: { $in: [...progressionStatuses, "PENDING_APPROVAL"] } } } },
      { status: "PENDING_APPROVAL", rewards: { $elemMatch: { type: "BELT_PROGRESSION", status: "PENDING_APPROVAL" } } },
    ],
  }).sort({ criteriaMetAt: 1, createdAt: 1, _id: 1 }).lean();

  let waitingForApproval = null;
  for (const award of awards) {
    for (const reward of award.rewards || []) {
      if (reward.type !== "BELT_PROGRESSION" || !String(reward.targetBelt || "").trim()) continue;
      const pendingCoachApproval = award.status !== "EARNED" || reward.status === "PENDING_APPROVAL";
      if (pendingCoachApproval) {
        waitingForApproval ||= {
        belt: reward.targetBelt,
        skill: award.milestoneName || "",
        description: award.milestoneDescription || "",
        requiresFormalGrading: reward.requiresFormalGrading !== false,
        status: "PENDING_APPROVAL",
        curriculumMilestoneId: award._id,
        curriculumRewardId: reward._id,
        curriculumId: award.curriculum,
        curriculumStepId: award.milestoneStepId,
        };
        continue;
      }
      if (!progressionStatuses.includes(reward.status) || String(reward.targetBelt).trim().toLowerCase() === String(currentBelt || "").trim().toLowerCase()) continue;
      return {
        belt: reward.targetBelt,
        skill: award.milestoneName || "",
        description: award.milestoneDescription || "",
        requiresFormalGrading: reward.requiresFormalGrading !== false,
        status: reward.status,
        curriculumMilestoneId: award._id,
        curriculumRewardId: reward._id,
        curriculumId: award.curriculum,
        curriculumStepId: award.milestoneStepId,
      };
    }
  }
  return waitingForApproval;
}

/** Eligibility is based on an earned milestone reward in the active enrollment's frozen curriculum version. */
async function evaluateStudentPromotionEligibility(student, { asOfDate = new Date(), programId } = {}) {
  if (!student?.plan) return [{ eligible: false, reason: "Student does not have an assigned training plan." }];
  if (student.status !== "ACTIVE") return [{ eligible: false, reason: "Only active students can be promoted." }];

  const enrollment = findEnrollmentForDate(student.planEnrollments, asOfDate);
  const entitlements = enrollment?.programs?.length
    ? enrollment.programs
    : (student.plan.programs || []).map((item) => ({ program: item.program?._id || item.program, curriculumVersion: item.curriculumVersion }));
  if (!entitlements.length) return [{ eligible: false, reason: "No program is included in the active plan." }];
  if (programId && entitlements.every((item) => id(item.program) !== String(programId))) return [{ eligible: false, reason: "The selected program is not included in the active plan." }];

  const results = [];
  for (const entitlement of entitlements) {
    const selectedProgramId = entitlement.program?._id || entitlement.program;
    if (!selectedProgramId || (programId && String(selectedProgramId) !== String(programId))) continue;
    const planProgram = (student.plan.programs || []).find((item) => id(item.program) === id(selectedProgramId));
    const curriculum = resolveProgramCurriculum(entitlement, planProgram, student.plan.curriculum);
    const { currentTrainingDay } = await getProgramLearningProgress({
      studentId: student._id,
      programId: selectedProgramId,
      enrollmentId: enrollment?._id,
      enrollmentStartDate: enrollment?.startDate,
      enrollmentEndDate: enrollment?.endDate,
      curriculum,
      asOfDate,
    });
    const currentBelt = student.programBelts?.find((item) => id(item.program) === id(selectedProgramId))?.belt ||
      (entitlements.length === 1 ? student.currentBelt : enrollment?.startingBelt) || student.plan.startingBelt || "White";
    const curriculumId = id(entitlement.curriculumVersion);
    const milestone = await findCurriculumBeltProgression({ studentId: student._id, enrollmentId: enrollment?._id, programId: selectedProgramId, curriculumId, currentBelt });
    const existingHistory = milestone ? await BeltHistory.findOne({ student: student._id, sessionTypeId: selectedProgramId, toBelt: milestone.belt }).lean() : null;
    const awaitingApproval = milestone?.status === "PENDING_APPROVAL";
    const eligible = Boolean(milestone && !awaitingApproval && !existingHistory);
    results.push({
      eligible,
      reason: existingHistory ? "This belt promotion has already been recorded." : awaitingApproval ? "The curriculum milestone is awaiting coach approval." : milestone ? "" : "No earned Curriculum belt-progression milestone is awaiting grading or approval.",
      student,
      programId: selectedProgramId,
      enrollment,
      trainingDay: currentTrainingDay,
      currentBelt,
      program: planProgram?.program || entitlement.program,
      programCount: entitlements.length,
      milestone: eligible ? milestone : null,
      curriculumMilestone: milestone,
    });
  }
  return results.length ? results : [{ eligible: false, reason: "No matching active program was found." }];
}

module.exports = { findCurriculumBeltProgression, evaluateStudentPromotionEligibility };

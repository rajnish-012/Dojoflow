function completionRequirementError({ step, status, assessmentResult = "", assessmentPassed = false, prerequisiteStepIds = [], completedStepIds = [], attendance = null }) {
  if (status !== "COMPLETED") return "";
  if (step?.assessmentRequired && !String(assessmentResult).trim()) return "Record the required assessment result before completing this step.";
  const hasLegacyMilestoneRules = Boolean(step?.milestoneName || step?.milestoneDescription || step?.milestoneCriteria || step?.milestoneRequiredStepIds?.length);
  const assessmentMustPass = step?.assessmentPassRequired || (step?.isMilestone && step?.assessmentRequired && hasLegacyMilestoneRules);
  if (assessmentMustPass && !assessmentPassed) return "The required assessment must be recorded as passed before completing this step.";
  if (assessmentMustPass && step?.assessmentPassingValue && String(assessmentResult).trim().toLowerCase() !== String(step.assessmentPassingValue).trim().toLowerCase()) return `Enter the configured passing assessment result (${step.assessmentPassingValue}).`;
  if (prerequisiteStepIds.some((required) => !completedStepIds.includes(String(required)))) return "Complete the required prerequisite modules or steps first.";
  if (step?.attendanceRequired && attendance?.status !== "PRESENT") return "This learning step requires Present attendance at an assigned Session.";
  return "";
}

function milestoneRequirementResult({ milestoneStep, curriculumSteps = [], progressByStep = new Map() }) {
  if (!milestoneStep?.isMilestone) return { eligible: false, missingStepIds: [], failedAssessmentStepIds: [] };
  const required = [...new Set([String(milestoneStep._id), ...(milestoneStep.milestoneRequiredStepIds || []).map(String)])];
  const missingStepIds = required.filter((stepId) => progressByStep.get(stepId)?.status !== "COMPLETED");
  const byId = new Map(curriculumSteps.map((step) => [String(step._id), step]));
  const hasLegacyMilestoneRules = Boolean(milestoneStep.milestoneName || milestoneStep.milestoneDescription || milestoneStep.milestoneCriteria || milestoneStep.milestoneRequiredStepIds?.length);
  const failedAssessmentStepIds = required.filter((stepId) => {
    const step = byId.get(stepId);
    const assessmentMustPass = step?.assessmentPassRequired || (step?.assessmentRequired && (String(step._id) !== String(milestoneStep._id) || hasLegacyMilestoneRules));
    return step && assessmentMustPass && !progressByStep.get(stepId)?.assessmentPassed;
  });
  return { eligible: missingStepIds.length === 0 && failedAssessmentStepIds.length === 0, missingStepIds, failedAssessmentStepIds };
}

module.exports = { completionRequirementError, milestoneRequirementResult };

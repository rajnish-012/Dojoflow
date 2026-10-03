/**
 * Resolve the curriculum used by an active program enrollment.
 * The plan is the editable source of truth; enrollment curriculum is retained
 * as a compatibility fallback for older plans without configured program data.
 */
function resolveProgramCurriculum(
  enrollmentProgram,
  planProgram,
  legacyCurriculum = [],
) {
  if (Array.isArray(planProgram?.curriculum) && planProgram.curriculum.length) {
    return planProgram.curriculum;
  }
  if (
    Array.isArray(enrollmentProgram?.curriculum) &&
    enrollmentProgram.curriculum.length
  ) {
    return enrollmentProgram.curriculum;
  }
  if (Array.isArray(legacyCurriculum)) return legacyCurriculum;
  return [];
}

module.exports = { resolveProgramCurriculum };

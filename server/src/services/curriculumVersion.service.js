const Curriculum = require("../models/Curriculum");
const crypto = require("crypto");

async function getPublishedCurriculumByProgram(planId, programIds = []) {
  const ids = [...new Set(programIds.map((item) => String(item?._id || item)).filter(Boolean))];
  if (!planId || !ids.length) return new Map();
  const versions = await Curriculum.find({ plan: planId, program: { $in: ids }, status: "PUBLISHED" })
    .sort({ version: -1, publishedAt: -1 })
    .lean();
  const result = new Map();
  for (const version of versions) if (!result.has(String(version.program))) result.set(String(version.program), version._id);
  return result;
}

// Existing enrollment snapshots are immutable historical records. Convert that
// exact snapshot lazily when curriculum progress is first opened, so old
// enrollments never inherit whatever happens to be current on the Plan today.
async function ensureLegacyEnrollmentCurriculum(student, enrollment, entitlement) {
  if (entitlement?.curriculumVersion || !Array.isArray(entitlement?.curriculum) || !entitlement.curriculum.length) return entitlement?.curriculumVersion || null;
  const planId = String(enrollment.plan?._id || enrollment.plan || "");
  const programId = String(entitlement.program?._id || entitlement.program || "");
  if (!planId || !programId) return null;
  const canonical = entitlement.curriculum.map((row) => ({ day: Number(row.day) || 0, title: String(row.title || ""), description: String(row.description || ""), skill: String(row.skill || "") }));
  const legacyFingerprint = crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  let curriculum = await Curriculum.findOne({ plan: planId, program: programId, legacyFingerprint });
  if (!curriculum) {
    const modules = canonical.length ? [{
      name: "Legacy learning steps", description: "Imported from the enrollment's frozen day-based curriculum. Day labels are retained for reference and are not milestones.", order: 1,
      objectives: [],
      steps: canonical.map((row, index) => ({ title: row.title || `Day ${row.day || index + 1}`, description: row.description, objectives: row.skill ? [row.skill] : [], coachApprovalRequired: true, legacyTrainingDay: row.day || index + 1 })),
    }] : [];
    const latest = await Curriculum.findOne({ plan: planId, program: programId }).sort({ version: -1 }).select("version").lean();
    try {
      curriculum = await Curriculum.create({ plan: planId, program: programId, version: (latest?.version || 0) + 1, name: "Legacy enrollment curriculum", description: "Frozen from the curriculum snapshot stored when this enrollment was created.", status: "ARCHIVED", modules, legacyFingerprint });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      curriculum = await Curriculum.findOne({ plan: planId, program: programId, legacyFingerprint });
      if (!curriculum) throw error;
    }
  }
  entitlement.curriculumVersion = curriculum._id;
  await student.save();
  return curriculum._id;
}

module.exports = { getPublishedCurriculumByProgram, ensureLegacyEnrollmentCurriculum };

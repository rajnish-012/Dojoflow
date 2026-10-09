const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { validateModules } = require("../../src/controllers/curriculum.controller");
const { completionRequirementError, milestoneRequirementResult } = require("../../src/services/curriculumProgress.service");
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require("../../src/config/permissions");
const StudentCurriculumMilestone = require("../../src/models/StudentCurriculumMilestone");
const { findCurriculumBeltProgression } = require("../../src/services/promotionEligibility.service");

const plan = { milestones: [{ day: 3, belt: "Configured by academy" }] };

test("draft curricula may be incomplete, while publication requires modules and titled steps", () => {
  assert.deepEqual(validateModules([], plan, false), []);
  assert.throws(() => validateModules([], plan, true), /at least one module/);
  assert.throws(() => validateModules([{ order: 1, name: "Module", steps: [{ title: "" }] }], plan, true), /needs a title/);
});

test("ordinary steps need no milestone fields and day numbering does not create milestones", () => {
  const [module] = validateModules([{ name: "Fundamentals", order: 1, steps: [{ title: "Stance", milestoneDay: 3 }, { title: "Balance" }] }], plan, true);
  assert.equal(module.steps.length, 2);
  assert.equal(module.steps[0].milestoneDay, 3);
  assert.equal(module.steps[0].isMilestone, false);
  assert.equal(module.steps[1].isMilestone, false);
});

test("single-module and multi-module curricula both publish with optional milestones", () => {
  const single = validateModules([{ name: "Karate Fundamentals", order: 1, steps: [{ title: "Etiquette" }, { title: "Balance" }] }], plan, true);
  assert.equal(single.length, 1);
  assert.equal(single[0].steps.length, 2);
  const multiple = validateModules([{ name: "Basics", order: 1, steps: [{ title: "Stance" }] }, { name: "Practice", order: 2, steps: [{ title: "Guard" }] }], plan, true);
  assert.equal(multiple.length, 2);
});

test("milestones publish using their learning-step title and completion requirements, with no reward required", () => {
  const stepId = new mongoose.Types.ObjectId().toString();
  const base = { _id: stepId, title: "Fundamentals", description: "Practice the fundamentals", completionCriteria: "Demonstrate the basic skills", isMilestone: true, coachApprovalRequired: false, attendanceRequired: true, assessmentRequired: true, rewards: [] };
  const [module] = validateModules([{ name: "Fundamentals", order: 1, steps: [base] }], plan, true);
  assert.equal(module.steps[0].isMilestone, true);
  assert.equal(module.steps[0].milestoneName, "");
  assert.equal(module.steps[0].milestoneDescription, "");
  assert.equal(module.steps[0].milestoneCriteria, "");
  assert.equal(module.steps[0].coachApprovalRequired, false);
  assert.equal(module.steps[0].attendanceRequired, true);
  assert.equal(module.steps[0].assessmentRequired, true);
  assert.deepEqual(module.steps[0].rewards, []);
  const withoutRequirements = validateModules([{ name: "Basics", order: 1, steps: [{ title: "Milestone", isMilestone: true }] }], plan, true);
  assert.equal(withoutRequirements[0].steps[0].milestoneName, "");
  assert.deepEqual(withoutRequirements[0].steps[0].rewards, []);
});

test("belt progression rewards select a curriculum-owned target belt and keep formal grading enabled", () => {
  const configured = { rewardId: "pending-reward", type: "BELT_PROGRESSION", targetBelt: "Configured by academy", targetMilestoneDay: 3, active: true };
  const [module] = validateModules([{ name: "Fundamentals", order: 1, steps: [{ title: "Milestone", isMilestone: true, rewards: [configured] }] }], { milestones: [{ day: 3, belt: "Legacy Plan rank" }] }, true);
  assert.equal(module.steps[0].rewards[0].name, "Configured by academy");
  assert.equal(module.steps[0].rewards[0].requiresFormalGrading, true);
  assert.equal(module.steps[0].rewards[0].targetMilestoneDay, 3, "legacy target days remain readable but do not determine eligibility");
  assert.throws(() => validateModules([{ name: "Fundamentals", order: 1, steps: [{ title: "Milestone", isMilestone: true, rewards: [{ ...configured, targetBelt: "" }] }] }], { milestones: [] }, true), /invalid milestone reward/);
});

test("legacy grading day remains independent of milestone achievement and belt reward completion awaits workflow", () => {
  const [module] = validateModules([{ name: "Fundamentals", order: 1, steps: [{ title: "Ordinary step", milestoneDay: 3 }] }], plan, true);
  assert.equal(module.steps[0].isMilestone, false);
  assert.equal(module.steps[0].milestoneDay, 3);
  const rewardSchema = StudentCurriculumMilestone.schema.path("rewards").schema;
  assert.ok(rewardSchema.path("status").enumValues.includes("AWAITING_GRADING"));
  assert.ok(rewardSchema.path("status").enumValues.includes("AWAITING_PROMOTION_APPROVAL"));
});

test("turning off a milestone preserves its configuration without validating hidden milestone-only fields", () => {
  const rewards = [{ rewardId: "legacy-reward", type: "CUSTOM", name: "Existing reward" }];
  const [module] = validateModules([{ name: "Fundamentals", order: 1, steps: [{ title: "Ordinary step", isMilestone: false, milestoneName: "Retained name", milestoneRequiredStepIds: ["old-step-id"], rewards }] }], plan, true);
  assert.equal(module.steps[0].isMilestone, false);
  assert.equal(module.steps[0].milestoneName, "Retained name");
  assert.deepEqual(module.steps[0].milestoneRequiredStepIds, ["old-step-id"]);
  assert.deepEqual(module.steps[0].rewards, rewards);
});

test("step and module IDs remain stable when curriculum items are reordered", () => {
  const first = new mongoose.Types.ObjectId().toString();
  const second = new mongoose.Types.ObjectId().toString();
  const moduleA = new mongoose.Types.ObjectId().toString();
  const moduleB = new mongoose.Types.ObjectId().toString();
  const source = [
    { _id: moduleA, name: "A", order: 1, steps: [{ _id: first, title: "One" }] },
    { _id: moduleB, name: "B", order: 2, steps: [{ _id: second, title: "Two" }] },
  ];
  const reordered = validateModules([{ ...source[1], order: 1 }, { ...source[0], order: 2 }], plan, true);
  assert.deepEqual(reordered.map((item) => item._id), [moduleB, moduleA]);
  assert.equal(reordered[0].steps[0]._id, second);
  assert.equal(reordered[1].steps[0]._id, first);
});

test("temporary draft IDs are remapped consistently inside module and step prerequisites", () => {
  const modules = validateModules([
    { _id: "pending-module-a", name: "Prerequisite", order: 1, steps: [{ _id: "pending-step-a", title: "Foundation" }] },
    { _id: "pending-module-b", name: "Next", order: 2, prerequisites: ["pending-module-a"], steps: [{ _id: "pending-step-b", title: "Advanced", prerequisites: ["pending-step-a"] }] },
  ], plan, false);
  assert.match(modules[0]._id, /^[a-f\d]{24}$/i);
  assert.match(modules[0].steps[0]._id, /^[a-f\d]{24}$/i);
  assert.deepEqual(modules[1].prerequisites, [modules[0]._id]);
  assert.deepEqual(modules[1].steps[0].prerequisites, [modules[0].steps[0]._id]);
});

test("legacy curriculum day values do not require Plan milestones, while cyclic prerequisites remain invalid", () => {
  const [legacyDayModule] = validateModules([{ name: "Module", order: 1, steps: [{ title: "Step", milestoneDay: 4 }] }], { milestones: [] }, true);
  assert.equal(legacyDayModule.steps[0].milestoneDay, 4);
  const moduleId = new mongoose.Types.ObjectId().toString();
  const stepA = new mongoose.Types.ObjectId().toString();
  const stepB = new mongoose.Types.ObjectId().toString();
  assert.throws(() => validateModules([{ _id: moduleId, name: "Module", order: 1, steps: [{ _id: stepA, title: "A", prerequisites: [stepB] }, { _id: stepB, title: "B", prerequisites: [stepA] }] }], plan, true), /cannot contain a cycle/);
});

test("attendance does not complete a step without an explicit coach progress update", () => {
  const step = { attendanceRequired: true, assessmentRequired: false };
  assert.match(completionRequirementError({ step, status: "COMPLETED", attendance: null }), /requires Present attendance/);
  assert.equal(completionRequirementError({ step, status: "IN_PROGRESS", attendance: null }), "");
  assert.equal(completionRequirementError({ step, status: "COMPLETED", attendance: { status: "PRESENT" } }), "");
});

test("assessment and prerequisites are enforced before completion", () => {
  const step = { assessmentRequired: true };
  assert.match(completionRequirementError({ step, status: "COMPLETED", assessmentResult: "", prerequisiteStepIds: ["prior"], completedStepIds: [] }), /assessment result/);
  assert.match(completionRequirementError({ step, status: "COMPLETED", assessmentResult: "Pass", prerequisiteStepIds: ["prior"], completedStepIds: [] }), /prerequisite/);
  assert.equal(completionRequirementError({ step, status: "COMPLETED", assessmentResult: "Pass", prerequisiteStepIds: ["prior"], completedStepIds: ["prior"] }), "");
  assert.match(completionRequirementError({ step: { assessmentPassRequired: true }, status: "COMPLETED", assessmentPassed: false }), /recorded as passed/);
  assert.equal(completionRequirementError({ step: { assessmentPassRequired: true }, status: "COMPLETED", assessmentPassed: true }), "");
  assert.match(completionRequirementError({ step: { assessmentPassRequired: true, assessmentPassingValue: "PASS" }, status: "COMPLETED", assessmentPassed: true, assessmentResult: "FAIL" }), /configured passing assessment result/);
  assert.equal(completionRequirementError({ step: { assessmentPassRequired: true, assessmentPassingValue: "PASS" }, status: "COMPLETED", assessmentPassed: true, assessmentResult: "pass" }), "");
});

test("minimal milestones follow step assessment rules while legacy milestone assessment rules remain enforced", () => {
  const ordinaryAssessment = { isMilestone: true, assessmentRequired: true, assessmentPassRequired: false, milestoneName: "", milestoneCriteria: "" };
  assert.equal(completionRequirementError({ step: ordinaryAssessment, status: "COMPLETED", assessmentResult: "Observed", assessmentPassed: false }), "");
  assert.match(completionRequirementError({ step: { ...ordinaryAssessment, assessmentPassRequired: true }, status: "COMPLETED", assessmentResult: "Observed", assessmentPassed: false }), /must be recorded as passed/);
  assert.match(completionRequirementError({ step: { ...ordinaryAssessment, milestoneName: "Legacy achievement", milestoneCriteria: "Old custom criteria" }, status: "COMPLETED", assessmentResult: "Observed", assessmentPassed: false }), /must be recorded as passed/);
});

test("milestone criteria require every configured step and passing required assessments", () => {
  const milestone = { _id: "milestone", isMilestone: true, milestoneRequiredStepIds: ["one"] };
  const steps = [milestone, { _id: "one", assessmentRequired: true }];
  assert.deepEqual(milestoneRequirementResult({ milestoneStep: milestone, curriculumSteps: steps, progressByStep: new Map([ ["milestone", { status: "COMPLETED" }] ]) }), { eligible: false, missingStepIds: ["one"], failedAssessmentStepIds: ["one"] });
  assert.deepEqual(milestoneRequirementResult({ milestoneStep: milestone, curriculumSteps: steps, progressByStep: new Map([ ["milestone", { status: "COMPLETED" }], ["one", { status: "COMPLETED", assessmentPassed: true }] ]) }), { eligible: true, missingStepIds: [], failedAssessmentStepIds: [] });
});

test("students receive only the dedicated curriculum-progress read permission", () => {
  assert.ok(DEFAULT_ROLE_PERMISSIONS.STUDENT.includes(PERMISSIONS.CURRICULUM_PROGRESS_VIEW));
  assert.ok(!DEFAULT_ROLE_PERMISSIONS.STUDENT.includes(PERMISSIONS.STUDENT_VIEW));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.BRANCH_ADMIN.includes(PERMISSIONS.CURRICULUM_REWARD_MANAGE));
  assert.ok(!DEFAULT_ROLE_PERMISSIONS.COACH.includes(PERMISSIONS.CURRICULUM_REWARD_MANAGE));
});

test("milestone achievement uniqueness is scoped to enrollment, curriculum version, and milestone step", () => {
  const uniqueIndex = StudentCurriculumMilestone.schema.indexes().find(([keys, options]) => options.unique && options.name === "uniq_curriculum_milestone_per_enrollment");
  assert.deepEqual(uniqueIndex?.[0], { student: 1, enrollment: 1, curriculum: 1, milestoneStepId: 1 });
});

test("belt eligibility only queries awards inside the active enrollment and Curriculum version", async () => {
  const originalFind = StudentCurriculumMilestone.find;
  let query;
  StudentCurriculumMilestone.find = (filter) => {
    query = filter;
    return { sort: () => ({ lean: async () => [] }) };
  };
  try {
    assert.equal(await findCurriculumBeltProgression({ studentId: "student", enrollmentId: "enrollment", programId: "program", curriculumId: null, currentBelt: "White" }), null);
    assert.equal(query, undefined, "missing frozen Curriculum version cannot fall back to Plan milestones");
    await findCurriculumBeltProgression({ studentId: "student", enrollmentId: "enrollment", programId: "program", curriculumId: "curriculum-v2", currentBelt: "White" });
    assert.equal(query.student, "student");
    assert.equal(query.enrollment, "enrollment");
    assert.equal(query.program, "program");
    assert.equal(query.curriculum, "curriculum-v2");
  } finally {
    StudentCurriculumMilestone.find = originalFind;
  }
});

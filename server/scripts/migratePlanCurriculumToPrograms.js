require("dotenv").config();
const mongoose = require("mongoose");
const Plan = require("../src/models/Plan");

async function main() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI);
  const plans = await Plan.find({}).select("name curriculum programs");
  let changed = 0;
  for (const plan of plans) {
    const source = Array.isArray(plan.curriculum) ? plan.curriculum : [];
    if (!source.length || !plan.programs?.length) continue;
    let planChanged = false;
    for (const entitlement of plan.programs) {
      if (!Array.isArray(entitlement.curriculum) || entitlement.curriculum.length === 0) {
        if (apply) entitlement.curriculum = source.map((item) => ({ day: item.day, title: item.title, description: item.description || "", skill: item.skill || "" }));
        planChanged = true;
      }
    }
    if (planChanged) {
      changed += 1;
      if (apply) await plan.save();
    }
  }
  console.log(`${apply ? "Migrated" : "Would migrate"} curriculum for ${changed} plan(s).${apply ? "" : " Run with --apply to write changes."}`);
}

main().catch((error) => {
  console.error("Plan curriculum migration failed:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});

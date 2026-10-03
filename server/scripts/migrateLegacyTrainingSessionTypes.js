require("dotenv").config();
const mongoose = require("mongoose");
const BranchSchedule = require("../src/models/BranchSchedule");
const BranchDateSchedule = require("../src/models/BranchDateSchedule");
const TrainingSessionType = require("../src/models/TrainingSessionType");

const apply = process.argv.includes("--apply");
const normalize = (value) => String(value || "").trim().replaceAll("_", " ").replace(/\s+/g, " ");
const slugify = (value) => normalize(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function findOrCreateType(name) {
  const slug = slugify(name);
  const normalizedName = name.toLocaleLowerCase();
  let type = await TrainingSessionType.findOne({ $or: [{ slug }, { normalizedName }] });
  if (type) return type;
  try {
    return await TrainingSessionType.create({ name, normalizedName, slug, description: "Migrated from legacy branch schedule data", isActive: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    type = await TrainingSessionType.findOne({ $or: [{ slug }, { normalizedName }] });
    if (type) return type;
    throw error;
  }
}

async function migrateCollection(Model, path) {
  const docs = await Model.find({ [path]: { $exists: true, $ne: null } }).select(path).lean();
  let migrated = 0;
  for (const doc of docs) {
    const groups = path === "weeklySchedule.slots"
      ? (doc.weeklySchedule || []).map((day, dayIndex) => ({ slots: day.slots || [], fieldPrefix: `weeklySchedule.${dayIndex}.slots` }))
      : [{ slots: doc.slots || [], fieldPrefix: "slots" }];
    for (const group of groups) for (let index = 0; index < group.slots.length; index += 1) {
      const slot = group.slots[index];
      if (!slot.sessionType || slot.sessionTypeId) continue;
      const name = normalize(slot.sessionType);
      const type = apply ? await findOrCreateType(name) : null;
      if (apply) {
        const field = `${group.fieldPrefix}.${index}.sessionTypeId`;
        await Model.updateOne({ _id: doc._id }, { $set: { [field]: type._id } });
      }
      migrated += 1;
    }
  }
  return migrated;
}

(async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);
  if (!apply) console.log("Dry run only. No database records will be changed. Pass --apply after backup to migrate.");
  const weekly = await migrateCollection(BranchSchedule, "weeklySchedule.slots");
  const overrides = await migrateCollection(BranchDateSchedule, "slots");
  console.log(`${apply ? "Migrated" : "Would migrate"} ${weekly + overrides} legacy schedule slot(s) (${weekly} weekly, ${overrides} date overrides).`);
  await mongoose.disconnect();
})().catch(async (error) => { console.error(error); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });

const mongoose = require("mongoose");
const TrainingSessionType = require("../models/TrainingSessionType");
const BranchSchedule = require("../models/BranchSchedule");
const BranchDateSchedule = require("../models/BranchDateSchedule");

const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const slugify = (value) => normalizeName(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sendError = (res, status, message) => res.status(status).json({ success: false, message });

async function list(req, res) {
  try {
    const types = await TrainingSessionType.find({}).sort({ displayOrder: 1, name: 1 }).lean();
    if (req.path === "/public") return res.json({ success: true, types });
    const ids = types.map((type) => type._id);
    const [weekly, overrides] = await Promise.all([
      BranchSchedule.aggregate([{ $unwind: "$weeklySchedule" }, { $unwind: "$weeklySchedule.slots" }, { $match: { "weeklySchedule.slots.sessionTypeId": { $in: ids } } }, { $group: { _id: "$weeklySchedule.slots.sessionTypeId", count: { $sum: 1 } } }]),
      BranchDateSchedule.aggregate([{ $unwind: "$slots" }, { $match: { "slots.sessionTypeId": { $in: ids } } }, { $group: { _id: "$slots.sessionTypeId", count: { $sum: 1 } } }]),
    ]);
    const counts = new Map();
    for (const row of [...weekly, ...overrides]) counts.set(String(row._id), (counts.get(String(row._id)) || 0) + row.count);
    const [legacyWeekly, legacyOverrides] = await Promise.all([
      BranchSchedule.find({ "weeklySchedule.slots.sessionType": { $type: "string" } }).select("weeklySchedule.slots.sessionType weeklySchedule.slots.sessionTypeId").lean(),
      BranchDateSchedule.find({ "slots.sessionType": { $type: "string" } }).select("slots.sessionType slots.sessionTypeId").lean(),
    ]);
    const legacyCounts = new Map();
    for (const doc of legacyWeekly) for (const day of doc.weeklySchedule || []) for (const slot of day.slots || []) if (slot.sessionType && !slot.sessionTypeId) {
      const slug = slugify(slot.sessionType); legacyCounts.set(slug, (legacyCounts.get(slug) || 0) + 1);
    }
    for (const doc of legacyOverrides) for (const slot of doc.slots || []) if (slot.sessionType && !slot.sessionTypeId) {
      const slug = slugify(slot.sessionType); legacyCounts.set(slug, (legacyCounts.get(slug) || 0) + 1);
    }
    return res.json({ success: true, types: types.map((type) => ({ ...type, sessionsCount: (counts.get(String(type._id)) || 0) + (legacyCounts.get(type.slug) || 0) })) });
  } catch (error) { console.error("List training session types:", error); return sendError(res, 500, "Failed to load training session types."); }
}

async function create(req, res) {
  const name = normalizeName(req.body?.name);
  if (!name) return sendError(res, 400, "Training session type name is required.");
  const slug = slugify(req.body?.slug || name);
  if (!slug) return sendError(res, 400, "Enter a valid training session type name.");
  try {
    const type = await TrainingSessionType.create({ name, normalizedName: name.toLocaleLowerCase(), slug, description: req.body?.description || "", icon: req.body?.icon || "", isActive: req.body?.isActive !== false, displayOrder: Number(req.body?.displayOrder) || 0, createdBy: req.user?._id || null });
    return res.status(201).json({ success: true, type });
  } catch (error) { if (error?.code === 11000) return sendError(res, 409, "A training session type with this name or slug already exists."); console.error("Create training session type:", error); return sendError(res, 500, "Failed to create training session type."); }
}

async function update(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, "Invalid training session type ID.");
  const changes = {};
  if (Object.hasOwn(req.body || {}, "name")) {
    const name = normalizeName(req.body.name);
    if (!name) return sendError(res, 400, "Training session type name is required.");
    changes.name = name; changes.normalizedName = name.toLocaleLowerCase(); changes.slug = slugify(req.body.slug || name);
  } else if (Object.hasOwn(req.body || {}, "slug")) changes.slug = slugify(req.body.slug);
  for (const key of ["description", "icon", "isActive", "displayOrder"]) if (Object.hasOwn(req.body || {}, key)) changes[key] = req.body[key];
  try {
    const type = await TrainingSessionType.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true });
    if (!type) return sendError(res, 404, "Training session type not found.");
    return res.json({ success: true, type });
  } catch (error) { if (error?.code === 11000) return sendError(res, 409, "A training session type with this name or slug already exists."); console.error("Update training session type:", error); return sendError(res, 500, "Failed to update training session type."); }
}

async function remove(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, "Invalid training session type ID.");
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    const [type, weekly, overrides, legacyWeekly, legacyOverrides] = await Promise.all([
      TrainingSessionType.findById(id),
      BranchSchedule.exists({ "weeklySchedule.slots.sessionTypeId": id }),
      BranchDateSchedule.exists({ "slots.sessionTypeId": id }),
      BranchSchedule.find({ "weeklySchedule.slots.sessionType": { $type: "string" } }).select("weeklySchedule.slots.sessionType weeklySchedule.slots.sessionTypeId").lean(),
      BranchDateSchedule.find({ "slots.sessionType": { $type: "string" } }).select("slots.sessionType slots.sessionTypeId").lean(),
    ]);
    if (!type) return sendError(res, 404, "Training session type not found.");
    const legacyReferenced = [
      ...legacyWeekly.flatMap((doc) => (doc.weeklySchedule || []).flatMap((day) => (day.slots || []).filter((slot) => slot.sessionType && !slot.sessionTypeId).map((slot) => slot.sessionType))),
      ...legacyOverrides.flatMap((doc) => (doc.slots || []).filter((slot) => slot.sessionType && !slot.sessionTypeId).map((slot) => slot.sessionType)),
    ].some((name) => slugify(name) === type.slug);
    if (weekly || overrides || legacyReferenced) return sendError(res, 409, "This type is used by scheduled sessions. Deactivate it instead of deleting it.");
    await type.deleteOne(); return res.json({ success: true, message: "Training session type deleted." });
  } catch (error) { console.error("Delete training session type:", error); return sendError(res, 500, "Failed to delete training session type."); }
}

module.exports = { list, create, update, remove };

const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const AcademySettings = require("../models/AcademySettings");
const { isBranchScoped } = require("../utils/access");

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day } : null;
}

function zonedDayStart(parts, timeZone) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const values = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
    const displayed = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    const adjustment = displayed - target;
    instant -= adjustment;
    if (adjustment === 0) break;
  }
  return new Date(instant);
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function buildBranchScope(req, res, requestedBranchId) {
  if (isBranchScoped(req.user)) {
    if (!req.user.branch) {
      res.status(403).json({ success: false, message: "A branch is required to view audit records." });
      return null;
    }
    if (requestedBranchId && String(requestedBranchId) !== String(req.user.branch)) {
      res.status(403).json({ success: false, message: "You cannot view audit records for another branch." });
      return null;
    }
    return { branch: req.user.branch };
  }
  if (requestedBranchId) {
    if (!mongoose.isValidObjectId(requestedBranchId)) {
      res.status(400).json({ success: false, message: "Invalid branch ID." });
      return null;
    }
    return { branch: requestedBranchId };
  }
  return {};
}

const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 25));
    if (!Number.isSafeInteger(page) || page > 1_000_000) return res.status(400).json({ success: false, message: "Invalid page." });
    const sortOption = req.query.sort || "createdAt-desc";
    if (!["createdAt-desc", "createdAt-asc"].includes(sortOption)) return res.status(400).json({ success: false, message: "Invalid sort order." });
    const sort = sortOption === "createdAt-asc" ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 };
    const query = await buildBranchScope(req, res, req.query.branchId);
    if (!query) return;

    if (req.query.actor) {
      const actor = String(req.query.actor).trim().slice(0, 100);
      if (mongoose.isValidObjectId(actor)) query.actor = actor;
      else query.actorName = { $regex: escapeRegex(actor), $options: "i" };
    }
    if (req.query.action) query.action = String(req.query.action).slice(0, 80);
    if (req.query.entityType) query.entityType = String(req.query.entityType).trim().toUpperCase().slice(0, 80);
    if (req.query.entityId) {
      if (!mongoose.isValidObjectId(req.query.entityId)) return res.status(400).json({ success: false, message: "Invalid entity ID." });
      query.entityId = req.query.entityId;
    }
    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);
      if (search) {
        const terms = [{ actorName: { $regex: escapeRegex(search), $options: "i" } }];
        if (mongoose.isValidObjectId(search)) terms.push({ entityId: search });
        query.$or = terms;
      }
    }

    const settings = await AcademySettings.findOne().select("timezone").lean();
    const timeZone = settings?.timezone || "Asia/Kolkata";
    try { new Intl.DateTimeFormat("en", { timeZone }); } catch { return res.status(500).json({ success: false, message: "Academy timezone configuration is invalid." }); }
    if (req.query.from || req.query.to) {
      const from = req.query.from ? parseDate(req.query.from) : null;
      const to = req.query.to ? parseDate(req.query.to) : null;
      if ((req.query.from && !from) || (req.query.to && !to)) return res.status(400).json({ success: false, message: "Dates must use YYYY-MM-DD." });
      query.createdAt = {};
      if (from) query.createdAt.$gte = zonedDayStart(from, timeZone);
      if (to) {
        const tomorrow = new Date(Date.UTC(to.year, to.month - 1, to.day + 1));
        query.createdAt.$lt = zonedDayStart({ year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate() }, timeZone);
      }
    }

    const [records, totalItems] = await Promise.all([
      AuditLog.find(query).select("-__v").populate("actor", "name").populate("branch", "name").sort(sort).skip((page - 1) * pageSize).limit(pageSize).lean(),
      AuditLog.countDocuments(query),
    ]);
    return res.json({ success: true, records, page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)), timeZone });
  } catch (error) {
    console.error("Audit log query failed", { name: error.name });
    return res.status(500).json({ success: false, message: "Unable to load audit records." });
  }
};

const getAuditLogById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid audit record ID." });
    const scope = await buildBranchScope(req, res, req.query.branchId);
    if (!scope) return;
    const query = { _id: req.params.id, ...scope };
    const record = await AuditLog.findOne(query).select("-__v").populate("actor", "name").populate("branch", "name").lean();
    if (!record) return res.status(404).json({ success: false, message: "Audit record not found." });
    return res.json({ success: true, record });
  } catch (error) {
    console.error("Audit log detail failed", { name: error.name });
    return res.status(500).json({ success: false, message: "Unable to load audit record." });
  }
};

module.exports = { getAuditLogs, getAuditLogById };

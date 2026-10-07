const mongoose = require("mongoose");
const AuditLog = require("../models/FinanceAudit");
const { AUDIT_ACTION_VALUES } = require("../config/auditActions");

const SENSITIVE_KEY = /(password|passwordhash|token|secret|otp|api.?key|authorization|cookie|card.?number|cvv|credential|private.?key)/i;
const MAX_SNAPSHOT_BYTES = 20_000;

function sanitizeValue(value, depth = 0) {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 2000);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (depth >= 6) return "[MAX_DEPTH]";
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return undefined;
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeValue(item, depth + 1);
  }
  return output;
}

function snapshot(value) {
  if (value === undefined) return null;
  const safe = sanitizeValue(value);
  if (Buffer.byteLength(JSON.stringify(safe), "utf8") > MAX_SNAPSHOT_BYTES) {
    throw new Error("Audit snapshot exceeds the allowed size.");
  }
  return safe;
}

function requestContext(req) {
  if (!req) return {};
  const correlation = req.headers?.["x-request-id"];
  return {
    ipAddress: typeof req.ip === "string" ? req.ip.slice(0, 80) : "",
    userAgent: typeof req.get === "function" ? String(req.get("user-agent") || "").slice(0, 300) : "",
    requestId: typeof correlation === "string" && /^[a-zA-Z0-9._:-]{1,100}$/.test(correlation) ? correlation : "",
  };
}

async function record({
  req,
  action,
  entityType = "SYSTEM",
  entityId = null,
  branchId = null,
  before,
  after,
  metadata,
  session,
  legacy = {},
  actorId,
  actorName,
}) {
  if (!AUDIT_ACTION_VALUES.includes(action)) throw new TypeError("Unknown audit action.");
  // Business events always derive their actor from the authenticated request.
  // actorId is reserved for trusted authentication flows before req.user exists.
  const actor = req?.user?._id || actorId || null;
  const context = requestContext(req);
  const values = {
    action,
    actor,
    actorName: req?.user?.name || actorName || "",
    entityType: String(entityType || "SYSTEM").toUpperCase().slice(0, 80),
    entityId: entityId && mongoose.isValidObjectId(entityId) ? entityId : null,
    branch: branchId && mongoose.isValidObjectId(branchId) ? branchId : null,
    before: snapshot(before),
    after: snapshot(after),
    metadata: snapshot(metadata || {}),
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
    ...legacy,
  };
  const options = session ? { session } : {};
  const [created] = await AuditLog.create([values], options);
  return created;
}

async function recordAuthentication({ action, user, req, metadata, session }) {
  return record({
    action,
    req,
    actorId: user?._id || null,
    actorName: user?.name || "",
    entityType: "AUTHENTICATION",
    entityId: user?._id || null,
    branchId: user?.branch || null,
    metadata,
    session,
  });
}

module.exports = { record, recordAuthentication, sanitizeValue, snapshot };

const mongoose = require("mongoose");
const MaintenanceSettings = require("../models/MaintenanceSettings");

const getSettings = async () => {
  let settings = await MaintenanceSettings.findOne();
  if (!settings) settings = await MaintenanceSettings.create({});
  return settings;
};

const getHealth = async (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  return res.json({
    success: true,
    health: {
      api: { status: "HEALTHY", detail: "Authenticated API request completed." },
      database: {
        status: databaseConnected ? "CONNECTED" : "ERROR",
        detail: databaseConnected ? "MongoDB connection is active." : "MongoDB connection is unavailable.",
        name: databaseConnected ? mongoose.connection.name || null : null,
      },
      authentication: { status: "HEALTHY", detail: "Authentication middleware protected this request." },
      storage: { status: "NOT_CONFIGURED", detail: "Storage metrics are not configured." },
      jobs: { status: "NOT_CONFIGURED", detail: "No background job monitor is configured." },
      checkedAt: new Date().toISOString(),
    },
  });
};

const getMaintenanceSettings = async (_req, res) => {
  const settings = await getSettings();
  return res.json({ success: true, settings });
};

const updateMaintenanceSettings = async (req, res) => {
  const { enabled, message, endsAt = null } = req.body || {};
  if (typeof enabled !== "boolean") return res.status(400).json({ success: false, message: "enabled must be a boolean." });
  if (typeof message !== "string" || !message.trim() || message.trim().length > 500) {
    return res.status(400).json({ success: false, message: "A maintenance message of up to 500 characters is required." });
  }

  const settings = await getSettings();
  settings.enabled = enabled;
  settings.startedAt = enabled ? (settings.startedAt || new Date()) : null;
  settings.endsAt = endsAt ? new Date(endsAt) : null;
  settings.message = message.trim();
  settings.updatedBy = req.user._id;
  await settings.save();
  return res.json({ success: true, settings });
};

module.exports = { getHealth, getMaintenanceSettings, updateMaintenanceSettings };

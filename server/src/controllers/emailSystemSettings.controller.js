const EmailSystemSettings = require("../models/EmailSystemSettings");
const { encryptEmailPassword } = require("../services/emailCredentials.service");
const { sendEmailSystemTest } = require("../services/inquiryEmail.service");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SETTINGS_KEY = "primary";

const toPublicSettings = (settings) => settings ? ({
  smtpHost: settings.smtpHost,
  smtpPort: settings.smtpPort,
  smtpSecure: settings.smtpSecure,
  smtpUsername: settings.smtpUsername,
  fromName: settings.fromName,
  fromEmail: settings.fromEmail,
  notificationEmail: settings.notificationEmail,
  passwordConfigured: Boolean(settings.smtpPasswordEncrypted),
  updatedAt: settings.updatedAt,
}) : null;

const getEmailSystemSettings = async (_req, res) => {
  try {
    const settings = await EmailSystemSettings.findOne({ settingsKey: SETTINGS_KEY })
      .select("+smtpPasswordEncrypted")
      .lean();
    return res.json({ success: true, settings: toPublicSettings(settings) });
  } catch (error) {
    console.error("Get email system settings failed.");
    return res.status(500).json({ success: false, message: "Unable to load email system settings." });
  }
};

const updateEmailSystemSettings = async (req, res) => {
  try {
    const smtpHost = typeof req.body.smtpHost === "string" ? req.body.smtpHost.trim() : "";
    const smtpPort = Number(req.body.smtpPort);
    const smtpUsername = typeof req.body.smtpUsername === "string" ? req.body.smtpUsername.trim() : "";
    const smtpPassword = typeof req.body.smtpPassword === "string" ? req.body.smtpPassword.trim() : "";
    const fromName = typeof req.body.fromName === "string" ? req.body.fromName.trim() : "";
    const fromEmail = typeof req.body.fromEmail === "string" ? req.body.fromEmail.trim().toLowerCase() : "";
    const notificationEmail = typeof req.body.notificationEmail === "string" ? req.body.notificationEmail.trim().toLowerCase() : "";

    if (!smtpHost || smtpHost.length > 255 || /\s/.test(smtpHost)) {
      return res.status(400).json({ success: false, message: "Enter a valid SMTP host." });
    }
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      return res.status(400).json({ success: false, message: "SMTP port must be between 1 and 65535." });
    }
    if (!smtpUsername || smtpUsername.length > 320) {
      return res.status(400).json({ success: false, message: "Enter a valid SMTP username." });
    }
    if (smtpPassword.length > 500) {
      return res.status(400).json({ success: false, message: "SMTP password is too long." });
    }
    if (fromName.length > 120) {
      return res.status(400).json({ success: false, message: "Sender name must be 120 characters or fewer." });
    }
    if (!EMAIL_PATTERN.test(fromEmail) || fromEmail.length > 320) {
      return res.status(400).json({ success: false, message: "Enter a valid sender email address." });
    }
    if (!EMAIL_PATTERN.test(notificationEmail) || notificationEmail.length > 320) {
      return res.status(400).json({ success: false, message: "Enter a valid inquiry notification email address." });
    }
    if (typeof req.body.smtpSecure !== "boolean") {
      return res.status(400).json({ success: false, message: "Choose whether SMTP uses a secure connection." });
    }

    const existing = await EmailSystemSettings.findOne({ settingsKey: SETTINGS_KEY }).select("+smtpPasswordEncrypted");
    if (!smtpPassword && !existing?.smtpPasswordEncrypted) {
      return res.status(400).json({ success: false, message: "Enter the SMTP password to configure email sending." });
    }

    const values = {
      smtpHost,
      smtpPort,
      smtpSecure: req.body.smtpSecure,
      smtpUsername,
      fromName,
      fromEmail,
      notificationEmail,
      updatedBy: req.user?._id || null,
    };
    if (smtpPassword) values.smtpPasswordEncrypted = encryptEmailPassword(smtpPassword);

    const settings = await EmailSystemSettings.findOneAndUpdate(
      { settingsKey: SETTINGS_KEY },
      { $set: values, $setOnInsert: { settingsKey: SETTINGS_KEY } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select("-smtpPasswordEncrypted").lean();

    return res.json({
      success: true,
      message: "Email system settings saved.",
      settings: toPublicSettings({ ...settings, smtpPasswordEncrypted: true }),
    });
  } catch (error) {
    console.error("Update email system settings failed.");
    return res.status(500).json({ success: false, message: "Unable to save email system settings." });
  }
};

const sendTestEmail = async (_req, res) => {
  try {
    await sendEmailSystemTest();
    return res.json({ success: true, message: "Test email sent to the configured notification address." });
  } catch (error) {
    console.error("Send test email failed.");
    return res.status(400).json({ success: false, message: "Unable to send test email. Check the saved SMTP settings and server logs." });
  }
};

module.exports = { getEmailSystemSettings, updateEmailSystemSettings, sendTestEmail };

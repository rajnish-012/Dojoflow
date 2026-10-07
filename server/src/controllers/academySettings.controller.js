const AcademySettings = require("../models/AcademySettings");
const { normalizePhone } = require("../utils/phone");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function cleanString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

/*
|--------------------------------------------------------------------------
| GET /api/settings/academy
|--------------------------------------------------------------------------
| Protected
| SUPER_ADMIN only
|
| Returns the latest saved academy settings.
| Does NOT create a default document.
|--------------------------------------------------------------------------
*/

async function getAcademySettings(req, res) {
  try {
    const settings = await AcademySettings.findOne({})
      .sort({
        updatedAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      settings: settings || null,
    });
  } catch (error) {
    console.error("Get academy settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load academy settings.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/settings/academy/public
|--------------------------------------------------------------------------
| Public
|
| Used by:
| - Landing page
| - Public inquiry page
| - Public academy-facing pages
|
| Only returns branding/contact fields that are safe to expose publicly.
|--------------------------------------------------------------------------
*/

const getPublicAcademySettings = async (req, res) => {
  try {
    const settings = await AcademySettings.findOne({})
      .sort({
        updatedAt: -1,
      })
      .select(
        [
          "academyName",
          "tagline",
          "logoUrl",
          "faviconUrl",
          "primaryColor",
          "secondaryColor",
          "contactEmail",
          "contactPhone",
          "website",
          "address",
          "timezone",
          "currency",
          "updatedAt",
        ].join(" "),
      )
      .lean();

    return res.status(200).json({
      success: true,
      settings: settings || null,
    });
  } catch (error) {
    console.error("Get public academy settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load academy branding.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| PUT /api/settings/academy
|--------------------------------------------------------------------------
| Protected
| SUPER_ADMIN only
|--------------------------------------------------------------------------
*/

async function updateAcademySettings(req, res) {
  try {
    const existing = await AcademySettings.findOne({}).sort({ updatedAt: -1 }).lean();
    const body = req.body || {};

    const academyName = cleanString(body.academyName);

    if (!academyName) {
      return res.status(400).json({
        success: false,
        message: "Academy name is required.",
      });
    }

    const contactPhone = cleanString(body.contactPhone);
    const normalizedContactPhone = contactPhone ? normalizePhone(contactPhone) : "";
    if (contactPhone && !normalizedContactPhone) {
      return res.status(400).json({ success: false, message: "Enter a valid contact phone number with its country code." });
    }

    const updates = {
      academyName,

      tagline: cleanString(body.tagline),

      logoUrl: cleanString(body.logoUrl),

      faviconUrl: cleanString(body.faviconUrl),

      primaryColor: cleanString(body.primaryColor),

      secondaryColor: cleanString(body.secondaryColor),

      contactEmail: cleanString(body.contactEmail).toLowerCase(),

      contactPhone: normalizedContactPhone,

      website: cleanString(body.website),

      address: cleanString(body.address),

      timezone: cleanString(body.timezone),

      currency: cleanString(body.currency),

      updatedBy: req.user?._id || null,
    };

    const settings = await AcademySettings.findOneAndUpdate(
      {},
      {
        $set: updates,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    const fields = ["academyName", "tagline", "logoUrl", "faviconUrl", "primaryColor", "secondaryColor", "timezone", "currency"];
    const before = Object.fromEntries(fields.map((field) => [field, existing?.[field] ?? null]));
    const after = Object.fromEntries(fields.map((field) => [field, updates[field]]));
    if (JSON.stringify(before) !== JSON.stringify(after)) await auditService.record({ req, action: AUDIT_ACTIONS.SETTINGS_UPDATED, entityType: "SETTINGS", entityId: settings._id, before, after });

    return res.status(200).json({
      success: true,
      message: "Academy settings updated successfully.",
      settings,
    });
  } catch (error) {
    console.error("Update academy settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update academy settings.",
    });
  }
}

module.exports = {
  getAcademySettings,
  getPublicAcademySettings,
  updateAcademySettings,
};

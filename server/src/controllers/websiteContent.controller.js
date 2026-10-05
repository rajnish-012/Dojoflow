const mongoose = require("mongoose");

const WebsiteHero = require("../models/WebsiteHero");
const WebsiteSection = require("../models/WebsiteSection");
const WebsiteStatistic = require("../models/WebsiteStatistic");
const WebsiteFeature = require("../models/WebsiteFeature");

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const parseBoolean = (value, fallback = undefined) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }

    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  return fallback;
};

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

/* =========================================================
   HERO
========================================================= */

const getAdminHeroes = async (req, res) => {
  try {
    const heroes = await WebsiteHero.find({})
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({
        sortOrder: 1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      data: heroes,
    });
  } catch (error) {
    console.error("Get ForceStrike admin heroes error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load website hero slides.",
    });
  }
};

const createHero = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      description,
      badge,
      image,
      mobileImage,
      primaryButtonText,
      primaryButtonUrl,
      secondaryButtonText,
      secondaryButtonUrl,
      sortOrder,
      isActive,
      startDate,
      endDate,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: "Hero title is required.",
      });
    }

    const hero = await WebsiteHero.create({
      title: String(title).trim(),
      subtitle: typeof subtitle === "string" ? subtitle.trim() : "",
      description: typeof description === "string" ? description.trim() : "",
      badge: typeof badge === "string" ? badge.trim() : "",
      image: typeof image === "string" ? image.trim() : "",
      mobileImage: typeof mobileImage === "string" ? mobileImage.trim() : "",
      primaryButtonText:
        typeof primaryButtonText === "string" ? primaryButtonText.trim() : "",
      primaryButtonUrl:
        typeof primaryButtonUrl === "string" ? primaryButtonUrl.trim() : "",
      secondaryButtonText:
        typeof secondaryButtonText === "string"
          ? secondaryButtonText.trim()
          : "",
      secondaryButtonUrl:
        typeof secondaryButtonUrl === "string" ? secondaryButtonUrl.trim() : "",
      sortOrder: parseNumber(sortOrder),
      isActive: parseBoolean(isActive, true),
      startDate: startDate || null,
      endDate: endDate || null,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Hero slide created successfully.",
      data: hero,
    });
  } catch (error) {
    console.error("Create ForceStrike hero error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create hero slide.",
    });
  }
};

const updateHero = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hero slide ID.",
      });
    }

    const existing = await WebsiteHero.findById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Hero slide not found.",
      });
    }

    const allowedFields = [
      "title",
      "subtitle",
      "description",
      "badge",
      "image",
      "mobileImage",
      "primaryButtonText",
      "primaryButtonUrl",
      "secondaryButtonText",
      "secondaryButtonUrl",
      "startDate",
      "endDate",
    ];

    const update = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        update[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "sortOrder")) {
      update.sortOrder = parseNumber(req.body.sortOrder);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      update.isActive = parseBoolean(req.body.isActive, existing.isActive);
    }

    update.updatedBy = req.user?._id || null;

    const hero = await WebsiteHero.findByIdAndUpdate(
      id,
      {
        $set: update,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Hero slide updated successfully.",
      data: hero,
    });
  } catch (error) {
    console.error("Update ForceStrike hero error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update hero slide.",
    });
  }
};

const deleteHero = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hero slide ID.",
      });
    }

    const hero = await WebsiteHero.findByIdAndDelete(id);

    if (!hero) {
      return res.status(404).json({
        success: false,
        message: "Hero slide not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Hero slide deleted successfully.",
    });
  } catch (error) {
    console.error("Delete ForceStrike hero error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete hero slide.",
    });
  }
};

/* =========================================================
   SECTIONS
========================================================= */

const getAdminSections = async (req, res) => {
  try {
    const sections = await WebsiteSection.find({})
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({
        sortOrder: 1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      data: sections,
    });
  } catch (error) {
    console.error("Get ForceStrike sections error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load website sections.",
    });
  }
};

const upsertSection = async (req, res) => {
  try {
    const {
      key,
      title,
      subtitle,
      description,
      content,
      image,
      secondaryImage,
      ctaText,
      ctaUrl,
      highlights,
      sortOrder,
      isPublished,
    } = req.body;

    if (!key || !String(key).trim()) {
      return res.status(400).json({
        success: false,
        message: "Section key is required.",
      });
    }

    const normalizedKey = String(key).trim().toLowerCase();

    const update = {
      key: normalizedKey,
      title: typeof title === "string" ? title.trim() : "",
      subtitle: typeof subtitle === "string" ? subtitle.trim() : "",
      description: typeof description === "string" ? description.trim() : "",
      content: typeof content === "string" ? content.trim() : "",
      image: typeof image === "string" ? image.trim() : "",
      secondaryImage:
        typeof secondaryImage === "string" ? secondaryImage.trim() : "",
      ctaText: typeof ctaText === "string" ? ctaText.trim() : "",
      ctaUrl: typeof ctaUrl === "string" ? ctaUrl.trim() : "",
      highlights: Array.isArray(highlights) ? highlights : [],
      sortOrder: parseNumber(sortOrder),
      isPublished: parseBoolean(isPublished, true),
      updatedBy: req.user?._id || null,
    };

    const section = await WebsiteSection.findOneAndUpdate(
      {
        key: normalizedKey,
      },
      {
        $set: update,
        $setOnInsert: {
          createdBy: req.user?._id || null,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Website section saved successfully.",
      data: section,
    });
  } catch (error) {
    console.error("Save ForceStrike section error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save website section.",
    });
  }
};

/* =========================================================
   STATISTICS
========================================================= */

const getAdminStatistics = async (req, res) => {
  try {
    const statistics = await WebsiteStatistic.find({})
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({
        sortOrder: 1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Get ForceStrike statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load website statistics.",
    });
  }
};

const createStatistic = async (req, res) => {
  try {
    const { label, value, suffix, description, icon, sortOrder, isActive } =
      req.body;

    if (!label || !String(label).trim()) {
      return res.status(400).json({
        success: false,
        message: "Statistic label is required.",
      });
    }

    if (value === undefined || value === null || !String(value).trim()) {
      return res.status(400).json({
        success: false,
        message: "Statistic value is required.",
      });
    }

    const statistic = await WebsiteStatistic.create({
      label: String(label).trim(),
      value: String(value).trim(),
      suffix: typeof suffix === "string" ? suffix.trim() : "",
      description: typeof description === "string" ? description.trim() : "",
      icon: typeof icon === "string" ? icon.trim() : "",
      sortOrder: parseNumber(sortOrder),
      isActive: parseBoolean(isActive, true),
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Website statistic created successfully.",
      data: statistic,
    });
  } catch (error) {
    console.error("Create ForceStrike statistic error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create website statistic.",
    });
  }
};

const updateStatistic = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid statistic ID.",
      });
    }

    const statistic = await WebsiteStatistic.findById(id);

    if (!statistic) {
      return res.status(404).json({
        success: false,
        message: "Statistic not found.",
      });
    }

    const update = {};

    const stringFields = ["label", "value", "suffix", "description", "icon"];

    for (const field of stringFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        update[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "sortOrder")) {
      update.sortOrder = parseNumber(req.body.sortOrder);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      update.isActive = parseBoolean(req.body.isActive, statistic.isActive);
    }

    update.updatedBy = req.user?._id || null;

    const updated = await WebsiteStatistic.findByIdAndUpdate(
      id,
      {
        $set: update,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Website statistic updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("Update ForceStrike statistic error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update website statistic.",
    });
  }
};

const deleteStatistic = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid statistic ID.",
      });
    }

    const deleted = await WebsiteStatistic.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Statistic not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Website statistic deleted successfully.",
    });
  } catch (error) {
    console.error("Delete ForceStrike statistic error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete website statistic.",
    });
  }
};

/* =========================================================
   FEATURES
========================================================= */

const getAdminFeatures = async (req, res) => {
  try {
    const features = await WebsiteFeature.find({})
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({
        sortOrder: 1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      data: features,
    });
  } catch (error) {
    console.error("Get ForceStrike features error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load website features.",
    });
  }
};

const createFeature = async (req, res) => {
  try {
    const {
      title,
      description,
      icon,
      image,
      linkText,
      linkUrl,
      sortOrder,
      isActive,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: "Feature title is required.",
      });
    }

    const feature = await WebsiteFeature.create({
      title: String(title).trim(),
      description: typeof description === "string" ? description.trim() : "",
      icon: typeof icon === "string" ? icon.trim() : "",
      image: typeof image === "string" ? image.trim() : "",
      linkText: typeof linkText === "string" ? linkText.trim() : "",
      linkUrl: typeof linkUrl === "string" ? linkUrl.trim() : "",
      sortOrder: parseNumber(sortOrder),
      isActive: parseBoolean(isActive, true),
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Website feature created successfully.",
      data: feature,
    });
  } catch (error) {
    console.error("Create ForceStrike feature error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create website feature.",
    });
  }
};

const updateFeature = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid feature ID.",
      });
    }

    const feature = await WebsiteFeature.findById(id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: "Feature not found.",
      });
    }

    const update = {};

    const stringFields = [
      "title",
      "description",
      "icon",
      "image",
      "linkText",
      "linkUrl",
    ];

    for (const field of stringFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        update[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "sortOrder")) {
      update.sortOrder = parseNumber(req.body.sortOrder);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      update.isActive = parseBoolean(req.body.isActive, feature.isActive);
    }

    update.updatedBy = req.user?._id || null;

    const updated = await WebsiteFeature.findByIdAndUpdate(
      id,
      {
        $set: update,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Website feature updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("Update ForceStrike feature error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update website feature.",
    });
  }
};

const deleteFeature = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid feature ID.",
      });
    }

    const deleted = await WebsiteFeature.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Feature not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Website feature deleted successfully.",
    });
  } catch (error) {
    console.error("Delete ForceStrike feature error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete website feature.",
    });
  }
};

/* =========================================================
   PUBLIC WEBSITE DATA
========================================================= */

const getPublicWebsiteHome = async (req, res) => {
  try {
    const [heroes, sections, statistics, features] = await Promise.all([
      WebsiteHero.find({
        isActive: true,
      }).select("title subtitle description badge image mobileImage primaryButtonText primaryButtonUrl secondaryButtonText secondaryButtonUrl sortOrder isActive startDate endDate").sort({
        sortOrder: 1,
        createdAt: -1,
      }),

      WebsiteSection.find({
        isPublished: true,
      }).select("key title subtitle description content image secondaryImage ctaText ctaUrl highlights sortOrder isPublished").sort({
        sortOrder: 1,
        createdAt: -1,
      }),

      WebsiteStatistic.find({
        isActive: true,
      }).select("label value suffix description icon sortOrder isActive").sort({
        sortOrder: 1,
        createdAt: -1,
      }),

      WebsiteFeature.find({
        isActive: true,
      }).select("title description icon image linkText linkUrl sortOrder isActive").sort({
        sortOrder: 1,
        createdAt: -1,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        heroes,
        sections,
        statistics,
        features,
      },
    });
  } catch (error) {
    console.error("Get public ForceStrike website error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load public website content.",
    });
  }
};

module.exports = {
  getAdminHeroes,
  createHero,
  updateHero,
  deleteHero,
  getAdminSections,
  upsertSection,
  getAdminStatistics,
  createStatistic,
  updateStatistic,
  deleteStatistic,
  getAdminFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  getPublicWebsiteHome,
};

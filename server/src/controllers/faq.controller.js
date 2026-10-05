const mongoose = require("mongoose");

const FAQ = require("../models/FAQ");

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
   ADMIN
========================================================= */

const getFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({})
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({
        sortOrder: 1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      data: faqs,
    });
  } catch (error) {
    console.error("Get ForceStrike FAQs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load FAQs.",
    });
  }
};

const createFAQ = async (req, res) => {
  try {
    const { question, answer, category, sortOrder, isPublished } = req.body;

    if (!question || !String(question).trim()) {
      return res.status(400).json({
        success: false,
        message: "FAQ question is required.",
      });
    }

    if (!answer || !String(answer).trim()) {
      return res.status(400).json({
        success: false,
        message: "FAQ answer is required.",
      });
    }

    const faq = await FAQ.create({
      question: String(question).trim(),
      answer: String(answer).trim(),
      category:
        typeof category === "string" && category.trim()
          ? category.trim()
          : "General",
      sortOrder: parseNumber(sortOrder),
      isPublished: parseBoolean(isPublished, true),
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: "FAQ created successfully.",
      data: faq,
    });
  } catch (error) {
    console.error("Create ForceStrike FAQ error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create FAQ.",
    });
  }
};

const updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid FAQ ID.",
      });
    }

    const faq = await FAQ.findById(id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found.",
      });
    }

    const update = {};

    const stringFields = ["question", "answer", "category"];

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

    if (Object.prototype.hasOwnProperty.call(req.body, "isPublished")) {
      update.isPublished = parseBoolean(req.body.isPublished, faq.isPublished);
    }

    update.updatedBy = req.user?._id || null;

    const updated = await FAQ.findByIdAndUpdate(
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
      message: "FAQ updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("Update ForceStrike FAQ error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update FAQ.",
    });
  }
};

const deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid FAQ ID.",
      });
    }

    const deleted = await FAQ.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "FAQ deleted successfully.",
    });
  } catch (error) {
    console.error("Delete ForceStrike FAQ error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete FAQ.",
    });
  }
};

/* =========================================================
   PUBLIC
========================================================= */

const getPublicFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({
      isPublished: true,
    }).select("question answer category sortOrder isPublished").sort({
      sortOrder: 1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: faqs,
    });
  } catch (error) {
    console.error("Get public ForceStrike FAQs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load FAQs.",
    });
  }
};

module.exports = {
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getPublicFAQs,
};

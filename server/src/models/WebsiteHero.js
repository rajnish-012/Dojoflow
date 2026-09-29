const mongoose = require("mongoose");

const websiteHeroSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    subtitle: {
      type: String,
      trim: true,
      maxlength: 220,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    badge: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    image: {
      type: String,
      trim: true,
      default: "",
    },

    mobileImage: {
      type: String,
      trim: true,
      default: "",
    },

    primaryButtonText: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },

    primaryButtonUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    secondaryButtonText: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },

    secondaryButtonUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

websiteHeroSchema.index({
  isActive: 1,
  sortOrder: 1,
});

module.exports = mongoose.model(
  "WebsiteHero",
  websiteHeroSchema,
);
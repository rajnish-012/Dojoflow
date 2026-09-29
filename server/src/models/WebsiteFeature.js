const mongoose = require("mongoose");

const websiteFeatureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    icon: {
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

    linkText: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    linkUrl: {
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

websiteFeatureSchema.index({
  isActive: 1,
  sortOrder: 1,
});

module.exports = mongoose.model(
  "WebsiteFeature",
  websiteFeatureSchema,
);
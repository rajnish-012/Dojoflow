const mongoose = require("mongoose");

const websiteStatisticSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    suffix: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },

    icon: {
      type: String,
      trim: true,
      maxlength: 100,
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

websiteStatisticSchema.index({
  isActive: 1,
  sortOrder: 1,
});

module.exports = mongoose.model(
  "WebsiteStatistic",
  websiteStatisticSchema,
);
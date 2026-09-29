const mongoose = require("mongoose");

const websiteSectionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 100,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    subtitle: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    content: {
      type: String,
      trim: true,
      default: "",
    },

    image: {
      type: String,
      trim: true,
      default: "",
    },

    secondaryImage: {
      type: String,
      trim: true,
      default: "",
    },

    ctaText: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    ctaUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    highlights: {
      type: [
        {
          title: {
            type: String,
            trim: true,
            maxlength: 150,
          },

          description: {
            type: String,
            trim: true,
            maxlength: 500,
          },

          icon: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "",
          },
        },
      ],
      default: [],
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    isPublished: {
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

websiteSectionSchema.index({
  isPublished: 1,
  sortOrder: 1,
});

module.exports = mongoose.model(
  "WebsiteSection",
  websiteSectionSchema,
);
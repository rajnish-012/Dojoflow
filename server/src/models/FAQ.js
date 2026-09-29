const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "General",
    },

    sortOrder: {
      type: Number,
      default: 0,
      index: true,
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

faqSchema.index({
  isPublished: 1,
  sortOrder: 1,
});

module.exports = mongoose.model("FAQ", faqSchema);

const mongoose = require("mongoose");

const trainingSessionTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    normalizedName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    icon: { type: String, default: "", trim: true, maxlength: 80 },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

trainingSessionTypeSchema.index({ normalizedName: 1 }, { unique: true });
trainingSessionTypeSchema.index({ slug: 1 }, { unique: true });
trainingSessionTypeSchema.index({ isActive: 1, displayOrder: 1, name: 1 });

module.exports = mongoose.model(
  "TrainingSessionType",
  trainingSessionTypeSchema,
);

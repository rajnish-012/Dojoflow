const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    /*
     * null = global holiday
     *
     * branch ID = holiday only for that branch
     */
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Useful indexes
 */
holidaySchema.index({
  date: 1,
  branch: 1,
});

holidaySchema.index({
  date: 1,
  isActive: 1,
});

holidaySchema.index({
  branch: 1,
  date: 1,
  isActive: 1,
});

module.exports = mongoose.model(
  "Holiday",
  holidaySchema
);
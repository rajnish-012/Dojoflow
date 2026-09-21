const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    // Stored on every user, e.g. "FRONT_DESK". Never changes.
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 40,
      match: /^[A-Z][A-Z0-9_]*$/,
    },

    // Display name, e.g. "Front Desk"
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    // BRANCH = only the data of the user's own branch
    // ALL    = data of every branch
    dataScope: {
      type: String,
      enum: ["ALL", "BRANCH"],
      default: "BRANCH",
    },

    // The four built-in roles. They cannot be deleted.
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Role", roleSchema);
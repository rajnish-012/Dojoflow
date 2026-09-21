const mongoose = require("mongoose");

const moduleSchema = new mongoose.Schema(
  {
    // Stable identifier used in code, e.g. "students"
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },

    // Text shown in the sidebar
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },

    // Frontend route this module opens, e.g. "/students"
    href: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Name of a lucide-react icon (see client/lib/navigation-icons.ts)
    icon: {
      type: String,
      default: "LayoutDashboard",
      trim: true,
    },

    // Lower number = higher in the sidebar
    order: {
      type: Number,
      default: 0,
    },

    // Role keys that can see this module, e.g. ["SUPER_ADMIN", "COACH"]
    allowedRoles: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // System modules cannot be deleted or deactivated
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Module", moduleSchema);
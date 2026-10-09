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

    // Name of a lucide-react icon
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

    // Shared ordering for every module in the same sidebar section.
    // Child links keep using `order`; this only orders whole sections.
    sectionOrder: {
      type: Number,
      default: null,
    },

    /*
     * =========================================================
     * DATABASE-BACKED PERMISSION
     * =========================================================
     *
     * This is now the primary authorization mapping for a
     * module.
     *
     * Example:
     *
     * students -> student.view
     * attendance -> attendance.view
     * settings -> settings.view
     *
     * The user's effective permissions come from:
     *
     * User -> Role -> Role.permissions
     */
    requiredPermission: {
      type: String,
      trim: true,
      default: null,
    },

    // Optional sidebar section label. Null keeps legacy key-based grouping.
    group: {
      type: String,
      trim: true,
      default: null,
    },

    /*
     * =========================================================
     * LEGACY ROLE VISIBILITY
     * =========================================================
     *
     * Retained for backward compatibility with existing
     * database records and the Modules management UI.
     *
     * This is NOT the primary authorization source anymore.
     *
     * Backend navigation authorization uses
     * requiredPermission + req.user.permissions.
     */
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
  },
);

module.exports = mongoose.model("Module", moduleSchema);

const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    /*
     * Stable role identity.
     *
     * User documents continue storing this value in User.role.
     * We are intentionally NOT introducing a second roleId system.
     */
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 40,
      match: /^[A-Z][A-Z0-9_]*$/,
    },

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

    /*
     * ALL    = role may access data across branches
     * BRANCH = role is restricted to its assigned branch
     */
    dataScope: {
      type: String,
      enum: ["ALL", "BRANCH"],
      default: "BRANCH",
    },

    /*
     * Database-backed authorization.
     *
     * The Role document is the source of truth for permissions.
     */
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: (permissions) =>
          Array.isArray(permissions) &&
          permissions.every(
            (permission) =>
              typeof permission === "string" && permission.trim().length > 0,
          ),
        message: "Role permissions must contain non-empty strings",
      },
    },

    // Tracks one-time migrations when permissions are split into finer scopes.
    permissionsVersion: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
     * Built-in/system roles cannot be deleted.
     *
     * Custom roles have isSystem=false.
     */
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

/*
 * Normalize and deduplicate permissions before saving.
 */
roleSchema.pre("save", function normalizePermissions() {
  if (Array.isArray(this.permissions)) {
    this.permissions = Array.from(
      new Set(
        this.permissions
          .filter(
            (permission) =>
              typeof permission === "string" && permission.trim().length > 0,
          )
          .map((permission) => permission.trim()),
      ),
    );
  }

});

module.exports = mongoose.model("Role", roleSchema);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { validatePassword } = require("../utils/passwordPolicy");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    phone: {
      type: String,
      trim: true,
      minlength: 7,
      maxlength: 20,
      default: "",
    },

    password: {
      type: String,
      required: true,
      minlength: 12,
      select: false,
    },

    /*
     * Stable database role key.
     *
     * This intentionally remains a string rather than becoming a competing
     * role ObjectId system. The Role collection owns the role definition and
     * permissions, while this field preserves existing user documents and
     * historical references.
     */

    role: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 40,
      match: /^[A-Z][A-Z0-9_]*$/,
      default: "STUDENT",
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    /*
     * Soft-disable an account without deleting it.
     *
     * When false, the protect middleware rejects any
     * JWT issued for this user — even if the token
     * has not yet expired.
     *
     * Use this when:
     * - A staff member leaves the academy
     * - A student account needs to be suspended
     * - A password has been compromised
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    mustResetPassword: {
      type: Boolean,
      default: false,
    },

    /*
     * Tracks the last successful login time.
     * Useful for audit purposes and identifying inactive accounts.
     */
    lastLogin: {
      type: Date,
      default: null,
    },

    /*
     * When this field is set, JWTs issued before this
     * timestamp are considered invalid.
     *
     * Increment by calling user.save() after a password change.
     */
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Hash at the model boundary so every account-creation path, including
// student admission and provisioning scripts, stores only a password hash.
userSchema.pre("save", async function hashPasswordBeforeSave() {
  if (!this.isModified("password")) return;
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(this.password)) return;
  const passwordError = validatePassword(this.password);
  if (passwordError) throw new Error(passwordError);
  this.password = await bcrypt.hash(this.password, 12);
});

module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");

const planEnrollmentProgramSchema = new mongoose.Schema({
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  weeklyLimit: { type: Number, default: null },
  curriculum: [{ day: Number, title: String, description: String, skill: String }],
}, { _id: false });

const enrollmentStatusHistorySchema = new mongoose.Schema({
  from: { type: String, default: null },
  to: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  changedAt: { type: Date, default: Date.now },
  note: { type: String, trim: true, maxlength: 300, default: "" },
}, { _id: false });

const planEnrollmentSchema = new mongoose.Schema({
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  feePlan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", default: null },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  status: { type: String, enum: ["ACTIVE", "PAUSED", "COMPLETED", "EXPIRED", "CANCELLED", "ENDED"], default: "ACTIVE", required: true },
  enrollmentSource: { type: String, trim: true, maxlength: 60, default: "STAFF" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  renewedTo: { type: mongoose.Schema.Types.ObjectId, default: null },
  statusHistory: { type: [enrollmentStatusHistorySchema], default: [] },
  classesPerWeek: { type: Number, default: null },
  startingBelt: { type: String, default: "White" },
  programs: { type: [planEnrollmentProgramSchema], default: [] },
  // A dated copy of the plan's fee terms. Later fee plan changes do not
  // retroactively change what this enrollment agreed to pay.
  billingSnapshot: {
    feeName: { type: String, default: "" },
    amount: { type: Number, min: 0, default: 0 },
    billingFrequency: { type: String, enum: ["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"], default: "ONE_TIME" },
    registrationFee: { type: Number, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    active: { type: Boolean, default: true },
    discountRules: [{ name: String, type: { type: String, enum: ["FIXED", "PERCENT"] }, amount: Number, active: Boolean, effectiveFrom: Date, effectiveUntil: Date }],
    effectiveFrom: { type: Date, default: null },
    effectiveUntil: { type: Date, default: null },
  },
}, { timestamps: true });

const programBeltSchema = new mongoose.Schema({
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  belt: { type: String, trim: true, required: true },
}, { _id: false });

const guardianSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 100, required: true },
  relationship: { type: String, enum: ["FATHER", "MOTHER", "GUARDIAN"], required: true },
  phone: { type: String, trim: true, maxlength: 20, default: "" },
  email: { type: String, lowercase: true, trim: true, maxlength: 150, default: "" },
  emergencyContact: { type: Boolean, default: false },
  pickupAuthorized: { type: Boolean, default: false },
}, { _id: true });

const studentSchema = new mongoose.Schema(
  {
    /*
     * Linked login account for this student.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /*
     * Student identity.
     */
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    age: {
      type: Number,
      required: true,
      min: 1,
      max: 120,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      minlength: 7,
      maxlength: 20,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 150,
      default: null,
    },
    guardians: { type: [guardianSchema], default: [] },

    /*
     * Academy branch.
     */
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },

    /*
     * Current active plan.
     */
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    planEnrollments: { type: [planEnrollmentSchema], default: [] },

    /*
     * Official admission/join date.
     *
     * Attendance and training-day calculations
     * depend on this field.
     */
    joinDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    /*
     * Current belt.
     */
    currentBelt: {
      type: String,
      default: "White",
      trim: true,
      maxlength: 50,
    },
    programBelts: { type: [programBeltSchema], default: [] },

    /*
     * Student lifecycle status.
     */
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "COMPLETED"],
      default: "ACTIVE",
      required: true,
      index: true,
    },

    /*
     * Original registration timestamp.
     *
     * This is different from joinDate:
     * - registrationDate = when record was created
     * - joinDate = official training/admission date
     */
    registrationDate: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true,
  },
);

/*
 * A login account should map to at most one
 * student profile.
 *
 * Sparse allows older records with user=null.
 */
studentSchema.index(
  { user: 1 },
  {
    unique: true,
    // `sparse` still indexes explicit null values, which would prevent
    // multiple legacy/unlinked student profiles from coexisting. Only real
    // ObjectId links participate in the uniqueness constraint.
    partialFilterExpression: { user: { $type: "objectId" } },
  },
);

/*
 * Fast branch + status filtering.
 */
studentSchema.index({
  branch: 1,
  status: 1,
});

studentSchema.index({ branch: 1, registrationDate: -1 });
studentSchema.index({ branch: 1, "planEnrollments.endDate": 1 });
studentSchema.index({ branch: 1, "planEnrollments.enrollmentSource": 1, "planEnrollments.startDate": 1 });

/*
 * Fast branch + plan filtering.
 */
studentSchema.index({
  branch: 1,
  plan: 1,
});

/*
 * Normalize empty optional email values.
 */
studentSchema.pre("validate", function normalizeStudentFields() {
  if (typeof this.name === "string") {
    this.name = this.name.trim();
  }

  if (typeof this.phone === "string") {
    this.phone = this.phone.trim();
  }

  if (typeof this.email === "string") {
    const normalized = this.email.trim().toLowerCase();

    this.email = normalized || null;
  }

  if (typeof this.currentBelt === "string") {
    this.currentBelt = this.currentBelt.trim();
  }
});

module.exports = mongoose.model("Student", studentSchema);

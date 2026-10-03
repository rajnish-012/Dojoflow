const mongoose = require("mongoose");

const planEnrollmentProgramSchema = new mongoose.Schema({
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  weeklyLimit: { type: Number, default: null },
  curriculum: [{ day: Number, title: String, description: String, skill: String }],
}, { _id: false });

const planEnrollmentSchema = new mongoose.Schema({
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  status: { type: String, enum: ["ACTIVE", "ENDED"], default: "ACTIVE", required: true },
  classesPerWeek: { type: Number, default: null },
  startingBelt: { type: String, default: "White" },
  programs: { type: [planEnrollmentProgramSchema], default: [] },
}, { timestamps: true });

const programBeltSchema = new mongoose.Schema({
  program: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSessionType", required: true },
  belt: { type: String, trim: true, required: true },
}, { _id: false });

const studentSchema = new mongoose.Schema(
  {
    /*
     * Linked login account for this student.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
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
    sparse: true,
  },
);

/*
 * Fast branch + status filtering.
 */
studentSchema.index({
  branch: 1,
  status: 1,
});

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

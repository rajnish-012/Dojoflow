const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const { isBranchScoped } = require("../utils/access");

const Student = require("../models/Student");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Branch = require("../models/Branch");
const CoachStudentAssignment = require("../models/CoachStudentAssignment");

/* =========================================================
   CONSTANTS
========================================================= */

const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "COMPLETED"];

const MAX_AGE = 120;

/* =========================================================
   HELPERS
========================================================= */

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeEmail(value) {
  const normalized = normalizeString(value).toLowerCase();

  return normalized || null;
}

function isValidEmail(value) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDateOnly(value) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseDateOnly(value) {
  if (!isValidDateOnly(value)) {
    return null;
  }

  if (value instanceof Date) {
    const date = new Date(value);

    date.setHours(0, 0, 0, 0);

    return date;
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function startOfToday() {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date;
}

function isBranchAdmin(req) {
  return req.user?.role === "BRANCH_ADMIN";
}

function isSuperAdmin(req) {
  return req.user?.role === "SUPER_ADMIN";
}

function isCoach(req) {
  return req.user?.role === "COACH";
}

function hasSameId(first, second) {
  if (!first || !second) {
    return false;
  }

  return first.toString() === second.toString();
}

/* =========================================================
   ACCESS HELPERS
========================================================= */

async function checkStudentAccess(req, student) {
  if (!student) {
    return {
      status: 404,
      message: "Student not found",
    };
  }

  /*
   * Coaches are assignment-based.
   * They must have an ACTIVE assignment.
   */
  if (isCoach(req)) {
    const assignment = await CoachStudentAssignment.findOne({
      coach: req.user._id,
      student: student._id,
      status: "ACTIVE",
    }).select("_id");

    if (!assignment) {
      return {
        status: 403,
        message: "You do not have access to this student",
      };
    }

    return null;
  }

  /*
   * Branch-scoped users can only access students
   * belonging to their own branch.
   */
  if (isBranchScoped(req.user)) {
    if (!req.user.branch) {
      return {
        status: 403,
        message: "No branch is assigned to this account",
      };
    }

    if (!student.branch || !hasSameId(student.branch, req.user.branch)) {
      return {
        status: 403,
        message: "You do not have access to this student",
      };
    }
  }

  return null;
}

/* =========================================================
   GET ALL STUDENTS
========================================================= */

const getStudents = async (req, res) => {
  try {
    const filter = {};

    /*
     * Coach:
     * only actively assigned students.
     */
    if (isCoach(req)) {
      const assignments = await CoachStudentAssignment.find({
        coach: req.user._id,
        status: "ACTIVE",
      }).select("student");

      filter._id = {
        $in: assignments.map((item) => item.student),
      };
    } else if (isBranchScoped(req.user)) {

    /*
     * Branch scoped:
     * only students from assigned branch.
     */
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    const students = await Student.find(filter)
      .populate("branch", "name address")
      .populate("plan", "name price duration startingBelt isActive")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch students",
    });
  }
};

/* =========================================================
   GET SINGLE STUDENT
========================================================= */

const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(id)
      .populate("branch", "name address")
      .populate("plan");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const accessError = await checkStudentAccess(req, student);

    if (accessError) {
      return res.status(accessError.status).json({
        success: false,
        message: accessError.message,
      });
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Get student error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student",
    });
  }
};

/* =========================================================
   GET LOGGED-IN STUDENT
========================================================= */

const getMyStudentProfile = async (req, res) => {
  try {
    if (req.user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only for students",
      });
    }

    const student = await Student.findOne({
      user: req.user._id,
    })
      .populate("branch", "name address")
      .populate("plan");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Get my student profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student profile",
    });
  }
};

/* =========================================================
   CREATE STUDENT
========================================================= */

const createStudent = async (req, res) => {
  let createdUser = null;
  let createdStudent = null;

  try {
    const {
      name,
      age,
      phone,
      email,
      loginEmail,
      loginPassword,
      branch,
      plan,
      joinDate,
    } = req.body;

    const normalizedName = normalizeString(name);

    const normalizedPhone = normalizeString(phone);

    const normalizedLoginEmail = normalizeEmail(loginEmail);

    const normalizedStudentEmail = normalizeEmail(email);

    /*
     * Required fields.
     */
    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: "Student name is required.",
      });
    }

    if (age === undefined || age === null || String(age).trim() === "") {
      return res.status(400).json({ success: false, message: "Age is required." });
    }

    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    if (!normalizedLoginEmail) {
      return res.status(400).json({ success: false, message: "Login email is required." });
    }

    if (typeof loginPassword !== "string" || !loginPassword) {
      return res.status(400).json({ success: false, message: "Login password is required." });
    }

    if (!branch) {
      return res.status(400).json({ success: false, message: "Branch is required." });
    }

    if (!plan) {
      return res.status(400).json({ success: false, message: "Training plan is required." });
    }

    /*
     * Name validation.
     */
    if (normalizedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Student name must contain at least 2 characters",
      });
    }

    if (normalizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Student name cannot exceed 100 characters",
      });
    }

    /*
     * Age validation.
     */
    const numericAge = Number(age);

    if (
      !Number.isInteger(numericAge) ||
      numericAge < 1 ||
      numericAge > MAX_AGE
    ) {
      return res.status(400).json({
        success: false,
        message: `Student age must be a whole number between 1 and ${MAX_AGE}`,
      });
    }

    /*
     * Phone validation.
     */
    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be exactly 10 digits.",
      });
    }

    /*
     * Email validation.
     */
    if (
      !isValidEmail(normalizedLoginEmail) ||
      !isValidEmail(normalizedStudentEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid login email or personal email.",
      });
    }

    /*
     * Password validation.
     */
    if (typeof loginPassword !== "string" || loginPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Student login password must be at least 6 characters",
      });
    }

    /*
     * ObjectId validation.
     */
    if (
      typeof branch !== "string" ||
      !/^[a-f\d]{24}$/i.test(branch) ||
      typeof plan !== "string" ||
      !/^[a-f\d]{24}$/i.test(plan)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch or training plan ID.",
      });
    }

    /*
     * Branch Admin can only create students
     * in their own branch.
     */
    if (isBranchAdmin(req) && !hasSameId(req.user.branch, branch)) {
      return res.status(403).json({
        success: false,
        message: "You can only add students to your branch",
      });
    }

    /*
     * Validate branch.
     */
    const selectedBranch = await Branch.findById(branch);

    if (!selectedBranch) {
      return res.status(404).json({
        success: false,
        message: "Selected branch does not exist.",
      });
    }

    /*
     * If Branch has isActive, don't admit into
     * an inactive branch.
     */
    if (selectedBranch.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Selected branch is inactive",
      });
    }

    /*
     * Validate plan.
     */
    const selectedPlan = await Plan.findById(plan);

    if (!selectedPlan) {
      return res.status(404).json({
        success: false,
        message: "Selected training plan does not exist.",
      });
    }

    if (selectedPlan.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Selected plan is inactive",
      });
    }

    /*
     * Join date.
     */
    const admissionDate = joinDate;

    if (!isValidDateOnly(admissionDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid join date. Use YYYY-MM-DD.",
      });
    }

    const parsedJoinDate = parseDateOnly(admissionDate);

    if (!parsedJoinDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid join date.",
      });
    }

    /*
     * Future admission dates are not allowed.
     */
    if (parsedJoinDate.getTime() > startOfToday().getTime()) {
      return res.status(400).json({
        success: false,
        message: "Join date cannot be in the future",
      });
    }

    /*
     * Login email must be unique.
     */
    const existingUser = await User.findOne({
      email: normalizedLoginEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this login email already exists.",
      });
    }

    /*
     * Student contact email should not belong
     * to another student.
     */
    if (normalizedStudentEmail) {
      const existingStudent = await Student.findOne({
        email: normalizedStudentEmail,
      });

      if (existingStudent) {
        return res.status(409).json({
          success: false,
          message: "A student already exists with this email",
        });
      }
    }

    /*
     * Create login account.
     */
    const hashedPassword = await bcrypt.hash(loginPassword, 10);

    createdUser = await User.create({
      name: normalizedName,
      email: normalizedLoginEmail,
      password: hashedPassword,
      role: "STUDENT",
      branch,
    });

    /*
     * Create student profile.
     */
    createdStudent = await Student.create({
      user: createdUser._id,
      name: normalizedName,
      age: numericAge,
      phone: normalizedPhone,
      email: normalizedStudentEmail || undefined,
      branch,
      plan,
      joinDate: parsedJoinDate,
      currentBelt: "White",
      status: "ACTIVE",
    });

    const populatedStudent = await Student.findById(createdStudent._id)
      .populate("branch", "name address")
      .populate("plan", "name price duration startingBelt isActive");

    return res.status(201).json({
      success: true,
      message: "Student admitted and login account created successfully",
      student: populatedStudent,
    });
  } catch (error) {
    console.error("Create student error:", error);

    /*
     * If student creation fails after the
     * login account was created, remove the
     * partially-created account.
     */
    let studentCleanupSucceeded = !createdStudent;

    if (createdStudent) {
      try {
        await Student.findByIdAndDelete(createdStudent._id);
        studentCleanupSucceeded = true;
      } catch (cleanupError) {
        console.error("Failed to cleanup student profile:", cleanupError);
      }
    }

    if (createdUser && studentCleanupSucceeded) {
      try {
        await User.findByIdAndDelete(createdUser._id);
      } catch (cleanupError) {
        console.error("Failed to cleanup student user:", cleanupError);
      }
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A user with this login email already exists.",
      });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message || "Student information is invalid.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create student",
    });
  }
};

/* =========================================================
   UPDATE STUDENT
========================================================= */

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /*
     * Verify access before allowing changes.
     */
    const accessError = await checkStudentAccess(req, student);

    if (accessError) {
      return res.status(accessError.status).json({
        success: false,
        message: accessError.message,
      });
    }

    const {
      name,
      age,
      phone,
      email,
      branch,
      plan,
      currentBelt,
      status,
      joinDate,
      password,
    } = req.body;

    /*
     * Coaches should only be allowed to edit
     * basic student profile information.
     *
     * They cannot change:
     * - branch
     * - plan
     * - status
     * - belt
     * - join date
     */
    if (isCoach(req)) {
      const forbiddenFields = [
        "branch",
        "plan",
        "currentBelt",
        "status",
        "joinDate",
      ];

      const attemptedForbiddenField = forbiddenFields.find(
        (field) => req.body[field] !== undefined,
      );

      if (attemptedForbiddenField) {
        return res.status(403).json({
          success: false,
          message: `Coaches cannot change student ${attemptedForbiddenField}`,
        });
      }
    }

    /*
     * NAME
     */
    if (name !== undefined) {
      const normalizedName = normalizeString(name);

      if (normalizedName.length < 2 || normalizedName.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Student name must contain between 2 and 100 characters",
        });
      }

      student.name = normalizedName;
    }

    /*
     * AGE
     */
    if (age !== undefined) {
      const numericAge = Number(age);

      if (
        !Number.isInteger(numericAge) ||
        numericAge < 1 ||
        numericAge > MAX_AGE
      ) {
        return res.status(400).json({
          success: false,
          message: `Student age must be a whole number between 1 and ${MAX_AGE}`,
        });
      }

      student.age = numericAge;
    }

    /*
     * PHONE
     */
    if (phone !== undefined) {
      const normalizedPhone = normalizeString(phone);

      if (normalizedPhone.length < 7 || normalizedPhone.length > 20) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid phone number",
        });
      }

      student.phone = normalizedPhone;
    }

    /*
     * STUDENT CONTACT EMAIL
     */
    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);

      if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address",
        });
      }

      if (normalizedEmail) {
        const existingStudent = await Student.findOne({
          email: normalizedEmail,
          _id: {
            $ne: student._id,
          },
        }).select("_id");

        if (existingStudent) {
          return res.status(409).json({
            success: false,
            message: "Another student already uses this email",
          });
        }
      }

      student.email = normalizedEmail || undefined;
    }

    /*
     * BRANCH CHANGE
     *
     * Only Super Admin can transfer a student
     * between branches.
     */
    if (branch !== undefined) {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({
          success: false,
          message: "Only Super Admin can transfer a student between branches",
        });
      }

      if (!isValidObjectId(branch)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      const targetBranch = await Branch.findById(branch);

      if (!targetBranch) {
        return res.status(404).json({
          success: false,
          message: "Selected branch not found",
        });
      }

      if (targetBranch.isActive === false) {
        return res.status(400).json({
          success: false,
          message: "Selected branch is inactive",
        });
      }

      student.branch = targetBranch._id;

      /*
       * Keep the student's login account
       * branch synchronized.
       */
      if (student.user) {
        await User.findByIdAndUpdate(student.user, {
          branch: targetBranch._id,
        });
      }
    }

    /*
     * PLAN CHANGE
     *
     * Branch Admin and Super Admin can change
     * the student's plan.
     *
     * We intentionally DO NOT automatically
     * change the student's current belt.
     */
    if (plan !== undefined) {
      if (!isSuperAdmin(req) && !isBranchAdmin(req)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to change the student's plan",
        });
      }

      if (!isValidObjectId(plan)) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan ID",
        });
      }

      const selectedPlan = await Plan.findById(plan);

      if (!selectedPlan) {
        return res.status(404).json({
          success: false,
          message: "Selected plan not found",
        });
      }

      if (selectedPlan.isActive === false) {
        return res.status(400).json({
          success: false,
          message: "Selected plan is inactive",
        });
      }

      student.plan = selectedPlan._id;
    }

    /*
     * BELT
     *
     * Only Super Admin and Branch Admin
     * can directly update belt.
     */
    if (currentBelt !== undefined) {
      if (!isSuperAdmin(req) && !isBranchAdmin(req)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to change the student's belt",
        });
      }

      const normalizedBelt = normalizeString(currentBelt);

      if (!normalizedBelt) {
        return res.status(400).json({
          success: false,
          message: "Current belt cannot be empty",
        });
      }

      if (normalizedBelt.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Current belt cannot exceed 50 characters",
        });
      }

      student.currentBelt = normalizedBelt;
    }

    /*
     * STATUS
     */
    if (status !== undefined) {
      if (!isSuperAdmin(req) && !isBranchAdmin(req)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to change student status",
        });
      }

      if (!STUDENT_STATUSES.includes(String(status))) {
        return res.status(400).json({
          success: false,
          message: "Invalid student status",
        });
      }

      student.status = String(status);
    }

    const previousStatus = student.status;

    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Student login password must be at least 6 characters",
        });
      }

      if (!student.user) {
        return res.status(409).json({
          success: false,
          message: "This student has no linked login account",
        });
      }
    }

    /*
     * JOIN DATE
     *
     * Only Super Admin can modify it.
     *
     * This is intentionally protected because
     * attendance/training-day calculations depend
     * on the student's admission date.
     */
    if (joinDate !== undefined) {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({
          success: false,
          message: "Only Super Admin can change the student's join date",
        });
      }

      if (!isValidDateOnly(joinDate)) {
        return res.status(400).json({
          success: false,
          message: "Join date must be a valid YYYY-MM-DD date",
        });
      }

      const parsedJoinDate = parseDateOnly(joinDate);

      if (parsedJoinDate.getTime() > startOfToday().getTime()) {
        return res.status(400).json({
          success: false,
          message: "Join date cannot be in the future",
        });
      }

      student.joinDate = parsedJoinDate;
    }

    let linkedUser = null;
    const passwordChanged = typeof password === "string" && password.length > 0;
    const statusChanged = status !== undefined && student.status !== previousStatus;
    const nameChanged = name !== undefined;

    if (student.user && (passwordChanged || statusChanged || nameChanged)) {
      linkedUser = await User.findById(student.user).select(
        passwordChanged ? "+password" : "name email role branch isActive",
      );

      if (!linkedUser && passwordChanged) {
        return res.status(409).json({
          success: false,
          message: "This student's linked login account was not found",
        });
      }

      if (linkedUser) {
        if (nameChanged) linkedUser.name = student.name;
        if (statusChanged) linkedUser.isActive = student.status !== "INACTIVE";
        if (passwordChanged) {
          linkedUser.password = await bcrypt.hash(password, 10);
          linkedUser.passwordChangedAt = new Date();
        }
      }
    }

    await student.save();
    if (linkedUser) await linkedUser.save();

    const updatedStudent = await Student.findById(id)
      .populate("branch", "name address")
      .populate("plan", "name price duration startingBelt isActive");

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Update student error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A student with the same unique information already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update student",
    });
  }
};

/* =========================================================
   DELETE STUDENT
========================================================= */

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    /*
     * Keep historical attendance, makeup and progress references intact.
     * DELETE therefore deactivates the student instead of removing records.
     */
    if (!isSuperAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can delete students",
      });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (student.user) {
      await User.findByIdAndUpdate(student.user, {
        isActive: false,
      });
    }

    student.status = "INACTIVE";
    await student.save();

    await CoachStudentAssignment.updateMany(
      { student: student._id, status: "ACTIVE" },
      { $set: { status: "INACTIVE", unassignedAt: new Date() } },
    );

    return res.status(200).json({
      success: true,
      message: "Student deactivated. Historical records were retained.",
    });
  } catch (error) {
    console.error("Delete student error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete student",
    });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getStudents,
  getStudentById,
  getMyStudentProfile,
  createStudent,
  updateStudent,
  deleteStudent,
};

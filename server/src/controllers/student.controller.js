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

function enrollmentEndDate(plan, startDate) {
  const end = new Date(startDate);
  if (plan.durationUnit === "DAYS") end.setDate(end.getDate() + Number(plan.duration));
  else end.setMonth(end.getMonth() + Number(plan.duration));
  return end;
}

function enrollmentSnapshot(plan) {
  return {
    classesPerWeek: Number(plan.classesPerWeek || 0),
    startingBelt: plan.startingBelt || "White",
    programs: (plan.programs || []).map((item) => ({
      program: item.program?._id || item.program,
      weeklyLimit: item.weeklyLimit ?? null,
      curriculum: ((Array.isArray(item.curriculum) && item.curriculum.length ? item.curriculum : plan.curriculum || [])).map((lesson) => ({
        day: lesson.day, title: lesson.title, description: lesson.description || "", skill: lesson.skill || "",
      })),
    })),
  };
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
    const {
      search,
      branch,
      plan,
      status,
      belt,
      joinFrom,
      joinTo,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

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

    if (!isBranchScoped(req.user) && branch) {
      if (!isValidObjectId(branch)) {
        return res.status(400).json({ success: false, message: "Invalid branch ID" });
      }
      filter.branch = branch;
    }

    if (plan) {
      if (!isValidObjectId(plan)) {
        return res.status(400).json({ success: false, message: "Invalid plan ID" });
      }
      filter.plan = plan;
    }

    if (status) {
      const normalizedStatus = String(status).toUpperCase();
      if (!STUDENT_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({ success: false, message: "Invalid student status" });
      }
      filter.status = normalizedStatus;
    }

    if (belt) {
      filter.currentBelt = String(belt);
    }

    if (joinFrom || joinTo) {
      filter.joinDate = {};
      if (joinFrom) {
        const date = parseDateOnly(joinFrom);
        if (!date) return res.status(400).json({ success: false, message: "Invalid joinFrom date" });
        filter.joinDate.$gte = date;
      }
      if (joinTo) {
        const date = parseDateOnly(joinTo);
        if (!date) return res.status(400).json({ success: false, message: "Invalid joinTo date" });
        date.setHours(23, 59, 59, 999);
        filter.joinDate.$lte = date;
      }
    }

    if (search) {
      const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expression = new RegExp(safeSearch, "i");
      const [matchingPlans, matchingBranches] = await Promise.all([
        Plan.find({ name: expression }).select("_id").lean(),
        Branch.find({ name: expression }).select("_id").lean(),
      ]);
      filter.$or = [
        { name: expression },
        { phone: expression },
        { email: expression },
        { currentBelt: expression },
        { plan: { $in: matchingPlans.map((item) => item._id) } },
        { branch: { $in: matchingBranches.map((item) => item._id) } },
      ];
    }

    const shouldPaginate = page !== undefined || limit !== undefined;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const skip = (pageNumber - 1) * pageSize;
    const allowedSortFields = ["name", "joinDate", "createdAt", "updatedAt", "currentBelt", "status"];
    const sortField = allowedSortFields.includes(String(sortBy)) ? String(sortBy) : "createdAt";
    const sortDirection = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;

    const studentQuery = Student.find(filter)
      .populate("branch", "name address")
      .populate("plan", "name price duration startingBelt isActive programs")
      .populate("plan.programs.program", "name slug")
      .sort({ [sortField]: sortDirection, _id: -1 });

    if (shouldPaginate) {
      studentQuery.skip(skip).limit(pageSize);
    }

    const [students, total] = await Promise.all([studentQuery, Student.countDocuments(filter)]);

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
      pagination: {
        page: pageNumber,
        limit: shouldPaginate ? pageSize : total,
        total,
        pages: shouldPaginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
      },
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
      .populate("plan")
      .populate("plan.programs.program", "name slug");

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
      return res.status(400).json({
        success: false,
        message: "Age is required.",
      });
    }

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    if (!normalizedLoginEmail) {
      return res.status(400).json({
        success: false,
        message: "Login email is required.",
      });
    }

    if (typeof loginPassword !== "string" || !loginPassword) {
      return res.status(400).json({
        success: false,
        message: "Login password is required.",
      });
    }

    if (!branch) {
      return res.status(400).json({
        success: false,
        message: "Branch is required.",
      });
    }

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Training plan is required.",
      });
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
     * Branch-scoped users can only create students
     * in their own branch.
     */
    if (isBranchScoped(req.user) && !hasSameId(req.user.branch, branch)) {
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
        message: "Selected training plan is inactive",
      });
    }

    /*
     * Join date.
     */
    let parsedJoinDate = startOfToday();

    if (joinDate !== undefined) {
      if (!isValidDateOnly(joinDate)) {
        return res.status(400).json({
          success: false,
          message: "Join date must be a valid YYYY-MM-DD date",
        });
      }

      parsedJoinDate = parseDateOnly(joinDate);

      if (parsedJoinDate.getTime() > startOfToday().getTime()) {
        return res.status(400).json({
          success: false,
          message: "Join date cannot be in the future",
        });
      }
    }

    /*
     * Duplicate student phone.
     */
    const existingPhone = await Student.findOne({
      phone: normalizedPhone,
    }).select("_id");

    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: "A student with this phone number already exists.",
      });
    }

    /*
     * Duplicate student email.
     */
    if (normalizedStudentEmail) {
      const existingStudentEmail = await Student.findOne({
        email: normalizedStudentEmail,
      }).select("_id");

      if (existingStudentEmail) {
        return res.status(409).json({
          success: false,
          message: "A student with this email already exists.",
        });
      }
    }

    /*
     * Login account email must be unique.
     */
    const existingUser = await User.findOne({
      email: normalizedLoginEmail,
    }).select("_id");

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user account with this login email already exists.",
      });
    }

    /*
     * Create login account.
     *
     * Students intentionally use the existing STUDENT role.
     */
    createdUser = await User.create({
      name: normalizedName,
      email: normalizedLoginEmail,
      password: loginPassword,
      role: "STUDENT",
      branch: selectedBranch._id,
      isActive: true,
    });

    /*
     * Create student.
     */
    createdStudent = await Student.create({
      user: createdUser._id,
      name: normalizedName,
      age: numericAge,
      phone: normalizedPhone,
      email: normalizedStudentEmail || undefined,
      branch: selectedBranch._id,
      plan: selectedPlan._id,
      planEnrollments: [{ plan: selectedPlan._id, startDate: parsedJoinDate, endDate: enrollmentEndDate(selectedPlan, parsedJoinDate), status: "ACTIVE", ...enrollmentSnapshot(selectedPlan) }],
      joinDate: parsedJoinDate,
      status: "ACTIVE",
      currentBelt:
        selectedPlan.startingBelt || selectedPlan.belt || "White Belt",
    });

    /*
     * Return populated student.
     */
    const populatedStudent = await Student.findById(createdStudent._id)
      .populate("branch", "name address")
      .populate("plan", "name price duration startingBelt isActive programs")
      .populate("plan.programs.program", "name slug");

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      student: populatedStudent,
    });
  } catch (error) {
    console.error("Create student error:", error);

    /*
     * Roll back the linked User if Student creation failed.
     *
     * This preserves the user/student synchronization
     * requirement.
     */
    if (createdStudent) {
      try {
        await Student.findByIdAndDelete(createdStudent._id);
      } catch (rollbackError) {
        console.error("Student rollback error:", rollbackError);
      }
    }

    if (createdUser) {
      try {
        await User.findByIdAndDelete(createdUser._id);
      } catch (rollbackError) {
        console.error("User rollback error:", rollbackError);
      }
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A student or user with the same unique information already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to create student"
          : error.message || "Failed to create student",
    });
  }
};

/* =========================================================
   UPDATE STUDENT
========================================================= */

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      age,
      phone,
      email,
      branch,
      plan,
      currentBelt,
      status,
      password,
      joinDate,
    } = req.body;

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
     * Branch and coach access.
     *
     * This protects update operations before any
     * mutable field is changed.
     */
    const accessError = await checkStudentAccess(req, student);

    if (accessError) {
      return res.status(accessError.status).json({
        success: false,
        message: accessError.message,
      });
    }

    /*
     * NAME
     */
    if (name !== undefined) {
      const normalizedName = normalizeString(name);

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
     * All-scope users with student.update may transfer a student
     * between branches. Branch-scoped users may only retain their
     * assigned branch, even when they submit a different branch ID.
     */
    if (branch !== undefined) {
      if (isBranchScoped(req.user) && !hasSameId(req.user.branch, branch)) {
        return res.status(403).json({
          success: false,
          message: "You can only keep students in your assigned branch",
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
     * The route requires student.update permission.
     *
     * Coaches remain unable to change the plan because
     * this is a business/data-integrity restriction.
     *
     * Custom roles with student.update can change the plan.
     */
    if (plan !== undefined) {
      if (isCoach(req)) {
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

      if (String(student.plan) !== String(selectedPlan._id)) {
        const enrollmentStart = new Date();
        enrollmentStart.setHours(0, 0, 0, 0);
        const currentEnrollment = [...(student.planEnrollments || [])].reverse().find((item) => item.status === "ACTIVE");
        if (currentEnrollment) {
          currentEnrollment.status = "ENDED";
          currentEnrollment.endDate = enrollmentStart;
        }
        student.planEnrollments.push({ plan: selectedPlan._id, startDate: enrollmentStart, endDate: enrollmentEndDate(selectedPlan, enrollmentStart), status: "ACTIVE", ...enrollmentSnapshot(selectedPlan) });
        student.plan = selectedPlan._id;
      }
    }

    /*
     * BELT
     *
     * The route requires student.update permission.
     *
     * Coaches remain unable to directly update belt.
     */
    if (currentBelt !== undefined) {
      if (isCoach(req)) {
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
     *
     * The route requires student.update permission.
     *
     * Coaches cannot directly change student status.
     */
    if (status !== undefined) {
      if (isCoach(req)) {
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

    /*
     * PASSWORD
     */
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

    /*
     * Linked user synchronization.
     */
    let linkedUser = null;

    const passwordChanged = typeof password === "string" && password.length > 0;

    const statusChanged =
      status !== undefined && student.status !== previousStatus;

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
        if (nameChanged) {
          linkedUser.name = student.name;
        }

        if (statusChanged) {
          linkedUser.isActive = student.status !== "INACTIVE";
        }

        if (passwordChanged) {
          linkedUser.password = await bcrypt.hash(password, 10);
          linkedUser.passwordChangedAt = new Date();
        }
      }
    }

    await student.save();

    if (linkedUser) {
      await linkedUser.save();
    }

    const updatedStudent = await Student.findById(id)
      .populate("branch", "name address")
      .populate("plan", "name price duration startingBelt isActive programs")
      .populate("plan.programs.program", "name slug");

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
     * Keep historical attendance, makeup and progress
     * references intact.
     *
     * DELETE therefore deactivates the student instead
     * of removing records.
     *
     * The route already requires student.delete permission.
     *
     * The controller additionally enforces database-driven
     * branch scope so a custom branch-scoped role cannot
     * deactivate students from another branch.
     */
    const student = await Student.findById(id);

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

    /*
     * Deactivate linked login account.
     */
    if (student.user) {
      await User.findByIdAndUpdate(student.user, {
        isActive: false,
      });
    }

    /*
     * Preserve the student document and all historical
     * attendance/makeup/progress references.
     */
    student.status = "INACTIVE";

    await student.save();

    /*
     * Remove active coach assignments without deleting
     * historical assignment information.
     */
    await CoachStudentAssignment.updateMany(
      {
        student: student._id,
        status: "ACTIVE",
      },
      {
        $set: {
          status: "INACTIVE",
          unassignedAt: new Date(),
        },
      },
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

const mongoose = require("mongoose");
const Plan = require("../models/Plan");
const TrainingSessionType = require("../models/TrainingSessionType");

const validatePrograms = async (programs, previousPrograms = []) => {
  if (!Array.isArray(programs) || programs.length === 0) {
    return { error: "Select at least one active program for this plan." };
  }
  const ids = programs.map((item) => String(item?.program || ""));
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) return { error: "Every plan program must have a valid ID." };
  if (new Set(ids).size !== ids.length) return { error: "A program can only be added once to a plan." };
  for (const item of programs) {
    if (item.weeklyLimit != null && (!Number.isInteger(Number(item.weeklyLimit)) || Number(item.weeklyLimit) < 1)) return { error: "Program weekly limits must be positive whole numbers." };
  }
  const records = await TrainingSessionType.find({ _id: { $in: ids } }).select("_id isActive").lean();
  if (records.length !== ids.length) return { error: "One or more selected programs no longer exist." };
  if (records.some((item) => !item.isActive)) return { error: "Inactive programs cannot be assigned to plans." };
  const previous = new Map(previousPrograms.map((item) => [String(item.program?._id || item.program), item]));
  return { value: programs.map((item) => {
    const old = previous.get(String(item.program));
    return {
      program: item.program,
      weeklyLimit: item.weeklyLimit == null || item.weeklyLimit === "" ? (old?.weeklyLimit ?? null) : Number(item.weeklyLimit),
      curriculum: Array.isArray(item.curriculum) ? item.curriculum : (old?.curriculum || []),
    };
  }) };
};

/* =========================================================
   GET ALL PLANS
   GET /api/plans
   ========================================================= */

const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find().populate("programs.program", "name slug isActive").sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    console.error("Get plans error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
    });
  }
};

/* =========================================================
   GET SINGLE PLAN
   GET /api/plans/:id
   ========================================================= */

const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    const plan = await Plan.findById(id).populate("programs.program", "name slug isActive");

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Get plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plan",
    });
  }
};

/* =========================================================
   GET PLANS FOR CURRICULUM
   GET /api/plans/curriculum
   ========================================================= */

/*
 * Curriculum is stored inside Plan.curriculum.
 *
 * This endpoint deliberately does NOT require plan.view.
 *
 * A user with curriculum.view should be able to access
 * the Curriculum module without automatically receiving
 * the broader Plan permission.
 */

const getCurriculumPlans = async (req, res) => {
  try {
    const plans = await Plan.find()
      .select(
        [
          "name",
          "classesPerWeek",
          "duration",
          "durationUnit",
          "startingBelt",
          "progressReports",
          "milestones",
          "curriculum",
          "programs",
          "isActive",
        ].join(" "),
      )
      .sort({
        createdAt: -1,
      });

    await Promise.all(plans.map((plan) => plan.populate("programs.program", "name slug isActive")));

    return res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    console.error("Get curriculum plans error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch curriculum plans",
    });
  }
};

/* =========================================================
   GET PLAN CURRICULUM
   GET /api/plans/:id/curriculum
   ========================================================= */

const getPlanCurriculum = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    const plan = await Plan.findById(id).select(
      [
        "name",
        "classesPerWeek",
        "duration",
        "durationUnit",
        "startingBelt",
        "progressReports",
        "milestones",
        "curriculum",
        "programs",
        "isActive",
      ].join(" "),
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const requestedProgramId = req.query.programId;
    const programEntry = requestedProgramId
      ? plan.programs.find((item) => String(item.program) === String(requestedProgramId))
      : plan.programs.length === 1 ? plan.programs[0] : null;
    if (!programEntry) return res.status(400).json({ success: false, message: "Select a program included in this plan." });

    return res.status(200).json({
      success: true,
      plan,
      programId: String(programEntry.program),
      curriculum: Array.isArray(programEntry.curriculum) && programEntry.curriculum.length
        ? programEntry.curriculum
        : Array.isArray(plan.curriculum) ? plan.curriculum : [],
    });
  } catch (error) {
    console.error("Get plan curriculum error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plan curriculum",
    });
  }
};

/* =========================================================
   CREATE PLAN
   POST /api/plans
   ========================================================= */

/*
 * GENERAL PLAN MANAGEMENT ONLY.
 *
 * Curriculum is intentionally NOT accepted here.
 *
 * Curriculum has its own authorization boundary:
 *
 *   curriculum.manage
 *
 * and must be modified through:
 *
 *   PUT /api/plans/:id/curriculum
 */

const createPlan = async (req, res) => {
  try {
    const {
      name,
      price,
      duration,
      durationUnit,
      classesPerWeek,
      startingBelt,
      progressReports,
      milestones,
      programs,
    } = req.body;

    if (
      !name ||
      price === undefined ||
      !duration ||
      !durationUnit ||
      !classesPerWeek
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, price, duration, durationUnit and classesPerWeek are required",
      });
    }

    const programValidation = await validatePrograms(programs);
    if (programValidation.error) return res.status(400).json({ success: false, message: programValidation.error });

    const plan = await Plan.create({
      name,
      price,
      duration,
      durationUnit,
      classesPerWeek,
      programs: programValidation.value,
      startingBelt,
      progressReports,

      /*
       * Milestones remain part of general plan configuration.
       */
      milestones: Array.isArray(milestones) ? milestones : [],

      /*
       * Curriculum starts empty.
       *
       * It can subsequently be populated through the
       * curriculum.manage-protected endpoint.
       */
      curriculum: [],

      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan,
    });
  } catch (error) {
    console.error("Create plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create plan",
    });
  }
};

/* =========================================================
   UPDATE PLAN
   PUT /api/plans/:id
   ========================================================= */

/*
 * GENERAL PLAN MANAGEMENT ONLY.
 *
 * IMPORTANT:
 *
 * curriculum is deliberately excluded from allowedFields.
 *
 * This prevents:
 *
 * plan.manage
 *
 * from implicitly granting:
 *
 * curriculum.manage
 *
 * Curriculum must use:
 *
 * PUT /api/plans/:id/curriculum
 */

const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    const plan = await Plan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    /*
     * Only fields belonging to general Plan management
     * are allowed here.
     *
     * curriculum is intentionally absent.
     */
    const allowedFields = [
      "name",
      "price",
      "duration",
      "durationUnit",
      "classesPerWeek",
      "startingBelt",
      "progressReports",
      "milestones",
      "isActive",
    ];

    if (req.body.programs !== undefined) {
      const programValidation = await validatePrograms(req.body.programs, plan.programs);
      if (programValidation.error) return res.status(400).json({ success: false, message: programValidation.error });
      plan.programs = programValidation.value;
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        plan[field] = req.body[field];
      }
    });

    await plan.save();

    return res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      plan,
    });
  } catch (error) {
    console.error("Update plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update plan",
    });
  }
};

/* =========================================================
   UPDATE ONLY CURRICULUM
   PUT /api/plans/:id/curriculum
   ========================================================= */

/*
 * IMPORTANT:
 *
 * This endpoint ONLY modifies Plan.curriculum.
 *
 * Route protection:
 *
 *   curriculum.manage
 *
 * A user with only plan.manage cannot use this endpoint.
 */

const updatePlanCurriculum = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.body.programId) || !Array.isArray(req.body.curriculum)) {
      return res.status(400).json({
        success: false,
        message: "A valid programId and curriculum array are required",
      });
    }

    const plan = await Plan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const programEntry = plan.programs.find((item) => String(item.program) === String(req.body.programId));
    if (!programEntry) return res.status(400).json({ success: false, message: "The selected program is not included in this plan." });

    /*
     * Validate every curriculum entry before writing it.
     */
    const curriculum = req.body.curriculum.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new Error(`Invalid curriculum item at index ${index}`);
      }

      const day = Number(item.day);

      const title = typeof item.title === "string" ? item.title.trim() : "";

      if (!Number.isInteger(day) || day < 1) {
        throw new Error(
          `Curriculum day at index ${index} must be a positive whole number`,
        );
      }

      if (!title) {
        throw new Error(`Curriculum title at index ${index} is required`);
      }

      const normalizedItem = {
        day,
        title,
      };

      if (typeof item.description === "string" && item.description.trim()) {
        normalizedItem.description = item.description.trim();
      }

      if (typeof item.skill === "string" && item.skill.trim()) {
        normalizedItem.skill = item.skill.trim();
      }

      return normalizedItem;
    });

    /*
     * Prevent duplicate training days.
     */
    const days = curriculum.map((item) => item.day);

    const uniqueDays = new Set(days);

    if (uniqueDays.size !== days.length) {
      return res.status(400).json({
        success: false,
        message: "Each curriculum day must be unique within a training plan",
      });
    }

    curriculum.sort((a, b) => a.day - b.day);

    /*
     * Only curriculum is changed.
     *
     * No other Plan field is touched.
     */
    programEntry.curriculum = curriculum;

    await plan.save();

    return res.status(200).json({
      success: true,
      message: "Curriculum updated successfully",
      plan,
      programId: String(programEntry.program),
      curriculum: programEntry.curriculum,
    });
  } catch (error) {
    console.error("Update plan curriculum error:", error);

    /*
     * Validation errors generated above
     * are safe to return.
     */
    if (
      error instanceof Error &&
      (error.message.startsWith("Curriculum") ||
        error.message.startsWith("Invalid curriculum"))
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update curriculum",
    });
  }
};

/* =========================================================
   GET PUBLIC PLANS
   GET /api/plans/public
   ========================================================= */

const getPublicPlans = async (req, res) => {
  try {
    const plans = await Plan.find({
      isActive: true,
    })
      .select(
        "name price duration durationUnit classesPerWeek startingBelt progressReports milestones curriculum programs",
      )
      .populate("programs.program", "name slug isActive")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    console.error("Get public plans error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch public plans",
    });
  }
};

/* =========================================================
   DELETE / DEACTIVATE PLAN
   DELETE /api/plans/:id
   ========================================================= */

const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    const plan = await Plan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    /*
     * Plans are referenced by students,
     * attendance, progress and historical records.
     *
     * Never physically delete the plan.
     */
    plan.isActive = false;

    await plan.save();

    return res.status(200).json({
      success: true,
      message: "Plan deactivated successfully",
      plan,
    });
  } catch (error) {
    console.error("Delete plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete plan",
    });
  }
};

/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {
  getPlans,
  getPublicPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  getCurriculumPlans,
  getPlanCurriculum,
  updatePlanCurriculum,
};

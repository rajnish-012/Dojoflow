const mongoose = require("mongoose");
const Plan = require("../models/Plan");

// Get all plans
const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    console.error("Get plans error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
    });
  }
};

// Get single plan
const getPlanById = async (req, res) => {
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

    res.status(200).json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Get plan error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch plan",
    });
  }
};

// Create plan
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
      curriculum,
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

    const plan = await Plan.create({
      name,
      price,
      duration,
      durationUnit,
      classesPerWeek,
      startingBelt,
      progressReports,
      milestones: milestones || [],
      curriculum: curriculum || [],
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan,
    });
  } catch (error) {
    console.error("Create plan error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create plan",
    });
  }
};

// Update plan
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

    const allowedFields = [
      "name",
      "price",
      "duration",
      "durationUnit",
      "classesPerWeek",
      "startingBelt",
      "progressReports",
      "milestones",
      "curriculum",
      "isActive",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        plan[field] = req.body[field];
      }
    });

    await plan.save();

    res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      plan,
    });
  } catch (error) {
    console.error("Update plan error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update plan",
    });
  }
};

// Delete plan
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

    await Plan.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("Delete plan error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete plan",
    });
  }
};

module.exports = {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
};
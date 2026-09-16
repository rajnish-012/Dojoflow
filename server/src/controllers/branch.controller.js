const mongoose = require("mongoose");
const Branch = require("../models/Branch");

const getBranches = async (req, res) => {
  try {
    const filter = {
      isActive: true,
    };

    // Branch Admins and Coaches can only see their own branch
    if (req.user.role === "BRANCH_ADMIN" || req.user.role === "COACH") {
      if (!req.user.branch) {
        return res.status(403).json({
          success: false,
          message: "No branch is assigned to this account",
        });
      }

      filter._id = req.user.branch;
    }

    const branches = await Branch.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: branches.length,
      branches,
    });
  } catch (error) {
    console.error("Get branches error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch branches",
    });
  }
};

const getBranchById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const branch = await Branch.findById(id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    // Branch-level access
    if (
      req.user.role !== "SUPER_ADMIN" &&
      branch._id.toString() !== req.user.branch?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this branch",
      });
    }

    res.status(200).json({
      success: true,
      branch,
    });
  } catch (error) {
    console.error("Get branch error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch branch",
    });
  }
};

// Create a new branch
const createBranch = async (req, res) => {
  try {
    const { name, address, phone } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        success: false,
        message: "Branch name and address are required",
      });
    }

    const existingBranch = await Branch.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });

    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: "A branch with this name already exists",
      });
    }

    const branch = await Branch.create({
      name: name.trim(),
      address: address.trim(),
      phone: phone ? phone.trim() : "",
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Branch created successfully",
      branch,
    });
  } catch (error) {
    console.error("Create branch error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create branch",
    });
  }
};

module.exports = {
  getBranches,
  getBranchById,
  createBranch,
};

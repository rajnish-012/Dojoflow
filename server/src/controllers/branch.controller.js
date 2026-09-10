const mongoose = require("mongoose");
const Branch = require("../models/Branch");

const getBranches = async (req, res) => {
  try {
    const filter = {
      isActive: true,
    };

    // Branch admins and coaches can only see their own branch
    if (
      (req.user.role === "BRANCH_ADMIN" || req.user.role === "COACH") &&
      req.user.branch
    ) {
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

module.exports = {
  getBranches,
  getBranchById,
};
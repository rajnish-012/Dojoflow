const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Branch = require("../models/Branch");

const STAFF_ROLES = [
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
  "COACH",
];

/*
 * Get all staff users
 * Only SUPER_ADMIN can access this.
 */
const getStaffUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: {
        $in: STAFF_ROLES,
      },
    })
      .populate("branch", "name address phone")
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get staff users error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
 * Create staff user
 *
 * Only SUPER_ADMIN is allowed to create staff.
 */
const createStaffUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      branch,
    } = req.body;

    // Required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, password and role are required",
      });
    }

    // Validate role
    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff role",
      });
    }

    // Prevent creating another Super Admin
    // through the UI/API.
    if (role === "SUPER_ADMIN") {
      return res.status(400).json({
        success: false,
        message:
          "A Super Admin cannot be created from Staff Management",
      });
    }

    // Branch is required for branch-specific staff
    if (
      (role === "BRANCH_ADMIN" || role === "COACH") &&
      !branch
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Branch is required for Branch Admin and Coach",
      });
    }

    // Check existing email
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    // Validate branch
    let branchId = null;

    if (branch) {
      const branchExists = await Branch.findById(branch);

      if (!branchExists) {
        return res.status(404).json({
          success: false,
          message: "Selected branch not found",
        });
      }

      if (!branchExists.isActive) {
        return res.status(400).json({
          success: false,
          message: "Selected branch is inactive",
        });
      }

      branchId = branchExists._id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      10,
    );

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      branch: branchId,
    });

    const populatedUser = await User.findById(
      user._id,
    )
      .populate("branch", "name address phone")
      .select("-password");

    res.status(201).json({
      success: true,
      message: "Staff user created successfully",
      user: populatedUser,
    });
  } catch (error) {
    console.error("Create staff user error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
 * Delete staff user
 *
 * Only SUPER_ADMIN can delete staff.
 */
const deleteStaffUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!STAFF_ROLES.includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: "This account is not a staff account",
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Staff user deleted successfully",
    });
  } catch (error) {
    console.error("Delete staff user error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  getStaffUsers,
  createStaffUser,
  deleteStaffUser,
};
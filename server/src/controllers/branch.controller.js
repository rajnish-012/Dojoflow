const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const { normalizePhone } = require("../utils/phone");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

const isValidBranchId = (value) => mongoose.Types.ObjectId.isValid(value);

const hasAllBranchScope = (user) =>
  String(user?.role || "").toUpperCase() === "SUPER_ADMIN" ||
  String(user?.dataScope || "BRANCH").toUpperCase() === "ALL";

const getAssignedBranchId = (user) => {
  if (!user?.branch) return null;
  return String(user.branch._id || user.branch);
};

const canAccessBranch = (user, branchId) => {
  if (hasAllBranchScope(user)) return true;
  const assignedBranchId = getAssignedBranchId(user);
  return Boolean(assignedBranchId && assignedBranchId === String(branchId));
};

const normalizeBranchPayload = (body = {}) => ({
  name: String(body.name || "").trim(),
  address: String(body.address || "").trim(),
  phone: String(body.phone || "").trim(),
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/branches
 *
 * All-scope users can view every location; branch-scope users receive only
 * their assigned location. The scope check belongs here, not in the client.
 */
const getBranches = async (req, res) => {
  try {
    const filter = hasAllBranchScope(req.user)
      ? {}
      : { _id: getAssignedBranchId(req.user) || null };

    const branches = await Branch.find(filter)
      .select("_id name address phone isActive createdAt updatedAt")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: branches.length,
      branches,
    });
  } catch (error) {
    console.error("Get branches error:", error);
    return sendError(res, 500, "Failed to fetch branches");
  }
};

/** Public directory for the enquiry form. */
const getPublicBranches = async (_req, res) => {
  try {
    const branches = await Branch.find({ isActive: true })
      .select("_id name address phone isActive")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: branches.length,
      branches,
    });
  } catch (error) {
    console.error("Get public branches error:", error);
    return sendError(res, 500, "Failed to fetch public branches");
  }
};

const getBranchById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidBranchId(id)) {
      return sendError(res, 400, "Invalid branch ID");
    }

    if (!canAccessBranch(req.user, id)) {
      return sendError(res, 403, "You do not have access to this branch");
    }

    const branch = await Branch.findById(id).lean();

    if (!branch) return sendError(res, 404, "Branch not found");

    return res.status(200).json({ success: true, branch });
  } catch (error) {
    console.error("Get branch error:", error);
    return sendError(res, 500, "Failed to fetch branch");
  }
};

/** Creating a new location is an academy-wide operation. */
const createBranch = async (req, res) => {
  try {
    if (!hasAllBranchScope(req.user)) {
      return sendError(
        res,
        403,
        "Only an all-branches administrator can create a branch",
      );
    }

    const { name, address, phone } = normalizeBranchPayload(req.body);

    if (!name || !address) {
      return sendError(res, 400, "Branch name and address are required");
    }

    const normalizedPhone = phone ? normalizePhone(phone) : "";
    if (phone && !normalizedPhone) return sendError(res, 400, "Enter a valid phone number with its country code.");

    const existingBranch = await Branch.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });

    if (existingBranch) {
      return sendError(res, 409, "A branch with this name already exists");
    }

    const branch = await Branch.create({ name, address, phone: normalizedPhone, isActive: true });
    await auditService.record({ req, action: AUDIT_ACTIONS.BRANCH_CREATED, entityType: "BRANCH", entityId: branch._id, branchId: branch._id, after: { name, address, isActive: true } });

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      branch,
    });
  } catch (error) {
    console.error("Create branch error:", error);
    return sendError(res, 500, "Failed to create branch");
  }
};

const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidBranchId(id)) {
      return sendError(res, 400, "Invalid branch ID");
    }

    if (!canAccessBranch(req.user, id)) {
      return sendError(res, 403, "You do not have access to this branch");
    }

    const branch = await Branch.findById(id);
    if (!branch) return sendError(res, 404, "Branch not found");
    const before = { name: branch.name, address: branch.address, isActive: branch.isActive };

    const { name, address, phone } = normalizeBranchPayload(req.body);

    if (!name || !address) {
      return sendError(res, 400, "Branch name and address are required");
    }

    const normalizedPhone = phone ? normalizePhone(phone) : "";
    if (phone && !normalizedPhone) return sendError(res, 400, "Enter a valid phone number with its country code.");

    const duplicate = await Branch.findOne({
      _id: { $ne: id },
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });

    if (duplicate) {
      return sendError(res, 409, "A branch with this name already exists");
    }

    branch.name = name;
    branch.address = address;
    branch.phone = normalizedPhone;

    if (hasAllBranchScope(req.user) && typeof req.body.isActive === "boolean") {
      branch.isActive = req.body.isActive;
    }

    await branch.save();
    const after = { name: branch.name, address: branch.address, isActive: branch.isActive };
    await auditService.record({ req, action: branch.isActive === false && before.isActive !== false ? AUDIT_ACTIONS.BRANCH_DEACTIVATED : AUDIT_ACTIONS.BRANCH_UPDATED, entityType: "BRANCH", entityId: branch._id, branchId: branch._id, before, after });

    return res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      branch,
    });
  } catch (error) {
    console.error("Update branch error:", error);
    return sendError(res, 500, "Failed to update branch");
  }
};

module.exports = {
  getBranches,
  getPublicBranches,
  getBranchById,
  createBranch,
  updateBranch,
};

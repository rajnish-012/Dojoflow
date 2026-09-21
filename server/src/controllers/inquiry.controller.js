const mongoose = require("mongoose");

const Inquiry = require("../models/Inquiry");
const Branch = require("../models/Branch");
const { isBranchScoped } = require("../utils/access");

// Create a new inquiry (public form)
const createInquiry = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      age,
      currentBelt,
      experience,
      preferredBatch,
      preferredBranch,
      branch,
      message,
    } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        message: "Full name, email and phone are required.",
      });
    }

    // The visitor picks a branch from the list.
    // Save the real branch id so staff of other branches
    // never see this inquiry.
    let branchId = null;
    let branchName = preferredBranch;

    if (branch) {
      if (!mongoose.isValidObjectId(branch)) {
        return res.status(400).json({
          message: "Selected branch is not available.",
        });
      }

      const branchDoc = await Branch.findOne({
        _id: branch,
        isActive: true,
      });

      if (!branchDoc) {
        return res.status(400).json({
          message: "Selected branch is not available.",
        });
      }

      branchId = branchDoc._id;
      branchName = branchDoc.name;
    }

    const inquiry = await Inquiry.create({
      fullName,
      email,
      phone,
      age,
      currentBelt,
      experience,
      preferredBatch,
      preferredBranch: branchName,
      branch: branchId,
      message,
    });

    return res.status(201).json({
      message: "Your enquiry has been submitted successfully.",
      inquiry,
    });
  } catch (error) {
    console.error("Create inquiry error:", error);

    return res.status(500).json({
      message: "Unable to submit enquiry.",
    });
  }
};

// Get inquiries
// Branch-only roles see only the inquiries of their own branch.
const getInquiries = async (req, res) => {
  try {
    const filter = {};

    if (isBranchScoped(req.user)) {
      if (!req.user.branch) {
        return res.status(403).json({
          message: "No branch is assigned to this account",
        });
      }

      filter.branch = req.user.branch;
    }

    const inquiries = await Inquiry.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      inquiries,
    });
  } catch (error) {
    console.error("Get inquiries error:", error);

    return res.status(500).json({
      message: "Unable to fetch enquiries.",
    });
  }
};

// Update inquiry status
const updateInquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "NEW",
      "CONTACTED",
      "ENROLLED",
      "CLOSED",
    ];

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid inquiry id.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid inquiry status.",
      });
    }

    const inquiry = await Inquiry.findById(id);

    if (!inquiry) {
      return res.status(404).json({
        message: "Inquiry not found.",
      });
    }

    // Branch-only roles can only change their own branch's inquiries.
    if (
      isBranchScoped(req.user) &&
      inquiry.branch?.toString() !== req.user.branch?.toString()
    ) {
      return res.status(403).json({
        message: "You do not have access to this inquiry.",
      });
    }

    inquiry.status = status;

    await inquiry.save();

    return res.status(200).json({
      message: "Inquiry status updated successfully.",
      inquiry,
    });
  } catch (error) {
    console.error("Update inquiry status error:", error);

    return res.status(500).json({
      message: "Unable to update inquiry status.",
    });
  }
};

module.exports = {
  createInquiry,
  getInquiries,
  updateInquiryStatus,
};
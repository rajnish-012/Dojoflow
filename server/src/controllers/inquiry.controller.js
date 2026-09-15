const Inquiry = require("../models/Inquiry");

// Create a new inquiry
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
      message,
    } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        message: "Full name, email and phone are required.",
      });
    }

    const inquiry = await Inquiry.create({
      fullName,
      email,
      phone,
      age,
      currentBelt,
      experience,
      preferredBatch,
      preferredBranch,
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

// Get all inquiries
const getInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({
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

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid inquiry status.",
      });
    }

    const inquiry = await Inquiry.findByIdAndUpdate(
      id,
      { status },
      {
        returnDocument : "after",
        runValidators: true,
      }
    );

    if (!inquiry) {
      return res.status(404).json({
        message: "Inquiry not found.",
      });
    }

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
const mongoose = require("mongoose");

const Inquiry = require("../models/Inquiry");
const Branch = require("../models/Branch");
const Plan = require("../models/Plan");
const TrainingSessionType = require("../models/TrainingSessionType");
const { isBranchScoped } = require("../utils/access");
const { isValidPhoneNumber } = require("libphonenumber-js");
const { normalizePhone } = require("../utils/phone");
const { getBranchDateAvailability, getBranchSchedule, formatDate, validateDate, DAY_NAMES } = require("../services/branchSchedule.service");
const { sendInquiryNotification } = require("../services/inquiryEmail.service");
const { safelyNotify } = require("../services/notification.service");

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
      program,
      programs,
      plan,
      preferredDate,
      preferredSession,
      preferredWeeklySessions,
    } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        message: "Full name, email and phone are required.",
      });
    }

    const cleanName = String(fullName).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(phone).trim();
    if (cleanName.length < 2 || cleanName.length > 120) {
      return res.status(400).json({ message: "Enter a valid full name." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (cleanEmail.length > 320 || cleanPhone.length > 30) {
      return res.status(400).json({ message: "Contact information is too long." });
    }
    if (typeof message === "string" && message.length > 2000) {
      return res.status(400).json({ message: "Message must be 2000 characters or fewer." });
    }
    if (!isValidPhoneNumber(cleanPhone)) {
      return res.status(400).json({ message: "Enter a valid phone number with its country code." });
    }
    const canonicalPhone = normalizePhone(cleanPhone) || cleanPhone;

    const recentDuplicate = await Inquiry.exists({
      email: cleanEmail,
      phone: canonicalPhone,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });
    if (recentDuplicate) {
      return res.status(202).json({ message: "Your enquiry has been received." });
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

    let planDoc = null;
    let programDoc = null;
    let savedSession = null;
    let savedWeeklySessions = [];
    let savedPrograms = [];
    const requestedProgramIds = Array.isArray(programs)
      ? programs.map((item) => String(item || ""))
      : program ? [String(program)] : [];
    const hasNewSelection = Boolean(plan || requestedProgramIds.length || preferredDate || preferredSession || Array.isArray(preferredWeeklySessions));
    if (hasNewSelection) {
      if (!mongoose.isValidObjectId(plan) || !requestedProgramIds.length || requestedProgramIds.some((id) => !mongoose.isValidObjectId(id)) || new Set(requestedProgramIds).size !== requestedProgramIds.length) {
        return res.status(400).json({ message: "Select an available program and plan." });
      }
      planDoc = await Plan.findOne({ _id: plan, isActive: true }).populate("programs.program", "name isActive");
      if (!planDoc) return res.status(400).json({ message: "The selected plan is no longer available." });
      const includedProgramIds = (planDoc.programs || [])
        .filter((item) => item.program && item.program.isActive !== false)
        .map((item) => String(item.program._id || item.program));
      if (requestedProgramIds.some((id) => !includedProgramIds.includes(id))) {
        return res.status(400).json({ message: "Every selected program must be included in this plan." });
      }
      savedPrograms = await TrainingSessionType.find({ _id: { $in: requestedProgramIds }, isActive: true }).select("name");
      if (savedPrograms.length !== requestedProgramIds.length) return res.status(400).json({ message: "One or more selected programs are no longer available." });
      savedPrograms = requestedProgramIds.map((id) => {
        const record = savedPrograms.find((item) => String(item._id) === id);
        return { program: record._id, name: record.name };
      });
      programDoc = await TrainingSessionType.findById(requestedProgramIds[0]).select("name");

      if (Array.isArray(preferredWeeklySessions)) {
        const requiredCount = Number(planDoc.classesPerWeek);
        if (!branchId || !Number.isInteger(requiredCount) || preferredWeeklySessions.length !== requiredCount) {
          return res.status(400).json({ message: `Choose a branch and exactly ${requiredCount} weekly sessions for this plan.` });
        }
        const chosenDays = new Set();
        const programCounts = new Map();
        const programWeeklyLimits = new Map((planDoc.programs || []).map((item) => [String(item.program?._id || item.program), item.weeklyLimit == null ? null : Number(item.weeklyLimit)]));
        const weeklySchedule = await getBranchSchedule(branchId);
        if (!weeklySchedule) return res.status(400).json({ message: "This branch has no active weekly schedule to select from." });
        for (const selected of preferredWeeklySessions) {
          const dayOfWeek = Number(selected?.dayOfWeek);
          const sessionTypeId = String(selected?.sessionTypeId || "");
          if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || chosenDays.has(dayOfWeek)) {
            return res.status(400).json({ message: "Select one session on each of the required number of different days." });
          }
          if (!mongoose.isValidObjectId(sessionTypeId) || !includedProgramIds.includes(sessionTypeId)) {
            return res.status(400).json({ message: "Every selected weekly session must belong to a program in the plan." });
          }
          const day = (weeklySchedule.weeklySchedule || []).find((item) => Number(item.dayOfWeek) === dayOfWeek);
          const slot = !day || day.isClosed ? null : (day.slots || []).find((item) =>
            item && item.isActive !== false && String(item.sessionTypeId || "") === sessionTypeId &&
            String(item.startTime) === String(selected.startTime || "") &&
            String(item.endTime) === String(selected.endTime || "") &&
            String(item.sessionName || "Training Session") === String(selected.sessionName || "Training Session"),
          );
          if (!slot) return res.status(400).json({ message: `${DAY_NAMES[dayOfWeek]} session is no longer in this branch's weekly schedule. Refresh and choose again.` });
          const type = await TrainingSessionType.findOne({ _id: sessionTypeId, isActive: true }).select("name");
          if (!type) return res.status(400).json({ message: "A selected session program is no longer active." });
          const nextProgramCount = (programCounts.get(sessionTypeId) || 0) + 1;
          const programLimit = programWeeklyLimits.get(sessionTypeId);
          if (programLimit != null && nextProgramCount > programLimit) {
            return res.status(400).json({ message: `${type.name} exceeds this plan's weekly class limit.` });
          }
          programCounts.set(sessionTypeId, nextProgramCount);
          chosenDays.add(dayOfWeek);
          savedWeeklySessions.push({
            dayOfWeek,
            dayName: DAY_NAMES[dayOfWeek],
            sessionName: slot.sessionName || "Training Session",
            sessionTypeId: type._id,
            sessionTypeName: type.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
          });
        }
      }

      if (preferredDate || preferredSession) {
        if (!branchId) return res.status(400).json({ message: "Choose a branch before selecting a schedule preference." });
        if (!preferredDate || !validateDate(String(preferredDate))) {
          return res.status(400).json({ message: "The preferred date must be a valid calendar date." });
        }
        if (String(preferredDate) < formatDate(new Date())) {
          return res.status(400).json({ message: "The preferred date cannot be in the past." });
        }
        const availability = await getBranchDateAvailability(branchId, String(preferredDate));
        if (availability.isHoliday || availability.isClosed || !availability.isTrainingDay) {
          return res.status(400).json({ message: "No training is available at this branch on the selected date." });
        }
        const scheduledSlots = (availability.slots || []).filter((slot) =>
          slot && slot.isActive !== false && includedProgramIds.includes(String(slot.sessionTypeId || "")),
        );
        if (preferredSession) {
          const sessionTypeId = String(preferredSession.sessionTypeId || "");
          if (!mongoose.isValidObjectId(sessionTypeId) || !includedProgramIds.includes(sessionTypeId)) {
            return res.status(400).json({ message: "The preferred session is not part of the selected plan." });
          }
          const matchingSlot = scheduledSlots.find((slot) =>
            String(slot.sessionTypeId || "") === sessionTypeId &&
            String(slot.startTime) === String(preferredSession.startTime || "") &&
            String(slot.endTime) === String(preferredSession.endTime || "") &&
            (!preferredSession.sessionName || String(slot.sessionName || "Training Session") === String(preferredSession.sessionName)),
          );
          if (!matchingSlot) return res.status(400).json({ message: "That session is no longer available. Refresh the calendar and choose another." });
          const sessionProgram = await TrainingSessionType.findOne({ _id: sessionTypeId, isActive: true }).select("name");
          if (!sessionProgram) return res.status(400).json({ message: "The selected session program is no longer available." });
          programDoc = sessionProgram;
          savedSession = {
            sessionName: matchingSlot.sessionName || "Training Session",
            sessionTypeId: sessionProgram._id,
            sessionTypeName: sessionProgram.name,
            startTime: matchingSlot.startTime,
            endTime: matchingSlot.endTime,
            dayName: availability.dayName,
          };
        } else if (!scheduledSlots.some((slot) => requestedProgramIds.includes(String(slot.sessionTypeId || "")))) {
          return res.status(400).json({ message: "No session for this plan is available on the selected date." });
        }
      }
    }

    const inquiry = await Inquiry.create({
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      age,
      currentBelt,
      experience,
      preferredBatch,
      preferredBranch: branchName,
      branch: branchId,
      message,
      program: programDoc?._id || null,
      programName: savedPrograms.map((item) => item.name).join(", ") || programDoc?.name || "",
      programs: savedPrograms,
      plan: planDoc?._id || null,
      planName: planDoc?.name || "",
      preferredDate: preferredDate || "",
      preferredSession: savedSession || undefined,
      preferredWeeklySessions: savedWeeklySessions,
      source: "WEBSITE",
      statusHistory: [{ from: null, to: "NEW", note: "Inquiry received" }],
    });

    await safelyNotify({
      type: "INQUIRY_RECEIVED",
      title: "New inquiry received",
      message: `New inquiry received from ${cleanName}.`,
      severity: "INFO",
      branch: branchId,
      entityType: "INQUIRY",
      entityId: inquiry._id,
      eventKey: `inquiry:${inquiry._id}:received`,
      actionUrl: "/inquiries",
    });

    // The inquiry is already saved. A mail provider outage must not make the
    // public form report a failed submission or encourage duplicate retries.
    try {
      await sendInquiryNotification(inquiry);
    } catch {
      console.error("Inquiry was saved but email notification failed.");
    }

    return res.status(201).json({
      success: true,
      message: "Your enquiry has been submitted successfully.",
    });
  } catch (error) {
    console.error("Create inquiry request failed.");

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

    const allowedStatuses = ["NEW", "CONTACTED", "ENROLLED", "CLOSED"];

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

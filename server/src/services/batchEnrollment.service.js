const Batch = require("../models/Batch");
const Student = require("../models/Student");

async function reserveBatchSeat({ batchId, planId, branchId, studentId = null, startDate = null, session }) {
  const batch = await Batch.findOne({ _id: batchId, plan: planId, branch: branchId, status: "ACTIVE" }).session(session);
  if (!batch) {
    const error = new Error("Choose an active Batch for this Plan and Branch.");
    error.status = 400;
    throw error;
  }
  if (!batch.startDate || !batch.calculatedEndDate || batch.capacityIssue) {
    const error = new Error(batch.capacityIssue || "This Batch is not currently eligible for new enrollments. Review its schedule, Curriculum capacity, and calculated completion date.");
    error.status = 409;
    throw error;
  }
  if (startDate) {
    const dateKey = typeof startDate === "string" ? startDate.slice(0, 10) : new Intl.DateTimeFormat("en-CA").format(new Date(startDate));
    // Joining Date is administrative. A student may enroll in advance of a
    // future Batch start; the Batch start still governs eligible Sessions.
    if (dateKey > batch.calculatedEndDate || (batch.effectiveUntil && batch.effectiveUntil < dateKey)) {
      const error = new Error("The selected Batch is not effective on the enrollment start date.");
      error.status = 400;
      throw error;
    }
  }
  // All writers for this Batch touch the same document in their transaction.
  // MongoDB retries transient write conflicts, making the subsequent roster
  // count and enrollment write a serial capacity claim.
  await Batch.updateOne({ _id: batch._id }, { $inc: { capacityRevision: 1 } }, { session });
  const query = { "planEnrollments.batch": batch._id };
  if (studentId) query._id = { $ne: studentId };
  const students = await Student.find(query).select("planEnrollments").session(session).lean();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const occupied = students.reduce((total, student) => total + (student.planEnrollments || []).filter((item) =>
    String(item.batch || "") === String(batch._id) && item.status === "ACTIVE" && (!item.endDate || new Date(item.endDate) >= today),
  ).length, 0);
  if (occupied >= batch.capacity) {
    const error = new Error(`This Batch is full (${occupied}/${batch.capacity}). Choose another available Batch.`);
    error.status = 409;
    error.code = "BATCH_CAPACITY_REACHED";
    throw error;
  }
  return batch;
}

module.exports = { reserveBatchSeat };

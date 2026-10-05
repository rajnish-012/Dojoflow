const Invoice = require("../models/Invoice");
const Student = require("../models/Student");
const { safelyNotify, createNotification } = require("./notification.service");
const { academyDateKey, academyDayStart, isPastDue } = require("../utils/financeDates");

async function refreshFinanceReminders(now = new Date()) {
  const dueSoonEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const todayStart = academyDayStart(now);
  await Invoice.updateMany({ status: { $in: ["ISSUED", "PARTIALLY_PAID", "REFUNDED"] }, balance: { $gt: 0 }, dueDate: { $lt: todayStart } }, { $set: { status: "OVERDUE" } });
  const invoices = await Invoice.find({ status: { $in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE", "REFUNDED"] }, balance: { $gt: 0 }, $or: [{ dueDate: { $gte: todayStart, $lte: dueSoonEnd } }, { dueDate: { $lt: todayStart } }] }).limit(1000).lean();
  for (const invoice of invoices) {
    const overdue = isPastDue(invoice.dueDate, now);
    const dueDate = academyDateKey(invoice.dueDate);
    const amount = Number(invoice.balance).toFixed(2);
    const staffEvent = `finance:${overdue ? "overdue" : "due"}:${invoice._id}:${dueDate}`;
    await safelyNotify({
      type: overdue ? "FINANCE_OVERDUE_REMINDER" : "FINANCE_DUE_REMINDER",
      title: overdue ? "Invoice overdue" : "Invoice due soon",
      message: `${invoice.invoiceNumber} has ${amount} ${invoice.currency} outstanding${overdue ? " and is overdue" : " and is due within 24 hours"}.`,
      severity: overdue ? "WARNING" : "INFO", branch: invoice.branch, student: invoice.student, entityType: "FINANCE", entityId: invoice._id,
      actionUrl: "/fees", eventKey: staffEvent,
    });
    const student = await Student.findById(invoice.student).select("user").lean();
    if (!student?.user) continue;
    await createNotification({
      type: overdue ? "FINANCE_STUDENT_OVERDUE_REMINDER" : "FINANCE_STUDENT_DUE_REMINDER", recipient: student.user,
      title: overdue ? "Invoice payment overdue" : "Invoice payment due soon",
      message: `Invoice ${invoice.invoiceNumber} has ${amount} ${invoice.currency} outstanding${overdue ? " and is overdue" : " and is due within 24 hours"}.`,
      severity: overdue ? "WARNING" : "INFO", branch: invoice.branch, student: invoice.student, entityType: "FINANCE", entityId: invoice._id,
      actionUrl: "/student-dashboard", eventKey: `${staffEvent}:student`,
    }).catch(() => {});
  }
  return invoices.length;
}

module.exports = { refreshFinanceReminders };

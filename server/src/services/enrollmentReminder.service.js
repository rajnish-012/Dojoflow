const Student = require("../models/Student");
const { safelyNotify } = require("./notification.service");
const { sendStudentEmail } = require("./studentEmail.service");
const {
  daysUntil,
  RENEWAL_REMINDERS,
} = require("./enrollmentLifecycle.service");

async function refreshEnrollmentReminders() {
  const students = Student.find({
    "planEnrollments.status": { $in: ["ACTIVE", "EXPIRED"] },
  })
    .select("name branch planEnrollments")
    .populate("branch", "name")
    .cursor();
  const notifications = [];
  let studentCount = 0;
  const today = new Date();
  for await (const student of students) {
    studentCount += 1;
    let changed = false;
    for (const enrollment of student.planEnrollments || []) {
      if (
        enrollment.renewedTo ||
        !enrollment.endDate ||
        !["ACTIVE", "EXPIRED"].includes(enrollment.status)
      )
        continue;
      const remaining = daysUntil(enrollment.endDate, today);
      const becameExpired = remaining < 0 && enrollment.status === "ACTIVE";
      if (becameExpired) {
        enrollment.status = "EXPIRED";
        changed = true;
      }
      if (
        RENEWAL_REMINDERS.includes(remaining) &&
        enrollment.status === "ACTIVE"
      ) {
        notifications.push(
          safelyNotify({
            type: "MEMBERSHIP_EXPIRING",
            title: "Membership expiring",
            message: `${student.name}'s membership expires in ${remaining} day${remaining === 1 ? "" : "s"}.`,
            severity: "WARNING",
            branch: student.branch?._id || student.branch,
            student: student._id,
            entityType: "MEMBERSHIP",
            entityId: enrollment._id,
            actionUrl: "/memberships",
            eventKey: `membership:${enrollment._id}:expiring:${remaining}`,
          }),
        );
        notifications.push(sendStudentEmail({ studentId: student._id, eventKey: `membership:${enrollment._id}:expiring:${remaining}`, category: "MEMBERSHIP_EXPIRING", subject: "Your membership is expiring soon", text: [`Your membership expires in ${remaining} day${remaining === 1 ? "" : "s"}.`, "", "Please contact the academy to discuss renewal options."].join("\n") }).catch(() => {}));
      } else if (remaining < 0 && enrollment.status === "EXPIRED") {
        notifications.push(
          safelyNotify({
            type: "MEMBERSHIP_EXPIRED",
            title: "Membership expired",
            message: `${student.name}'s membership has expired.`,
            severity: "WARNING",
            branch: student.branch?._id || student.branch,
            student: student._id,
            entityType: "MEMBERSHIP",
            entityId: enrollment._id,
            actionUrl: "/memberships",
            eventKey: `membership:${enrollment._id}:expired`,
          }),
        );
        notifications.push(sendStudentEmail({ studentId: student._id, eventKey: `membership:${enrollment._id}:expired`, category: "MEMBERSHIP_EXPIRED", subject: "Your membership has expired", text: ["Your membership has expired.", "", "Please contact the academy to renew your membership."].join("\n") }).catch(() => {}));
      }
    }
    if (changed) await student.save();
  }
  await Promise.all(notifications);
  return { students: studentCount, notifications: notifications.length };
}

module.exports = { refreshEnrollmentReminders };

const Student = require("../models/Student");
const { loadCalendarEvents, dayKey } = require("../services/calendar.service");

function defaultRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: dayKey(start), end: dayKey(end) };
}

async function getCalendar(req, res) {
  try {
    const range = defaultRange();
    const data = await loadCalendarEvents({
      user: req.user,
      start: String(req.query.start || range.start),
      end: String(req.query.end || range.end),
      filters: {
        branch: req.query.branch ? String(req.query.branch) : "",
        types: req.query.types ? String(req.query.types) : "",
        program: req.query.program ? String(req.query.program) : "",
        coach: req.query.coach ? String(req.query.coach) : "",
      },
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load academy calendar.";
    const status = /access|assigned/i.test(message) ? 403 : /invalid|limited|dates/i.test(message) ? 400 : 500;
    return res.status(status).json({ success: false, message });
  }
}

async function getMyCalendar(req, res) {
  try {
    const student = await Student.findOne({ user: req.user._id, status: "ACTIVE" })
      .select("_id branch planEnrollments")
      .lean();
    if (!student) return res.status(404).json({ success: false, message: "Active student profile not found." });
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 45);
    const data = await loadCalendarEvents({
      user: req.user,
      student,
      start: String(req.query.start || dayKey(today)),
      end: String(req.query.end || dayKey(end)),
      filters: { types: req.query.types ? String(req.query.types) : "" },
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load your upcoming calendar." });
  }
}

module.exports = { getCalendar, getMyCalendar };

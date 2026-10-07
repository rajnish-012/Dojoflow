/* =========================================================
   ENVIRONMENT — must be first, before any other require
   so that route files that read process.env at load
   time receive the correct values.
========================================================= */

const dotenv = require("dotenv");
dotenv.config();
const { validateServerEnv } = require("./src/config/env");
let serverEnv;
try {
  serverEnv = validateServerEnv();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./src/config/db");
const mongoose = require("mongoose");

/* =========================================================
   ROUTES
========================================================= */

const authRoutes = require("./src/routes/auth.routes");
const studentRoutes = require("./src/routes/student.routes");
const planRoutes = require("./src/routes/plan.routes");
const attendanceRoutes = require("./src/routes/attendance.routes");
const makeupRoutes = require("./src/routes/makeup.routes");
const performanceRoutes = require("./src/routes/performance.routes");
const progressRoutes = require("./src/routes/progress.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");
const branchRoutes = require("./src/routes/branch.routes");
const userRoutes = require("./src/routes/user.routes");
const inquiryRoutes = require("./src/routes/inquiry.routes");
const moduleRoutes = require("./src/routes/module.routes");
const roleRoutes = require("./src/routes/role.routes");
const promotionRoutes = require("./src/routes/promotion.routes");
const reportsRoutes = require("./src/routes/reports.routes");
const coachAssignmentRoutes = require("./src/routes/coachAssignment.routes");
const holidayRoutes = require("./src/routes/holiday.routes");
const academySettingRoutes = require("./src/routes/academySettings.routes");
const websiteRoutes = require("./src/routes/website.routes");
const publicWebsiteRoutes = require("./src/routes/publicWebsite.routes");
const maintenanceRoutes = require("./src/routes/maintenance.routes");
const notificationRoutes = require("./src/routes/notification.routes");
const financeRoutes = require("./src/routes/finance.routes");
const auditLogRoutes = require("./src/routes/auditLog.routes");
const enrollmentRoutes = require("./src/routes/enrollment.routes");
const { refreshFinanceReminders } = require("./src/services/financeReminder.service");
const { refreshEnrollmentReminders } = require("./src/services/enrollmentReminder.service");
const { notifyOverdueFollowUps } = require("./src/controllers/crm.controller");

/*
 * Branch Schedule
 *
 * Handles:
 * - Branch weekly timings
 * - Opening / closing time
 * - Day-wise availability
 * - Session slots
 * - Branch-specific schedules
 */
const branchScheduleRoutes = require(
  "./src/routes/branchSchedule.routes",
);
const trainingSessionTypeRoutes = require("./src/routes/trainingSessionType.routes");

/* =========================================================
   CONFIG / SEEDERS
========================================================= */

const {
  ensureDefaultModules,
} = require("./src/config/defaultModules");

const {
  ensureDefaultRoles,
} = require("./src/config/defaultRoles");

/* =========================================================
   APP
========================================================= */

const app = express();
app.set("trust proxy", serverEnv.proxyHops);
const getClientOrigins = () => serverEnv.clientOrigins;

/* =========================================================
   SECURITY MIDDLEWARE
========================================================= */

/*
 * Helmet sets secure HTTP response headers:
 * X-Frame-Options, X-Content-Type-Options,
 * Strict-Transport-Security, Content-Security-Policy, etc.
 */
app.use(helmet());

/*
 * Rate limiter for the login endpoint.
 * Prevents brute-force password attacks.
 *
 * 10 attempts per 15 minutes per IP.
 *
 * Applies in every environment to protect against credential stuffing.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many login attempts. Please try again in 15 minutes.",
  },
});

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many inquiry attempts. Please try again later." },
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many recovery requests. Please try again later." },
});
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many reset attempts. Please try again later." },
});

/*
 * General API rate limiter.
 * Prevents DoS / scraping attacks.
 *
 * 300 requests per minute per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
});

/* Apply the general limiter to all API routes */
app.use("/api/", apiLimiter);

/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: getClientOrigins(),
    credentials: true,
  }),
);

// Cross-site session cookies require explicit app-origin validation on
// cookie-authenticated unsafe browser requests as an additional CSRF guard.
app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const allowedOrigins = getClientOrigins();
  const hasSessionCookie = (req.headers.cookie || "").split(";").some((part) => part.trim().startsWith("forcestrike_session="));
  if (!req.headers.origin && !hasSessionCookie) return next();
  if (!req.headers.origin) return res.status(403).json({ success: false, message: "Request origin is required" });
  if (!allowedOrigins.includes(req.headers.origin)) {
    return res.status(403).json({ success: false, message: "Request origin is not allowed" });
  }
  return next();
});

/* =========================================================
   BODY PARSING
   10kb limit prevents payload-based DoS attacks.
========================================================= */

app.use(express.json({ limit: "10kb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10kb",
  }),
);

/* =========================================================
   API ROUTES
========================================================= */

/* -------------------------
   Authentication
   Login gets a stricter rate limiter.
------------------------- */

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth/reset-password", resetPasswordLimiter);
app.use("/api/auth", authRoutes);

/* -------------------------
   Students
------------------------- */

app.use("/api/students", studentRoutes);

/* -------------------------
   Plans
------------------------- */

app.use("/api/plans", planRoutes);

/* -------------------------
   Attendance
------------------------- */

app.use("/api/attendance", attendanceRoutes);

/* -------------------------
   Makeup Classes
------------------------- */

app.use("/api/makeups", makeupRoutes);

/* -------------------------
   Performance
------------------------- */

app.use("/api/performance", performanceRoutes);

/* -------------------------
   Maintenance
------------------------- */
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/enrollments", enrollmentRoutes);

/* -------------------------
   Student Progress
------------------------- */

app.use("/api/progress", progressRoutes);

/* -------------------------
   Dashboard
------------------------- */

app.use("/api/dashboard", dashboardRoutes);

/* -------------------------
   Branches
------------------------- */

app.use("/api/branches", branchRoutes);

/* -------------------------
   Users / Staff
------------------------- */

app.use("/api/users", userRoutes);

/* -------------------------
   Inquiries
------------------------- */

app.use("/api/inquiries", (req, res, next) => {
  if (req.method === "POST" && req.path === "/") return inquiryLimiter(req, res, next);
  return next();
}, inquiryRoutes);

/* -------------------------
   Modules
------------------------- */

app.use("/api/modules", moduleRoutes);

/* -------------------------
   Roles
------------------------- */

app.use("/api/roles", roleRoutes);

/* -------------------------
   Promotions
------------------------- */

app.use("/api/promotions", promotionRoutes);

/* -------------------------
   Reports
------------------------- */

app.use("/api/reports", reportsRoutes);

/* -------------------------
   Coach Assignments
------------------------- */

app.use(
  "/api/coach-assignments",
  coachAssignmentRoutes,
);

/* -------------------------
   Holidays
------------------------- */

app.use("/api/holidays", holidayRoutes);

/* -------------------------
   Academy Settings
------------------------- */

app.use(
  "/api/settings",
  academySettingRoutes,
);

/* -------------------------
   Website CMS
------------------------- */

app.use("/api/website", websiteRoutes);

/* -------------------------
   Public Website
------------------------- */

app.use(
  "/api/public/website",
  publicWebsiteRoutes,
);

/* =========================================================
   BRANCH SCHEDULES
========================================================= */

app.use(
  "/api/branch-schedules",
  branchScheduleRoutes,
);
app.use("/api/training-session-types", trainingSessionTypeRoutes);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ success: ready, status: ready ? "ready" : "not_ready" });
});

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Route not found" : `Route not found: ${req.method} ${req.path}`,
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
   In production, never expose raw error.message to clients.
   Log internally, return a generic message.
========================================================= */

app.use((error, req, res, next) => {
  const isProduction =
    process.env.NODE_ENV === "production";

  // Keep operational logs useful without logging credentials, request bodies,
  // database connection strings, or complete error objects.
  console.error("Request failed", {
    method: req.method,
    path: req.path,
    status: Number(error.status) || 500,
    code: typeof error.code === "string" ? error.code : undefined,
    name: typeof error.name === "string" ? error.name : "Error",
  });

  const status = Number(error.status) >= 400 && Number(error.status) < 500 ? Number(error.status) : 500;

  res.status(status).json({
    success: false,
    message: isProduction ? (status < 500 ? "Request could not be processed." : "Internal server error") : error.message || "Internal server error",
  });
});

/* =========================================================
   START SERVER
========================================================= */

const PORT = serverEnv.port;

const startServer = async () => {
  try {
    /*
     * Connect to MongoDB first.
     */
    await connectDB();

    /*
     * Make sure default roles exist.
     */
    await ensureDefaultRoles();

    /*
     * Make sure default modules exist.
     */
    await ensureDefaultModules();

    // Reminder events are event-keyed, so retrying this scheduler cannot spam.
    refreshFinanceReminders().catch((error) => console.error("Finance reminder refresh failed", { name: error?.name || "Error" }));
    refreshEnrollmentReminders().catch((error) => console.error("Membership reminder refresh failed", { name: error?.name || "Error" }));
    notifyOverdueFollowUps().catch((error) => console.error("Lead follow-up reminder refresh failed", { name: error?.name || "Error" }));
    const financeReminderTimer = setInterval(() => {
      refreshFinanceReminders().catch((error) => console.error("Finance reminder refresh failed", { name: error?.name || "Error" }));
    }, 60 * 60 * 1000);
    financeReminderTimer.unref?.();
    const membershipReminderTimer = setInterval(() => {
      refreshEnrollmentReminders().catch((error) => console.error("Membership reminder refresh failed", { name: error?.name || "Error" }));
    }, 60 * 60 * 1000);
    membershipReminderTimer.unref?.();
    const leadFollowUpTimer = setInterval(() => {
      notifyOverdueFollowUps().catch((error) => console.error("Lead follow-up reminder refresh failed", { name: error?.name || "Error" }));
    }, 60 * 60 * 1000);
    leadFollowUpTimer.unref?.();

    /*
     * Start HTTP server only after
     * database initialization succeeds.
     */
    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `ForceStrike server running on port ${PORT}`,
        );

        console.log(
          `Branch Schedule API: /api/branch-schedules`,
        );
      },
    );
  } catch (error) {
    console.error("Failed to start ForceStrike server", { name: error?.name || "Error", code: error?.code });

    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;

/* =========================================================
   ENVIRONMENT — must be first, before any other require
   so that route files that read process.env at load
   time receive the correct values.
========================================================= */

const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./src/config/db");

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
const getClientOrigins = () => (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .map((value) => {
    try { return new URL(value).origin; } catch { return value; }
  });

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
 * Skipped in development so local testing is never blocked.
 * In production this protects against credential stuffing.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  /*
   * Skip rate limiting when running locally.
   * NODE_ENV must be set to "production" in the deployment
   * environment for this limiter to take effect.
   */
  skip: () => process.env.NODE_ENV !== "production",
  message: {
    success: false,
    message:
      "Too many login attempts. Please try again in 15 minutes.",
  },
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
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.headers.origin) return next();
  const allowedOrigins = getClientOrigins();
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

app.use("/api/inquiries", inquiryRoutes);

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
  res.status(200).json({
    success: true,
    message: "DojoFlow API is running",
  });
});

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
   In production, never expose raw error.message to clients.
   Log internally, return a generic message.
========================================================= */

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  const isProduction =
    process.env.NODE_ENV === "production";

  res.status(error.status || 500).json({
    success: false,
    message: isProduction
      ? error.status
        ? error.message
        : "Internal server error"
      : error.message || "Internal server error",
  });
});

/* =========================================================
   START SERVER
========================================================= */

const PORT = process.env.PORT || 5000;

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
    console.error(
      "Failed to start ForceStrike server:",
      error,
    );

    process.exit(1);
  }
};

startServer();

module.exports = app;

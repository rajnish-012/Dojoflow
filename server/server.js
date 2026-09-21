const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./src/config/db");

// Routes
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
const { ensureDefaultModules } = require("./src/config/defaultModules");
const roleRoutes = require("./src/routes/role.routes");
const { ensureDefaultRoles } = require("./src/config/defaultRoles");


// Load environment variables
dotenv.config();

const app = express();

// Connect to MongoDB
connectDB()
  .then(() => ensureDefaultRoles())
  .then(() => ensureDefaultModules());

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/makeups", makeupRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/roles", roleRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DojoFlow API is running",
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
const URL = process.env.MONGO_URI;


app.listen(PORT, "0.0.0.0", () => {
  console.log(`DojoFlow server running on port ${PORT}`);
});
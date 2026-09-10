const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./src/config/db");

const authRoutes = require("./src/routes/auth.routes");
const studentRoutes = require("./src/routes/student.routes");
const planRoutes = require("./src/routes/plan.routes");
const attendanceRoutes = require("./src/routes/attendance.routes");
const performanceRoutes = require("./src/routes/performance.routes");
const progressRoutes = require("./src/routes/progress.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");
const branchRoutes = require("./src/routes/branch.routes");
const userRoutes = require("./src/routes/user.routes");

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DojoFlow API is running",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`DojoFlow server running on port ${PORT}`);
});
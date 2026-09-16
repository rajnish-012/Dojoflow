const express = require("express");

const { login } = require("../controllers/auth.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

// Public login
router.post("/login", login);

// Logged-in user's profile
router.get("/me", protect, (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      branch: req.user.branch,
    },
  });
});

// Super Admin test route
router.get(
  "/admin-test",
  protect,
  authorize("SUPER_ADMIN"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Super Admin access granted",
    });
  }
);

module.exports = router;
const express = require("express");

const {
  register,
  login,
} = require("../controllers/auth.controller");

const protect = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

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
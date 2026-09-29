const express = require("express");

const { login, changePassword } = require("../controllers/auth.controller");

const protect = require("../middleware/auth.middleware");

const router = express.Router();

/* -------------------------
   POST /api/auth/login
   Public — rate-limited at server level
------------------------- */

router.post("/login", login);

/* -------------------------
   GET /api/auth/me
   Returns the authenticated user's profile.
------------------------- */

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

/* -------------------------
   PATCH /api/auth/change-password
   Authenticated users can change their own password.
------------------------- */

router.patch("/change-password", protect, changePassword);

module.exports = router;
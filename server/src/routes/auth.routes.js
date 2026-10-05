const express = require("express");

const { login, changePassword, logout, migrateLegacySession, requestPasswordReset, resetPassword } = require("../controllers/auth.controller");

const protect = require("../middleware/auth.middleware");
const Branch = require("../models/Branch");

const router = express.Router();

/* -------------------------
   POST /api/auth/login
   Public — rate-limited at server level
------------------------- */

router.post("/login", login);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/migrate-legacy-session", migrateLegacySession);
router.post("/logout", logout);

/* -------------------------
   GET /api/auth/me
   Returns the authenticated user's profile.
------------------------- */

router.get("/me", protect, async (req, res) => {
  const branchRecord = req.user.branch
    ? await Branch.findById(req.user.branch).select("name").lean()
    : null;
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      branch: req.user.branch,
      branchName: branchRecord?.name || null,
      dataScope: req.user.dataScope,
      permissions: Array.isArray(req.user.permissions)
        ? req.user.permissions
        : [],
    },
  });
});

/* -------------------------
   PATCH /api/auth/change-password
   Authenticated users can change their own password.
------------------------- */

router.patch("/change-password", protect, changePassword);

module.exports = router;

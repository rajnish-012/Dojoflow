const express = require("express");
const protect = require("../middleware/auth.middleware");
const { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } = require("../controllers/notification.controller");

const router = express.Router();
router.use(protect);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllNotificationsRead);
router.get("/", getNotifications);
router.patch("/:id/read", markNotificationRead);

module.exports = router;

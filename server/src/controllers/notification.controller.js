const mongoose = require("mongoose");
const Notification = require("../models/Notification");

function accessQuery(req) {
  const query = { recipient: req.user._id };
  if (
    String(req.user.role || "").toUpperCase() !== "SUPER_ADMIN" &&
    String(req.user.dataScope || "BRANCH").toUpperCase() !== "ALL"
  ) {
    query.$and = [
      {
        $or: [
          { branch: null },
          ...(req.user.branch ? [{ branch: req.user.branch }] : []),
        ],
      },
      {
        $or: [
          { requiredPermission: null },
          { requiredPermission: { $in: req.user.permissions || [] } },
        ],
      },
    ];
  } else if (String(req.user.role || "").toUpperCase() !== "SUPER_ADMIN") {
    query.requiredPermission = { $in: [null, ...(req.user.permissions || [])] };
  }
  return query;
}

const getNotifications = async (req, res) => {
  try {
    const page = Math.max(
      1,
      Math.min(Number.parseInt(req.query.page, 10) || 1, 100000),
    );
    const limit = Math.max(
      1,
      Math.min(Number.parseInt(req.query.limit, 10) || 20, 50),
    );
    const query = accessQuery(req);
    if (req.query.read === "true") query.read = true;
    else if (req.query.read === "false") query.read = false;
    if (req.query.type) {
      if (!Notification.NOTIFICATION_TYPES.includes(req.query.type))
        return res
          .status(400)
          .json({ success: false, message: "Invalid notification type" });
      query.type = req.query.type;
    }
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .select(
          "type title message severity read readAt branch student entityType entityId actionUrl metadata createdAt",
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...accessQuery(req), read: false }),
    ]);
    // Older inquiry alerts used /inquiries before the CRM route was consolidated
    // at /crm. Normalize on read so already stored notifications remain usable.
    const routedNotifications = notifications.map((notification) =>
      notification.type === "INQUIRY_RECEIVED"
        ? { ...notification, actionUrl: "/crm" }
        : notification,
    );
    return res.json({
      success: true,
      notifications: routedNotifications,
      unreadCount,
      pagination: { page, limit, total, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("List notifications failed", {
      name: error?.name || "Error",
      code: error?.code,
    });
    return res
      .status(500)
      .json({ success: false, message: "Unable to load notifications." });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      ...accessQuery(req),
      read: false,
    });
    return res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error("Count notifications failed", {
      name: error?.name || "Error",
      code: error?.code,
    });
    return res
      .status(500)
      .json({ success: false, message: "Unable to load unread count." });
  }
};

const markNotificationRead = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return res
      .status(400)
      .json({ success: false, message: "Invalid notification ID." });
  try {
    const notification = await Notification.findOneAndUpdate(
      { ...accessQuery(req), _id: req.params.id, read: false },
      { $set: { read: true, readAt: new Date() } },
      { returnDocument: "after" },
    )
      .select("_id read readAt actionUrl")
      .lean();
    if (!notification) {
      const existing = await Notification.exists({
        ...accessQuery(req),
        _id: req.params.id,
      });
      if (!existing)
        return res
          .status(404)
          .json({ success: false, message: "Notification not found." });
      return res.json({
        success: true,
        notification: { _id: req.params.id, read: true, actionUrl: "" },
      });
    }
    return res.json({ success: true, notification });
  } catch (error) {
    console.error("Mark notification read failed", {
      name: error?.name || "Error",
      code: error?.code,
    });
    return res
      .status(500)
      .json({ success: false, message: "Unable to update notification." });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { ...accessQuery(req), read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return res.json({
      success: true,
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    console.error("Mark all notifications read failed", {
      name: error?.name || "Error",
      code: error?.code,
    });
    return res
      .status(500)
      .json({ success: false, message: "Unable to update notifications." });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};

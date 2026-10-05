const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const controller = require("../controllers/finance.controller");

const router = express.Router();
router.use(protect);

router.get("/dashboard", authorizePermission("finance.view"), controller.getFinanceDashboard);
router.get("/reports", authorizePermission("finance.report"), controller.getFinanceReport);
router.get("/plans", authorizePermission("finance.view"), controller.getFeePlans);
router.get("/branches", authorizePermission("finance.view"), controller.getFeeBranches);
router.get("/invoice-candidates", authorizePermission("finance.manage"), controller.getInvoiceCandidates);
router.put("/plans/:planId", authorizePermission("finance.manage"), controller.updateFeePlan);
router.put("/plans/:planId/branch-fees", authorizePermission("finance.manage"), controller.updateBranchFeePlan);
router.get("/invoices", authorizePermission("finance.view"), controller.listInvoices);
router.get("/payments", authorizePermission("finance.view"), controller.listPayments);
router.post("/invoices", authorizePermission("finance.manage"), controller.createInvoice);
router.post("/invoices/:invoiceId/issue", authorizePermission("finance.manage"), controller.issueInvoice);
router.post("/invoices/:invoiceId/cancel", authorizePermission("finance.manage"), controller.cancelInvoice);
router.post("/invoices/:invoiceId/payments", authorizePermission("finance.collect"), controller.addPayment);
router.post("/payments/:paymentId/refund", authorizePermission("finance.refund"), controller.refundPayment);
router.post("/payments/:paymentId/corrections", authorizePermission("finance.manage"), controller.correctPayment);
router.get("/students/:studentId", authorizePermission("finance.view"), controller.getStudentFinancialProfile);
router.get("/me", authorizePermission("student.finance.view"), controller.getMyFinancialProfile);
router.get("/me/invoices", authorizePermission("student.finance.view"), controller.listStudentInvoices);
router.get("/receipts/:receiptId", async (req, res, next) => {
  const permission = req.user?.role === "SUPER_ADMIN" || req.user?.permissions?.some((item) => ["finance.view", "student.finance.view"].includes(item));
  if (!permission) return res.status(403).json({ success: false, message: "You do not have permission to access this receipt" });
  next();
}, controller.getReceipt);

module.exports = router;

const express = require("express");
const protect = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/permission.middleware");
const controller = require("../controllers/inventory.controller");

const router = express.Router();
router.use(protect);
router.get("/dashboard", authorizePermission("inventory.view"), controller.getDashboard);
router.get("/stock", authorizePermission("inventory.view"), controller.listInventory);
router.put("/stock/:productId/:branchId", authorizePermission("inventory.update"), controller.updateStockSettings);
router.get("/products", authorizePermission("inventory.view"), controller.listProducts);
router.post("/products", authorizePermission("inventory.create"), controller.createProduct);
router.put("/products/:productId", authorizePermission("inventory.update"), controller.updateProduct);
router.get("/suppliers", authorizePermission("inventory.view"), controller.listSuppliers);
router.post("/suppliers", authorizePermission("inventory.manage"), controller.createSupplier);
router.put("/suppliers/:supplierId", authorizePermission("inventory.manage"), controller.updateSupplier);
router.get("/movements", authorizePermission("inventory.view"), controller.listMovements);
router.post("/purchases", authorizePermission("inventory.purchase"), controller.recordStockMovement("PURCHASE"));
router.post("/adjustments", authorizePermission("inventory.adjust"), controller.recordStockMovement("ADJUSTMENT"));
router.post("/damage", authorizePermission("inventory.damage"), controller.recordStockMovement("DAMAGE"));
router.get("/transfers", authorizePermission("inventory.view"), controller.listTransfers);
router.post("/transfers", authorizePermission("inventory.transfer"), controller.transferStock);
router.get("/orders", authorizePermission("inventory.view"), controller.listOrders);
router.post("/orders", authorizePermission("inventory.sale"), controller.createOrder);
router.post("/orders/:orderId/cancel", authorizePermission("inventory.sale"), controller.cancelOrder);
router.post("/orders/:orderId/items/:itemId/returns", authorizePermission("inventory.return"), controller.returnOrderItem);
router.get("/reports", authorizePermission("inventory.report"), controller.getReports);

module.exports = router;

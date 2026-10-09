const BranchInventory = require("../models/BranchInventory");
const Branch = require("../models/Branch");
const Product = require("../models/Product");
const InventoryOrder = require("../models/InventoryOrder");
const StockMovement = require("../models/StockMovement");
const auditService = require("./audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const { safelyNotify, resolveRecipients } = require("./notification.service");
const User = require("../models/User");
const { sendEmailToRecipients } = require("./studentEmail.service");

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function stockState(quantity, reservedQuantity, minimumStock) {
  const available = Number(quantity) - Number(reservedQuantity);
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= Number(minimumStock)) return "LOW_STOCK";
  return "NORMAL";
}

async function notifyStockTransition(inventory, movement) {
  if (!movement || inventory.previousStockState === inventory.stockState || inventory.stockState === "NORMAL") return;
  const out = inventory.stockState === "OUT_OF_STOCK";
  await safelyNotify({
    type: out ? "INVENTORY_OUT_OF_STOCK" : "INVENTORY_LOW_STOCK",
    title: out ? "Product out of stock" : "Product stock is low",
    message: `${inventory.productName || "A product"} (${inventory.sku}) at ${inventory.branchName || "your branch"} has ${Math.max(0, inventory.quantity - inventory.reservedQuantity)} available.`,
    severity: out ? "ERROR" : "WARNING",
    branch: inventory.branch,
    entityType: "INVENTORY",
    entityId: inventory._id,
    actionUrl: "/inventory?tab=products",
    eventKey: `inventory:${inventory._id}:${inventory.stockState}:${movement._id}`,
  });
  try {
    const recipients = await resolveRecipients({ permission: "inventory.manage", branch: inventory.branch });
    const users = recipients.length ? await User.find({ _id: { $in: recipients } }).select("email").lean() : [];
    await sendEmailToRecipients({
      recipients: users.map((user) => user.email),
      eventKey: `inventory:${inventory._id}:${inventory.stockState}:${movement._id}`,
      category: out ? "INVENTORY_OUT_OF_STOCK" : "INVENTORY_LOW_STOCK",
      subject: out ? "Inventory item is out of stock" : "Inventory stock is low",
      text: [`${inventory.productName || "A product"} (${inventory.sku}) at ${inventory.branchName || "your branch"} has ${Math.max(0, inventory.quantity - inventory.reservedQuantity)} available.`, "", "Open Inventory to review stock and replenish if needed."].join("\n"),
    });
  } catch (error) {
    console.error("Inventory threshold email could not be sent:", error.message);
  }
}

async function sendInventoryTransferEmail({ branch, transferId, productName, quantity }) {
  const recipients = await resolveRecipients({ permission: "inventory.manage", branch });
  const users = recipients.length ? await User.find({ _id: { $in: recipients } }).select("email").lean() : [];
  return sendEmailToRecipients({ recipients: users.map((user) => user.email), eventKey: `inventory:transfer:${transferId}`, category: "INVENTORY_TRANSFER_COMPLETED", subject: "Inventory transfer received", text: [`${quantity} ${productName} has been transferred to your branch.`, "", "Open Inventory to review the transfer."].join("\n") });
}

async function publishStockTransitions(transitions = []) {
  for (const transition of transitions) {
    const [product, branch] = transition.context ? [null, null] : await Promise.all([
      Product.findById(transition.inventory.product).select("name sku").lean(),
      Branch.findById(transition.inventory.branch).select("name").lean(),
    ]);
    await notifyStockTransition({ ...transition.inventory.toObject(), ...(transition.context || {}), productName: transition.context?.productName || product?.name, sku: transition.context?.sku || product?.sku, branchName: transition.context?.branchName || branch?.name, previousStockState: transition.previousStockState }, transition.movement);
  }
}

async function createStockMovement(values, session) {
  const [movement] = await StockMovement.create([values], { session });
  return movement;
}

async function auditInventory(req, session, values) {
  return auditService.record({
    req,
    session,
    action: values.action || AUDIT_ACTIONS.INVENTORY_STOCK_MOVED,
    entityType: values.entityType || "INVENTORY",
    entityId: values.entityId || values.product || null,
    branchId: values.branch || null,
    before: values.before,
    after: values.after,
    metadata: values.metadata || {},
    legacy: { reason: values.reason || "" },
  });
}

async function completeOrderForInvoice({ invoice, payment, req, session }) {
  const order = await InventoryOrder.findOne({ invoice: invoice._id }).session(session);
  if (!order || order.status !== "PAYMENT_PENDING") return { order: null, transitions: [] };
  const transitions = [];
  for (const item of order.items) {
    const inventory = await BranchInventory.findOne({ product: item.product, branch: order.branch }).session(session);
    if (!inventory || inventory.quantity < item.quantity || inventory.reservedQuantity < item.quantity) {
      const error = new Error(`Reserved stock is unavailable for ${item.name}`);
      error.status = 409;
      throw error;
    }
    const oldState = inventory.stockState;
    const previousQuantity = inventory.quantity;
    const previousReserved = inventory.reservedQuantity;
    inventory.quantity -= item.quantity;
    inventory.reservedQuantity -= item.quantity;
    inventory.stockState = stockState(inventory.quantity, inventory.reservedQuantity, inventory.minimumStock);
    inventory.updatedBy = req.user._id;
    await inventory.save({ session });
    const movement = await createStockMovement({
      product: item.product, sku: item.sku, branch: order.branch, type: "SALE", quantity: item.quantity, quantityDelta: -item.quantity,
      previousQuantity, newQuantity: inventory.quantity, previousReserved, newReserved: inventory.reservedQuantity, unitPrice: item.unitPrice, amount: item.amount,
      reference: order.orderNumber, relatedOrder: order._id, relatedPayment: payment._id,
      reason: `Paid merchandise order ${order.orderNumber}`, idempotencyKey: `order-sale:${order._id}:${item._id}`, performedBy: req.user._id,
    }, session);
    transitions.push({ inventory, movement, previousStockState: oldState });
  }
  order.status = "PAID";
  order.paymentStatus = "PAID";
  await order.save({ session });
  await auditInventory(req, session, { action: AUDIT_ACTIONS.INVENTORY_ORDER_PAID, entityId: order._id, branch: order.branch, before: { status: "PAYMENT_PENDING", paymentStatus: "PENDING" }, after: { status: order.status, paymentStatus: order.paymentStatus, paymentId: payment._id } });
  return { order, transitions };
}

async function releaseOrderReservation({ order, req, session, reason }) {
  if (!order || order.status !== "PAYMENT_PENDING") return [];
  const transitions = [];
  for (const item of order.items) {
    const inventory = await BranchInventory.findOne({ product: item.product, branch: order.branch }).session(session);
    if (!inventory || inventory.reservedQuantity < item.quantity) {
      const error = new Error(`Reserved stock is inconsistent for ${item.name}`);
      error.status = 409;
      throw error;
    }
    const oldState = inventory.stockState;
    const previousReserved = inventory.reservedQuantity;
    inventory.reservedQuantity -= item.quantity;
    inventory.stockState = stockState(inventory.quantity, inventory.reservedQuantity, inventory.minimumStock);
    inventory.updatedBy = req.user._id;
    await inventory.save({ session });
    const movement = await createStockMovement({
      product: item.product, sku: item.sku, branch: order.branch, type: "RELEASE", quantity: item.quantity, quantityDelta: 0,
      previousQuantity: inventory.quantity, newQuantity: inventory.quantity, previousReserved, newReserved: inventory.reservedQuantity,
      reference: order.orderNumber, relatedOrder: order._id, reason, idempotencyKey: `order-release:${order._id}:${item._id}`,
      performedBy: req.user._id,
    }, session);
    transitions.push({ inventory, movement, previousStockState: oldState });
  }
  order.status = "CANCELLED";
  order.paymentStatus = "CANCELLED";
  await order.save({ session });
  await auditInventory(req, session, { action: AUDIT_ACTIONS.INVENTORY_ORDER_CANCELLED, entityId: order._id, branch: order.branch, reason, before: { status: "PAYMENT_PENDING" }, after: { status: "CANCELLED" } });
  return transitions;
}

module.exports = { round, stockState, createStockMovement, auditInventory, notifyStockTransition, publishStockTransitions, completeOrderForInvoice, releaseOrderReservation, sendInventoryTransferEmail };

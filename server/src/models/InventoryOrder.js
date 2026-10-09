const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, trim: true, uppercase: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  returnedQuantity: { type: Number, min: 0, default: 0 },
}, { _id: true });

const inventoryOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, trim: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  items: { type: [orderItemSchema], required: true, validate: (items) => items.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR", uppercase: true, trim: true, maxlength: 3 },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
  status: { type: String, enum: ["PAYMENT_PENDING", "PAID", "CANCELLED", "REFUNDED", "PARTIALLY_RETURNED", "RETURNED"], default: "PAYMENT_PENDING", required: true, index: true },
  paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"], default: "PENDING", required: true },
  fulfillment: { type: String, enum: ["PICKUP", "DELIVERY"], default: "PICKUP", required: true },
  fulfillmentNotes: { type: String, trim: true, maxlength: 500, default: "" },
  idempotencyKey: { type: String, trim: true, maxlength: 120, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

inventoryOrderSchema.index({ idempotencyKey: 1 }, { unique: true, name: "uniq_inventory_order_idempotency" });
inventoryOrderSchema.index({ branch: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryOrder", inventoryOrderSchema);

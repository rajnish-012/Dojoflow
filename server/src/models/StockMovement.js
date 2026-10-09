const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  sku: { type: String, required: true, trim: true, uppercase: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  type: { type: String, enum: ["PURCHASE", "SALE", "ADJUSTMENT", "TRANSFER", "RETURN", "DAMAGE", "RESERVATION", "RELEASE"], required: true },
  quantity: { type: Number, required: true, min: 1 },
  quantityDelta: { type: Number, required: true },
  unitPrice: { type: Number, min: 0, default: null },
  amount: { type: Number, min: 0, default: null },
  previousQuantity: { type: Number, required: true, min: 0 },
  newQuantity: { type: Number, required: true, min: 0 },
  previousReserved: { type: Number, default: 0, min: 0 },
  newReserved: { type: Number, default: 0, min: 0 },
  reference: { type: String, trim: true, maxlength: 120, default: "" },
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryOrder", default: null, index: true },
  relatedPayment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
  relatedMovement: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null },
  transferId: { type: String, trim: true, maxlength: 100, default: "", index: true },
  sourceBranch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
  destinationBranch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
  reason: { type: String, trim: true, maxlength: 500, required: true },
  idempotencyKey: { type: String, trim: true, maxlength: 140, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  occurredAt: { type: Date, required: true, default: Date.now },
}, { timestamps: { createdAt: true, updatedAt: false } });

stockMovementSchema.index({ idempotencyKey: 1 }, { unique: true, name: "uniq_stock_movement_idempotency" });
stockMovementSchema.index({ product: 1, occurredAt: -1 });
stockMovementSchema.index({ branch: 1, occurredAt: -1 });
stockMovementSchema.index({ type: 1, occurredAt: -1 });
const rejectMutation = function rejectStockMovementMutation() { throw new Error("Stock movement history is immutable."); };
stockMovementSchema.pre("save", function immutableMovement() { if (!this.isNew) rejectMutation(); });
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete", "bulkWrite"]) stockMovementSchema.pre(op, rejectMutation);

module.exports = mongoose.model("StockMovement", stockMovementSchema);

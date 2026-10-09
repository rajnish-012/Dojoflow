const mongoose = require("mongoose");

const branchInventorySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  quantity: { type: Number, required: true, default: 0, min: 0 },
  reservedQuantity: { type: Number, required: true, default: 0, min: 0 },
  minimumStock: { type: Number, required: true, default: 0, min: 0 },
  purchasePrice: { type: Number, required: true, default: 0, min: 0 },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
  stockState: { type: String, enum: ["NORMAL", "LOW_STOCK", "OUT_OF_STOCK"], default: "NORMAL", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

branchInventorySchema.index({ product: 1, branch: 1 }, { unique: true, name: "uniq_inventory_product_branch" });
branchInventorySchema.index({ branch: 1, stockState: 1, updatedAt: -1 });

module.exports = mongoose.model("BranchInventory", branchInventorySchema);

const mongoose = require("mongoose");

const PRODUCT_CATEGORIES = Object.freeze(["UNIFORM", "GLOVES", "BELTS", "EQUIPMENT", "MERCHANDISE", "OTHER"]);
const PRODUCT_STATUSES = Object.freeze(["ACTIVE", "INACTIVE", "DISCONTINUED"]);

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
  category: { type: String, enum: PRODUCT_CATEGORIES, required: true, default: "OTHER" },
  description: { type: String, trim: true, maxlength: 3000, default: "" },
  imageUrl: { type: String, trim: true, maxlength: 1000, default: "" },
  sellingPrice: { type: Number, required: true, min: 0 },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
  status: { type: String, enum: PRODUCT_STATUSES, default: "ACTIVE", required: true },
  isPublished: { type: Boolean, default: false, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

productSchema.index({ sku: 1 }, { unique: true, name: "uniq_product_sku" });
productSchema.index({ category: 1, status: 1, name: 1 });
productSchema.index({ isPublished: 1, status: 1, name: 1 });

module.exports = mongoose.model("Product", productSchema);
module.exports.PRODUCT_CATEGORIES = PRODUCT_CATEGORIES;
module.exports.PRODUCT_STATUSES = PRODUCT_STATUSES;

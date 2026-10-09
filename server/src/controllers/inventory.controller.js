const mongoose = require("mongoose");
const crypto = require("crypto");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const Branch = require("../models/Branch");
const Student = require("../models/Student");
const Invoice = require("../models/Invoice");
const AcademySettings = require("../models/AcademySettings");
const FinanceSequence = require("../models/FinanceSequence");
const BranchInventory = require("../models/BranchInventory");
const StockMovement = require("../models/StockMovement");
const InventoryOrder = require("../models/InventoryOrder");
const auditService = require("../services/audit.service");
const { AUDIT_ACTIONS } = require("../config/auditActions");
const { isBranchScoped } = require("../utils/access");
const { round, stockState, createStockMovement, auditInventory, publishStockTransitions, releaseOrderReservation, sendInventoryTransferEmail } = require("../services/inventory.service");
const { safelyNotify } = require("../services/notification.service");
const { PRODUCT_CATEGORIES, PRODUCT_STATUSES } = require("../models/Product");

const isId = (value) => mongoose.Types.ObjectId.isValid(value);
const branchIdFor = (user) => user?.branch?._id || user?.branch || null;
const hasAllScope = (user) => !isBranchScoped(user);
const inBranchScope = (user, branchId) => hasAllScope(user) || String(branchIdFor(user) || "") === String(branchId || "");
const errorResponse = (res, error, fallback) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (error.code === 11000) return res.status(409).json({ success: false, message: "A record with that SKU, reference, or idempotency key already exists" });
  if (error.name === "ValidationError") return res.status(400).json({ success: false, message: "Inventory data is invalid" });
  console.error(fallback, { name: error.name, code: error.code, message: error.message });
  return res.status(500).json({ success: false, message: fallback });
};
const withTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let output;
    await session.withTransaction(async () => { output = await work(session); });
    return output;
  } catch (error) {
    if (error.code === 20 || /transaction numbers are only allowed on a replica set member or mongos/i.test(error.message || "")) {
      error.status = 503;
      error.message = "Inventory writes require MongoDB running as a replica set or mongos.";
    }
    throw error;
  } finally { await session.endSession(); }
};
const requireId = (value) => isId(value) ? new mongoose.Types.ObjectId(value) : null;
const validKey = (req) => {
  const key = String(req.get("Idempotency-Key") || req.body?.idempotencyKey || "").trim();
  return /^[A-Za-z0-9._:-]{8,120}$/.test(key) ? key : null;
};
const positiveInt = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const nonNegativeMoney = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 ? round(value) : null;
const validImage = (value) => {
  const image = String(value || "").trim();
  return !image || image.startsWith("/") || /^https:\/\//i.test(image) ? image : null;
};
const validSku = (value) => {
  const sku = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(sku) ? sku : null;
};
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageOptions = (req) => ({ page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(Math.max(Number(req.query.limit) || 50, 1), 200) });
const scopeBranch = (req, requested) => {
  if (isBranchScoped(req.user)) return branchIdFor(req.user) || "000000000000000000000000";
  return requested || null;
};
const setStockState = (inventory) => {
  inventory.stockState = stockState(inventory.quantity, inventory.reservedQuantity, inventory.minimumStock);
};
const ensureInventory = async ({ product, branch, session, purchasePrice = 0, minimumStock = 0, supplier = null }) => {
  let inventory = await BranchInventory.findOne({ product, branch }).session(session);
  if (!inventory) {
    [inventory] = await BranchInventory.create([{ product, branch, purchasePrice, minimumStock, supplier, quantity: 0, reservedQuantity: 0 }], { session });
  }
  return inventory;
};
const getStockContext = async (branchInventory, session) => {
  const [product, branch] = await Promise.all([
    Product.findById(branchInventory.product).select("name sku").session(session).lean(),
    Branch.findById(branchInventory.branch).select("name").session(session).lean(),
  ]);
  return { productName: product?.name || "Product", sku: product?.sku || "", branchName: branch?.name || "Branch" };
};
const notifyTransitions = publishStockTransitions;

const getDashboard = async (req, res) => {
  try {
    const branch = scopeBranch(req, req.query.branch);
    const query = branch ? { branch } : {};
    const [rows, recentMovements, recentSales, branchSummary] = await Promise.all([
      BranchInventory.find(query).populate("product", "name sku category sellingPrice status").populate("branch", "name").lean(),
      StockMovement.find(query).populate("product", "name sku").populate("branch", "name").populate("performedBy", "name").sort({ occurredAt: -1 }).limit(10).lean(),
      StockMovement.find({ ...query, type: "SALE" }).populate("product", "name sku").populate("branch", "name").sort({ occurredAt: -1 }).limit(10).lean(),
      BranchInventory.aggregate([{ $match: branch ? { branch: new mongoose.Types.ObjectId(branch) } : {} }, { $group: { _id: "$branch", products: { $sum: 1 }, units: { $sum: "$quantity" }, value: { $sum: { $multiply: ["$quantity", "$purchasePrice"] } }, lowStock: { $sum: { $cond: [{ $eq: ["$stockState", "LOW_STOCK"] }, 1, 0] } }, outOfStock: { $sum: { $cond: [{ $eq: ["$stockState", "OUT_OF_STOCK"] }, 1, 0] } } } }, { $lookup: { from: "branches", localField: "_id", foreignField: "_id", as: "branch" } }, { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } }, { $project: { branch: "$branch.name", products: 1, units: 1, value: 1, lowStock: 1, outOfStock: 1 } }]),
    ]);
    res.json({ success: true, summary: { totalProducts: new Set(rows.map((row) => String(row.product?._id))).size, totalStockUnits: rows.reduce((sum, row) => sum + row.quantity, 0), totalInventoryValue: round(rows.reduce((sum, row) => sum + row.quantity * row.purchasePrice, 0)), lowStockProducts: rows.filter((row) => row.stockState === "LOW_STOCK").length, outOfStockProducts: rows.filter((row) => row.stockState === "OUT_OF_STOCK").length }, branchSummary, recentMovements, recentSales });
  } catch (error) { errorResponse(res, error, "Failed to load inventory dashboard"); }
};

const listInventory = async (req, res) => {
  try {
    const { page, limit } = pageOptions(req);
    const branch = scopeBranch(req, req.query.branch);
    const query = { ...(branch ? { branch } : {}), ...(req.query.stockState ? { stockState: req.query.stockState } : {}) };
    let productIds;
    const productQuery = {};
    if (req.query.category && PRODUCT_CATEGORIES.includes(String(req.query.category).toUpperCase())) productQuery.category = String(req.query.category).toUpperCase();
    if (req.query.status && PRODUCT_STATUSES.includes(String(req.query.status).toUpperCase())) productQuery.status = String(req.query.status).toUpperCase();
    if (req.query.search) {
      const matcher = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), "i");
      productQuery.$or = [{ name: matcher }, { sku: matcher }];
    }
    if (Object.keys(productQuery).length) {
      productIds = await Product.find(productQuery).distinct("_id");
      query.product = { $in: productIds };
    }
    const [inventory, total] = await Promise.all([
      BranchInventory.find(query).populate("product", "name sku category description imageUrl sellingPrice status isPublished").populate("branch", "name").populate("supplier", "name").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      BranchInventory.countDocuments(query),
    ]);
    res.json({ success: true, inventory, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) { errorResponse(res, error, "Failed to load inventory"); }
};

const updateStockSettings = async (req, res) => {
  const productId = requireId(req.params.productId);
  const branchId = requireId(req.params.branchId);
  if (!productId || !branchId) return res.status(400).json({ success: false, message: "Product and branch IDs are invalid" });
  if (!inBranchScope(req.user, branchId)) return res.status(403).json({ success: false, message: "You can only manage inventory for your assigned branch" });
  const minimumStock = req.body?.minimumStock === undefined ? undefined : Number(req.body.minimumStock);
  const purchasePrice = req.body?.purchasePrice === undefined ? undefined : nonNegativeMoney(req.body.purchasePrice);
  if ((minimumStock !== undefined && (!Number.isSafeInteger(minimumStock) || minimumStock < 0)) || (purchasePrice === null)) return res.status(400).json({ success: false, message: "Minimum stock must be a non-negative whole number and purchase price must be zero or greater" });
  try {
    const result = await withTransaction(async (session) => {
      const inventory = await BranchInventory.findOne({ product: productId, branch: branchId }).session(session);
      if (!inventory) { const error = new Error("Branch inventory record not found; record an initial purchase or adjustment first"); error.status = 404; throw error; }
      const before = { minimumStock: inventory.minimumStock, purchasePrice: inventory.purchasePrice, supplier: inventory.supplier, stockState: inventory.stockState };
      if (minimumStock !== undefined) inventory.minimumStock = minimumStock;
      if (purchasePrice !== undefined) inventory.purchasePrice = purchasePrice;
      if (req.body?.supplier !== undefined) {
        const supplier = req.body.supplier ? requireId(req.body.supplier) : null;
        if (req.body.supplier && (!supplier || !(await Supplier.exists({ _id: supplier, status: "ACTIVE" }).session(session)))) { const error = new Error("Active supplier was not found"); error.status = 400; throw error; }
        inventory.supplier = supplier;
      }
      const previousStockState = inventory.stockState;
      setStockState(inventory);
      inventory.updatedBy = req.user._id;
      await inventory.save({ session });
      await auditInventory(req, session, { action: AUDIT_ACTIONS.INVENTORY_STOCK_SETTINGS_UPDATED, product: productId, entityId: inventory._id, branch: branchId, before, after: { minimumStock: inventory.minimumStock, purchasePrice: inventory.purchasePrice, supplier: inventory.supplier, stockState: inventory.stockState } });
      return { inventory, previousStockState };
    });
    const product = await Product.findById(productId).select("name sku").lean();
    const branch = await Branch.findById(branchId).select("name").lean();
    await notifyTransitions([{ ...result, movement: { _id: result.inventory._id }, context: { productName: product?.name, sku: product?.sku, branchName: branch?.name } }]);
    res.json({ success: true, inventory: result.inventory });
  } catch (error) { errorResponse(res, error, "Failed to update branch inventory settings"); }
};

const listProducts = async (req, res) => {
  try {
    const { page, limit } = pageOptions(req);
    const query = {};
    if (req.query.category && PRODUCT_CATEGORIES.includes(String(req.query.category).toUpperCase())) query.category = String(req.query.category).toUpperCase();
    if (req.query.status && PRODUCT_STATUSES.includes(String(req.query.status).toUpperCase())) query.status = String(req.query.status).toUpperCase();
    if (req.query.search) { const matcher = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), "i"); query.$or = [{ name: matcher }, { sku: matcher }]; }
    const [products, total] = await Promise.all([Product.find(query).populate("supplier", "name").sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(), Product.countDocuments(query)]);
    const branch = scopeBranch(req, req.query.branch);
    const stocks = await BranchInventory.find({ product: { $in: products.map((product) => product._id) }, ...(branch ? { branch } : {}) }).populate("branch", "name").lean();
    const byProduct = new Map();
    for (const stock of stocks) { const key = String(stock.product); byProduct.set(key, [...(byProduct.get(key) || []), stock]); }
    res.json({ success: true, products: products.map((product) => ({ ...product, inventory: byProduct.get(String(product._id)) || [] })), page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) { errorResponse(res, error, "Failed to load products"); }
};

const createProduct = async (req, res) => {
  const sku = validSku(req.body?.sku);
  const sellingPrice = nonNegativeMoney(req.body?.sellingPrice);
  const category = String(req.body?.category || "OTHER").toUpperCase();
  const imageUrl = validImage(req.body?.imageUrl);
  if (!String(req.body?.name || "").trim() || !sku || sellingPrice === null || !PRODUCT_CATEGORIES.includes(category) || imageUrl === null) return res.status(400).json({ success: false, message: "Valid product name, SKU, category, selling price, and HTTPS or local image URL are required" });
  try {
    const supplier = req.body?.supplier ? requireId(req.body.supplier) : null;
    if (req.body?.supplier && !supplier) return res.status(400).json({ success: false, message: "Supplier ID is invalid" });
    if (supplier && !(await Supplier.exists({ _id: supplier, status: "ACTIVE" }))) return res.status(400).json({ success: false, message: "Active supplier was not found" });
    const product = await Product.create({ name: String(req.body.name).trim(), sku, category, description: String(req.body.description || "").trim(), imageUrl, sellingPrice, supplier, status: req.body.status || "ACTIVE", isPublished: req.body.isPublished === true, createdBy: req.user._id });
    await auditService.record({ req, action: AUDIT_ACTIONS.INVENTORY_PRODUCT_CREATED, entityType: "PRODUCT", entityId: product._id, after: { name: product.name, sku: product.sku, category: product.category, sellingPrice: product.sellingPrice, status: product.status } });
    res.status(201).json({ success: true, product });
  } catch (error) { errorResponse(res, error, "Failed to create product"); }
};

const updateProduct = async (req, res) => {
  if (!isId(req.params.productId)) return res.status(400).json({ success: false, message: "Product ID is invalid" });
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (req.body?.sku !== undefined && validSku(req.body.sku) !== product.sku) return res.status(409).json({ success: false, message: "SKU is fixed after product creation; create a new product to replace a SKU" });
    const before = { name: product.name, category: product.category, sellingPrice: product.sellingPrice, supplier: product.supplier, status: product.status, isPublished: product.isPublished };
    for (const key of ["name", "description"]) if (req.body?.[key] !== undefined) product[key] = String(req.body[key]).trim();
    if (req.body?.category !== undefined) { const value = String(req.body.category).toUpperCase(); if (!PRODUCT_CATEGORIES.includes(value)) return res.status(400).json({ success: false, message: "Product category is invalid" }); product.category = value; }
    if (req.body?.status !== undefined) { const value = String(req.body.status).toUpperCase(); if (!PRODUCT_STATUSES.includes(value)) return res.status(400).json({ success: false, message: "Product status is invalid" }); product.status = value; }
    if (req.body?.sellingPrice !== undefined) { const value = nonNegativeMoney(req.body.sellingPrice); if (value === null) return res.status(400).json({ success: false, message: "Selling price must be zero or greater" }); product.sellingPrice = value; }
    if (req.body?.imageUrl !== undefined) { const value = validImage(req.body.imageUrl); if (value === null) return res.status(400).json({ success: false, message: "Image URL must use HTTPS or a local path" }); product.imageUrl = value; }
    if (req.body?.isPublished !== undefined) { if (typeof req.body.isPublished !== "boolean") return res.status(400).json({ success: false, message: "Publication status is invalid" }); product.isPublished = req.body.isPublished; }
    if (req.body?.supplier !== undefined) { const value = req.body.supplier ? requireId(req.body.supplier) : null; if (req.body.supplier && !value) return res.status(400).json({ success: false, message: "Supplier ID is invalid" }); if (value && !(await Supplier.exists({ _id: value, status: "ACTIVE" }))) return res.status(400).json({ success: false, message: "Active supplier was not found" }); product.supplier = value; }
    product.updatedBy = req.user._id;
    await product.save();
    await auditService.record({ req, action: AUDIT_ACTIONS.INVENTORY_PRODUCT_UPDATED, entityType: "PRODUCT", entityId: product._id, before, after: { name: product.name, category: product.category, sellingPrice: product.sellingPrice, supplier: product.supplier, status: product.status, isPublished: product.isPublished } });
    res.json({ success: true, product });
  } catch (error) { errorResponse(res, error, "Failed to update product"); }
};

const listSuppliers = async (req, res) => {
  try { const { page, limit } = pageOptions(req); const query = req.query.status ? { status: req.query.status } : {}; const [suppliers, total] = await Promise.all([Supplier.find(query).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(), Supplier.countDocuments(query)]); res.json({ success: true, suppliers, page, limit, total }); }
  catch (error) { errorResponse(res, error, "Failed to load suppliers"); }
};

const createSupplier = async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ success: false, message: "Supplier name is required" });
  try { const supplier = await Supplier.create({ name, contactPerson: req.body.contactPerson, phone: req.body.phone, email: req.body.email, address: req.body.address, notes: req.body.notes, createdBy: req.user._id }); await auditService.record({ req, action: AUDIT_ACTIONS.INVENTORY_SUPPLIER_UPDATED, entityType: "SUPPLIER", entityId: supplier._id, after: { name: supplier.name, status: supplier.status } }); res.status(201).json({ success: true, supplier }); }
  catch (error) { errorResponse(res, error, "Failed to create supplier"); }
};

const updateSupplier = async (req, res) => {
  if (!isId(req.params.supplierId)) return res.status(400).json({ success: false, message: "Supplier ID is invalid" });
  try { const supplier = await Supplier.findById(req.params.supplierId); if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" }); const before = supplier.toObject(); for (const key of ["name", "contactPerson", "phone", "email", "address", "notes"]) if (req.body?.[key] !== undefined) supplier[key] = String(req.body[key]).trim(); if (req.body?.status !== undefined) { if (!["ACTIVE", "INACTIVE"].includes(req.body.status)) return res.status(400).json({ success: false, message: "Supplier status is invalid" }); supplier.status = req.body.status; } supplier.updatedBy = req.user._id; await supplier.save(); await auditService.record({ req, action: AUDIT_ACTIONS.INVENTORY_SUPPLIER_UPDATED, entityType: "SUPPLIER", entityId: supplier._id, before: { name: before.name, status: before.status }, after: { name: supplier.name, status: supplier.status } }); res.json({ success: true, supplier }); }
  catch (error) { errorResponse(res, error, "Failed to update supplier"); }
};

const recordStockMovement = (type) => async (req, res) => {
  const productId = requireId(req.body?.productId);
  const branchId = requireId(req.body?.branchId);
  const reason = String(req.body?.reason || "").trim();
  const idempotencyKey = validKey(req);
  const quantity = type === "ADJUSTMENT" ? Number(req.body?.change) : positiveInt(req.body?.quantity);
  if (!productId || !branchId || !idempotencyKey || !reason || reason.length < 4 || !Number.isSafeInteger(quantity) || quantity === 0 || (type !== "ADJUSTMENT" && quantity < 1)) return res.status(400).json({ success: false, message: "Product, branch, valid quantity/change, reason, and idempotency key are required" });
  if (type === "PURCHASE" && req.body?.purchasePrice !== undefined && nonNegativeMoney(req.body.purchasePrice) === null) return res.status(400).json({ success: false, message: "Purchase price must be zero or greater" });
  if (!inBranchScope(req.user, branchId)) return res.status(403).json({ success: false, message: "You can only manage inventory for your assigned branch" });
  if (!(await Branch.exists({ _id: branchId, isActive: { $ne: false } }))) return res.status(404).json({ success: false, message: "Branch not found or inactive" });
  try {
    const existing = await StockMovement.findOne({ idempotencyKey }).lean();
    if (existing) {
      const requestedPrice = req.body?.purchasePrice === undefined ? null : nonNegativeMoney(req.body.purchasePrice);
      if (String(existing.product) !== String(productId) || String(existing.branch) !== String(branchId) || existing.type !== type || Number(existing.quantity) !== Math.abs(quantity) || (requestedPrice !== null && Number(existing.unitPrice) !== requestedPrice)) return res.status(409).json({ success: false, message: "Idempotency key was already used for a different stock movement" });
      return res.json({ success: true, duplicate: true, movement: existing });
    }
    const product = await Product.findOne({ _id: productId, status: { $ne: "DISCONTINUED" } }).lean();
    if (!product) return res.status(404).json({ success: false, message: "Active product was not found" });
    const result = await withTransaction(async (session) => {
      const inventory = await ensureInventory({ product: product._id, branch: branchId, session, purchasePrice: nonNegativeMoney(req.body?.purchasePrice) ?? 0, minimumStock: Number.isSafeInteger(Number(req.body?.minimumStock)) && Number(req.body.minimumStock) >= 0 ? Number(req.body.minimumStock) : 0, supplier: req.body?.supplier && isId(req.body.supplier) ? req.body.supplier : product.supplier });
      const previousStockState = inventory.stockState;
      const previousQuantity = inventory.quantity;
      const delta = type === "PURCHASE" ? quantity : type === "DAMAGE" ? -quantity : quantity;
      const nextQuantity = type === "ADJUSTMENT" ? previousQuantity + quantity : previousQuantity + delta;
      if (nextQuantity < inventory.reservedQuantity) { const error = new Error("Stock cannot be reduced below units reserved for unpaid orders"); error.status = 409; throw error; }
      if (nextQuantity < 0) { const error = new Error("Stock cannot become negative"); error.status = 409; throw error; }
      inventory.quantity = nextQuantity;
      if (req.body?.minimumStock !== undefined) { const threshold = Number(req.body.minimumStock); if (!Number.isSafeInteger(threshold) || threshold < 0) { const error = new Error("Minimum stock must be a non-negative whole number"); error.status = 400; throw error; } inventory.minimumStock = threshold; }
      if (type === "PURCHASE" && req.body?.purchasePrice !== undefined) { const price = nonNegativeMoney(req.body.purchasePrice); if (price === null) { const error = new Error("Purchase price must be zero or greater"); error.status = 400; throw error; } inventory.purchasePrice = price; }
      if (req.body?.supplier !== undefined) { const supplier = req.body.supplier ? requireId(req.body.supplier) : null; if (req.body.supplier && (!supplier || !(await Supplier.exists({ _id: supplier, status: "ACTIVE" }).session(session)))) { const error = new Error("Active supplier was not found"); error.status = 400; throw error; } inventory.supplier = supplier; }
      inventory.updatedBy = req.user._id;
      setStockState(inventory);
      await inventory.save({ session });
      const purchaseUnitPrice = type === "PURCHASE" && req.body?.purchasePrice !== undefined ? nonNegativeMoney(req.body.purchasePrice) : null;
      const movement = await createStockMovement({ product: product._id, sku: product.sku, branch: branchId, type, quantity: Math.abs(quantity), quantityDelta: quantity < 0 ? quantity : delta, previousQuantity, newQuantity: inventory.quantity, previousReserved: inventory.reservedQuantity, newReserved: inventory.reservedQuantity, unitPrice: purchaseUnitPrice, amount: purchaseUnitPrice === null ? null : round(purchaseUnitPrice * Math.abs(quantity)), reference: String(req.body?.reference || "").trim(), reason, idempotencyKey, performedBy: req.user._id }, session);
      await auditInventory(req, session, { action: AUDIT_ACTIONS.INVENTORY_STOCK_MOVED, product: product._id, entityId: movement._id, branch: branchId, reason, before: { quantity: previousQuantity, stockState: previousStockState }, after: { quantity: inventory.quantity, stockState: inventory.stockState, type, movementId: movement._id } });
      return { inventory, movement, previousStockState };
    });
    await notifyTransitions([{ ...result, context: { ...(await getStockContext(result.inventory, null)) } }]);
    res.status(201).json({ success: true, ...result });
  } catch (error) { errorResponse(res, error, "Failed to record stock movement"); }
};

const transferStock = async (req, res) => {
  const productId = requireId(req.body?.productId);
  const sourceBranch = requireId(req.body?.sourceBranch);
  const destinationBranch = requireId(req.body?.destinationBranch);
  const quantity = positiveInt(req.body?.quantity);
  const reason = String(req.body?.reason || "").trim();
  const idempotencyKey = validKey(req);
  if (!productId || !sourceBranch || !destinationBranch || String(sourceBranch) === String(destinationBranch) || !quantity || reason.length < 4 || !idempotencyKey) return res.status(400).json({ success: false, message: "Distinct source/destination branches, product, positive quantity, reason, and idempotency key are required" });
    if (!hasAllScope(req.user)) return res.status(403).json({ success: false, message: "Branch-scoped users cannot transfer stock across branches" });
  try {
    const replay = await StockMovement.find({ idempotencyKey: { $in: [`${idempotencyKey}:out`, `${idempotencyKey}:in`] } }).sort({ type: 1 }).lean();
    if (replay.length) {
      const matches = replay.length === 2 && replay.every((move) => String(move.product) === String(productId) && move.quantity === quantity && String(move.sourceBranch) === String(sourceBranch) && String(move.destinationBranch) === String(destinationBranch)) && replay[0].transferId && replay.every((move) => move.transferId === replay[0].transferId);
      if (!matches) return res.status(409).json({ success: false, message: "Transfer key was already used for a different operation" });
      return res.json({ success: true, duplicate: true, movements: replay });
    }
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (await Branch.countDocuments({ _id: { $in: [sourceBranch, destinationBranch] }, isActive: { $ne: false } }) !== 2) return res.status(404).json({ success: false, message: "Source or destination branch was not found or is inactive" });
    const transferId = new mongoose.Types.ObjectId().toString();
    const result = await withTransaction(async (session) => {
      const source = await BranchInventory.findOne({ product: productId, branch: sourceBranch }).session(session);
      const destination = await ensureInventory({ product: productId, branch: destinationBranch, session, purchasePrice: 0, supplier: product.supplier });
      if (!source || source.quantity - source.reservedQuantity < quantity) { const error = new Error("Source branch does not have enough available stock"); error.status = 409; throw error; }
      const previousSourceState = source.stockState;
      const previousDestinationState = destination.stockState;
      const sourcePrevious = source.quantity;
      const destinationPrevious = destination.quantity;
      source.quantity -= quantity;
      destination.quantity += quantity;
      source.updatedBy = destination.updatedBy = req.user._id;
      setStockState(source); setStockState(destination);
      // Execute writes sequentially inside a transaction session. Parallel
      // operations on one MongoDB transaction can produce conflicting commands.
      await source.save({ session });
      await destination.save({ session });
      const outMovement = await createStockMovement({ product: productId, sku: product.sku, branch: sourceBranch, type: "TRANSFER", quantity, quantityDelta: -quantity, previousQuantity: sourcePrevious, newQuantity: source.quantity, previousReserved: source.reservedQuantity, newReserved: source.reservedQuantity, transferId, sourceBranch, destinationBranch, reason, idempotencyKey: `${idempotencyKey}:out`, performedBy: req.user._id }, session);
      const inMovement = await createStockMovement({ product: productId, sku: product.sku, branch: destinationBranch, type: "TRANSFER", quantity, quantityDelta: quantity, previousQuantity: destinationPrevious, newQuantity: destination.quantity, previousReserved: destination.reservedQuantity, newReserved: destination.reservedQuantity, transferId, sourceBranch, destinationBranch, reason, idempotencyKey: `${idempotencyKey}:in`, performedBy: req.user._id }, session);
      await auditInventory(req, session, { action: AUDIT_ACTIONS.INVENTORY_TRANSFERRED, entityId: outMovement._id, branch: sourceBranch, reason, before: { sourceQuantity: sourcePrevious, destinationQuantity: destinationPrevious }, after: { transferId, quantity, sourceQuantity: source.quantity, destinationQuantity: destination.quantity, sourceBranch, destinationBranch } });
      return { source, destination, movements: [outMovement, inMovement], previousSourceState, previousDestinationState };
    });
    await notifyTransitions([
      { inventory: result.source, movement: result.movements[0], previousStockState: result.previousSourceState, context: await getStockContext(result.source, null) },
      { inventory: result.destination, movement: result.movements[1], previousStockState: result.previousDestinationState, context: await getStockContext(result.destination, null) },
    ]);
    await safelyNotify({ type: "INVENTORY_TRANSFER_COMPLETED", title: "Inventory transfer completed", message: `${quantity} ${product.name} transferred between branches.`, severity: "INFO", branch: destinationBranch, entityType: "INVENTORY", entityId: result.destination._id, actionUrl: "/inventory?tab=transfers", eventKey: `inventory:transfer:${transferId}` });
    await sendInventoryTransferEmail({ branch: destinationBranch, transferId, productName: product.name, quantity }).catch(() => {});
    res.status(201).json({ success: true, transferId, ...result });
  } catch (error) { errorResponse(res, error, "Failed to transfer stock"); }
};

const createOrder = async (req, res) => {
  const studentId = requireId(req.body?.studentId);
  const requestedBranch = requireId(req.body?.branchId);
  const idempotencyKey = validKey(req);
  const fulfillment = String(req.body?.fulfillment || "PICKUP").toUpperCase();
  const rawItems = req.body?.items;
  if (!studentId || !requestedBranch || !idempotencyKey || !["PICKUP", "DELIVERY"].includes(fulfillment) || !Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 40) return res.status(400).json({ success: false, message: "Student, branch, item list, fulfillment, and idempotency key are required" });
  if (!inBranchScope(req.user, requestedBranch)) return res.status(403).json({ success: false, message: "You can only create orders for your assigned branch" });
  const grouped = new Map();
  for (const item of rawItems) { const product = requireId(item?.productId); const quantity = positiveInt(item?.quantity); if (!product || !quantity) return res.status(400).json({ success: false, message: "Each order item needs a valid product and positive whole-number quantity" }); grouped.set(String(product), (grouped.get(String(product)) || 0) + quantity); }
  try {
    const replay = await InventoryOrder.findOne({ idempotencyKey }).populate("invoice").lean();
    if (replay) {
      const requested = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
      const existingItems = replay.items.map((item) => [String(item.product), item.quantity]).sort(([a], [b]) => a.localeCompare(b));
      if (String(replay.student?._id || replay.student) !== String(studentId) || String(replay.branch?._id || replay.branch) !== String(requestedBranch) || replay.fulfillment !== fulfillment || JSON.stringify(existingItems) !== JSON.stringify(requested)) return res.status(409).json({ success: false, message: "Order idempotency key was already used for a different order" });
      return res.json({ success: true, duplicate: true, order: replay });
    }
    const result = await withTransaction(async (session) => {
      const student = await Student.findById(studentId).session(session);
      if (!student || student.status === "INACTIVE" || String(student.branch) !== String(requestedBranch)) { const error = new Error("Active student was not found at the selected branch"); error.status = 404; throw error; }
      const branch = await Branch.findOne({ _id: requestedBranch, isActive: { $ne: false } }).session(session);
      if (!branch) { const error = new Error("Branch was not found or is inactive"); error.status = 404; throw error; }
      const items = [];
      const transitions = [];
      for (const [productKey, quantity] of grouped) {
        const product = await Product.findOne({ _id: productKey, status: "ACTIVE" }).session(session);
        if (!product) { const error = new Error("An active product was not found"); error.status = 404; throw error; }
        const inventory = await BranchInventory.findOne({ product: product._id, branch: requestedBranch }).session(session);
        if (!inventory || inventory.quantity - inventory.reservedQuantity < quantity) { const error = new Error(`Insufficient available stock for ${product.name}`); error.status = 409; throw error; }
        const oldState = inventory.stockState;
        const beforeReserved = inventory.reservedQuantity;
        inventory.reservedQuantity += quantity;
        inventory.updatedBy = req.user._id;
        setStockState(inventory);
        await inventory.save({ session });
        const orderItemId = new mongoose.Types.ObjectId();
        items.push({ _id: orderItemId, product: product._id, name: product.name, sku: product.sku, quantity, unitPrice: product.sellingPrice, amount: round(product.sellingPrice * quantity) });
        const reservationKey = crypto.createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32);
        const reservation = await createStockMovement({ product: product._id, sku: product.sku, branch: requestedBranch, type: "RESERVATION", quantity, quantityDelta: 0, previousQuantity: inventory.quantity, newQuantity: inventory.quantity, previousReserved: beforeReserved, newReserved: inventory.reservedQuantity, reason: "Reserved for merchandise order payment", idempotencyKey: `order-reserve:${reservationKey}:${product._id}`, performedBy: req.user._id }, session);
        transitions.push({ inventory, movement: reservation, previousStockState: oldState, context: { productName: product.name, sku: product.sku, branchName: branch.name } });
      }
      const subtotal = round(items.reduce((sum, item) => sum + item.amount, 0));
      if (subtotal <= 0) { const error = new Error("Merchandise order total must be greater than zero"); error.status = 400; throw error; }
      const year = new Date().getFullYear();
      const sequence = await FinanceSequence.findOneAndUpdate({ key: `inventory-order:${year}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after", session });
      const orderNumber = `ORD-${year}-${String(sequence.value).padStart(6, "0")}`;
      const settings = await AcademySettings.findOne().session(session).lean();
      const invoiceSequence = await FinanceSequence.findOneAndUpdate({ key: `INV:${year}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after", session });
      const invoiceNumber = `INV-${year}-${String(invoiceSequence.value).padStart(6, "0")}`;
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [order] = await InventoryOrder.create([{ orderNumber, student: student._id, branch: requestedBranch, items, subtotal, total: subtotal, currency: settings?.currency || "INR", status: "PAYMENT_PENDING", paymentStatus: "PENDING", fulfillment, fulfillmentNotes: String(req.body?.fulfillmentNotes || "").trim(), idempotencyKey, createdBy: req.user._id }], { session });
      const invoiceItems = items.map((item) => ({ description: item.name, quantity: item.quantity, unitAmount: item.unitPrice, amount: item.amount, kind: "MERCHANDISE", product: item.product, sku: item.sku }));
      const [invoice] = await Invoice.create([{ invoiceNumber, student: student._id, enrollment: null, kind: "MERCHANDISE", order: order._id, branch: requestedBranch, items: invoiceItems, subtotal, discount: 0, taxRate: 0, tax: 0, total: subtotal, paidAmount: 0, balance: subtotal, currency: settings?.currency || "INR", dueDate, cycleKey: `MERCHANDISE:${order._id}`, status: "ISSUED", notes: `Merchandise order ${orderNumber}`, createdBy: req.user._id, issuedAt: new Date() }], { session });
      order.invoice = invoice._id;
      await order.save({ session });
      await auditInventory(req, session, { action: AUDIT_ACTIONS.INVENTORY_ORDER_CREATED, entityId: order._id, branch: requestedBranch, after: { orderNumber, invoiceNumber, student: student._id, total: subtotal, itemCount: items.length } });
      return { order, invoice, transitions };
    });
    await notifyTransitions(result.transitions);
    res.status(201).json({ success: true, order: result.order, invoice: result.invoice });
  } catch (error) {
    if (error.code === 11000) {
      const replay = await InventoryOrder.findOne({ idempotencyKey }).populate("invoice").lean();
      if (replay) {
        const requested = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
        const existingItems = replay.items.map((item) => [String(item.product), item.quantity]).sort(([a], [b]) => a.localeCompare(b));
        if (String(replay.student) === String(studentId) && String(replay.branch) === String(requestedBranch) && replay.fulfillment === fulfillment && JSON.stringify(existingItems) === JSON.stringify(requested)) return res.json({ success: true, duplicate: true, order: replay, invoice: replay.invoice });
        return res.status(409).json({ success: false, message: "Order idempotency key was already used for a different order" });
      }
    }
    errorResponse(res, error, "Failed to create merchandise order");
  }
};

const cancelOrder = async (req, res) => {
  if (!isId(req.params.orderId)) return res.status(400).json({ success: false, message: "Order ID is invalid" });
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 4) return res.status(400).json({ success: false, message: "A cancellation reason is required" });
  try {
    const result = await withTransaction(async (session) => {
      const order = await InventoryOrder.findById(req.params.orderId).session(session);
      if (!order || !inBranchScope(req.user, order.branch)) { const error = new Error("Order not found"); error.status = 404; throw error; }
      if (order.status !== "PAYMENT_PENDING") { const error = new Error("Only unpaid merchandise orders can be cancelled"); error.status = 409; throw error; }
      const invoice = await Invoice.findById(order.invoice).session(session);
      if (!invoice || invoice.paidAmount > 0) { const error = new Error("Order invoice cannot be cancelled after payment"); error.status = 409; throw error; }
      invoice.status = "CANCELLED";
      await invoice.save({ session });
      const transitions = await releaseOrderReservation({ order, req, session, reason });
      return { order, invoice, transitions };
    });
    await notifyTransitions(result.transitions);
    res.json({ success: true, order: result.order, invoice: result.invoice });
  } catch (error) { errorResponse(res, error, "Failed to cancel merchandise order"); }
};

const returnOrderItem = async (req, res) => {
  if (!isId(req.params.orderId) || !isId(req.params.itemId)) return res.status(400).json({ success: false, message: "Order or item ID is invalid" });
  const quantity = positiveInt(req.body?.quantity);
  const reason = String(req.body?.reason || "").trim();
  const idempotencyKey = validKey(req);
  const disposition = String(req.body?.disposition || "RESTOCK").toUpperCase();
  if (!quantity || reason.length < 4 || !idempotencyKey || !["RESTOCK", "DAMAGED_RETURN"].includes(disposition)) return res.status(400).json({ success: false, message: "Quantity, reason, idempotency key, and valid return disposition are required" });
  try {
    const existing = await StockMovement.findOne({ idempotencyKey }).lean();
    if (existing) return res.json({ success: true, duplicate: true, movement: existing });
    const result = await withTransaction(async (session) => {
      const order = await InventoryOrder.findById(req.params.orderId).session(session);
      if (!order || !inBranchScope(req.user, order.branch)) { const error = new Error("Order not found"); error.status = 404; throw error; }
      if (!["PAID", "PARTIALLY_RETURNED", "RETURNED", "REFUNDED"].includes(order.status)) { const error = new Error("Only paid orders can be returned"); error.status = 409; throw error; }
      const item = order.items.id(req.params.itemId);
      if (!item) { const error = new Error("Order item not found"); error.status = 404; throw error; }
      if (item.returnedQuantity + quantity > item.quantity) { const error = new Error("Return quantity exceeds the quantity purchased"); error.status = 400; throw error; }
      const inventory = await BranchInventory.findOne({ product: item.product, branch: order.branch }).session(session);
      if (!inventory) { const error = new Error("Branch inventory record not found"); error.status = 404; throw error; }
      const previousStockState = inventory.stockState;
      const previousQuantity = inventory.quantity;
      if (disposition === "RESTOCK") inventory.quantity += quantity;
      inventory.updatedBy = req.user._id;
      setStockState(inventory);
      await inventory.save({ session });
      item.returnedQuantity += quantity;
      order.status = order.items.every((orderItem) => orderItem.returnedQuantity >= orderItem.quantity) ? "RETURNED" : "PARTIALLY_RETURNED";
      await order.save({ session });
      const movement = await createStockMovement({ product: item.product, sku: item.sku, branch: order.branch, type: "RETURN", quantity, quantityDelta: disposition === "RESTOCK" ? quantity : 0, previousQuantity, newQuantity: inventory.quantity, previousReserved: inventory.reservedQuantity, newReserved: inventory.reservedQuantity, reference: order.orderNumber, relatedOrder: order._id, reason: `${disposition}: ${reason}`, idempotencyKey, performedBy: req.user._id }, session);
      await auditInventory(req, session, { action: AUDIT_ACTIONS.INVENTORY_RETURNED, entityId: movement._id, branch: order.branch, reason, before: { quantity: previousQuantity }, after: { quantity: inventory.quantity, disposition, orderId: order._id, orderItemId: item._id, returnedQuantity: item.returnedQuantity } });
      return { order, inventory, movement, previousStockState };
    });
    await notifyTransitions([{ ...result, context: await getStockContext(result.inventory, null) }]);
    res.status(201).json({ success: true, order: result.order, movement: result.movement });
  } catch (error) { errorResponse(res, error, "Failed to return merchandise"); }
};

const listOrders = async (req, res) => {
  try { const { page, limit } = pageOptions(req); const branch = scopeBranch(req, req.query.branch); const query = { ...(branch ? { branch } : {}), ...(req.query.status ? { status: req.query.status } : {}) }; const [orders, total] = await Promise.all([InventoryOrder.find(query).populate("student", "name phone").populate("branch", "name").populate("invoice", "invoiceNumber status total balance").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), InventoryOrder.countDocuments(query)]); res.json({ success: true, orders, page, limit, total }); }
  catch (error) { errorResponse(res, error, "Failed to load orders"); }
};

const listMovements = async (req, res) => {
  try {
    const { page, limit } = pageOptions(req);
    const query = { ...(scopeBranch(req, req.query.branch) ? { branch: scopeBranch(req, req.query.branch) } : {}) };
    if (req.query.product && isId(req.query.product)) query.product = req.query.product;
    if (req.query.type && ["PURCHASE", "SALE", "ADJUSTMENT", "TRANSFER", "RETURN", "DAMAGE", "RESERVATION", "RELEASE"].includes(req.query.type)) query.type = req.query.type;
    if (req.query.user && isId(req.query.user)) query.performedBy = req.query.user;
    if (req.query.from || req.query.to) { query.occurredAt = {}; if (req.query.from && !Number.isNaN(new Date(req.query.from).getTime())) query.occurredAt.$gte = new Date(req.query.from); if (req.query.to && !Number.isNaN(new Date(req.query.to).getTime())) query.occurredAt.$lte = new Date(req.query.to); }
    const [movements, total] = await Promise.all([StockMovement.find(query).populate("product", "name sku").populate("branch", "name").populate("performedBy", "name").populate("relatedOrder", "orderNumber").sort({ occurredAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), StockMovement.countDocuments(query)]);
    res.json({ success: true, movements, page, limit, total });
  } catch (error) { errorResponse(res, error, "Failed to load stock movements"); }
};

const listTransfers = async (req, res) => {
  try { const branch = scopeBranch(req, req.query.branch); const branchObjectId = branch ? new mongoose.Types.ObjectId(branch) : null; const match = { type: "TRANSFER", transferId: { $ne: "" }, ...(branchObjectId ? { $or: [{ sourceBranch: branchObjectId }, { destinationBranch: branchObjectId }] } : {}) }; const transfers = await StockMovement.aggregate([{ $match: match }, { $sort: { occurredAt: -1 } }, { $group: { _id: "$transferId", product: { $first: "$product" }, sku: { $first: "$sku" }, quantity: { $first: "$quantity" }, sourceBranch: { $first: "$sourceBranch" }, destinationBranch: { $first: "$destinationBranch" }, reason: { $first: "$reason" }, performedBy: { $first: "$performedBy" }, occurredAt: { $first: "$occurredAt" } } }, { $sort: { occurredAt: -1 } }, { $limit: Math.min(Math.max(Number(req.query.limit) || 100, 1), 250) }, { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "productInfo" } }, { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } }, { $lookup: { from: "branches", localField: "sourceBranch", foreignField: "_id", as: "sourceInfo" } }, { $unwind: { path: "$sourceInfo", preserveNullAndEmptyArrays: true } }, { $lookup: { from: "branches", localField: "destinationBranch", foreignField: "_id", as: "destinationInfo" } }, { $unwind: { path: "$destinationInfo", preserveNullAndEmptyArrays: true } }, { $lookup: { from: "users", localField: "performedBy", foreignField: "_id", as: "userInfo" } }, { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } }, { $project: { product: { _id: "$product", name: "$productInfo.name", sku: "$sku" }, quantity: 1, sourceBranch: { _id: "$sourceBranch", name: "$sourceInfo.name" }, destinationBranch: { _id: "$destinationBranch", name: "$destinationInfo.name" }, reason: 1, performedBy: { name: "$userInfo.name" }, occurredAt: 1 } }]); res.json({ success: true, transfers }); }
  catch (error) { errorResponse(res, error, "Failed to load transfers"); }
};

const getReports = async (req, res) => {
  try {
    const branch = scopeBranch(req, req.query.branch);
    const match = branch ? { branch: new mongoose.Types.ObjectId(branch) } : {};
    const from = req.query.from && !Number.isNaN(new Date(req.query.from).getTime()) ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to && !Number.isNaN(new Date(req.query.to).getTime()) ? new Date(req.query.to) : new Date();
    const [stockValue, lowStock, sales, branchInventory] = await Promise.all([
      BranchInventory.aggregate([{ $match: match }, { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } }, { $unwind: "$product" }, { $group: { _id: null, totalUnits: { $sum: "$quantity" }, inventoryValue: { $sum: { $multiply: ["$quantity", "$purchasePrice"] } } } }]),
      BranchInventory.find({ ...match, stockState: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] } }).populate("product", "name sku category sellingPrice").populate("branch", "name").sort({ stockState: 1 }).lean(),
      StockMovement.aggregate([{ $match: { ...match, type: "SALE", occurredAt: { $gte: from, $lte: to } } }, { $group: { _id: { product: "$product", branch: "$branch", day: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt", timezone: "Asia/Kolkata" } } }, quantitySold: { $sum: "$quantity" }, revenue: { $sum: "$amount" } } }, { $lookup: { from: "products", localField: "_id.product", foreignField: "_id", as: "product" } }, { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } }, { $lookup: { from: "branches", localField: "_id.branch", foreignField: "_id", as: "branch" } }, { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } }, { $project: { product: "$product.name", sku: "$product.sku", branch: "$branch.name", date: "$_id.day", quantitySold: 1, revenue: 1 } }, { $sort: { quantitySold: -1 } }, { $limit: 500 }]),
      BranchInventory.aggregate([{ $match: match }, { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "productInfo" } }, { $unwind: "$productInfo" }, { $lookup: { from: "branches", localField: "branch", foreignField: "_id", as: "branchInfo" } }, { $unwind: "$branchInfo" }, { $project: { product: "$productInfo.name", sku: "$productInfo.sku", branch: "$branchInfo.name", quantity: 1, purchasePrice: 1, value: { $multiply: ["$quantity", "$purchasePrice"] } } }, { $sort: { product: 1, branch: 1 } }]),
    ]);
    const bestSellingMap = new Map();
    for (const row of sales) { const key = `${row.product}:${row.sku}`; const current = bestSellingMap.get(key) || { product: row.product, sku: row.sku, quantitySold: 0, revenue: 0 }; current.quantitySold += row.quantitySold; current.revenue = round(current.revenue + row.revenue); bestSellingMap.set(key, current); }
    const bestSelling = [...bestSellingMap.values()].sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue).slice(0, 20);
    res.json({ success: true, from, to, stockValue: stockValue[0] || { totalUnits: 0, inventoryValue: 0 }, lowStock, sales, bestSelling, branchInventory });
  } catch (error) { errorResponse(res, error, "Failed to load inventory reports"); }
};

const getPublicProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "ACTIVE", isPublished: true }).select("name sku category description imageUrl sellingPrice").sort({ category: 1, name: 1 }).lean();
    if (req.query.branch && !isId(req.query.branch)) return res.status(400).json({ success: false, message: "Branch ID is invalid" });
    const branch = req.query.branch || null;
    if (branch && !(await Branch.exists({ _id: branch, isActive: { $ne: false } }))) return res.json({ success: true, products: [] });
    const activeBranches = branch ? [branch] : await Branch.find({ isActive: { $ne: false } }).distinct("_id");
    const stocks = await BranchInventory.find({ product: { $in: products.map((product) => product._id) }, branch: { $in: activeBranches } }).select("product branch quantity reservedQuantity minimumStock").lean();
    const stockByProduct = new Map();
    for (const stock of stocks) { const key = String(stock.product); stockByProduct.set(key, [...(stockByProduct.get(key) || []), stock]); }
    const output = products.map((product) => {
      const branches = stockByProduct.get(String(product._id)) || [];
      const available = branches.reduce((sum, stock) => sum + stock.quantity - stock.reservedQuantity, 0);
      const threshold = branches.reduce((sum, stock) => sum + stock.minimumStock, 0);
      const availability = !branches.length ? "UNAVAILABLE" : available <= 0 ? "OUT_OF_STOCK" : available <= threshold ? "LOW_STOCK" : "IN_STOCK";
      return { _id: product._id, name: product.name, sku: product.sku, category: product.category, description: product.description, imageUrl: product.imageUrl, sellingPrice: product.sellingPrice, availability };
    });
    res.json({ success: true, products: output });
  } catch (error) { errorResponse(res, error, "Failed to load merchandise"); }
};

module.exports = { getDashboard, listInventory, updateStockSettings, listProducts, createProduct, updateProduct, listSuppliers, createSupplier, updateSupplier, recordStockMovement, transferStock, createOrder, cancelOrder, returnOrderItem, listOrders, listMovements, listTransfers, getReports, getPublicProducts };

const { after, before, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-bytes";
process.env.CLIENT_URL = "http://localhost:3000";
process.env.TZ = "Asia/Kolkata";

let mongo;
let mongoose;
let app;
let Branch;
let Role;
let User;
let Student;
let Plan;
let FeeTerm;
let Attendance;
let Holiday;
let Makeup;
let PasswordResetToken;
let Inquiry;
let Trial;
let TrainingSessionType;
let BranchSchedule;
let Session;
let Batch;
let Performance;
let Notification;
let Invoice;
let Payment;
let Receipt;
let FinanceAudit;
let AuditLog;
let AttendanceCorrection;
let AcademySettings;
let GradingEvent;
let GradingEvaluation;
let BeltHistory;
let Curriculum;
let StudentCurriculumMilestone;
let StudentCurriculumStepProgress;
let Certificate;
let AcademyEvent;
let AcademyEventRegistration;
let fixture;

const permissions = [
  "student.view", "student.create", "student.update", "student.delete",
  "membership.view", "membership.manage",
  "attendance.view", "attendance.manage", "attendance.correct", "attendance.correct.approve", "audit.view", "holiday.view", "holiday.manage",
  "makeup.view", "makeup.manage", "branch_schedule.view", "branch_schedule.manage",
  "performance.view", "promotion.view", "promotion.manage", "report.view", "inquiry.view", "inquiry.update", "student.create", "plan.view", "finance.manage",
  "finance.view", "finance.manage", "finance.collect", "finance.refund", "finance.report", "student.finance.view",
  "grading.view", "grading.create", "grading.update", "grading.evaluate", "grading.finalize", "grading.publish", "grading.cancel",
  "certificate.view", "certificate.generate", "certificate.download", "student.grading.view",
  "calendar.view", "event.view", "event.manage", "event.register",
  "module.view", "module.manage",
  "curriculum.view", "curriculum.manage",
  "inventory.view", "inventory.create", "inventory.update", "inventory.adjust", "inventory.transfer", "inventory.purchase", "inventory.sale", "inventory.return", "inventory.damage", "inventory.report", "inventory.manage",
];
const origin = "http://localhost:3000";
const calendarDateOffset = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const nextWeekday = (weekday, offset = 1) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  while (date.getDay() !== weekday) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const makeCookie = (user, options = {}) => {
  const token = jwt.sign(
    { id: String(user._id), role: user.role, ...(options.claims || {}) },
    process.env.JWT_SECRET,
    options.jwt || {},
  );
  return `forcestrike_session=${encodeURIComponent(token)}`;
};

const createUser = (values = {}) => User.create({
  name: values.name || "Test User",
  email: values.email || `user-${crypto.randomUUID()}@example.test`,
  phone: values.phone || "9876543210",
  password: values.password || "correct horse battery staple",
  role: values.role || "TEST_BRANCH",
  branch: values.branch === undefined ? fixture.branchA._id : values.branch,
  isActive: values.isActive === undefined ? true : values.isActive,
});

const createStudent = (values = {}) => Student.create({
  user: values.user || null,
  name: values.name || "Test Student",
  age: 18,
  phone: values.phone || String(Math.floor(1000000000 + Math.random() * 8999999999)),
  email: values.email || null,
  branch: values.branch || fixture.branchA._id,
  plan: fixture.plan._id,
  joinDate: new Date("2026-01-01T00:00:00.000Z"),
  status: values.status || "ACTIVE",
});

const makeEnrollmentFeeTerm = (branch = fixture.branchA, values = {}) => FeeTerm.create({
  plan: values.plan || fixture.plan._id,
  branch: values.branch === undefined ? branch._id : values.branch,
  billingFrequency: values.billingFrequency || "MONTHLY",
  amount: values.amount ?? 100,
  registrationFee: values.registrationFee ?? 20,
  taxRate: values.taxRate ?? 10,
  discountRules: values.discountRules || [],
  effectiveFrom: values.effectiveFrom || new Date("2020-01-01T00:00:00.000Z"),
  effectiveUntil: values.effectiveUntil ?? null,
  status: values.status || "ACTIVE",
  version: 1,
});

async function configureAttendanceFixture({ curriculumDays = 7, studentIds = ["studentA"] } = {}) {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const program = await TrainingSessionType.create({
    name: `Attendance Karate ${suffix}`,
    normalizedName: `attendance-karate-${suffix}`,
    slug: `attendance-karate-${suffix}`,
    isActive: true,
  });
  const curriculum = Array.from({ length: curriculumDays }, (_, index) => ({
    day: index + 1,
    title: `Lesson ${index + 1}`,
    skill: `Skill ${index + 1}`,
  }));
  fixture.plan.programs = [{ program: program._id, curriculum, weeklyLimit: 7 }];
  await fixture.plan.save();
  for (const id of studentIds) {
    const student = fixture[id];
    student.planEnrollments = [{
      plan: fixture.plan._id,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      status: "ACTIVE",
      classesPerWeek: 7,
      programs: [{ program: program._id, weeklyLimit: 7, curriculum }],
    }];
    await student.save();
  }
  const slotIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const slot = (index, name, startTime) => ({
    _id: slotIds[index],
    sessionName: name,
    sessionTypeId: program._id,
    startTime,
    endTime: startTime === "10:00" ? "11:00" : "13:00",
    isActive: true,
  });
  const weeklySchedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: false,
    slots: [slot(0, "Morning", "10:00"), slot(1, "Afternoon", "12:00")],
  }));
  const schedule = await BranchSchedule.create({ branch: fixture.branchA._id, weeklySchedule });
  const slots = schedule.weeklySchedule[0].slots;
  return { program, curriculum, schedule, slotA: String(slots[0]._id), slotB: String(slots[1]._id) };
}

function markRequest(cookie, student, date, status = "PRESENT", sessionSlotId) {
  return request(app).post("/api/attendance").set("Cookie", cookie).set("Origin", origin).send({
    student: String(student._id || student), date, status, sessionSlotId,
  });
}

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instance: { dbName: "forcestrike_test" } });
  process.env.MONGO_URI = mongo.getUri("forcestrike_test");
  app = require("../../server");
  mongoose = require("mongoose");
  Branch = require("../../src/models/Branch");
  Role = require("../../src/models/Role");
  User = require("../../src/models/User");
  Student = require("../../src/models/Student");
  Plan = require("../../src/models/Plan");
  FeeTerm = require("../../src/models/FeeTerm");
  Attendance = require("../../src/models/Attendance");
  Holiday = require("../../src/models/Holiday");
  Makeup = require("../../src/models/Makeup");
  PasswordResetToken = require("../../src/models/PasswordResetToken");
  Inquiry = require("../../src/models/Inquiry");
  Trial = require("../../src/models/Trial");
  TrainingSessionType = require("../../src/models/TrainingSessionType");
  BranchSchedule = require("../../src/models/BranchSchedule");
  Session = require("../../src/models/Session");
  Batch = require("../../src/models/Batch");
  Performance = require("../../src/models/Performance");
  Notification = require("../../src/models/Notification");
  Invoice = require("../../src/models/Invoice");
  Payment = require("../../src/models/Payment");
  Receipt = require("../../src/models/Receipt");
  FinanceAudit = require("../../src/models/FinanceAudit");
  AuditLog = require("../../src/models/AuditLog");
  AttendanceCorrection = require("../../src/models/AttendanceCorrection");
  AcademySettings = require("../../src/models/AcademySettings");
  GradingEvent = require("../../src/models/GradingEvent");
  GradingEvaluation = require("../../src/models/GradingEvaluation");
  BeltHistory = require("../../src/models/BeltHistory");
  Curriculum = require("../../src/models/Curriculum");
  StudentCurriculumMilestone = require("../../src/models/StudentCurriculumMilestone");
  StudentCurriculumStepProgress = require("../../src/models/StudentCurriculumStepProgress");
  Certificate = require("../../src/models/Certificate");
  AcademyEvent = require("../../src/models/AcademyEvent");
  AcademyEventRegistration = require("../../src/models/AcademyEventRegistration");
  const Product = require("../../src/models/Product");
  const Supplier = require("../../src/models/Supplier");
  const BranchInventory = require("../../src/models/BranchInventory");
  const StockMovement = require("../../src/models/StockMovement");
  const InventoryOrder = require("../../src/models/InventoryOrder");
  await mongoose.connect(process.env.MONGO_URI);
  await Attendance.syncIndexes();
  await Makeup.syncIndexes();
  await Performance.syncIndexes();
  await Notification.syncIndexes();
  await Invoice.syncIndexes();
  await Payment.syncIndexes();
  await Receipt.syncIndexes();
  await FinanceAudit.syncIndexes();
  await FeeTerm.syncIndexes();
  await AttendanceCorrection.syncIndexes();
  await Trial.syncIndexes();
  await GradingEvaluation.syncIndexes();
  await Certificate.syncIndexes();
  await Promise.all([Product.syncIndexes(), Supplier.syncIndexes(), BranchInventory.syncIndexes(), StockMovement.syncIndexes(), InventoryOrder.syncIndexes(), AcademyEvent.syncIndexes(), AcademyEventRegistration.syncIndexes()]);
});

after(async () => {
  if (mongoose?.connection?.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  fixture = {};
  fixture.branchA = await Branch.create({ name: "Branch A", address: "A Street" });
  fixture.branchB = await Branch.create({ name: "Branch B", address: "B Street" });
  await Role.create({ key: "TEST_BRANCH", name: "Test branch user", dataScope: "BRANCH", permissions });
  await Role.create({ key: "NO_ACCESS", name: "No permissions", dataScope: "BRANCH", permissions: [] });
  await Role.create({ key: "SUPER_ADMIN", name: "Super Admin", dataScope: "ALL", permissions: [], isSystem: true });
  fixture.userA = await createUser({ email: "branch-a@example.test", branch: fixture.branchA._id });
  fixture.userB = await createUser({ email: "branch-b@example.test", branch: fixture.branchB._id });
  fixture.plan = await Plan.create({ name: "Basic Plan", duration: 1 });
  fixture.feeTerm = await makeEnrollmentFeeTerm(null, { branch: null, status: "RETIRED", billingFrequency: "ONE_TIME", effectiveFrom: new Date("2019-01-01T00:00:00.000Z") });
  fixture.studentA = await createStudent({ name: "Student A", branch: fixture.branchA._id, phone: "9000000001" });
  fixture.studentB = await createStudent({ name: "Student B", branch: fixture.branchB._id, phone: "9000000002" });
  const agreed = { feeTerm: fixture.feeTerm._id, feeTermVersion: fixture.feeTerm.version, planName: fixture.plan.name, branch: fixture.branchA._id, branchName: fixture.branchA.name, amount: 100, billingFrequency: "ONE_TIME", registrationFee: 20, taxRate: 10, discountRules: [], effectiveFrom: fixture.feeTerm.effectiveFrom, effectiveUntil: fixture.feeTerm.effectiveUntil };
  fixture.studentA.planEnrollments = [{ plan: fixture.plan._id, feeTerm: fixture.feeTerm._id, branch: fixture.branchA._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", billingSnapshot: agreed }];
  fixture.studentB.planEnrollments = [{ plan: fixture.plan._id, feeTerm: fixture.feeTerm._id, branch: fixture.branchB._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", billingSnapshot: { ...agreed, branch: fixture.branchB._id, branchName: fixture.branchB.name } }];
  await Promise.all([fixture.studentA.save(), fixture.studentB.save()]);
});

test("sidebar section reorder persists atomically without changing child order and enforces module permissions", async () => {
  const Module = require("../../src/models/Module");
  const modules = await Module.create([
    { key: "academy-a", label: "Academy A", href: "/academy-a", order: 10, group: "Academy", requiredPermission: "student.view" },
    { key: "academy-b", label: "Academy B", href: "/academy-b", order: 20, group: "Academy", requiredPermission: "student.view" },
    { key: "operations-a", label: "Operations A", href: "/operations-a", order: 30, group: "Operations", requiredPermission: "student.view" },
    { key: "custom-a", label: "Custom A", href: "/custom-a", order: 40, group: "My Custom Section", requiredPermission: "student.view" },
  ]);
  const moduleCookie = makeCookie(fixture.userA);
  const noAccess = await createUser({ role: "NO_ACCESS", email: "module-reorder-no-access@example.test" });
  const rejectedUnauthorized = await request(app).put("/api/modules/reorder").set("Cookie", makeCookie(noAccess)).set("Origin", origin).send({ sections: [{ id: "operations", order: 10 }] });
  assert.equal(rejectedUnauthorized.status, 403);

  const invalid = await request(app).put("/api/modules/reorder").set("Cookie", moduleCookie).set("Origin", origin).send({ sections: [{ id: "missing-section", order: 10 }] });
  assert.equal(invalid.status, 404);
  const duplicateOrder = await request(app).put("/api/modules/reorder").set("Cookie", moduleCookie).set("Origin", origin).send({ sections: [{ id: "academy", order: 10 }, { id: "operations", order: 10 }] });
  assert.equal(duplicateOrder.status, 400);
  const mixedChildSections = await request(app).put("/api/modules/reorder").set("Cookie", moduleCookie).set("Origin", origin).send({ items: [{ id: String(modules[0]._id), order: 10 }, { id: String(modules[2]._id), order: 20 }] });
  assert.equal(mixedChildSections.status, 400);

  const moved = await request(app).put("/api/modules/reorder").set("Cookie", moduleCookie).set("Origin", origin).send({
    sections: [
      { id: "operations", order: 10 },
      { id: "academy", order: 20 },
      { id: "custom:my custom section", order: 30 },
    ],
  });
  assert.equal(moved.status, 200);
  assert.deepEqual(moved.body.sections, [
    { id: "operations", sectionOrder: 10 },
    { id: "academy", sectionOrder: 20 },
    { id: "custom:my custom section", sectionOrder: 30 },
  ]);

  const persisted = await Module.find({ _id: { $in: modules.map((module) => module._id) } }).sort({ sectionOrder: 1, order: 1 }).lean();
  assert.deepEqual(persisted.map((module) => module.key), ["operations-a", "academy-a", "academy-b", "custom-a"]);
  assert.deepEqual(persisted.filter((module) => module.group === "Academy").map((module) => module.order), [10, 20]);
  assert.deepEqual(persisted.map((module) => module.href), ["/operations-a", "/academy-a", "/academy-b", "/custom-a"]);
  const navigation = await request(app).get("/api/modules/navigation").set("Cookie", moduleCookie);
  assert.equal(navigation.status, 200);
  assert.equal(navigation.body.modules.find((module) => module.key === "operations-a").sectionOrder, 10);
  assert.equal(navigation.body.modules.find((module) => module.key === "academy-a").sectionOrder, 20);

  const childMove = await request(app).put("/api/modules/reorder").set("Cookie", moduleCookie).set("Origin", origin).send({ items: [{ id: String(modules[1]._id), order: 10 }, { id: String(modules[0]._id), order: 20 }] });
  assert.equal(childMove.status, 200);
  const afterChildMove = await Module.find({ _id: { $in: modules.map((module) => module._id) } }).lean();
  assert.equal(afterChildMove.find((module) => module.key === "academy-a").sectionOrder, 20);
  assert.equal(afterChildMove.find((module) => module.key === "academy-b").sectionOrder, 20);
  assert.equal(afterChildMove.find((module) => module.key === "operations-a").sectionOrder, 10);
});

test("inventory validates products, records idempotent purchases, and isolates branch stock", async () => {
  const Product = require("../../src/models/Product");
  const BranchInventory = require("../../src/models/BranchInventory");
  const StockMovement = require("../../src/models/StockMovement");
  const cookie = makeCookie(fixture.userA);
  const unauthorized = await createUser({ role: "NO_ACCESS" });
  assert.equal((await request(app).get("/api/inventory/stock").set("Cookie", makeCookie(unauthorized))).status, 403);
  const badCategory = await request(app).post("/api/inventory/products").set("Cookie", cookie).set("Origin", origin).send({ name: "Bad category", sku: "BAD-1", category: "FOOD", sellingPrice: 10 });
  assert.equal(badCategory.status, 400);
  const created = await request(app).post("/api/inventory/products").set("Cookie", cookie).set("Origin", origin).send({ name: "Karate Gi", sku: "GI-001", category: "UNIFORM", sellingPrice: 1500, isPublished: true });
  assert.equal(created.status, 201);
  const duplicate = await request(app).post("/api/inventory/products").set("Cookie", cookie).set("Origin", origin).send({ name: "Another Gi", sku: "gi-001", category: "UNIFORM", sellingPrice: 1600 });
  assert.equal(duplicate.status, 409);

  const movementBody = { productId: String(created.body.product._id), branchId: String(fixture.branchA._id), quantity: 5, purchasePrice: 500, minimumStock: 2, reason: "Initial supplier purchase", idempotencyKey: "inventory-purchase-001" };
  const purchase = await request(app).post("/api/inventory/purchases").set("Cookie", cookie).set("Origin", origin).send(movementBody);
  assert.equal(purchase.status, 201);
  assert.equal(purchase.body.inventory.quantity, 5);
  const replay = await request(app).post("/api/inventory/purchases").set("Cookie", cookie).set("Origin", origin).send(movementBody);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  const mismatchedReplay = await request(app).post("/api/inventory/purchases").set("Cookie", cookie).set("Origin", origin).send({ ...movementBody, purchasePrice: 501 });
  assert.equal(mismatchedReplay.status, 409);
  assert.equal(await StockMovement.countDocuments({ product: created.body.product._id }), 1);
  assert.equal(await BranchInventory.countDocuments({ product: created.body.product._id, branch: fixture.branchA._id }), 1);
  assert.equal((await BranchInventory.findOne({ product: created.body.product._id, branch: fixture.branchB._id })), null);

  const outsider = await request(app).get("/api/inventory/stock?branch=" + fixture.branchB._id).set("Cookie", cookie);
  assert.equal(outsider.status, 200);
  assert.equal(outsider.body.inventory.length, 1);
  assert.equal(String(outsider.body.inventory[0].branch._id), String(fixture.branchA._id));
});

test("inventory transfers are atomic and public merchandise omits internal fields", async () => {
  const Product = require("../../src/models/Product");
  const BranchInventory = require("../../src/models/BranchInventory");
  const StockMovement = require("../../src/models/StockMovement");
  const admin = await createUser({ role: "SUPER_ADMIN", branch: null });
  const created = await Product.create({ name: "ForceStrike Gloves", sku: "GLOVE-01", category: "GLOVES", sellingPrice: 800, supplier: new mongoose.Types.ObjectId(), isPublished: true, createdBy: admin._id });
  const aStock = await BranchInventory.create({ product: created._id, branch: fixture.branchA._id, quantity: 9, purchasePrice: 300, minimumStock: 1 });
  const key = "inventory-transfer-001";
  const transferBody = { productId: String(created._id), sourceBranch: String(fixture.branchA._id), destinationBranch: String(fixture.branchB._id), quantity: 4, reason: "Balance branch stock", idempotencyKey: key };
  const transferred = await request(app).post("/api/inventory/transfers").set("Cookie", makeCookie(admin)).set("Origin", origin).send(transferBody);
  assert.equal(transferred.status, 201);
  const replay = await request(app).post("/api/inventory/transfers").set("Cookie", makeCookie(admin)).set("Origin", origin).send(transferBody);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  const mismatchedReplay = await request(app).post("/api/inventory/transfers").set("Cookie", makeCookie(admin)).set("Origin", origin).send({ ...transferBody, quantity: 3 });
  assert.equal(mismatchedReplay.status, 409);
  const branchTransfer = await request(app).post("/api/inventory/transfers").set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({ ...transferBody, idempotencyKey: "inventory-transfer-branch" });
  assert.equal(branchTransfer.status, 403);
  const sameBranch = await request(app).post("/api/inventory/transfers").set("Cookie", makeCookie(admin)).set("Origin", origin).send({ ...transferBody, destinationBranch: String(fixture.branchA._id), idempotencyKey: "inventory-transfer-same" });
  assert.equal(sameBranch.status, 400);
  const insufficient = await request(app).post("/api/inventory/transfers").set("Cookie", makeCookie(admin)).set("Origin", origin).send({ ...transferBody, quantity: 50, idempotencyKey: "inventory-transfer-short" });
  assert.equal(insufficient.status, 409);
  assert.equal((await BranchInventory.findOne({ product: created._id, branch: fixture.branchA._id })).quantity, 5);
  assert.equal((await BranchInventory.findOne({ product: created._id, branch: fixture.branchB._id })).quantity, 4);
  assert.equal(await StockMovement.countDocuments({ transferId: transferred.body.transferId }), 2);

  const publicResult = await request(app).get("/api/public/website/merchandise");
  assert.equal(publicResult.status, 200);
  const publicProduct = publicResult.body.products.find((item) => item._id === String(created._id));
  assert.equal(publicProduct.availability, "IN_STOCK");
  assert.equal("purchasePrice" in publicProduct, false);
  assert.equal("supplier" in publicProduct, false);
  assert.equal("branch" in publicProduct, false);
  assert.equal("quantity" in publicProduct, false);
});

test("merchandise orders reserve stock and paid invoices complete sales exactly once", async () => {
  const Product = require("../../src/models/Product");
  const BranchInventory = require("../../src/models/BranchInventory");
  const InventoryOrder = require("../../src/models/InventoryOrder");
  const StockMovement = require("../../src/models/StockMovement");
  const product = await Product.create({ name: "Academy Belt", sku: "BELT-01", category: "BELTS", sellingPrice: 250, createdBy: fixture.userA._id });
  await BranchInventory.create({ product: product._id, branch: fixture.branchA._id, quantity: 6, purchasePrice: 80, minimumStock: 1 });
  const cookie = makeCookie(fixture.userA);
  const orderBody = { studentId: String(fixture.studentA._id), branchId: String(fixture.branchA._id), items: [{ productId: String(product._id), quantity: 2 }], fulfillment: "PICKUP", idempotencyKey: "inventory-order-0001" };
  const created = await request(app).post("/api/inventory/orders").set("Cookie", cookie).set("Origin", origin).send(orderBody);
  assert.equal(created.status, 201);
  const order = await InventoryOrder.findById(created.body.order._id);
  assert.equal(order.status, "PAYMENT_PENDING");
  assert.equal((await BranchInventory.findOne({ product: product._id, branch: fixture.branchA._id })).reservedQuantity, 2);
  const payment = await request(app).post(`/api/finance/invoices/${order.invoice}/payments`).set("Cookie", cookie).set("Origin", origin).send({ amount: 500, method: "CASH", idempotencyKey: "inventory-payment-001", reference: "cash-counter" });
  assert.equal(payment.status, 201);
  const inventory = await BranchInventory.findOne({ product: product._id, branch: fixture.branchA._id });
  assert.equal(inventory.quantity, 4);
  assert.equal(inventory.reservedQuantity, 0);
  assert.equal((await InventoryOrder.findById(order._id)).status, "PAID");
  assert.equal(await StockMovement.countDocuments({ relatedOrder: order._id, type: "SALE" }), 1);
  const orderItem = (await InventoryOrder.findById(order._id)).items[0];
  const returned = await request(app).post(`/api/inventory/orders/${order._id}/items/${orderItem._id}/returns`).set("Cookie", cookie).set("Origin", origin).send({ quantity: 1, reason: "Correct size returned", disposition: "RESTOCK", idempotencyKey: "inventory-return-001" });
  assert.equal(returned.status, 201);
  assert.equal((await BranchInventory.findOne({ product: product._id, branch: fixture.branchA._id })).quantity, 5);
  const sale = await StockMovement.findOne({ relatedOrder: order._id, type: "SALE" });
  await assert.rejects(sale.save(), /immutable/i);
  await assert.rejects(StockMovement.updateOne({ _id: sale._id }, { $set: { reason: "rewritten" } }), /immutable/i);
  const repeated = await request(app).post(`/api/finance/invoices/${order.invoice}/payments`).set("Cookie", cookie).set("Origin", origin).send({ amount: 500, method: "CASH", idempotencyKey: "inventory-payment-001", reference: "cash-counter" });
  assert.equal(repeated.status, 200);
  assert.equal(await StockMovement.countDocuments({ relatedOrder: order._id, type: "SALE" }), 1);
});

test("stock damage prevents negative inventory and cancelling an unpaid order releases its reservation", async () => {
  const Product = require("../../src/models/Product");
  const BranchInventory = require("../../src/models/BranchInventory");
  const InventoryOrder = require("../../src/models/InventoryOrder");
  const StockMovement = require("../../src/models/StockMovement");
  const product = await Product.create({ name: "Training T-shirt", sku: "TEE-01", category: "MERCHANDISE", sellingPrice: 300, createdBy: fixture.userA._id });
  const cookie = makeCookie(fixture.userA);
  const purchase = await request(app).post("/api/inventory/purchases").set("Cookie", cookie).set("Origin", origin).send({ productId: String(product._id), branchId: String(fixture.branchA._id), quantity: 3, purchasePrice: 100, minimumStock: 1, reason: "Opening stock received", idempotencyKey: "inventory-purchase-tee" });
  assert.equal(purchase.status, 201);
  const damage = await request(app).post("/api/inventory/damage").set("Cookie", cookie).set("Origin", origin).send({ productId: String(product._id), branchId: String(fixture.branchA._id), quantity: 2, reason: "Damaged during storage", idempotencyKey: "inventory-damage-tee" });
  assert.equal(damage.status, 201);
  const overDamage = await request(app).post("/api/inventory/damage").set("Cookie", cookie).set("Origin", origin).send({ productId: String(product._id), branchId: String(fixture.branchA._id), quantity: 2, reason: "Would make stock negative", idempotencyKey: "inventory-damage-too-many" });
  assert.equal(overDamage.status, 409);
  const orderResponse = await request(app).post("/api/inventory/orders").set("Cookie", cookie).set("Origin", origin).send({ studentId: String(fixture.studentA._id), branchId: String(fixture.branchA._id), items: [{ productId: String(product._id), quantity: 1 }], fulfillment: "PICKUP", idempotencyKey: "inventory-order-cancel-1" });
  assert.equal(orderResponse.status, 201);
  const cancelled = await request(app).post(`/api/inventory/orders/${orderResponse.body.order._id}/cancel`).set("Cookie", cookie).set("Origin", origin).send({ reason: "Student changed their selection" });
  assert.equal(cancelled.status, 200);
  const inventory = await BranchInventory.findOne({ product: product._id, branch: fixture.branchA._id });
  assert.equal(inventory.quantity, 1);
  assert.equal(inventory.reservedQuantity, 0);
  assert.equal((await InventoryOrder.findById(orderResponse.body.order._id)).status, "CANCELLED");
  assert.equal(await StockMovement.countDocuments({ relatedOrder: orderResponse.body.order._id, type: "RELEASE" }), 1);
});

test("notification APIs are authenticated, paginated, branch-scoped, and user-specific", async () => {
  const own = await Notification.create({
    recipient: fixture.userA._id,
    type: "ATTENDANCE_ABSENT",
    title: "Attendance marked absent",
    message: "Student A was marked absent.",
    severity: "WARNING",
    branch: fixture.branchA._id,
    requiredPermission: "attendance.view",
    eventKey: "test:own",
    entityType: "ATTENDANCE",
    entityId: new mongoose.Types.ObjectId(),
  });
  await Notification.create({
    recipient: fixture.userA._id,
    type: "ATTENDANCE_ABSENT",
    title: "Outside branch",
    message: "This record must be hidden.",
    branch: fixture.branchB._id,
    requiredPermission: "attendance.view",
    eventKey: "test:wrong-branch",
  });
  await Notification.create({
    recipient: fixture.userB._id,
    type: "ATTENDANCE_ABSENT",
    title: "Private notification",
    message: "This belongs to another user.",
    branch: fixture.branchB._id,
    requiredPermission: "attendance.view",
    eventKey: "test:other-user",
  });

  assert.equal((await request(app).get("/api/notifications")).status, 401);
  const listed = await request(app).get("/api/notifications?page=1&limit=1").set("Cookie", makeCookie(fixture.userA));
  assert.equal(listed.status, 200);
  assert.equal(listed.body.pagination.total, 1);
  assert.equal(listed.body.notifications[0]._id, String(own._id));
  assert.equal(listed.body.pagination.hasMore, false);
  assert.equal(listed.body.unreadCount, 1);

  const unread = await request(app).get("/api/notifications/unread-count").set("Cookie", makeCookie(fixture.userA));
  assert.equal(unread.body.unreadCount, 1);
  const forbidden = await request(app).patch(`/api/notifications/${String((await Notification.findOne({ recipient: fixture.userB._id }))._id)}/read`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin);
  assert.equal(forbidden.status, 404);
  const invalid = await request(app).patch("/api/notifications/not-an-id/read").set("Cookie", makeCookie(fixture.userA)).set("Origin", origin);
  assert.equal(invalid.status, 400);

  const noAccess = await createUser({ role: "NO_ACCESS", email: "notifications-no-access@example.test" });
  await Notification.create({ recipient: noAccess._id, type: "ATTENDANCE_ABSENT", title: "Hidden", message: "No current permission.", branch: fixture.branchA._id, requiredPermission: "attendance.view" });
  const restricted = await request(app).get("/api/notifications").set("Cookie", makeCookie(noAccess));
  assert.equal(restricted.status, 200);
  assert.equal(restricted.body.pagination.total, 0);
  assert.equal(restricted.body.unreadCount, 0);
});

test("legacy inquiry notifications route to the authorized CRM page", async () => {
  const inquiryNotification = await Notification.create({
    recipient: fixture.userA._id,
    type: "INQUIRY_RECEIVED",
    title: "New inquiry received",
    message: "A prospect submitted an inquiry.",
    severity: "INFO",
    branch: fixture.branchA._id,
    requiredPermission: "inquiry.view",
    eventKey: "test:legacy-inquiry-link",
    entityType: "INQUIRY",
    entityId: new mongoose.Types.ObjectId(),
    actionUrl: "/inquiries",
  });
  const response = await request(app).get("/api/notifications?limit=10").set("Cookie", makeCookie(fixture.userA));
  assert.equal(response.status, 200);
  assert.equal(response.body.notifications.find((item) => item._id === String(inquiryNotification._id)).actionUrl, "/crm");
});

test("notification read state can be updated individually and in bulk", async () => {
  const notifications = await Notification.create([0, 1].map((index) => ({
    recipient: fixture.userA._id,
    type: "SYSTEM",
    title: `Update ${index}`,
    message: "Academy update.",
    branch: null,
    entityType: "SYSTEM",
  })));
  const cookie = makeCookie(fixture.userA);
  const one = await request(app).patch(`/api/notifications/${String(notifications[0]._id)}/read`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(one.status, 200);
  assert.equal(one.body.notification.read, true);
  assert.ok(one.body.notification.readAt);
  const all = await request(app).patch("/api/notifications/read-all").set("Cookie", cookie).set("Origin", origin);
  assert.equal(all.status, 200);
  assert.equal(all.body.modifiedCount, 1);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, read: false }), 0);
});

test("event recipient resolution isolates branches and event keys prevent duplicates", async () => {
  const { notifyAuthorizedUsers } = require("../../src/services/notification.service");
  const superAdmin = await createUser({ role: "SUPER_ADMIN", branch: null, email: "root@example.test" });
  const event = {
    type: "ATTENDANCE_ABSENT",
    title: "Attendance marked absent",
    message: "Student A was marked absent.",
    branch: fixture.branchA._id,
    student: fixture.studentA._id,
    entityType: "ATTENDANCE",
    entityId: new mongoose.Types.ObjectId(),
    eventKey: "attendance:retry-safe:absent",
    actionUrl: "/attendance",
  };
  await notifyAuthorizedUsers(event);
  await notifyAuthorizedUsers(event);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, eventKey: event.eventKey }), 1);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userB._id, eventKey: event.eventKey }), 0);
  assert.equal(await Notification.countDocuments({ recipient: superAdmin._id, eventKey: event.eventKey }), 1);
  await assert.rejects(() => notifyAuthorizedUsers({ ...event, type: "FREE_FORM" }), /Unsupported notification type/);
  await assert.rejects(() => notifyAuthorizedUsers({ ...event, actionUrl: "https://example.test" }), /internal application path/);
});

test("absent attendance creates idempotent staff notifications and a makeup", async () => {
  const { slotA } = await configureAttendanceFixture();
  const response = await markRequest(makeCookie(fixture.userA), fixture.studentA, "2026-10-05", "ABSENT", slotA);
  assert.equal(response.status, 201, response.body.message);
  assert.ok(response.body.makeup?._id);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "ATTENDANCE_ABSENT" }), 1);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "MAKEUP_CREATED" }), 1);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userB._id }), 0);
});

test("notification persistence failure does not roll back a successful absence", async () => {
  const { slotA } = await configureAttendanceFixture();
  const originalUpdateOne = Notification.updateOne;
  Notification.updateOne = async () => { throw new Error("simulated notification store failure"); };
  try {
    const response = await markRequest(makeCookie(fixture.userA), fixture.studentA, "2026-10-05", "ABSENT", slotA);
    assert.equal(response.status, 201, response.body.message);
    assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id, status: "ABSENT" }), 1);
    assert.equal(await Makeup.countDocuments({ student: fixture.studentA._id }), 1);
  } finally {
    Notification.updateOne = originalUpdateOne;
  }
});

test("login accepts valid credentials and rejects invalid or inactive accounts", async () => {
  const success = await request(app).post("/api/auth/login").send({
    email: fixture.userA.email,
    password: "correct horse battery staple",
  });
  assert.equal(success.status, 200);
  assert.match(success.headers["set-cookie"].join(";"), /forcestrike_session=/);

  const invalid = await request(app).post("/api/auth/login").send({
    email: fixture.userA.email,
    password: "wrong password",
  });
  assert.equal(invalid.status, 401);

  const inactive = await createUser({ email: "inactive@example.test", isActive: false });
  const inactiveResult = await request(app).post("/api/auth/login").send({
    email: inactive.email,
    password: "correct horse battery staple",
  });
  assert.equal(inactiveResult.status, 401);
});

test("authentication rejects missing, expired, malformed and deactivated sessions", async () => {
  assert.equal((await request(app).get("/api/auth/me")).status, 401);
  const expired = makeCookie(fixture.userA, { jwt: { expiresIn: "-1s" } });
  assert.equal((await request(app).get("/api/auth/me").set("Cookie", expired)).status, 401);
  assert.equal((await request(app).get("/api/auth/me").set("Cookie", "forcestrike_session=not-a-jwt")).status, 401);
  fixture.userA.isActive = false;
  await fixture.userA.save();
  assert.equal((await request(app).get("/api/auth/me").set("Cookie", makeCookie(fixture.userA))).status, 401);
});

test("logout clears the session cookie", async () => {
  const response = await request(app).post("/api/auth/logout");
  assert.equal(response.status, 200);
  assert.match(response.headers["set-cookie"].join(";"), /forcestrike_session=;/);
});

test("password change updates the hash and invalidates the existing session", async () => {
  const login = await request(app).post("/api/auth/login").send({
    email: fixture.userA.email,
    password: "correct horse battery staple",
  });
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const changed = await request(app).patch("/api/auth/change-password")
    .set("Cookie", cookie).set("Origin", origin)
    .send({ currentPassword: "correct horse battery staple", newPassword: "another secure test passphrase" });
  assert.equal(changed.status, 200);
  assert.equal((await request(app).get("/api/auth/me").set("Cookie", cookie)).status, 401);
  const relogin = await request(app).post("/api/auth/login").send({
    email: fixture.userA.email,
    password: "another secure test passphrase",
  });
  assert.equal(relogin.status, 200);
});

test("password recovery does not reveal whether an account exists", async () => {
  const existing = await request(app).post("/api/auth/forgot-password").send({ email: fixture.userA.email });
  const missing = await request(app).post("/api/auth/forgot-password").send({ email: "unknown@example.test" });
  assert.equal(existing.status, 202);
  assert.deepEqual(existing.body, missing.body);
});

test("public inquiry persists when SMTP is unconfigured and deduplicates recent submissions", async () => {
  const payload = {
    fullName: "Public Inquiry Test", email: "visitor@example.test", phone: "+971501234567", message: "Interested in classes", branch: String(fixture.branchA._id),
  };
  const created = await request(app).post("/api/inquiries").send(payload);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(await Inquiry.countDocuments({ email: payload.email }), 1);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "INQUIRY_RECEIVED" }), 1);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userB._id, type: "INQUIRY_RECEIVED" }), 0);

  const duplicate = await request(app).post("/api/inquiries").send(payload);
  assert.equal(duplicate.status, 202);
  assert.equal(await Inquiry.countDocuments({ email: payload.email }), 1);

  const invalid = await request(app).post("/api/inquiries").send({ ...payload, email: "invalid" });
  assert.equal(invalid.status, 400);
  const oversized = await request(app).post("/api/inquiries").send({ ...payload, message: "x".repeat(2001) });
  assert.equal(oversized.status, 400);
});

test("branch users can create, update and deactivate their own future holidays", async () => {
  const cookie = makeCookie(fixture.userA);
  const created = await request(app).post("/api/holidays").set("Cookie", cookie).set("Origin", origin).send({
    date: "2026-12-25", name: "Winter closure", branch: String(fixture.branchB._id),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(String(created.body.holiday.branch._id || created.body.holiday.branch), String(fixture.branchA._id));

  const updated = await request(app).put(`/api/holidays/${created.body.holiday._id}`).set("Cookie", cookie).set("Origin", origin)
    .send({ name: "Updated winter closure" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.holiday.name, "Updated winter closure");

  const deleted = await request(app).delete(`/api/holidays/${created.body.holiday._id}`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(deleted.status, 200);
  assert.equal((await Holiday.findById(created.body.holiday._id)).isActive, false);
  const past = await request(app).post("/api/holidays").set("Cookie", cookie).set("Origin", origin).send({ date: "2020-01-01", name: "Past" });
  assert.equal(past.status, 400);
});

test("weekly schedule API validates sessions, filters branch scope and builds a monthly calendar", async () => {
  const cookie = makeCookie(fixture.userA);
  const program = await TrainingSessionType.create({ name: "Schedule Karate", normalizedName: "schedule-karate", slug: "schedule-karate", isActive: true });
  const weeklySchedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: dayOfWeek !== 5,
    slots: dayOfWeek === 5 ? [{ sessionName: "Friday karate", sessionTypeId: String(program._id), startTime: "10:00", endTime: "11:00", isActive: true }] : [],
  }));
  const saved = await request(app).put(`/api/branch-schedules/${fixture.branchA._id}`).set("Cookie", cookie).set("Origin", origin)
    .send({ openingTime: "08:00", closingTime: "18:00", weeklySchedule });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal((await request(app).get(`/api/branch-schedules/${fixture.branchB._id}`).set("Cookie", cookie)).status, 403);

  const calendar = await request(app).get(`/api/branch-schedules/${fixture.branchA._id}/calendar?year=2026&month=10`).set("Cookie", cookie);
  assert.equal(calendar.status, 200);
  const friday = calendar.body.days.find((day) => day.date === "2026-10-09");
  assert.equal(friday.isTrainingDay, true);
  assert.equal(friday.slots.length, 1);

  const invalid = await request(app).put(`/api/branch-schedules/${fixture.branchA._id}`).set("Cookie", cookie).set("Origin", origin)
    .send({ openingTime: "08:00", closingTime: "18:00", weeklySchedule: [{ dayOfWeek: 5, isClosed: false, slots: [{ sessionName: "Too early", sessionTypeId: String(program._id), startTime: "07:00", endTime: "08:00" }] }] });
  assert.equal(invalid.status, 400);
});

test("Session close and reopen is permission checked, attendance safe, audited once, and idempotent", async () => {
  const program = await TrainingSessionType.create({ name: "Closure Karate", normalizedName: "closure-karate", slug: "closure-karate", isActive: true });
  const futureDate = nextWeekday(1);
  const makeSession = (overrides = {}) => Session.create({
    batch: new mongoose.Types.ObjectId(), branch: fixture.branchA._id, plan: fixture.plan._id, program: program._id,
    schedule: new mongoose.Types.ObjectId(), scheduleSlotId: new mongoose.Types.ObjectId(), date: futureDate,
    dayOfWeek: new Date(`${futureDate}T12:00:00`).getDay(), startTime: "10:00", endTime: "11:00", ...overrides,
  });
  const protectedSession = await makeSession();
  await Attendance.create({
    student: fixture.studentA._id, branch: fixture.branchA._id, session: protectedSession._id,
    date: new Date(`${futureDate}T12:00:00`), planDay: 1, curriculumTitle: "History protected",
    status: "ABSENT", attendanceType: "REGULAR", markedBy: fixture.userA._id,
  });
  const protectedResponse = await request(app).patch(`/api/branch-schedules/sessions/${protectedSession._id}/status`)
    .set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({ status: "CLOSED", reason: "Coach unavailable" });
  assert.equal(protectedResponse.status, 409);
  assert.equal((await Session.findById(protectedSession._id)).status, "SCHEDULED");

  fixture.plan.duration = 3;
  fixture.plan.durationUnit = "MONTHS";
  fixture.plan.classesPerWeek = 2;
  fixture.plan.programs = [{ program: program._id, weeklyLimit: 2 }];
  await fixture.plan.save();
  await Curriculum.create({ plan: fixture.plan._id, program: program._id, version: 1, name: "Eight sessions", status: "PUBLISHED", publishedAt: new Date(), modules: [{ name: "Core", order: 1, steps: Array.from({ length: 8 }, (_, index) => ({ title: `Step ${index + 1}` })) }] });
  const mondaySlot = new mongoose.Types.ObjectId();
  const wednesdaySlot = new mongoose.Types.ObjectId();
  const weeklySchedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek, isClosed: ![1, 3].includes(dayOfWeek),
    slots: dayOfWeek === 1 ? [{ _id: mondaySlot, batchId: null, sessionTypeId: program._id, startTime: "10:00", endTime: "11:00", isActive: true }]
      : dayOfWeek === 3 ? [{ _id: wednesdaySlot, batchId: null, sessionTypeId: program._id, startTime: "12:00", endTime: "13:00", isActive: true }] : [],
  }));
  const schedule = await BranchSchedule.create({ branch: fixture.branchA._id, weeklySchedule });
  const twoWeeksBefore = new Date(`${futureDate}T12:00:00`);
  twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 21);
  const pastTrainingDate = `${twoWeeksBefore.getFullYear()}-${String(twoWeeksBefore.getMonth() + 1).padStart(2, "0")}-${String(twoWeeksBefore.getDate()).padStart(2, "0")}`;
  const batch = await Batch.create({ name: "Closure Batch", code: "CLOSE-01", branch: fixture.branchA._id, plan: fixture.plan._id, capacity: 20, status: "ACTIVE", startDate: pastTrainingDate, calculatedEndDate: calendarDateOffset(45) });
  schedule.weeklySchedule.find((day) => day.dayOfWeek === 1).slots[0].batchId = batch._id;
  schedule.weeklySchedule.find((day) => day.dayOfWeek === 3).slots[0].batchId = batch._id;
  await schedule.save();
  const wednesday = new Date(`${futureDate}T12:00:00`);
  wednesday.setDate(wednesday.getDate() + 2);
  const wednesdayDate = `${wednesday.getFullYear()}-${String(wednesday.getMonth() + 1).padStart(2, "0")}-${String(wednesday.getDate()).padStart(2, "0")}`;
  const batchSession = (date, slotId, startTime, endTime) => Session.create({
    batch: batch._id, branch: fixture.branchA._id, plan: fixture.plan._id, program: program._id,
    schedule: schedule._id, scheduleSlotId: slotId, date, dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    startTime, endTime, status: "SCHEDULED",
  });
  const absentButDelivered = await batchSession(pastTrainingDate, mondaySlot, "10:00", "11:00");
  absentButDelivered.status = "COMPLETED";
  await absentButDelivered.save();
  await Attendance.create({
    student: fixture.studentA._id, branch: fixture.branchA._id, session: absentButDelivered._id, batch: batch._id,
    plan: fixture.plan._id, sessionTypeId: program._id, sessionSlotId: mondaySlot,
    date: new Date(`${pastTrainingDate}T12:00:00`), planDay: 1, curriculumTitle: "Training occurred",
    status: "ABSENT", attendanceType: "REGULAR", markedBy: fixture.userA._id,
  });
  const mondaySession = await batchSession(futureDate, mondaySlot, "10:00", "11:00");
  const wednesdaySession = await batchSession(wednesdayDate, wednesdaySlot, "12:00", "13:00");
  const { calculateBatchCompletion } = require("../../src/services/batchCompletion.service");
  const initialCompletion = await calculateBatchCompletion(batch._id);
  assert.ok(initialCompletion.deliveredSessions >= 4 && initialCompletion.deliveredSessions < 8);
  await Batch.updateOne({ _id: batch._id }, { $set: { calculatedEndDate: initialCompletion.calculatedEndDate } });
  const originalEnd = initialCompletion.calculatedEndDate;
  const rangeEnd = originalEnd;
  const sessionCountBeforeCalendarReads = await Session.countDocuments({ batch: batch._id });
  const calendarUrl = `/api/calendar?start=${futureDate}&end=${rangeEnd}`;
  const calendarOne = await request(app).get(calendarUrl).set("Cookie", makeCookie(fixture.userA));
  const calendarTwo = await request(app).get(calendarUrl).set("Cookie", makeCookie(fixture.userA));
  assert.equal(calendarOne.status, 200, JSON.stringify(calendarOne.body));
  assert.equal(calendarTwo.status, 200, JSON.stringify(calendarTwo.body));
  const batchCalendarEvents = calendarTwo.body.events.filter((event) => String(event.metadata?.batchId) === String(batch._id));
  assert.ok(batchCalendarEvents.some((event) => event.start.date === futureDate && event.source === "session"));
  assert.equal(new Set(batchCalendarEvents.map((event) => event.id)).size, batchCalendarEvents.length);
  assert.equal(await Session.countDocuments({ batch: batch._id }), sessionCountBeforeCalendarReads);
  const calendarDate = new Date(`${futureDate}T12:00:00`);
  const availability = await request(app).get(`/api/branch-schedules/${fixture.branchA._id}/calendar?year=${calendarDate.getFullYear()}&month=${calendarDate.getMonth() + 1}`).set("Cookie", makeCookie(fixture.userA));
  assert.equal(availability.status, 200, JSON.stringify(availability.body));
  const firstAvailability = availability.body.days.find((day) => day.date === futureDate);
  assert.ok(firstAvailability.slots.some((slot) => String(slot.batchId?._id || slot.batchId) === String(batch._id)));
  const noAccess = await createUser({ role: "NO_ACCESS", email: "session-close-no-access@example.test" });
  const denied = await request(app).patch(`/api/branch-schedules/sessions/${mondaySession._id}/status`)
    .set("Cookie", makeCookie(noAccess)).set("Origin", origin).send({ status: "CLOSED", reason: "Unauthorized attempt" });
  assert.equal(denied.status, 403);
  assert.equal((await Session.findById(mondaySession._id)).status, "SCHEDULED");

  const cookie = makeCookie(fixture.userA);
  const closeMonday = () => request(app).patch(`/api/branch-schedules/sessions/${mondaySession._id}/status`).set("Cookie", cookie).set("Origin", origin)
    .send({ status: "CLOSED", reason: "Coach unavailable" });
  const firstClose = await closeMonday();
  assert.equal(firstClose.status, 200, JSON.stringify(firstClose.body));
  assert.equal(firstClose.body.session.status, "CLOSED");
  assert.equal(firstClose.body.session.closureReason, "Coach unavailable");
  assert.ok(firstClose.body.batch.calculatedEndDate > originalEnd);
  const closedCalendar = await request(app).get(calendarUrl).set("Cookie", makeCookie(fixture.userA));
  assert.ok(closedCalendar.body.events.some((event) => event.source === "session" && String(event.metadata?.sessionId) === String(mondaySession._id) && event.status === "CLOSED"));
  assert.equal(await AuditLog.countDocuments({ entityType: "SESSION", entityId: mondaySession._id, action: "SESSION_CLOSED" }), 1);
  assert.equal((await closeMonday()).status, 200);
  assert.equal(await AuditLog.countDocuments({ entityType: "SESSION", entityId: mondaySession._id, action: "SESSION_CLOSED" }), 1);
  const closeWednesday = await request(app).patch(`/api/branch-schedules/sessions/${wednesdaySession._id}/status`).set("Cookie", cookie).set("Origin", origin)
    .send({ status: "CLOSED", reason: "Branch maintenance" });
  assert.equal(closeWednesday.status, 200, JSON.stringify(closeWednesday.body));
  const completionWithTwoClosures = closeWednesday.body.batch.calculatedEndDate;
  assert.ok(completionWithTwoClosures > firstClose.body.batch.calculatedEndDate);
  assert.equal(await AuditLog.countDocuments({ entityType: "SESSION", action: "SESSION_CLOSED", entityId: { $in: [mondaySession._id, wednesdaySession._id] } }), 2);

  const reopenMonday = () => request(app).patch(`/api/branch-schedules/sessions/${mondaySession._id}/status`).set("Cookie", cookie).set("Origin", origin).send({ status: "SCHEDULED" });
  const firstReopen = await reopenMonday();
  assert.equal(firstReopen.status, 200, JSON.stringify(firstReopen.body));
  assert.equal(firstReopen.body.session.status, "SCHEDULED");
  assert.equal(firstReopen.body.session.closureReason, "");
  assert.ok(firstReopen.body.batch.calculatedEndDate < completionWithTwoClosures);
  assert.equal(await AuditLog.countDocuments({ entityType: "SESSION", entityId: mondaySession._id, action: "SESSION_REOPENED" }), 1);
  assert.equal((await reopenMonday()).status, 200);
  assert.equal(await AuditLog.countDocuments({ entityType: "SESSION", entityId: mondaySession._id, action: "SESSION_REOPENED" }), 1);
  const reopenWednesday = await request(app).patch(`/api/branch-schedules/sessions/${wednesdaySession._id}/status`).set("Cookie", cookie).set("Origin", origin).send({ status: "SCHEDULED" });
  assert.equal(reopenWednesday.status, 200, JSON.stringify(reopenWednesday.body));
  assert.equal(reopenWednesday.body.batch.calculatedEndDate, originalEnd);
});

test("student admission creates a linked login and profile; update and deactivation stay synchronized", async () => {
  const cookie = makeCookie(fixture.userA);
  const feeTerm = await makeEnrollmentFeeTerm();
  const created = await request(app).post("/api/students").set("Cookie", cookie).set("Origin", origin).send({
    name: "New Test Student", age: 19, phone: "9000000011", email: "profile@example.test",
    loginEmail: "login@example.test", loginPassword: "new student secure passphrase",
    branch: String(fixture.branchA._id), plan: String(fixture.plan._id), feeTerm: String(feeTerm._id),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const studentId = created.body.student._id;
  const linkedUserId = created.body.student.user;
  const linkedUser = await User.findById(linkedUserId).select("+password");
  assert.equal(linkedUser.email, "login@example.test");
  assert.notEqual(linkedUser.password, "new student secure passphrase");
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "STUDENT_CREATED" }), 1);

  const updated = await request(app).put(`/api/students/${studentId}`).set("Cookie", cookie).set("Origin", origin).send({ name: "Updated Test Student" });
  assert.equal(updated.status, 200);
  assert.equal((await Student.findById(studentId)).name, "Updated Test Student");

  const completed = await request(app).put(`/api/students/${studentId}`).set("Cookie", cookie).set("Origin", origin).send({ status: "COMPLETED" });
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "STUDENT_COMPLETED" }), 1);

  const deactivated = await request(app).delete(`/api/students/${studentId}`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(deactivated.status, 200);
  assert.equal((await Student.findById(studentId)).status, "INACTIVE");
  assert.equal((await User.findById(linkedUserId)).isActive, false);
});

test("student admission reserves a selected Batch before creating the new student profile", async () => {
  const program = await TrainingSessionType.create({ name: "Batch Admission Regression", normalizedName: "batch admission regression", slug: "batch-admission-regression" });
  fixture.plan.classesPerWeek = 1;
  fixture.plan.programs = [{ program: program._id }];
  await fixture.plan.save();
  await Curriculum.create({
    plan: fixture.plan._id,
    program: program._id,
    version: 1,
    name: "Admission Regression Curriculum",
    status: "PUBLISHED",
    publishedAt: new Date(),
    modules: [{ name: "Basics", order: 1, steps: [{ title: "First lesson" }] }],
  });
  const batch = await Batch.create({
    name: "Admission Regression Batch",
    code: "ADMISSION-REGRESSION-01",
    plan: fixture.plan._id,
    branch: fixture.branchA._id,
    capacity: 5,
    status: "ACTIVE",
    startDate: calendarDateOffset(0),
    calculatedEndDate: calendarDateOffset(14),
  });
  const feeTerm = await makeEnrollmentFeeTerm();
  const response = await request(app).post("/api/students")
    .set("Cookie", makeCookie(fixture.userA)).set("Origin", origin)
    .send({
      name: "Batch Admission Regression Student",
      age: 18,
      phone: "9000000991",
      loginEmail: "batch-admission-regression@example.test",
      branch: String(fixture.branchA._id),
      plan: String(fixture.plan._id),
      feeTerm: String(feeTerm._id),
      batch: String(batch._id),
      joinDate: calendarDateOffset(0),
    });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(String(response.body.student.planEnrollments[0].batch), String(batch._id));
  assert.equal(await Student.countDocuments({ "planEnrollments.batch": batch._id }), 1);
});

test("reset token is single use; invalid and expired tokens are rejected", async () => {
  const token = "integration-reset-token";
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await PasswordResetToken.create({
    user: fixture.userA._id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const body = { token, newPassword: "reset password integration passphrase" };
  const reset = await request(app).post("/api/auth/reset-password").send(body);
  assert.equal(reset.status, 200);
  assert.equal((await request(app).post("/api/auth/reset-password").send(body)).status, 400);
  assert.equal((await request(app).post("/api/auth/reset-password").send({
    token: "invalid-token", newPassword: "reset password integration passphrase",
  })).status, 400);

  const expiredToken = "expired-integration-token";
  await PasswordResetToken.create({
    user: fixture.userA._id,
    tokenHash: crypto.createHash("sha256").update(expiredToken).digest("hex"),
    expiresAt: new Date(Date.now() - 60_000),
  });
  assert.equal((await request(app).post("/api/auth/reset-password").send({
    token: expiredToken, newPassword: "reset password integration passphrase",
  })).status, 400);
});

test("role permissions are database-backed and changes apply to existing sessions", async () => {
  const noAccess = await createUser({ email: "no-access@example.test", role: "NO_ACCESS" });
  assert.equal((await request(app).get("/api/students").set("Cookie", makeCookie(noAccess))).status, 403);

  const unknownRole = await createUser({ email: "unknown-role@example.test", role: "MISSING_ROLE" });
  assert.equal((await request(app).get("/api/students").set("Cookie", makeCookie(unknownRole))).status, 403);

  const login = await request(app).post("/api/auth/login").send({
    email: fixture.userA.email,
    password: "correct horse battery staple",
  });
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const role = await Role.findOne({ key: "TEST_BRANCH" });
  role.permissions = [];
  await role.save();
  assert.equal((await request(app).get("/api/students").set("Cookie", cookie)).status, 403);
});

test("branch A cannot list, read, modify, delete or create student records in branch B", async () => {
  const cookie = makeCookie(fixture.userA);
  const list = await request(app).get(`/api/students?branch=${fixture.branchB._id}`).set("Cookie", cookie);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.students.map((student) => student._id), [String(fixture.studentA._id)]);

  assert.equal((await request(app).get(`/api/students/${fixture.studentB._id}`).set("Cookie", cookie)).status, 403);
  assert.equal((await request(app).put(`/api/students/${fixture.studentB._id}`).set("Cookie", cookie).set("Origin", origin).send({ name: "Changed" })).status, 403);
  assert.equal((await request(app).delete(`/api/students/${fixture.studentB._id}`).set("Cookie", cookie).set("Origin", origin)).status, 403);

  const create = await request(app).post("/api/students").set("Cookie", cookie).set("Origin", origin).send({
    name: "Payload Attack", age: 20, phone: "9000000003", email: "payload@example.test",
    loginEmail: "payload-login@example.test", loginPassword: "payload attack test passphrase",
    branch: String(fixture.branchB._id), plan: String(fixture.plan._id),
  });
  assert.equal(create.status, 403);
  assert.equal(await Student.countDocuments({ branch: fixture.branchB._id }), 1);
  assert.equal((await Student.findById(fixture.studentB._id)).status, "ACTIVE");
});

test("branch-scoped attendance, holiday, makeup and schedule reads do not cross branches", async () => {
  const cookie = makeCookie(fixture.userA);
  const attendanceA = await Attendance.create({
    student: fixture.studentA._id, branch: fixture.branchA._id, date: new Date("2026-04-10T12:00:00Z"),
    planDay: 1, curriculumTitle: "Basics", status: "PRESENT", markedBy: fixture.userA._id,
  });
  await Attendance.create({
    student: fixture.studentB._id, branch: fixture.branchB._id, date: new Date("2026-04-10T12:00:00Z"),
    planDay: 1, curriculumTitle: "Basics", status: "PRESENT", markedBy: fixture.userB._id,
  });
  const attendance = await request(app).get(`/api/attendance?branch=${fixture.branchB._id}&student=${fixture.studentB._id}`).set("Cookie", cookie);
  assert.equal(attendance.status, 200);
  assert.deepEqual(attendance.body.attendance, []);
  assert.equal((await request(app).get(`/api/attendance/${attendanceA._id}`).set("Cookie", makeCookie(fixture.userB))).status, 403);

  const holidayB = await Holiday.create({
    date: new Date("2026-04-11T00:00:00Z"), name: "Branch B holiday", branch: fixture.branchB._id, createdBy: fixture.userB._id,
  });
  const holidays = await request(app).get(`/api/holidays?branch=${fixture.branchB._id}`).set("Cookie", cookie);
  assert.equal(holidays.status, 403);
  assert.equal((await request(app).put(`/api/holidays/${holidayB._id}`).set("Cookie", cookie).set("Origin", origin).send({ name: "Changed" })).status, 403);
  assert.equal((await request(app).delete(`/api/holidays/${holidayB._id}`).set("Cookie", cookie).set("Origin", origin)).status, 403);

  const holidayA = await Holiday.create({ date: new Date("2026-04-12T00:00:00Z"), name: "Branch A holiday", branch: fixture.branchA._id, createdBy: fixture.userA._id });
  const globalHoliday = await Holiday.create({ date: new Date("2026-04-13T00:00:00Z"), name: "Academy holiday", branch: null, createdBy: fixture.userA._id });
  const visibleHolidays = await request(app).get("/api/holidays").set("Cookie", cookie);
  assert.equal(visibleHolidays.status, 200);
  assert.deepEqual(visibleHolidays.body.holidays.map(({ _id }) => _id).sort(), [String(globalHoliday._id), String(holidayA._id)].sort());

  const makeupB = await Makeup.create({
    student: fixture.studentB._id, branch: fixture.branchB._id, originalAttendance: (await Attendance.findOne({ student: fixture.studentB._id }))._id,
    planDay: 1, originalDate: new Date("2026-04-10T12:00:00Z"), status: "SCHEDULED",
  });
  const makeups = await request(app).get(`/api/makeups?branch=${fixture.branchB._id}`).set("Cookie", cookie);
  assert.equal(makeups.status, 200);
  assert.deepEqual(makeups.body.makeups, []);
  assert.equal((await request(app).get(`/api/makeups/${makeupB._id}`).set("Cookie", cookie)).status, 403);

  assert.equal((await request(app).get(`/api/branch-schedules/${fixture.branchB._id}`).set("Cookie", cookie)).status, 403);

  const program = await TrainingSessionType.create({ name: "Branch Test Karate", normalizedName: "branch-test-karate", slug: "branch-test-karate", isActive: true });
  const performanceValues = {
    attendance: attendanceA._id, planDay: 1, curriculumTitle: "Basics", skill: "stance", rating: 4,
    evaluatedBy: fixture.userA._id, evaluationDate: new Date("2026-04-10T12:00:00Z"), sessionTypeId: program._id,
  };
  const performanceA = await Performance.create({ ...performanceValues, student: fixture.studentA._id, branch: fixture.branchA._id });
  const attendanceB = await Attendance.findOne({ student: fixture.studentB._id });
  const performanceB = await Performance.create({ ...performanceValues, attendance: attendanceB._id, student: fixture.studentB._id, branch: fixture.branchB._id });
  const performances = await request(app).get(`/api/performance?branch=${fixture.branchB._id}`).set("Cookie", cookie);
  assert.equal(performances.status, 200);
  assert.deepEqual(performances.body.performance.map(({ _id }) => String(_id)), [String(performanceA._id)]);
  assert.equal((await request(app).get(`/api/performance/${performanceB._id}`).set("Cookie", cookie)).status, 403);
  assert.equal((await request(app).get(`/api/performance/student/${fixture.studentB._id}`).set("Cookie", cookie)).status, 403);
  assert.equal((await request(app).get(`/api/promotions/history/${fixture.studentB._id}`).set("Cookie", cookie)).status, 403);

  await Attendance.create({
    student: fixture.studentA._id, branch: fixture.branchA._id, date: new Date("2026-04-10T12:00:00Z"),
    planDay: 1, curriculumTitle: "Recovered basics", status: "PRESENT", attendanceType: "MAKEUP", markedBy: fixture.userA._id,
  });

  const report = await request(app).get(`/api/reports/summary?branch=${fixture.branchB._id}&year=2026`).set("Cookie", cookie);
  assert.equal(report.status, 200);
  assert.equal(report.body.data.overview.totalStudents, 1);
  assert.equal(report.body.data.attendance.total, 1);
  assert.equal(report.body.data.attendance.present, 1);
  assert.equal(report.body.data.attendance.absent, 0);
  assert.equal(report.body.data.studentAttendance.length, 1);
  assert.equal(report.body.data.studentAttendance[0]._id, String(fixture.studentA._id));
});

test("startup repairs inactive required system modules such as Reports", async () => {
  const Module = require("../../src/models/Module");
  const { ensureDefaultModules } = require("../../src/config/defaultModules");
  await Module.create({
    key: "reports", label: "Reports", href: "/reports", icon: "FileText", order: 98,
    requiredPermission: "report.view", allowedRoles: ["SUPER_ADMIN"], isActive: false, isSystem: true,
  });

  await ensureDefaultModules();

  const reports = await Module.findOne({ key: "reports" }).lean();
  assert.equal(reports.isActive, true);
  assert.equal(reports.isSystem, true);

  const progress = await Module.find({ key: "progress", href: "/progress" }).lean();
  assert.equal(progress.length, 1);
  assert.equal(progress[0].requiredPermission, "student.view");
  const grading = await Module.findOne({ key: "grading", href: "/grading" }).lean();
  assert.equal(grading?.isActive, true);
  assert.equal(grading?.requiredPermission, "grading.view");
  const promotions = await Module.find({ key: "promotions", href: "/promotions" }).lean();
  assert.equal(promotions.length, 1);
  assert.equal(promotions[0].requiredPermission, "promotion.view");

  const branchAdminRole = await Role.create({
    key: "BRANCH_ADMIN",
    name: "Branch Admin",
    dataScope: "BRANCH",
    permissions: ["student.view", "training_session_type.view", "promotion.view"],
  });
  const branchAdmin = await createUser({ role: branchAdminRole.key, branch: fixture.branchA._id });
  const navigation = await request(app)
    .get("/api/modules/navigation")
    .set("Cookie", makeCookie(branchAdmin));
  assert.equal(navigation.status, 200);
  assert.equal(navigation.body.modules.filter((module) => module.key === "progress").length, 1);
  assert.equal(navigation.body.modules.filter((module) => module.key === "promotions").length, 1);
  assert.equal(navigation.body.modules.find((module) => module.key === "training-session-types")?.href, "/training-session-types");

  const progressDetail = await request(app)
    .get(`/api/progress/student/${fixture.studentA._id}`)
    .set("Cookie", makeCookie(branchAdmin));
  assert.equal(progressDetail.status, 200, JSON.stringify(progressDetail.body));
  const crossBranchProgress = await request(app)
    .get(`/api/progress/student/${fixture.studentB._id}`)
    .set("Cookie", makeCookie(branchAdmin));
  assert.equal(crossBranchProgress.status, 403);
});

test("attendance uniqueness index rejects duplicate student/calendar-date records across sessions", async () => {
  const sessionSlotId = new mongoose.Types.ObjectId();
  const values = {
    student: fixture.studentA._id, branch: fixture.branchA._id, date: new Date("2026-04-12T12:00:00Z"),
    sessionSlotId, planDay: 1, curriculumTitle: "Basics", status: "PRESENT", markedBy: fixture.userA._id,
  };
  await Attendance.create(values);
  await assert.rejects(Attendance.create({ ...values, sessionSlotId: new mongoose.Types.ObjectId() }), (error) => error.code === 11000);
});

test("attendance API rejects malformed data and cannot mark a student in another branch", async () => {
  const cookie = makeCookie(fixture.userA);
  const invalidStudent = await request(app).post("/api/attendance").set("Cookie", cookie).set("Origin", origin)
    .send({ student: "not-an-object-id", date: "2026-04-10", status: "PRESENT" });
  assert.equal(invalidStudent.status, 400);

  const branchEscape = await request(app).post("/api/attendance").set("Cookie", cookie).set("Origin", origin)
    .send({ student: String(fixture.studentB._id), date: "2026-04-10", status: "PRESENT" });
  assert.equal(branchEscape.status, 403);
  assert.equal(await Attendance.countDocuments({ student: fixture.studentB._id }), 0);
});

test("daily attendance excludes students registered after the selected date and includes them on their join date", async () => {
  fixture.studentC = await createStudent({
    name: "Joined October 2",
    phone: "9000000033",
    branch: fixture.branchA._id,
  });
  fixture.studentC.joinDate = new Date(2026, 9, 2);
  await fixture.studentC.save();
  await configureAttendanceFixture({ studentIds: ["studentC"] });
  const cookie = makeCookie(fixture.userA);

  const beforeRegistration = await request(app).get("/api/attendance/daily-sheet?date=2026-10-01").set("Cookie", cookie);
  assert.equal(beforeRegistration.status, 200, JSON.stringify(beforeRegistration.body));
  assert.ok(!beforeRegistration.body.rows.some((row) => String(row.student._id) === String(fixture.studentC._id)));

  const onRegistrationDate = await request(app).get("/api/attendance/daily-sheet?date=2026-10-02").set("Cookie", cookie);
  assert.equal(onRegistrationDate.status, 200, JSON.stringify(onRegistrationDate.body));
  assert.ok(onRegistrationDate.body.rows.some((row) => String(row.student._id) === String(fixture.studentC._id)));
});

test("attendance records present and absent states, creates one makeup, and blocks holidays and duplicates", async () => {
  const program = await TrainingSessionType.create({ name: "Karate", normalizedName: "karate", slug: "karate", isActive: true });
  const curriculum = [{ day: 1, title: "Fundamentals", skill: "stance" }];
  fixture.plan.programs = [{ program: program._id, curriculum, weeklyLimit: 4 }];
  await fixture.plan.save();
  fixture.studentA.planEnrollments = [{
    plan: fixture.plan._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", classesPerWeek: 4,
    programs: [{ program: program._id, weeklyLimit: 4, curriculum }],
  }];
  await fixture.studentA.save();

  const oneSlot = {
    sessionName: "Karate class", sessionTypeId: program._id, startTime: "10:00", endTime: "11:00", isActive: true,
  };
  const weeklySchedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: ![5, 6].includes(dayOfWeek),
    slots: [5, 6].includes(dayOfWeek) ? [oneSlot] : [],
  }));
  const schedule = await BranchSchedule.create({ branch: fixture.branchA._id, weeklySchedule });
  const slotId = schedule.weeklySchedule.find((day) => day.dayOfWeek === 6).slots[0]._id;
  const cookie = makeCookie(fixture.userA);

  const absent = await request(app).post("/api/attendance").set("Cookie", cookie).set("Origin", origin).send({
    student: String(fixture.studentA._id), date: "2026-10-09", status: "ABSENT", makeupRequired: true,
  });
  assert.equal(absent.status, 201, JSON.stringify(absent.body));
  assert.equal(absent.body.attendance.status, "ABSENT");
  assert.equal(absent.body.makeup.status, "SCHEDULED");
  assert.equal(await Makeup.countDocuments({ originalAttendance: absent.body.attendance._id }), 1);

  const duplicate = await request(app).post("/api/attendance").set("Cookie", cookie).set("Origin", origin).send({
    student: String(fixture.studentA._id), date: "2026-10-09", status: "ABSENT", makeupRequired: true,
  });
  assert.equal(duplicate.status, 409);
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id }), 1);

  const makeupSchedule = await request(app).put(`/api/makeups/${absent.body.makeup._id}/schedule`)
    .set("Cookie", cookie).set("Origin", origin)
    .send({ makeupDate: "2026-10-10", sessionSlotId: String(slotId) });
  assert.equal(makeupSchedule.status, 200, JSON.stringify(makeupSchedule.body));
  assert.equal((await Makeup.findById(absent.body.makeup._id)).makeupDate.toISOString(), new Date("2026-10-09T18:30:00.000Z").toISOString());

  await Holiday.create({ date: new Date("2026-10-16T00:00:00.000Z"), name: "Future holiday", branch: fixture.branchA._id, createdBy: fixture.userA._id });
  const onHoliday = await request(app).post("/api/attendance").set("Cookie", cookie).set("Origin", origin).send({
    student: String(fixture.studentA._id), date: "2026-10-16", status: "PRESENT",
  });
  assert.equal(onHoliday.status, 409);
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id, date: { $gte: new Date("2026-10-15T18:30:00Z"), $lt: new Date("2026-10-16T18:30:00Z") } }), 0);
});

test("PRESENT consumes one regular curriculum day and returns the next day without creating a makeup", async () => {
  const { slotA, curriculum } = await configureAttendanceFixture();
  const response = await markRequest(makeCookie(fixture.userA), fixture.studentA, "2026-10-03", "PRESENT", slotA);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.attendance.planDay, 1);
  assert.equal(response.body.attendance.curriculumTitle, curriculum[0].title);
  assert.equal(response.body.progression.nextDay, 2);
  assert.equal(response.body.makeup, null);
  assert.equal(await Makeup.countDocuments({ originalAttendance: response.body.attendance._id }), 0);
  assert.equal(await Notification.countDocuments({ type: "ATTENDANCE_ABSENT" }), 0);
});

test("undoing PRESENT removes its record and releases the regular curriculum day", async () => {
  const { slotA } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const today = calendarDateOffset(0);
  const marked = await markRequest(cookie, fixture.studentA, today, "PRESENT", slotA);
  assert.equal(marked.status, 201, JSON.stringify(marked.body));
  const undone = await request(app).post(`/api/attendance/${marked.body.attendance._id}/undo`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id }), 0);
  const sheet = await request(app).get(`/api/attendance/daily-sheet?date=${today}`).set("Cookie", cookie);
  assert.equal(sheet.status, 200, JSON.stringify(sheet.body));
  assert.equal(sheet.body.rows.find((row) => String(row.student._id) === String(fixture.studentA._id)).attendance, null);
});

test("undoing ABSENT removes its pending makeup with the attendance", async () => {
  const { slotA } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const marked = await markRequest(cookie, fixture.studentA, calendarDateOffset(0), "ABSENT", slotA);
  const undone = await request(app).post(`/api/attendance/${marked.body.attendance._id}/undo`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id }), 0);
  assert.equal(await Makeup.countDocuments({ student: fixture.studentA._id }), 0);
});

test("historical attendance cannot be undone or deleted without the correction workflow", async () => {
  const { slotA } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const marked = await markRequest(cookie, fixture.studentA, calendarDateOffset(-1), "PRESENT", slotA);
  assert.equal(marked.status, 201, JSON.stringify(marked.body));
  const response = await request(app).post(`/api/attendance/${marked.body.attendance._id}/undo`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "HISTORICAL_ATTENDANCE_REQUIRES_CORRECTION");
  assert.ok(await Attendance.exists({ _id: marked.body.attendance._id }));
});

test("attendance undo rejects completed makeup recovery and linked performance history", async () => {
  const { slotA } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const today = calendarDateOffset(0);
  const absent = await markRequest(cookie, fixture.studentA, today, "ABSENT", slotA);
  const makeup = await Makeup.findById(absent.body.makeup._id);
  makeup.status = "COMPLETED";
  await makeup.save();
  let rejected = await request(app).post(`/api/attendance/${absent.body.attendance._id}/undo`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.code, "ATTENDANCE_HAS_COMPLETED_MAKEUP");

  await Makeup.deleteOne({ _id: makeup._id });
  await Attendance.deleteOne({ _id: absent.body.attendance._id });
  const present = await markRequest(cookie, fixture.studentA, today, "PRESENT", slotA);
  await Performance.create({
    student: fixture.studentA._id, branch: fixture.branchA._id, attendance: present.body.attendance._id,
    plan: fixture.plan._id, sessionTypeId: present.body.attendance.sessionTypeId,
    planDay: 2, curriculumTitle: "Lesson 2", skill: "stance", rating: 4,
    evaluatedBy: fixture.userA._id, evaluationDate: new Date(),
  });
  rejected = await request(app).post(`/api/attendance/${present.body.attendance._id}/undo`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.code, "ATTENDANCE_HAS_PERFORMANCE");
});

test("ABSENT creates one exact curriculum snapshot but does not advance attended progression", async () => {
  const { slotA, curriculum } = await configureAttendanceFixture();
  const response = await request(app).post("/api/attendance").set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({
    student: String(fixture.studentA._id), date: "2026-10-03", status: "ABSENT", makeupRequired: false, sessionSlotId: slotA,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.attendance.status, "ABSENT");
  assert.equal(response.body.attendance.planDay, 1);
  assert.equal(response.body.makeup.planDay, 1);
  assert.equal(response.body.makeup.curriculumTitle, curriculum[0].title);
  assert.equal(response.body.progression.nextDay, 1);
  assert.equal(await Makeup.countDocuments({ originalAttendance: response.body.attendance._id }), 1);
});

test("an unresolved absence leaves the learning day outstanding until the student attends", async () => {
  const { slotA, slotB } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const absent = await markRequest(cookie, fixture.studentA, "2026-10-02", "ABSENT", slotA);
  assert.equal(absent.status, 201, JSON.stringify(absent.body));
  const nextDay = await markRequest(cookie, fixture.studentA, "2026-10-03", "PRESENT", slotB);
  assert.equal(nextDay.status, 201, JSON.stringify(nextDay.body));
  assert.equal(nextDay.body.attendance.planDay, 1);
  assert.equal(nextDay.body.progression.nextDay, 2);
});

test("a later makeup completion keeps its original lesson snapshot and does not alter regular progression", async () => {
  const { slotA, slotB } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const absent = await markRequest(cookie, fixture.studentA, "2026-10-01", "ABSENT", slotA);
  assert.equal(absent.status, 201, JSON.stringify(absent.body));
  await markRequest(cookie, fixture.studentA, "2026-10-02", "PRESENT", slotA);
  await markRequest(cookie, fixture.studentA, "2026-10-03", "PRESENT", slotA);
  await markRequest(cookie, fixture.studentA, "2026-10-04", "PRESENT", slotA);
  await markRequest(cookie, fixture.studentA, "2026-10-05", "PRESENT", slotA);
  const before = require("../../src/services/programProgress.service");
  const curriculum = fixture.plan.programs[0].curriculum;
  const progressBefore = await before.getProgramLearningProgress({ studentId: fixture.studentA._id, programId: absent.body.attendance.sessionTypeId, curriculum, asOfDate: "2026-10-05" });
  assert.equal(progressBefore.currentTrainingDay, 4);

  const scheduled = await request(app).put(`/api/makeups/${absent.body.makeup._id}/schedule`)
    .set("Cookie", cookie).set("Origin", origin).send({ makeupDate: calendarDateOffset(), sessionSlotId: slotB });
  assert.equal(scheduled.status, 200, JSON.stringify(scheduled.body));
  const completed = await request(app).put(`/api/makeups/${absent.body.makeup._id}/complete`)
    .set("Cookie", cookie).set("Origin", origin).send({});
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  assert.equal(completed.body.makeup.planDay, 1);
  assert.equal(completed.body.makeup.curriculumTitle, "Lesson 1");
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "MAKEUP_SCHEDULED" }), 1);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "MAKEUP_COMPLETED" }), 1);
  const progressAfter = await before.getProgramLearningProgress({ studentId: fixture.studentA._id, programId: absent.body.attendance.sessionTypeId, curriculum, asOfDate: "2026-10-05" });
  assert.equal(progressAfter.currentTrainingDay, 4);
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id, attendanceType: "MAKEUP" }), 1);
});

test("another session slot cannot bypass the student/date regular attendance rule", async () => {
  const { slotA, slotB } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const first = await markRequest(cookie, fixture.studentA, "2026-10-03", "PRESENT", slotA);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const duplicate = await markRequest(cookie, fixture.studentA, "2026-10-03", "PRESENT", slotB);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "ATTENDANCE_ALREADY_MARKED");
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id, attendanceType: "REGULAR" }), 1);
});

test("a duplicate absent request through another slot cannot create another makeup", async () => {
  const { slotA, slotB } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const first = await markRequest(cookie, fixture.studentA, "2026-10-03", "ABSENT", slotA);
  const duplicate = await markRequest(cookie, fixture.studentA, "2026-10-03", "ABSENT", slotB);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "ATTENDANCE_ALREADY_MARKED");
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id, attendanceType: "REGULAR" }), 1);
  assert.equal(await Makeup.countDocuments({ student: fixture.studentA._id }), 1);
});

test("simultaneous different-slot attendance requests have one winner and one recovery at most", async () => {
  const { slotA, slotB } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const responses = await Promise.all([
    markRequest(cookie, fixture.studentA, "2026-10-03", "ABSENT", slotA),
    markRequest(cookie, fixture.studentA, "2026-10-03", "ABSENT", slotB),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const conflict = responses.find((response) => response.status === 409);
  assert.equal(conflict.body.code, "ATTENDANCE_ALREADY_MARKED");
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id, attendanceType: "REGULAR" }), 1);
  assert.equal(await Makeup.countDocuments({ student: fixture.studentA._id }), 1);
});

test("manual makeup recovery snapshots the original absence, not the student's later current day", async () => {
  const { slotA } = await configureAttendanceFixture();
  const date = (day) => new Date(2026, 9, day);
  const records = [];
  for (let day = 1; day <= 5; day += 1) {
    records.push(await Attendance.create({
      student: fixture.studentA._id, branch: fixture.branchA._id, plan: fixture.plan._id,
      enrollment: fixture.studentA.planEnrollments[0]._id,
      sessionTypeId: fixture.plan.programs[0].program, sessionSlotId: slotA, date: date(day),
      planDay: day, curriculumTitle: `Lesson ${day}`, curriculumSkill: `Skill ${day}`,
      status: day === 2 ? "ABSENT" : "PRESENT", makeupRequired: false, markedBy: fixture.userA._id,
    }));
  }
  const cookie = makeCookie(fixture.userA);
  const created = await request(app).post("/api/makeups").set("Cookie", cookie).set("Origin", origin).send({
    student: String(fixture.studentA._id), originalAttendance: String(records[1]._id), makeupDate: calendarDateOffset(),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.makeup.planDay, 2);
  assert.equal(created.body.makeup.curriculumTitle, "Lesson 2");
  const progress = await require("../../src/services/programProgress.service").getProgramLearningProgress({
    studentId: fixture.studentA._id, programId: fixture.plan.programs[0].program,
    enrollmentId: fixture.studentA.planEnrollments[0]._id, curriculum: fixture.plan.programs[0].curriculum, asOfDate: "2026-10-05",
  });
  assert.equal(progress.currentTrainingDay, 1, "a later Present record does not skip the earlier absent step");
});

test("holiday and closed branch days create no regular attendance, makeup, or progression", async () => {
  const { schedule, slotA, program, curriculum } = await configureAttendanceFixture();
  const sunday = schedule.weeklySchedule.find((item) => item.dayOfWeek === 0);
  sunday.isClosed = true;
  sunday.slots = [];
  await schedule.save();
  await Holiday.create({ date: new Date(2026, 9, 3), name: "Training holiday", branch: fixture.branchA._id, createdBy: fixture.userA._id });
  const cookie = makeCookie(fixture.userA);
  const holiday = await markRequest(cookie, fixture.studentA, "2026-10-03", "ABSENT", slotA);
  const closed = await markRequest(cookie, fixture.studentA, "2026-10-04", "PRESENT", slotA);
  assert.equal(holiday.status, 409);
  assert.equal(closed.status, 409);
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id }), 0);
  assert.equal(await Makeup.countDocuments({ student: fixture.studentA._id }), 0);
  const progress = await require("../../src/services/programProgress.service").getProgramLearningProgress({ studentId: fixture.studentA._id, programId: program._id, curriculum });
  assert.equal(progress.currentTrainingDay, 0);
});

test("bulk Present marks at most one regular attendance per student/date", async () => {
  fixture.studentB.branch = fixture.branchA._id;
  await fixture.studentB.save();
  await configureAttendanceFixture({ studentIds: ["studentA", "studentB"] });
  const cookie = makeCookie(fixture.userA);
  const first = await request(app).post("/api/attendance/bulk-present").set("Cookie", cookie).set("Origin", origin).send({ date: "2026-10-04" });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.marked, 2, JSON.stringify(first.body));
  const second = await request(app).post("/api/attendance/bulk-present").set("Cookie", cookie).set("Origin", origin).send({ date: "2026-10-04" });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.marked, 0);
  assert.equal(await Attendance.countDocuments({ date: { $gte: new Date(2026, 9, 4), $lt: new Date(2026, 9, 5) }, attendanceType: "REGULAR" }), 2);
});

test("historical same-date slot duplicates consume only one curriculum day", async () => {
  const { program, curriculum } = await configureAttendanceFixture();
  const date = new Date(2026, 9, 3);
  await Attendance.collection.insertMany([
    { student: fixture.studentA._id, branch: fixture.branchA._id, sessionTypeId: program._id, date, planDay: 1, curriculumTitle: "Lesson 1", status: "PRESENT", markedBy: fixture.userA._id, createdAt: new Date(2026, 9, 3, 10) },
    { student: fixture.studentA._id, branch: fixture.branchA._id, sessionTypeId: program._id, date: new Date(2026, 9, 3, 11), planDay: 2, curriculumTitle: "Lesson 2", status: "PRESENT", markedBy: fixture.userA._id, createdAt: new Date(2026, 9, 3, 11) },
  ]);
  const progress = await require("../../src/services/programProgress.service").getProgramLearningProgress({ studentId: fixture.studentA._id, programId: program._id, curriculum, asOfDate: "2026-10-04" });
  assert.equal(progress.currentTrainingDay, 1);
  assert.equal(progress.nextDay, 2);
});

test("attendance date filters include India-local midnight correctly", async () => {
  const midnightIndia = new Date("2026-04-09T18:30:00.000Z");
  await Attendance.create({
    student: fixture.studentA._id, branch: fixture.branchA._id, date: midnightIndia,
    planDay: 1, curriculumTitle: "Basics", status: "PRESENT", markedBy: fixture.userA._id,
  });
  const response = await request(app).get("/api/attendance?startDate=2026-04-10&endDate=2026-04-10").set("Cookie", makeCookie(fixture.userA));
  assert.equal(response.status, 200);
  assert.equal(response.body.attendance.length, 1);
  assert.equal(new Date(response.body.attendance[0].date).toISOString(), midnightIndia.toISOString());
});

test("one login account cannot be linked to two student profiles", async () => {
  const first = await Student.create({
    user: fixture.userA._id, name: "Linked Profile One", age: 20, phone: "9000000021",
    branch: fixture.branchA._id, plan: fixture.plan._id, joinDate: new Date("2026-01-01T00:00:00Z"),
  });
  assert.ok(first._id);
  await assert.rejects(Student.create({
    user: fixture.userA._id, name: "Linked Profile Two", age: 20, phone: "9000000022",
    branch: fixture.branchA._id, plan: fixture.plan._id, joinDate: new Date("2026-01-01T00:00:00Z"),
  }), (error) => error.code === 11000);
});

test("student user-index migration replaces legacy sparse uniqueness without constraining null links", async () => {
  const { migrateStudentUserIndex } = require("../../scripts/migrateStudentUserIndex");
  const collectionName = `student_index_migration_${crypto.randomUUID().replace(/-/g, "")}`;
  const collection = mongoose.connection.db.collection(collectionName);
  await collection.createIndex({ user: 1 }, { name: "user_1", unique: true, sparse: true });
  await collection.insertOne({ name: "legacy-linked-state", user: null });
  const migrated = await migrateStudentUserIndex(collection);
  assert.equal(migrated.indexName, "student_user_objectid_unique");
  assert.deepEqual(migrated.removedIndexes, ["user_1"]);
  await collection.insertOne({ name: "another-unlinked-student", user: null });
  const linkedId = new mongoose.Types.ObjectId();
  await collection.insertOne({ name: "linked-student", user: linkedId });
  await assert.rejects(collection.insertOne({ name: "duplicate-linked-student", user: linkedId }), (error) => error.code === 11000);
  await collection.drop();
});

test("attendance date-index migration reports historical calendar-date conflicts without changing data", async () => {
  const { migrateAttendanceDateIndex } = require("../../scripts/migrateAttendanceDateIndex");
  const suffix = crypto.randomUUID().replace(/-/g, "");
  const attendanceCollection = mongoose.connection.db.collection(`attendance_migration_${suffix}`);
  const makeupCollection = mongoose.connection.db.collection(`makeup_migration_${suffix}`);
  const student = new mongoose.Types.ObjectId();
  await attendanceCollection.createIndex({ student: 1, date: 1, sessionSlotId: 1 }, { unique: true, name: "legacy_session_index" });
  await attendanceCollection.insertMany([
    { student, date: new Date("2026-10-01T18:30:00.000Z"), sessionSlotId: new mongoose.Types.ObjectId() },
    { student, date: new Date("2026-10-02T09:00:00.000Z"), sessionSlotId: new mongoose.Types.ObjectId() },
  ]);
  try {
    await assert.rejects(migrateAttendanceDateIndex({ attendanceCollection, makeupCollection, apply: true, timeZone: "Asia/Kolkata" }), /Resolve the reported historical conflicts/);
    assert.equal(await attendanceCollection.countDocuments({}), 2);
    assert.ok((await attendanceCollection.indexes()).some((index) => index.name === "legacy_session_index"));
  } finally {
    await attendanceCollection.drop();
    await makeupCollection.drop().catch(() => {});
  }
});

test("attendance date-index migration canonicalizes old dates and can be safely rerun", async () => {
  const { migrateAttendanceDateIndex } = require("../../scripts/migrateAttendanceDateIndex");
  const suffix = crypto.randomUUID().replace(/-/g, "");
  const attendanceCollection = mongoose.connection.db.collection(`attendance_migration_apply_${suffix}`);
  const makeupCollection = mongoose.connection.db.collection(`makeup_migration_apply_${suffix}`);
  const student = new mongoose.Types.ObjectId();
  const originalId = new mongoose.Types.ObjectId();
  const makeupAttendanceId = new mongoose.Types.ObjectId();
  await attendanceCollection.createIndex({ student: 1, date: 1, sessionSlotId: 1 }, { unique: true, name: "legacy_session_index" });
  await attendanceCollection.insertMany([
    { _id: originalId, student, date: new Date("2026-10-01T18:30:00.000Z"), sessionSlotId: new mongoose.Types.ObjectId(), status: "ABSENT" },
    { _id: makeupAttendanceId, student, date: new Date("2026-10-02T18:30:00.000Z"), sessionSlotId: new mongoose.Types.ObjectId(), status: "PRESENT" },
  ]);
  await makeupCollection.insertOne({ originalAttendance: originalId, makeupAttendance: makeupAttendanceId });
  try {
    await migrateAttendanceDateIndex({ attendanceCollection, makeupCollection, apply: true, timeZone: "Asia/Kolkata" });
    await migrateAttendanceDateIndex({ attendanceCollection, makeupCollection, apply: true, timeZone: "Asia/Kolkata" });
    const [original, makeupAttendance] = await Promise.all([
      attendanceCollection.findOne({ _id: originalId }),
      attendanceCollection.findOne({ _id: makeupAttendanceId }),
    ]);
    assert.equal(original.attendanceType, "REGULAR");
    assert.equal(makeupAttendance.attendanceType, "MAKEUP");
    assert.equal(original.date.toISOString(), new Date("2026-10-01T18:30:00.000Z").toISOString());
    const indexes = await attendanceCollection.indexes();
    assert.ok(indexes.some((index) => index.name === "uniq_regular_attendance_student_date"));
    assert.ok(!indexes.some((index) => index.name === "legacy_session_index"));
  } finally {
    await attendanceCollection.drop();
    await makeupCollection.drop().catch(() => {});
  }
});

test("critical attendance and performance query indexes exist in the test database", async () => {
  const attendanceIndexes = await Attendance.collection.listIndexes().toArray();
  const makeupIndexes = await Makeup.collection.listIndexes().toArray();
  const performanceIndexes = await Performance.collection.listIndexes().toArray();
  const notificationIndexes = await Notification.collection.listIndexes().toArray();
  assert.ok(attendanceIndexes.some(({ key }) => key.branch === 1 && key.date === -1));
  assert.ok(attendanceIndexes.some(({ key }) => key.student === 1 && key.sessionTypeId === 1 && key.date === 1));
  assert.ok(attendanceIndexes.some((index) => index.unique && index.key.student === 1 && index.key.date === 1 && !index.key.sessionSlotId && index.partialFilterExpression?.$or?.some((clause) => clause.attendanceType === "REGULAR")));
  assert.ok(makeupIndexes.some((index) => index.unique && index.key.originalAttendance === 1));
  assert.ok(performanceIndexes.some(({ key }) => key.branch === 1 && key.evaluationDate === -1));
  assert.ok(performanceIndexes.some(({ key }) => key.student === 1 && key.evaluationDate === -1));
  assert.ok(notificationIndexes.some((index) => index.key.recipient === 1 && index.key.read === 1 && index.key.createdAt === -1));
  assert.ok(notificationIndexes.some((index) => index.key.recipient === 1 && index.key.branch === 1 && index.key.createdAt === -1));
  assert.ok(notificationIndexes.some((index) => index.name === "uniq_notification_recipient_event" && index.unique));
  assert.ok(notificationIndexes.some((index) => index.name === "ttl_notification_expiry" && index.expireAfterSeconds === 0));
});

async function makeFinanceInvoice(user = fixture.userA, student = fixture.studentA, overrides = {}) {
  const enrollment = student.planEnrollments[0];
  return request(app).post("/api/finance/invoices").set("Cookie", makeCookie(user)).set("Origin", origin).send({
    studentId: String(student._id),
    enrollmentId: String(enrollment._id),
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    ...overrides,
  });
}

function fixtureBillingSnapshot(overrides = {}) {
  return {
    feeTerm: fixture.feeTerm._id,
    feeTermVersion: fixture.feeTerm.version,
    planName: fixture.plan.name,
    branch: fixture.branchA._id,
    branchName: fixture.branchA.name,
    amount: 100,
    billingFrequency: "MONTHLY",
    registrationFee: 20,
    taxRate: 10,
    discountRules: [],
    effectiveFrom: fixture.feeTerm.effectiveFrom,
    effectiveUntil: fixture.feeTerm.effectiveUntil,
    ...overrides,
  };
}

test("public inquiry plan catalog exposes plan identity without legacy Plan pricing", async () => {
  const response = await request(app).get("/api/plans/public");
  assert.equal(response.status, 200, response.body.message);
  const plan = response.body.plans.find((item) => String(item._id) === String(fixture.plan._id));
  assert.ok(plan);
  assert.equal(plan.name, fixture.plan.name);
  assert.equal(plan.price, undefined);
});

test("legacy Plan milestones remain readable but Plan updates cannot create or replace them", async () => {
  const root = await createUser({ role: "SUPER_ADMIN", branch: null, email: "legacy-plan-milestones@example.test" });
  const legacy = [{ day: 8, belt: "Green", skill: "Legacy skill", description: "Preserved historical configuration" }];
  fixture.plan.milestones = legacy;
  await fixture.plan.save();

  const read = await request(app).get(`/api/plans/${fixture.plan._id}`).set("Cookie", makeCookie(root));
  assert.equal(read.status, 200);
  assert.equal(read.body.plan.milestones[0].belt, "Green");

  const update = await request(app).put(`/api/plans/${fixture.plan._id}`).set("Cookie", makeCookie(root)).set("Origin", origin).send({ name: "Updated plan", milestones: [{ day: 1, belt: "Yellow" }] });
  assert.equal(update.status, 200, update.body.message);
  const saved = await Plan.findById(fixture.plan._id).lean();
  assert.equal(saved.name, "Updated plan");
  assert.deepEqual(saved.milestones.map((item) => ({ day: item.day, belt: item.belt, skill: item.skill, description: item.description })), legacy);
});

test("legacy Plan pricing APIs are removed and Plan rejects pricing fields", async () => {
  const root = await createUser({ role: "SUPER_ADMIN", branch: null, email: "finance-root@example.test" });
  const removedList = await request(app).get("/api/finance/plans").set("Cookie", makeCookie(root));
  assert.equal(removedList.status, 404);
  const removedUpdate = await request(app).put(`/api/finance/plans/${fixture.plan._id}`).set("Cookie", makeCookie(root)).set("Origin", origin).send({ price: 500 });
  assert.equal(removedUpdate.status, 404);
  const rejectedPlanPrice = await request(app).put(`/api/plans/${fixture.plan._id}`).set("Cookie", makeCookie(root)).set("Origin", origin).send({ price: 500 });
  assert.equal(rejectedPlanPrice.status, 400);
  assert.equal((await Plan.findById(fixture.plan._id)).price, undefined);

  const invoice = await makeFinanceInvoice();
  assert.equal(invoice.status, 201, invoice.body.message);
  assert.equal(invoice.body.invoice.total, 132, "The enrollment's immutable amount and tax snapshot apply to its invoice");
  assert.equal(invoice.body.invoice.items[0].description, "Basic Plan");
});

test("Plan renames preserve frozen enrollment and financial history", async () => {
  const root = await createUser({ role: "SUPER_ADMIN", branch: null, email: "plan-rename-root@example.test" });
  const originalInvoice = await makeFinanceInvoice(fixture.userA, fixture.studentA);
  assert.equal(originalInvoice.status, 201, originalInvoice.body.message);
  const originalPayment = await request(app)
    .post(`/api/finance/invoices/${originalInvoice.body.invoice._id}/payments`)
    .set("Cookie", makeCookie(fixture.userA))
    .set("Origin", origin)
    .set("Idempotency-Key", "plan-rename-history-payment-001")
    .send({ amount: 50, method: "CASH" });
  assert.equal(originalPayment.status, 201, originalPayment.body.message);

  const beforeStudent = await Student.findById(fixture.studentA._id).lean();
  const beforeInvoice = await Invoice.findById(originalInvoice.body.invoice._id).lean();
  const beforePayment = await Payment.findById(originalPayment.body.payment._id).lean();
  const beforeReceipt = await Receipt.findById(originalPayment.body.receipt._id).lean();
  const beforeHistory = JSON.parse(JSON.stringify({
    billingSnapshot: beforeStudent.planEnrollments[0].billingSnapshot,
    items: beforeInvoice.items,
    subtotal: beforeInvoice.subtotal,
    discount: beforeInvoice.discount,
    tax: beforeInvoice.tax,
    total: beforeInvoice.total,
    paymentAmount: beforePayment.amount,
    paymentReference: beforePayment.referenceId,
    receiptNumber: beforeReceipt.receiptNumber,
    receiptAmount: beforeReceipt.amount,
    receiptInvoiceNumber: beforeReceipt.invoiceNumber,
  }));

  const renamed = await request(app)
    .put(`/api/plans/${fixture.plan._id}`)
    .set("Cookie", makeCookie(root))
    .set("Origin", origin)
    .send({ name: "Advanced Karate" });
  assert.equal(renamed.status, 200, renamed.body.message);

  const planOptions = await request(app)
    .get("/api/finance/plan-options")
    .set("Cookie", makeCookie(fixture.userA));
  assert.equal(planOptions.status, 200, planOptions.body.message);
  const currentPlan = planOptions.body.plans.find((item) => String(item._id) === String(fixture.plan._id));
  assert.equal(currentPlan.name, "Advanced Karate");
  assert.equal(currentPlan.price, undefined);

  const currentStudent = await request(app)
    .get(`/api/students/${fixture.studentA._id}`)
    .set("Cookie", makeCookie(root));
  assert.equal(currentStudent.status, 200, currentStudent.body.message);
  assert.equal(currentStudent.body.student.plan.name, "Advanced Karate");

  const memberships = await request(app)
    .get("/api/enrollments/dashboard")
    .set("Cookie", makeCookie(root));
  assert.equal(memberships.status, 200, memberships.body.message);
  assert.equal(
    memberships.body.memberships.find((item) => String(item.student._id) === String(fixture.studentA._id)).planName,
    "Advanced Karate",
  );

  const afterStudent = await Student.findById(fixture.studentA._id).lean();
  const afterInvoice = await Invoice.findById(originalInvoice.body.invoice._id).lean();
  const afterPayment = await Payment.findById(originalPayment.body.payment._id).lean();
  const afterReceipt = await Receipt.findById(originalPayment.body.receipt._id).lean();
  const afterHistory = JSON.parse(JSON.stringify({
    billingSnapshot: afterStudent.planEnrollments[0].billingSnapshot,
    items: afterInvoice.items,
    subtotal: afterInvoice.subtotal,
    discount: afterInvoice.discount,
    tax: afterInvoice.tax,
    total: afterInvoice.total,
    paymentAmount: afterPayment.amount,
    paymentReference: afterPayment.referenceId,
    receiptNumber: afterReceipt.receiptNumber,
    receiptAmount: afterReceipt.amount,
    receiptInvoiceNumber: afterReceipt.invoiceNumber,
  }));
  assert.deepEqual(afterHistory, beforeHistory);

  const newStudent = await createStudent({
    name: "Amit After Rename",
    phone: "9000000099",
    branch: fixture.branchA._id,
  });
  const newEnrollment = await request(app)
    .post(`/api/enrollments/students/${newStudent._id}`)
    .set("Cookie", makeCookie(root))
    .set("Origin", origin)
    .send({
      plan: String(fixture.plan._id),
      branch: String(fixture.branchA._id),
      feeTerm: String((await makeEnrollmentFeeTerm(fixture.branchA, { amount: 4000, billingFrequency: "ONE_TIME", registrationFee: 1000, taxRate: 18 }))._id),
      startDate: calendarDateOffset(0),
      createInvoice: true,
    });
  assert.equal(newEnrollment.status, 201, newEnrollment.body.message);
  assert.equal(newEnrollment.body.enrollment.billingSnapshot.planName, "Advanced Karate");
  assert.equal(newEnrollment.body.enrollment.billingSnapshot.amount, 4000);
  assert.equal(newEnrollment.body.invoice.items[0].description, "Advanced Karate");
  assert.equal(newEnrollment.body.invoice.total, 5900);
});

test("FeeTerms support scoped frequencies, effective versions, availability, and finance authorization", async () => {
  const branchACookie = makeCookie(fixture.userA);
  const branchBCookie = makeCookie(fixture.userB);
  const create = (cookie, values) => request(app)
    .post(`/api/finance/plans/${fixture.plan._id}/fee-terms`)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .send(values);
  const branchATerm = {
    branch: String(fixture.branchA._id),
    billingFrequency: "MONTHLY",
    amount: 1200,
    registrationFee: 500,
    taxRate: 18,
    discountRules: [{ name: "Sibling", type: "PERCENT", amount: 10, active: true }],
    effectiveFrom: "2027-10-01",
    effectiveUntil: "2027-12-31",
  };

  const independentName = await create(branchACookie, { ...branchATerm, feeName: "Independent label" });
  assert.equal(independentName.status, 400);

  const monthly = await create(branchACookie, branchATerm);
  assert.equal(monthly.status, 201, monthly.body.message);
  assert.equal(String(monthly.body.feeTerm.plan._id), String(fixture.plan._id));
  assert.equal(monthly.body.feeTerm.plan.name, "Basic Plan");
  assert.equal(monthly.body.feeTerm.planName, undefined);
  assert.equal(monthly.body.feeTerm.version, 1);
  const feeTermIndexes = await FeeTerm.collection.indexes();
  assert.ok(feeTermIndexes.some((index) => index.name === "uniq_fee_term_scope_start" && index.unique));
  assert.ok(feeTermIndexes.some((index) => index.name === "fee_term_branch_status_dates"));

  const quarterly = await create(branchACookie, {
    ...branchATerm,
    billingFrequency: "QUARTERLY",
    amount: 3300,
  });
  assert.equal(quarterly.status, 201, quarterly.body.message);

  const branchBMonthly = await create(branchBCookie, {
    ...branchATerm,
    branch: String(fixture.branchB._id),
    amount: 1000,
  });
  assert.equal(branchBMonthly.status, 201, branchBMonthly.body.message);

  const sequential = await create(branchACookie, {
    ...branchATerm,
    amount: 1400,
    effectiveFrom: "2028-01-01",
    effectiveUntil: "2028-03-31",
  });
  assert.equal(sequential.status, 201, sequential.body.message);
  assert.equal(sequential.body.feeTerm.version, 2);

  const overlap = await create(branchACookie, {
    ...branchATerm,
    amount: 1300,
    effectiveFrom: "2027-12-01",
    effectiveUntil: "2028-01-31",
  });
  assert.equal(overlap.status, 409);
  assert.match(overlap.body.message, /overlap/i);

  const duplicateStart = await create(branchACookie, { ...branchATerm, amount: 1250 });
  assert.equal(duplicateStart.status, 409);

  const concurrentTerms = await Promise.all([
    create(branchBCookie, {
      ...branchATerm,
      branch: String(fixture.branchB._id),
      billingFrequency: "ONE_TIME",
      amount: 4000,
      effectiveFrom: "2035-01-01",
      effectiveUntil: null,
    }),
    create(branchBCookie, {
      ...branchATerm,
      branch: String(fixture.branchB._id),
      billingFrequency: "ONE_TIME",
      amount: 4200,
      effectiveFrom: "2035-02-01",
      effectiveUntil: null,
    }),
  ]);
  assert.deepEqual(concurrentTerms.map((response) => response.status).sort(), [201, 409]);

  const future = await create(branchACookie, {
    ...branchATerm,
    billingFrequency: "ONE_TIME",
    amount: 4000,
    effectiveFrom: "2030-01-01",
    effectiveUntil: null,
  });
  assert.equal(future.status, 201, future.body.message);

  const expired = await create(branchACookie, {
    ...branchATerm,
    billingFrequency: "YEARLY",
    amount: 9000,
    effectiveFrom: "2025-01-01",
    effectiveUntil: "2025-12-31",
  });
  assert.equal(expired.status, 201, expired.body.message);

  const list = await request(app)
    .get(`/api/finance/plans/${fixture.plan._id}/fee-terms`)
    .set("Cookie", branchACookie);
  assert.equal(list.status, 200, list.body.message);
  assert.equal(list.body.feeTerms.length, 6);
  assert.ok(list.body.feeTerms.every((term) => !term.branch || String(term.branch?._id || term.branch) === String(fixture.branchA._id)));

  const scopedList = await request(app).get("/api/finance/fee-terms").set("Cookie", branchACookie);
  assert.equal(scopedList.status, 200);
  assert.ok(scopedList.body.feeTerms.every((term) => !term.branch || String(term.branch._id || term.branch) === String(fixture.branchA._id)));
  assert.equal((await request(app).get(`/api/finance/fee-terms?branchId=${fixture.branchB._id}`).set("Cookie", branchACookie)).status, 403);
  const filteredTerms = await request(app)
    .get(`/api/finance/fee-terms?planId=${fixture.plan._id}&branchId=${fixture.branchA._id}&billingFrequency=MONTHLY&status=ACTIVE&asOf=2027-11-01`)
    .set("Cookie", branchACookie);
  assert.equal(filteredTerms.status, 200);
  assert.equal(filteredTerms.body.feeTerms.length, 1);
  assert.equal(filteredTerms.body.feeTerms[0].billingFrequency, "MONTHLY");

  const available = await request(app)
    .get(`/api/finance/fee-terms/available?planId=${fixture.plan._id}&branchId=${fixture.branchA._id}&asOf=2027-11-01`)
    .set("Cookie", branchACookie);
  assert.equal(available.status, 200, available.body.message);
  assert.deepEqual(available.body.feeTerms.map((term) => term.billingFrequency).sort(), ["MONTHLY", "QUARTERLY"]);
  assert.ok(available.body.feeTerms.every((term) => term.plan.name === "Basic Plan"));
  assert.equal(available.body.availability.applicableCount, 2);

  const beforeFuture = await request(app)
    .get(`/api/finance/fee-terms/available?planId=${fixture.plan._id}&branchId=${fixture.branchA._id}&asOf=2029-12-31`)
    .set("Cookie", branchACookie);
  assert.equal(beforeFuture.status, 200);
  assert.ok(beforeFuture.body.availability.notYetEffectiveCount > 0);
  assert.ok(beforeFuture.body.availability.expiredCount > 0);
  assert.ok(!beforeFuture.body.feeTerms.some((term) => String(term._id) === String(future.body.feeTerm._id)));
  assert.ok(!beforeFuture.body.feeTerms.some((term) => String(term._id) === String(expired.body.feeTerm._id)));

  const retired = await request(app)
    .patch(`/api/finance/fee-terms/${quarterly.body.feeTerm._id}`)
    .set("Cookie", branchACookie)
    .set("Origin", origin)
    .send({ status: "RETIRED", reason: "Quarterly product withdrawn" });
  assert.equal(retired.status, 200, retired.body.message);
  const afterRetirement = await request(app)
    .get(`/api/finance/fee-terms/available?planId=${fixture.plan._id}&branchId=${fixture.branchA._id}&asOf=2027-11-01`)
    .set("Cookie", branchACookie);
  assert.equal(afterRetirement.status, 200);
  assert.deepEqual(afterRetirement.body.feeTerms.map((term) => term.billingFrequency), ["MONTHLY"]);
  assert.ok(afterRetirement.body.availability.inactiveCount > 0);

  const yearly = await create(branchACookie, {
    ...branchATerm,
    billingFrequency: "YEARLY",
    amount: 12000,
    effectiveFrom: "2027-01-01",
    effectiveUntil: null,
  });
  assert.equal(yearly.status, 201, yearly.body.message);
  const successor = await request(app)
    .post(`/api/finance/fee-terms/${yearly.body.feeTerm._id}/supersede`)
    .set("Cookie", branchACookie)
    .set("Origin", origin)
    .send({
      amount: 13200,
      registrationFee: 500,
      taxRate: 18,
      effectiveFrom: "2028-01-01",
      effectiveUntil: null,
      reason: "Annual rate revision",
    });
  assert.equal(successor.status, 201, successor.body.message);
  assert.equal(successor.body.previous.status, "RETIRED");
  assert.equal(new Date(successor.body.previous.effectiveUntil).toISOString().slice(0, 10), "2027-12-31");
  assert.equal(successor.body.feeTerm.version, yearly.body.feeTerm.version + 1);
  assert.equal(String(successor.body.feeTerm.supersedes), String(yearly.body.feeTerm._id));

  const crossBranchUpdate = await request(app)
    .patch(`/api/finance/fee-terms/${branchBMonthly.body.feeTerm._id}`)
    .set("Cookie", branchACookie)
    .set("Origin", origin)
    .send({ amount: 1100 });
  assert.equal(crossBranchUpdate.status, 404);

  const financeViewRole = await Role.create({ key: "FEE_TERM_VIEW", name: "Fee term viewer", dataScope: "BRANCH", permissions: ["finance.view"] });
  const financeViewer = await createUser({ role: financeViewRole.key, email: "fee-term-view@example.test" });
  assert.equal((await request(app).get(`/api/finance/plans/${fixture.plan._id}/fee-terms`).set("Cookie", makeCookie(financeViewer))).status, 200);
  assert.equal((await request(app).get("/api/finance/fee-terms").set("Cookie", makeCookie(financeViewer))).status, 200);
  assert.equal((await create(makeCookie(financeViewer), { ...branchATerm, effectiveFrom: "2031-01-01" })).status, 403);

  const membershipRole = await Role.create({ key: "FEE_TERM_MEMBERSHIP", name: "Fee term membership", dataScope: "BRANCH", permissions: ["membership.manage"] });
  const membershipManager = await createUser({ role: membershipRole.key, email: "fee-term-membership@example.test" });
  assert.equal((await request(app).get(`/api/finance/fee-terms/available?planId=${fixture.plan._id}&branchId=${fixture.branchA._id}&asOf=2027-11-01`).set("Cookie", makeCookie(membershipManager))).status, 200);

  assert.equal(await FinanceAudit.countDocuments({ action: "FEE_TERM_CREATED" }), 8);
  assert.equal(await FinanceAudit.countDocuments({ action: "FEE_TERM_RETIRED" }), 1);
  assert.equal(await FinanceAudit.countDocuments({ action: "FEE_TERM_SUPERSEDED" }), 1);

  const planAfter = await Plan.findById(fixture.plan._id).lean();
  for (const field of ["price", "billingFrequency", "registrationFee", "taxRate", "feeName", "branchFeeOverrides"]) {
    assert.equal(Object.hasOwn(planAfter, field), false);
  }
  assert.equal(await FeeTerm.countDocuments({ plan: fixture.plan._id }), 10);
});

test("FeeTerms allow zero tuition amounts while rejecting negative financial values", async () => {
  const cookie = makeCookie(fixture.userA);
  const valid = await request(app)
    .post(`/api/finance/plans/${fixture.plan._id}/fee-terms`)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .send({ branch: String(fixture.branchA._id), billingFrequency: "ONE_TIME", amount: 0, registrationFee: 0, taxRate: 0, effectiveFrom: "2040-01-01" });
  assert.equal(valid.status, 201, valid.body.message);
  assert.equal(valid.body.feeTerm.amount, 0);

  const invalid = await request(app)
    .post(`/api/finance/plans/${fixture.plan._id}/fee-terms`)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .send({ branch: String(fixture.branchA._id), billingFrequency: "MONTHLY", amount: -1, registrationFee: 0, taxRate: 0, effectiveFrom: "2040-01-01" });
  assert.equal(invalid.status, 400);
});

test("legacy branch override API is removed and billing requires the saved agreement", async () => {
  const removed = await request(app).put(`/api/finance/plans/${fixture.plan._id}/branch-fees`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({ branchId: String(fixture.branchA._id), amount: 220 });
  assert.equal(removed.status, 404);
  const made = await makeFinanceInvoice(fixture.userA, fixture.studentA);
  assert.equal(made.status, 201, made.body.message);
  assert.equal(made.body.invoice.total, 132, "an existing enrollment's captured fee remains billable");

  const legacyStudent = await createStudent({ name: "Legacy Unfrozen Enrollment" });
  legacyStudent.planEnrollments = [{ plan: fixture.plan._id, branch: fixture.branchA._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE" }];
  await legacyStudent.save();
  const legacyInvoice = await makeFinanceInvoice(fixture.userA, legacyStudent);
  assert.equal(legacyInvoice.status, 409, "an enrollment without a frozen snapshot cannot use Plan pricing");
  assert.match(legacyInvoice.body.message, /no valid FeeTerm billing agreement/i);
});

test("invoice creation recognizes zero-valued frozen FeeTerm agreements and rejects missing agreements", async () => {
  const cookie = makeCookie(fixture.userA);
  const makeAgreedStudent = async (feeTerm, amount, registrationFee, billingFrequency) => {
    const student = await createStudent({ name: `Frozen zero-safe ${billingFrequency}` });
    student.planEnrollments = [{
      plan: fixture.plan._id,
      feeTerm: feeTerm._id,
      branch: fixture.branchA._id,
      startDate: new Date(`${calendarDateOffset(-30)}T00:00:00.000Z`),
      status: "ACTIVE",
      billingSnapshot: {
        feeTerm: feeTerm._id,
        feeTermVersion: feeTerm.version,
        planName: fixture.plan.name,
        branch: fixture.branchA._id,
        effectiveFrom: feeTerm.effectiveFrom,
        effectiveUntil: feeTerm.effectiveUntil,
        amount,
        billingFrequency,
        registrationFee,
        taxRate: 0,
      },
    }];
    await student.save();
    return student;
  };

  const registrationOnlyTerm = await makeEnrollmentFeeTerm(fixture.branchA, { amount: 0, registrationFee: 25, taxRate: 0, billingFrequency: "MONTHLY" });
  const registrationOnlyStudent = await makeAgreedStudent(registrationOnlyTerm, 0, 25, "MONTHLY");
  const registrationOnlyInvoice = await makeFinanceInvoice(fixture.userA, registrationOnlyStudent);
  assert.equal(registrationOnlyInvoice.status, 201, registrationOnlyInvoice.body.message);
  assert.equal(registrationOnlyInvoice.body.invoice.total, 25);
  assert.equal(registrationOnlyInvoice.body.invoice.items[0].unitAmount, 0);
  assert.equal(String(registrationOnlyInvoice.body.invoice.feeTerm), String(registrationOnlyTerm._id));

  const tuitionTerm = await makeEnrollmentFeeTerm(fixture.branchA, { amount: 80, registrationFee: 0, taxRate: 0, billingFrequency: "QUARTERLY" });
  const tuitionStudent = await makeAgreedStudent(tuitionTerm, 80, 0, "QUARTERLY");
  const tuitionInvoice = await makeFinanceInvoice(fixture.userA, tuitionStudent);
  assert.equal(tuitionInvoice.status, 201, tuitionInvoice.body.message);
  assert.equal(tuitionInvoice.body.invoice.total, 80);
  assert.equal(tuitionInvoice.body.invoice.feeTerm, String(tuitionTerm._id));

  const zeroTerm = await makeEnrollmentFeeTerm(fixture.branchA, { amount: 0, registrationFee: 0, taxRate: 0, billingFrequency: "YEARLY" });
  const zeroStudent = await makeAgreedStudent(zeroTerm, 0, 0, "YEARLY");
  const zeroInvoice = await makeFinanceInvoice(fixture.userA, zeroStudent);
  assert.equal(zeroInvoice.status, 400);
  assert.match(zeroInvoice.body.message, /no billable amount/i);
  assert.equal(await Invoice.countDocuments({ student: zeroStudent._id }), 0, "the Plan price must not be substituted for a zero-value frozen agreement");

  const legacyStudent = await createStudent({ name: "Missing FeeTerm Agreement" });
  legacyStudent.planEnrollments = [{ plan: fixture.plan._id, branch: fixture.branchA._id, startDate: new Date(`${calendarDateOffset(-30)}T00:00:00.000Z`), status: "ACTIVE" }];
  await legacyStudent.save();
  const legacyInvoice = await makeFinanceInvoice(fixture.userA, legacyStudent);
  assert.equal(legacyInvoice.status, 409, legacyInvoice.body.message);
  assert.equal(await Invoice.countDocuments({ student: legacyStudent._id }), 0);
});

test("new enrollments require a valid FeeTerm and freeze its complete agreement without trusting client prices", async () => {
  const valid = await makeEnrollmentFeeTerm(fixture.branchA, {
    amount: 1250,
    registrationFee: 150,
    taxRate: 5,
    billingFrequency: "QUARTERLY",
    discountRules: [{ name: "Family", type: "PERCENT", amount: 10, active: true }],
  });
  const student = await createStudent({ name: "Fee Term Enrollment" });
  const cookie = makeCookie(fixture.userA);
  const base = {
    plan: String(fixture.plan._id),
    branch: String(fixture.branchA._id),
    feeTerm: String(valid._id),
    startDate: calendarDateOffset(0),
  };

  const wrongPlan = await Plan.create({ name: "Different Plan", price: 999, duration: 1 });
  const wrongPlanAttempt = await request(app).post(`/api/enrollments/students/${student._id}`).set("Cookie", cookie).set("Origin", origin).send({ ...base, plan: String(wrongPlan._id) });
  assert.equal(wrongPlanAttempt.status, 400);
  assert.match(wrongPlanAttempt.body.message, /does not belong/i);

  const otherBranchTerm = await makeEnrollmentFeeTerm(fixture.branchB, { billingFrequency: "YEARLY" });
  const wrongBranchAttempt = await request(app).post(`/api/enrollments/students/${student._id}`).set("Cookie", cookie).set("Origin", origin).send({ ...base, feeTerm: String(otherBranchTerm._id) });
  assert.equal(wrongBranchAttempt.status, 400);

  const expired = await makeEnrollmentFeeTerm(fixture.branchA, { billingFrequency: "ONE_TIME", effectiveFrom: new Date("2020-01-01T00:00:00.000Z"), effectiveUntil: new Date("2020-12-31T00:00:00.000Z") });
  const expiredAttempt = await request(app).post(`/api/enrollments/students/${student._id}`).set("Cookie", cookie).set("Origin", origin).send({ ...base, feeTerm: String(expired._id) });
  assert.equal(expiredAttempt.status, 400);
  assert.match(expiredAttempt.body.message, /expired/i);

  const future = await makeEnrollmentFeeTerm(fixture.branchA, { billingFrequency: "YEARLY", effectiveFrom: new Date("2035-01-01T00:00:00.000Z") });
  const futureAttempt = await request(app).post(`/api/enrollments/students/${student._id}`).set("Cookie", cookie).set("Origin", origin).send({ ...base, feeTerm: String(future._id) });
  assert.equal(futureAttempt.status, 400);
  assert.match(futureAttempt.body.message, /not effective/i);

  const retired = await makeEnrollmentFeeTerm(fixture.branchA, { billingFrequency: "ONE_TIME", effectiveFrom: new Date("2021-01-01T00:00:00.000Z"), status: "RETIRED" });
  const retiredAttempt = await request(app).post(`/api/enrollments/students/${student._id}`).set("Cookie", cookie).set("Origin", origin).send({ ...base, feeTerm: String(retired._id) });
  assert.equal(retiredAttempt.status, 400);
  assert.match(retiredAttempt.body.message, /not active/i);

  const enrolled = await request(app).post(`/api/enrollments/students/${student._id}`).set("Cookie", cookie).set("Origin", origin).send({ ...base, amount: 1, registrationFee: 0, taxRate: 0, billingFrequency: "MONTHLY" });
  assert.equal(enrolled.status, 201, enrolled.body.message);
  const agreement = enrolled.body.enrollment.billingSnapshot;
  const agreementBefore = JSON.parse(JSON.stringify(agreement));
  assert.equal(String(enrolled.body.enrollment.feeTerm), String(valid._id));
  assert.equal(String(agreement.feeTerm), String(valid._id));
  assert.equal(agreement.feeTermVersion, 1);
  assert.equal(agreement.planName, fixture.plan.name);
  assert.equal(String(agreement.branch), String(fixture.branchA._id));
  assert.equal(agreement.billingFrequency, "QUARTERLY");
  assert.equal(agreement.amount, 1250);
  assert.equal(agreement.registrationFee, 150);
  assert.equal(agreement.taxRate, 5);
  assert.equal(agreement.discountRules[0].name, "Family");

  const blockedEdit = await request(app).patch(`/api/finance/fee-terms/${valid._id}`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({ amount: 9999 });
  assert.equal(blockedEdit.status, 409);
  const retire = await request(app).patch(`/api/finance/fee-terms/${valid._id}`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({ status: "RETIRED" });
  assert.equal(retire.status, 200);
  const saved = await Student.findById(student._id).lean();
  assert.deepEqual(JSON.parse(JSON.stringify(saved.planEnrollments[0].billingSnapshot)), agreementBefore);
});

test("FeeTerm currency is snapshotted through enrollment and invoice after Academy Settings changes", async () => {
  await AcademySettings.create({ academyName: "ForceStrike Academy", currency: "AED" });
  const cookie = makeCookie(fixture.userA);
  const created = await request(app)
    .post(`/api/finance/plans/${fixture.plan._id}/fee-terms`)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .send({ branch: String(fixture.branchA._id), billingFrequency: "ONE_TIME", amount: 1200, registrationFee: 300, taxRate: 5, effectiveFrom: "2026-01-01" });
  assert.equal(created.status, 201, created.body.message);
  assert.equal(created.body.feeTerm.currency, "AED");

  await AcademySettings.updateOne({}, { $set: { currency: "INR" } });
  const student = await createStudent({ name: "Currency Snapshot Student" });
  const enrolled = await request(app)
    .post(`/api/enrollments/students/${student._id}`)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .send({ plan: String(fixture.plan._id), branch: String(fixture.branchA._id), feeTerm: String(created.body.feeTerm._id), startDate: calendarDateOffset(0), createInvoice: true });
  assert.equal(enrolled.status, 201, enrolled.body.message);
  assert.equal(enrolled.body.enrollment.billingSnapshot.currency, "AED");
  assert.equal(enrolled.body.invoice.currency, "AED");
  assert.equal(enrolled.body.invoice.subtotal, 1500);
  assert.equal(enrolled.body.invoice.tax, 75);
  assert.equal(enrolled.body.invoice.total, 1575);
  assert.equal(enrolled.body.enrollment.billingSnapshot.amount, 1200);
  assert.equal(enrolled.body.enrollment.billingSnapshot.registrationFee, 300);
});

test("invoice creation includes registration fee, tax, saved discount rules, and blocks duplicate periods", async () => {
  const discountId = new mongoose.Types.ObjectId();
  fixture.studentA.planEnrollments[0].billingSnapshot.discountRules = [{ _id: discountId, name: "Member discount", type: "PERCENT", amount: 10, active: true }];
  await fixture.studentA.save();
  const first = await makeFinanceInvoice(fixture.userA, fixture.studentA, { discountRuleId: String(discountId) });
  assert.equal(first.status, 201, first.body.message);
  const invoice = first.body.invoice;
  assert.equal(invoice.subtotal, 120);
  assert.equal(invoice.discount, 12);
  assert.equal(invoice.tax, 10.8);
  assert.equal(invoice.total, 118.8);
  assert.equal(invoice.items.filter((item) => item.kind === "REGISTRATION").length, 1);
  const duplicate = await makeFinanceInvoice(fixture.userA, fixture.studentA, { discountRuleId: String(discountId) });
  assert.equal(duplicate.status, 409);
  assert.equal(await Invoice.countDocuments({ enrollment: fixture.studentA.planEnrollments[0]._id }), 1);
  assert.equal(await FinanceAudit.countDocuments({ action: "INVOICE_CREATED", invoice: invoice._id }), 1);
});

test("cancelled invoices remain in audit history but release a billing cycle for replacement", async () => {
  const first = await makeFinanceInvoice();
  assert.equal(first.status, 201);
  const cancelled = await request(app).post(`/api/finance/invoices/${first.body.invoice._id}/cancel`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({ reason: "Incorrect invoice period selected" });
  assert.equal(cancelled.status, 200, cancelled.body.message);
  const replacement = await makeFinanceInvoice();
  assert.equal(replacement.status, 201, replacement.body.message);
  assert.notEqual(replacement.body.invoice._id, first.body.invoice._id);
  assert.equal(await Invoice.countDocuments({ enrollment: fixture.studentA.planEnrollments[0]._id }), 2);
});

test("partial and full collections create receipts and duplicate payment retries replay safely", async () => {
  const made = await makeFinanceInvoice();
  assert.equal(made.status, 201, made.body.message);
  const invoice = made.body.invoice;
  await AcademySettings.create({ academyName: "ForceStrike Academy", contactEmail: "hello@forcestrike.test", address: "Academy Road" });
  const cookie = makeCookie(fixture.userA);
  const partial = await request(app).post(`/api/finance/invoices/${invoice._id}/payments`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "phase2-partial-payment-0001").send({ amount: 40, method: "UPI", referenceId: "upi-finance-001" });
  assert.equal(partial.status, 201, partial.body.message);
  assert.equal(partial.body.invoice.status, "PARTIALLY_PAID");
  assert.equal(partial.body.invoice.balance, 92);
  assert.equal(partial.body.receipt.receiptNumber.startsWith("RCT-"), true);
  const duplicate = await request(app).post(`/api/finance/invoices/${invoice._id}/payments`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "phase2-partial-payment-0001").send({ amount: 40, method: "UPI", referenceId: "upi-finance-001" });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(await Payment.countDocuments({ invoice: invoice._id, kind: "PAYMENT" }), 1);
  const reusedKey = await request(app).post(`/api/finance/invoices/${invoice._id}/payments`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "phase2-partial-payment-0001").send({ amount: 41, method: "UPI" });
  assert.equal(reusedKey.status, 409);
  const receipt = await request(app).get(`/api/finance/receipts/${partial.body.receipt._id}`).set("Cookie", cookie);
  assert.equal(receipt.status, 200);
  assert.equal(receipt.body.receipt.academy.name, "ForceStrike Academy");
  assert.equal(receipt.body.receipt.amount, 40);

  const full = await request(app).post(`/api/finance/invoices/${invoice._id}/payments`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "phase2-final-payment-0002").send({ amount: 92, method: "CASH" });
  assert.equal(full.status, 201, full.body.message);
  assert.equal(full.body.invoice.status, "PAID");
  assert.equal(full.body.invoice.balance, 0);
  assert.equal(await Payment.countDocuments({ invoice: invoice._id, kind: "PAYMENT" }), 2);
  assert.equal(await Receipt.countDocuments({ invoice: invoice._id }), 2);
  assert.equal(await FinanceAudit.countDocuments({ action: "PAYMENT_CREATED", invoice: invoice._id }), 2);
  assert.equal(await Notification.countDocuments({ type: { $in: ["FINANCE_PARTIAL_PAYMENT_RECEIVED", "FINANCE_PAYMENT_RECEIVED"] }, branch: fixture.branchA._id }), 2);
});

test("payment input rejects zero values and overpayment without writing ledger rows", async () => {
  const made = await makeFinanceInvoice();
  const invoice = made.body.invoice;
  const post = (amount, key) => request(app).post(`/api/finance/invoices/${invoice._id}/payments`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).set("Idempotency-Key", key).send({ amount, method: "CASH" });
  assert.equal((await post(0, "finance-invalid-amount-0001")).status, 400);
  assert.equal((await post(invoice.balance + 0.01, "finance-overpayment-00001")).status, 400);
  assert.equal(await Payment.countDocuments({ invoice: invoice._id }), 0);
  assert.equal((await Invoice.findById(invoice._id)).paidAmount, 0);
});

test("branch finance APIs isolate invoices, student profiles, and collections", async () => {
  const outside = await makeFinanceInvoice(fixture.userB, fixture.studentB);
  assert.equal(outside.status, 201, outside.body.message);
  const foreignInvoiceId = outside.body.invoice._id;
  const outsidePayment = await request(app).post(`/api/finance/invoices/${foreignInvoiceId}/payments`).set("Cookie", makeCookie(fixture.userB)).set("Origin", origin).set("Idempotency-Key", "finance-branch-b-payment-0001").send({ amount: 20, method: "CASH" });
  assert.equal(outsidePayment.status, 201);
  const branchAList = await request(app).get("/api/finance/invoices").set("Cookie", makeCookie(fixture.userA));
  assert.equal(branchAList.status, 200);
  assert.equal(branchAList.body.invoices.length, 0);
  const foreignPayment = await request(app).post(`/api/finance/invoices/${foreignInvoiceId}/payments`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).set("Idempotency-Key", "finance-foreign-payment-0001").send({ amount: 20, method: "CASH" });
  assert.equal(foreignPayment.status, 404);
  const branchAPayments = await request(app).get("/api/finance/payments").set("Cookie", makeCookie(fixture.userA));
  assert.equal(branchAPayments.status, 200);
  assert.equal(branchAPayments.body.payments.length, 0);
  const foreignStudentProfile = await request(app).get(`/api/finance/students/${fixture.studentB._id}`).set("Cookie", makeCookie(fixture.userA));
  assert.equal(foreignStudentProfile.status, 404);
});

test("finance endpoints enforce permissions and expose reports only to finance reporters", async () => {
  const noAccess = await createUser({ role: "NO_ACCESS", email: "finance-no-access@example.test" });
  const denied = await request(app).get("/api/finance/dashboard").set("Cookie", makeCookie(noAccess));
  assert.equal(denied.status, 403);
  const made = await makeFinanceInvoice();
  assert.equal(made.status, 201);
  const reports = await request(app).get("/api/finance/reports").set("Cookie", makeCookie(fixture.userA));
  assert.equal(reports.status, 200, reports.body.message);
  assert.equal(reports.body.invoices.length, 1);
  assert.ok(reports.body.audits.some((item) => item.action === "INVOICE_CREATED"));
  const noReportRole = await Role.create({ key: "FINANCE_VIEW_ONLY", name: "Finance view only", dataScope: "BRANCH", permissions: ["finance.view"] });
  const viewOnly = await createUser({ role: noReportRole.key, email: "finance-view-only@example.test" });
  assert.equal((await request(app).get("/api/finance/dashboard").set("Cookie", makeCookie(viewOnly))).status, 200);
  assert.equal((await request(app).get("/api/finance/reports").set("Cookie", makeCookie(viewOnly))).status, 403);
});

test("overdue invoices appear in collection metrics and use correct status", async () => {
  const made = await makeFinanceInvoice(fixture.userA, fixture.studentA, { dueDate: new Date(Date.now() - 2 * 86400000).toISOString() });
  assert.equal(made.status, 201, made.body.message);
  assert.equal(made.body.invoice.status, "OVERDUE");
  const dashboard = await request(app).get("/api/finance/dashboard").set("Cookie", makeCookie(fixture.userA));
  assert.equal(dashboard.status, 200, dashboard.body.message);
  assert.equal(dashboard.body.metrics.overdue, 132);
  assert.equal(dashboard.body.metrics.overdueCount, 1);
  assert.ok(dashboard.body.charts.outstandingFees.some((item) => item.amount === 132));
});

test("payment corrections and refunds append audited movements and recalculate the invoice balance", async () => {
  const made = await makeFinanceInvoice();
  const invoice = made.body.invoice;
  const cookie = makeCookie(fixture.userA);
  const first = await request(app).post(`/api/finance/invoices/${invoice._id}/payments`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "finance-correctable-payment-1").send({ amount: 50, method: "CARD" });
  assert.equal(first.status, 201);
  const correction = await request(app).post(`/api/finance/payments/${first.body.payment._id}/corrections`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "finance-payment-correction-1").send({ correctedAmount: 30, reason: "Card receipt amount was entered incorrectly" });
  assert.equal(correction.status, 201, correction.body.message);
  assert.equal(correction.body.invoice.paidAmount, 30);
  assert.equal(correction.body.invoice.balance, 102);
  assert.equal(await Payment.countDocuments({ relatedPayment: first.body.payment._id, kind: "CORRECTION" }), 2);
  assert.equal(correction.body.receipts.length, 2);
  const correctionReplay = await request(app).post(`/api/finance/payments/${first.body.payment._id}/corrections`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "finance-payment-correction-1").send({ correctedAmount: 30, reason: "Card receipt amount was entered incorrectly" });
  assert.equal(correctionReplay.status, 200);
  assert.equal(correctionReplay.body.duplicate, true);
  const refund = await request(app).post(`/api/finance/payments/${correction.body.corrections[1]._id}/refund`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "finance-invalid-refund-0001").send({ amount: 10, reason: "Attempt refund on correction" });
  assert.equal(refund.status, 409);
  assert.equal(await FinanceAudit.countDocuments({ action: "PAYMENT_CORRECTED", invoice: invoice._id }), 1);

  const paid = await request(app).post(`/api/finance/invoices/${invoice._id}/payments`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "finance-refund-test-payment-1").send({ amount: 20, method: "CASH" });
  assert.equal(paid.status, 201);
  const refundResult = await request(app).post(`/api/finance/payments/${paid.body.payment._id}/refund`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "finance-refund-valid-00001").send({ amount: 5, reason: "Duplicate cash collection returned" });
  assert.equal(refundResult.status, 201, refundResult.body.message);
  assert.ok(refundResult.body.receipt?._id);
  assert.equal(refundResult.body.invoice.paidAmount, 45);
  assert.equal(refundResult.body.invoice.balance, 87);
  assert.equal(await FinanceAudit.countDocuments({ action: "PAYMENT_REFUNDED", invoice: invoice._id }), 1);
  const refundReplay = await request(app).post(`/api/finance/payments/${paid.body.payment._id}/refund`).set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "finance-refund-valid-00001").send({ amount: 5, reason: "Duplicate cash collection returned" });
  assert.equal(refundReplay.status, 200);
  assert.equal(refundReplay.body.duplicate, true);
});

test("student finance profile and receipt access are limited to the linked student account", async () => {
  const studentRole = await Role.create({ key: "STUDENT", name: "Student", dataScope: "BRANCH", permissions: ["student.finance.view"] });
  const account = await createUser({ role: studentRole.key, email: "student-finance@example.test" });
  const student = await createStudent({ user: account._id, name: "Linked Finance Student", branch: fixture.branchA._id, phone: "9000000099" });
  student.planEnrollments = [{ plan: fixture.plan._id, feeTerm: fixture.feeTerm._id, branch: fixture.branchA._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", billingSnapshot: fixtureBillingSnapshot() }];
  await student.save();
  const made = await makeFinanceInvoice(fixture.userA, student);
  const pay = await request(app).post(`/api/finance/invoices/${made.body.invoice._id}/payments`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).set("Idempotency-Key", "finance-student-profile-pay-1").send({ amount: 10, method: "UPI" });
  assert.equal(pay.status, 201);
  const ownProfile = await request(app).get("/api/finance/me").set("Cookie", makeCookie(account));
  assert.equal(ownProfile.status, 200);
  assert.equal(ownProfile.body.summary.totalPaid, 10);
  const ownReceipt = await request(app).get(`/api/finance/receipts/${pay.body.receipt._id}`).set("Cookie", makeCookie(account));
  assert.equal(ownReceipt.status, 200);
  const unrelated = await createUser({ role: "STUDENT", email: "unrelated-student@example.test" });
  assert.equal((await request(app).get(`/api/finance/receipts/${pay.body.receipt._id}`).set("Cookie", makeCookie(unrelated))).status, 404);
  assert.equal((await request(app).get(`/api/finance/students/${student._id}`).set("Cookie", makeCookie(account))).status, 403);
});

test("finance reminders are idempotent for staff and notify the linked student", async () => {
  const studentRole = await Role.create({ key: "STUDENT", name: "Student", dataScope: "BRANCH", permissions: ["student.finance.view"] });
  const account = await createUser({ role: studentRole.key, email: "reminder-student@example.test" });
  const student = await createStudent({ user: account._id, name: "Reminder Student", branch: fixture.branchA._id, phone: "9000000077" });
  student.planEnrollments = [{ plan: fixture.plan._id, feeTerm: fixture.feeTerm._id, branch: fixture.branchA._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", billingSnapshot: fixtureBillingSnapshot({ registrationFee: 0, taxRate: 0 }) }];
  await student.save();
  const made = await makeFinanceInvoice(fixture.userA, student, { dueDate: new Date(Date.now() - 86400000).toISOString() });
  const { refreshFinanceReminders } = require("../../src/services/financeReminder.service");
  await refreshFinanceReminders(); await refreshFinanceReminders();
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "FINANCE_OVERDUE_REMINDER", entityId: made.body.invoice._id }), 1);
  assert.equal(await Notification.countDocuments({ recipient: account._id, type: "FINANCE_STUDENT_OVERDUE_REMINDER", entityId: made.body.invoice._id }), 1);
});

test("finance indexes protect invoice cycles, idempotency, receipt numbers, and audit query paths", async () => {
  const invoiceIndexes = await Invoice.collection.listIndexes().toArray();
  const paymentIndexes = await Payment.collection.listIndexes().toArray();
  const receiptIndexes = await Receipt.collection.listIndexes().toArray();
  const auditIndexes = await FinanceAudit.collection.listIndexes().toArray();
  assert.ok(invoiceIndexes.some((index) => index.name === "uniq_invoice_enrollment_cycle" && index.unique));
  assert.ok(invoiceIndexes.some((index) => index.key.branch === 1 && index.key.status === 1 && index.key.dueDate === 1));
  assert.ok(paymentIndexes.some((index) => index.name === "uniq_payment_idempotency" && index.unique));
  assert.ok(paymentIndexes.some((index) => index.name === "uniq_payment_reference" && index.unique));
  assert.ok(receiptIndexes.some((index) => index.key.receiptNumber === 1 && index.unique));
  assert.ok(auditIndexes.some((index) => index.key.branch === 1 && index.key.createdAt === -1));
});

test("Add Student can atomically issue an enrollment invoice and collect a partial payment with a receipt", async () => {
  const term = await makeEnrollmentFeeTerm(fixture.branchA, {
    amount: 500,
    registrationFee: 50,
    taxRate: 10,
    billingFrequency: "MONTHLY",
  });
  const cookie = makeCookie(fixture.userA);
  const created = await request(app).post("/api/students").set("Cookie", cookie).set("Origin", origin).send({
    name: "Admission Invoice Student",
    age: 17,
    phone: "+919811223377",
    email: "admission-invoice-student@example.test",
    loginEmail: "admission-invoice-login@example.test",
    branch: String(fixture.branchA._id),
    plan: String(fixture.plan._id),
    feeTerm: String(term._id),
    joinDate: calendarDateOffset(0),
    createInvoice: true,
    invoiceDueDate: calendarDateOffset(7),
  });
  assert.equal(created.status, 201, created.body.message);
  assert.ok(created.body.invoice);
  assert.equal(created.body.invoice.total, 605);
  assert.equal(String(created.body.invoice.student), String(created.body.student._id));
  assert.equal(String(created.body.invoice.feeTerm), String(term._id));
  assert.equal(String(created.body.invoice.enrollment), String(created.body.student.planEnrollments[0]._id));

  const partial = await request(app).post(`/api/finance/invoices/${created.body.invoice._id}/payments`)
    .set("Cookie", cookie).set("Origin", origin).set("Idempotency-Key", "add-student-partial-pay-1")
    .send({ amount: 100, method: "CASH" });
  assert.equal(partial.status, 201, partial.body.message);
  assert.equal(partial.body.invoice.paidAmount, 100);
  assert.equal(partial.body.invoice.balance, 505);
  assert.equal(String(partial.body.receipt.invoice), String(created.body.invoice._id));
  assert.equal(String(partial.body.receipt.payment), String(partial.body.payment._id));
});

test("invoices continue from the enrollment snapshot after its FeeTerm and Plan change", async () => {
  const startDate = calendarDateOffset(-45);
  const term = await makeEnrollmentFeeTerm(fixture.branchA, {
    amount: 1250,
    registrationFee: 150,
    taxRate: 5,
    effectiveUntil: new Date(`${startDate}T00:00:00.000Z`),
  });
  const student = await createStudent({ name: "Frozen Invoice Agreement" });
  const agreedPlanName = fixture.plan.name;
  const cookie = makeCookie(fixture.userA);
  const enrollmentDoc = await Student.findById(student._id);
  enrollmentDoc.planEnrollments.push({
    plan: fixture.plan._id,
    feeTerm: term._id,
    branch: fixture.branchA._id,
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    status: "ACTIVE",
    billingSnapshot: {
      feeTerm: term._id,
      feeTermVersion: term.version,
      planName: agreedPlanName,
      branch: fixture.branchA._id,
      branchName: fixture.branchA.name,
      active: true,
      amount: 1250,
      billingFrequency: "MONTHLY",
      registrationFee: 150,
      taxRate: 5,
      discountRules: [],
      effectiveFrom: term.effectiveFrom,
      effectiveUntil: term.effectiveUntil,
    },
  });
  await enrollmentDoc.save();
  const enrollment = enrollmentDoc.planEnrollments[0];

  term.status = "RETIRED";
  await term.save();
  fixture.plan.name = "Renamed Current Plan";
  await fixture.plan.save();

  const nextStart = new Date(`${calendarDateOffset(0)}T00:00:00.000Z`);
  const invoiceResponse = await request(app).post("/api/finance/invoices").set("Cookie", cookie).set("Origin", origin).send({
    studentId: String(student._id), enrollmentId: String(enrollment._id), dueDate: new Date(nextStart.getTime() + 7 * 86400000).toISOString(), periodStart: nextStart.toISOString(),
  });
  assert.equal(invoiceResponse.status, 201, invoiceResponse.body.message);
  assert.equal(invoiceResponse.body.invoice.total, 1470);
  assert.equal(invoiceResponse.body.invoice.items[0].description, agreedPlanName);
  assert.equal(String(invoiceResponse.body.invoice.feeTerm), String(term._id));
});

test("finance reports and collection dashboards stay tied to posted records when a FeeTerm is superseded", async () => {
  const term = await makeEnrollmentFeeTerm(fixture.branchA, {
    amount: 500,
    registrationFee: 0,
    taxRate: 0,
  });
  const enrollment = fixture.studentA.planEnrollments[0];
  enrollment.feeTerm = term._id;
  enrollment.billingSnapshot = {
    feeTerm: term._id,
    feeTermVersion: term.version,
    planName: fixture.plan.name,
    branch: fixture.branchA._id,
    branchName: fixture.branchA.name,
    amount: 500,
    billingFrequency: term.billingFrequency,
    registrationFee: 0,
    taxRate: 0,
    discountRules: [],
    effectiveFrom: term.effectiveFrom,
    effectiveUntil: term.effectiveUntil,
  };
  await fixture.studentA.save();

  const cookie = makeCookie(fixture.userA);
  const invoiceResponse = await makeFinanceInvoice(fixture.userA, fixture.studentA);
  assert.equal(invoiceResponse.status, 201, invoiceResponse.body.message);
  const invoice = invoiceResponse.body.invoice;
  assert.equal(invoice.total, 500);

  const paymentResponse = await request(app)
    .post(`/api/finance/invoices/${invoice._id}/payments`)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .set("Idempotency-Key", "fee-term-report-history-payment")
    .send({ amount: 125, method: "CASH" });
  assert.equal(paymentResponse.status, 201, paymentResponse.body.message);
  const receiptId = paymentResponse.body.receipt._id;

  const reportsBefore = await request(app).get("/api/finance/reports").set("Cookie", cookie);
  const filteredBefore = await request(app)
    .get(`/api/finance/reports?branchId=${fixture.branchA._id}&planId=${fixture.plan._id}&invoiceStatus=PARTIALLY_PAID&paymentKind=PAYMENT&from=${calendarDateOffset(0)}&to=${calendarDateOffset(0)}`)
    .set("Cookie", cookie);
  const dashboardBefore = await request(app).get("/api/finance/dashboard").set("Cookie", cookie);
  const receiptBefore = await request(app).get(`/api/finance/receipts/${receiptId}`).set("Cookie", cookie);
  assert.equal(reportsBefore.status, 200);
  assert.equal(filteredBefore.status, 200, filteredBefore.body.message);
  assert.equal(filteredBefore.body.invoices.length, 1);
  assert.equal(filteredBefore.body.payments.length, 1);
  assert.equal(filteredBefore.body.receipts.length, 1);
  assert.equal((await request(app).get(`/api/finance/reports?branchId=${fixture.branchB._id}`).set("Cookie", cookie)).status, 403);
  assert.equal(dashboardBefore.status, 200);
  assert.equal(receiptBefore.status, 200);

  const superseded = await request(app)
    .post(`/api/finance/fee-terms/${term._id}/supersede`)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .send({ amount: 650, registrationFee: 0, taxRate: 0, effectiveFrom: calendarDateOffset(0), reason: "Approved current price update" });
  assert.equal(superseded.status, 201, superseded.body.message);

  const reportsAfter = await request(app).get("/api/finance/reports").set("Cookie", cookie);
  const filteredAfter = await request(app)
    .get(`/api/finance/reports?branchId=${fixture.branchA._id}&planId=${fixture.plan._id}&invoiceStatus=PARTIALLY_PAID&paymentKind=PAYMENT&from=${calendarDateOffset(0)}&to=${calendarDateOffset(0)}`)
    .set("Cookie", cookie);
  const dashboardAfter = await request(app).get("/api/finance/dashboard").set("Cookie", cookie);
  const receiptAfter = await request(app).get(`/api/finance/receipts/${receiptId}`).set("Cookie", cookie);
  assert.equal(reportsAfter.status, 200);
  assert.equal(filteredAfter.status, 200);
  assert.equal(dashboardAfter.status, 200);
  assert.equal(receiptAfter.status, 200);

  const invoiceFields = (body) => body.invoices.map(({ _id, invoiceNumber, total, paidAmount, balance, items }) => ({ _id, invoiceNumber, total, paidAmount, balance, items }));
  const paymentFields = (body) => body.payments.map(({ _id, amount, direction, kind, invoice }) => ({ _id, amount, direction, kind, invoice }));
  assert.deepEqual(invoiceFields(reportsAfter.body), invoiceFields(reportsBefore.body));
  assert.deepEqual(paymentFields(reportsAfter.body), paymentFields(reportsBefore.body));
  assert.deepEqual(filteredAfter.body.invoices.map(({ _id, total, paidAmount, balance }) => ({ _id, total, paidAmount, balance })), filteredBefore.body.invoices.map(({ _id, total, paidAmount, balance }) => ({ _id, total, paidAmount, balance })));
  assert.deepEqual(filteredAfter.body.receipts, filteredBefore.body.receipts);
  assert.deepEqual(dashboardAfter.body.metrics, dashboardBefore.body.metrics);
  assert.deepEqual(dashboardAfter.body.charts, dashboardBefore.body.charts);
  assert.deepEqual(receiptAfter.body.receipt, receiptBefore.body.receipt);
  assert.equal(reportsAfter.body.invoices.find((item) => String(item._id) === String(invoice._id)).total, 500);
  assert.equal((await Student.findById(fixture.studentA._id)).planEnrollments.id(enrollment._id).billingSnapshot.amount, 500);

  const newStudent = await createStudent({ name: "Updated FeeTerm Enrollment" });
  const newEnrollment = await request(app)
    .post(`/api/enrollments/students/${newStudent._id}`)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .send({ plan: String(fixture.plan._id), branch: String(fixture.branchA._id), feeTerm: String(superseded.body.feeTerm._id), startDate: calendarDateOffset(0), createInvoice: true });
  assert.equal(newEnrollment.status, 201, newEnrollment.body.message);
  assert.equal(newEnrollment.body.enrollment.billingSnapshot.amount, 650);
  assert.equal(newEnrollment.body.invoice.total, 650);
});

test("CRM lead pipeline enforces permissions, branch isolation, and auditable status transitions", async () => {
  const cookie = makeCookie(fixture.userA);
  const made = await request(app).post("/api/inquiries/leads").set("Cookie", cookie).set("Origin", origin).send({ name: "Prospective Student", phone: "+919876543210", email: "prospect@example.test", age: 16, source: "REFERRAL" });
  assert.equal(made.status, 201, made.body.message);
  const lead = made.body.lead;
  assert.equal(lead.status, "NEW");
  assert.equal(lead.source, "REFERRAL");
  assert.equal((await request(app).get("/api/inquiries/pipeline").set("Cookie", makeCookie(fixture.userB))).body.leads.length, 0);
  const denied = await request(app).get("/api/inquiries/pipeline").set("Cookie", makeCookie(await createUser({ role: "NO_ACCESS", email: "crm-no-access@example.test" })));
  assert.equal(denied.status, 403);
  const wrongBranch = await request(app).patch(`/api/inquiries/${lead._id}/lead`).set("Cookie", makeCookie(fixture.userB)).set("Origin", origin).send({ status: "CONTACTED" });
  assert.equal(wrongBranch.status, 404);
  const invalid = await request(app).patch(`/api/inquiries/${lead._id}/lead`).set("Cookie", cookie).set("Origin", origin).send({ status: "INTERESTED" });
  assert.equal(invalid.status, 400);
  const contacted = await request(app).patch(`/api/inquiries/${lead._id}/lead`).set("Cookie", cookie).set("Origin", origin).send({ status: "CONTACTED" });
  assert.equal(contacted.status, 200);
  assert.deepEqual(contacted.body.lead.statusHistory.map((entry) => entry.to), ["NEW", "CONTACTED"]);
});

test("CRM trial lifecycle rejects duplicate bookings and updates lead history", async () => {
  const cookie = makeCookie(fixture.userA);
  const lead = await Inquiry.create({ fullName: "Trial Candidate", email: "trial-candidate@example.test", phone: "+919811223344", age: 14, branch: fixture.branchA._id, status: "CONTACTED", statusHistory: [{ from: "NEW", to: "CONTACTED", changedBy: fixture.userA._id }] });
  const trialDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const body = { trialDate, startTime: "10:00", endTime: "11:00" };
  const first = await request(app).post(`/api/inquiries/${lead._id}/trials`).set("Cookie", cookie).set("Origin", origin).send(body);
  assert.equal(first.status, 201, first.body.message);
  assert.equal(first.body.trial.status, "SCHEDULED");
  const duplicate = await request(app).post(`/api/inquiries/${lead._id}/trials`).set("Cookie", cookie).set("Origin", origin).send(body);
  assert.equal(duplicate.status, 409);
  const completed = await request(app).patch(`/api/inquiries/trials/${first.body.trial._id}`).set("Cookie", cookie).set("Origin", origin).send({ status: "COMPLETED" });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.trial.attendance, "PRESENT");
  assert.deepEqual(completed.body.trial.statusHistory.map((entry) => entry.to), ["SCHEDULED", "COMPLETED"]);
  const updatedLead = await Inquiry.findById(lead._id).lean();
  assert.equal(updatedLead.status, "TRIAL_COMPLETED");
  assert.ok(updatedLead.statusHistory.some((item) => item.to === "TRIAL_SCHEDULED"));
  assert.ok(updatedLead.statusHistory.some((item) => item.to === "TRIAL_COMPLETED"));
});

test("CRM conversion creates one student, enrollment, and optional invoice and is idempotent", async () => {
  const lead = await Inquiry.create({ fullName: "Admission Candidate", email: "admission-candidate@example.test", phone: "+919877665544", age: 19, branch: fixture.branchA._id, plan: fixture.plan._id, status: "INTERESTED", statusHistory: [{ from: "TRIAL_COMPLETED", to: "INTERESTED", changedBy: fixture.userA._id }] });
  const cookie = makeCookie(fixture.userA);
  const url = `/api/inquiries/${lead._id}/convert`;
  const feeTerm = await makeEnrollmentFeeTerm();
  const input = { age: 19, plan: String(fixture.plan._id), branch: String(fixture.branchA._id), feeTerm: String(feeTerm._id), joinDate: calendarDateOffset(0), createInvoice: true };
  const first = await request(app).post(url).set("Cookie", cookie).set("Origin", origin).send(input);
  assert.equal(first.status, 201, first.body.message);
  assert.equal(first.body.student.name, "Admission Candidate");
  assert.equal(first.body.student.planEnrollments.length, 1);
  assert.equal(first.body.invoice.items[0].kind, "TUITION");
  assert.equal((await Inquiry.findById(lead._id)).status, "CONVERTED");
  const replay = await request(app).post(url).set("Cookie", cookie).set("Origin", origin).send(input);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.alreadyConverted, true);
  assert.equal(await Student.countDocuments({ phone: "+919877665544" }), 1);
  assert.equal(await Invoice.countDocuments({ student: first.body.student._id }), 1);
  assert.equal(await Trial.countDocuments({ lead: lead._id }), 0);
  assert.equal(await Notification.countDocuments({ type: "LEAD_CONVERTED", entityId: lead._id }), 1);
});

test("CRM conversion reuses an existing student and overdue follow-ups notify assigned staff once", async () => {
  const lead = await Inquiry.create({ fullName: fixture.studentA.name, email: "existing-person@example.test", phone: fixture.studentA.phone, age: 18, branch: fixture.branchA._id, plan: fixture.plan._id, status: "CONTACTED" });
  const cookie = makeCookie(fixture.userA);
  const feeTerm = await makeEnrollmentFeeTerm();
  const converted = await request(app).post(`/api/inquiries/${lead._id}/convert`).set("Cookie", cookie).set("Origin", origin).send({ plan: String(fixture.plan._id), branch: String(fixture.branchA._id), feeTerm: String(feeTerm._id), joinDate: calendarDateOffset(0) });
  assert.equal(converted.status, 201, converted.body.message);
  assert.equal(String(converted.body.student._id), String(fixture.studentA._id));
  assert.equal(await Student.countDocuments({ phone: fixture.studentA.phone }), 1);
  const followUpLead = await Inquiry.create({ fullName: "Follow-up Prospect", email: "followup-prospect@example.test", phone: "+919800112233", branch: fixture.branchA._id, status: "CONTACTED", assignedTo: fixture.userA._id });
  const dueAt = new Date(Date.now() - 3600000);
  const followUp = await request(app).post(`/api/inquiries/${followUpLead._id}/follow-ups`).set("Cookie", cookie).set("Origin", origin).send({ note: "Call back", dueAt: dueAt.toISOString() });
  assert.equal(followUp.status, 201);
  const { notifyOverdueFollowUps } = require("../../src/controllers/crm.controller");
  await notifyOverdueFollowUps(); await notifyOverdueFollowUps();
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "LEAD_FOLLOWUP_OVERDUE", entityId: followUpLead._id }), 1);
});

test("membership renewal keeps enrollment history, bills through Finance, and notifies once", async () => {
  const feeTerm = await makeEnrollmentFeeTerm();
  const nonBillableTerm = await FeeTerm.collection.insertOne({
    plan: fixture.plan._id,
    branch: fixture.branchA._id,
    billingFrequency: "ONE_TIME",
    amount: 0,
    registrationFee: 0,
    taxRate: 0,
    discountRules: [],
    effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
    effectiveUntil: null,
    status: "ACTIVE",
    version: 1,
  });
  const student = await createStudent({ name: "Renewal Student" });
  const expiredOn = calendarDateOffset(-1);
  student.planEnrollments = [{ plan: fixture.plan._id, branch: fixture.branchA._id, startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date(`${expiredOn}T12:00:00.000Z`), status: "ACTIVE", enrollmentSource: "ADMISSION", createdBy: fixture.userA._id }];
  await student.save();
  const cookie = makeCookie(fixture.userA);
  const rejected = await request(app).post(`/api/enrollments/students/${student._id}/renewals`).set("Cookie", cookie).set("Origin", origin).send({ plan: String(fixture.plan._id), branch: String(fixture.branchA._id), feeTerm: String(nonBillableTerm.insertedId), startDate: calendarDateOffset(0), createInvoice: true });
  assert.equal(rejected.status, 400);
  const afterRejectedRenewal = await Student.findById(student._id).lean();
  assert.equal(afterRejectedRenewal.planEnrollments.length, 1, "a failed required invoice rolls back the new enrollment");
  assert.equal(afterRejectedRenewal.planEnrollments[0].status, "ACTIVE", "a failed renewal leaves the previous agreement unchanged");
  assert.equal(await Invoice.countDocuments({ student: student._id }), 0);
  const response = await request(app).post(`/api/enrollments/students/${student._id}/renewals`).set("Cookie", cookie).set("Origin", origin).send({ plan: String(fixture.plan._id), branch: String(fixture.branchA._id), feeTerm: String(feeTerm._id), startDate: calendarDateOffset(0), createInvoice: true });
  assert.equal(response.status, 201, response.body.message);
  assert.ok(response.body.invoice, response.body.invoiceError);
  const saved = await Student.findById(student._id).lean();
  assert.equal(saved.planEnrollments.length, 2);
  assert.equal(String(saved.planEnrollments[0].renewedTo), String(saved.planEnrollments[1]._id));
  assert.equal(saved.planEnrollments[1].enrollmentSource, "RENEWAL");
  assert.equal(await Invoice.countDocuments({ student: student._id, enrollment: saved.planEnrollments[1]._id }), 1);
  const noticeCount = await Notification.countDocuments({ type: "MEMBERSHIP_RENEWAL_COMPLETED", entityId: saved.planEnrollments[1]._id });
  assert.equal(noticeCount, 1);
  const replay = await request(app).post(`/api/enrollments/students/${student._id}/renewals`).set("Cookie", cookie).set("Origin", origin).send({ plan: String(fixture.plan._id), branch: String(fixture.branchA._id), feeTerm: String(feeTerm._id), startDate: calendarDateOffset(0) });
  assert.equal(replay.status, 409);
  const history = await request(app).get(`/api/enrollments/students/${student._id}`).set("Cookie", cookie);
  assert.equal(history.status, 200);
  assert.equal(history.body.enrollments.length, 2);
});

test("membership APIs enforce branch isolation and valid enrollment status transitions", async () => {
  const student = fixture.studentA;
  student.planEnrollments = [{ plan: fixture.plan._id, branch: fixture.branchA._id, startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-12-31T12:00:00.000Z"), status: "ACTIVE" }];
  await student.save();
  const cookie = makeCookie(fixture.userA);
  const hidden = await request(app).get(`/api/enrollments/students/${fixture.studentB._id}`).set("Cookie", cookie);
  assert.ok([403, 404].includes(hidden.status));
  const transfer = await request(app).post(`/api/enrollments/students/${student._id}`).set("Cookie", cookie).set("Origin", origin).send({ plan: String(fixture.plan._id), branch: String(fixture.branchB._id) });
  assert.equal(transfer.status, 403);
  const enrollmentId = student.planEnrollments[0]._id;
  const paused = await request(app).patch(`/api/enrollments/students/${student._id}/${enrollmentId}/status`).set("Cookie", cookie).set("Origin", origin).send({ status: "PAUSED" });
  assert.equal(paused.status, 200, paused.body.message);
  assert.equal(paused.body.enrollment.status, "PAUSED");
  const invalid = await request(app).patch(`/api/enrollments/students/${student._id}/${enrollmentId}/status`).set("Cookie", cookie).set("Origin", origin).send({ status: "EXPIRED" });
  assert.equal(invalid.status, 409);
});

test("membership read and manage permissions are independent at the API boundary", async () => {
  const viewRole = await Role.create({ key: "MEMBERSHIP_VIEW", name: "Membership viewer", dataScope: "BRANCH", permissions: ["membership.view"] });
  const viewUser = await createUser({ role: viewRole.key, email: "membership-view@example.test" });
  const viewCookie = makeCookie(viewUser);
  const dashboard = await request(app).get("/api/enrollments/dashboard").set("Cookie", viewCookie);
  assert.equal(dashboard.status, 200);
  const viewWrite = await request(app).post(`/api/enrollments/students/${fixture.studentA._id}`).set("Cookie", viewCookie).set("Origin", origin).send({ plan: String(fixture.plan._id), startDate: calendarDateOffset(0) });
  assert.equal(viewWrite.status, 403);

  const manageRole = await Role.create({ key: "MEMBERSHIP_MANAGE", name: "Membership manager", dataScope: "BRANCH", permissions: ["membership.manage"] });
  const manageUser = await createUser({ role: manageRole.key, email: "membership-manage@example.test" });
  const manageCookie = makeCookie(manageUser);
  const manageRead = await request(app).get("/api/enrollments/dashboard").set("Cookie", manageCookie);
  assert.equal(manageRead.status, 403);
  const newStudent = await createStudent({ name: "Managed Enrollment" });
  const feeTerm = await makeEnrollmentFeeTerm();
  const manageWrite = await request(app).post(`/api/enrollments/students/${newStudent._id}`).set("Cookie", manageCookie).set("Origin", origin).send({ plan: String(fixture.plan._id), branch: String(fixture.branchA._id), feeTerm: String(feeTerm._id), startDate: calendarDateOffset(0) });
  assert.equal(manageWrite.status, 201, manageWrite.body.message);
  assert.equal(manageWrite.body.invoice, null);

  const noMembership = await createUser({ role: "NO_ACCESS", email: "membership-none@example.test" });
  const deniedRead = await request(app).get("/api/enrollments/dashboard").set("Cookie", makeCookie(noMembership));
  assert.equal(deniedRead.status, 403);
});

test("branch transfer creates a new enrollment snapshot and preserves the previous branch history", async () => {
  const feeTerm = await makeEnrollmentFeeTerm(fixture.branchB);
  const student = fixture.studentA;
  student.planEnrollments = [{ plan: fixture.plan._id, branch: fixture.branchA._id, startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-12-31T12:00:00.000Z"), status: "ACTIVE" }];
  await student.save();
  const admin = await createUser({ role: "SUPER_ADMIN", branch: null });
  const response = await request(app).put(`/api/students/${student._id}`).set("Cookie", makeCookie(admin)).set("Origin", origin).send({ branch: String(fixture.branchB._id), feeTerm: String(feeTerm._id) });
  assert.equal(response.status, 200, response.body.message);
  const saved = await Student.findById(student._id).lean();
  assert.equal(saved.planEnrollments.length, 2);
  assert.equal(saved.planEnrollments[0].status, "COMPLETED");
  assert.equal(String(saved.planEnrollments[0].branch), String(fixture.branchA._id));
  assert.equal(String(saved.planEnrollments[1].branch), String(fixture.branchB._id));
  assert.equal(saved.planEnrollments[1].enrollmentSource, "BRANCH_TRANSFER");
});

test("expired membership notifications are sent once even when the scheduler runs late", async () => {
  const student = fixture.studentA;
  student.planEnrollments = [{ plan: fixture.plan._id, branch: fixture.branchA._id, startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date(`${calendarDateOffset(-2)}T12:00:00.000Z`), status: "ACTIVE" }];
  await student.save();
  const { refreshEnrollmentReminders } = require("../../src/services/enrollmentReminder.service");
  await refreshEnrollmentReminders();
  await refreshEnrollmentReminders();
  const saved = await Student.findById(student._id);
  assert.equal(saved.planEnrollments[0].status, "EXPIRED");
  assert.equal(await Notification.countDocuments({ type: "MEMBERSHIP_EXPIRED", entityId: saved.planEnrollments[0]._id }), 1);
});

test("attendance rejects paused or expired enrollment while retaining its curriculum snapshot", async () => {
  const { slotA } = await configureAttendanceFixture({ studentIds: ["studentA"] });
  const enrollment = fixture.studentA.planEnrollments[0];
  enrollment.status = "PAUSED";
  await fixture.studentA.save();
  const response = await markRequest(makeCookie(fixture.userA), fixture.studentA, calendarDateOffset(1), "PRESENT", slotA);
  assert.equal(response.status, 403);
  assert.match(response.body.message, /no active plan enrollment/i);
});

test("audit logs are read-only, permission protected, and branch scoped", async () => {
  const audit = await AuditLog.create({ action: "STUDENT_UPDATED", entityType: "STUDENT", entityId: fixture.studentA._id, branch: fixture.branchA._id, actor: fixture.userA._id, actorName: fixture.userA.name, before: { status: "ACTIVE" }, after: { status: "INACTIVE" } });
  const branchA = makeCookie(fixture.userA);
  const list = await request(app).get("/api/audit-logs").set("Cookie", branchA);
  assert.equal(list.status, 200);
  assert.equal(list.body.totalItems, 1);
  const escape = await request(app).get(`/api/audit-logs?branchId=${fixture.branchB._id}`).set("Cookie", branchA);
  assert.equal(escape.status, 403);
  const branchB = await createUser({ email: "audit-branch-b@example.test", branch: fixture.branchB._id });
  const hidden = await request(app).get(`/api/audit-logs/${audit._id}`).set("Cookie", makeCookie(branchB));
  assert.ok([403, 404].includes(hidden.status));
  const noAccess = await createUser({ email: "audit-no-access@example.test", role: "NO_ACCESS" });
  assert.equal((await request(app).get("/api/audit-logs").set("Cookie", makeCookie(noAccess))).status, 403);
  assert.equal((await request(app).patch(`/api/audit-logs/${audit._id}`).set("Cookie", branchA).set("Origin", origin).send({ after: {} })).status, 404);
  await assert.rejects(AuditLog.updateOne({ _id: audit._id }, { $set: { after: { status: "ACTIVE" } } }), /immutable/);
  await assert.rejects(AuditLog.deleteOne({ _id: audit._id }), /immutable/);
  assert.deepEqual((await AuditLog.findById(audit._id).lean()).after, { status: "INACTIVE" });
});

test("historical attendance correction requires a reason, separates approval, and preserves its original state", async () => {
  const attendance = await Attendance.create({ student: fixture.studentA._id, branch: fixture.branchA._id, plan: fixture.plan._id, date: new Date("2026-09-01T10:00:00.000Z"), planDay: 1, curriculumTitle: "Basics", status: "PRESENT", attendanceType: "REGULAR", markedBy: fixture.userA._id });
  const cookie = makeCookie(fixture.userA);
  const missingReason = await request(app).post(`/api/attendance/${attendance._id}/corrections`).set("Cookie", cookie).set("Origin", origin).send({ proposedStatus: "ABSENT" });
  assert.equal(missingReason.status, 400, JSON.stringify(missingReason.body));
  const created = await request(app).post(`/api/attendance/${attendance._id}/corrections`).set("Cookie", cookie).set("Origin", origin).send({ proposedStatus: "ABSENT", reason: "Incorrect sheet entry" });
  assert.equal(created.status, 201);
  const correction = created.body.correction;
  assert.equal(correction.original.status, "PRESENT");
  const queue = await request(app).get("/api/attendance/corrections?status=PENDING").set("Cookie", cookie);
  assert.equal(queue.status, 200);
  assert.equal(queue.body.totalItems, 1);
  const selfApproval = await request(app).post(`/api/attendance/corrections/${correction._id}/approve`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(selfApproval.status, 409);
  const approver = await createUser({ email: "correction-approver@example.test", branch: fixture.branchA._id });
  const approved = await request(app).post(`/api/attendance/corrections/${correction._id}/approve`).set("Cookie", makeCookie(approver)).set("Origin", origin);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.correction.status, "APPROVED");
  assert.equal((await Attendance.findById(attendance._id)).status, "ABSENT");
  const makeup = await Makeup.findOne({ originalAttendance: attendance._id });
  assert.equal(makeup.status, "SCHEDULED");
  assert.equal(await AuditLog.countDocuments({ action: "ATTENDANCE_CORRECTION_APPROVED", entityId: attendance._id }), 1);
  const duplicateDecision = await request(app).post(`/api/attendance/corrections/${correction._id}/approve`).set("Cookie", makeCookie(approver)).set("Origin", origin);
  assert.equal(duplicateDecision.status, 409);

  const rejectedAttendance = await Attendance.create({ student: fixture.studentB._id, branch: fixture.branchB._id, plan: fixture.plan._id, date: new Date("2026-09-02T10:00:00.000Z"), planDay: 1, curriculumTitle: "Basics", status: "PRESENT", attendanceType: "REGULAR", markedBy: fixture.userB._id });
  const branchB = await createUser({ email: "correction-branch-b@example.test", branch: fixture.branchB._id });
  const requested = await request(app).post(`/api/attendance/${rejectedAttendance._id}/corrections`).set("Cookie", makeCookie(branchB)).set("Origin", origin).send({ proposedStatus: "ABSENT", reason: "Incorrect attendance" });
  assert.equal(requested.status, 201);
  const rejected = await request(app).post(`/api/attendance/corrections/${requested.body.correction._id}/reject`).set("Cookie", makeCookie(branchB)).set("Origin", origin).send({ reason: "Evidence does not support the change" });
  assert.equal(rejected.status, 409, "The requester cannot reject their own request");
  const otherApprover = await createUser({ email: "correction-branch-b-approver@example.test", branch: fixture.branchB._id });
  const rejection = await request(app).post(`/api/attendance/corrections/${requested.body.correction._id}/reject`).set("Cookie", makeCookie(otherApprover)).set("Origin", origin).send({ reason: "Evidence does not support the change" });
  assert.equal(rejection.status, 200);
  assert.equal((await Attendance.findById(rejectedAttendance._id)).status, "PRESENT");
});

test("grading reuses promotion eligibility, validates evaluations, promotes through the existing workflow, and issues a promotion certificate", async () => {
  const cookie = makeCookie(fixture.userA);
  const program = await TrainingSessionType.create({ name: `Grading Karate ${crypto.randomUUID()}`, normalizedName: `grading-${crypto.randomUUID()}`, slug: `grading-${crypto.randomUUID()}`, isActive: true });
  const curriculum = [{ day: 1, title: "Foundations", skill: "stance" }];
  const curriculumVersion = await Curriculum.create({ plan: fixture.plan._id, program: program._id, version: 1, name: "Grading Karate Curriculum", status: "PUBLISHED", modules: [{ name: "Foundations", order: 1, steps: [{ title: "Foundations", isMilestone: true, milestoneName: "First grading milestone", milestoneCriteria: "Coach confirms foundations", rewards: [{ rewardId: "yellow-belt", type: "BELT_PROGRESSION", name: "Yellow", targetBelt: "Yellow", requiresFormalGrading: true }] }] }] });
  fixture.plan.programs = [{ program: program._id, curriculum, weeklyLimit: 4 }];
  fixture.plan.milestones = [{ day: 1, belt: "Orange", skill: "Legacy only" }];
  await fixture.plan.save();
  fixture.studentA.planEnrollments[0].programs = [{ program: program._id, curriculumVersion: curriculumVersion._id, curriculum, weeklyLimit: 4 }];
  await fixture.studentA.save();
  await StudentCurriculumMilestone.create({ student: fixture.studentA._id, branch: fixture.branchA._id, enrollment: fixture.studentA.planEnrollments[0]._id, plan: fixture.plan._id, program: program._id, curriculum: curriculumVersion._id, milestoneStepId: curriculumVersion.modules[0].steps[0]._id, milestoneName: "First grading milestone", milestoneCriteria: "Coach confirms foundations", status: "EARNED", criteriaMetAt: new Date(), earnedAt: new Date(), rewards: [{ rewardId: "yellow-belt", type: "BELT_PROGRESSION", name: "Yellow", targetBelt: "Yellow", requiresFormalGrading: true, status: "AWAITING_GRADING" }] });
  await Attendance.create({ student: fixture.studentA._id, branch: fixture.branchA._id, plan: fixture.plan._id, sessionTypeId: program._id, date: new Date(), planDay: 1, curriculumTitle: "Foundations", status: "PRESENT", attendanceType: "REGULAR", markedBy: fixture.userA._id });

  const eligibility = await request(app).get(`/api/grading/eligibility?branch=${fixture.branchA._id}&program=${program._id}&date=${calendarDateOffset(1)}`).set("Cookie", cookie);
  assert.equal(eligibility.status, 200);
  assert.equal(eligibility.body.students.find((item) => item.student._id === String(fixture.studentA._id)).eligible, true);

  const created = await request(app).post("/api/grading").set("Cookie", cookie).set("Origin", origin).send({ date: calendarDateOffset(1), branch: String(fixture.branchA._id), program: String(program._id), examiner: String(fixture.userA._id), studentIds: [String(fixture.studentA._id)], notes: "Quarterly grading" });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const eventId = created.body.event._id;
  assert.equal((await request(app).get(`/api/grading/${eventId}`).set("Cookie", cookie)).status, 200);
  assert.equal((await request(app).get(`/api/grading/${eventId}`).set("Cookie", makeCookie(fixture.userB))).status, 404);
  assert.equal((await request(app).post(`/api/grading/${eventId}/start`).set("Cookie", cookie).set("Origin", origin)).status, 200);

  const badScore = await request(app).put(`/api/grading/${eventId}/students/${fixture.studentA._id}/evaluation`).set("Cookie", cookie).set("Origin", origin).send({ criteria: { technique: { value: 101 }, discipline: { value: 80 }, attendance: { value: 80 }, performance: { value: 80 } }, overallScore: 80, remarks: "", result: "PASS" });
  assert.equal(badScore.status, 400);
  const evaluationInput = { criteria: Object.fromEntries(["technique", "discipline", "attendance", "performance"].map((key) => [key, { value: 80, remarks: "Good progress" }])), overallScore: 82, remarks: "Ready to advance", result: "PASS" };
  const saved = await request(app).put(`/api/grading/${eventId}/students/${fixture.studentA._id}/evaluation`).set("Cookie", cookie).set("Origin", origin).send(evaluationInput);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(await GradingEvaluation.countDocuments({ event: eventId, student: fixture.studentA._id }), 1);
  const finalized = await request(app).post(`/api/grading/${eventId}/students/${fixture.studentA._id}/evaluation/finalize`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(finalized.status, 200, JSON.stringify(finalized.body));
  assert.ok(finalized.body.promotion?._id);
  const changedStudent = await Student.findById(fixture.studentA._id);
  assert.equal(changedStudent.currentBelt, "Yellow");
  const history = await BeltHistory.findOne({ student: fixture.studentA._id, gradingEvent: eventId });
  assert.ok(history);
  assert.equal(String(history.approvedBy), String(fixture.userA._id));
  const locked = await request(app).put(`/api/grading/${eventId}/students/${fixture.studentA._id}/evaluation`).set("Cookie", cookie).set("Origin", origin).send(evaluationInput);
  assert.equal(locked.status, 409);

  const certificateResponse = await request(app).post(`/api/certificates/promotions/${history._id}`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(certificateResponse.status, 201, JSON.stringify(certificateResponse.body));
  assert.match(certificateResponse.body.certificate.certificateNumber, /^CRT-/);
  const certificateRead = await request(app).get(`/api/certificates/${certificateResponse.body.certificate._id}`).set("Cookie", cookie);
  assert.equal(certificateRead.status, 200);
  assert.equal(certificateRead.body.certificate.belt, "Yellow");
  const achievement = await request(app).post("/api/certificates/achievements").set("Cookie", cookie).set("Origin", origin).send({ studentId: String(fixture.studentA._id), achievement: "Dojo Spirit Award" });
  assert.equal(achievement.status, 201);
  const sameAchievement = await request(app).post("/api/certificates/achievements").set("Cookie", cookie).set("Origin", origin).send({ studentId: String(fixture.studentA._id), achievement: "Dojo Spirit Award" });
  assert.equal(sameAchievement.status, 200);
  const completedStudent = await Student.findById(fixture.studentA._id);
  completedStudent.planEnrollments[0].status = "COMPLETED";
  await completedStudent.save();
  const completionCertificate = await request(app).post("/api/certificates/program-completion").set("Cookie", cookie).set("Origin", origin).send({ studentId: String(fixture.studentA._id), enrollmentId: String(completedStudent.planEnrollments[0]._id), programId: String(program._id) });
  assert.equal(completionCertificate.status, 201, JSON.stringify(completionCertificate.body));

  assert.equal((await request(app).post(`/api/grading/${eventId}/publish`).set("Cookie", cookie).set("Origin", origin)).status, 200);
  assert.equal((await request(app).post(`/api/grading/${eventId}/complete`).set("Cookie", cookie).set("Origin", origin)).status, 200);
  assert.equal((await GradingEvent.findById(eventId)).status, "COMPLETED");
  assert.ok(await AuditLog.countDocuments({ entityType: "GRADING_EVENT", entityId: eventId }));
});

test("grading rejects ineligible students, duplicate event evaluations, and cross-branch event access", async () => {
  const cookie = makeCookie(fixture.userA);
  const program = await TrainingSessionType.create({ name: `Grading Basics ${crypto.randomUUID()}`, normalizedName: `grading-basics-${crypto.randomUUID()}`, slug: `grading-basics-${crypto.randomUUID()}`, isActive: true });
  const curriculum = [{ day: 1, title: "Foundations", skill: "stance" }];
  fixture.plan.programs = [{ program: program._id, curriculum }];
  fixture.plan.milestones = [{ day: 1, belt: "Yellow", skill: "Foundations" }];
  await fixture.plan.save();
  fixture.studentA.planEnrollments[0].programs = [{ program: program._id, curriculum }];
  await fixture.studentA.save();
  const candidates = await request(app).get(`/api/grading/eligibility?branch=${fixture.branchA._id}&program=${program._id}&date=${calendarDateOffset(1)}`).set("Cookie", cookie);
  assert.equal(candidates.status, 200);
  assert.equal(candidates.body.students.find((item) => item.student._id === String(fixture.studentA._id)).eligible, false);
  assert.match(candidates.body.students.find((item) => item.student._id === String(fixture.studentA._id)).reason, /milestone/i);
  const rejected = await request(app).post("/api/grading").set("Cookie", cookie).set("Origin", origin).send({ date: calendarDateOffset(1), branch: String(fixture.branchA._id), program: String(program._id), examiner: String(fixture.userA._id), studentIds: [String(fixture.studentA._id)] });
  assert.equal(rejected.status, 400);
  const noPermission = await request(app).post("/api/grading").set("Cookie", makeCookie(await createUser({ role: "NO_ACCESS" }))).set("Origin", origin).send({});
  assert.equal(noPermission.status, 403);
});

test("Super Admin can access grading and certificate APIs while unauthorized roles remain blocked", async () => {
  const superAdmin = await createUser({ role: "SUPER_ADMIN", branch: null });
  const noAccess = await createUser({ role: "NO_ACCESS" });
  const superAdminCookie = makeCookie(superAdmin);

  const grading = await request(app).get("/api/grading").set("Cookie", superAdminCookie);
  assert.equal(grading.status, 200, JSON.stringify(grading.body));

  const certificates = await request(app).get("/api/certificates").set("Cookie", superAdminCookie);
  assert.equal(certificates.status, 200, JSON.stringify(certificates.body));

  const createGrading = await request(app).post("/api/grading").set("Cookie", superAdminCookie).set("Origin", origin).send({});
  assert.equal(createGrading.status, 400, JSON.stringify(createGrading.body));
  const issueCertificate = await request(app).post("/api/certificates/achievements").set("Cookie", superAdminCookie).set("Origin", origin).send({});
  assert.equal(issueCertificate.status, 400, JSON.stringify(issueCertificate.body));

  assert.equal((await request(app).get("/api/grading").set("Cookie", makeCookie(noAccess))).status, 403);
  assert.equal((await request(app).get("/api/certificates").set("Cookie", makeCookie(noAccess))).status, 403);
});

test("FAIL and PENDING grading results publish without changing belt or promotion history", async () => {
  const cookie = makeCookie(fixture.userA);
  const program = await TrainingSessionType.create({ name: `Results Karate ${crypto.randomUUID()}`, normalizedName: `results-${crypto.randomUUID()}`, slug: `results-${crypto.randomUUID()}`, isActive: true });
  const curriculum = [{ day: 1, title: "Basics", skill: "stance" }];
  fixture.plan.programs = [{ program: program._id, curriculum }];
  fixture.plan.milestones = [{ day: 1, belt: "Yellow", skill: "Basics" }];
  await fixture.plan.save();
  fixture.studentA.planEnrollments[0].programs = [{ program: program._id, curriculum }];
  await fixture.studentA.save();
  const studentC = await createStudent({ name: "Student C", phone: "9000000003", branch: fixture.branchA._id });
  studentC.planEnrollments = [{ plan: fixture.plan._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", programs: [{ program: program._id, curriculum }] }];
  await studentC.save();
  for (const student of [fixture.studentA, studentC]) await Attendance.create({ student: student._id, branch: fixture.branchA._id, plan: fixture.plan._id, sessionTypeId: program._id, date: new Date(), planDay: 1, curriculumTitle: "Basics", status: "PRESENT", markedBy: fixture.userA._id });
  const created = await request(app).post("/api/grading").set("Cookie", cookie).set("Origin", origin).send({ date: calendarDateOffset(1), branch: String(fixture.branchA._id), program: String(program._id), examiner: String(fixture.userA._id), studentIds: [String(fixture.studentA._id), String(studentC._id)] });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const eventId = created.body.event._id;
  assert.equal((await request(app).post(`/api/grading/${eventId}/start`).set("Cookie", cookie).set("Origin", origin)).status, 200);
  const evaluationInput = (result) => ({ criteria: Object.fromEntries(["technique", "discipline", "attendance", "performance"].map((key) => [key, { value: 70, remarks: "Reviewed" }])), overallScore: 70, remarks: "Assessment recorded", result });
  for (const [student, result] of [[fixture.studentA, "FAIL"], [studentC, "PENDING"]]) {
    const saved = await request(app).put(`/api/grading/${eventId}/students/${student._id}/evaluation`).set("Cookie", cookie).set("Origin", origin).send(evaluationInput(result));
    assert.equal(saved.status, 200);
    assert.equal((await request(app).post(`/api/grading/${eventId}/students/${student._id}/evaluation/finalize`).set("Cookie", cookie).set("Origin", origin)).status, 200);
  }
  assert.equal((await request(app).post(`/api/grading/${eventId}/publish`).set("Cookie", cookie).set("Origin", origin)).status, 200);
  assert.equal((await Student.findById(fixture.studentA._id)).currentBelt, "White");
  assert.equal((await Student.findById(studentC._id)).currentBelt, "White");
  assert.equal(await BeltHistory.countDocuments({ gradingEvent: eventId }), 0);
});

test("academy calendar aggregates scoped data and generic events validate conflicts and registrations", async () => {
  const cookie = makeCookie(fixture.userA);
  const date = calendarDateOffset(7);
  const program = await TrainingSessionType.create({ name: `Calendar Karate ${crypto.randomUUID()}`, normalizedName: `calendar-${crypto.randomUUID()}`, slug: `calendar-${crypto.randomUUID()}`, isActive: true });
  fixture.studentA.planEnrollments[0].programs = [{ program: program._id, curriculum: [] }];
  await fixture.studentA.save();
  const coach = await createUser({ role: "COACH", branch: fixture.branchA._id, email: "calendar-coach@example.test" });
  const weekday = new Date(`${date}T00:00:00`).getDay();
  await BranchSchedule.create({ branch: fixture.branchA._id, weeklySchedule: [{ dayOfWeek: weekday, isClosed: false, slots: [{ sessionName: "Calendar class", sessionTypeId: program._id, coach: coach._id, startTime: "08:00", endTime: "09:00", isActive: true }] }] });
  const lead = await Inquiry.create({ fullName: "Trial Prospect", email: "calendar-trial@example.test", phone: "9000000088", branch: fixture.branchA._id });
  await Trial.create({ lead: lead._id, branch: fixture.branchA._id, program: program._id, coach: coach._id, trialDate: new Date(`${date}T00:00:00`), startTime: "12:00", endTime: "13:00", createdBy: fixture.userA._id });
  const eventInput = { name: "Open workshop", category: "WORKSHOP", branch: String(fixture.branchA._id), startDate: date, endDate: date, startTime: "10:00", endTime: "11:00", coach: String(coach._id), capacity: 2, location: "Studio A", registrationRequired: true, status: "OPEN" };
  const created = await request(app).post("/api/academy-events").set("Cookie", cookie).set("Origin", origin).send(eventInput);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const eventId = created.body.event._id;
  const calendar = await request(app).get(`/api/calendar?start=${date}&end=${date}`).set("Cookie", cookie);
  assert.equal(calendar.status, 200, JSON.stringify(calendar.body));
  assert.ok(calendar.body.events.some((item) => item.type === "CLASS"));
  assert.ok(calendar.body.events.some((item) => item.source === "academy_event" && item.sourceId === eventId));
  const crossBranch = await request(app).get(`/api/calendar?start=${date}&end=${date}&branch=${fixture.branchB._id}`).set("Cookie", cookie);
  assert.equal(crossBranch.status, 403);
  const conflictInput = { ...eventInput, name: "Conflicting workshop", startTime: "10:30", endTime: "11:30", location: "Studio B" };
  const preview = await request(app).post("/api/academy-events/validate").set("Cookie", cookie).set("Origin", origin).send(conflictInput);
  assert.equal(preview.status, 200);
  assert.ok(preview.body.blocking.some((conflict) => conflict.type === "COACH"));
  const blocked = await request(app).post("/api/academy-events").set("Cookie", cookie).set("Origin", origin).send(conflictInput);
  assert.equal(blocked.status, 409);
  const registration = await request(app).post(`/api/academy-events/${eventId}/registrations`).set("Cookie", cookie).set("Origin", origin).send({ student: String(fixture.studentA._id) });
  assert.equal(registration.status, 201, JSON.stringify(registration.body));
  assert.equal(await AcademyEventRegistration.countDocuments({ event: eventId, student: fixture.studentA._id, status: "REGISTERED" }), 1);
  assert.ok(await AcademyEvent.findById(eventId));
});

test("published Curriculum append preserves identity and progress, serializes Plan capacity, and recalculates its Batch", async () => {
  const program = await TrainingSessionType.create({ name: "Append Test", normalizedName: "append test", slug: "append-test" });
  fixture.plan.duration = 1;
  fixture.plan.durationUnit = "MONTHS";
  fixture.plan.classesPerWeek = 2; // 10 theoretical sessions.
  fixture.plan.programs = [{ program: program._id, curriculum: [] }];
  await fixture.plan.save();

  const oldSteps = Array.from({ length: 9 }, (_, index) => ({ title: `Existing ${index + 1}`, completionCriteria: `Requirement ${index + 1}` }));
  const curriculum = await Curriculum.create({
    plan: fixture.plan._id, program: program._id, version: 4, name: "Published", status: "PUBLISHED",
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    modules: [{ name: "Existing module", order: 1, steps: oldSteps }],
  });
  const existingModuleId = String(curriculum.modules[0]._id);
  const existingStepIds = curriculum.modules[0].steps.map((step) => String(step._id));
  const enrollment = fixture.studentA.planEnrollments[0];
  enrollment.programs = [{ program: program._id, curriculumVersion: curriculum._id }];
  await fixture.studentA.save();
  const progress = await StudentCurriculumStepProgress.create({
    student: fixture.studentA._id, enrollment: enrollment._id, plan: fixture.plan._id,
    program: program._id, curriculum: curriculum._id, stepId: existingStepIds[0],
    status: "COMPLETED", completedAt: new Date("2026-03-01T00:00:00.000Z"),
  });

  const startDate = nextWeekday(1);
  const batch = await Batch.create({ name: "Curriculum append batch", code: "APPEND-01", plan: fixture.plan._id, branch: fixture.branchA._id, capacity: 20, status: "ACTIVE", startDate });
  const weeklySchedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: dayOfWeek !== 1,
    slots: dayOfWeek === 1 ? [{ batchId: batch._id, sessionTypeId: program._id, sessionName: batch.name, room: "Dojo 1", startTime: "06:00", endTime: "07:00" }] : [],
  }));
  await BranchSchedule.create({ branch: fixture.branchA._id, weeklySchedule });

  const append = (title) => request(app).post(`/api/curricula/versions/${curriculum._id}/modules`)
    .set("Cookie", makeCookie(fixture.userA)).set("Origin", origin)
    .send({ module: { name: title, order: 999, steps: [{ title: `${title} step`, completionCriteria: "Complete the new work" }] } });
  const results = await Promise.all([append("Next module A"), append("Next module B")]);
  assert.deepEqual(results.map((response) => response.status).sort(), [200, 409]);

  const stored = await Curriculum.findById(curriculum._id).lean();
  assert.equal(String(stored._id), String(curriculum._id));
  assert.equal(stored.version, 4);
  assert.equal(stored.status, "PUBLISHED");
  assert.equal(stored.modules.length, 2, "only one concurrent append fits the final capacity slot");
  assert.equal(String(stored.modules[0]._id), existingModuleId);
  assert.deepEqual(stored.modules[0].steps.map((step) => String(step._id)), existingStepIds);
  assert.deepEqual(stored.modules[0].steps.map((step) => step.completionCriteria), oldSteps.map((step) => step.completionCriteria));
  const retainedProgress = await StudentCurriculumStepProgress.findById(progress._id).lean();
  assert.equal(retainedProgress.status, "COMPLETED");
  assert.equal(retainedProgress.stepId, existingStepIds[0]);

  const auditCount = await FinanceAudit.countDocuments({ action: "CURRICULUM_PUBLISHED_MODULE_ADDED", entityId: curriculum._id });
  assert.equal(auditCount, 1, "the successful append has exactly one committed audit record");
  const updatedBatch = await Batch.findById(batch._id).lean();
  const expectedEndDate = new Date(`${startDate}T12:00:00`);
  expectedEndDate.setDate(expectedEndDate.getDate() + 63);
  const expectedKey = `${expectedEndDate.getFullYear()}-${String(expectedEndDate.getMonth() + 1).padStart(2, "0")}-${String(expectedEndDate.getDate()).padStart(2, "0")}`;
  assert.equal(updatedBatch.calculatedEndDate, expectedKey, "the Batch completion date includes the newly appended learning step");
  assert.equal(updatedBatch.capacityIssue, "");

  const noAccess = await createUser({ role: "NO_ACCESS", email: "curriculum-append-denied@example.test" });
  const denied = await request(app).post(`/api/curricula/versions/${curriculum._id}/modules`)
    .set("Cookie", makeCookie(noAccess)).set("Origin", origin)
    .send({ module: { name: "Forbidden", steps: [{ title: "Forbidden step" }] } });
  assert.equal(denied.status, 403);
});

test("saving a Curriculum draft validates rewards without requiring a transaction session", async () => {
  const program = await TrainingSessionType.create({ name: "Draft Save Test", normalizedName: "draft save test", slug: "draft-save-test" });
  fixture.plan.programs = [{ program: program._id, curriculum: [] }];
  await fixture.plan.save();
  const draft = await Curriculum.create({ plan: fixture.plan._id, program: program._id, version: 1, name: "Draft Save", status: "DRAFT", modules: [] });

  const response = await request(app).put(`/api/curricula/versions/${draft._id}`)
    .set("Cookie", makeCookie(fixture.userA)).set("Origin", origin)
    .send({ name: "Draft Save", modules: [{ name: "Basics", order: 1, steps: [{ title: "Etiquette", isMilestone: false, rewards: [] }] }] });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.curriculum.modules[0].steps[0].title, "Etiquette");
  assert.equal(await FinanceAudit.countDocuments({ action: "CURRICULUM_DRAFT_UPDATED", entityId: draft._id }), 1);
});

test("activating a configured three-day Batch exposes bounded occurrences in both calendars", async () => {
  const Room = require("../../src/models/Room");
  const program = await TrainingSessionType.create({ name: "Three Day Calendar", normalizedName: "three day calendar", slug: "three-day-calendar" });
  fixture.plan.duration = 1;
  fixture.plan.durationUnit = "MONTHS";
  fixture.plan.classesPerWeek = 3;
  fixture.plan.programs = [{ program: program._id }];
  await fixture.plan.save();
  await Curriculum.create({
    plan: fixture.plan._id, program: program._id, version: 1, name: "Three step Curriculum", status: "PUBLISHED", publishedAt: new Date(),
    modules: [{ name: "Fundamentals", order: 1, steps: [{ title: "Step one" }, { title: "Step two" }, { title: "Step three" }] }],
  });
  const room = await Room.create({ branch: fixture.branchA._id, name: "Calendar Dojo", isActive: true });
  const monday = nextWeekday(1, 7);
  const start = new Date(`${monday}T12:00:00`);
  start.setDate(start.getDate() - 2);
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const batch = await Batch.create({ name: "Three day Batch", code: "THREEDAY-01", plan: fixture.plan._id, branch: fixture.branchA._id, capacity: 20, status: "DRAFT", startDate });
  const weeklySchedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek, isClosed: ![1, 2, 3].includes(dayOfWeek),
    slots: [1, 2, 3].includes(dayOfWeek) ? [{ batchId: batch._id, sessionTypeId: program._id, roomId: room._id, room: room.name, sessionName: batch.name, startTime: "06:00", endTime: "07:00", isActive: true }] : [],
  }));
  await BranchSchedule.create({ branch: fixture.branchA._id, weeklySchedule });

  const cookie = makeCookie(fixture.userA);
  const startKey = `${monday}`;
  const tuesday = new Date(`${monday}T12:00:00`);
  tuesday.setDate(tuesday.getDate() + 1);
  const tuesdayKey = `${tuesday.getFullYear()}-${String(tuesday.getMonth() + 1).padStart(2, "0")}-${String(tuesday.getDate()).padStart(2, "0")}`;
  const wednesday = new Date(`${monday}T12:00:00`);
  wednesday.setDate(wednesday.getDate() + 2);
  const endKey = `${wednesday.getFullYear()}-${String(wednesday.getMonth() + 1).padStart(2, "0")}-${String(wednesday.getDate()).padStart(2, "0")}`;
  const monthBeforeActivation = await request(app).get(`/api/branch-schedules/${fixture.branchA._id}/calendar?year=${start.getFullYear()}&month=${start.getMonth() + 1}`).set("Cookie", cookie);
  assert.equal(monthBeforeActivation.status, 200, JSON.stringify(monthBeforeActivation.body));
  const mondayBeforeActivation = monthBeforeActivation.body.days.find((day) => day.date === startKey);
  assert.equal(mondayBeforeActivation.reason, "BATCH_NOT_ACTIVE");
  const academyBeforeActivation = await request(app).get(`/api/calendar?start=${startKey}&end=${endKey}&types=CLASS`).set("Cookie", cookie);
  assert.equal(academyBeforeActivation.status, 200, JSON.stringify(academyBeforeActivation.body));
  assert.equal(academyBeforeActivation.body.events.filter((event) => String(event.metadata?.batchId) === String(batch._id)).length, 0);

  const activated = await request(app).patch(`/api/batches/${batch._id}`).set("Cookie", cookie).set("Origin", origin).send({ status: "ACTIVE" });
  assert.equal(activated.status, 200, JSON.stringify(activated.body));
  assert.ok(activated.body.batch.calculatedEndDate >= endKey);
  const scheduledSessionCount = await Session.countDocuments({ batch: batch._id });
  assert.equal(scheduledSessionCount, 3);

  const admissionPreview = await request(app).get(`/api/students/admission-preview?branchId=${fixture.branchA._id}&planId=${fixture.plan._id}&batchId=${batch._id}&joinDate=${startDate}`).set("Cookie", cookie);
  assert.equal(admissionPreview.status, 200, JSON.stringify(admissionPreview.body));
  assert.equal(admissionPreview.body.requiredLearningSteps, 3);
  assert.equal(admissionPreview.body.curricula.length, 1);
  assert.equal(admissionPreview.body.curricula[0].programName, "Three Day Calendar");
  assert.deepEqual(admissionPreview.body.steps.map((step) => step.date), [startKey, tuesdayKey, endKey]);

  const invalidBatchId = await request(app).get(`/api/students/admission-preview?branchId=${fixture.branchA._id}&planId=${fixture.plan._id}&batchId=not-an-object-id&joinDate=${startDate}`).set("Cookie", cookie);
  assert.equal(invalidBatchId.status, 400);
  assert.match(invalidBatchId.body.message, /valid Batch/);

  const academy = await request(app).get(`/api/calendar?start=${startKey}&end=${endKey}&types=CLASS`).set("Cookie", cookie);
  assert.equal(academy.status, 200, JSON.stringify(academy.body));
  const batchEvents = academy.body.events.filter((event) => String(event.metadata?.batchId) === String(batch._id));
  assert.deepEqual(batchEvents.map((event) => event.start.date).sort(), [startKey, tuesdayKey, endKey].sort());
  assert.equal(new Set(batchEvents.map((event) => event.id)).size, 3);

  const monthAfterActivation = await request(app).get(`/api/branch-schedules/${fixture.branchA._id}/calendar?year=${start.getFullYear()}&month=${start.getMonth() + 1}`).set("Cookie", cookie);
  assert.equal(monthAfterActivation.status, 200, JSON.stringify(monthAfterActivation.body));
  const activeDays = monthAfterActivation.body.days.filter((day) => day.slots.some((slot) => String(slot.batchId?._id || slot.batchId) === String(batch._id)));
  assert.deepEqual(activeDays.map((day) => day.date).sort(), [startKey, tuesdayKey, endKey].sort());

  await request(app).get(`/api/calendar?start=${startKey}&end=${endKey}&types=CLASS`).set("Cookie", cookie);
  await request(app).get(`/api/branch-schedules/${fixture.branchA._id}/calendar?year=${start.getFullYear()}&month=${start.getMonth() + 1}`).set("Cookie", cookie);
  assert.equal(await Session.countDocuments({ batch: batch._id }), scheduledSessionCount, "calendar reads do not create duplicate Session records");
});

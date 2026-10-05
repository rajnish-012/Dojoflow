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
let Attendance;
let Holiday;
let Makeup;
let PasswordResetToken;
let Inquiry;
let TrainingSessionType;
let BranchSchedule;
let Performance;
let Notification;
let Invoice;
let Payment;
let Receipt;
let FinanceAudit;
let AcademySettings;
let fixture;

const permissions = [
  "student.view", "student.create", "student.update", "student.delete",
  "attendance.view", "attendance.manage", "holiday.view", "holiday.manage",
  "makeup.view", "makeup.manage", "branch_schedule.view", "branch_schedule.manage",
  "performance.view", "promotion.view", "promotion.manage", "report.view", "inquiry.view",
  "finance.view", "finance.manage", "finance.collect", "finance.refund", "finance.report", "student.finance.view",
];
const origin = "http://localhost:3000";

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
  Attendance = require("../../src/models/Attendance");
  Holiday = require("../../src/models/Holiday");
  Makeup = require("../../src/models/Makeup");
  PasswordResetToken = require("../../src/models/PasswordResetToken");
  Inquiry = require("../../src/models/Inquiry");
  TrainingSessionType = require("../../src/models/TrainingSessionType");
  BranchSchedule = require("../../src/models/BranchSchedule");
  Performance = require("../../src/models/Performance");
  Notification = require("../../src/models/Notification");
  Invoice = require("../../src/models/Invoice");
  Payment = require("../../src/models/Payment");
  Receipt = require("../../src/models/Receipt");
  FinanceAudit = require("../../src/models/FinanceAudit");
  AcademySettings = require("../../src/models/AcademySettings");
  await mongoose.connect(process.env.MONGO_URI);
  await Attendance.syncIndexes();
  await Makeup.syncIndexes();
  await Performance.syncIndexes();
  await Notification.syncIndexes();
  await Invoice.syncIndexes();
  await Payment.syncIndexes();
  await Receipt.syncIndexes();
  await FinanceAudit.syncIndexes();
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
  fixture.plan = await Plan.create({ name: "Basic Plan", price: 100, duration: 1 });
  fixture.studentA = await createStudent({ name: "Student A", branch: fixture.branchA._id, phone: "9000000001" });
  fixture.studentB = await createStudent({ name: "Student B", branch: fixture.branchB._id, phone: "9000000002" });
  fixture.studentA.planEnrollments = [{ plan: fixture.plan._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", billingSnapshot: { feeName: "Basic Monthly Fees", amount: 100, billingFrequency: "MONTHLY", registrationFee: 20, taxRate: 10, discountRules: [] } }];
  fixture.studentB.planEnrollments = [{ plan: fixture.plan._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", billingSnapshot: { feeName: "Basic Monthly Fees", amount: 100, billingFrequency: "MONTHLY", registrationFee: 20, taxRate: 10, discountRules: [] } }];
  await Promise.all([fixture.studentA.save(), fixture.studentB.save()]);
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

test("student admission creates a linked login and profile; update and deactivation stay synchronized", async () => {
  const cookie = makeCookie(fixture.userA);
  const created = await request(app).post("/api/students").set("Cookie", cookie).set("Origin", origin).send({
    name: "New Test Student", age: 19, phone: "9000000011", email: "profile@example.test",
    loginEmail: "login@example.test", loginPassword: "new student secure passphrase",
    branch: String(fixture.branchA._id), plan: String(fixture.plan._id),
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
  const marked = await markRequest(cookie, fixture.studentA, "2026-10-03", "PRESENT", slotA);
  assert.equal(marked.status, 201, JSON.stringify(marked.body));
  const undone = await request(app).post(`/api/attendance/${marked.body.attendance._id}/undo`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id }), 0);
  const sheet = await request(app).get("/api/attendance/daily-sheet?date=2026-10-03").set("Cookie", cookie);
  assert.equal(sheet.status, 200, JSON.stringify(sheet.body));
  assert.equal(sheet.body.rows.find((row) => String(row.student._id) === String(fixture.studentA._id)).attendance, null);
});

test("undoing ABSENT removes its pending makeup with the attendance", async () => {
  const { slotA } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const marked = await markRequest(cookie, fixture.studentA, "2026-10-03", "ABSENT", slotA);
  const undone = await request(app).post(`/api/attendance/${marked.body.attendance._id}/undo`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal(await Attendance.countDocuments({ student: fixture.studentA._id }), 0);
  assert.equal(await Makeup.countDocuments({ student: fixture.studentA._id }), 0);
});

test("attendance undo rejects completed makeup recovery and linked performance history", async () => {
  const { slotA } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const absent = await markRequest(cookie, fixture.studentA, "2026-10-03", "ABSENT", slotA);
  const makeup = await Makeup.findById(absent.body.makeup._id);
  makeup.status = "COMPLETED";
  await makeup.save();
  let rejected = await request(app).post(`/api/attendance/${absent.body.attendance._id}/undo`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.code, "ATTENDANCE_HAS_COMPLETED_MAKEUP");

  await Makeup.deleteOne({ _id: makeup._id });
  const present = await markRequest(cookie, fixture.studentA, "2026-10-04", "PRESENT", slotA);
  await Performance.create({
    student: fixture.studentA._id, branch: fixture.branchA._id, attendance: present.body.attendance._id,
    plan: fixture.plan._id, sessionTypeId: present.body.attendance.sessionTypeId,
    planDay: 2, curriculumTitle: "Lesson 2", skill: "stance", rating: 4,
    evaluatedBy: fixture.userA._id, evaluationDate: new Date("2026-10-04T00:00:00Z"),
  });
  rejected = await request(app).post(`/api/attendance/${present.body.attendance._id}/undo`).set("Cookie", cookie).set("Origin", origin);
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.code, "ATTENDANCE_HAS_PERFORMANCE");
});

test("ABSENT always creates one exact curriculum snapshot and advances regular progression even when makeupRequired is false", async () => {
  const { slotA, curriculum } = await configureAttendanceFixture();
  const response = await request(app).post("/api/attendance").set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({
    student: String(fixture.studentA._id), date: "2026-10-03", status: "ABSENT", makeupRequired: false, sessionSlotId: slotA,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.attendance.status, "ABSENT");
  assert.equal(response.body.attendance.planDay, 1);
  assert.equal(response.body.makeup.planDay, 1);
  assert.equal(response.body.makeup.curriculumTitle, curriculum[0].title);
  assert.equal(response.body.progression.nextDay, 2);
  assert.equal(await Makeup.countDocuments({ originalAttendance: response.body.attendance._id }), 1);
});

test("an unresolved absence does not block the next regular curriculum day", async () => {
  const { slotA, slotB } = await configureAttendanceFixture();
  const cookie = makeCookie(fixture.userA);
  const absent = await markRequest(cookie, fixture.studentA, "2026-10-02", "ABSENT", slotA);
  assert.equal(absent.status, 201, JSON.stringify(absent.body));
  const nextDay = await markRequest(cookie, fixture.studentA, "2026-10-03", "PRESENT", slotB);
  assert.equal(nextDay.status, 201, JSON.stringify(nextDay.body));
  assert.equal(nextDay.body.attendance.planDay, 2);
  assert.equal(nextDay.body.progression.nextDay, 3);
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
  assert.equal(progressBefore.currentTrainingDay, 5);

  const scheduled = await request(app).put(`/api/makeups/${absent.body.makeup._id}/schedule`)
    .set("Cookie", cookie).set("Origin", origin).send({ makeupDate: "2026-10-05", sessionSlotId: slotB });
  assert.equal(scheduled.status, 200, JSON.stringify(scheduled.body));
  const completed = await request(app).put(`/api/makeups/${absent.body.makeup._id}/complete`)
    .set("Cookie", cookie).set("Origin", origin).send({});
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  assert.equal(completed.body.makeup.planDay, 1);
  assert.equal(completed.body.makeup.curriculumTitle, "Lesson 1");
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "MAKEUP_SCHEDULED" }), 1);
  assert.equal(await Notification.countDocuments({ recipient: fixture.userA._id, type: "MAKEUP_COMPLETED" }), 1);
  const progressAfter = await before.getProgramLearningProgress({ studentId: fixture.studentA._id, programId: absent.body.attendance.sessionTypeId, curriculum, asOfDate: "2026-10-05" });
  assert.equal(progressAfter.currentTrainingDay, 5);
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
    student: String(fixture.studentA._id), originalAttendance: String(records[1]._id), makeupDate: "2026-10-05",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.makeup.planDay, 2);
  assert.equal(created.body.makeup.curriculumTitle, "Lesson 2");
  const progress = await require("../../src/services/programProgress.service").getProgramLearningProgress({
    studentId: fixture.studentA._id, programId: fixture.plan.programs[0].program,
    enrollmentId: fixture.studentA.planEnrollments[0]._id, curriculum: fixture.plan.programs[0].curriculum, asOfDate: "2026-10-05",
  });
  assert.equal(progress.currentTrainingDay, 5);
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

test("fee plan settings update existing plan pricing and keep new enrollment billing snapshots stable", async () => {
  const root = await createUser({ role: "SUPER_ADMIN", branch: null, email: "finance-root@example.test" });
  const update = await request(app).put(`/api/finance/plans/${fixture.plan._id}`).set("Cookie", makeCookie(root)).set("Origin", origin).send({
    feeName: "Karate monthly tuition", price: 500, billingFrequency: "MONTHLY", registrationFee: 25, taxRate: 5,
    feeBranch: String(fixture.branchA._id), discountRules: [{ name: "Family discount", type: "PERCENT", amount: 10, active: true }], reason: "Annual fee schedule approved",
  });
  assert.equal(update.status, 200, update.body.message);
  assert.equal((await Plan.findById(fixture.plan._id)).price, 500);
  assert.equal(await FinanceAudit.countDocuments({ action: "FEE_PLAN_UPDATED", branch: fixture.branchA._id }), 1);

  const invoice = await makeFinanceInvoice();
  assert.equal(invoice.status, 201, invoice.body.message);
  assert.equal(invoice.body.invoice.total, 132, "The enrollment's immutable amount and tax snapshot apply to its invoice");
  assert.equal(invoice.body.invoice.items[0].description, "Basic Monthly Fees");
});

test("branch admins can manage only their branch fee override and inactive fees block invoicing", async () => {
  const update = await request(app).put(`/api/finance/plans/${fixture.plan._id}/branch-fees`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({ branchId: String(fixture.branchA._id), amount: 220, feeName: "Branch A tuition", billingFrequency: "MONTHLY" });
  assert.equal(update.status, 200, update.body.message);
  assert.equal(update.body.branchFee.amount, 220);
  const forbidden = await request(app).put(`/api/finance/plans/${fixture.plan._id}/branch-fees`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({ branchId: String(fixture.branchB._id), amount: 330 });
  assert.equal(forbidden.status, 403);
  const branchAPlans = await request(app).get("/api/finance/plans").set("Cookie", makeCookie(fixture.userA));
  const branchBPlans = await request(app).get("/api/finance/plans").set("Cookie", makeCookie(fixture.userB));
  assert.equal(branchAPlans.body.plans.find((item) => String(item._id) === String(fixture.plan._id)).effectiveFee.amount, 220);
  assert.equal(branchBPlans.body.plans.find((item) => String(item._id) === String(fixture.plan._id)).effectiveFee.amount, fixture.plan.price);
  const inactive = await request(app).put(`/api/finance/plans/${fixture.plan._id}/branch-fees`).set("Cookie", makeCookie(fixture.userA)).set("Origin", origin).send({ branchId: String(fixture.branchA._id), active: false });
  assert.equal(inactive.status, 200);
  const made = await makeFinanceInvoice(fixture.userA, fixture.studentA);
  assert.equal(made.status, 409);
  assert.match(made.body.message, /inactive/i);
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
  student.planEnrollments = [{ plan: fixture.plan._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", billingSnapshot: { feeName: "Basic Monthly Fees", amount: 100, billingFrequency: "MONTHLY", registrationFee: 20, taxRate: 10 } }];
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
  student.planEnrollments = [{ plan: fixture.plan._id, startDate: new Date("2026-01-01T00:00:00.000Z"), status: "ACTIVE", billingSnapshot: { feeName: "Basic Monthly Fees", amount: 100, billingFrequency: "MONTHLY", registrationFee: 0, taxRate: 0 } }];
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

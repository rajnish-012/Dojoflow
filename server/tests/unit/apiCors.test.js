const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/forcestrike-cors-test";
process.env.JWT_SECRET = "cors-test-secret-that-is-long-enough-for-validation";
process.env.CLIENT_URL = "http://localhost:3000";

const app = require("../../server");

test("CORS remains readable for rate limits and preflight bypasses the API limiter", async () => {
  const origin = "http://localhost:3000";

  for (let index = 0; index < 300; index += 1) {
    await request(app)
      .get("/api/cors-rate-limit-test")
      .set("Origin", origin);
  }

  const rateLimited = await request(app)
    .get("/api/cors-rate-limit-test")
    .set("Origin", origin);
  assert.equal(rateLimited.status, 429);
  assert.equal(rateLimited.headers["access-control-allow-origin"], origin);

  const preflight = await request(app)
    .options("/api/settings/academy/public")
    .set("Origin", origin)
    .set("Access-Control-Request-Method", "GET")
    .set("Access-Control-Request-Headers", "content-type");
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["access-control-allow-origin"], origin);
});

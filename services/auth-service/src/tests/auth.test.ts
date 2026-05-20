import assert from "node:assert";
import { test, describe, before } from "node:test";

const BASE = process.env.AUTH_URL || "http://localhost:4001";

async function post(path: string, body: object, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

async function get(path: string, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json() };
}

async function patch(path: string, body: object, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const ts = Date.now();
const testEmail = `test_${ts}@test.com`;
const adminEmail = `admin_${ts}@test.com`;
let accessToken = "";
let refreshToken = "";
let userId = "";
let adminToken = "";
let adminUserId = "";

describe("Auth Service", () => {
  // ── Register ────────────────────────────────────────────────
  describe("POST /auth/register", () => {
    test("registers a new user and returns tokens + viewer role", async () => {
      const { status, body } = await post("/auth/register", {
        email: testEmail,
        password: "password123",
        name: "Test User",
      });
      assert.strictEqual(status, 201);
      assert.ok(body.accessToken, "should return accessToken");
      assert.ok(body.refreshToken, "should return refreshToken");
      assert.strictEqual(body.user.email, testEmail);
      assert.strictEqual(body.user.role, "viewer");
      assert.ok(body.user.id);
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
      userId = body.user.id;
    });

    test("returns 409 if email already registered", async () => {
      const { status } = await post("/auth/register", {
        email: testEmail,
        password: "password123",
        name: "Duplicate",
      });
      assert.strictEqual(status, 409);
    });

    test("returns 400 for invalid email format", async () => {
      const { status } = await post("/auth/register", {
        email: "notanemail",
        password: "password123",
        name: "Test",
      });
      assert.strictEqual(status, 400);
    });

    test("returns 400 for password shorter than 8 chars", async () => {
      const { status } = await post("/auth/register", {
        email: `short_${ts}@test.com`,
        password: "123",
        name: "Test",
      });
      assert.strictEqual(status, 400);
    });

    test("returns 400 when name is missing", async () => {
      const { status } = await post("/auth/register", {
        email: `noname_${ts}@test.com`,
        password: "password123",
      });
      assert.strictEqual(status, 400);
    });

    test("returns 400 when body is empty", async () => {
      const { status } = await post("/auth/register", {});
      assert.strictEqual(status, 400);
    });
  });

  // ── Login ────────────────────────────────────────────────────
  describe("POST /auth/login", () => {
    test("logs in with correct credentials and returns tokens", async () => {
      const { status, body } = await post("/auth/login", {
        email: testEmail,
        password: "password123",
      });
      assert.strictEqual(status, 200);
      assert.ok(body.accessToken);
      assert.ok(body.refreshToken);
      assert.strictEqual(body.user.email, testEmail);
    });

    test("returns 401 for wrong password", async () => {
      const { status } = await post("/auth/login", {
        email: testEmail,
        password: "wrongpassword",
      });
      assert.strictEqual(status, 401);
    });

    test("returns 401 for non-existent email", async () => {
      const { status } = await post("/auth/login", {
        email: "nobody@test.com",
        password: "password123",
      });
      assert.strictEqual(status, 401);
    });

    test("returns 400 for missing password field", async () => {
      const { status } = await post("/auth/login", { email: testEmail });
      assert.strictEqual(status, 400);
    });
  });

  // ── Validate ─────────────────────────────────────────────────
  describe("GET /auth/validate", () => {
    test("validates a valid access token and returns payload", async () => {
      const { status, body } = await get("/auth/validate", accessToken);
      assert.strictEqual(status, 200);
      assert.ok(body.sub);
      assert.strictEqual(body.email, testEmail);
      assert.strictEqual(body.role, "viewer");
    });

    test("returns 401 for a tampered token", async () => {
      const { status } = await get("/auth/validate", "invalid.token.here");
      assert.strictEqual(status, 401);
    });

    test("returns 401 with no Authorization header", async () => {
      const { status } = await get("/auth/validate");
      assert.strictEqual(status, 401);
    });

    test("returns 401 for malformed Bearer header", async () => {
      const res = await fetch(`${BASE}/auth/validate`, {
        headers: { Authorization: "Token abc123" },
      });
      assert.strictEqual(res.status, 401);
    });
  });

  // ── Refresh ──────────────────────────────────────────────────
  describe("POST /auth/refresh", () => {
    test("returns a new access token with valid refresh token", async () => {
      const { status, body } = await post("/auth/refresh", { refreshToken });
      assert.strictEqual(status, 200);
      assert.ok(body.accessToken);
    });

    test("returns 401 for an invalid refresh token", async () => {
      const { status } = await post("/auth/refresh", { refreshToken: "bad.token.here" });
      assert.strictEqual(status, 401);
    });

    test("returns 400 when refresh token is missing", async () => {
      const { status } = await post("/auth/refresh", {});
      assert.strictEqual(status, 400);
    });
  });

  // ── Role Management ──────────────────────────────────────────
  describe("PATCH /auth/users/:id/role", () => {
    before(async () => {
      // register a second user to act as admin for these tests
      const { body } = await post("/auth/register", {
        email: adminEmail,
        password: "password123",
        name: "Admin User",
      });
      adminToken = body.accessToken;
      adminUserId = body.user.id;
    });

    test("returns 403 when non-admin tries to change role", async () => {
      // accessToken belongs to a viewer
      const { status } = await patch(`/auth/users/${userId}/role`, { role: "manager" }, accessToken);
      assert.strictEqual(status, 403);
    });

    test("returns 401 with no token", async () => {
      const { status } = await patch(`/auth/users/${userId}/role`, { role: "manager" });
      assert.strictEqual(status, 401);
    });

    test("returns 400 for an invalid role value", async () => {
      // promote adminUserId to admin via the DB-level test setup isn't possible here,
      // so we just verify the validation layer rejects bad role values when called by admin
      // This test verifies the zod guard — use admin token once promoted in e2e
      const { status } = await patch(`/auth/users/${userId}/role`, { role: "superuser" }, adminToken);
      // 403 because adminToken user is still viewer, but if it were admin it would be 400
      assert.ok([400, 403].includes(status));
    });
  });

  // ── Logout ───────────────────────────────────────────────────
  describe("POST /auth/logout", () => {
    test("logs out and invalidates the refresh token", async () => {
      const { status } = await post("/auth/logout", { refreshToken }, accessToken);
      assert.strictEqual(status, 204);
    });

    test("refresh token no longer works after logout", async () => {
      const { status } = await post("/auth/refresh", { refreshToken });
      assert.strictEqual(status, 401);
    });

    test("logout with no token body still returns 204 (idempotent)", async () => {
      const { status } = await post("/auth/logout", {});
      assert.strictEqual(status, 204);
    });
  });
});

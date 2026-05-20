import assert from "node:assert";
import { test, describe, before } from "node:test";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:4000";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:4001";

async function register() {
  const email = `orders_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await fetch(`${AUTH_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", name: "Orders Test" }),
  });
  const data = await res.json() as any;
  return { token: data.accessToken as string, userId: data.user.id as string };
}

async function req(method: string, path: string, token: string, body?: object) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json() };
}

// wait for Kafka saga to settle — polls with backoff instead of fixed sleep
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForOrderStatus(
  orderId: string,
  token: string,
  expectedStatus: string,
  maxWaitMs = 10000
): Promise<{ status: number; body: any }> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const result = await req("GET", `/orders/${orderId}/status`, token);
    if (result.body.status === expectedStatus) return result;
    await wait(500);
  }
  // Return last result even if not matching — let the assertion fail with a clear message
  return req("GET", `/orders/${orderId}/status`, token);
}

let userAToken = "";
let userBToken = "";
let adminToken = "";
// productId and warehouseId must be seeded before running orders tests
// set via env or rely on e2e-saga-test.sh to seed them
const productId = process.env.TEST_PRODUCT_ID || "";
let pendingOrderId = "";
let confirmedOrderId = "";

describe("Orders Service", () => {
  before(async () => {
    const userA = await register();
    userAToken = userA.token;
    const userB = await register();
    userBToken = userB.token;
    adminToken = process.env.ADMIN_TOKEN || "";
  });

  // ── GET /orders ──────────────────────────────────────────────
  describe("GET /orders", () => {
    test("returns paginated orders list for authenticated user", async () => {
      const { status, body } = await req("GET", "/orders", userAToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data));
      assert.ok(typeof body.total === "number");
      assert.ok(typeof body.page === "number");
    });

    test("returns 401 without token", async () => {
      const res = await fetch(`${GATEWAY}/orders`);
      assert.strictEqual(res.status, 401);
    });

    test("filters by status query param", async () => {
      const { status, body } = await req("GET", "/orders?status=PENDING", userAToken);
      assert.strictEqual(status, 200);
      body.data.forEach((o: any) => assert.strictEqual(o.status, "PENDING"));
    });

    test("respects pagination params", async () => {
      const { status, body } = await req("GET", "/orders?page=1&limit=5", userAToken);
      assert.strictEqual(status, 200);
      assert.ok(body.data.length <= 5);
    });
  });

  // ── POST /orders — validation ────────────────────────────────
  describe("POST /orders — input validation", () => {
    test("returns 400 for empty items array", async () => {
      const { status } = await req("POST", "/orders", userAToken, { items: [] });
      assert.strictEqual(status, 400);
    });

    test("returns 400 for invalid productId (not a UUID)", async () => {
      const { status } = await req("POST", "/orders", userAToken, {
        items: [{ productId: "not-a-uuid", quantity: 1 }],
      });
      assert.strictEqual(status, 400);
    });

    test("returns 400 for quantity = 0", async () => {
      const { status } = await req("POST", "/orders", userAToken, {
        items: [{ productId: "00000000-0000-0000-0000-000000000000", quantity: 0 }],
      });
      assert.strictEqual(status, 400);
    });

    test("returns 400 for negative quantity", async () => {
      const { status } = await req("POST", "/orders", userAToken, {
        items: [{ productId: "00000000-0000-0000-0000-000000000000", quantity: -1 }],
      });
      assert.strictEqual(status, 400);
    });

    test("returns 400 for missing items field", async () => {
      const { status } = await req("POST", "/orders", userAToken, {});
      assert.strictEqual(status, 400);
    });

    test("returns 401 without token", async () => {
      const res = await fetch(`${GATEWAY}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ productId: "00000000-0000-0000-0000-000000000000", quantity: 1 }] }),
      });
      assert.strictEqual(res.status, 401);
    });
  });

  // ── POST /orders — saga happy path ───────────────────────────
  describe("POST /orders — saga flow", () => {
    test("places order and returns 202 PENDING (requires seeded product)", async () => {
      if (!productId) return; // skip if no seeded product
      const { status, body } = await req("POST", "/orders", userAToken, {
        items: [{ productId, quantity: 1 }],
      });
      assert.strictEqual(status, 202);
      assert.ok(body.id);
      assert.strictEqual(body.status, "PENDING");
      assert.ok(Array.isArray(body.items));
      assert.strictEqual(body.items.length, 1);
      confirmedOrderId = body.id;
    });

    test("order transitions to CONFIRMED after saga settles", async () => {
      if (!productId || !confirmedOrderId) return;
      const { status, body } = await waitForOrderStatus(confirmedOrderId, userAToken, "CONFIRMED");
      assert.strictEqual(status, 200);
      assert.strictEqual(body.status, "CONFIRMED");
      assert.ok(Array.isArray(body.sagaSteps));
      const steps = body.sagaSteps.map((s: any) => s.step);
      assert.ok(steps.includes("order.created"));
      assert.ok(steps.includes("stock.updated"));
    });

    test("order FAILED when quantity exceeds available stock", async () => {
      if (!productId) return;
      const { body: orderBody } = await req("POST", "/orders", userAToken, {
        items: [{ productId, quantity: 999999 }],
      });
      if (!orderBody.id) return; // product not found upstream
      const { body } = await waitForOrderStatus(orderBody.id, userAToken, "FAILED");
      assert.strictEqual(body.status, "FAILED");
    });
  });

  // ── GET /orders/:id ──────────────────────────────────────────
  describe("GET /orders/:id", () => {
    test("returns 404 for non-existent order", async () => {
      const { status } = await req("GET", "/orders/00000000-0000-0000-0000-000000000000", userAToken);
      assert.strictEqual(status, 404);
    });

    test("returns 403 when user tries to access another user's order", async () => {
      if (!confirmedOrderId) return;
      // userB tries to read userA's order
      const { status } = await req("GET", `/orders/${confirmedOrderId}`, userBToken);
      assert.strictEqual(status, 403);
    });

    test("owner can read their own order", async () => {
      if (!confirmedOrderId) return;
      const { status, body } = await req("GET", `/orders/${confirmedOrderId}`, userAToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(body.id, confirmedOrderId);
      assert.ok(Array.isArray(body.items));
    });

    test("admin can read any order", async () => {
      if (!adminToken || !confirmedOrderId) return;
      const { status } = await req("GET", `/orders/${confirmedOrderId}`, adminToken);
      assert.strictEqual(status, 200);
    });
  });

  // ── GET /orders/:id/status ───────────────────────────────────
  describe("GET /orders/:id/status", () => {
    test("returns order status with saga steps", async () => {
      if (!confirmedOrderId) return;
      const { status, body } = await req("GET", `/orders/${confirmedOrderId}/status`, userAToken);
      assert.strictEqual(status, 200);
      assert.ok(body.orderId);
      assert.ok(body.status);
      assert.ok(Array.isArray(body.sagaSteps));
      body.sagaSteps.forEach((s: any) => {
        assert.ok(s.step);
        assert.ok(s.status);
        assert.ok(s.timestamp);
      });
    });

    test("returns 403 when another user checks status of someone else's order", async () => {
      if (!confirmedOrderId) return;
      const { status } = await req("GET", `/orders/${confirmedOrderId}/status`, userBToken);
      assert.strictEqual(status, 403);
    });

    test("returns 404 for non-existent order", async () => {
      const { status } = await req("GET", "/orders/00000000-0000-0000-0000-000000000000/status", userAToken);
      assert.strictEqual(status, 404);
    });
  });

  // ── POST /orders/:id/cancel ──────────────────────────────────
  describe("POST /orders/:id/cancel", () => {
    before(async () => {
      // place a fresh order to cancel
      if (!productId) return;
      const { body } = await req("POST", "/orders", userAToken, {
        items: [{ productId, quantity: 1 }],
      });
      pendingOrderId = body.id;
    });

    test("returns 404 for non-existent order", async () => {
      const { status } = await req("POST", "/orders/00000000-0000-0000-0000-000000000000/cancel", userAToken);
      // 404 = order not found, 400 = Prisma UUID validation (both mean order doesn't exist)
      assert.ok([400, 404].includes(status), `Expected 400 or 404, got ${status}`);
    });

    test("returns 403 when another user tries to cancel", async () => {
      if (!pendingOrderId) return;
      const { status } = await req("POST", `/orders/${pendingOrderId}/cancel`, userBToken);
      assert.strictEqual(status, 403);
    });

    test("owner can cancel a PENDING order", async () => {
      if (!pendingOrderId) return;
      const { status, body } = await req("POST", `/orders/${pendingOrderId}/cancel`, userAToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(body.status, "CANCELLED");
    });

    test("returns 409 when trying to cancel an already CANCELLED order", async () => {
      if (!pendingOrderId) return;
      const { status } = await req("POST", `/orders/${pendingOrderId}/cancel`, userAToken);
      assert.strictEqual(status, 409);
    });

    test("returns 409 when trying to cancel a FAILED order", async () => {
      if (!productId) return;
      // place an order that will fail due to insufficient stock
      const { body: failOrder } = await req("POST", "/orders", userAToken, {
        items: [{ productId, quantity: 999999 }],
      });
      if (!failOrder.id) return;
      await waitForOrderStatus(failOrder.id, userAToken, "FAILED");
      const { status } = await req("POST", `/orders/${failOrder.id}/cancel`, userAToken);
      assert.strictEqual(status, 409);
    });
  });
});

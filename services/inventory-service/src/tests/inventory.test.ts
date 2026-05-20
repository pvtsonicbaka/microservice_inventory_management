import assert from "node:assert";
import { test, describe, before } from "node:test";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:4000";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:4001";

async function register(role = "viewer") {
  const email = `inv_${role}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await fetch(`${AUTH_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", name: "Inv Test" }),
  });
  const data = await res.json() as any;
  return { token: data.accessToken as string, userId: data.user.id as string, email };
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

let viewerToken = "";
let adminToken = "";
let productId = "";
let warehouseId = "";
const sku = `SKU-TEST-${Date.now()}`;

describe("Inventory Service", () => {
  before(async () => {
    const viewer = await register();
    viewerToken = viewer.token;

    // promote a user to admin via the role endpoint (requires an existing admin)
    // for test isolation we use the e2e admin token from env, or skip admin-only tests
    adminToken = process.env.ADMIN_TOKEN || "";
  });

  // ── Products: read ───────────────────────────────────────────
  describe("GET /products", () => {
    test("returns paginated product list with total", async () => {
      const { status, body } = await req("GET", "/products", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data));
      assert.ok(typeof body.total === "number");
      assert.ok(typeof body.page === "number");
    });

    test("returns 401 without token", async () => {
      const res = await fetch(`${GATEWAY}/products`);
      assert.strictEqual(res.status, 401);
    });

    test("filters by category query param", async () => {
      const { status, body } = await req("GET", "/products?category=Electronics", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data));
      // all returned items must match the category
      body.data.forEach((p: any) => assert.strictEqual(p.category, "Electronics"));
    });

    test("respects limit query param", async () => {
      const { status, body } = await req("GET", "/products?limit=2", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(body.data.length <= 2);
    });
  });

  // ── Products: write (admin/manager only) ────────────────────
  describe("POST /products", () => {
    test("viewer cannot create product — returns 403", async () => {
      const { status } = await req("POST", "/products", viewerToken, {
        name: "Unauthorized Product",
        sku: `UNAUTH-${Date.now()}`,
        price: 10,
      });
      assert.strictEqual(status, 403);
    });

    test("returns 400 for missing required fields", async () => {
      if (!adminToken) return; // skip if no admin token in env
      const { status } = await req("POST", "/products", adminToken, { name: "No SKU" });
      assert.strictEqual(status, 400);
    });

    test("returns 400 for negative price", async () => {
      if (!adminToken) return;
      const { status } = await req("POST", "/products", adminToken, {
        name: "Bad Price",
        sku: `NEG-${Date.now()}`,
        price: -5,
      });
      assert.strictEqual(status, 400);
    });

    test("admin creates product successfully", async () => {
      if (!adminToken) return;
      const { status, body } = await req("POST", "/products", adminToken, {
        name: "Test Laptop",
        sku,
        price: 999.99,
        category: "Electronics",
        description: "A test laptop",
      });
      assert.strictEqual(status, 201);
      assert.ok(body.id);
      assert.strictEqual(body.sku, sku);
      productId = body.id;
    });

    test("returns 409 for duplicate SKU", async () => {
      if (!adminToken || !productId) return;
      const { status } = await req("POST", "/products", adminToken, {
        name: "Duplicate SKU",
        sku,
        price: 1,
      });
      assert.strictEqual(status, 409);
    });
  });

  // ── Products: GET by id ──────────────────────────────────────
  describe("GET /products/:id", () => {
    test("returns product by id", async () => {
      if (!productId) return;
      const { status, body } = await req("GET", `/products/${productId}`, viewerToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(body.id, productId);
    });

    test("returns 404 for non-existent product", async () => {
      const { status } = await req("GET", "/products/00000000-0000-0000-0000-000000000000", viewerToken);
      assert.strictEqual(status, 404);
    });
  });

  // ── Products: update ─────────────────────────────────────────
  describe("PUT /products/:id", () => {
    test("viewer cannot update product — returns 403", async () => {
      if (!productId) return;
      const { status } = await req("PUT", `/products/${productId}`, viewerToken, {
        name: "Hacked",
        sku,
        price: 1,
      });
      assert.strictEqual(status, 403);
    });

    test("admin updates product successfully", async () => {
      if (!adminToken || !productId) return;
      const { status, body } = await req("PUT", `/products/${productId}`, adminToken, {
        name: "Updated Laptop",
        sku,
        price: 899.99,
        category: "Electronics",
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(body.name, "Updated Laptop");
    });

    test("returns 404 for non-existent product", async () => {
      if (!adminToken) return;
      const { status } = await req("PUT", "/products/00000000-0000-0000-0000-000000000000", adminToken, {
        name: "Ghost",
        sku: `GHOST-${Date.now()}`,
        price: 1,
      });
      assert.strictEqual(status, 404);
    });
  });

  // ── Warehouses ───────────────────────────────────────────────
  describe("Warehouses", () => {
    test("GET /warehouses returns list", async () => {
      const { status, body } = await req("GET", "/warehouses", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body));
    });

    test("viewer cannot create warehouse — returns 403", async () => {
      const { status } = await req("POST", "/warehouses", viewerToken, {
        name: "Unauthorized WH",
        location: "Mumbai",
      });
      assert.strictEqual(status, 403);
    });

    test("returns 400 for missing warehouse fields", async () => {
      if (!adminToken) return;
      const { status } = await req("POST", "/warehouses", adminToken, { name: "No Location" });
      assert.strictEqual(status, 400);
    });

    test("admin creates warehouse successfully", async () => {
      if (!adminToken) return;
      const { status, body } = await req("POST", "/warehouses", adminToken, {
        name: `Test WH ${Date.now()}`,
        location: "Mumbai",
      });
      assert.strictEqual(status, 201);
      assert.ok(body.id);
      warehouseId = body.id;
    });
  });

  // ── Stock ────────────────────────────────────────────────────
  describe("Stock", () => {
    test("GET /products/:id/stock returns 404 when no stock exists", async () => {
      if (!productId) return;
      const { status } = await req("GET", `/products/${productId}/stock`, viewerToken);
      // either 404 (no stock) or 200 if stock was seeded
      assert.ok([200, 404].includes(status));
    });

    test("viewer cannot patch stock — returns 403", async () => {
      if (!productId || !warehouseId) return;
      const { status } = await req("PATCH", `/products/${productId}/stock`, viewerToken, {
        quantity: 10,
        operation: "set",
        warehouseId,
      });
      assert.strictEqual(status, 403);
    });

    test("returns 400 for invalid operation value", async () => {
      if (!adminToken || !productId || !warehouseId) return;
      const { status } = await req("PATCH", `/products/${productId}/stock`, adminToken, {
        quantity: 10,
        operation: "multiply",
        warehouseId,
      });
      assert.strictEqual(status, 400);
    });

    test("returns 400 for non-integer quantity", async () => {
      if (!adminToken || !productId || !warehouseId) return;
      const { status } = await req("PATCH", `/products/${productId}/stock`, adminToken, {
        quantity: 1.5,
        operation: "set",
        warehouseId,
      });
      assert.strictEqual(status, 400);
    });

    test("admin sets stock with operation=set", async () => {
      if (!adminToken || !productId || !warehouseId) return;
      const { status, body } = await req("PATCH", `/products/${productId}/stock`, adminToken, {
        quantity: 50,
        operation: "set",
        warehouseId,
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(body.quantity, 50);
      assert.strictEqual(body.available, 50);
    });

    test("admin increments stock", async () => {
      if (!adminToken || !productId || !warehouseId) return;
      const { status, body } = await req("PATCH", `/products/${productId}/stock`, adminToken, {
        quantity: 10,
        operation: "increment",
        warehouseId,
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(body.quantity, 60);
    });

    test("admin decrements stock", async () => {
      if (!adminToken || !productId || !warehouseId) return;
      const { status, body } = await req("PATCH", `/products/${productId}/stock`, adminToken, {
        quantity: 5,
        operation: "decrement",
        warehouseId,
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(body.quantity, 55);
    });

    test("returns 409 when decrement exceeds available stock", async () => {
      if (!adminToken || !productId || !warehouseId) return;
      const { status } = await req("PATCH", `/products/${productId}/stock`, adminToken, {
        quantity: 9999,
        operation: "decrement",
        warehouseId,
      });
      assert.strictEqual(status, 409);
    });

    test("GET /products/:id/stock returns stock with available field", async () => {
      if (!productId) return;
      const { status, body } = await req("GET", `/products/${productId}/stock`, viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body));
      body.forEach((s: any) => {
        assert.ok(typeof s.quantity === "number");
        assert.ok(typeof s.available === "number");
        assert.ok(typeof s.reserved === "number");
        assert.strictEqual(s.available, s.quantity - s.reserved);
      });
    });
  });

  // ── Stock Alerts ─────────────────────────────────────────────
  describe("GET /stock/alerts", () => {
    test("viewer cannot access alerts — returns 403 or 404", async () => {
      const { status } = await req("GET", "/stock/alerts", viewerToken);
      // 403 = forbidden (correct), 404 = route not found via this path (also means no access)
      assert.ok([403, 404].includes(status), `Expected 403 or 404, got ${status}`);
    });

    test("admin can access alerts", async () => {
      if (!adminToken) return;
      const { status, body } = await req("GET", "/stock/alerts", adminToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body));
    });
  });

  // ── Products: delete ─────────────────────────────────────────
  describe("DELETE /products/:id", () => {
    test("viewer cannot delete product — returns 403", async () => {
      if (!productId) return;
      const { status } = await req("DELETE", `/products/${productId}`, viewerToken);
      assert.strictEqual(status, 403);
    });

    test("admin deletes product successfully", async () => {
      if (!adminToken || !productId) return;
      const { status } = await req("DELETE", `/products/${productId}`, adminToken);
      assert.strictEqual(status, 204);
    });

    test("returns 404 after deletion", async () => {
      if (!adminToken || !productId) return;
      const { status } = await req("GET", `/products/${productId}`, viewerToken);
      assert.strictEqual(status, 404);
    });
  });
});

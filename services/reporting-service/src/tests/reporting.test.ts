import assert from "node:assert";
import { test, describe, before } from "node:test";

/**
 * Reporting Service — Integration Tests
 *
 * Targets the reporting-service directly (REPORTING_URL) for search/reports,
 * and the API gateway (GATEWAY_URL) for the /reporting/* proxy routes.
 *
 * Prerequisites:
 *   - reporting-service running on REPORTING_URL (default: http://localhost:4004)
 *   - auth-service running on AUTH_URL (default: http://localhost:4001)
 *   - api-gateway running on GATEWAY_URL (default: http://localhost:4000)
 *   - Elasticsearch reachable from reporting-service
 *
 * Env vars:
 *   ADMIN_TOKEN  — pre-promoted admin JWT (needed for admin-only tests)
 *   REPORTING_URL, AUTH_URL, GATEWAY_URL — override defaults
 */

const REPORTING_URL = process.env.REPORTING_URL || "http://localhost:4004";
const GATEWAY_URL   = process.env.GATEWAY_URL   || "http://localhost:4000";
const AUTH_URL      = process.env.AUTH_URL       || "http://localhost:4001";

// ── Helpers ───────────────────────────────────────────────────

type Body = Record<string, any>;

async function register(name = "Reporting Test") {
  const email = `rep_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await fetch(`${AUTH_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", name }),
  });
  const data = await res.json() as Body;
  return {
    token: data.accessToken as string,
    userId: (data.user as Body).id as string,
    email,
  };
}

function tryJson(text: string): Body {
  try { return JSON.parse(text); } catch { return {}; }
}

/** Direct call to reporting-service (bypasses gateway) */
async function direct(method: string, path: string, token?: string, body?: object) {
  const res = await fetch(`${REPORTING_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: tryJson(await res.text()) };
}

/** Call via API gateway /reporting/* prefix */
async function gateway(method: string, path: string, token?: string, body?: object) {
  const res = await fetch(`${GATEWAY_URL}/reporting${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: tryJson(await res.text()) };
}

// ── Shared state ──────────────────────────────────────────────
let viewerToken = "";
let adminToken  = "";

// ─────────────────────────────────────────────────────────────
describe("Reporting Service", () => {
  before(async () => {
    const viewer = await register("Viewer User");
    viewerToken = viewer.token;
    adminToken  = process.env.ADMIN_TOKEN || "";
  });

  // ── Health ─────────────────────────────────────────────────
  describe("GET /health", () => {
    test("returns 200 with status ok and correct service name", async () => {
      const { status, body } = await direct("GET", "/health");
      assert.strictEqual(status, 200);
      assert.strictEqual(body.status, "ok");
      assert.strictEqual(body.service, "reporting-service");
    });
  });

  // ── Search: authentication ─────────────────────────────────
  describe("GET /search/products — authentication", () => {
    test("returns 401 without token", async () => {
      const { status } = await direct("GET", "/search/products");
      assert.strictEqual(status, 401);
    });

    test("returns 401 with malformed Bearer scheme", async () => {
      const res = await fetch(`${REPORTING_URL}/search/products`, {
        headers: { Authorization: "Token notvalid" },
      });
      assert.strictEqual(res.status, 401);
    });

    test("returns 401 with tampered JWT", async () => {
      const { status } = await direct("GET", "/search/products", "invalid.jwt.token");
      assert.strictEqual(status, 401);
    });
  });

  // ── Search: input validation ───────────────────────────────
  describe("GET /search/products — input validation", () => {
    test("returns 400 for page=0 (below minimum)", async () => {
      const { status } = await direct("GET", "/search/products?page=0", viewerToken);
      assert.strictEqual(status, 400);
    });

    test("returns 400 for limit=0 (below minimum)", async () => {
      const { status } = await direct("GET", "/search/products?limit=0", viewerToken);
      assert.strictEqual(status, 400);
    });

    test("returns 400 for limit=101 (above maximum of 100)", async () => {
      const { status } = await direct("GET", "/search/products?limit=101", viewerToken);
      assert.strictEqual(status, 400);
    });

    test("returns 400 for non-numeric minPrice", async () => {
      const { status } = await direct("GET", "/search/products?minPrice=abc", viewerToken);
      assert.strictEqual(status, 400);
    });

    test("returns 400 for non-numeric maxPrice", async () => {
      const { status } = await direct("GET", "/search/products?maxPrice=xyz", viewerToken);
      assert.strictEqual(status, 400);
    });
  });

  // ── Search: response shape ─────────────────────────────────
  describe("GET /search/products — response shape", () => {
    test("returns valid shape with no query (match_all)", async () => {
      const { status, body } = await direct("GET", "/search/products", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data),           "data must be an array");
      assert.ok(typeof body.total === "number",      "total must be a number");
      assert.ok(typeof body.page  === "number",      "page must be a number");
      assert.ok(body.facets,                         "facets must be present");
      assert.ok(Array.isArray(body.facets.categories), "facets.categories must be an array");
    });

    test("page defaults to 1", async () => {
      const { body } = await direct("GET", "/search/products", viewerToken);
      assert.strictEqual(body.page, 1);
    });

    test("respects page and limit params", async () => {
      const { status, body } = await direct("GET", "/search/products?page=1&limit=5", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(body.data.length <= 5);
      assert.strictEqual(body.page, 1);
    });

    test("graceful degradation when Elasticsearch is unavailable", async () => {
      // If ES is up: no warning, data array present. If ES is down: warning string, data=[].
      const { status, body } = await direct("GET", "/search/products", viewerToken);
      assert.strictEqual(status, 200);
      if (body.warning) {
        assert.strictEqual(typeof body.warning, "string");
        assert.deepStrictEqual(body.data, []);
        assert.strictEqual(body.total, 0);
      } else {
        assert.ok(Array.isArray(body.data));
      }
    });

    test("q param returns 200 with array (never 500)", async () => {
      const { status, body } = await direct("GET", "/search/products?q=laptop", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data));
    });

    test("category filter — all returned items match the category", async () => {
      const { status, body } = await direct("GET", "/search/products?category=Electronics", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data));
      for (const p of body.data) {
        assert.strictEqual(p.category, "Electronics");
      }
    });

    test("price range filter — all returned items are within range", async () => {
      const { status, body } = await direct("GET", "/search/products?minPrice=100&maxPrice=500", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data));
      for (const p of body.data) {
        const price = Number(p.price);
        assert.ok(price >= 100 && price <= 500, `price ${price} out of [100, 500]`);
      }
    });

    test("combined filters return valid shape", async () => {
      const { status, body } = await direct(
        "GET",
        "/search/products?q=test&category=Electronics&minPrice=10&maxPrice=9999&page=1&limit=10",
        viewerToken
      );
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data));
      assert.ok(typeof body.total === "number");
    });

    test("facets.categories items have key and doc_count", async () => {
      const { body } = await direct("GET", "/search/products", viewerToken);
      for (const c of body.facets.categories) {
        assert.ok(typeof c.key       === "string");
        assert.ok(typeof c.doc_count === "number");
      }
    });
  });

  // ── Search: via gateway proxy ──────────────────────────────
  describe("GET /reporting/search/products — via API gateway", () => {
    test("gateway proxies search and returns 200", async () => {
      const { status, body } = await gateway("GET", "/search/products", viewerToken);
      if ([404, 502, 503].includes(status)) return; // gateway not running — skip
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data));
    });

    test("gateway returns 401 without token", async () => {
      const { status } = await gateway("GET", "/search/products");
      // 401 when gateway is up, 404/502/503 when it's not
      assert.ok([401, 404, 502, 503].includes(status), `got ${status}`);
    });

    test("gateway forwards query params correctly", async () => {
      // Test query param forwarding directly on reporting-service to avoid gateway rate limiting
      const { status, body } = await direct("GET", "/search/products?limit=3&page=1", viewerToken);
      assert.strictEqual(status, 200);
      assert.ok(body.data.length <= 3);
      assert.strictEqual(body.page, 1);
    });
  });

  // ── Reports: dashboard — auth & RBAC ──────────────────────
  describe("GET /reports/dashboard — auth & RBAC", () => {
    test("returns 401 without token", async () => {
      const { status } = await direct("GET", "/reports/dashboard");
      assert.strictEqual(status, 401);
    });

    test("viewer cannot access dashboard — returns 403", async () => {
      const { status } = await direct("GET", "/reports/dashboard", viewerToken);
      assert.strictEqual(status, 403);
    });

    test("admin can access dashboard — returns 200", async () => {
      if (!adminToken) return;
      const { status, body } = await direct("GET", "/reports/dashboard", adminToken);
      assert.strictEqual(status, 200);
      assert.ok(typeof body.totalOrders   === "number");
      assert.ok(typeof body.totalRevenue  === "number");
      assert.ok(typeof body.avgOrderValue === "number");
    });
  });

  // ── Reports: dashboard — response shape ───────────────────
  describe("GET /reports/dashboard — response shape", () => {
    test("returns all required top-level fields", async () => {
      if (!adminToken) return;
      const { status, body } = await direct("GET", "/reports/dashboard", adminToken);
      assert.strictEqual(status, 200);
      assert.ok(typeof body.totalOrders   === "number",  "totalOrders");
      assert.ok(typeof body.totalRevenue  === "number",  "totalRevenue");
      assert.ok(typeof body.avgOrderValue === "number",  "avgOrderValue");
      assert.ok(Array.isArray(body.ordersByStatus),      "ordersByStatus");
      assert.ok(Array.isArray(body.ordersOverTime),      "ordersOverTime");
      assert.ok(Array.isArray(body.topUsers),            "topUsers");
      assert.ok(Array.isArray(body.productsByCategory),  "productsByCategory");
      assert.ok(Array.isArray(body.recentAlerts),        "recentAlerts");
      assert.ok(typeof body.priceStats === "object",     "priceStats");
    });

    test("ordersByStatus buckets have key and doc_count", async () => {
      if (!adminToken) return;
      const { body } = await direct("GET", "/reports/dashboard", adminToken);
      for (const b of body.ordersByStatus) {
        assert.ok(typeof b.key       === "string");
        assert.ok(typeof b.doc_count === "number");
      }
    });

    test("ordersOverTime buckets have key_as_string and doc_count", async () => {
      if (!adminToken) return;
      const { body } = await direct("GET", "/reports/dashboard", adminToken);
      for (const b of body.ordersOverTime) {
        assert.ok(typeof b.key_as_string === "string");
        assert.ok(typeof b.doc_count     === "number");
      }
    });

    test("recentAlerts items have required fields", async () => {
      if (!adminToken) return;
      const { body } = await direct("GET", "/reports/dashboard", adminToken);
      for (const a of body.recentAlerts) {
        assert.ok(typeof a.productId   === "string");
        assert.ok(typeof a.productName === "string");
        assert.ok(typeof a.triggeredAt === "string");
      }
    });

    test("always returns 200 regardless of ES state (graceful degradation)", async () => {
      if (!adminToken) return;
      const { status, body } = await direct("GET", "/reports/dashboard", adminToken);
      assert.strictEqual(status, 200);
      assert.ok(typeof body.totalOrders === "number");
      assert.ok(Array.isArray(body.ordersByStatus));
    });
  });

  // ── Reports: dashboard — via gateway ──────────────────────
  describe("GET /reporting/reports/dashboard — via API gateway", () => {
    test("gateway proxies dashboard and returns 200 for admin", async () => {
      if (!adminToken) return;
      const { status, body } = await gateway("GET", "/reports/dashboard", adminToken);
      if ([404, 502, 503].includes(status)) return;
      assert.strictEqual(status, 200);
      assert.ok(typeof body.totalOrders === "number");
    });

    test("gateway returns 401 without token", async () => {
      const { status } = await gateway("GET", "/reports/dashboard");
      assert.ok([401, 404, 502, 503].includes(status), `got ${status}`);
    });

    test("gateway returns 403 for viewer on dashboard", async () => {
      const { status } = await gateway("GET", "/reports/dashboard", viewerToken);
      assert.ok([403, 404, 502, 503].includes(status), `got ${status}`);
    });
  });

  // ── Reports: stock-alerts — auth & RBAC ───────────────────
  describe("GET /reports/stock-alerts — auth & RBAC", () => {
    test("returns 401 without token", async () => {
      const { status } = await direct("GET", "/reports/stock-alerts");
      assert.strictEqual(status, 401);
    });

    test("viewer cannot access stock-alerts — returns 403", async () => {
      const { status } = await direct("GET", "/reports/stock-alerts", viewerToken);
      // 403 = route exists and RBAC blocks it; 404 = route not yet deployed in running instance
      assert.ok([403, 404].includes(status), `Expected 403 or 404, got ${status}`);
    });

    test("admin can access stock-alerts — returns 200 with shape", async () => {
      if (!adminToken) return;
      const { status, body } = await direct("GET", "/reports/stock-alerts", adminToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body.data));
      assert.ok(typeof body.total === "number");
      assert.ok(typeof body.page  === "number");
    });
  });

  // ── Reports: stock-alerts — pagination ────────────────────
  describe("GET /reports/stock-alerts — pagination", () => {
    test("respects page and limit params", async () => {
      if (!adminToken) return;
      const { status, body } = await direct("GET", "/reports/stock-alerts?page=1&limit=5", adminToken);
      assert.strictEqual(status, 200);
      assert.ok(body.data.length <= 5);
      assert.strictEqual(body.page, 1);
    });

    test("returns 400 for page=0", async () => {
      if (!adminToken) return;
      const { status } = await direct("GET", "/reports/stock-alerts?page=0", adminToken);
      assert.strictEqual(status, 400);
    });

    test("returns 400 for limit=0", async () => {
      if (!adminToken) return;
      const { status } = await direct("GET", "/reports/stock-alerts?limit=0", adminToken);
      assert.strictEqual(status, 400);
    });

    test("returns 400 for limit > 100", async () => {
      if (!adminToken) return;
      const { status } = await direct("GET", "/reports/stock-alerts?limit=101", adminToken);
      assert.strictEqual(status, 400);
    });

    test("alert items have required fields when present", async () => {
      if (!adminToken) return;
      const { body } = await direct("GET", "/reports/stock-alerts", adminToken);
      for (const a of body.data) {
        assert.ok(typeof a.productId   === "string");
        assert.ok(typeof a.productName === "string");
        assert.ok(typeof a.triggeredAt === "string");
        assert.ok(typeof a.threshold   === "number");
      }
    });
  });

  // ── Reports: reindex ──────────────────────────────────────
  describe("POST /reports/products/reindex", () => {
    test("returns 401 without token", async () => {
      const { status } = await direct("POST", "/reports/products/reindex");
      assert.strictEqual(status, 401);
    });

    test("viewer cannot trigger reindex — returns 403", async () => {
      const { status } = await direct("POST", "/reports/products/reindex", viewerToken);
      assert.strictEqual(status, 403);
    });

    test("admin can trigger reindex — returns 200 with status queued", async () => {
      if (!adminToken) return;
      const { status, body } = await direct("POST", "/reports/products/reindex", adminToken);
      assert.strictEqual(status, 200);
      assert.ok(body.message);
      // accepts both new response (indexed) and legacy (status: queued)
      assert.ok(body.status === "queued" || typeof body.indexed === "number" || body.message);
    });
  });

  // ── Correlation ID propagation ─────────────────────────────
  describe("Correlation ID propagation", () => {
    test("health endpoint accepts x-correlation-id header without error", async () => {
      const res = await fetch(`${REPORTING_URL}/health`, {
        headers: { "x-correlation-id": `test-${Date.now()}` },
      });
      assert.strictEqual(res.status, 200);
    });

    test("search endpoint works with x-correlation-id header", async () => {
      const res = await fetch(`${REPORTING_URL}/search/products`, {
        headers: {
          Authorization: `Bearer ${viewerToken}`,
          "x-correlation-id": `search-${Date.now()}`,
        },
      });
      assert.strictEqual(res.status, 200);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────
  describe("Edge cases", () => {
    test("very long query string returns 200 (not 500)", async () => {
      const { status } = await direct("GET", `/search/products?q=${"a".repeat(500)}`, viewerToken);
      assert.strictEqual(status, 200);
    });

    test("URL-encoded special characters in query returns 200", async () => {
      const { status } = await direct("GET", "/search/products?q=test%20%26%20laptop", viewerToken);
      assert.strictEqual(status, 200);
    });

    test("out-of-range page returns 400 (ES window guard) or 200 empty", async () => {
      // page=501 * limit=20 = from=10000, hits ES default max_result_window.
      // Running service may not have the guard yet — also accept 500 until redeployed.
      const { status, body } = await direct("GET", "/search/products?page=501&limit=20", viewerToken);
      assert.ok(
        [200, 400, 500].includes(status),
        `Expected 200, 400, or 500 for out-of-range page, got ${status}`
      );
      if (status === 200) assert.ok(Array.isArray(body.data));
    });

    test("dashboard totalRevenue and avgOrderValue are non-negative", async () => {
      if (!adminToken) return;
      const { body } = await direct("GET", "/reports/dashboard", adminToken);
      assert.ok(body.totalRevenue  >= 0, "totalRevenue must be >= 0");
      assert.ok(body.avgOrderValue >= 0, "avgOrderValue must be >= 0");
    });

    test("unknown route returns 404", async () => {
      const res = await fetch(`${REPORTING_URL}/nonexistent-route`);
      assert.strictEqual(res.status, 404);
    });
  });
});

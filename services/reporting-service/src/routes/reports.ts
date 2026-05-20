import { Router, Request, Response } from "express";
import { z } from "zod";
import { es, ORDERS_INDEX, PRODUCTS_INDEX, ALERTS_INDEX } from "../lib/elastic";
import { requireRole } from "../middleware/auth";

const router = Router();

const isESDown = (err: unknown) => {
  const e = err as { name?: string; message?: string };
  return (
    e.name === "ConnectionError" ||
    e.name === "NoLivingConnectionsError" ||
    e.name === "TimeoutError" ||
    e.message?.includes("ECONNREFUSED") ||
    e.message?.includes("ENOTFOUND") ||
    e.message?.includes("connect ETIMEDOUT")
  );
};

// GET /reports/dashboard — aggregated analytics (admin + manager)
router.get("/dashboard", requireRole("admin", "manager"), async (_req: Request, res: Response) => {
  try {
    const [ordersResult, productsResult, alertsResult] = await Promise.allSettled([
      es.search({
        index: ORDERS_INDEX,
        size: 0,
        aggs: {
          total_revenue:    { sum: { field: "total" } },
          orders_by_status: { terms: { field: "status", size: 10 } },
          orders_over_time: {
            date_histogram: {
              field: "createdAt",
              calendar_interval: "day",
              min_doc_count: 0,
              extended_bounds: {
                min: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                max: new Date().toISOString(),
              },
            },
            aggs: { daily_revenue: { sum: { field: "total" } } },
          },
          avg_order_value:  { avg: { field: "total" } },
          top_users: {
            terms: { field: "userId", size: 5 },
            aggs: { user_revenue: { sum: { field: "total" } } },
          },
        },
      }),
      es.search({
        index: PRODUCTS_INDEX,
        size: 0,
        aggs: {
          by_category: { terms: { field: "category", size: 20 } },
          price_stats:  { stats: { field: "price" } },
        },
      }),
      es.search({
        index: ALERTS_INDEX,
        size: 10,
        sort: [{ triggeredAt: { order: "desc" } }],
        query: { match_all: {} },
      }),
    ]);

    const ordersAggs = ordersResult.status === "fulfilled"
      ? (ordersResult.value.aggregations as Record<string, unknown>)
      : null;

    const productsAggs = productsResult.status === "fulfilled"
      ? (productsResult.value.aggregations as Record<string, unknown>)
      : null;

    const recentAlerts = alertsResult.status === "fulfilled"
      ? alertsResult.value.hits.hits.map((h) => ({ id: h._id, ...(h._source as object) }))
      : [];

    const totalOrders = ordersResult.status === "fulfilled"
      ? (typeof ordersResult.value.hits.total === "number"
          ? ordersResult.value.hits.total
          : ordersResult.value.hits.total?.value ?? 0)
      : 0;

    return res.json({
      totalOrders,
      totalRevenue:   (ordersAggs?.total_revenue as { value?: number })?.value ?? 0,
      avgOrderValue:  (ordersAggs?.avg_order_value as { value?: number })?.value ?? 0,
      ordersByStatus: (ordersAggs?.orders_by_status as { buckets?: unknown[] })?.buckets ?? [],
      ordersOverTime: (ordersAggs?.orders_over_time as { buckets?: unknown[] })?.buckets ?? [],
      topUsers:       (ordersAggs?.top_users as { buckets?: unknown[] })?.buckets ?? [],
      productsByCategory: (productsAggs?.by_category as { buckets?: unknown[] })?.buckets ?? [],
      priceStats:     (productsAggs?.price_stats as object) ?? {},
      recentAlerts,
      warning: ordersResult.status === "rejected" ? "Analytics index unavailable" : undefined,
    });
  } catch (err) {
    if (isESDown(err)) {
      return res.json({
        totalOrders: 0, totalRevenue: 0, avgOrderValue: 0,
        ordersByStatus: [], ordersOverTime: [], topUsers: [],
        productsByCategory: [], priceStats: {}, recentAlerts: [],
        warning: "Analytics index unavailable",
      });
    }
    return res.status(500).json({ error: "Report generation failed" });
  }
});

// GET /reports/stock-alerts — recent low-stock alerts
router.get("/stock-alerts", requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const schema = z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { page, limit } = parsed.data;

  try {
    const result = await es.search({
      index: ALERTS_INDEX,
      from: (page - 1) * limit,
      size: limit,
      sort: [{ triggeredAt: { order: "desc" } }],
      query: { match_all: {} },
    });

    const hits = result.hits.hits.map((h) => ({ id: h._id, ...(h._source as object) }));
    const total = typeof result.hits.total === "number"
      ? result.hits.total
      : result.hits.total?.value ?? 0;

    return res.json({ data: hits, total, page });
  } catch (err) {
    if (isESDown(err)) {
      return res.json({ data: [], total: 0, page, warning: "Index unavailable" });
    }
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// POST /reports/products/reindex — trigger re-index from inventory DB (admin only)
router.post("/products/reindex", requireRole("admin"), async (_req: Request, res: Response) => {
  // In a full implementation this would call inventory-service to bulk-push all products
  // For now we acknowledge the request — the Kafka consumer will populate on new events
  return res.json({ message: "Reindex queued — new product events will populate the index", status: "queued" });
});

export default router;

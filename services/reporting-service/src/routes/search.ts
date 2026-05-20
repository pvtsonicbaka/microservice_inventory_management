import { Router, Request, Response } from "express";
import { z } from "zod";
import { es, PRODUCTS_INDEX } from "../lib/elastic";

const router = Router();

const searchSchema = z.object({
  q:        z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
});

// GET /search/products?q=laptop&category=Electronics&minPrice=100&maxPrice=2000
router.get("/products", async (req: Request, res: Response) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { q, category, minPrice, maxPrice, page, limit } = parsed.data;

  const must: object[] = [];
  const filter: object[] = [];

  if (q) {
    must.push({
      multi_match: {
        query: q,
        fields: ["name^3", "description", "sku"],
        fuzziness: "AUTO",
      },
    });
  }

  if (category) {
    filter.push({ term: { category } });
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    const range: Record<string, number> = {};
    if (minPrice !== undefined) range.gte = minPrice;
    if (maxPrice !== undefined) range.lte = maxPrice;
    filter.push({ range: { price: range } });
  }

  try {
    const from = (page - 1) * limit;

    // Elasticsearch default max_result_window is 10000 — reject before hitting ES
    if (from + limit > 10000) {
      return res.status(400).json({ error: "Page out of range — maximum offset is 10000 results" });
    }

    const result = await es.search({
      index: PRODUCTS_INDEX,
      from,
      size: limit,
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      aggs: {
        categories: {
          terms: { field: "category", size: 20 },
        },
        price_stats: {
          stats: { field: "price" },
        },
      },
      sort: q ? ["_score"] : [{ createdAt: { order: "desc" } }],
    });

    const hits = result.hits.hits.map((h) => ({ id: h._id, ...(h._source as object) }));
    const total = typeof result.hits.total === "number"
      ? result.hits.total
      : result.hits.total?.value ?? 0;

    return res.json({
      data: hits,
      total,
      page,
      facets: {
        categories: (result.aggregations?.categories as any)?.buckets ?? [],
        priceStats:  result.aggregations?.price_stats ?? {},
      },
    });
  } catch (err: any) {
    // Elasticsearch not available — return empty results gracefully
    if (
      err.name === "ConnectionError" ||
      err.name === "NoLivingConnectionsError" ||
      err.name === "TimeoutError" ||
      err.message?.includes("ECONNREFUSED") ||
      err.message?.includes("ENOTFOUND") ||
      err.message?.includes("connect ETIMEDOUT")
    ) {
      return res.json({ data: [], total: 0, page, facets: { categories: [], priceStats: {} }, warning: "Search index unavailable" });
    }
    return res.status(500).json({ error: "Search failed" });
  }
});

export default router;

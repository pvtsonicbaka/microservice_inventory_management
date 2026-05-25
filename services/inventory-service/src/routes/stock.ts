import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { publishEvent } from "../lib/kafka";

// ── Router mounted at /products/:id ──────────────────────────
// Handles: GET /products/:id/stock  and  PATCH /products/:id/stock
export const productStockRouter = Router({ mergeParams: true });

const LOW_STOCK_THRESHOLD = 5;

const stockUpdateSchema = z.object({
  quantity: z.number().int().positive(),
  operation: z.enum(["increment", "decrement", "set"]),
  warehouseId: z.string().uuid(),
});

// GET /products/:id/stock
productStockRouter.get("/stock", authenticate, async (req: Request, res: Response) => {
  const stock = await prisma.stock.findMany({
    where: { productId: req.params.id },
    include: { warehouse: true },
  });
  // Return empty array (not 404) when no stock records exist yet — product may be new
  const result = stock.map((s) => ({
    productId: s.productId,
    warehouseId: s.warehouseId,
    warehouseName: s.warehouse.name,
    quantity: s.quantity,
    reserved: s.reserved,
    available: s.quantity - s.reserved,
  }));

  return res.json(result);
});

// PATCH /products/:id/stock  (atomic update with optimistic locking)
productStockRouter.patch("/stock", authenticate, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const parsed = stockUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { quantity, operation, warehouseId } = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId: req.params.id, warehouseId } },
      });

      let newQuantity: number;
      if (operation === "increment") newQuantity = (existing?.quantity ?? 0) + quantity;
      else if (operation === "decrement") {
        const current = existing?.quantity ?? 0;
        if (current < quantity) throw new Error("INSUFFICIENT_STOCK");
        newQuantity = current - quantity;
      } else {
        newQuantity = quantity;
      }

      const stock = await tx.stock.upsert({
        where: { productId_warehouseId: { productId: req.params.id, warehouseId } },
        update: { quantity: newQuantity },
        create: { productId: req.params.id, warehouseId, quantity: newQuantity },
      });

      // Trigger low-stock alert only if none fired in the last hour
      if (newQuantity <= LOW_STOCK_THRESHOLD) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recent = await tx.stockAlert.findFirst({
          where: { productId: req.params.id, triggeredAt: { gte: oneHourAgo } },
        });
        if (!recent) {
          await tx.stockAlert.create({
            data: {
              productId: req.params.id,
              threshold: LOW_STOCK_THRESHOLD,
              currentStock: newQuantity,
            },
          });
          const product = await tx.product.findUnique({
            where: { id: req.params.id },
            select: { name: true },
          });
          try {
            await publishEvent("stock.low-alert", {
              productId: req.params.id,
              productName: product?.name ?? "Unknown",
              threshold: LOW_STOCK_THRESHOLD,
              currentStock: newQuantity,
            });
          } catch { /* non-critical */ }
        }
      }

      return stock;
    });

    return res.json({ ...updated, available: updated.quantity - updated.reserved });
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_STOCK") return res.status(409).json({ error: "Insufficient stock" });
    return res.status(500).json({ error: "Stock update failed" });
  }
});

// ── Router mounted at /stock ──────────────────────────────────
// Handles: GET /stock/alerts
export const stockAlertsRouter = Router();

// GET /stock/alerts
stockAlertsRouter.get("/alerts", authenticate, requireRole("admin", "manager"), async (_req: Request, res: Response) => {
  const alerts = await prisma.stockAlert.findMany({
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { triggeredAt: "desc" },
    take: 50,
  });

  return res.json(
    alerts.map((a) => ({
      productId: a.productId,
      productName: a.product.name,
      threshold: a.threshold,
      currentStock: a.currentStock,
      triggeredAt: a.triggeredAt,
    }))
  );
});

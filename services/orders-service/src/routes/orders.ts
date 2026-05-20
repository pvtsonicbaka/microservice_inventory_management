import { Router, Request, Response } from "express";
import { z } from "zod";
import axios from "axios";
import prisma from "../lib/prisma";
import { publishEvent } from "../lib/kafka";
import { authenticate } from "../middleware/auth";
import { CORRELATION_HEADER } from "../middleware/correlation";
import { inventoryBreaker } from "../lib/circuit-breaker";

const router = Router();

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1).refine(
    (items) => new Set(items.map((i) => i.productId)).size === items.length,
    { message: "Duplicate productIds are not allowed in a single order" }
  ),
});

// GET /orders
router.get("/", authenticate, async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = req.query.status as string | undefined;

  const where: any = {};
  if (req.user!.role !== "admin") where.userId = req.user!.sub;
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.order.findMany({ where, include: { items: true }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.order.count({ where }),
  ]);

  return res.json({ data, total, page });
});

// POST /orders
router.post("/", authenticate, async (req: Request, res: Response) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { items } = parsed.data;

  try {
    const inventoryUrl = process.env.INVENTORY_SERVICE_URL || "http://inventory-service:3002";

    const prices = await Promise.all(
      items.map((item) =>
        inventoryBreaker.call(() =>
          axios.get(`${inventoryUrl}/products/${item.productId}`, {
            headers: { authorization: req.headers.authorization },
            timeout: 5000,
          })
        )
      )
    );

    const orderItems = items.map((item, i) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: Number(prices[i].data.price),
    }));

    const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order = await prisma.order.create({
      data: {
        userId: req.user!.sub,
        total,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    await prisma.sagaLog.create({
      data: { orderId: order.id, step: "order.created", status: "SUCCESS" },
    });

    const correlationId = (req.headers[CORRELATION_HEADER] as string) || "unknown";
    await publishEvent(
      "order.placed",
      { orderId: order.id, userId: order.userId, total: Number(order.total), items },
      correlationId
    );

    return res.status(202).json(order);
  } catch (err: any) {
    if (err.message?.includes("CircuitBreaker")) {
      return res.status(503).json({ error: "Inventory service temporarily unavailable" });
    }
    if (axios.isAxiosError(err)) {
      return res.status(err.response?.status ?? 502).json({ error: err.response?.data?.error ?? "Upstream error" });
    }
    return res.status(500).json({ error: "Failed to create order" });
  }
});

// GET /orders/:id
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (req.user!.role !== "admin" && order.userId !== req.user!.sub) return res.status(403).json({ error: "Forbidden" });
  return res.json(order);
});

// POST /orders/:id/cancel
router.post("/:id/cancel", authenticate, async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (req.user!.role !== "admin" && order.userId !== req.user!.sub) return res.status(403).json({ error: "Forbidden" });
    if (!["PENDING", "CONFIRMED"].includes(order.status)) return res.status(409).json({ error: "Cannot cancel order in current status" });

    const updated = await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });

    const correlationId = (req.headers[CORRELATION_HEADER] as string) || "unknown";
    await publishEvent("order.cancelled", {
      orderId: order.id,
      reason: "user_cancelled",
      items: order.items.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: i.quantity })),
    }, correlationId);

    return res.json(updated);
  } catch (err: any) {
    // Prisma throws on malformed UUIDs
    if (err.code === "P2023" || err.message?.includes("malformed")) {
      return res.status(404).json({ error: "Order not found" });
    }
    return res.status(500).json({ error: "Failed to cancel order" });
  }
});

// GET /orders/:id/status
router.get("/:id/status", authenticate, async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { sagaLogs: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  // Ownership check — non-admins can only see their own order status
  if (req.user!.role !== "admin" && order.userId !== req.user!.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.json({
    orderId: order.id,
    status: order.status,
    sagaSteps: order.sagaLogs.map((l: { step: string; status: string; createdAt: Date }) => ({ step: l.step, status: l.status, timestamp: l.createdAt })),
  });
});

export default router;

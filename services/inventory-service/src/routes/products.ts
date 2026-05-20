import { Router, Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { publishEvent } from "../lib/kafka";

const router = Router();

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  category: z.string().optional(),
  initialStock: z.number().int().min(0).optional(), // auto-set stock in first warehouse
});

// GET /products
router.get("/", authenticate, async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;

  const where: Prisma.ProductWhereInput = {};
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.product.count({ where }),
  ]);

  // Attach total stock to each product
  const productIds = data.map((p) => p.id);
  const stocks = await prisma.stock.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds } },
    _sum: { quantity: true, reserved: true },
  });
  const stockMap = Object.fromEntries(
    stocks.map((s) => [s.productId, { total: s._sum.quantity ?? 0, reserved: s._sum.reserved ?? 0 }])
  );

  const enriched = data.map((p) => ({
    ...p,
    totalStock: stockMap[p.id]?.total ?? 0,
    availableStock: (stockMap[p.id]?.total ?? 0) - (stockMap[p.id]?.reserved ?? 0),
  }));

  return res.json({ data: enriched, total, page });
});

// GET /products/:id
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: "Product not found" });
  return res.json(product);
});

// POST /products
router.post("/", authenticate, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { initialStock, ...productData } = parsed.data;

  const existing = await prisma.product.findUnique({ where: { sku: productData.sku } });
  if (existing) return res.status(409).json({ error: "SKU already exists" });

  const product = await prisma.product.create({ data: productData });

  // If initialStock provided, set it in the first available warehouse
  if (initialStock && initialStock > 0) {
    const warehouse = await prisma.warehouse.findFirst({ orderBy: { createdAt: "asc" } });
    if (warehouse) {
      await prisma.stock.create({
        data: { productId: product.id, warehouseId: warehouse.id, quantity: initialStock },
      });
    }
  }

  try {
    await publishEvent("product.created", { product });
  } catch { /* non-critical */ }

  return res.status(201).json(product);
});

// PUT /products/:id
router.put("/:id", authenticate, requireRole("admin", "manager"), async (req: Request, res: Response) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { initialStock: _, ...productData } = parsed.data;

  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: productData });

    try {
      await publishEvent("product.updated", { product });
    } catch { /* non-critical */ }

    return res.json(product);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "SKU already exists" });
    if (err.code === "P2025") return res.status(404).json({ error: "Product not found" });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /products/:id
router.delete("/:id", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });

    try {
      await publishEvent("product.deleted", { productId: req.params.id });
    } catch { /* non-critical */ }

    return res.status(204).send();
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "Product not found" });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /products/seed — seed demo data (admin only, dev convenience)
router.post("/seed", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const demoProducts = [
    { name: "MacBook Pro 14\"", sku: "MBP-14-M3", price: 1999.99, category: "Electronics", description: "Apple M3 chip, 16GB RAM, 512GB SSD", stock: 25 },
    { name: "iPhone 15 Pro", sku: "IPH-15-PRO", price: 999.99, category: "Electronics", description: "A17 Pro chip, 256GB, Titanium", stock: 50 },
    { name: "Sony WH-1000XM5", sku: "SNY-WH-XM5", price: 349.99, category: "Audio", description: "Industry-leading noise cancellation headphones", stock: 30 },
    { name: "Samsung 4K Monitor 27\"", sku: "SAM-MON-27", price: 599.99, category: "Electronics", description: "4K UHD, 144Hz, HDR600", stock: 15 },
    { name: "Logitech MX Master 3S", sku: "LOG-MX-3S", price: 99.99, category: "Accessories", description: "Advanced wireless mouse, 8K DPI", stock: 60 },
    { name: "Mechanical Keyboard K8", sku: "KEY-MECH-K8", price: 129.99, category: "Accessories", description: "TKL layout, Cherry MX Red switches", stock: 40 },
    { name: "iPad Air 5th Gen", sku: "IPD-AIR-5", price: 749.99, category: "Electronics", description: "M1 chip, 10.9-inch, 256GB WiFi", stock: 20 },
    { name: "USB-C Hub 7-in-1", sku: "HUB-7IN1-UC", price: 49.99, category: "Accessories", description: "4K HDMI, 100W PD, 3x USB-A, SD card", stock: 80 },
    { name: "Ergonomic Office Chair", sku: "CHR-ERG-PRO", price: 449.99, category: "Furniture", description: "Lumbar support, adjustable armrests, mesh back", stock: 10 },
    { name: "Standing Desk 60\"", sku: "DSK-STAND-60", price: 699.99, category: "Furniture", description: "Electric height adjustment, 60x30 inch surface", stock: 8 },
    { name: "Webcam 4K Pro", sku: "CAM-4K-PRO", price: 199.99, category: "Electronics", description: "4K 30fps, auto-focus, built-in mic", stock: 35 },
    { name: "NVMe SSD 1TB", sku: "SSD-NVME-1T", price: 89.99, category: "Storage", description: "PCIe 4.0, 7000MB/s read speed", stock: 100 },
  ];

  const warehouse = await prisma.warehouse.findFirst({ orderBy: { createdAt: "asc" } });
  if (!warehouse) return res.status(400).json({ error: "Create a warehouse first before seeding products" });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const demo of demoProducts) {
    const existing = await prisma.product.findUnique({ where: { sku: demo.sku } });
    if (existing) { skipped.push(demo.sku); continue; }

    const product = await prisma.product.create({
      data: { name: demo.name, sku: demo.sku, price: demo.price, category: demo.category, description: demo.description },
    });
    await prisma.stock.create({
      data: { productId: product.id, warehouseId: warehouse.id, quantity: demo.stock },
    });
    try { await publishEvent("product.created", { product }); } catch {}
    created.push(demo.name);
  }

  return res.json({ message: `Seeded ${created.length} products`, created, skipped });
});

export default router;

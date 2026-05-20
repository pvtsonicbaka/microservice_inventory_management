import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

const warehouseSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
});

// GET /warehouses
router.get("/", authenticate, async (_req: Request, res: Response) => {
  const warehouses = await prisma.warehouse.findMany({ orderBy: { name: "asc" } });
  return res.json(warehouses);
});

// POST /warehouses
router.post("/", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const parsed = warehouseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const warehouse = await prisma.warehouse.create({ data: parsed.data });
  return res.status(201).json(warehouse);
});

// DELETE /warehouses/:id
router.delete("/:id", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    await prisma.warehouse.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ error: "Warehouse not found" });
  }
});

export default router;

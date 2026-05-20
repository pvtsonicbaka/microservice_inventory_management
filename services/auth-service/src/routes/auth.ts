import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../lib/jwt";
import { blacklistToken, isBlacklisted } from "../lib/redis";

const router = Router();

function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = verifyAccessToken(authHeader.split(" ")[1]);
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, name, passwordHash } });

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub as string } });
    if (!user) return res.status(401).json({ error: "User not found" });

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

// POST /auth/logout — invalidates refresh token + blacklists access token in Redis
router.post("/logout", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  // Blacklist the access token so it can't be reused within its TTL
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(authHeader.split(" ")[1]);
      if (payload.jti && payload.exp) {
        await blacklistToken(payload.jti, payload.exp);
      }
    } catch {
      // Token already invalid — nothing to blacklist
    }
  }

  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  return res.status(204).send();
});

// GET /auth/validate — used by downstream services to validate Bearer tokens
router.get("/validate", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });

  try {
    const payload = verifyAccessToken(authHeader.split(" ")[1]);

    // Check Redis blacklist (tokens invalidated by logout)
    if (payload.jti) {
      const blacklisted = await isBlacklisted(payload.jti);
      if (blacklisted) return res.status(401).json({ error: "Token has been revoked" });
    }

    return res.json({ sub: payload.sub, email: payload.email, role: payload.role });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

// GET /auth/users — list all users (admin only)
router.get("/users", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json(users);
});

// PATCH /auth/users/:id/role
router.patch(
  "/users/:id/role",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const { role } = req.body;
    if (!["admin", "manager", "viewer"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    try {
      const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
      return res.json({ id: user.id, email: user.email, role: user.role });
    } catch (err: any) {
      if (err.code === "P2025") return res.status(404).json({ error: "User not found" });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

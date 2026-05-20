import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import axios from "axios";
import { authenticate } from "./middleware/auth";
import { correlationMiddleware, getCorrelationId, CORRELATION_HEADER } from "./middleware/correlation";
import { logger } from "./lib/logger";

// Validate required env vars at startup
if (!process.env.JWT_ACCESS_SECRET) {
  logger.error("FATAL: JWT_ACCESS_SECRET not set");
  process.exit(1);
}

const app = express();

// CORS
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",");
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", `Content-Type,Authorization,${CORRELATION_HEADER}`);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Correlation ID — must be before rate limiter and routes
app.use(correlationMiddleware);

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](`${req.method} ${req.path}`, {
      correlationId: getCorrelationId(req),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

// Rate limiting — global
const limiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { error: "Too many requests" } });
app.use(limiter);

// Stricter rate limiting for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many auth attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const AUTH_URL      = process.env.AUTH_SERVICE_URL      || "http://auth-service:3001";
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || "http://inventory-service:3002";
const ORDERS_URL    = process.env.ORDERS_SERVICE_URL    || "http://orders-service:3003";
const REPORTING_URL = process.env.REPORTING_SERVICE_URL || "http://reporting-service:3004";

async function proxy(target: string, req: Request, res: Response, overridePath?: string) {
  const correlationId = getCorrelationId(req);
  const url = overridePath
    ? `${target}${overridePath}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`
    : `${target}${req.originalUrl}`;
  try {
    const response = await axios({
      method: req.method as any,
      url,
      data: req.body,
      headers: {
        ...req.headers,
        host: undefined,
        [CORRELATION_HEADER]: correlationId,
      },
      timeout: 10000,
      validateStatus: () => true,
    });
    res.status(response.status).json(response.data);
  } catch (err: any) {
    if (err.code === "ECONNABORTED") {
      logger.warn("Gateway timeout", { correlationId, target });
      return res.status(504).json({ error: "Gateway timeout", correlationId });
    }
    if (err.code === "ECONNREFUSED") {
      logger.warn("Service unavailable", { correlationId, target });
      return res.status(503).json({ error: "Service unavailable", correlationId });
    }
    logger.error("Proxy error", { correlationId, target, error: err.message });
    res.status(502).json({ error: "Bad gateway", correlationId });
  }
}

app.get("/health", async (_req, res) => {
  const checks = await Promise.allSettled([
    axios.get(`${AUTH_URL}/health`,      { timeout: 3000 }),
    axios.get(`${INVENTORY_URL}/health`, { timeout: 3000 }),
    axios.get(`${ORDERS_URL}/health`,    { timeout: 3000 }),
    axios.get(`${REPORTING_URL}/health`, { timeout: 3000 }),
  ]);
  const [auth, inventory, orders, reporting] = checks.map((c) => c.status === "fulfilled" ? "up" : "down");
  return res.json({ status: "ok", services: { auth, inventory, orders, reporting } });
});

app.use("/auth",       express.json({ limit: "10kb" }), authLimiter, (req: Request, res: Response) => proxy(AUTH_URL,      req, res));
app.use("/products",   express.json({ limit: "10kb" }), authenticate, (req: Request, res: Response) => proxy(INVENTORY_URL, req, res));
app.use("/warehouses", express.json({ limit: "10kb" }), authenticate, (req: Request, res: Response) => proxy(INVENTORY_URL, req, res));
app.use("/stock",      express.json({ limit: "10kb" }), authenticate, (req: Request, res: Response) => proxy(INVENTORY_URL, req, res));
app.use("/orders",     express.json({ limit: "10kb" }), authenticate, (req: Request, res: Response) => proxy(ORDERS_URL,    req, res));
app.use("/search",     express.json({ limit: "10kb" }), authenticate, (req: Request, res: Response) => proxy(REPORTING_URL, req, res));
app.use("/reports",    express.json({ limit: "10kb" }), authenticate, (req: Request, res: Response) => proxy(REPORTING_URL, req, res));

// /reporting/* strips the /reporting prefix before forwarding
// e.g. GET /reporting/search/products → GET /search/products on reporting-service
// e.g. GET /reporting/reports/dashboard → GET /reports/dashboard on reporting-service
app.use("/reporting", express.json({ limit: "10kb" }), authenticate, (req: Request, res: Response) => {
  // req.url is relative to the mount point, so for /reporting/search/products it's /search/products
  return proxy(REPORTING_URL, req, res, req.url);
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => logger.info(`api-gateway running on port ${PORT}`));

const shutdown = () => {
  logger.info("api-gateway shutting down...");
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

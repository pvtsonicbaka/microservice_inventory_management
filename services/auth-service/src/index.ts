import express from "express";
import authRouter from "./routes/auth";
import { correlationMiddleware, getCorrelationId } from "./middleware/correlation";
import { logger } from "./lib/logger";
import { connectRedis } from "./lib/redis";

const app = express();
app.use(express.json({ limit: "10kb" }));
app.use(correlationMiddleware);

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](`${req.method} ${req.path}`, {
      correlationId: getCorrelationId(req),
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "auth-service" }));
app.use("/auth", authRouter);

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => logger.info(`auth-service running on port ${PORT}`));

// Connect Redis (non-fatal — blacklist degrades gracefully)
connectRedis().catch(() => {});

const shutdown = () => {
  logger.info("auth-service shutting down...");
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

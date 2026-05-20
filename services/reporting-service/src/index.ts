import express from "express";
import searchRouter from "./routes/search";
import reportsRouter from "./routes/reports";
import { connectKafka, consumer } from "./lib/kafka";
import { ensureIndices } from "./lib/elastic";
import { authenticate } from "./middleware/auth";
import { correlationMiddleware, getCorrelationId } from "./middleware/correlation";
import { logger } from "./lib/logger";

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

app.get("/health", (_, res) => res.json({ status: "ok", service: "reporting-service" }));
app.use("/search",  authenticate, searchRouter);
app.use("/reports", authenticate, reportsRouter);

const PORT = process.env.PORT || 3004;

async function main() {
  try {
    await ensureIndices();
    logger.info("Elasticsearch indices ready");
  } catch {
    logger.warn("Elasticsearch not available — search will degrade gracefully");
  }

  try {
    await connectKafka();
    logger.info("Kafka connected");
  } catch {
    logger.warn("Kafka not available — event indexing disabled");
  }

  const server = app.listen(PORT, () => logger.info(`reporting-service running on port ${PORT}`));

  const shutdown = async () => {
    logger.info("reporting-service shutting down...");
    try { await consumer.disconnect(); } catch {}
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();

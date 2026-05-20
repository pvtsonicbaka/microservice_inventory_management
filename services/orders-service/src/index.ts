import express from "express";
import ordersRouter from "./routes/orders";
import { connectKafka, consumer, producer } from "./lib/kafka";
import { correlationMiddleware, getCorrelationId } from "./middleware/correlation";
import { logger } from "./lib/logger";
import { inventoryBreaker } from "./lib/circuit-breaker";

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

app.get("/health", (_, res) => res.json({
  status: "ok",
  service: "orders-service",
  circuitBreakers: { inventory: inventoryBreaker.getState() },
}));
app.use("/orders", ordersRouter);

const PORT = process.env.PORT || 3003;

async function main() {
  try {
    await connectKafka();
    logger.info("Kafka connected");
    const server = app.listen(PORT, () => logger.info(`orders-service running on port ${PORT}`));
    const shutdown = async () => {
      logger.info("orders-service shutting down...");
      await consumer.disconnect();
      await producer.disconnect();
      server.close(() => process.exit(0));
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    logger.error("Failed to start orders-service", { error: (err as Error).message });
    process.exit(1);
  }
}

main();

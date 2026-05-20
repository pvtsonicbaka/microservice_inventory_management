import { Kafka } from "kafkajs";
import prisma from "./prisma";
import { logger } from "./logger";

const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  retry: { retries: 10, initialRetryTime: 300, factor: 2 },
});

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: "inventory-service" });

const LOW_STOCK_THRESHOLD = 5;

export async function connectKafka() {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({
    topics: ["order.placed", "order.cancelled", "order.confirmed"],
    fromBeginning: false,
  });

  // Handle consumer crashes — restart on disconnect
  consumer.on("consumer.crash", (event) => {
    console.error(
      JSON.stringify({
        level: "error",
        service: "inventory-service",
        msg: "Kafka consumer crashed",
        error: event.payload.error?.message,
      })
    );
    process.exit(1); // let Docker restart the container
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const event = JSON.parse(message.value?.toString() || "{}");
        const payload = event.payload ?? event;
        const correlationId =
          event.correlationId ||
          message.headers?.["x-correlation-id"]?.toString() ||
          "unknown";

        logger.info(`Processing Kafka event: ${topic}`, {
          correlationId,
          topic,
          eventId: event.eventId,
        });

        if (topic === "order.placed") await handleOrderPlaced(payload, correlationId);
        if (topic === "order.confirmed") await handleOrderConfirmed(payload, correlationId);
        if (topic === "order.cancelled" && payload.reason !== "insufficient_stock") {
          await handleOrderCancelled(payload, correlationId);
        }
      } catch (err) {
        logger.error("Kafka consumer error", {
          service: "inventory-service",
          topic,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });
}

async function handleOrderPlaced(
  payload: { orderId: string; items: { productId: string; quantity: number }[] },
  correlationId: string
) {
  try {
    await prisma.$transaction(async (tx) => {
      for (const item of payload.items) {
        // Find the stock record with the most available (unreserved) quantity
        const stock = await tx.stock.findFirst({
          where: { productId: item.productId },
          orderBy: { quantity: "desc" },
        });

        if (!stock || stock.quantity - stock.reserved < item.quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        await tx.stock.update({
          where: { id: stock.id },
          data: { reserved: { increment: item.quantity } },
        });

        // FIX: use post-reservation available value (stock.reserved is pre-update here)
        const newAvailable = stock.quantity - stock.reserved - item.quantity;

        if (newAvailable <= LOW_STOCK_THRESHOLD) {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const existingAlert = await tx.stockAlert.findFirst({
            where: { productId: item.productId, triggeredAt: { gte: oneHourAgo } },
          });
          if (!existingAlert) {
            await tx.stockAlert.create({
              data: {
                productId: item.productId,
                threshold: LOW_STOCK_THRESHOLD,
                currentStock: newAvailable,
              },
            });
            // Look up product name for the event payload
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: { name: true },
            });
            // FIX: publish stock.low-alert event so reporting-service indexes it
            try {
              await publishEvent(
                "stock.low-alert",
                {
                  productId: item.productId,
                  productName: product?.name ?? "Unknown",
                  threshold: LOW_STOCK_THRESHOLD,
                  currentStock: newAvailable,
                },
                correlationId
              );
            } catch {
              /* non-critical — alert already saved to DB */
            }
          }
        }
      }
    });

    await publishEvent(
      "stock.updated",
      { orderId: payload.orderId, status: "SUCCESS" },
      correlationId
    );
    logger.info("Stock reserved for order", { correlationId, orderId: payload.orderId });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    logger.warn("Stock reservation failed", { correlationId, orderId: payload.orderId, reason });
    await publishEvent(
      "order.cancelled",
      {
        orderId: payload.orderId,
        reason: "insufficient_stock",
        items: payload.items,
      },
      correlationId
    );
  }
}

async function handleOrderConfirmed(
  payload: { orderId: string; items: { productId: string; quantity: number }[] },
  correlationId: string
) {
  // FIX: wrap in transaction for atomicity
  await prisma.$transaction(async (tx) => {
    for (const item of payload.items) {
      // FIX: find the stock record that actually has the reservation (not arbitrary)
      const stock = await tx.stock.findFirst({
        where: { productId: item.productId, reserved: { gte: item.quantity } },
        orderBy: { reserved: "desc" },
      });
      if (stock) {
        await tx.stock.update({
          where: { id: stock.id },
          data: {
            quantity: { decrement: item.quantity },
            reserved: { decrement: Math.min(item.quantity, stock.reserved) },
          },
        });
      }
    }
  });
  logger.info("Stock deducted for confirmed order", { correlationId, orderId: payload.orderId });
}

async function handleOrderCancelled(
  payload: { orderId: string; items: { productId: string; quantity: number }[] },
  correlationId: string
) {
  // FIX: wrap in transaction for atomicity
  await prisma.$transaction(async (tx) => {
    for (const item of payload.items) {
      const stock = await tx.stock.findFirst({
        where: { productId: item.productId, reserved: { gte: item.quantity } },
        orderBy: { reserved: "desc" },
      });
      if (stock) {
        await tx.stock.update({
          where: { id: stock.id },
          data: { reserved: { decrement: Math.min(item.quantity, stock.reserved) } },
        });
      }
    }
  });
  logger.info("Stock reservation released for cancelled order", {
    correlationId,
    orderId: payload.orderId,
  });
}

export async function publishEvent(
  topic: string,
  payload: object,
  correlationId?: string
) {
  await producer.send({
    topic,
    messages: [
      {
        headers: correlationId ? { "x-correlation-id": correlationId } : {},
        value: JSON.stringify({
          eventId: crypto.randomUUID(),
          eventType: topic,
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: correlationId ?? "unknown",
          payload,
        }),
      },
    ],
  });
}

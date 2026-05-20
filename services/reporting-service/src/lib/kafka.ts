import { Kafka } from "kafkajs";
import { es, ORDERS_INDEX, PRODUCTS_INDEX, ALERTS_INDEX } from "./elastic";
import { logger } from "./logger";

const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  retry: { retries: 10, initialRetryTime: 300, factor: 2 },
});

export const consumer = kafka.consumer({ groupId: "reporting-service" });

export async function connectKafka() {
  await consumer.connect();
  await consumer.subscribe({
    topics: [
      "order.confirmed",
      "order.cancelled",
      "order.placed",
      "stock.updated",
      "stock.low-alert",
      "product.created",
      "product.updated",
      "product.deleted",
    ],
    fromBeginning: false,
  });

  // Handle consumer crashes
  consumer.on("consumer.crash", (event) => {
    logger.error("Kafka consumer crashed", { error: event.payload.error?.message });
    process.exit(1);
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const event = JSON.parse(message.value?.toString() || "{}");
        const payload = event.payload ?? event;
        const correlationId = event.correlationId ?? "unknown";

        logger.info(`Kafka event received: ${topic}`, { correlationId, topic, eventId: event.eventId });

        // ── Orders ──────────────────────────────────────────────
        if (topic === "order.placed") {
          // Index order as PENDING immediately so it appears in analytics
          await es.index({
            index: ORDERS_INDEX,
            id: payload.orderId,
            document: {
              id:        payload.orderId,
              userId:    payload.userId ?? "unknown",
              status:    "PENDING",
              total:     payload.total ?? 0,
              itemCount: payload.items?.length ?? 0,
              createdAt: event.timestamp ?? new Date().toISOString(),
            },
          });
        }

        if (topic === "order.confirmed") {
          await es.index({
            index: ORDERS_INDEX,
            id: payload.orderId,
            document: {
              id:        payload.orderId,
              userId:    payload.userId    ?? "unknown",
              status:    "CONFIRMED",
              total:     payload.total     ?? 0,
              itemCount: payload.items?.length ?? 0,
              createdAt: payload.confirmedAt ?? event.timestamp ?? new Date().toISOString(),
            },
          });
        }

        if (topic === "order.cancelled") {
          try {
            await es.update({
              index: ORDERS_INDEX,
              id: payload.orderId,
              doc: { status: "CANCELLED" },
            });
          } catch {
            // doc may not exist yet if order.placed was missed — index it
            await es.index({
              index: ORDERS_INDEX,
              id: payload.orderId,
              document: {
                id:        payload.orderId,
                userId:    payload.userId ?? "unknown",
                status:    "CANCELLED",
                total:     0,
                itemCount: payload.items?.length ?? 0,
                createdAt: event.timestamp ?? new Date().toISOString(),
              },
            });
          }
        }

        // ── Products ─────────────────────────────────────────────
        if (topic === "product.created" || topic === "product.updated") {
          const p = payload.product ?? payload;
          await es.index({
            index: PRODUCTS_INDEX,
            id: p.id,
            document: {
              id:          p.id,
              name:        p.name,
              sku:         p.sku,
              description: p.description ?? "",
              price:       Number(p.price),
              category:    p.category ?? "Uncategorized",
              createdAt:   p.createdAt ?? event.timestamp ?? new Date().toISOString(),
            },
          });
        }

        if (topic === "product.deleted") {
          try {
            await es.delete({ index: PRODUCTS_INDEX, id: payload.productId ?? payload.id });
          } catch { /* already gone */ }
        }

        // ── Stock alerts ─────────────────────────────────────────
        if (topic === "stock.low-alert") {
          logger.warn("Low stock alert received", { ...payload });
          await es.index({
            index: ALERTS_INDEX,
            document: {
              productId:   payload.productId,
              productName: payload.productName ?? "Unknown",
              currentStock: payload.currentStock ?? 0,
              threshold:   payload.threshold ?? 5,
              triggeredAt: event.timestamp ?? new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        logger.error("Kafka consumer error", {
          topic,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });
}

import { Kafka } from "kafkajs";
import prisma from "./prisma";
import { logger } from "./logger";

const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  retry: { retries: 10, initialRetryTime: 300, factor: 2 },
});

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: "orders-service" });

export async function connectKafka() {
  await producer.connect();
  await consumer.connect();

  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: [
      { topic: "order.placed",    numPartitions: 1 },
      { topic: "stock.updated",   numPartitions: 1 },
      { topic: "order.confirmed", numPartitions: 1 },
      { topic: "order.cancelled", numPartitions: 1 },
      { topic: "stock.low-alert", numPartitions: 1 },
    ],
  });
  await admin.disconnect();

  await consumer.subscribe({ topics: ["stock.updated", "order.cancelled"], fromBeginning: false });

  // Handle consumer crashes
  consumer.on("consumer.crash", (event) => {
    console.error(JSON.stringify({ level: "error", service: "orders-service", msg: "Kafka consumer crashed", error: event.payload.error?.message }));
    process.exit(1);
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const event = JSON.parse(message.value?.toString() || "{}");
        const payload = event.payload ?? event;
        const correlationId = event.correlationId || (message.headers?.["x-correlation-id"]?.toString()) || "unknown";

        logger.info(`Processing Kafka event: ${topic}`, { correlationId, topic, eventId: event.eventId });

        if (topic === "stock.updated") {
          await prisma.order.update({ where: { id: payload.orderId }, data: { status: "CONFIRMED" } });
          await prisma.sagaLog.create({
            data: { orderId: payload.orderId, step: "stock.updated", status: "SUCCESS", payload },
          });
          // FIX: fetch the full order so we can include userId, total, and items
          // in the order.confirmed event — downstream services (inventory, reporting) need them
          const order = await prisma.order.findUnique({
            where: { id: payload.orderId },
            include: { items: true },
          });
          await publishEvent("order.confirmed", {
            orderId: payload.orderId,
            userId: order?.userId ?? "unknown",
            total: Number(order?.total ?? 0),
            confirmedAt: new Date().toISOString(),
            items: order?.items.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: i.quantity })) ?? [],
          }, correlationId);
          logger.info("Order confirmed", { correlationId, orderId: payload.orderId });
        }

        if (topic === "order.cancelled") {
          await prisma.order.update({ where: { id: payload.orderId }, data: { status: "FAILED" } });
          await prisma.sagaLog.create({
            data: { orderId: payload.orderId, step: "order.cancelled", status: "FAILED", payload },
          });
          logger.warn("Order failed via saga", { correlationId, orderId: payload.orderId, reason: payload.reason });
        }
      } catch (err) {
        logger.error("Kafka consumer error", {
          service: "orders-service",
          topic,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });
}

export async function publishEvent(topic: string, payload: object, correlationId?: string) {
  await producer.send({
    topic,
    messages: [{
      headers: correlationId ? { "x-correlation-id": correlationId } : {},
      value: JSON.stringify({
        eventId: crypto.randomUUID(),
        eventType: topic,
        timestamp: new Date().toISOString(),
        version: "1.0",
        correlationId: correlationId ?? "unknown",
        payload,
      }),
    }],
  });
}

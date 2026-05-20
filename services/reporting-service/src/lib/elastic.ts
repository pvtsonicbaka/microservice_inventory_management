import { Client } from "@elastic/elasticsearch";
import { logger } from "./logger";

export const es = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://elasticsearch:9200",
});

export const PRODUCTS_INDEX = "products";
export const ORDERS_INDEX   = "orders";
export const ALERTS_INDEX   = "stock_alerts";

async function createIndex(index: string, mappings: object) {
  const exists = await es.indices.exists({ index });
  if (!exists) {
    await es.indices.create({ index, mappings });
    logger.info(`Created ES index: ${index}`);
  }
}

export async function ensureIndices() {
  await createIndex(PRODUCTS_INDEX, {
    properties: {
      id:          { type: "keyword" },
      name:        { type: "text", fields: { keyword: { type: "keyword" } } },
      sku:         { type: "keyword" },
      description: { type: "text" },
      price:       { type: "float" },
      category:    { type: "keyword" },
      createdAt:   { type: "date" },
    },
  });

  await createIndex(ORDERS_INDEX, {
    properties: {
      id:        { type: "keyword" },
      userId:    { type: "keyword" },
      status:    { type: "keyword" },
      total:     { type: "float" },
      itemCount: { type: "integer" },
      createdAt: { type: "date" },
    },
  });

  await createIndex(ALERTS_INDEX, {
    properties: {
      productId:    { type: "keyword" },
      productName:  { type: "text", fields: { keyword: { type: "keyword" } } },
      currentStock: { type: "integer" },
      threshold:    { type: "integer" },
      triggeredAt:  { type: "date" },
    },
  });
}

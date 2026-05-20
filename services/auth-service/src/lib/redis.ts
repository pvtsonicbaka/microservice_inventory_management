import { createClient } from "redis";
import { logger } from "./logger";

const client = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

client.on("error", (err) => {
  logger.warn("Redis client error — token blacklist degraded", { error: err.message });
});

let connected = false;

export async function connectRedis() {
  try {
    await client.connect();
    connected = true;
    logger.info("Redis connected");
  } catch (err: any) {
    logger.warn("Redis unavailable — JWT blacklist disabled", { error: err.message });
  }
}

/** Add a token JTI to the blacklist with a TTL matching the token's remaining lifetime */
export async function blacklistToken(jti: string, expiresAt: number): Promise<void> {
  if (!connected) return;
  const ttlSeconds = Math.max(1, expiresAt - Math.floor(Date.now() / 1000));
  await client.set(`blacklist:${jti}`, "1", { EX: ttlSeconds });
}

/** Returns true if the token JTI is blacklisted */
export async function isBlacklisted(jti: string): Promise<boolean> {
  if (!connected) return false;
  const val = await client.get(`blacklist:${jti}`);
  return val !== null;
}

export default client;

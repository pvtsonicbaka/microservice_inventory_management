/**
 * Shared structured logger — lightweight Pino-style JSON logger
 * Works in all services without adding a dependency.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
};

const SERVICE = "reporting-service";
type Level = "info" | "warn" | "error" | "debug";
export function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry = { timestamp: new Date().toISOString(), level, service: SERVICE, msg, ...meta };
  level === "error" ? console.error(JSON.stringify(entry)) : console.log(JSON.stringify(entry));
}
export const logger = {
  info:  (msg: string, meta?: Record<string, unknown>) => log("info",  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log("warn",  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
};

import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";
import { getCorrelationId } from "./correlation";

/**
 * Middleware: logs every incoming request and its response status + duration.
 */
export function requestLogger(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      logger[level](`${req.method} ${req.path}`, {
        service: serviceName,
        correlationId: getCorrelationId(req),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
      });
    });
    next();
  };
}

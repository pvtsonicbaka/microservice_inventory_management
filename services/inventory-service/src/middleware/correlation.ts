import { Request, Response, NextFunction } from "express";

export const CORRELATION_HEADER = "x-correlation-id";

export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers[CORRELATION_HEADER] as string) || crypto.randomUUID();
  (req as any).correlationId = id;
  res.setHeader(CORRELATION_HEADER, id);
  next();
}

export function getCorrelationId(req: Request): string {
  return (req as any).correlationId || "unknown";
}

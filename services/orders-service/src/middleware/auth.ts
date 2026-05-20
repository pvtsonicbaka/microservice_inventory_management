import { Request, Response, NextFunction } from "express";
import axios from "axios";
import { CORRELATION_HEADER } from "./correlation";

export interface AuthUser { sub: string; email: string; role: string; }

declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { data } = await axios.get(`${process.env.AUTH_SERVICE_URL || "http://auth-service:3001"}/auth/validate`, {
      headers: {
        authorization: authHeader,
        [CORRELATION_HEADER]: req.headers[CORRELATION_HEADER] || "",
      },
      timeout: 5000,
    });
    req.user = data;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

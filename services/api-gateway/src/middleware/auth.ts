import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  sub: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(authHeader.split(" ")[1], process.env.JWT_ACCESS_SECRET!) as jwt.JwtPayload;
    req.user = { sub: payload.sub as string, email: payload.email, role: payload.role };
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

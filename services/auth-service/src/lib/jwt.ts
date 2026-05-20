import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export function signAccessToken(payload: { sub: string; email: string; role: string }) {
  return jwt.sign({ ...payload, jti: uuidv4() }, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId, jti: uuidv4() }, REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, ACCESS_SECRET) as jwt.JwtPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET) as jwt.JwtPayload;
}

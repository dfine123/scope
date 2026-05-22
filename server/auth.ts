import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { Config } from "./config";

const COOKIE_NAME = "scope_session";
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// Config is injected at startup so auth functions can read the live config
// (e.g. passcode updated from the settings panel without restarting).
let _config: Config;

export function initAuth(config: Config) {
  _config = config;
}

function sign(payload: string): string {
  return createHmac("sha256", _config.getAuthSecret())
    .update(payload)
    .digest("hex");
}

function verifyToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, nonce, sig] = parts;
  if (version !== "v1") return false;
  const expected = sign(`${version}.${nonce}`);
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function mintToken(): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `v1.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function attachSessionCookie(res: Response) {
  const token = mintToken();
  const secure = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function isAuthed(req: Request): boolean {
  if (_config.isFirstRun()) return false; // gate everything until setup
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const token = cookies?.[COOKIE_NAME];
  if (!token) return false;
  return verifyToken(token);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: "unauthorized" });
}

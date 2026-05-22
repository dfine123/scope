import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE_NAME = "scope_session";
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  let secret = process.env.SCOPE_AUTH_SECRET;
  if (!secret) {
    // Derive a stable secret from passcode + a process-static salt fallback,
    // so deploys without an explicit SCOPE_AUTH_SECRET still produce
    // verifiable signatures (sessions just invalidate when the passcode
    // changes — acceptable).
    const passcode = process.env.SCOPE_PASSCODE || "";
    secret = "scope:" + passcode + ":fallback-secret";
  }
  return secret;
}

function passcodeRequired(): string {
  const p = process.env.SCOPE_PASSCODE;
  if (!p) {
    // No passcode set at all — treat as open mode. This is dev-friendly
    // but we surface a console warning at boot.
    return "";
  }
  return p;
}

export function isOpenMode(): boolean {
  return !process.env.SCOPE_PASSCODE;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
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
  if (isOpenMode()) return true;
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const token = cookies?.[COOKIE_NAME];
  if (!token) return false;
  return verifyToken(token);
}

export function login(submittedPasscode: string): boolean {
  if (isOpenMode()) return true;
  const expected = passcodeRequired();
  if (!expected) return false;
  const a = Buffer.from(submittedPasscode);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: "unauthorized" });
}

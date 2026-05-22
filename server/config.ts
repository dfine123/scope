import { createHmac, randomBytes } from "node:crypto";
import type { Database } from "./db";

export class Config {
  constructor(private db: Database) {}

  getPasscode(): string | null {
    if (process.env.SCOPE_PASSCODE) return process.env.SCOPE_PASSCODE;
    return this.db.getSetting("passcode");
  }

  getApiKey(): string | null {
    if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
    return this.db.getSetting("api_key");
  }

  getAuthSecret(): string {
    if (process.env.SCOPE_AUTH_SECRET) return process.env.SCOPE_AUTH_SECRET;
    let secret = this.db.getSetting("auth_secret");
    if (!secret) {
      secret = randomBytes(32).toString("hex");
      this.db.setSetting("auth_secret", secret);
    }
    return secret;
  }

  isFirstRun(): boolean {
    return !this.getPasscode();
  }

  setPasscode(raw: string): void {
    // Store a salted HMAC so the raw passcode isn't sitting in plaintext.
    const salt = randomBytes(8).toString("hex");
    const hash = createHmac("sha256", this.getAuthSecret())
      .update(salt + ":" + raw)
      .digest("hex");
    this.db.setSetting("passcode", `v1:${salt}:${hash}`);
  }

  verifyPasscode(submitted: string): boolean {
    if (process.env.SCOPE_PASSCODE) {
      return submitted === process.env.SCOPE_PASSCODE;
    }
    const stored = this.db.getSetting("passcode");
    if (!stored) return false;
    if (!stored.startsWith("v1:")) {
      // Legacy plaintext (migration from env-only days)
      return submitted === stored;
    }
    const [, salt, hash] = stored.split(":");
    const expected = createHmac("sha256", this.getAuthSecret())
      .update(salt + ":" + submitted)
      .digest("hex");
    return expected === hash;
  }

  setApiKey(key: string): void {
    this.db.setSetting("api_key", key);
  }

  // Masked version safe to send to the browser (last 4 chars visible).
  maskedApiKey(): string | null {
    const key = this.getApiKey();
    if (!key) return null;
    return key.slice(0, 8).replace(/./g, "•") + "…" + key.slice(-4);
  }
}

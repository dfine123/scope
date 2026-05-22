import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import * as path from "node:path";
import * as fs from "node:fs";
import { Database } from "./db";
import { ClaudeService } from "./claude";
import { buildRouter } from "./routes";
import { isOpenMode } from "./auth";

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.SCOPE_DB_PATH || path.resolve(process.cwd(), "data/scope.db");
const STATIC_DIR =
  process.env.SCOPE_STATIC_DIR || path.resolve(process.cwd(), "dist");

const db = new Database(DB_PATH);
const claude = new ClaudeService(db);

const app = express();
// Body size large enough for base64 schedule photos (~8MB).
app.use(express.json({ limit: "12mb" }));
app.use(cookieParser());

if (isOpenMode()) {
  console.warn(
    "[scope] SCOPE_PASSCODE not set — server is running in OPEN mode. " +
      "Anyone with the URL can use it. Set SCOPE_PASSCODE on Railway before sharing.",
  );
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "[scope] ANTHROPIC_API_KEY not set — AI features (schedule parsing, debrief, motto color) will be disabled.",
  );
}

app.use("/api", buildRouter(db, claude));

// Health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Static renderer + SPA fallback
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, { maxAge: "1h", index: false }));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res
      .status(503)
      .send(
        "Renderer not built. Run `npm run build` first. (Looking in: " +
          STATIC_DIR +
          ")",
      );
  });
}

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[scope] listening on :${PORT} · db=${DB_PATH}`);
});

function shutdown() {
  console.log("[scope] shutting down");
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

import { Router } from "express";
import type { Database } from "./db";
import type { ClaudeService } from "./claude";
import type { Config } from "./config";
import {
  attachSessionCookie,
  clearSessionCookie,
  isAuthed,
  requireAuth,
} from "./auth";

export function buildRouter(db: Database, claude: ClaudeService, config: Config) {
  const r = Router();

  // ---------- Status (public) ----------
  r.get("/status", (req, res) => {
    res.json({
      firstRun: config.isFirstRun(),
      authed: isAuthed(req),
      hasApiKey: claude.hasKey(),
    });
  });

  // Alias for backwards compat with existing frontend /api/me calls.
  r.get("/me", (req, res) => {
    res.json({
      firstRun: config.isFirstRun(),
      authed: isAuthed(req),
      openMode: false,
      hasApiKey: claude.hasKey(),
    });
  });

  // ---------- First-run setup (public, but only works once) ----------
  r.post("/setup", (req, res) => {
    if (!config.isFirstRun()) {
      return res.status(409).json({ error: "already configured" });
    }
    const passcode = String(req.body?.passcode ?? "").trim();
    if (!/^\d{4}$/.test(passcode)) {
      return res.status(400).json({ error: "passcode must be exactly 4 digits" });
    }
    config.setPasscode(passcode);

    const apiKey = String(req.body?.apiKey ?? "").trim();
    if (apiKey) config.setApiKey(apiKey);

    attachSessionCookie(res);
    res.json({ ok: true });
  });

  // ---------- Auth ----------
  r.post("/auth/login", (req, res) => {
    if (config.isFirstRun()) {
      return res.status(400).json({ error: "setup required" });
    }
    const passcode = String(req.body?.passcode ?? "");
    if (!config.verifyPasscode(passcode)) {
      return res.status(401).json({ error: "bad passcode" });
    }
    attachSessionCookie(res);
    res.json({ ok: true });
  });

  r.post("/auth/logout", (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // ---------- Gated routes ----------
  const gated = Router();
  gated.use(requireAuth);

  // Settings
  gated.get("/settings", (_req, res) => {
    res.json({
      maskedApiKey: config.maskedApiKey(),
      hasApiKey: claude.hasKey(),
      model: process.env.SCOPE_CLAUDE_MODEL || "claude-sonnet-4-20250514",
    });
  });

  gated.post("/settings", (req, res) => {
    const { apiKey, passcode } = req.body ?? {};
    if (typeof apiKey === "string" && apiKey.trim()) {
      config.setApiKey(apiKey.trim());
    }
    if (typeof passcode === "string" && /^\d{4}$/.test(passcode.trim())) {
      config.setPasscode(passcode.trim());
    }
    res.json({
      ok: true,
      maskedApiKey: config.maskedApiKey(),
      hasApiKey: claude.hasKey(),
    });
  });

  // Day / task routes
  gated.get("/day/current", (_req, res) => res.json(db.getCurrentDay()));
  gated.get("/days", (_req, res) => res.json(db.listDays()));
  gated.get("/day/:id", (req, res) => {
    const d = db.getDay(req.params.id);
    if (!d) return res.status(404).json({ error: "not found" });
    res.json(d);
  });
  gated.post("/day", (req, res) => res.json(db.createDay(req.body ?? {})));
  gated.patch("/day/:id", (req, res) =>
    res.json(db.updateDay(req.params.id, req.body ?? {})),
  );

  gated.post("/day/:dayId/task", (req, res) =>
    res.json(db.addTask(req.params.dayId, req.body)),
  );
  gated.patch("/task/:id", (req, res) =>
    res.json(db.updateTask(req.params.id, req.body ?? {})),
  );
  gated.delete("/task/:id", (req, res) => res.json(db.deleteTask(req.params.id)));
  gated.post("/day/:dayId/task/reorder", (req, res) =>
    res.json(db.reorderTasks(req.params.dayId, req.body?.orderedIds ?? [])),
  );

  gated.post("/day/:dayId/reflection", (req, res) =>
    res.json(db.saveReflection(req.params.dayId, req.body?.entries ?? [])),
  );
  gated.post("/day/:dayId/debrief", (req, res) =>
    res.json(db.saveDebrief(req.params.dayId, req.body)),
  );

  gated.get("/streaks", (_req, res) => res.json(db.getStreaks()));
  gated.get("/export", (_req, res) => res.json(db.exportAll()));

  // AI routes
  gated.post("/ai/schedule", async (req, res) => {
    try {
      const image = String(req.body?.image ?? "");
      if (!image) return res.status(400).json({ error: "missing image" });
      res.json(await claude.parseSchedule(image));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "parse failed" });
    }
  });
  gated.post("/ai/debrief/:dayId", async (req, res) => {
    try {
      res.json(await claude.generateDebrief(req.params.dayId));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "debrief failed" });
    }
  });
  gated.post("/ai/think/:dayId", async (req, res) => {
    try {
      res.json(await claude.generateThinkAbout(req.params.dayId));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "think failed" });
    }
  });
  gated.post("/ai/reflect/:dayId", async (req, res) => {
    try {
      res.json(await claude.generateReflectionQuestions(req.params.dayId));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "reflect failed" });
    }
  });
  gated.post("/ai/motto", async (req, res) => {
    try {
      const motto = String(req.body?.motto ?? "");
      res.json(await claude.mottoAccent(motto));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "motto failed" });
    }
  });

  r.use(gated);
  return r;
}

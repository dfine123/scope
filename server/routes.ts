import { Router } from "express";
import type { Database } from "./db";
import type { ClaudeService } from "./claude";
import {
  attachSessionCookie,
  clearSessionCookie,
  isAuthed,
  isOpenMode,
  login,
  requireAuth,
} from "./auth";

export function buildRouter(db: Database, claude: ClaudeService) {
  const r = Router();

  // ---------- Auth ----------
  r.get("/me", (req, res) => {
    res.json({
      authed: isAuthed(req),
      openMode: isOpenMode(),
      hasApiKey: claude.hasKey(),
    });
  });

  r.post("/auth/login", (req, res) => {
    const passcode = String(req.body?.passcode ?? "");
    if (!login(passcode)) {
      return res.status(401).json({ error: "bad passcode" });
    }
    attachSessionCookie(res);
    res.json({ ok: true });
  });

  r.post("/auth/logout", (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // ---------- DB (gated) ----------
  const gated = Router();
  gated.use(requireAuth);

  gated.get("/day/current", (_req, res) => res.json(db.getCurrentDay()));
  gated.get("/days", (_req, res) => res.json(db.listDays()));
  gated.get("/day/:id", (req, res) => {
    const d = db.getDay(req.params.id);
    if (!d) return res.status(404).json({ error: "not found" });
    res.json(d);
  });
  gated.post("/day", (req, res) => res.json(db.createDay(req.body ?? {})));
  gated.patch("/day/:id", (req, res) => res.json(db.updateDay(req.params.id, req.body ?? {})));

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

  // ---------- AI (gated) ----------
  gated.post("/ai/schedule", async (req, res) => {
    try {
      const image = String(req.body?.image ?? "");
      if (!image) return res.status(400).json({ error: "missing image" });
      const tasks = await claude.parseSchedule(image);
      res.json(tasks);
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

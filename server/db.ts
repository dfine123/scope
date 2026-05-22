import BetterSqlite3 from "better-sqlite3";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export type Tier = "CRITICAL" | "HIGH" | "STANDARD" | "LOW";
export type TaskStatus = "QUEUED" | "ACTIVE" | "DONE" | "SKIPPED";

export interface TaskRecord {
  id: string;
  day_id: string;
  name: string;
  tier: Tier;
  base_points: number;
  time_block: string | null;
  status: TaskStatus;
  elapsed_ms: number;
  started_at: string | null;
  completed_at: string | null;
  streak_count: number;
  streak_multiplier: number;
  awarded_points: number;
  position: number;
  notes: string | null;
  created_at: string;
}

export interface DayRecord {
  id: string;
  day_number: number;
  date: string;
  motto: string | null;
  accent_rgb: string | null;
  accent_label: string | null;
  total_points: number;
  status: "OPEN" | "CLOSED";
  created_at: string;
  closed_at: string | null;
}

export interface DebriefRecord {
  signal: string;
  blind_spots: string;
  connections: string;
}

const TIER_POINTS: Record<Tier, number> = {
  CRITICAL: 200,
  HIGH: 120,
  STANDARD: 60,
  LOW: 30,
};

export class Database {
  private db: BetterSqlite3.Database;

  constructor(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new BetterSqlite3(filePath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS days (
        id TEXT PRIMARY KEY,
        day_number INTEGER NOT NULL,
        date TEXT NOT NULL UNIQUE,
        motto TEXT,
        accent_rgb TEXT,
        accent_label TEXT,
        total_points INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'OPEN',
        created_at TEXT NOT NULL,
        closed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        day_id TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        tier TEXT NOT NULL,
        base_points INTEGER NOT NULL,
        time_block TEXT,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        elapsed_ms INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        completed_at TEXT,
        streak_count INTEGER NOT NULL DEFAULT 1,
        streak_multiplier REAL NOT NULL DEFAULT 1.0,
        awarded_points INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reflections (
        id TEXT PRIMARY KEY,
        day_id TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'reflect',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS debriefs (
        day_id TEXT PRIMARY KEY REFERENCES days(id) ON DELETE CASCADE,
        signal TEXT NOT NULL,
        blind_spots TEXT NOT NULL,
        connections TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_day ON tasks(day_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_name ON tasks(name);
      CREATE INDEX IF NOT EXISTS idx_reflections_day ON reflections(day_id);
    `);
  }

  private todayDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  getCurrentDay(): { day: DayRecord; tasks: TaskRecord[] } {
    const today = this.todayDate();
    let day = this.db
      .prepare("SELECT * FROM days WHERE date = ?")
      .get(today) as DayRecord | undefined;

    if (!day) {
      const last = this.db
        .prepare("SELECT * FROM days ORDER BY day_number DESC LIMIT 1")
        .get() as DayRecord | undefined;
      const nextNum = (last?.day_number ?? 0) + 1;
      const inheritedMotto = last?.motto ?? null;
      const inheritedAccent = last?.accent_rgb ?? null;
      const inheritedLabel = last?.accent_label ?? null;
      const id = randomUUID();
      this.db
        .prepare(
          `INSERT INTO days (id, day_number, date, motto, accent_rgb, accent_label, total_points, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 'OPEN', ?)`,
        )
        .run(
          id,
          nextNum,
          today,
          inheritedMotto,
          inheritedAccent,
          inheritedLabel,
          this.nowIso(),
        );
      day = this.db.prepare("SELECT * FROM days WHERE id = ?").get(id) as DayRecord;
    }

    const tasks = this.db
      .prepare(
        "SELECT * FROM tasks WHERE day_id = ? ORDER BY position ASC, created_at ASC",
      )
      .all(day.id) as TaskRecord[];

    return { day, tasks };
  }

  listDays(): DayRecord[] {
    return this.db
      .prepare("SELECT * FROM days ORDER BY day_number DESC")
      .all() as DayRecord[];
  }

  getDay(id: string) {
    const day = this.db.prepare("SELECT * FROM days WHERE id = ?").get(id) as
      | DayRecord
      | undefined;
    if (!day) return null;
    const tasks = this.db
      .prepare(
        "SELECT * FROM tasks WHERE day_id = ? ORDER BY position ASC",
      )
      .all(id) as TaskRecord[];
    const reflections = this.db
      .prepare("SELECT * FROM reflections WHERE day_id = ? ORDER BY created_at ASC")
      .all(id);
    const debrief = this.db
      .prepare("SELECT * FROM debriefs WHERE day_id = ?")
      .get(id);
    return { day, tasks, reflections, debrief };
  }

  createDay(payload: {
    date?: string;
    motto?: string | null;
    accent_rgb?: string | null;
    accent_label?: string | null;
  }): DayRecord {
    const date = payload.date ?? this.todayDate();
    const existing = this.db
      .prepare("SELECT * FROM days WHERE date = ?")
      .get(date) as DayRecord | undefined;
    if (existing) return existing;
    const last = this.db
      .prepare("SELECT * FROM days ORDER BY day_number DESC LIMIT 1")
      .get() as DayRecord | undefined;
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO days (id, day_number, date, motto, accent_rgb, accent_label, total_points, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'OPEN', ?)`,
      )
      .run(
        id,
        (last?.day_number ?? 0) + 1,
        date,
        payload.motto ?? null,
        payload.accent_rgb ?? null,
        payload.accent_label ?? null,
        this.nowIso(),
      );
    return this.db.prepare("SELECT * FROM days WHERE id = ?").get(id) as DayRecord;
  }

  updateDay(id: string, patch: Partial<DayRecord>): DayRecord {
    const fields = [
      "motto",
      "accent_rgb",
      "accent_label",
      "total_points",
      "status",
      "closed_at",
    ];
    const sets: string[] = [];
    const values: any[] = [];
    for (const f of fields) {
      if (f in patch) {
        sets.push(`${f} = ?`);
        values.push((patch as any)[f]);
      }
    }
    if (sets.length) {
      values.push(id);
      this.db.prepare(`UPDATE days SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    }
    return this.db.prepare("SELECT * FROM days WHERE id = ?").get(id) as DayRecord;
  }

  private computeStreak(name: string, excludeDayId: string): number {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return 1;
    const rows = this.db
      .prepare(
        `SELECT d.id as day_id, d.date as date, d.status as status,
                (SELECT COUNT(*) FROM tasks t
                   WHERE t.day_id = d.id
                   AND LOWER(TRIM(t.name)) = ?
                   AND t.status = 'DONE') as completed
         FROM days d
         WHERE d.id != ?
         ORDER BY d.day_number DESC`,
      )
      .all(normalized, excludeDayId) as Array<{
      day_id: string;
      date: string;
      status: string;
      completed: number;
    }>;

    let streak = 1;
    for (const r of rows) {
      if (r.completed > 0) streak += 1;
      else break;
    }
    return streak;
  }

  private multiplierFor(streak: number): number {
    return Math.min(2.5, 1.0 + Math.max(0, streak - 1) * 0.2);
  }

  addTask(
    dayId: string,
    task: {
      name: string;
      tier?: Tier;
      time_block?: string | null;
      notes?: string | null;
    },
  ): TaskRecord {
    const tier: Tier = task.tier ?? "STANDARD";
    const base = TIER_POINTS[tier];
    const streak = this.computeStreak(task.name, dayId);
    const multiplier = this.multiplierFor(streak);
    const id = randomUUID();
    const maxPos = this.db
      .prepare("SELECT COALESCE(MAX(position), -1) as m FROM tasks WHERE day_id = ?")
      .get(dayId) as { m: number };
    this.db
      .prepare(
        `INSERT INTO tasks (id, day_id, name, tier, base_points, time_block, status,
           elapsed_ms, streak_count, streak_multiplier, awarded_points, position, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', 0, ?, ?, 0, ?, ?, ?)`,
      )
      .run(
        id,
        dayId,
        task.name,
        tier,
        base,
        task.time_block ?? null,
        streak,
        multiplier,
        maxPos.m + 1,
        task.notes ?? null,
        this.nowIso(),
      );
    return this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRecord;
  }

  updateTask(id: string, patch: Partial<TaskRecord>): TaskRecord {
    const fields = [
      "name",
      "tier",
      "base_points",
      "time_block",
      "status",
      "elapsed_ms",
      "started_at",
      "completed_at",
      "streak_count",
      "streak_multiplier",
      "awarded_points",
      "notes",
    ];
    const existing = this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(id) as TaskRecord;
    if (!existing) throw new Error("Task not found");

    if (patch.name && patch.name !== existing.name) {
      const streak = this.computeStreak(patch.name, existing.day_id);
      patch.streak_count = streak;
      patch.streak_multiplier = this.multiplierFor(streak);
    }
    if (patch.tier && patch.tier !== existing.tier) {
      patch.base_points = TIER_POINTS[patch.tier];
    }

    const sets: string[] = [];
    const values: any[] = [];
    for (const f of fields) {
      if (f in patch) {
        sets.push(`${f} = ?`);
        values.push((patch as any)[f]);
      }
    }
    if (sets.length) {
      values.push(id);
      this.db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    }

    const dayId = existing.day_id;
    const total = this.db
      .prepare(
        "SELECT COALESCE(SUM(awarded_points), 0) as t FROM tasks WHERE day_id = ?",
      )
      .get(dayId) as { t: number };
    this.db
      .prepare("UPDATE days SET total_points = ? WHERE id = ?")
      .run(total.t, dayId);

    return this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRecord;
  }

  deleteTask(id: string) {
    const t = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
      | TaskRecord
      | undefined;
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    if (t) {
      const total = this.db
        .prepare(
          "SELECT COALESCE(SUM(awarded_points), 0) as t FROM tasks WHERE day_id = ?",
        )
        .get(t.day_id) as { t: number };
      this.db
        .prepare("UPDATE days SET total_points = ? WHERE id = ?")
        .run(total.t, t.day_id);
    }
    return { ok: true };
  }

  reorderTasks(dayId: string, orderedIds: string[]) {
    const stmt = this.db.prepare(
      "UPDATE tasks SET position = ? WHERE id = ? AND day_id = ?",
    );
    const tx = this.db.transaction((ids: string[]) => {
      ids.forEach((id, i) => stmt.run(i, id, dayId));
    });
    tx(orderedIds);
    return { ok: true };
  }

  saveReflection(
    dayId: string,
    entries: Array<{ question: string; answer: string; kind?: string }>,
  ) {
    const del = this.db.prepare("DELETE FROM reflections WHERE day_id = ?");
    const ins = this.db.prepare(
      `INSERT INTO reflections (id, day_id, question, answer, kind, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const tx = this.db.transaction(() => {
      del.run(dayId);
      for (const e of entries) {
        ins.run(
          randomUUID(),
          dayId,
          e.question,
          e.answer,
          e.kind ?? "reflect",
          this.nowIso(),
        );
      }
    });
    tx();
    return { ok: true };
  }

  saveDebrief(dayId: string, debrief: DebriefRecord) {
    this.db
      .prepare(
        `INSERT INTO debriefs (day_id, signal, blind_spots, connections, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(day_id) DO UPDATE SET
           signal = excluded.signal,
           blind_spots = excluded.blind_spots,
           connections = excluded.connections,
           created_at = excluded.created_at`,
      )
      .run(
        dayId,
        debrief.signal,
        debrief.blind_spots,
        debrief.connections,
        this.nowIso(),
      );
    return { ok: true };
  }

  getStreaks(): Array<{ name: string; streak: number; last_date: string }> {
    return this.db
      .prepare(
        `SELECT name, COUNT(*) as streak, MAX(d.date) as last_date
         FROM tasks t JOIN days d ON d.id = t.day_id
         WHERE t.status = 'DONE'
         GROUP BY LOWER(TRIM(name))
         HAVING streak > 1
         ORDER BY streak DESC`,
      )
      .all() as any;
  }

  exportAll() {
    return {
      days: this.db.prepare("SELECT * FROM days ORDER BY day_number ASC").all(),
      tasks: this.db.prepare("SELECT * FROM tasks").all(),
      reflections: this.db.prepare("SELECT * FROM reflections").all(),
      debriefs: this.db.prepare("SELECT * FROM debriefs").all(),
      exported_at: this.nowIso(),
    };
  }

  close() {
    this.db.close();
  }

  raw() {
    return this.db;
  }
}

// Bridge to the Electron preload API, with an in-memory fallback for
// browser-only previews (vite dev without electron). The fallback persists
// to localStorage so the UI feels real while iterating on design.

import type { Day, Debrief, ParsedTask, Task, Tier } from "../types";
import { TIER_POINTS } from "../types";

const LS_KEY = "scope:fallback:v1";

interface Store {
  days: Day[];
  tasks: Task[];
  reflections: Array<{
    id: string;
    day_id: string;
    question: string;
    answer: string;
    kind: string;
    created_at: string;
  }>;
  debriefs: Array<Debrief & { day_id: string }>;
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load(): Store {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { days: [], tasks: [], reflections: [], debriefs: [] };
}

function save(s: Store) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function multiplierFor(streak: number) {
  return Math.min(2.5, 1.0 + Math.max(0, streak - 1) * 0.2);
}

function computeStreak(s: Store, name: string, excludeDayId: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return 1;
  const closedDays = s.days
    .filter((d) => d.id !== excludeDayId)
    .sort((a, b) => b.day_number - a.day_number);
  let streak = 1;
  for (const d of closedDays) {
    const hit = s.tasks.find(
      (t) =>
        t.day_id === d.id &&
        t.name.trim().toLowerCase() === normalized &&
        t.status === "DONE",
    );
    if (hit) streak += 1;
    else break;
  }
  return streak;
}

function recomputeDayTotal(s: Store, dayId: string) {
  const total = s.tasks
    .filter((t) => t.day_id === dayId)
    .reduce((acc, t) => acc + (t.awarded_points || 0), 0);
  const day = s.days.find((d) => d.id === dayId);
  if (day) day.total_points = total;
}

const memBridge = {
  db: {
    async getCurrentDay() {
      const s = load();
      const today = todayDate();
      let day = s.days.find((d) => d.date === today);
      if (!day) {
        const last = [...s.days].sort((a, b) => b.day_number - a.day_number)[0];
        day = {
          id: uuid(),
          day_number: (last?.day_number ?? 0) + 1,
          date: today,
          motto: last?.motto ?? null,
          accent_rgb: last?.accent_rgb ?? null,
          accent_label: last?.accent_label ?? null,
          total_points: 0,
          status: "OPEN",
          created_at: nowIso(),
          closed_at: null,
        };
        s.days.push(day);
        save(s);
      }
      const tasks = s.tasks
        .filter((t) => t.day_id === day!.id)
        .sort((a, b) => a.position - b.position);
      return { day, tasks };
    },
    async listDays() {
      return load().days.sort((a, b) => b.day_number - a.day_number);
    },
    async getDay(id: string) {
      const s = load();
      const day = s.days.find((d) => d.id === id);
      if (!day) return null;
      return {
        day,
        tasks: s.tasks
          .filter((t) => t.day_id === id)
          .sort((a, b) => a.position - b.position),
        reflections: s.reflections.filter((r) => r.day_id === id),
        debrief: s.debriefs.find((d) => d.day_id === id) ?? null,
      };
    },
    async createDay(payload: Partial<Day>) {
      const s = load();
      const date = payload.date ?? todayDate();
      let day = s.days.find((d) => d.date === date);
      if (day) return day;
      const last = [...s.days].sort((a, b) => b.day_number - a.day_number)[0];
      day = {
        id: uuid(),
        day_number: (last?.day_number ?? 0) + 1,
        date,
        motto: payload.motto ?? null,
        accent_rgb: payload.accent_rgb ?? null,
        accent_label: payload.accent_label ?? null,
        total_points: 0,
        status: "OPEN",
        created_at: nowIso(),
        closed_at: null,
      };
      s.days.push(day);
      save(s);
      return day;
    },
    async updateDay(id: string, patch: Partial<Day>) {
      const s = load();
      const d = s.days.find((d) => d.id === id);
      if (!d) throw new Error("Day not found");
      Object.assign(d, patch);
      save(s);
      return d;
    },
    async addTask(
      dayId: string,
      task: { name: string; tier?: Tier; time_block?: string | null; notes?: string | null },
    ) {
      const s = load();
      const tier = task.tier ?? "STANDARD";
      const base = TIER_POINTS[tier];
      const streak = computeStreak(s, task.name, dayId);
      const multiplier = multiplierFor(streak);
      const maxPos = Math.max(
        -1,
        ...s.tasks.filter((t) => t.day_id === dayId).map((t) => t.position),
      );
      const t: Task = {
        id: uuid(),
        day_id: dayId,
        name: task.name,
        tier,
        base_points: base,
        time_block: task.time_block ?? null,
        status: "QUEUED",
        elapsed_ms: 0,
        started_at: null,
        completed_at: null,
        streak_count: streak,
        streak_multiplier: multiplier,
        awarded_points: 0,
        position: maxPos + 1,
        notes: task.notes ?? null,
        created_at: nowIso(),
      };
      s.tasks.push(t);
      save(s);
      return t;
    },
    async updateTask(id: string, patch: Partial<Task>) {
      const s = load();
      const t = s.tasks.find((t) => t.id === id);
      if (!t) throw new Error("Task not found");
      if (patch.name && patch.name !== t.name) {
        const streak = computeStreak(s, patch.name, t.day_id);
        patch.streak_count = streak;
        patch.streak_multiplier = multiplierFor(streak);
      }
      if (patch.tier && patch.tier !== t.tier) {
        patch.base_points = TIER_POINTS[patch.tier];
      }
      Object.assign(t, patch);
      recomputeDayTotal(s, t.day_id);
      save(s);
      return t;
    },
    async deleteTask(id: string) {
      const s = load();
      const t = s.tasks.find((x) => x.id === id);
      s.tasks = s.tasks.filter((x) => x.id !== id);
      if (t) recomputeDayTotal(s, t.day_id);
      save(s);
      return { ok: true as const };
    },
    async reorderTasks(dayId: string, orderedIds: string[]) {
      const s = load();
      orderedIds.forEach((id, i) => {
        const t = s.tasks.find((x) => x.id === id && x.day_id === dayId);
        if (t) t.position = i;
      });
      save(s);
      return { ok: true as const };
    },
    async saveReflection(
      dayId: string,
      entries: Array<{ question: string; answer: string; kind?: string }>,
    ) {
      const s = load();
      s.reflections = s.reflections.filter((r) => r.day_id !== dayId);
      for (const e of entries) {
        s.reflections.push({
          id: uuid(),
          day_id: dayId,
          question: e.question,
          answer: e.answer,
          kind: e.kind ?? "reflect",
          created_at: nowIso(),
        });
      }
      save(s);
      return { ok: true as const };
    },
    async saveDebrief(dayId: string, debrief: Debrief) {
      const s = load();
      s.debriefs = s.debriefs.filter((d) => d.day_id !== dayId);
      s.debriefs.push({ ...debrief, day_id: dayId });
      save(s);
      return { ok: true as const };
    },
    async getStreaks() {
      const s = load();
      const map = new Map<string, { name: string; streak: number; last_date: string }>();
      const sortedDays = [...s.days].sort((a, b) => b.day_number - a.day_number);
      for (const d of sortedDays) {
        const dayTasks = s.tasks.filter((t) => t.day_id === d.id && t.status === "DONE");
        for (const t of dayTasks) {
          const key = t.name.trim().toLowerCase();
          if (!map.has(key))
            map.set(key, { name: t.name, streak: 1, last_date: d.date });
          else {
            const prev = map.get(key)!;
            prev.streak += 1;
          }
        }
      }
      return [...map.values()].filter((v) => v.streak > 1).sort((a, b) => b.streak - a.streak);
    },
    async exportAll() {
      return load();
    },
  },
  ai: {
    async parseSchedule(_imageBase64: string): Promise<ParsedTask[]> {
      throw new Error(
        "AI features require running the desktop app with ANTHROPIC_API_KEY set.",
      );
    },
    async generateDebrief(_dayId: string): Promise<Debrief> {
      throw new Error("AI features require the desktop runtime + API key.");
    },
    async generateReflectionQuestions(_dayId: string): Promise<{ questions: string[] }> {
      throw new Error("AI features require the desktop runtime + API key.");
    },
    async generateThinkAbout(_dayId: string): Promise<{ prompts: string[] }> {
      throw new Error("AI features require the desktop runtime + API key.");
    },
    async mottoAccent(_motto: string): Promise<{ rgb: string; hex: string; label: string }> {
      throw new Error("AI features require the desktop runtime + API key.");
    },
  },
  app: {
    async hasApiKey() {
      return false;
    },
  },
};

export const bridge = (typeof window !== "undefined" && (window as any).scope
  ? (window as any).scope
  : memBridge) as typeof memBridge;

export const isElectron = typeof window !== "undefined" && Boolean((window as any).scope);

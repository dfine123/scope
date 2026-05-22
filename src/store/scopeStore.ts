import { create } from "zustand";
import type { Day, Task, Tier } from "../types";
import { TIER_ORDER } from "../types";
import { bridge, type Session } from "../services/bridge";

interface ScopeState {
  loaded: boolean;
  hasApiKey: boolean;
  authed: boolean;
  firstRun: boolean;
  day: Day | null;
  tasks: Task[];
  activeTaskId: string | null;
  // local epoch ms when the current active task was started or resumed
  activeStartedAt: number | null;
  bootSession: () => Promise<Session>;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  addTask: (input: { name: string; tier?: Tier; time_block?: string | null }) => Promise<void>;
  addTasksFromParse: (
    items: Array<{ name: string; tier: Tier; time_block: string | null }>,
  ) => Promise<void>;
  renameTask: (id: string, name: string) => Promise<void>;
  retierTask: (id: string, tier: Tier) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  startTask: (id: string) => Promise<void>;
  stopTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<{ awarded: number; streak: number } | null>;
  skipTask: (id: string) => Promise<void>;
  reorder: (ids: string[]) => Promise<void>;
  setMotto: (motto: string, accent: { rgb: string; hex: string; label: string }) => Promise<void>;
  closeDay: () => Promise<void>;
  openNextDay: (payload: {
    motto: string;
    accent_rgb: string;
    accent_label: string;
    tasks: Array<{ name: string; tier: Tier; time_block: string | null }>;
  }) => Promise<void>;
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ta = TIER_ORDER[a.tier];
    const tb = TIER_ORDER[b.tier];
    if (ta !== tb) return ta - tb;
    return a.position - b.position;
  });
}

export const useScope = create<ScopeState>((set, get) => ({
  loaded: false,
  hasApiKey: false,
  authed: false,
  firstRun: false,
  day: null,
  tasks: [],
  activeTaskId: null,
  activeStartedAt: null,

  async bootSession() {
    const me = await bridge.auth.me();
    set({ authed: me.authed, firstRun: me.firstRun ?? false, hasApiKey: me.hasApiKey });
    return me;
  },

  async load() {
    const { day, tasks } = await bridge.db.getCurrentDay();
    const active = tasks.find((t) => t.status === "ACTIVE");
    set({
      loaded: true,
      day,
      tasks: sortTasks(tasks),
      activeTaskId: active?.id ?? null,
      activeStartedAt: active ? Date.now() : null,
    });
  },

  async refresh() {
    const { day, tasks } = await bridge.db.getCurrentDay();
    const active = tasks.find((t) => t.status === "ACTIVE");
    set({
      day,
      tasks: sortTasks(tasks),
      activeTaskId: active?.id ?? null,
      activeStartedAt: active ? get().activeStartedAt ?? Date.now() : null,
    });
  },

  async addTask(input) {
    const { day } = get();
    if (!day) return;
    await bridge.db.addTask(day.id, {
      name: input.name,
      tier: input.tier ?? "STANDARD",
      time_block: input.time_block ?? null,
    });
    await get().refresh();
  },

  async addTasksFromParse(items) {
    const { day } = get();
    if (!day) return;
    for (const t of items) {
      await bridge.db.addTask(day.id, {
        name: t.name,
        tier: t.tier,
        time_block: t.time_block,
      });
    }
    await get().refresh();
  },

  async renameTask(id, name) {
    await bridge.db.updateTask(id, { name });
    await get().refresh();
  },

  async retierTask(id, tier) {
    await bridge.db.updateTask(id, { tier });
    await get().refresh();
  },

  async deleteTask(id) {
    if (get().activeTaskId === id) {
      set({ activeTaskId: null, activeStartedAt: null });
    }
    await bridge.db.deleteTask(id);
    await get().refresh();
  },

  async startTask(id) {
    const state = get();
    // Auto-pause any currently active task.
    if (state.activeTaskId && state.activeTaskId !== id) {
      await get().stopTask(state.activeTaskId);
    }
    const task = get().tasks.find((t) => t.id === id);
    if (!task || task.status === "DONE") return;
    const now = new Date().toISOString();
    await bridge.db.updateTask(id, { status: "ACTIVE", started_at: now });
    set({ activeTaskId: id, activeStartedAt: Date.now() });
    await get().refresh();
  },

  async stopTask(id) {
    const state = get();
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    const sessionMs = state.activeStartedAt ? Date.now() - state.activeStartedAt : 0;
    const newElapsed = task.elapsed_ms + Math.max(0, sessionMs);
    await bridge.db.updateTask(id, {
      status: "QUEUED",
      elapsed_ms: newElapsed,
      started_at: null,
    });
    set({ activeTaskId: null, activeStartedAt: null });
    await get().refresh();
  },

  async completeTask(id) {
    const state = get();
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return null;
    let elapsed = task.elapsed_ms;
    if (state.activeTaskId === id && state.activeStartedAt) {
      elapsed += Date.now() - state.activeStartedAt;
    }
    const awarded = Math.round(task.base_points * task.streak_multiplier);
    await bridge.db.updateTask(id, {
      status: "DONE",
      elapsed_ms: elapsed,
      started_at: null,
      completed_at: new Date().toISOString(),
      awarded_points: awarded,
    });
    if (state.activeTaskId === id) {
      set({ activeTaskId: null, activeStartedAt: null });
    }
    await get().refresh();
    return { awarded, streak: task.streak_count };
  },

  async skipTask(id) {
    await bridge.db.updateTask(id, { status: "SKIPPED" });
    await get().refresh();
  },

  async reorder(ids) {
    const { day } = get();
    if (!day) return;
    await bridge.db.reorderTasks(day.id, ids);
    await get().refresh();
  },

  async setMotto(motto, accent) {
    const { day } = get();
    if (!day) return;
    await bridge.db.updateDay(day.id, {
      motto,
      accent_rgb: accent.rgb,
      accent_label: accent.label,
    });
    await get().refresh();
  },

  async closeDay() {
    const { day } = get();
    if (!day) return;
    await bridge.db.updateDay(day.id, {
      status: "CLOSED",
      closed_at: new Date().toISOString(),
    });
    await get().refresh();
  },

  async openNextDay({ motto, accent_rgb, accent_label, tasks }) {
    // Create a day with tomorrow's date (or just create one with today's
    // date if today's day record is closed and current date is unchanged —
    // SQLite createDay handles uniqueness on date).
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);
    const newDay = await bridge.db.createDay({
      date,
      motto,
      accent_rgb,
      accent_label,
    });
    for (const t of tasks) {
      await bridge.db.addTask(newDay.id, {
        name: t.name,
        tier: t.tier,
        time_block: t.time_block,
      });
    }
  },
}));

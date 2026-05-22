// HTTP bridge to the SCOPE server.
//
// All API routes are prefixed with /api. Session cookies are HttpOnly, so
// the only auth-related thing the client tracks is the `authed` flag we
// fetch from /api/me on boot (and after login).

import type { Day, Debrief, ParsedTask, Subtask, Task, Tier } from "../types";

const API = "/api";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    // Notify listeners — the auth gate will re-render.
    window.dispatchEvent(new CustomEvent("scope:unauthorized"));
    throw new HttpError(401, "unauthorized");
  }
  const ct = res.headers.get("content-type") || "";
  const payload = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof payload === "object" && payload && "error" in payload ? (payload as any).error : payload;
    throw new HttpError(res.status, String(msg));
  }
  return payload as T;
}

export interface Session {
  firstRun: boolean;
  authed: boolean;
  openMode?: boolean;
  hasApiKey: boolean;
  operatorName?: string | null;
}

export interface AppSettings {
  maskedApiKey: string | null;
  hasApiKey: boolean;
  model: string;
  operatorName: string | null;
}

export interface SetupPayload {
  passcode: string;
  apiKey?: string;
  name?: string;
  motto?: string;
  accentRgb?: string;
  accentLabel?: string;
}

export const bridge = {
  auth: {
    status: () => call<Session>("GET", "/status"),
    me: () => call<Session>("GET", "/me"),
    setup: (payload: SetupPayload) =>
      call<{ ok: true }>("POST", "/setup", payload),
    login: (passcode: string) => call<{ ok: true }>("POST", "/auth/login", { passcode }),
    logout: () => call<{ ok: true }>("POST", "/auth/logout"),
  },
  settings: {
    get: () => call<AppSettings>("GET", "/settings"),
    save: (patch: { apiKey?: string; passcode?: string; operatorName?: string }) =>
      call<AppSettings & { ok: true }>("POST", "/settings", patch),
  },
  db: {
    getCurrentDay: () => call<{ day: Day; tasks: Task[] }>("GET", "/day/current"),
    listDays: () => call<Day[]>("GET", "/days"),
    getDay: (id: string) => call<any>("GET", `/day/${id}`),
    createDay: (payload: Partial<Day>) => call<Day>("POST", "/day", payload),
    updateDay: (id: string, patch: Partial<Day>) =>
      call<Day>("PATCH", `/day/${id}`, patch),
    addTask: (
      dayId: string,
      task: { name: string; tier?: Tier; time_block?: string | null; notes?: string | null },
    ) => call<Task>("POST", `/day/${dayId}/task`, task),
    updateTask: (id: string, patch: Partial<Task>) =>
      call<Task>("PATCH", `/task/${id}`, patch),
    deleteTask: (id: string) => call<{ ok: true }>("DELETE", `/task/${id}`),
    reorderTasks: (dayId: string, orderedIds: string[]) =>
      call<{ ok: true }>("POST", `/day/${dayId}/task/reorder`, { orderedIds }),
    saveReflection: (
      dayId: string,
      entries: Array<{ question: string; answer: string; kind?: string }>,
    ) => call<{ ok: true }>("POST", `/day/${dayId}/reflection`, { entries }),
    saveDebrief: (dayId: string, debrief: Debrief) =>
      call<{ ok: true }>("POST", `/day/${dayId}/debrief`, debrief),
    getStreaks: () =>
      call<Array<{ name: string; streak: number; last_date: string }>>("GET", "/streaks"),
    exportAll: () => call<any>("GET", "/export"),
    getSubtasks: (taskId: string) =>
      call<Subtask[]>("GET", `/task/${taskId}/subtasks`),
    addSubtask: (taskId: string, name: string) =>
      call<Subtask>("POST", `/task/${taskId}/subtask`, { name }),
    updateSubtask: (id: string, patch: { name?: string; status?: "QUEUED" | "DONE" }) =>
      call<Subtask>("PATCH", `/subtask/${id}`, patch),
    deleteSubtask: (id: string) =>
      call<{ ok: true }>("DELETE", `/subtask/${id}`),
  },
  ai: {
    parseSchedule: (image: string) =>
      call<ParsedTask[]>("POST", "/ai/schedule", { image }),
    generateDebrief: (dayId: string) =>
      call<Debrief>("POST", `/ai/debrief/${dayId}`),
    generateThinkAbout: (dayId: string) =>
      call<{ prompts: string[] }>("POST", `/ai/think/${dayId}`),
    generateReflectionQuestions: (dayId: string) =>
      call<{ questions: string[] }>("POST", `/ai/reflect/${dayId}`),
    mottoAccent: (motto: string) =>
      call<{ rgb: string; hex: string; label: string }>("POST", "/ai/motto", { motto }),
  },
};

// Compat shim — the `app` namespace from the Electron era is removed; the
// `hasApiKey` flag lives on the session now. Older imports will tree-shake.
export const isElectron = false;

export { HttpError };

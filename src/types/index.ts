export type Tier = "CRITICAL" | "HIGH" | "STANDARD" | "LOW";
export type TaskStatus = "QUEUED" | "ACTIVE" | "DONE" | "SKIPPED";

export interface Task {
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

export interface Day {
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

export interface Debrief {
  signal: string;
  blind_spots: string;
  connections: string;
}

export interface ParsedTask {
  name: string;
  tier: Tier;
  time_block: string | null;
  notes?: string;
}

export const TIER_POINTS: Record<Tier, number> = {
  CRITICAL: 200,
  HIGH: 120,
  STANDARD: 60,
  LOW: 30,
};

export const TIER_ORDER: Record<Tier, number> = {
  CRITICAL: 0,
  HIGH: 1,
  STANDARD: 2,
  LOW: 3,
};

declare global {
  interface Window {
    scope: {
      db: {
        getCurrentDay: () => Promise<{ day: Day; tasks: Task[] }>;
        listDays: () => Promise<Day[]>;
        getDay: (id: string) => Promise<any>;
        createDay: (payload: any) => Promise<Day>;
        updateDay: (id: string, patch: Partial<Day>) => Promise<Day>;
        addTask: (
          dayId: string,
          task: { name: string; tier?: Tier; time_block?: string | null; notes?: string | null },
        ) => Promise<Task>;
        updateTask: (id: string, patch: Partial<Task>) => Promise<Task>;
        deleteTask: (id: string) => Promise<{ ok: true }>;
        reorderTasks: (dayId: string, orderedIds: string[]) => Promise<{ ok: true }>;
        saveReflection: (
          dayId: string,
          entries: Array<{ question: string; answer: string; kind?: string }>,
        ) => Promise<{ ok: true }>;
        saveDebrief: (dayId: string, debrief: Debrief) => Promise<{ ok: true }>;
        getStreaks: () => Promise<Array<{ name: string; streak: number; last_date: string }>>;
        exportAll: () => Promise<any>;
      };
      ai: {
        parseSchedule: (imageBase64: string) => Promise<ParsedTask[]>;
        generateDebrief: (dayId: string) => Promise<Debrief>;
        generateReflectionQuestions: (dayId: string) => Promise<{ questions: string[] }>;
        generateThinkAbout: (dayId: string) => Promise<{ prompts: string[] }>;
        mottoAccent: (
          motto: string,
        ) => Promise<{ rgb: string; hex: string; label: string }>;
      };
      app: {
        hasApiKey: () => Promise<boolean>;
      };
    };
  }
}

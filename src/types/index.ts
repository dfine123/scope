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

export {};

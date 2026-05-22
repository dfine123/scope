import Anthropic from "@anthropic-ai/sdk";
import type { Database, Tier } from "./db";

const MODEL = process.env.SCOPE_CLAUDE_MODEL || "claude-sonnet-4-20250514";

interface ParsedTask {
  name: string;
  tier: Tier;
  time_block: string | null;
  notes?: string;
}

export class ClaudeService {
  private client: Anthropic | null;
  constructor(private db: Database) {
    const key = process.env.ANTHROPIC_API_KEY;
    this.client = key ? new Anthropic({ apiKey: key }) : null;
  }

  hasKey() {
    return Boolean(this.client);
  }

  private requireClient(): Anthropic {
    if (!this.client)
      throw new Error(
        "Missing ANTHROPIC_API_KEY. Set it in the environment to enable AI features.",
      );
    return this.client;
  }

  private extractJson<T>(raw: string): T {
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : raw;
    const start = candidate.indexOf("{");
    const startArr = candidate.indexOf("[");
    let slice = candidate;
    if (start !== -1 || startArr !== -1) {
      const idx =
        start === -1
          ? startArr
          : startArr === -1
            ? start
            : Math.min(start, startArr);
      slice = candidate.slice(idx);
      const endChar = slice[0] === "{" ? "}" : "]";
      const last = slice.lastIndexOf(endChar);
      if (last !== -1) slice = slice.slice(0, last + 1);
    }
    return JSON.parse(slice) as T;
  }

  private historyContext(limit = 7): string {
    const days = this.db
      .raw()
      .prepare(
        "SELECT * FROM days WHERE status = 'CLOSED' ORDER BY day_number DESC LIMIT ?",
      )
      .all(limit) as any[];
    if (!days.length) return "No prior days on record.";
    const lines: string[] = [];
    for (const d of days.reverse()) {
      const tasks = this.db
        .raw()
        .prepare(
          "SELECT name, tier, status, elapsed_ms, awarded_points, streak_count FROM tasks WHERE day_id = ?",
        )
        .all(d.id) as any[];
      const refls = this.db
        .raw()
        .prepare("SELECT question, answer FROM reflections WHERE day_id = ?")
        .all(d.id) as any[];
      const debrief = this.db
        .raw()
        .prepare("SELECT * FROM debriefs WHERE day_id = ?")
        .get(d.id) as any;
      lines.push(`--- Day ${d.day_number} (${d.date}) ---`);
      if (d.motto) lines.push(`Motto: ${d.motto}`);
      lines.push(`Points: ${d.total_points}`);
      for (const t of tasks) {
        const mins = Math.round(t.elapsed_ms / 60000);
        lines.push(
          `  · ${t.name} [${t.tier}] ${t.status} ${mins}m +${t.awarded_points}pt streak=${t.streak_count}`,
        );
      }
      for (const r of refls) {
        lines.push(`  Q: ${r.question}\n  A: ${r.answer}`);
      }
      if (debrief) {
        lines.push(
          `  Signal: ${debrief.signal}\n  Blind Spots: ${debrief.blind_spots}\n  Connections: ${debrief.connections}`,
        );
      }
    }
    return lines.join("\n");
  }

  private dayContext(dayId: string): string {
    const day = this.db.raw().prepare("SELECT * FROM days WHERE id = ?").get(dayId) as any;
    if (!day) return "";
    const tasks = this.db
      .raw()
      .prepare("SELECT * FROM tasks WHERE day_id = ? ORDER BY position ASC")
      .all(dayId) as any[];
    const refls = this.db
      .raw()
      .prepare("SELECT question, answer FROM reflections WHERE day_id = ?")
      .all(dayId) as any[];
    const lines = [
      `--- TODAY: Day ${day.day_number} (${day.date}) ---`,
      day.motto ? `Motto: ${day.motto}` : "Motto: (none)",
      `Points: ${day.total_points}`,
      `Tasks:`,
    ];
    for (const t of tasks) {
      const mins = Math.round(t.elapsed_ms / 60000);
      lines.push(
        `  · ${t.name} [${t.tier}] ${t.status} ${mins}m +${t.awarded_points}pt streak=${t.streak_count}`,
      );
    }
    if (refls.length) {
      lines.push(`Reflections so far:`);
      for (const r of refls) lines.push(`  Q: ${r.question}\n  A: ${r.answer}`);
    }
    return lines.join("\n");
  }

  async parseSchedule(imageBase64: string): Promise<ParsedTask[]> {
    const client = this.requireClient();
    const media = imageBase64.startsWith("data:")
      ? imageBase64.split(",")[1]
      : imageBase64;
    const mediaTypeMatch = imageBase64.match(/^data:(image\/[a-z]+);base64/i);
    const mediaType = (mediaTypeMatch?.[1] as
      | "image/png"
      | "image/jpeg"
      | "image/webp"
      | "image/gif") || "image/png";

    const system = `You are SCOPE's intake parser. You convert a photo of a daily schedule (handwritten or printed) into a structured task list.

Tiering rubric (think pot odds, not difficulty):
- CRITICAL: highest-EV moves. The bet that defines the day. 1-3 max.
- HIGH: meaningful build/ship/sell work. Real revenue or product motion.
- STANDARD: necessary maintenance, meetings, planned blocks.
- LOW: admin, small chores, errands.

If something is clearly recurring or labeled as a daily — still tag it on merit, not just because it repeats.

Return STRICT JSON with shape:
{ "tasks": [ { "name": string, "tier": "CRITICAL"|"HIGH"|"STANDARD"|"LOW", "time_block": string|null, "notes": string|null } ] }

- name: short, action-forward, 2-8 words. Preserve project names exactly.
- time_block: as written (e.g. "9:00–11:00", "AM block") or null.
- Do not invent tasks. Only parse what's visible.
- Order tasks as they appear on the page.
- Output nothing but JSON.`;

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: media },
            },
            {
              type: "text",
              text: "Parse this schedule into the JSON schema.",
            },
          ],
        },
      ],
    });

    const text = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");
    const parsed = this.extractJson<{ tasks: ParsedTask[] }>(text);
    return parsed.tasks.map((t) => ({
      name: t.name,
      tier: t.tier,
      time_block: t.time_block ?? null,
      notes: t.notes ?? undefined,
    }));
  }

  async generateDebrief(dayId: string) {
    const client = this.requireClient();
    const today = this.dayContext(dayId);
    const history = this.historyContext(10);

    const system = `You are SCOPE's debrief engine. You speak to DFine — a multi-venture operator (luxury concierge in Miami, a funded gaming platform, an adversarial AI product, affiliate ops, creator management). He's a poker player. He thinks in EV, position, information asymmetry.

Tone: peer-level co-founder. Direct. Observant. Compressed. Slightly provocative. No filler. No "Great job." No emoji. No softening. Call patterns. Name avoidance. Ask sharp questions when warranted.

Output STRICT JSON:
{
  "signal": "string — 2-4 dense lines on what today's data actually says. Numbers > vibes.",
  "blind_spots": "string — 2-4 lines on what he's not seeing, neglecting, or unconsciously avoiding. Compare against multi-day patterns when possible. Use 'Blind spot:' style phrasing internally; whole field is one paragraph.",
  "connections": "string — 2-4 lines cross-referencing tasks, time allocations, reflections across days. Surface non-obvious links. The highest-value field."
}

Each field is plain prose (no markdown). Keep total under 600 words. Output ONLY the JSON.`;

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content: `HISTORY:\n${history}\n\n${today}\n\nWrite the debrief.`,
        },
      ],
    });
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    return this.extractJson<{
      signal: string;
      blind_spots: string;
      connections: string;
    }>(text);
  }

  async generateThinkAbout(dayId: string) {
    const client = this.requireClient();
    const today = this.dayContext(dayId);
    const history = this.historyContext(10);

    const system = `You are SCOPE's provocation layer. Generate "Have you thought about:" prompts for DFine.

These are NOT journaling prompts. They are strategic provocations. Range tactical→philosophical. Pull from accumulated context. Surprise him.

Rules:
- 2-3 prompts.
- Each is a single sentence (occasionally two), starting WITHOUT the words "Have you thought about" — the UI provides that header.
- Specific. Reference actual project names, actual gaps, actual patterns you see in the data. Not generic.
- At least one should push back or challenge an assumption.
- No advice. No "you should." Only questions or sharp observations ending in a question.
- No emoji. No filler. No softening.

Output STRICT JSON: { "prompts": [string, string, string] }`;

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: [
        {
          role: "user",
          content: `HISTORY:\n${history}\n\n${today}\n\nGenerate the prompts.`,
        },
      ],
    });
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    return this.extractJson<{ prompts: string[] }>(text);
  }

  async generateReflectionQuestions(dayId: string) {
    const client = this.requireClient();
    const today = this.dayContext(dayId);
    const history = this.historyContext(10);

    const system = `You are SCOPE's reflection layer. Generate 1-2 condensed-diary questions for DFine to type short answers to. Not therapy. Not gratitude. Closer to a sharp co-founder asking the right thing.

Rules:
- 1-2 questions total.
- Tight. Single sentence each.
- Evolve over time. Reference what's actually happening. Make him think.
- Never "how did you feel". Aim at decisions, observations, choices, momentum, friction.

Output STRICT JSON: { "questions": [string] }  // length 1 or 2`;

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: [
        {
          role: "user",
          content: `HISTORY:\n${history}\n\n${today}\n\nGenerate the questions.`,
        },
      ],
    });
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    return this.extractJson<{ questions: string[] }>(text);
  }

  async mottoAccent(motto: string) {
    const client = this.requireClient();
    const system = `You map an operating motto to an RGB accent color for a dark terminal UI.

Logic:
- Aggressive / kill-the-week / no-mercy mottos → reds, blood-orange, ember.
- Focused / locked-in / build-mode mottos → electric blues, cyans, cobalt.
- Philosophical / patient / wait-for-the-right-hand mottos → magentas, purples, violet.
- Cold / clinical / observation mottos → pale ice / steel.
- Aspirational / momentum mottos → green-cyan, emerald-electric (use sparingly).

Constraints:
- Must read well as a soft glow over near-black (#0A0A0F). No muddy desaturated colors.
- Avoid pure white, pure yellow, pure neon green.
- Saturation around 70-90%, lightness around 55-65%.

Output STRICT JSON:
{ "rgb": "R, G, B" (integers 0-255 as a single string like "120, 200, 255"),
  "hex": "#RRGGBB",
  "label": "1-3 word color name, lowercase" }`;

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system,
      messages: [
        {
          role: "user",
          content: `Motto: "${motto}"`,
        },
      ],
    });
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    return this.extractJson<{ rgb: string; hex: string; label: string }>(text);
  }
}

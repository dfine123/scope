import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useScope } from "../../store/scopeStore";
import { bridge } from "../../services/bridge";
import { Reticle } from "../ui/Reticle";
import { ViewfinderMarks } from "../ui/ViewfinderMarks";
import { ScheduleUpload } from "./ScheduleUpload";
import type { Debrief, ParsedTask } from "../../types";
import { applyAccent, localMottoAccent } from "../../services/mottoColor";
import { formatMinutes } from "../../lib/time";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Stage = "debrief" | "think" | "reflect" | "motto" | "schedule" | "complete";

const STAGES: Array<{ key: Stage; label: string; eyebrow: string }> = [
  { key: "debrief", label: "Debrief", eyebrow: "01" },
  { key: "think", label: "Have You Thought About", eyebrow: "02" },
  { key: "reflect", label: "Reflect", eyebrow: "03" },
  { key: "motto", label: "Tomorrow's Motto", eyebrow: "04" },
  { key: "schedule", label: "Load Tomorrow", eyebrow: "05" },
];

export function EndDayFlow({ open, onClose }: Props) {
  const day = useScope((s) => s.day);
  const tasks = useScope((s) => s.tasks);
  const hasApiKey = useScope((s) => s.hasApiKey);
  const closeDay = useScope((s) => s.closeDay);
  const openNextDay = useScope((s) => s.openNextDay);
  const load = useScope((s) => s.load);
  const [stage, setStage] = useState<Stage>("debrief");

  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [debriefErr, setDebriefErr] = useState<string | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);

  const [prompts, setPrompts] = useState<string[]>([]);
  const [thinkAnswers, setThinkAnswers] = useState<Record<number, string>>({});
  const [thinkLoading, setThinkLoading] = useState(false);

  const [reflectQs, setReflectQs] = useState<string[]>([]);
  const [reflectAnswers, setReflectAnswers] = useState<Record<number, string>>({});
  const [reflectLoading, setReflectLoading] = useState(false);

  const [motto, setMotto] = useState("");
  const [accent, setAccent] = useState<{ rgb: string; hex: string; label: string } | null>(null);
  const [mottoLoading, setMottoLoading] = useState(false);

  const [tomorrowTasks, setTomorrowTasks] = useState<ParsedTask[]>([]);

  // Reset preview accent on close
  useEffect(() => {
    if (!open) return;
    setStage("debrief");
    setDebrief(null);
    setPrompts([]);
    setReflectQs([]);
    setMotto("");
    setAccent(null);
    setTomorrowTasks([]);
  }, [open]);

  // Live-preview the accent color as it's chosen.
  useEffect(() => {
    if (!open) return;
    if (accent) applyAccent(accent.rgb);
    return () => {
      if (day?.accent_rgb) applyAccent(day.accent_rgb);
    };
  }, [accent, open, day?.accent_rgb]);

  const summary = useMemo(() => {
    const done = tasks.filter((t) => t.status === "DONE");
    const skipped = tasks.filter((t) => t.status === "SKIPPED");
    const totalElapsed = tasks.reduce((acc, t) => acc + t.elapsed_ms, 0);
    return {
      done: done.length,
      total: tasks.length,
      skipped: skipped.length,
      points: day?.total_points ?? 0,
      hours: formatMinutes(totalElapsed),
    };
  }, [tasks, day]);

  // Stage entry effects -----------------------------------------------------
  useEffect(() => {
    if (!open || !day) return;
    if (stage === "debrief" && !debrief && !debriefLoading) {
      if (hasApiKey) {
        setDebriefLoading(true);
        bridge.ai
          .generateDebrief(day.id)
          .then(async (d) => {
            setDebrief(d);
            await bridge.db.saveDebrief(day.id, d);
          })
          .catch((e) => setDebriefErr(e?.message || "Debrief generation failed."))
          .finally(() => setDebriefLoading(false));
      } else {
        // Local fallback — heuristic, honest.
        const fallback = makeLocalDebrief(summary, tasks, day.motto);
        setDebrief(fallback);
      }
    }
    if (stage === "think" && prompts.length === 0 && !thinkLoading) {
      if (hasApiKey) {
        setThinkLoading(true);
        bridge.ai
          .generateThinkAbout(day.id)
          .then((r) => setPrompts(r.prompts))
          .catch(() => setPrompts(localProvocations(tasks)))
          .finally(() => setThinkLoading(false));
      } else {
        setPrompts(localProvocations(tasks));
      }
    }
    if (stage === "reflect" && reflectQs.length === 0 && !reflectLoading) {
      if (hasApiKey) {
        setReflectLoading(true);
        bridge.ai
          .generateReflectionQuestions(day.id)
          .then((r) => setReflectQs(r.questions))
          .catch(() => setReflectQs(localReflectionQs(day.day_number)))
          .finally(() => setReflectLoading(false));
      } else {
        setReflectQs(localReflectionQs(day.day_number));
      }
    }
  }, [stage, open, day, hasApiKey, debrief, debriefLoading, prompts.length, thinkLoading, reflectQs.length, reflectLoading, tasks, summary]);

  if (!open || !day) return null;

  const goNext = async () => {
    if (stage === "debrief") setStage("think");
    else if (stage === "think") {
      // persist think answers as reflections
      const entries = prompts.map((q, i) => ({
        question: `Think about: ${q}`,
        answer: thinkAnswers[i] || "",
        kind: "think",
      }));
      await bridge.db.saveReflection(day.id, entries);
      setStage("reflect");
    } else if (stage === "reflect") {
      const prior = prompts.map((q, i) => ({
        question: `Think about: ${q}`,
        answer: thinkAnswers[i] || "",
        kind: "think",
      }));
      const reflections = reflectQs.map((q, i) => ({
        question: q,
        answer: reflectAnswers[i] || "",
        kind: "reflect",
      }));
      await bridge.db.saveReflection(day.id, [...prior, ...reflections]);
      setStage("motto");
    } else if (stage === "motto") {
      setStage("schedule");
    } else if (stage === "schedule") {
      // Close today, open tomorrow.
      await closeDay();
      if (motto && accent) {
        await openNextDay({
          motto: motto.trim(),
          accent_rgb: accent.rgb,
          accent_label: accent.label,
          tasks: tomorrowTasks,
        });
      }
      setStage("complete");
    }
  };

  const computeAccent = async () => {
    const trimmed = motto.trim();
    if (!trimmed) return;
    setMottoLoading(true);
    try {
      if (hasApiKey) {
        const a = await bridge.ai.mottoAccent(trimmed);
        setAccent({ rgb: a.rgb, hex: a.hex, label: a.label });
      } else {
        setAccent(localMottoAccent(trimmed));
      }
    } catch {
      setAccent(localMottoAccent(trimmed));
    } finally {
      setMottoLoading(false);
    }
  };

  const stageIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-50 backdrop flex items-center justify-center px-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-3xl max-h-[88vh] flex flex-col hairline bg-ink-100/95 rounded-[4px] overflow-hidden"
          >
            <ViewfinderMarks inset={8} size={16} opacity={0.45} />

            {/* Stage header */}
            <div className="px-8 pt-6 pb-4 border-b border-white/[0.05] flex items-center justify-between">
              <div>
                <div className="label-eyebrow">DAY {String(day.day_number).padStart(3, "0")} · CLOSING SEQUENCE</div>
                <div className="font-display text-2xl text-cream-bright mt-1">
                  {stage === "complete" ? "Sequence complete" : STAGES[stageIdx].label}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {STAGES.map((s, i) => (
                  <span
                    key={s.key}
                    className={`mono text-[10px] tracking-widest2 uppercase px-1.5 py-0.5 rounded-[1px]
                                ${i === stageIdx ? "bg-[rgb(var(--accent-rgb)/0.15)] text-[rgb(var(--accent-rgb))]" : i < stageIdx ? "text-muted" : "text-muted-deep"}`}
                  >
                    {s.eyebrow}
                  </span>
                ))}
              </div>
            </div>

            {/* Stage body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
                  {stage === "debrief" && (
                    <DebriefView debrief={debrief} loading={debriefLoading} summary={summary} err={debriefErr} />
                  )}
                  {stage === "think" && (
                    <ThinkView
                      prompts={prompts}
                      loading={thinkLoading}
                      answers={thinkAnswers}
                      onAnswer={(i, v) => setThinkAnswers((p) => ({ ...p, [i]: v }))}
                    />
                  )}
                  {stage === "reflect" && (
                    <ReflectView
                      questions={reflectQs}
                      loading={reflectLoading}
                      answers={reflectAnswers}
                      onAnswer={(i, v) => setReflectAnswers((p) => ({ ...p, [i]: v }))}
                    />
                  )}
                  {stage === "motto" && (
                    <MottoView
                      motto={motto}
                      setMotto={setMotto}
                      accent={accent}
                      loading={mottoLoading}
                      computeAccent={computeAccent}
                    />
                  )}
                  {stage === "schedule" && (
                    <ScheduleView
                      tasks={tomorrowTasks}
                      setTasks={setTomorrowTasks}
                      motto={motto}
                      hasApiKey={hasApiKey}
                    />
                  )}
                  {stage === "complete" && (
                    <CompleteView
                      onDone={async () => {
                        // Reload current day state — if tomorrow has a date
                        // matching today (timezones), it'll appear; otherwise
                        // a fresh empty day will be created on next open.
                        await load();
                        onClose();
                      }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            {stage !== "complete" && (
              <div className="px-8 py-4 border-t border-white/[0.05] flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim"
                >
                  ← back to day
                </button>
                <button
                  onClick={goNext}
                  className="mono text-[11px] tracking-widest2 uppercase px-4 py-2 border border-[rgb(var(--accent-rgb)/0.5)]
                             text-[rgb(var(--accent-rgb))] rounded-[2px] hover:bg-[rgb(var(--accent-rgb)/0.08)]
                             hover:border-[rgb(var(--accent-rgb)/0.8)] hover:shadow-[0_0_24px_-6px_rgb(var(--accent-rgb)/0.55)]"
                >
                  {stage === "schedule" ? "LOCK TOMORROW" : "ADVANCE →"}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function DebriefView({
  debrief,
  loading,
  summary,
  err,
}: {
  debrief: Debrief | null;
  loading: boolean;
  summary: { done: number; total: number; skipped: number; points: number; hours: string };
  err: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        <Stat label="POINTS" value={summary.points.toLocaleString()} />
        <Stat label="CLEARED" value={`${summary.done}/${summary.total}`} />
        <Stat label="PASSED" value={String(summary.skipped)} />
        <Stat label="TIME LOGGED" value={summary.hours} />
      </div>
      {loading && (
        <div className="flex items-center gap-3 mono text-[11px] tracking-widest2 uppercase text-muted">
          <Reticle size={14} /> generating debrief
        </div>
      )}
      {err && <div className="mono text-[11px] text-tier-critical">{err}</div>}
      {debrief && (
        <div className="flex flex-col gap-5">
          <DebriefSection eyebrow="SIGNAL" body={debrief.signal} />
          <DebriefSection eyebrow="BLIND SPOTS" body={debrief.blind_spots} />
          <DebriefSection eyebrow="CONNECTIONS" body={debrief.connections} />
        </div>
      )}
    </div>
  );
}

function DebriefSection({ eyebrow, body }: { eyebrow: string; body: string }) {
  return (
    <div className="bracket pl-4 pr-3 py-3">
      <div className="label-eyebrow accent">{eyebrow}</div>
      <div className="font-display text-[15px] leading-relaxed text-cream-bright mt-1.5 whitespace-pre-wrap">
        {body}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hairline rounded-[3px] px-4 py-3 bg-ink-100/40">
      <div className="label-eyebrow">{label}</div>
      <div className="mono text-xl text-cream-bright mt-1">{value}</div>
    </div>
  );
}

function ThinkView({
  prompts,
  loading,
  answers,
  onAnswer,
}: {
  prompts: string[];
  loading: boolean;
  answers: Record<number, string>;
  onAnswer: (i: number, v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="label-eyebrow accent">HAVE YOU THOUGHT ABOUT:</div>
      {loading && (
        <div className="flex items-center gap-3 mono text-[11px] tracking-widest2 uppercase text-muted">
          <Reticle size={14} /> drawing from prior days
        </div>
      )}
      {prompts.map((p, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="font-display text-[16px] leading-snug text-cream-bright">{p}</div>
          <textarea
            value={answers[i] || ""}
            onChange={(e) => onAnswer(i, e.target.value)}
            rows={2}
            placeholder="optional — type a line or skip"
            className="hairline rounded-[3px] bg-ink-50/60 px-3 py-2 mono text-[13px] resize-none"
          />
        </div>
      ))}
    </div>
  );
}

function ReflectView({
  questions,
  loading,
  answers,
  onAnswer,
}: {
  questions: string[];
  loading: boolean;
  answers: Record<number, string>;
  onAnswer: (i: number, v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="label-eyebrow accent">CONDENSED DEBRIEF</div>
      {loading && (
        <div className="flex items-center gap-3 mono text-[11px] tracking-widest2 uppercase text-muted">
          <Reticle size={14} /> tuning questions to your data
        </div>
      )}
      {questions.map((q, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="font-display text-[16px] leading-snug text-cream-bright">{q}</div>
          <textarea
            value={answers[i] || ""}
            onChange={(e) => onAnswer(i, e.target.value)}
            rows={3}
            placeholder="short — a few lines is enough"
            className="hairline rounded-[3px] bg-ink-50/60 px-3 py-2 mono text-[13px] resize-none"
          />
        </div>
      ))}
    </div>
  );
}

function MottoView({
  motto,
  setMotto,
  accent,
  loading,
  computeAccent,
}: {
  motto: string;
  setMotto: (v: string) => void;
  accent: { rgb: string; hex: string; label: string } | null;
  loading: boolean;
  computeAccent: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="label-eyebrow accent">TOMORROW'S OPERATING DIRECTIVE</div>
        <div className="font-display text-[14px] text-cream-dim mt-1">
          A phrase. A directive. Set the tone before the schedule loads.
        </div>
      </div>
      <textarea
        value={motto}
        onChange={(e) => setMotto(e.target.value)}
        onBlur={computeAccent}
        rows={2}
        placeholder="e.g. obsession is a blessing"
        className="hairline rounded-[3px] bg-ink-50/60 px-4 py-3 font-display text-xl text-cream-bright resize-none"
      />
      <div className="flex items-center justify-between">
        <button
          onClick={computeAccent}
          disabled={!motto.trim() || loading}
          className="mono text-[11px] tracking-widest2 uppercase px-3 py-1.5 border border-white/15 rounded-[2px] text-cream-dim hover:text-cream-bright hover:border-white/30 disabled:opacity-30"
        >
          {loading ? "tuning…" : accent ? "retune accent" : "tune accent"}
        </button>
        {accent && (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-[2px] border border-white/10"
              style={{
                background: `rgb(${accent.rgb})`,
                boxShadow: `0 0 24px -4px rgb(${accent.rgb})`,
              }}
            />
            <div className="flex flex-col">
              <div className="mono text-[10px] tracking-widest2 uppercase text-muted">{accent.label}</div>
              <div className="mono text-[11px] text-cream-dim">{accent.hex}</div>
            </div>
          </div>
        )}
      </div>
      {accent && (
        <div className="hairline rounded-[3px] bg-ink-50/40 p-5 text-center">
          <div className="label-eyebrow">PREVIEW</div>
          <div className="font-display text-2xl text-cream-bright motto-breath mt-2">{motto}</div>
        </div>
      )}
    </div>
  );
}

function ScheduleView({
  tasks,
  setTasks,
  motto,
  hasApiKey,
}: {
  tasks: ParsedTask[];
  setTasks: (t: ParsedTask[]) => void;
  motto: string;
  hasApiKey: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="label-eyebrow accent">LOAD TOMORROW'S SCHEDULE</div>
        <div className="font-display text-[14px] text-cream-dim mt-1">
          Upload a photo, or skip and add tasks manually tomorrow.
        </div>
      </div>
      <ScheduleUpload onParsed={setTasks} />
      {!hasApiKey && (
        <div className="mono text-[11px] text-muted">
          Vision parsing requires <span className="text-cream-dim">ANTHROPIC_API_KEY</span> on the server.
          Skip and load tomorrow manually.
        </div>
      )}
      {tasks.length > 0 && (
        <div className="hairline rounded-[3px] bg-ink-50/40 p-4">
          <div className="label-eyebrow mb-2">PARSED · {tasks.length} TASKS</div>
          <div className="flex flex-col gap-1.5">
            {tasks.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 mono text-[12px] text-cream-dim"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className={`tier-dot tier-${t.tier}`} />
                  <span className="text-cream-bright truncate">{t.name}</span>
                  {t.time_block && <span className="text-muted">· {t.time_block}</span>}
                </span>
                <span className="text-muted text-[10px] tracking-widest2 uppercase">{t.tier}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {motto && (
        <div className="mono text-[11px] text-muted">
          Locking in: <span className="text-cream-bright">"{motto}"</span>
        </div>
      )}
    </div>
  );
}

function CompleteView({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 1400);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-6 py-10"
    >
      <Reticle size={48} />
      <div className="font-display text-2xl text-cream-bright">Day banked.</div>
      <div className="mono text-[11px] tracking-widest2 uppercase text-muted">
        next sequence loaded · system idle
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Local fallbacks (used when no API key — keeps the flow usable, honest tone)
// ---------------------------------------------------------------------------

function makeLocalDebrief(
  summary: { done: number; total: number; skipped: number; points: number; hours: string },
  tasks: any[],
  motto: string | null,
): Debrief {
  const ratio = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  const topPoints = [...tasks].sort((a, b) => b.awarded_points - a.awarded_points)[0];
  const untouched = tasks.filter((t) => t.elapsed_ms === 0 && t.status !== "DONE");
  const lines = [
    `${summary.points} pts across ${summary.done}/${summary.total} tasks (${ratio}%). ${summary.hours} logged.`,
    topPoints?.awarded_points ? `Heaviest bank: ${topPoints.name} — +${topPoints.awarded_points}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const blind = untouched.length
    ? `${untouched.length} queued targets logged zero time today: ${untouched
        .slice(0, 3)
        .map((t) => t.name)
        .join(", ")}${untouched.length > 3 ? "…" : ""}. Drift or intent?`
    : "No untouched tasks. Time matched stated priorities.";
  const conn = motto
    ? `Motto in play: "${motto}". Did today's allocation match the directive?`
    : "No motto set — tomorrow's accent will inherit defaults.";
  return { signal: lines, blind_spots: blind, connections: conn };
}

function localProvocations(tasks: any[]): string[] {
  const skipped = tasks.filter((t) => t.status === "SKIPPED");
  const critical = tasks.filter((t) => t.tier === "CRITICAL");
  const out: string[] = [];
  if (skipped.length)
    out.push(
      `What you passed on today: ${skipped[0].name}. Is it actually dead, or is it just easier to defer than to call it dead?`,
    );
  if (critical.length && critical.every((c) => c.status !== "DONE"))
    out.push(
      `Critical-tier untouched: ${critical[0].name}. If this is critical, why didn't it move?`,
    );
  out.push("What did you spend time on today that you wouldn't put on a public calendar?");
  return out.slice(0, 3);
}

function localReflectionQs(dayNumber: number): string[] {
  if (dayNumber < 5)
    return ["What got your full attention today?", "What was the highest-EV move you made?"];
  if (dayNumber < 15)
    return ["Where did the day diverge from the schedule, and why?"];
  return [
    "What are you building momentum toward that you haven't named yet?",
    "What pattern from this week would you flag if you saw it in someone else's day?",
  ];
}

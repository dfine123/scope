import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScope } from "../../store/scopeStore";
import { ViewfinderMarks } from "../ui/ViewfinderMarks";
import { TIER_POINTS } from "../../types";
import type { ParsedTask, Tier } from "../../types";

const TIER_OPTIONS: Tier[] = ["CRITICAL", "HIGH", "STANDARD", "LOW"];

const TIER_LABEL: Record<Tier, string> = {
  CRITICAL: "CRIT",
  HIGH: "HIGH",
  STANDARD: "STD",
  LOW: "LOW",
};

interface Props {
  parsed: ParsedTask[];
  onCancel: () => void;
  onDeployed: () => void;
}

export function TaskReview({ parsed, onCancel, onDeployed }: Props) {
  const addTasksFromParse = useScope((s) => s.addTasksFromParse);

  const [tasks, setTasks] = useState<ParsedTask[]>(parsed);
  const [deploying, setDeploying] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [tierMenuFor, setTierMenuFor] = useState<number | null>(null);

  const updateTask = (i: number, patch: Partial<ParsedTask>) => {
    setTasks((curr) => curr.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const removeTask = (i: number) => setTasks((curr) => curr.filter((_, idx) => idx !== i));
  const moveTask = (i: number, dir: -1 | 1) => {
    setTasks((curr) => {
      const j = i + dir;
      if (j < 0 || j >= curr.length) return curr;
      const next = [...curr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const addBlank = () => {
    setTasks((curr) => [...curr, { name: "", tier: "STANDARD", time_block: null }]);
    setTimeout(() => setEditing(tasks.length), 0);
  };

  const deploy = async () => {
    const valid = tasks.filter((t) => t.name.trim().length > 0);
    if (!valid.length) return;
    setDeploying(true);
    try {
      await addTasksFromParse(
        valid.map((t) => ({ name: t.name.trim(), tier: t.tier, time_block: t.time_block })),
      );
      onDeployed();
    } finally {
      setDeploying(false);
    }
  };

  const totalPoints = tasks
    .filter((t) => t.name.trim())
    .reduce((sum, t) => sum + TIER_POINTS[t.tier], 0);
  const counts = TIER_OPTIONS.reduce(
    (acc, tier) => {
      acc[tier] = tasks.filter((t) => t.tier === tier && t.name.trim()).length;
      return acc;
    },
    {} as Record<Tier, number>,
  );

  return (
    <section className="relative flex-1 flex items-start justify-center px-6 py-8 overflow-y-auto">
      <div className="w-full max-w-[760px] mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="relative hairline rounded-[3px] bg-ink-100/60 p-5">
          <ViewfinderMarks inset={6} opacity={0.4} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="label-eyebrow accent">PARSED · REVIEW</div>
              <div className="font-display text-xl text-cream-bright mt-1">
                confirm targets · {tasks.filter((t) => t.name.trim()).length} loaded
              </div>
              <div className="mono text-[11px] text-muted mt-1.5">
                rename, re-tier, reorder, or remove. lock in when ready.
              </div>
            </div>
            <div className="mono text-right">
              <div className="text-[10px] label-eyebrow">EST POINTS</div>
              <div className="text-[20px] text-[rgb(var(--accent-rgb))] accent-text-glow">
                {totalPoints}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 mono text-[10px] tracking-widest2 uppercase text-muted">
            {TIER_OPTIONS.map((t) => (
              <span key={t} className={counts[t] === 0 ? "opacity-40" : ""}>
                <span className={`tier-dot tier-${t} mr-1.5`} />
                {t === "STANDARD" ? "STD" : t === "CRITICAL" ? "CRIT" : t} · {counts[t]}
              </span>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {tasks.map((t, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, delay: i * 0.02 }}
                className="group grid grid-cols-[18px_minmax(0,1fr)_auto_auto_auto] items-center gap-3 hairline rounded-[3px] bg-ink-100/55 px-4 py-2.5 hover:bg-ink-100/80"
              >
                <span className={`tier-dot tier-${t.tier}`} />

                {editing === i ? (
                  <input
                    autoFocus
                    value={t.name}
                    onChange={(e) => updateTask(i, { name: e.target.value })}
                    onBlur={() => setEditing(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape")
                        (e.target as HTMLInputElement).blur();
                    }}
                    className="font-display text-[14.5px] font-medium text-cream-bright bg-transparent border-b border-[rgb(var(--accent-rgb)/0.4)] outline-none pb-px"
                  />
                ) : (
                  <button
                    onClick={() => setEditing(i)}
                    className="text-left font-display text-[14.5px] font-medium text-cream-bright truncate hover:text-[rgb(var(--accent-rgb))] transition-colors"
                    title="Click to rename"
                  >
                    {t.name || (
                      <span className="text-muted-deep italic">untitled</span>
                    )}
                  </button>
                )}

                <span className="mono text-[10px] tracking-wider text-cream-dim">
                  {t.time_block || ""}
                </span>

                {/* Tier swap */}
                <div className="relative">
                  <button
                    onClick={() => setTierMenuFor(tierMenuFor === i ? null : i)}
                    className={`mono text-[10px] tracking-widest2 uppercase px-2 py-1 rounded-[2px] border border-white/[0.08]
                                hover:border-white/30 transition-colors
                                ${t.tier === "CRITICAL"
                                  ? "text-tier-critical"
                                  : t.tier === "HIGH"
                                    ? "text-tier-high"
                                    : "text-cream-dim"}`}
                  >
                    {TIER_LABEL[t.tier]} · {TIER_POINTS[t.tier]}
                  </button>
                  <AnimatePresence>
                    {tierMenuFor === i && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute right-0 z-30 mt-1 hairline rounded-[3px] bg-ink-100 backdrop-blur-md p-1 flex flex-col min-w-[140px]"
                      >
                        {TIER_OPTIONS.map((tier) => (
                          <button
                            key={tier}
                            className="text-left px-2 py-1 mono text-[10px] tracking-widest2 uppercase hover:bg-white/[0.05] text-cream-dim hover:text-cream-bright"
                            onClick={() => {
                              updateTask(i, { tier });
                              setTierMenuFor(null);
                            }}
                          >
                            <span className={`tier-dot tier-${tier} mr-2`} />
                            {tier} · {TIER_POINTS[tier]}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Reorder / remove */}
                <div className="flex items-center gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveTask(i, -1)}
                    disabled={i === 0}
                    className="text-muted hover:text-cream-bright px-1 disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveTask(i, 1)}
                    disabled={i === tasks.length - 1}
                    className="text-muted hover:text-cream-bright px-1 disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeTask(i)}
                    className="text-muted-deep hover:text-tier-critical px-1"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <button
            onClick={addBlank}
            className="mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim py-2 hairline rounded-[3px] hover:border-white/20 transition-colors"
          >
            + add another
          </button>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={onCancel}
            className="mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim px-3 py-2.5"
          >
            ← discard
          </button>
          <button
            onClick={deploy}
            disabled={deploying || tasks.filter((t) => t.name.trim()).length === 0}
            className="mono text-[12px] tracking-widest2 uppercase px-6 py-2.5 border-2 border-[rgb(var(--accent-rgb)/0.6)]
                       text-[rgb(var(--accent-rgb))] bg-[rgb(var(--accent-rgb)/0.04)] rounded-[2px]
                       hover:bg-[rgb(var(--accent-rgb)/0.1)] hover:border-[rgb(var(--accent-rgb)/0.9)]
                       hover:shadow-[0_0_32px_-4px_rgb(var(--accent-rgb)/0.6)]
                       disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            {deploying ? "deploying…" : "DEPLOY · LOCK IN"}
          </button>
        </div>
      </div>
    </section>
  );
}

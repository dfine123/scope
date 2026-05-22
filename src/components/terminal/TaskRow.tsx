import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Task, Tier } from "../../types";
import { useScope } from "../../store/scopeStore";
import { Timer } from "../ui/Timer";
import { StreakBadge } from "../ui/StreakBadge";
import { LockOnReticle } from "../ui/Reticle";
import { useFx } from "../animations/FX";
import { formatMinutes } from "../../lib/time";

const TIER_LABEL: Record<Tier, string> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  STANDARD: "STD",
  LOW: "LOW",
};

const TIER_OPTIONS: Tier[] = ["CRITICAL", "HIGH", "STANDARD", "LOW"];

const TIER_BORDER: Record<Tier, string> = {
  CRITICAL:
    "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-[rgb(var(--accent-rgb))]",
  HIGH:
    "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[rgb(var(--accent-rgb)/0.7)]",
  STANDARD:
    "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-[rgb(var(--accent-rgb)/0.4)]",
  LOW: "",
};

const TIER_PAD: Record<Tier, string> = {
  CRITICAL: "py-4",
  HIGH: "py-3.5",
  STANDARD: "py-3",
  LOW: "py-2.5",
};

const TIER_TITLE: Record<Tier, string> = {
  CRITICAL: "font-semibold text-[15.5px]",
  HIGH: "font-medium text-[15px]",
  STANDARD: "font-medium text-[14.5px]",
  LOW: "font-normal text-[14px] text-cream-dim",
};

interface Props {
  task: Task;
  index: number;
  anyActive: boolean;
}

export function TaskRow({ task, index, anyActive }: Props) {
  const active = task.status === "ACTIVE";
  const done = task.status === "DONE";
  const skipped = task.status === "SKIPPED";
  const startTask = useScope((s) => s.startTask);
  const stopTask = useScope((s) => s.stopTask);
  const completeTask = useScope((s) => s.completeTask);
  const skipTask = useScope((s) => s.skipTask);
  const renameTask = useScope((s) => s.renameTask);
  const retierTask = useScope((s) => s.retierTask);
  const deleteTask = useScope((s) => s.deleteTask);
  const { burst, ripple } = useFx();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(task.name);
  const [tierMenu, setTierMenu] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const onComplete = async (ev?: React.MouseEvent) => {
    if (done) return;
    if (ev && rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      const cx = ev.clientX;
      const cy = ev.clientY;
      ripple(cx, cy);
      burst(cx, rect.top + 14, `+${Math.round(task.base_points * task.streak_multiplier)}`);
    }
    await completeTask(task.id);
  };

  const onToggleRun = () => {
    if (done) return;
    if (active) stopTask(task.id);
    else startTask(task.id);
  };

  const awarded = done
    ? task.awarded_points
    : Math.round(task.base_points * task.streak_multiplier);

  const dim = anyActive && !active && !done && !skipped;
  const completedDim = done || skipped;

  return (
    <motion.div
      ref={rowRef}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.025, duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative grid grid-cols-[22px_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-4
                  pl-5 pr-4 ${TIER_PAD[task.tier]} rounded-[3px] border
                  ${active
                    ? "bg-[rgb(var(--accent-rgb)/0.05)] row-active border-[rgb(var(--accent-rgb)/0.5)]"
                    : "bg-ink-100/55 border-white/[0.06] hover:border-white/[0.14]"}
                  ${completedDim ? "opacity-50" : dim ? "opacity-60" : "opacity-100"}
                  ${TIER_BORDER[task.tier]}
                  transition-[opacity,border-color] duration-200`}
    >
      {/* Lock-on indicator or tier dot */}
      <div className="flex items-center justify-center w-5 h-5">
        {active ? (
          <LockOnReticle size={16} />
        ) : (
          <span className={`tier-dot tier-${task.tier}`} />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-baseline gap-3">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={async () => {
                setEditing(false);
                if (name.trim() && name.trim() !== task.name) {
                  await renameTask(task.id, name.trim());
                } else {
                  setName(task.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setName(task.name);
                  setEditing(false);
                }
              }}
              className="font-display font-medium text-cream-bright bg-transparent border-b border-[rgb(var(--accent-rgb)/0.4)] outline-none w-full pb-px text-[15px]"
            />
          ) : (
            <span
              onDoubleClick={() => !done && setEditing(true)}
              className={`font-display ${TIER_TITLE[task.tier]} text-cream-bright truncate
                          ${done ? "strike-sweep" : ""}`}
              title="Double-click to rename"
            >
              {task.name}
            </span>
          )}
          <StreakBadge streak={task.streak_count} multiplier={task.streak_multiplier} compact />
        </div>
        <div className="mt-1 flex items-center gap-3 mono text-[10px] tracking-wider text-muted">
          <span className="relative">
            <button
              onClick={() => !done && setTierMenu((v) => !v)}
              className={`uppercase tracking-widest2 hover:text-cream-bright ${
                task.tier === "CRITICAL"
                  ? "text-tier-critical"
                  : task.tier === "HIGH"
                    ? "text-tier-high"
                    : "text-cream-dim"
              }`}
            >
              {TIER_LABEL[task.tier]}
            </button>
            <AnimatePresence>
              {tierMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-30 mt-1.5 left-0 hairline rounded-[3px] bg-ink-100 backdrop-blur-md p-1 flex flex-col min-w-[120px]"
                >
                  {TIER_OPTIONS.map((tier) => (
                    <button
                      key={tier}
                      className="text-left px-2 py-1 mono text-[10px] tracking-widest2 uppercase hover:bg-white/[0.05] text-cream-dim hover:text-cream-bright"
                      onClick={async () => {
                        setTierMenu(false);
                        await retierTask(task.id, tier);
                      }}
                    >
                      <span className={`tier-dot tier-${tier} mr-2`} />
                      {tier}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </span>
          {task.time_block && <span className="text-cream-dim">· {task.time_block}</span>}
          <span>· {task.base_points}pt base</span>
          {task.elapsed_ms > 0 && <span>· {formatMinutes(task.elapsed_ms)} logged</span>}
        </div>
      </div>

      {/* Timer */}
      <div className="mono text-right">
        <div className="text-[10px] label-eyebrow">ELAPSED</div>
        <Timer
          taskId={task.id}
          baseElapsedMs={task.elapsed_ms}
          active={active}
          className="text-[14px]"
        />
      </div>

      {/* Points */}
      <div className="mono text-right">
        <div className={`text-[10px] label-eyebrow ${done ? "text-[rgb(var(--accent-rgb))]" : ""}`}>
          {done ? "BANKED" : "PTS"}
        </div>
        <div
          className={`mono text-[14px] ${
            done ? "text-[rgb(var(--accent-rgb))] accent-text-glow" : "text-cream-dim"
          }`}
        >
          {done ? "+" : ""}{awarded}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {!done && !skipped && (
          <button
            onClick={onToggleRun}
            className={`mono text-[10px] tracking-widest2 uppercase px-2.5 py-1 border rounded-[2px]
                        ${active
                          ? "border-[rgb(var(--accent-rgb)/0.6)] text-[rgb(var(--accent-rgb))] flare"
                          : "border-white/10 text-cream-dim hover:text-cream-bright hover:border-white/30 hover:flare"}`}
            title="Start / stop"
          >
            {active ? "STOP" : "START"}
          </button>
        )}
        {!done && !skipped && (
          <button
            onClick={onComplete}
            className="mono text-[10px] tracking-widest2 uppercase px-2.5 py-1 border border-[rgb(var(--accent-rgb)/0.35)]
                       text-[rgb(var(--accent-rgb))] rounded-[2px]
                       hover:bg-[rgb(var(--accent-rgb)/0.08)] hover:border-[rgb(var(--accent-rgb)/0.7)]"
          >
            DONE
          </button>
        )}
        {!done && !skipped && (
          <button
            onClick={() => skipTask(task.id)}
            className="mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim px-1"
            title="Skip"
          >
            SKIP
          </button>
        )}
        <button
          onClick={() => deleteTask(task.id)}
          className="mono text-[10px] text-muted-deep hover:text-tier-critical opacity-0 group-hover:opacity-100 transition-opacity px-1"
          title="Delete"
        >
          ✕
        </button>
      </div>

      {/* Status pill */}
      <div className="flex items-center justify-end min-w-[68px]">
        <span
          className={`mono text-[9px] tracking-widest2 uppercase px-1.5 py-0.5 rounded-[2px] border
                      ${active
                        ? "border-[rgb(var(--accent-rgb)/0.6)] text-[rgb(var(--accent-rgb))] bg-[rgb(var(--accent-rgb)/0.08)]"
                        : done
                          ? "border-[rgb(var(--accent-rgb)/0.3)] text-[rgb(var(--accent-rgb)/0.85)]"
                          : skipped
                            ? "border-muted-deep text-muted"
                            : "border-white/[0.08] text-muted"}`}
        >
          {task.status}
        </span>
      </div>
    </motion.div>
  );
}

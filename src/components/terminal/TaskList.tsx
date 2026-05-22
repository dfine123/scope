import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useScope } from "../../store/scopeStore";
import { TaskRow } from "./TaskRow";
import type { Tier } from "../../types";
import { ViewfinderMarks } from "../ui/ViewfinderMarks";

const QUICK_TIERS: Tier[] = ["CRITICAL", "HIGH", "STANDARD", "LOW"];

export function TaskList() {
  const tasks = useScope((s) => s.tasks);
  const addTask = useScope((s) => s.addTask);
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState<Tier>("STANDARD");

  const onAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    await addTask({ name, tier: newTier });
    setNewName("");
  };

  return (
    <section className="relative flex-1 min-h-0 px-8 pb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">QUEUE</span>
          <span className="mono text-[11px] text-cream-dim">
            {tasks.length === 0 ? "empty — upload schedule or add manually" : `${tasks.length} tasks loaded`}
          </span>
        </div>
        <div className="flex items-center gap-3 mono text-[10px] tracking-widest2 uppercase text-muted">
          <span>
            <span className="tier-dot tier-CRITICAL mr-1.5" />
            CRITICAL · 200
          </span>
          <span>
            <span className="tier-dot tier-HIGH mr-1.5" />
            HIGH · 120
          </span>
          <span>
            <span className="tier-dot tier-STANDARD mr-1.5" />
            STANDARD · 60
          </span>
          <span>
            <span className="tier-dot tier-LOW mr-1.5" />
            LOW · 30
          </span>
        </div>
      </div>

      <div className="relative h-full flex flex-col">
        <div className="relative flex-1 min-h-0 overflow-y-auto pr-1">
          <ViewfinderMarks inset={-2} opacity={0.25} />
          <div className="flex flex-col gap-1.5 py-1">
            <AnimatePresence initial={false}>
              {tasks.map((t, i) => (
                <TaskRow key={t.id} task={t} index={i} />
              ))}
            </AnimatePresence>
            {tasks.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hairline rounded-[3px] py-12 text-center mono text-[11px] tracking-widest2 uppercase text-muted"
              >
                no targets acquired
              </motion.div>
            )}
          </div>
        </div>

        {/* Inline quick-add */}
        <div className="mt-3 flex items-center gap-2 hairline rounded-[3px] px-3 py-2 bg-ink-100/40">
          <span className="mono text-[10px] tracking-widest2 uppercase text-muted">+</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            placeholder="add task — press enter"
            className="flex-1 font-display text-[14px] text-cream-bright placeholder:text-muted-deep py-1"
          />
          <div className="flex items-center gap-1">
            {QUICK_TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setNewTier(t)}
                className={`mono text-[10px] tracking-widest2 uppercase px-1.5 py-0.5 rounded-[2px]
                            ${newTier === t ? "text-cream-bright bg-white/[0.06] border border-white/[0.12]" : "text-muted hover:text-cream-dim border border-transparent"}`}
              >
                <span className={`tier-dot tier-${t} mr-1.5`} />
                {t === "STANDARD" ? "STD" : t === "CRITICAL" ? "CRIT" : t}
              </button>
            ))}
          </div>
          <button
            onClick={onAdd}
            disabled={!newName.trim()}
            className="mono text-[10px] tracking-widest2 uppercase px-2.5 py-1 border border-[rgb(var(--accent-rgb)/0.4)] text-[rgb(var(--accent-rgb))] rounded-[2px] hover:bg-[rgb(var(--accent-rgb)/0.08)] disabled:opacity-30"
          >
            QUEUE
          </button>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Tier } from "../../types";
import { useScope } from "../../store/scopeStore";
import { ViewfinderMarks } from "../ui/ViewfinderMarks";

interface Props {
  quickAddOpen: boolean;
  setQuickAddOpen: (v: boolean) => void;
}

const QUICK_TIERS: Tier[] = ["CRITICAL", "HIGH", "STANDARD", "LOW"];
const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
const modSymbol = isMac ? "⌘" : "Ctrl";

export function Footer({ quickAddOpen, setQuickAddOpen }: Props) {
  const day = useScope((s) => s.day);
  const operatorName = useScope((s) => s.operatorName);
  const addTask = useScope((s) => s.addTask);

  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState<Tier>("STANDARD");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickAddOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [quickAddOpen]);

  const onAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    await addTask({ name, tier: newTier });
    setNewName("");
  };

  if (!day) return null;

  return (
    <div className="relative">
      <ViewfinderMarks inset={4} opacity={0.15} />

      <AnimatePresence>
        {quickAddOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="px-8 pb-3"
          >
            <div className="max-w-[1040px] mx-auto hairline rounded-[3px] bg-ink-100/60 px-3 py-2 flex items-center gap-2">
              <span className="mono text-[10px] tracking-widest2 uppercase text-muted">+</span>
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAdd();
                  if (e.key === "Escape") setQuickAddOpen(false);
                }}
                placeholder="queue a task — press enter"
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
              <button
                onClick={() => setQuickAddOpen(false)}
                className="mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim px-1.5"
              >
                ESC
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-8 py-3 border-t border-white/[0.04] grid grid-cols-3 items-center mono text-[10px] tracking-widest2 uppercase text-muted">
        {/* Left — branding */}
        <div className="flex items-center gap-2 truncate">
          <span>SCOPE</span>
          <span className="text-muted-deep">·</span>
          <span className="text-cream-dim truncate">
            {operatorName ? `${operatorName}'s console` : "operator console"}
          </span>
        </div>

        {/* Center — quick add toggle */}
        <div className="flex items-center justify-center">
          <button
            onClick={() => setQuickAddOpen(!quickAddOpen)}
            className={`px-3 py-1 border rounded-[2px] transition-all flex items-center gap-2
                        ${quickAddOpen
                          ? "border-[rgb(var(--accent-rgb)/0.5)] text-[rgb(var(--accent-rgb))]"
                          : "border-white/10 text-cream-dim hover:text-cream-bright hover:border-white/30"}`}
          >
            <span className="font-mono text-base leading-none">+</span>
            <span>add task</span>
          </button>
        </div>

        {/* Right — keyboard hints */}
        <div className="flex items-center justify-end gap-3 text-[10px]">
          <Shortcut keys={[modSymbol, "N"]} label="new" />
          <Shortcut keys={["SPACE"]} label="run/stop" />
          <Shortcut keys={[modSymbol, "E"]} label="end day" />
        </div>
      </div>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5">
        {keys.map((k, i) => (
          <span
            key={i}
            className="px-1.5 py-0.5 hairline rounded-[2px] text-[9px] text-cream-dim mono"
          >
            {k}
          </span>
        ))}
      </span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

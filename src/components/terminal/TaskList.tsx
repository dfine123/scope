import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useScope } from "../../store/scopeStore";
import { TaskRow } from "./TaskRow";

export function TaskList() {
  const tasks = useScope((s) => s.tasks);
  const activeTaskId = useScope((s) => s.activeTaskId);

  const { live, done } = useMemo(() => {
    const live = tasks.filter((t) => t.status === "QUEUED" || t.status === "ACTIVE");
    const done = tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED");
    return { live, done };
  }, [tasks]);

  const [doneOpen, setDoneOpen] = useState(false);
  const anyActive = activeTaskId !== null;

  return (
    <section className="relative flex-1 min-h-0 px-6 md:px-8 pb-2 overflow-y-auto">
      <div className="mx-auto max-w-[1040px] py-3">
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {live.map((t, i) => (
              <TaskRow key={t.id} task={t} index={i} anyActive={anyActive} />
            ))}
          </AnimatePresence>
        </div>

        {done.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setDoneOpen((v) => !v)}
              className="w-full flex items-center justify-center gap-3 py-2 mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim transition-colors"
            >
              <span className="flex-1 h-px bg-white/[0.05]" />
              <span className="flex items-center gap-2">
                <span className={`transition-transform duration-200 ${doneOpen ? "rotate-90" : ""}`}>
                  ▸
                </span>
                done ({done.length})
              </span>
              <span className="flex-1 h-px bg-white/[0.05]" />
            </button>

            <AnimatePresence initial={false}>
              {doneOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-2 pt-3">
                    {done.map((t, i) => (
                      <TaskRow key={t.id} task={t} index={i} anyActive={anyActive} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

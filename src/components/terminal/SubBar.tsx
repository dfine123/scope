import { useMemo } from "react";
import { useScope } from "../../store/scopeStore";

interface Props {
  onSettings: () => void;
  onEndDay: () => void;
  onLock: () => void;
}

type Status = "INTAKE" | "RUNNING" | "PAUSED" | "CLEAR";

export function SubBar({ onSettings, onEndDay, onLock }: Props) {
  const tasks = useScope((s) => s.tasks);
  const activeTaskId = useScope((s) => s.activeTaskId);

  const { status, statusTone, canEndDay, endDayProminent } = useMemo(() => {
    const hasTasks = tasks.length > 0;
    const active = activeTaskId !== null;
    const remaining = tasks.filter((t) => t.status === "QUEUED").length;
    const allCleared =
      hasTasks && tasks.every((t) => t.status === "DONE" || t.status === "SKIPPED");

    let s: Status;
    if (!hasTasks) s = "INTAKE";
    else if (allCleared) s = "CLEAR";
    else if (active) s = "RUNNING";
    else s = "PAUSED";

    // Late-in-day: after 19:00 local, end-day pulses.
    const hour = new Date().getHours();
    const late = hour >= 19;

    return {
      status: s,
      statusTone: s,
      canEndDay: hasTasks,
      endDayProminent: allCleared || late,
    };
  }, [tasks, activeTaskId]);

  return (
    <div className="px-8 py-2.5 flex items-center justify-between text-[10px] tracking-widest2 uppercase mono">
      {/* Left — status */}
      <div className="flex items-center gap-2.5">
        <span
          className={`w-1.5 h-1.5 rounded-full transition-all duration-200
                      ${statusTone === "RUNNING"
                        ? "bg-[rgb(var(--accent-rgb))] shadow-[0_0_8px_rgb(var(--accent-rgb)/0.8)] animate-breathe"
                        : statusTone === "CLEAR"
                          ? "bg-[rgb(var(--accent-rgb))] shadow-[0_0_8px_rgb(var(--accent-rgb)/0.8)]"
                          : statusTone === "PAUSED"
                            ? "bg-tier-high"
                            : "bg-muted"}`}
        />
        <span
          className={`${
            statusTone === "RUNNING" || statusTone === "CLEAR"
              ? "text-[rgb(var(--accent-rgb))]"
              : statusTone === "PAUSED"
                ? "text-tier-high"
                : "text-muted"
          }`}
        >
          {status}
        </span>
        {status === "RUNNING" && (
          <span className="text-muted-deep">·</span>
        )}
        {status === "RUNNING" && (
          <span className="text-cream-dim normal-case tracking-normal text-[11px]">
            timer active
          </span>
        )}
      </div>

      {/* Right — contextual actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onSettings}
          className="text-muted hover:text-cream-dim px-2 py-1 transition-colors"
        >
          SETTINGS
        </button>
        <span className="text-muted-deep">·</span>
        <button
          onClick={onLock}
          className="text-muted hover:text-cream-dim px-2 py-1 transition-colors"
        >
          LOCK
        </button>
        <span className="text-muted-deep">·</span>
        <button
          onClick={onEndDay}
          disabled={!canEndDay}
          className={`px-3 py-1 rounded-[2px] border transition-all
                      ${endDayProminent
                        ? "border-[rgb(var(--accent-rgb)/0.7)] text-[rgb(var(--accent-rgb))] bg-[rgb(var(--accent-rgb)/0.04)] animate-[pulseGlow_2.4s_ease-in-out_infinite]"
                        : "border-transparent text-muted hover:text-cream-dim hover:border-white/15"} disabled:opacity-30 disabled:pointer-events-none`}
        >
          END DAY
        </button>
      </div>
    </div>
  );
}

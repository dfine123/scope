import { useEffect, useState } from "react";
import { useScope } from "../../store/scopeStore";
import { PointsDisplay } from "./PointsDisplay";
import { formatClock } from "../../lib/time";
import { useTick } from "../../hooks/useTick";

export function Header() {
  useTick(15000);
  const day = useScope((s) => s.day);
  const tasks = useScope((s) => s.tasks);
  const [now, setNow] = useState(formatClock());
  useEffect(() => {
    const id = setInterval(() => setNow(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!day) return null;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const total = tasks.length;
  const streakActive = tasks.filter((t) => t.streak_count > 1).length;
  const motto = day.motto?.trim() || "—";
  const accentLabel = day.accent_label;

  return (
    <header className="relative z-10 px-8 pt-6 pb-5">
      {/* Hairline crosshair geometry */}
      <div className="absolute left-8 right-8 top-[44px] h-px bg-white/[0.04]" />
      <div className="absolute top-6 bottom-5 left-1/2 -translate-x-1/2 w-px bg-white/[0.02]" />

      <div className="flex items-start justify-between gap-8">
        {/* Left — day number + date */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <span className="label-eyebrow">DAY</span>
            <span className="font-display text-3xl font-semibold text-cream-bright tracking-tight">
              {String(day.day_number).padStart(3, "0")}
            </span>
            <span className="mono text-xs text-muted ml-2">{day.date}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="label-eyebrow">LOCAL</span>
            <span className="mono text-xs text-cream-dim">{now}</span>
            <span className="text-muted-deep">·</span>
            <span className="label-eyebrow">STATUS</span>
            <span className="mono text-[10px] text-[rgb(var(--accent-rgb))] tracking-widest2 uppercase">
              {day.status === "OPEN" ? "RUNNING" : "CLOSED"}
            </span>
          </div>
        </div>

        {/* Center — motto */}
        <div className="flex-1 flex flex-col items-center justify-start pt-1">
          <span className="label-eyebrow">MOTTO</span>
          <div
            className="font-display text-xl md:text-[22px] font-medium text-cream-bright mt-1.5 motto-breath text-center"
            style={{ letterSpacing: "-0.005em" }}
          >
            {motto}
          </div>
          {accentLabel && (
            <span className="mono text-[10px] text-muted tracking-widest2 uppercase mt-1.5">
              accent · {accentLabel}
            </span>
          )}
        </div>

        {/* Right — points + counters */}
        <div className="flex flex-col items-end">
          <PointsDisplay value={day.total_points} />
          <div className="mt-1.5 flex items-center gap-4 mono text-[11px] text-cream-dim">
            <span>
              <span className="text-muted label-eyebrow mr-1.5">DONE</span>
              {done}/{total}
            </span>
            <span className="text-muted-deep">·</span>
            <span>
              <span className="text-muted label-eyebrow mr-1.5">STREAKS</span>
              {streakActive}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

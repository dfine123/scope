import { useEffect, useState } from "react";
import { useScope } from "../../store/scopeStore";
import { PointsDisplay } from "./PointsDisplay";
import { formatClock } from "../../lib/time";

export function Header() {
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
  const activeStreaks = tasks.filter((t) => t.streak_count > 1).length;
  const motto = day.motto?.trim() || null;

  return (
    <header className="relative z-10">
      <div className="px-8 pt-6 pb-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-8">
          {/* LEFT — day number with date/time stacked secondary */}
          <div className="flex items-baseline gap-3">
            <span className="label-eyebrow">DAY</span>
            <span className="font-display text-3xl font-semibold text-cream-bright tracking-tight leading-none">
              {String(day.day_number).padStart(3, "0")}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="mono text-[11px] text-cream-dim">{day.date}</span>
              <span className="mono text-[10px] text-muted">{now}</span>
            </div>
          </div>

          {/* CENTER — motto, hero */}
          <div className="flex flex-col items-center min-w-0 px-4">
            {motto ? (
              <div
                className="font-display text-[22px] md:text-[26px] font-medium text-cream-bright motto-breath
                           text-center truncate max-w-full"
                style={{ letterSpacing: "-0.005em" }}
                title={motto}
              >
                {motto}
              </div>
            ) : (
              <div className="font-display text-[18px] text-muted-deep italic">
                no motto set
              </div>
            )}
            {day.accent_label && (
              <span className="mono text-[10px] text-muted tracking-widest2 uppercase mt-1.5">
                accent · {day.accent_label}
              </span>
            )}
          </div>

          {/* RIGHT — points + done + streaks */}
          <div className="flex flex-col items-end gap-1">
            <PointsDisplay value={day.total_points} />
            <div className="flex items-center gap-3 mono text-[11px] text-cream-dim">
              <span className="flex items-baseline gap-1.5">
                <span className="text-cream-bright font-medium">{done}</span>
                <span className="text-muted-deep">/</span>
                <span>{total}</span>
                <span className="label-eyebrow ml-1">done</span>
              </span>
              {activeStreaks > 0 && (
                <>
                  <span className="text-muted-deep">·</span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[rgb(var(--accent-rgb))]" style={{ textShadow: "0 0 8px rgb(var(--accent-rgb) / 0.6)" }}>
                      ⚡
                    </span>
                    <span className="text-cream-bright font-medium">{activeStreaks}</span>
                    <span className="label-eyebrow">streaks</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Faint horizontal rule separating header from sub-bar */}
      <div className="mx-8 h-px bg-white/[0.04]" />
    </header>
  );
}

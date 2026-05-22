import { useScope } from "../../store/scopeStore";
import { useTick } from "../../hooks/useTick";
import { formatElapsed } from "../../lib/time";

interface Props {
  taskId: string;
  baseElapsedMs: number;
  active: boolean;
  className?: string;
}

export function Timer({ taskId, baseElapsedMs, active, className = "" }: Props) {
  useTick(1000);
  const startedAt = useScope((s) =>
    s.activeTaskId === taskId ? s.activeStartedAt : null,
  );
  const liveMs = active && startedAt ? Date.now() - startedAt : 0;
  const total = baseElapsedMs + Math.max(0, liveMs);
  return (
    <span className={`mono ${active ? "timer-active" : "text-cream-dim"} ${className}`}>
      {formatElapsed(total)}
    </span>
  );
}

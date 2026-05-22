import { useEffect, useState } from "react";

// Re-render at a steady cadence (default 1s) — used by live timer displays.
export function useTick(intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

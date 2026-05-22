import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function PointsDisplay({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    // Tween value over ~480ms for the odometer roll.
    const start = prev.current;
    const delta = value - start;
    const duration = 520;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(start + delta * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    prev.current = value;
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="flex items-baseline gap-1.5">
      <AnimatePresence mode="popLayout">
        <motion.span
          key="pts"
          className="mono text-2xl font-medium accent-text-glow text-[rgb(var(--accent-rgb))]"
        >
          {displayed.toLocaleString()}
        </motion.span>
      </AnimatePresence>
      <span className="label-eyebrow">pts</span>
    </div>
  );
}

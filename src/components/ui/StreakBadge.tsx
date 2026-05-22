import { motion } from "framer-motion";

interface Props {
  streak: number;
  multiplier: number;
  compact?: boolean;
}

export function StreakBadge({ streak, multiplier, compact = false }: Props) {
  if (streak <= 1) return null;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mono inline-flex items-center gap-1 text-[10px] tracking-widest2 uppercase
                 text-[rgb(var(--accent-rgb))] px-1.5 py-[1px]
                 border border-[rgb(var(--accent-rgb)/0.35)] rounded-[2px]
                 bg-[rgb(var(--accent-rgb)/0.06)]"
      style={{ textShadow: "0 0 10px rgb(var(--accent-rgb) / 0.55)" }}
    >
      <span>×{multiplier.toFixed(1)}</span>
      {!compact && <span className="opacity-70">·</span>}
      {!compact && <span>{streak}d</span>}
    </motion.span>
  );
}

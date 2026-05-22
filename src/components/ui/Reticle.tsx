import { motion } from "framer-motion";

export function Reticle({ size = 18, spin = true }: { size?: number; spin?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={spin ? "reticle-spin" : ""}
      style={{ color: "rgb(var(--accent-rgb))" }}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <line x1="12" y1="1" x2="12" y2="6" stroke="currentColor" strokeWidth="1" />
      <line x1="12" y1="18" x2="12" y2="23" stroke="currentColor" strokeWidth="1" />
      <line x1="1" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1" />
      <line x1="18" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function LockOnReticle({ size = 14 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      initial={{ scale: 1.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      style={{ color: "rgb(var(--accent-rgb))" }}
    >
      <line x1="12" y1="2" x2="12" y2="8" stroke="currentColor" strokeWidth="1.2" />
      <line x1="12" y1="16" x2="12" y2="22" stroke="currentColor" strokeWidth="1.2" />
      <line x1="2" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="1.2" />
      <line x1="16" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </motion.svg>
  );
}

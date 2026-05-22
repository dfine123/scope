import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface FxItem {
  id: number;
  x: number;
  y: number;
  label: string;
}

interface FxContextValue {
  burst: (x: number, y: number, label: string) => void;
  ripple: (x: number, y: number) => void;
}

const FxContext = createContext<FxContextValue | null>(null);

export function FxProvider({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<FxItem[]>([]);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const burst = useCallback((x: number, y: number, label: string) => {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, x, y, label }]);
    setTimeout(() => setBursts((b) => b.filter((it) => it.id !== id)), 1200);
  }, []);
  const ripple = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x, y }]);
    setTimeout(() => setRipples((r) => r.filter((it) => it.id !== id)), 800);
  }, []);
  return (
    <FxContext.Provider value={{ burst, ripple }}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[100]">
        <AnimatePresence>
          {bursts.map((b) => (
            <div
              key={b.id}
              className="points-float"
              style={{ left: b.x, top: b.y }}
            >
              {b.label}
            </div>
          ))}
        </AnimatePresence>
        {ripples.map((r) => (
          <div
            key={r.id}
            className="ripple"
            style={{ left: r.x - 60, top: r.y - 60, width: 120, height: 120 }}
          />
        ))}
      </div>
    </FxContext.Provider>
  );
}

export function useFx() {
  const ctx = useContext(FxContext);
  if (!ctx) throw new Error("useFx outside FxProvider");
  return ctx;
}

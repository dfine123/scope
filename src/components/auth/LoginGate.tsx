import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reticle } from "../ui/Reticle";
import { ViewfinderMarks } from "../ui/ViewfinderMarks";
import { bridge } from "../../services/bridge";

interface Props {
  onAuthed: () => void;
}

export function LoginGate({ onAuthed }: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = async (d: string) => {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setBusy(true);
      try {
        await bridge.auth.login(next);
        onAuthed();
      } catch {
        setShake(true);
        setTimeout(() => {
          setPin("");
          setBusy(false);
          setShake(false);
        }, 600);
      }
    }
  };

  const handleBack = () => {
    if (!busy) setPin((p) => p.slice(0, -1));
  };

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "⌫"],
  ];

  return (
    <div className="app-shell relative flex items-center justify-center h-screen px-6">
      <div className="app-bg" />
      <div className="app-noise" />
      <div className="app-scanline" />
      <div className="app-vignette" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-xs"
      >
        <div className="hairline rounded-[3px] bg-ink-100/80 backdrop-blur-md p-8">
          <ViewfinderMarks inset={8} opacity={0.45} />

          <div className="flex items-center gap-3 mb-7">
            <Reticle size={22} spin={false} />
            <div>
              <div className="label-eyebrow accent">SCOPE</div>
              <div className="font-display text-lg text-cream-bright mt-0.5">enter passcode</div>
            </div>
          </div>

          {/* PIN dots */}
          <motion.div
            animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.35 }}
            className="flex justify-center gap-4 mb-6"
          >
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={
                  i < pin.length
                    ? { scale: [1, 1.25, 1], opacity: 1 }
                    : { scale: 1, opacity: 1 }
                }
                transition={{ duration: 0.15 }}
                className={`w-4 h-4 rounded-full border transition-all duration-100 ${
                  i < pin.length
                    ? shake
                      ? "bg-tier-critical border-tier-critical shadow-[0_0_12px_#FF4D4D]"
                      : "bg-[rgb(var(--accent-rgb))] border-[rgb(var(--accent-rgb))] shadow-[0_0_12px_rgb(var(--accent-rgb)/0.7)]"
                    : "bg-transparent border-white/20"
                }`}
              />
            ))}
          </motion.div>

          {/* Numpad */}
          <div className="flex flex-col gap-2">
            {keys.map((row, r) => (
              <div key={r} className="grid grid-cols-3 gap-2">
                {row.map((k, c) => (
                  <button
                    key={c}
                    onClick={() => {
                      if (k === "⌫") handleBack();
                      else if (k) handleDigit(k);
                    }}
                    disabled={!k || busy}
                    className={`py-3 rounded-[2px] mono text-base font-medium transition-all duration-100
                                ${!k ? "invisible" : "hairline text-cream hover:bg-white/[0.05] hover:text-cream-bright active:scale-95 active:bg-[rgb(var(--accent-rgb)/0.08)] disabled:opacity-40"}`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 mono text-[10px] tracking-widest2 uppercase text-muted text-center">
          single-operator console · session 30d
        </div>
      </motion.div>
    </div>
  );
}

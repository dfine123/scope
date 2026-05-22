import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reticle } from "../ui/Reticle";
import { useScope } from "../../store/scopeStore";
import { bridge } from "../../services/bridge";
import type { ParsedTask, Tier } from "../../types";

interface Props {
  onParsed: (tasks: ParsedTask[]) => void;
}

const QUICK_TIERS: Tier[] = ["CRITICAL", "HIGH", "STANDARD", "LOW"];

export function IntakeScreen({ onParsed }: Props) {
  const day = useScope((s) => s.day);
  const operatorName = useScope((s) => s.operatorName);
  const hasApiKey = useScope((s) => s.hasApiKey);
  const addTask = useScope((s) => s.addTask);

  const inputRef = useRef<HTMLInputElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualTier, setManualTier] = useState<Tier>("STANDARD");

  const handleFile = async (file: File) => {
    setErr(null);
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      setPreview(dataUrl);
      if (!hasApiKey) {
        throw new Error("Add your Anthropic API key in Settings to enable vision parsing.");
      }
      const parsed = await bridge.ai.parseSchedule(dataUrl);
      if (!parsed.length) throw new Error("No tasks detected. Try a clearer photo.");
      onParsed(parsed);
    } catch (e: any) {
      setErr(e?.message || "Failed to parse schedule");
      setBusy(false);
    }
  };

  const addManual = async () => {
    const name = manualName.trim();
    if (!name) return;
    await addTask({ name, tier: manualTier });
    setManualName("");
    setTimeout(() => manualRef.current?.focus(), 50);
  };

  const greeting = operatorName ? operatorName.toLowerCase() : "operator";

  return (
    <section className="relative flex-1 flex items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="w-full max-w-[640px] mx-auto flex flex-col items-center gap-8">
        {/* Greeting */}
        <div className="text-center">
          <div className="label-eyebrow mb-2">SCOPE · INTAKE</div>
          <div className="font-display text-2xl text-cream-bright">
            <span className="text-muted">load</span> {day?.date}
            <span className="text-muted">'s schedule, </span>
            <span className="text-[rgb(var(--accent-rgb))]">{greeting}</span>
          </div>
        </div>

        {/* Upload zone — large, centered, breathing */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`relative w-full aspect-[4/3] max-h-[420px] cursor-pointer rounded-[4px] bg-ink-100/40
                      border transition-all duration-300 overflow-hidden
                      ${dragOver
                        ? "border-[rgb(var(--accent-rgb)/0.8)] bg-[rgb(var(--accent-rgb)/0.05)] scale-[1.01]"
                        : "border-[rgb(var(--accent-rgb)/0.25)] hover:border-[rgb(var(--accent-rgb)/0.5)]"}
                      ${!busy && !dragOver ? "animate-[pulseGlow_3.4s_ease-in-out_infinite]" : ""}`}
        >
          {/* Corner viewfinder marks — bigger, more prominent */}
          <ViewfinderBig />

          {/* Center reticle + label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 pointer-events-none">
            <AnimatePresence mode="wait">
              {busy ? (
                <motion.div
                  key="busy"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  <Reticle size={48} />
                  <div className="label-eyebrow accent">PARSING TARGETS</div>
                  <div className="mono text-[11px] text-cream-dim">extracting tasks from image</div>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 text-center"
                >
                  <Reticle size={48} spin={false} />
                  <div className="font-display text-xl text-cream-bright">
                    drop schedule photo
                  </div>
                  <div className="mono text-[10px] tracking-widest2 uppercase text-muted">
                    or click to acquire · handwritten · printed · any layout
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {preview && !busy && (
            <motion.img
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.18 }}
              src={preview}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {err && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mono text-[11px] text-tier-critical text-center"
          >
            · {err}
          </motion.div>
        )}

        {/* Manual fallback */}
        <div className="w-full flex flex-col items-center gap-3">
          <AnimatePresence mode="wait">
            {!manualOpen ? (
              <motion.button
                key="trigger"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setManualOpen(true);
                  setTimeout(() => manualRef.current?.focus(), 50);
                }}
                className="mono text-[11px] tracking-widest2 uppercase text-muted hover:text-cream-bright transition-colors"
              >
                or queue tasks manually →
              </motion.button>
            ) : (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="w-full flex flex-col gap-3"
              >
                <div className="hairline rounded-[3px] bg-ink-100/60 px-3 py-2 flex items-center gap-2">
                  <span className="mono text-[10px] tracking-widest2 uppercase text-muted">+</span>
                  <input
                    ref={manualRef}
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addManual()}
                    placeholder="task name — enter to queue"
                    className="flex-1 font-display text-[14px] text-cream-bright placeholder:text-muted-deep py-1"
                  />
                  <div className="flex items-center gap-1">
                    {QUICK_TIERS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setManualTier(t)}
                        className={`mono text-[10px] tracking-widest2 uppercase px-1.5 py-0.5 rounded-[2px]
                                    ${manualTier === t ? "text-cream-bright bg-white/[0.06] border border-white/[0.12]" : "text-muted hover:text-cream-dim border border-transparent"}`}
                      >
                        <span className={`tier-dot tier-${t} mr-1.5`} />
                        {t === "STANDARD" ? "STD" : t === "CRITICAL" ? "CRIT" : t}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={addManual}
                    disabled={!manualName.trim()}
                    className="mono text-[10px] tracking-widest2 uppercase px-2.5 py-1 border border-[rgb(var(--accent-rgb)/0.4)] text-[rgb(var(--accent-rgb))] rounded-[2px] hover:bg-[rgb(var(--accent-rgb)/0.08)] disabled:opacity-30"
                  >
                    QUEUE
                  </button>
                </div>
                <button
                  onClick={() => setManualOpen(false)}
                  className="mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim self-center"
                >
                  ← back to upload
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function ViewfinderBig() {
  const seg = 28;
  const inset = 14;
  const c = "rgb(var(--accent-rgb))";
  const w: any = { position: "absolute", color: c, opacity: 0.6, pointerEvents: "none" };
  return (
    <>
      <svg style={{ ...w, top: inset, left: inset }} width={seg} height={seg} viewBox={`0 0 ${seg} ${seg}`}>
        <line x1="0" y1="0" x2="0" y2={seg} stroke="currentColor" strokeWidth="1.2" />
        <line x1="0" y1="0" x2={seg} y2="0" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <svg style={{ ...w, top: inset, right: inset }} width={seg} height={seg} viewBox={`0 0 ${seg} ${seg}`}>
        <line x1={seg} y1="0" x2={seg} y2={seg} stroke="currentColor" strokeWidth="1.2" />
        <line x1="0" y1="0" x2={seg} y2="0" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <svg style={{ ...w, bottom: inset, left: inset }} width={seg} height={seg} viewBox={`0 0 ${seg} ${seg}`}>
        <line x1="0" y1="0" x2="0" y2={seg} stroke="currentColor" strokeWidth="1.2" />
        <line x1="0" y1={seg} x2={seg} y2={seg} stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <svg style={{ ...w, bottom: inset, right: inset }} width={seg} height={seg} viewBox={`0 0 ${seg} ${seg}`}>
        <line x1={seg} y1="0" x2={seg} y2={seg} stroke="currentColor" strokeWidth="1.2" />
        <line x1="0" y1={seg} x2={seg} y2={seg} stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </>
  );
}

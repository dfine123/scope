import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reticle } from "../ui/Reticle";
import { ViewfinderMarks } from "../ui/ViewfinderMarks";
import { bridge } from "../../services/bridge";
import { applyAccent, localMottoAccent, type AccentResult } from "../../services/mottoColor";

type Step = "pin" | "confirm" | "apikey" | "identity";

interface Props {
  onComplete: () => void;
}

export function SetupGate({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("pin");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Identity step
  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [accent, setAccent] = useState<AccentResult | null>(null);

  const apiRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Live-preview the accent the moment the user pauses typing the motto.
  useEffect(() => {
    if (step !== "identity") return;
    if (!motto.trim()) {
      setAccent(null);
      return;
    }
    const id = setTimeout(() => {
      const a = localMottoAccent(motto);
      setAccent(a);
      applyAccent(a.rgb);
    }, 220);
    return () => clearTimeout(id);
  }, [motto, step]);

  const handlePinDigit = (digit: string, current: string, setter: (v: string) => void) => {
    if (current.length >= 4) return;
    const next = current + digit;
    setter(next);
    if (next.length === 4) {
      if (step === "pin") {
        setTimeout(() => setStep("confirm"), 200);
      } else if (step === "confirm") {
        if (next !== pin) {
          setMismatch(true);
          setTimeout(() => {
            setConfirm("");
            setMismatch(false);
          }, 700);
        } else {
          setStep("apikey");
          setTimeout(() => apiRef.current?.focus(), 100);
        }
      }
    }
  };

  const handleBackspace = (current: string, setter: (v: string) => void) => {
    if (current.length > 0) setter(current.slice(0, -1));
  };

  const advanceToIdentity = () => {
    setStep("identity");
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  const finalize = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const accentFinal = motto.trim() ? accent ?? localMottoAccent(motto) : null;
      await bridge.auth.setup({
        passcode: pin,
        apiKey: apiKey.trim() || undefined,
        name: name.trim() || undefined,
        motto: motto.trim() || undefined,
        accentRgb: accentFinal?.rgb,
        accentLabel: accentFinal?.label,
      });
      onComplete();
    } catch (e: any) {
      setErr(e?.message || "Setup failed");
      setBusy(false);
    }
  };

  return (
    <div className="app-shell relative flex items-center justify-center h-screen px-6">
      <div className="app-bg" />
      <div className="app-noise" />
      <div className="app-scanline" />
      <div className="app-vignette" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="hairline rounded-[3px] bg-ink-100/80 backdrop-blur-md p-8">
          <ViewfinderMarks inset={8} opacity={0.45} />

          <div className="flex items-center gap-3 mb-7">
            <Reticle size={22} spin={false} />
            <div>
              <div className="label-eyebrow accent">SCOPE · FIRST RUN</div>
              <div className="font-display text-lg text-cream-bright mt-0.5">
                {step === "pin" && "create passcode"}
                {step === "confirm" && "confirm passcode"}
                {step === "apikey" && "anthropic api key"}
                {step === "identity" && "identity & first motto"}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {(step === "pin" || step === "confirm") && (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.22 }}
              >
                <p className="mono text-[11px] tracking-widest2 uppercase text-muted mb-5">
                  {step === "pin" ? "4-digit pin" : "enter again to confirm"}
                </p>
                <PinDots
                  value={step === "pin" ? pin : confirm}
                  shake={mismatch}
                />
                <Numpad
                  onDigit={(d) => {
                    if (step === "pin") handlePinDigit(d, pin, setPin);
                    else handlePinDigit(d, confirm, setConfirm);
                  }}
                  onBack={() => {
                    if (step === "pin") handleBackspace(pin, setPin);
                    else handleBackspace(confirm, setConfirm);
                  }}
                />
                {mismatch && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mono text-[10px] tracking-widest2 uppercase text-tier-critical text-center mt-3"
                  >
                    no match — try again
                  </motion.p>
                )}
              </motion.div>
            )}

            {step === "apikey" && (
              <motion.div
                key="apikey"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col gap-4"
              >
                <p className="mono text-[11px] tracking-widest2 uppercase text-muted">
                  powers schedule parsing, debrief, motto color. can be added later in settings.
                </p>
                <input
                  ref={apiRef}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && advanceToIdentity()}
                  placeholder="sk-ant-api03-..."
                  className="hairline rounded-[2px] bg-ink-50/60 px-3 py-2.5 mono text-[13px] text-cream-bright"
                />
                <div className="flex gap-2">
                  <button
                    onClick={advanceToIdentity}
                    className="flex-1 mono text-[11px] tracking-widest2 uppercase py-2.5 rounded-[2px] border
                               border-[rgb(var(--accent-rgb)/0.5)] text-[rgb(var(--accent-rgb))]
                               hover:bg-[rgb(var(--accent-rgb)/0.08)]"
                  >
                    continue →
                  </button>
                  <button
                    onClick={advanceToIdentity}
                    className="mono text-[10px] tracking-widest2 uppercase px-3 py-2.5 rounded-[2px] border border-white/10 text-muted hover:text-cream-dim"
                  >
                    skip
                  </button>
                </div>
              </motion.div>
            )}

            {step === "identity" && (
              <motion.div
                key="identity"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-2">
                  <label className="label-eyebrow">CALL SIGN</label>
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={32}
                    placeholder="e.g. dfine"
                    className="hairline rounded-[2px] bg-ink-50/60 px-3 py-2.5 mono text-[14px] text-cream-bright"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label-eyebrow">FIRST MOTTO</label>
                  <textarea
                    value={motto}
                    onChange={(e) => setMotto(e.target.value)}
                    rows={2}
                    placeholder="operating directive — drives the accent"
                    className="hairline rounded-[2px] bg-ink-50/60 px-3 py-2.5 font-display text-[15px] text-cream-bright resize-none"
                  />
                  {accent && motto.trim() && (
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-3 h-3 rounded-[2px]"
                        style={{
                          background: `rgb(${accent.rgb})`,
                          boxShadow: `0 0 12px rgb(${accent.rgb})`,
                        }}
                      />
                      <span className="mono text-[10px] tracking-widest2 uppercase text-muted">
                        accent · {accent.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={finalize}
                    disabled={busy}
                    className="flex-1 mono text-[11px] tracking-widest2 uppercase py-2.5 rounded-[2px] border
                               border-[rgb(var(--accent-rgb)/0.5)] text-[rgb(var(--accent-rgb))]
                               hover:bg-[rgb(var(--accent-rgb)/0.08)] disabled:opacity-40"
                  >
                    {busy ? "engaging…" : "launch scope"}
                  </button>
                </div>

                {err && (
                  <p className="mono text-[10px] tracking-widest2 uppercase text-tier-critical">
                    · {err}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 mono text-[10px] tracking-widest2 uppercase text-muted text-center">
          passcode encrypted · api key local · single-operator
        </div>
      </motion.div>
    </div>
  );
}

function PinDots({ value, shake }: { value: string; shake: boolean }) {
  return (
    <motion.div
      animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.35 }}
      className="flex justify-center gap-4 mb-6"
    >
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          animate={
            i < value.length
              ? { scale: [1, 1.25, 1], opacity: 1 }
              : { scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.2 }}
          className={`w-4 h-4 rounded-full border transition-all duration-150 ${
            i < value.length
              ? "bg-[rgb(var(--accent-rgb))] border-[rgb(var(--accent-rgb))] shadow-[0_0_12px_rgb(var(--accent-rgb)/0.7)]"
              : "bg-transparent border-white/20"
          }`}
        />
      ))}
    </motion.div>
  );
}

function Numpad({
  onDigit,
  onBack,
}: {
  onDigit: (d: string) => void;
  onBack: () => void;
}) {
  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "⌫"],
  ];
  return (
    <div className="flex flex-col gap-2">
      {keys.map((row, r) => (
        <div key={r} className="grid grid-cols-3 gap-2">
          {row.map((k, c) => (
            <button
              key={c}
              onClick={() => {
                if (!k) return;
                if (k === "⌫") onBack();
                else onDigit(k);
              }}
              disabled={!k}
              className={`py-3 rounded-[2px] mono text-base font-medium transition-all duration-100
                          ${!k ? "invisible" : "hairline text-cream hover:bg-white/[0.05] hover:text-cream-bright active:scale-95 active:bg-[rgb(var(--accent-rgb)/0.08)]"}`}
            >
              {k}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

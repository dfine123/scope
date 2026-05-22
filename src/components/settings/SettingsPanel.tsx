import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ViewfinderMarks } from "../ui/ViewfinderMarks";
import { bridge, type AppSettings } from "../../services/bridge";
import { useScope } from "../../store/scopeStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

type PinStep = "idle" | "new-pin" | "confirm-pin";

export function SettingsPanel({ open, onClose }: Props) {
  const bootSession = useScope((s) => s.bootSession);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [opName, setOpName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // PIN change flow
  const [pinStep, setPinStep] = useState<PinStep>("idle");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMismatch, setPinMismatch] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPinStep("idle");
    setNewPin("");
    setConfirmPin("");
    setApiKey("");
    setApiKeyDirty(false);
    setSaved(false);
    setErr(null);
    bridge.settings
      .get()
      .then((s) => {
        setSettings(s);
        setOpName(s.operatorName ?? "");
      })
      .catch(() => null);
  }, [open]);

  const saveApiKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const updated = await bridge.settings.save({ apiKey: apiKey.trim() });
      setSettings(updated);
      setApiKey("");
      setApiKeyDirty(false);
      setSaved(true);
      await bootSession();
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinStep === "new-pin") {
      const next = newPin + digit;
      setNewPin(next);
      if (next.length === 4) setTimeout(() => setPinStep("confirm-pin"), 200);
    } else if (pinStep === "confirm-pin") {
      const next = confirmPin + digit;
      setConfirmPin(next);
      if (next.length === 4) {
        if (next !== newPin) {
          setPinMismatch(true);
          setTimeout(() => {
            setConfirmPin("");
            setPinMismatch(false);
            setPinStep("new-pin");
            setNewPin("");
          }, 700);
        } else {
          // Save new pin
          setSaving(true);
          bridge.settings
            .save({ passcode: next })
            .then(() => {
              setPinStep("idle");
              setNewPin("");
              setConfirmPin("");
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            })
            .catch((e: any) => setErr(e?.message || "Failed to update passcode"))
            .finally(() => setSaving(false));
        }
      }
    }
  };

  const handlePinBack = () => {
    if (pinStep === "new-pin" && newPin.length > 0) setNewPin((p) => p.slice(0, -1));
    if (pinStep === "confirm-pin" && confirmPin.length > 0) setConfirmPin((p) => p.slice(0, -1));
  };

  const currentPin = pinStep === "confirm-pin" ? confirmPin : newPin;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 backdrop flex items-center justify-center px-6"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md hairline bg-ink-100/95 rounded-[3px] overflow-hidden"
          >
            <ViewfinderMarks inset={8} opacity={0.35} />

            {/* Header */}
            <div className="px-7 pt-6 pb-4 border-b border-white/[0.05] flex items-center justify-between">
              <div>
                <div className="label-eyebrow">SETTINGS</div>
                <div className="font-display text-lg text-cream-bright mt-0.5">system config</div>
              </div>
              <button
                onClick={onClose}
                className="mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim px-2 py-1"
              >
                ✕ close
              </button>
            </div>

            <div className="px-7 py-6 flex flex-col gap-6">
              {/* Operator name */}
              <section>
                <div className="label-eyebrow mb-2">CALL SIGN</div>
                <div className="flex gap-2">
                  <input
                    value={opName}
                    onChange={(e) => setOpName(e.target.value)}
                    maxLength={32}
                    placeholder="operator name"
                    className="flex-1 hairline rounded-[2px] bg-ink-50/60 px-3 py-2 mono text-[13px] text-cream-bright"
                  />
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const updated = await bridge.settings.save({ operatorName: opName });
                        setSettings(updated);
                        setSaved(true);
                        await bootSession();
                        setTimeout(() => setSaved(false), 2000);
                      } catch (e: any) {
                        setErr(e?.message || "Save failed");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={opName === (settings?.operatorName ?? "") || saving}
                    className="mono text-[10px] tracking-widest2 uppercase px-3 py-2 border border-white/15 rounded-[2px] text-cream-dim hover:text-cream-bright hover:border-white/30 disabled:opacity-30"
                  >
                    save
                  </button>
                </div>
              </section>

              {/* API Key */}
              <section>
                <div className="label-eyebrow mb-2">ANTHROPIC API KEY</div>
                {settings?.maskedApiKey && (
                  <div className="mono text-[12px] text-cream-dim mb-2">
                    current: {settings.maskedApiKey}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setApiKeyDirty(true);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && saveApiKey()}
                    placeholder={settings?.hasApiKey ? "enter new key to replace" : "sk-ant-api03-…"}
                    className="flex-1 hairline rounded-[2px] bg-ink-50/60 px-3 py-2 mono text-[13px] text-cream-bright"
                  />
                  <button
                    onClick={saveApiKey}
                    disabled={!apiKey.trim() || saving}
                    className="mono text-[10px] tracking-widest2 uppercase px-3 py-2 border border-[rgb(var(--accent-rgb)/0.4)] text-[rgb(var(--accent-rgb))] rounded-[2px] hover:bg-[rgb(var(--accent-rgb)/0.08)] disabled:opacity-30"
                  >
                    {saving ? "…" : "save"}
                  </button>
                </div>
              </section>

              {/* Passcode change */}
              <section>
                <div className="label-eyebrow mb-3">PASSCODE</div>
                <AnimatePresence mode="wait">
                  {pinStep === "idle" ? (
                    <motion.button
                      key="trigger"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setPinStep("new-pin")}
                      className="mono text-[10px] tracking-widest2 uppercase px-3 py-2 border border-white/15 rounded-[2px] text-cream-dim hover:text-cream-bright hover:border-white/30"
                    >
                      change passcode
                    </motion.button>
                  ) : (
                    <motion.div
                      key="pin-entry"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col items-start gap-3"
                    >
                      <div className="mono text-[11px] tracking-widest2 uppercase text-muted">
                        {pinStep === "new-pin" ? "new 4-digit pin" : "confirm new pin"}
                      </div>
                      {/* Dots */}
                      <motion.div
                        animate={pinMismatch ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex gap-3"
                      >
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-full border transition-all duration-100 ${
                              i < currentPin.length
                                ? "bg-[rgb(var(--accent-rgb))] border-[rgb(var(--accent-rgb))] shadow-[0_0_10px_rgb(var(--accent-rgb)/0.6)]"
                                : "bg-transparent border-white/20"
                            }`}
                          />
                        ))}
                      </motion.div>
                      {/* Inline numpad (compact) */}
                      <div className="grid grid-cols-5 gap-1.5">
                        {["1","2","3","4","5","6","7","8","9","⌫","0","✕"].map((k) => (
                          <button
                            key={k}
                            onClick={() => {
                              if (k === "✕") { setPinStep("idle"); setNewPin(""); setConfirmPin(""); }
                              else if (k === "⌫") handlePinBack();
                              else handlePinDigit(k);
                            }}
                            className="hairline py-2 rounded-[2px] mono text-[13px] text-cream hover:bg-white/[0.06] active:scale-95 transition-all"
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                      {pinMismatch && (
                        <p className="mono text-[10px] tracking-widest2 uppercase text-tier-critical">
                          no match
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Feedback */}
              {saved && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mono text-[10px] tracking-widest2 uppercase text-[rgb(var(--accent-rgb))]"
                >
                  · saved
                </motion.div>
              )}
              {err && (
                <p className="mono text-[10px] tracking-widest2 uppercase text-tier-critical">
                  · {err}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { Reticle } from "../ui/Reticle";
import { ViewfinderMarks } from "../ui/ViewfinderMarks";
import { bridge } from "../../services/bridge";

interface Props {
  onAuthed: () => void;
}

export function LoginGate({ onAuthed }: Props) {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!passcode || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await bridge.auth.login(passcode);
      onAuthed();
    } catch (e: any) {
      setErr(e?.status === 401 ? "rejected" : e?.message || "failed");
      setPasscode("");
    } finally {
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md hairline rounded-[3px] bg-ink-100/80 backdrop-blur-md p-8"
      >
        <ViewfinderMarks inset={8} opacity={0.45} />

        <div className="flex items-center gap-3 mb-6">
          <Reticle size={22} />
          <div>
            <div className="label-eyebrow">SCOPE</div>
            <div className="font-display text-xl text-cream-bright">access locked</div>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="label-eyebrow block mb-2">PASSCODE</label>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setErr(null);
              }}
              className={`w-full hairline rounded-[2px] bg-ink-50/60 px-3 py-2.5 mono text-[15px]
                          tracking-widest2 text-cream-bright focus:border-[rgb(var(--accent-rgb)/0.6)]
                          transition-colors ${err ? "border-tier-critical/60" : ""}`}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={!passcode || busy}
            className="mono text-[11px] tracking-widest2 uppercase px-4 py-2.5 rounded-[2px] border
                       border-[rgb(var(--accent-rgb)/0.5)] text-[rgb(var(--accent-rgb))]
                       hover:bg-[rgb(var(--accent-rgb)/0.08)] hover:border-[rgb(var(--accent-rgb)/0.8)]
                       hover:shadow-[0_0_24px_-6px_rgb(var(--accent-rgb)/0.55)]
                       disabled:opacity-30 disabled:pointer-events-none"
          >
            {busy ? "verifying…" : "engage"}
          </button>

          {err && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mono text-[11px] tracking-widest2 uppercase text-tier-critical"
            >
              · {err}
            </motion.div>
          )}
        </form>

        <div className="mt-6 mono text-[10px] tracking-widest2 uppercase text-muted">
          single-operator console · session 30d
        </div>
      </motion.div>
    </div>
  );
}

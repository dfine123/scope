import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Reticle } from "../ui/Reticle";
import { ViewfinderMarks } from "../ui/ViewfinderMarks";
import type { ParsedTask } from "../../types";
import { bridge } from "../../services/bridge";

interface Props {
  onParsed: (tasks: ParsedTask[]) => void;
  compact?: boolean;
  label?: string;
}

export function ScheduleUpload({ onParsed, compact = false, label }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

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
      const parsed = await bridge.ai.parseSchedule(dataUrl);
      onParsed(parsed);
    } catch (e: any) {
      setErr(e?.message || "Failed to parse schedule.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer hairline rounded-[3px] bg-ink-100/40 hover:bg-ink-100/60
                  transition-colors ${compact ? "p-5" : "p-10"}`}
    >
      <ViewfinderMarks inset={6} size={16} opacity={0.55} />
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div className={`flex ${compact ? "flex-row items-center gap-5" : "flex-col items-center gap-4"}`}>
        <div className="relative">
          {busy ? <Reticle size={compact ? 22 : 32} /> : <Reticle spin={false} size={compact ? 22 : 32} />}
        </div>
        <div className={`${compact ? "" : "text-center"}`}>
          <div className="label-eyebrow">{label ?? "UPLOAD SCHEDULE"}</div>
          <div className={`font-display ${compact ? "text-sm" : "text-base"} text-cream-bright mt-1`}>
            {busy ? "parsing image…" : "drop photo, click to select"}
          </div>
          {!compact && (
            <div className="mono text-[10px] tracking-widest2 uppercase text-muted mt-2">
              handwritten · printed · any layout
            </div>
          )}
          {err && (
            <div className="mono text-[11px] text-tier-critical mt-3 max-w-md">{err}</div>
          )}
        </div>
        {preview && !compact && (
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            src={preview}
            className="absolute right-4 top-4 w-20 h-20 object-cover rounded-[2px] border border-white/10"
          />
        )}
      </div>
    </div>
  );
}

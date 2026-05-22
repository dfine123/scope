import type { CSSProperties } from "react";

interface Props {
  inset?: number;
  size?: number;
  opacity?: number;
  className?: string;
}

export function ViewfinderMarks({ inset = 8, size = 14, opacity = 0.45, className = "" }: Props) {
  const stroke: CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    opacity,
    pointerEvents: "none",
    color: "rgb(var(--accent-rgb))",
  };
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      <Corner style={{ ...stroke, top: inset, left: inset }} dir="tl" />
      <Corner style={{ ...stroke, top: inset, right: inset }} dir="tr" />
      <Corner style={{ ...stroke, bottom: inset, left: inset }} dir="bl" />
      <Corner style={{ ...stroke, bottom: inset, right: inset }} dir="br" />
    </div>
  );
}

function Corner({ style, dir }: { style: CSSProperties; dir: "tl" | "tr" | "bl" | "br" }) {
  const segs: Record<typeof dir, JSX.Element> = {
    tl: (
      <>
        <line x1="0" y1="0" x2="0" y2="14" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="0" x2="14" y2="0" stroke="currentColor" strokeWidth="1" />
      </>
    ),
    tr: (
      <>
        <line x1="14" y1="0" x2="14" y2="14" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="0" x2="14" y2="0" stroke="currentColor" strokeWidth="1" />
      </>
    ),
    bl: (
      <>
        <line x1="0" y1="0" x2="0" y2="14" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1" />
      </>
    ),
    br: (
      <>
        <line x1="14" y1="0" x2="14" y2="14" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1" />
      </>
    ),
  };
  return (
    <svg style={style} viewBox="0 0 14 14" fill="none">
      {segs[dir]}
    </svg>
  );
}

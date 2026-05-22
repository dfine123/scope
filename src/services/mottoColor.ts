// Local heuristic fallback that maps a motto to an accent color.
// Used when the Claude API isn't available. Cheap word-association — the
// real engine is in electron/claude.ts. This is just so the UI has a
// reasonable answer at all times.

export interface AccentResult {
  rgb: string; // "R, G, B"
  hex: string;
  label: string;
}

const PALETTES: Array<{ keywords: string[]; rgb: [number, number, number]; label: string }> = [
  {
    keywords: ["kill", "war", "blood", "merciless", "destroy", "burn", "savage", "rage", "no mercy"],
    rgb: [255, 70, 60],
    label: "ember",
  },
  {
    keywords: ["aggressive", "attack", "push", "hunt", "predator", "complacency", "suicide"],
    rgb: [255, 110, 60],
    label: "blood-orange",
  },
  {
    keywords: ["obsession", "fire", "intensity", "all in", "go hard", "alpha"],
    rgb: [255, 90, 40],
    label: "molten",
  },
  {
    keywords: ["focus", "locked", "lock in", "ship", "build", "execute", "operator", "precision"],
    rgb: [80, 175, 255],
    label: "cobalt",
  },
  {
    keywords: ["clarity", "clear", "sharp", "edge", "razor", "cold"],
    rgb: [120, 220, 255],
    label: "electric ice",
  },
  {
    keywords: ["silence", "quiet", "still", "patient", "wait", "watch"],
    rgb: [165, 140, 255],
    label: "violet",
  },
  {
    keywords: ["philosophy", "think", "deep", "study", "learn"],
    rgb: [200, 130, 255],
    label: "magenta",
  },
  {
    keywords: ["momentum", "compound", "build silent", "in silence", "grow"],
    rgb: [80, 230, 180],
    label: "jade-electric",
  },
  {
    keywords: ["discipline", "rigor", "control", "steady"],
    rgb: [180, 195, 220],
    label: "steel",
  },
];

const DEFAULT_ACCENT: AccentResult = {
  rgb: "96, 165, 250",
  hex: "#60A5FA",
  label: "cobalt",
};

export function localMottoAccent(motto: string): AccentResult {
  const m = motto.toLowerCase();
  for (const p of PALETTES) {
    for (const k of p.keywords) {
      if (m.includes(k)) {
        const [r, g, b] = p.rgb;
        return { rgb: `${r}, ${g}, ${b}`, hex: rgbToHex(r, g, b), label: p.label };
      }
    }
  }
  // No match — hash the string into a saturated, dark-friendly color.
  let hash = 0;
  for (let i = 0; i < motto.length; i++) hash = motto.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  const sat = 78;
  const light = 60;
  const [r, g, b] = hslToRgb(hue, sat, light);
  return { rgb: `${r}, ${g}, ${b}`, hex: rgbToHex(r, g, b), label: "auto" };
}

export function applyAccent(rgb: string | null) {
  if (typeof document === "undefined") return;
  const value = rgb && /^\d+,\s*\d+,\s*\d+$/.test(rgb) ? rgb : DEFAULT_ACCENT.rgb;
  document.documentElement.style.setProperty("--accent-rgb", value);
}

export { DEFAULT_ACCENT };

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

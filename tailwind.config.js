/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          0: "#050507",
          50: "#0A0A0F",
          100: "#0E0E14",
          150: "#111118",
          200: "#15151E",
          300: "#1B1B26",
          400: "#23232F",
        },
        cream: {
          DEFAULT: "#E8E4DD",
          bright: "#F5F3EF",
          dim: "#9C9A93",
        },
        muted: {
          DEFAULT: "#6B6B7B",
          deep: "#42424E",
        },
        tier: {
          critical: "#FF4D4D",
          high: "#FFB347",
          standard: "#E8E4DD",
          low: "#6B6B7B",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
        display: [
          "Space Grotesk",
          "Satoshi",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        sans: ["Inter", "Satoshi", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        wider2: "0.18em",
        widest2: "0.28em",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": {
            boxShadow:
              "0 0 0 1px rgb(var(--accent-rgb) / 0.18), 0 0 24px -8px rgb(var(--accent-rgb) / 0.35)",
          },
          "50%": {
            boxShadow:
              "0 0 0 1px rgb(var(--accent-rgb) / 0.32), 0 0 36px -6px rgb(var(--accent-rgb) / 0.55)",
          },
        },
        ignition: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "40%": { opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        reticleSpin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        typeIn: {
          "0%": { width: "0", opacity: "0" },
          "100%": { width: "100%", opacity: "1" },
        },
        sweep: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        breathe: "breathe 3.6s ease-in-out infinite",
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        ignition: "ignition 280ms cubic-bezier(0.16, 1, 0.3, 1)",
        reticleSpin: "reticleSpin 6s linear infinite",
        scanline: "scanline 9s linear infinite",
        sweep: "sweep 3s linear infinite",
      },
    },
  },
  plugins: [],
};

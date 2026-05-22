import { forwardRef, ButtonHTMLAttributes } from "react";

type Variant = "ghost" | "accent" | "outline" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

const base =
  "inline-flex items-center justify-center gap-2 select-none font-mono uppercase " +
  "tracking-widest2 transition-all duration-150 ease-out " +
  "active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none";

const sizes: Record<NonNullable<Props["size"]>, string> = {
  sm: "px-2.5 py-1 text-[10px]",
  md: "px-3.5 py-2 text-[11px]",
  lg: "px-5 py-3 text-xs",
};

const variants: Record<Variant, string> = {
  ghost:
    "text-cream-dim hover:text-cream-bright hover:bg-white/[0.03] border border-transparent hover:border-white/[0.08]",
  accent:
    "text-[rgb(var(--accent-rgb))] border border-[rgb(var(--accent-rgb)/0.35)] " +
    "hover:bg-[rgb(var(--accent-rgb)/0.08)] hover:border-[rgb(var(--accent-rgb)/0.6)] " +
    "hover:shadow-[0_0_24px_-6px_rgb(var(--accent-rgb)/0.55)]",
  outline:
    "border border-white/10 text-cream hover:text-cream-bright hover:border-white/30 hover:bg-white/[0.02]",
  danger:
    "border border-tier-critical/40 text-tier-critical hover:bg-tier-critical/10 hover:border-tier-critical/70",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "ghost", size = "md", className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

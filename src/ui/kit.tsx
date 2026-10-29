import React from "react";
import { cn, copyText } from "@/lib/utils";
import { Check, X, Copy } from "lucide-react";

/* ------------------------------------------------------------------ button */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger" | "soft";
  size?: "xs" | "sm" | "md";
  icon?: React.ReactNode;
};
export function Btn({ variant = "outline", size = "sm", icon, className, children, ...rest }: BtnProps) {
  const sizes = { xs: "px-2.5 py-1 text-[11px] gap-1.5", sm: "px-3 py-2 text-xs gap-2", md: "px-4 py-2.5 text-sm gap-2" }[size];
  const variants = {
    primary: "bg-accent text-[#0a0a0c] border-accent hover:brightness-110 font-semibold shadow-[0_0_24px_-8px_var(--accent)]",
    outline: "border-line2 text-txt hover:border-accent hover:text-accent bg-white/[0.03]",
    ghost: "border-transparent text-dim hover:text-txt hover:bg-white/[0.06]",
    danger: "border-bad/60 text-bad bg-bad/10 hover:bg-bad hover:text-[#0a0a0c]",
    soft: "border-accent/40 text-accent bg-accent/10 hover:bg-accent/20",
  }[variant];
  return (
    <button
      {...rest}
      className={cn("inline-flex items-center justify-center rounded-[10px] border font-medium tracking-wide transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40", sizes, variants, className)}
    >
      {icon}{children}
    </button>
  );
}

export function IconBtn({ label, active, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      {...rest} title={label} aria-label={label}
      className={cn("grid h-8 w-8 place-items-center rounded-lg border border-transparent text-dim transition-all hover:border-line2 hover:bg-white/[0.06] hover:text-txt active:scale-95",
        active && "border-accent/50 bg-accent/10 text-accent", className)}
    >{children}</button>
  );
}

/* ------------------------------------------------------------------ layout */
export function Section({ title, hint, right, children, className }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mb-5", className)}>
      <header className="mb-3 flex items-end justify-between gap-3 border-b border-line pb-2">
        <div>
          <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-txt">{title}</h3>
          {hint && <p className="mt-0.5 text-[11px] leading-tight text-faint">{hint}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function Card({ className, children, glow }: { className?: string; children: React.ReactNode; glow?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-line bg-white/[0.025] p-3.5", glow && "glow-accent", className)}>{children}</div>
  );
}

export function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] leading-tight text-txt">{label}</div>
        {sub && <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- controls */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label || "toggle"} onClick={() => onChange(!on)}
      className={cn("relative h-[22px] w-[42px] shrink-0 rounded-full border transition-all duration-200",
        on ? "border-accent bg-accent/25" : "border-line2 bg-white/[0.06]")}
    >
      <span className={cn("absolute top-[2px] h-[16px] w-[16px] rounded-full transition-all duration-200",
        on ? "left-[22px] bg-accent shadow-[0_0_12px_var(--accent)]" : "left-[2px] bg-dim")} />
    </button>
  );
}

export function Slider({ label, value, min, max, step = 1, unit = "", onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] text-dim">{label}</span>
        <span className="font-mono text-[11px] font-medium text-accent tabular">{format ? format(value) : value + unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} style={{ ["--pct" as any]: pct + "%" }}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

export function Chips<T extends string | number>({ options, value, onChange, cols }: {
  options: { v: T; label: string; hint?: string }[]; value: T; onChange: (v: T) => void; cols?: number;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols || Math.min(options.length, 3)}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} title={o.hint}
          className={cn("rounded-[9px] border px-2 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-all active:scale-[0.97]",
            value === o.v ? "border-accent bg-accent/12 text-accent shadow-[0_0_18px_-8px_var(--accent)]" : "border-line bg-white/[0.02] text-dim hover:border-line2 hover:text-txt")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn("field", className)} />;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { v: T; label: string; icon?: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="scroll-thin flex gap-1 overflow-x-auto rounded-xl border border-line bg-white/[0.03] p-1">
      {tabs.map((t) => (
        <button key={t.v} onClick={() => onChange(t.v)}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
            value === t.v ? "bg-accent/15 text-accent" : "text-dim hover:bg-white/[0.05] hover:text-txt")}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

export function Meter({ value, max = 100, tone = "var(--accent)", height = 6 }: { value: number; max?: number; tone?: string; height?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/[0.08]" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-300" style={{ width: Math.max(0, Math.min(100, (value / max) * 100)) + "%", background: tone, boxShadow: `0 0 12px -2px ${tone}` }} />
    </div>
  );
}

export function Stat({ label, value, tone, sub }: { label: string; value: React.ReactNode; tone?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.025] px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">{label}</div>
      <div className="mt-1 font-display text-xl font-bold leading-none tabular" style={{ color: tone || "var(--txt)" }}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-faint">{sub}</div>}
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <div className="text-faint">{icon}</div>
      <div className="text-[13px] text-dim">{title}</div>
      {hint && <div className="max-w-xs text-[11px] leading-relaxed text-faint">{hint}</div>}
    </div>
  );
}

export function Modal({ open, title, children, onClose, footer }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void; footer?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="surface anim-pop w-full max-w-md rounded-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-accent">{title}</h3>
          <IconBtn label="Close" onClick={onClose}><X size={15} /></IconBtn>
        </div>
        <div className="text-[13px] leading-relaxed text-dim">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Btn size="xs" variant={done ? "soft" : "outline"} title="Copy to clipboard"
      icon={done ? <Check size={12} /> : label ? undefined : <Copy size={12} />}
      onClick={async () => {
        if (await copyText(text)) { setDone(true); window.setTimeout(() => setDone(false), 1400); }
      }}>
      {done ? (label ? "Copied" : "") : label}
    </Btn>
  );
}

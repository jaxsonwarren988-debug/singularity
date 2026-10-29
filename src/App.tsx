import { useEffect, useState } from "react";
import Background from "@/gfx/Background";
import Overlays from "@/gfx/Overlays";
import Desktop from "@/os/Desktop";
import Auth from "@/os/Auth";
import { useOS, useSettings } from "@/state/store";
import { themeById } from "@/lib/themes";
import { cn } from "@/lib/utils";

const BOOT_LINES = [
  "compiling fragment shaders",
  "bending the event horizon",
  "seeding accretion field",
  "linking mesh broadcast channel",
  "waking NOVA",
];

function Boot({ done }: { done: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setStep((s) => Math.min(BOOT_LINES.length, s + 1)), 240);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className={cn("fixed inset-0 z-[900] grid place-items-center bg-[var(--bg)] transition-opacity duration-500", done ? "pointer-events-none opacity-0" : "opacity-100")}>
      <div className="w-[280px]">
        <div className="mb-6 flex items-center justify-center">
          <span className="relative grid h-16 w-16 place-items-center">
            <span className="spin-slow absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, transparent, var(--accent), transparent 45%)", filter: "blur(4px)" }} />
            <span className="spin-rev absolute -inset-2 rounded-full border border-dashed border-accent2/40" />
            <span className="h-6 w-6 rounded-full bg-[var(--bg)] shadow-[inset_0_0_18px_var(--accent)]" />
          </span>
        </div>
        <div className="mb-3 text-center font-display text-[13px] font-bold uppercase tracking-[0.42em] text-txt">Singularity</div>
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: (step / BOOT_LINES.length) * 100 + "%" }} />
        </div>
        <div className="mt-3 h-16 font-mono text-[9px] uppercase leading-relaxed tracking-[0.16em] text-faint">
          {BOOT_LINES.slice(0, step).map((l) => (
            <div key={l} className="anim-rise"><span className="text-ok">✓</span> {l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const init = useOS((s) => s.init);
  const ready = useOS((s) => s.ready);
  const session = useOS((s) => s.session);
  const s = useSettings();
  const [booted, setBooted] = useState(false);

  useEffect(() => { void init(); }, [init]);
  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 1400);
    return () => window.clearTimeout(t);
  }, []);

  /* keep tokens in sync even before a session exists */
  useEffect(() => {
    const root = document.documentElement;
    const t = themeById(s.theme);
    Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty("--accent", s.accent);
    root.style.setProperty("--accent-2", s.accent2);
    const hex = s.accent.replace("#", "");
    root.style.setProperty("--accent-rgb", [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0).join(","));
    root.style.setProperty("--radius", s.radius + "px");
    root.style.setProperty("--blur", s.blur + "px");
    root.style.setProperty("--panel-op", String(s.panelOpacity));
    root.style.colorScheme = t.light ? "light" : "dark";
  }, [s.theme, s.accent, s.accent2, s.radius, s.blur, s.panelOpacity]);

  return (
    <div className="relative h-full w-full">
      <Background />
      <Overlays />
      {ready && (session ? <Desktop /> : <Auth />)}
      <Boot done={booted && ready} />
    </div>
  );
}

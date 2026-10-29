import { useEffect, useRef } from "react";
import { useSettings } from "@/state/store";
import { useUI } from "@/state/ui";

let fxRoot: HTMLDivElement | null = null;

/** Imperative click feedback — ripple / particle burst / floating value. */
export function spawnClickFx(x: number, y: number, mode: string, label?: string) {
  if (!fxRoot || mode === "none") return;
  const root = fxRoot;
  if (mode === "ripple" || mode === "numbers") {
    const el = document.createElement("div");
    el.className = "click-ripple";
    el.style.left = x + "px"; el.style.top = y + "px";
    root.appendChild(el);
    window.setTimeout(() => el.remove(), 700);
  }
  if (mode === "particles") {
    for (let i = 0; i < 12; i++) {
      const p = document.createElement("div");
      p.className = "click-particle";
      p.style.left = x + "px"; p.style.top = y + "px";
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
      p.style.setProperty("--dx", Math.cos(a) * d + "px");
      p.style.setProperty("--dy", Math.sin(a) * d + "px");
      p.style.animationDelay = Math.random() * 60 + "ms";
      root.appendChild(p);
      window.setTimeout(() => p.remove(), 950);
    }
  }
  if (label) {
    const t = document.createElement("div");
    t.className = "float-text";
    t.textContent = label;
    t.style.left = x + "px"; t.style.top = y + "px";
    root.appendChild(t);
    window.setTimeout(() => t.remove(), 1000);
  }
}

function Weather({ snow, rain, trail }: { snow: boolean; rain: boolean; trail: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { cv.width = window.innerWidth * dpr; cv.height = window.innerHeight * dpr; };
    resize();
    window.addEventListener("resize", resize);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff9f45";

    type P = { x: number; y: number; v: number; s: number; d: number };
    const parts: P[] = [];
    const count = rain ? 220 : 130;
    if (snow || rain) {
      for (let i = 0; i < count; i++) {
        parts.push({
          x: Math.random() * cv.width, y: Math.random() * cv.height,
          v: rain ? 9 + Math.random() * 12 : 0.5 + Math.random() * 1.6,
          s: rain ? 1 + Math.random() : 1 + Math.random() * 2.4,
          d: Math.random() * 2 - 1,
        });
      }
    }
    const trailPts: { x: number; y: number; t: number }[] = [];
    const onMove = (e: PointerEvent) => {
      if (!trail) return;
      trailPts.push({ x: e.clientX * dpr, y: e.clientY * dpr, t: performance.now() });
      if (trailPts.length > 44) trailPts.shift();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (snow || rain) {
        ctx.strokeStyle = "rgba(255,255,255,0.42)";
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        parts.forEach((p) => {
          p.y += p.v * dpr;
          p.x += (rain ? 1.4 : Math.sin(p.y * 0.01 + p.d) * 0.7) * dpr;
          if (p.y > cv.height) { p.y = -10; p.x = Math.random() * cv.width; }
          if (p.x > cv.width) p.x = 0;
          if (rain) {
            ctx.lineWidth = p.s * 0.7 * dpr;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 1.4 * dpr, p.y - p.v * 1.6 * dpr); ctx.stroke();
          } else {
            ctx.globalAlpha = 0.35 + p.s / 5;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.s * dpr, 0, 6.283); ctx.fill();
            ctx.globalAlpha = 1;
          }
        });
      }
      if (trail && trailPts.length) {
        const now = performance.now();
        for (let i = trailPts.length - 1; i >= 0; i--) {
          const pt = trailPts[i];
          const age = (now - pt.t) / 620;
          if (age > 1) { trailPts.splice(i, 1); continue; }
          ctx.globalAlpha = (1 - age) * 0.55;
          ctx.fillStyle = accent;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, (1 - age) * 6 * dpr, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", onMove); };
  }, [snow, rain, trail]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[66] h-full w-full" />;
}

export default function Overlays() {
  const s = useSettings();
  const stealth = useUI((u) => u.stealth);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { fxRoot = rootRef.current; return () => { fxRoot = null; }; }, []);
  const active = (s.fxSnow || s.fxRain || s.fxTrail) && !stealth;

  return (
    <>
      {s.wallpaper && !stealth && (
        <div
          className="pointer-events-none fixed inset-0 z-[1] transition-opacity duration-500"
          style={{
            backgroundImage: `url("${s.wallpaper}")`,
            backgroundSize: s.wpFit,
            backgroundRepeat: "no-repeat",
            backgroundPosition: `${s.wpX}% ${s.wpY}%`,
            opacity: s.wpOpacity / 100,
            filter: `blur(${s.wpBlur}px) hue-rotate(${s.hue}deg)`,
            transform: `scale(${s.wpScale / 100}) rotate(${s.wpRotate}deg)`,
            mixBlendMode: s.wpBlend as any,
          }}
        />
      )}
      {s.fxVignette && !stealth && (
        <div className="pointer-events-none fixed inset-0 z-[4]" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 28%, rgba(0,0,0,0.82) 100%)" }} />
      )}
      {active && <Weather snow={s.fxSnow} rain={s.fxRain} trail={s.fxTrail} />}
      {s.fxScan && !stealth && <div className="fx-scan pointer-events-none fixed inset-0 z-[68] opacity-70" />}
      {s.fxGrain && !stealth && <div className="fx-grain pointer-events-none fixed -inset-8 z-[68] opacity-[0.28]" />}
      {s.fxCrt && !stealth && <div className="fx-crt pointer-events-none fixed inset-0 z-[69]" />}
      <div ref={rootRef} className="pointer-events-none fixed inset-0 z-[75] overflow-hidden" />
    </>
  );
}

import React, { useRef } from "react";
import { Minus, Square, X, Copy } from "lucide-react";
import { useUI, type Win } from "@/state/ui";
import { useOS } from "@/state/store";
import { appMeta } from "@/os/apps/meta";
import { cn, clamp } from "@/lib/utils";

export const insets = (mobile: boolean) =>
  mobile ? { l: 6, t: 44, r: 6, b: 70 } : { l: 88, t: 48, r: 10, b: 56 };

export default function WindowFrame({ win, children }: { win: Win; children: React.ReactNode }) {
  const meta = appMeta(win.id);
  const ref = useRef<HTMLDivElement>(null);
  const { focus, close, minimize, toggleMax, setGeom, focused, mobile } = useUI();
  const updateProfile = useOS((s) => s.updateProfile);
  const Icon = meta.icon;
  const active = focused === win.id;

  const commit = (g: { x: number; y: number; w: number; h: number }) => {
    setGeom(win.id, g);
    updateProfile((p) => ({ ...p, geom: { ...p.geom, [win.id]: g } }));
  };

  const startDrag = (e: React.PointerEvent) => {
    if (win.max || e.button !== 0) return;
    const el = ref.current; if (!el) return;
    const startX = e.clientX, startY = e.clientY;
    const ox = win.x, oy = win.y;
    const ins = insets(mobile);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const nx = clamp(ox + ev.clientX - startX, -win.w + 140, window.innerWidth - 120);
      const ny = clamp(oy + ev.clientY - startY, ins.t - 4, window.innerHeight - 60);
      el.style.left = nx + "px"; el.style.top = ny + "px";
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      commit({
        x: clamp(ox + ev.clientX - startX, -win.w + 140, window.innerWidth - 120),
        y: clamp(oy + ev.clientY - startY, ins.t - 4, window.innerHeight - 60),
        w: win.w, h: win.h,
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    const el = ref.current; if (!el) return;
    const sx = e.clientX, sy = e.clientY, ow = win.w, oh = win.h;
    const move = (ev: PointerEvent) => {
      el.style.width = Math.max(340, ow + ev.clientX - sx) + "px";
      el.style.height = Math.max(240, oh + ev.clientY - sy) + "px";
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      commit({ x: win.x, y: win.y, w: Math.max(340, ow + ev.clientX - sx), h: Math.max(240, oh + ev.clientY - sy) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const ins = insets(mobile);
  const style: React.CSSProperties = win.max
    ? { left: ins.l, top: ins.t, width: `calc(100vw - ${ins.l + ins.r}px)`, height: `calc(100vh - ${ins.t + ins.b}px)`, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  if (win.min) return null;

  return (
    <div
      ref={ref}
      data-agent={`win-${win.id}`}
      onPointerDown={() => !active && focus(win.id)}
      style={style}
      className={cn(
        "surface anim-pop pointer-events-auto absolute flex flex-col overflow-hidden rounded-[var(--radius)] transition-shadow duration-200",
        active ? "shadow-[0_28px_80px_-24px_rgba(0,0,0,0.9),0_0_0_1px_rgba(var(--accent-rgb),0.22)]" : "shadow-[0_18px_50px_-24px_rgba(0,0,0,0.85)]"
      )}
    >
      <header
        onPointerDown={startDrag}
        onDoubleClick={() => toggleMax(win.id)}
        className={cn("drag-handle flex h-10 shrink-0 cursor-grab items-center gap-2.5 border-b border-line px-3 active:cursor-grabbing",
          active ? "bg-white/[0.045]" : "bg-transparent")}
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in srgb, ${meta.tint} 18%, transparent)`, color: meta.tint }}>
          <Icon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-txt">{meta.name}</div>
        </div>
        <div className="hidden truncate font-mono text-[9px] uppercase tracking-[0.14em] text-faint md:block">{meta.desc.slice(0, 34)}</div>
        <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => minimize(win.id)} title="Minimise" className="grid h-6 w-6 place-items-center rounded text-faint transition hover:bg-white/10 hover:text-txt"><Minus size={13} /></button>
          <button onClick={() => toggleMax(win.id)} title={win.max ? "Restore" : "Maximise"} className="grid h-6 w-6 place-items-center rounded text-faint transition hover:bg-white/10 hover:text-txt">{win.max ? <Copy size={12} /> : <Square size={11} />}</button>
          <button onClick={() => close(win.id)} title="Close" className="grid h-6 w-6 place-items-center rounded text-faint transition hover:bg-bad hover:text-[#0a0a0c]"><X size={13} /></button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>

      {!win.max && (
        <div onPointerDown={startResize} title="Resize"
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize opacity-40 transition hover:opacity-100"
          style={{ background: "linear-gradient(135deg, transparent 50%, var(--accent) 50%)" }} />
      )}
    </div>
  );
}

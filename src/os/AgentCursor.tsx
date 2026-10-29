import { useUI } from "@/state/ui";
import { MousePointer2, Loader2 } from "lucide-react";

/**
 * The agent's on-screen pointer. It glides to real controls and clicks them,
 * so you can watch KALMIA operate the desktop instead of guessing what it did.
 */
export default function AgentCursor() {
  const c = useUI((u) => u.agentCursor);
  const running = useUI((u) => u.agentRunning);
  const narration = useUI((u) => u.agentNarration);
  if (!c.visible) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed z-[9999] transition-transform duration-75"
        style={{ left: 0, top: 0, transform: `translate3d(${c.x}px, ${c.y}px, 0)` }}
      >
        {c.clicking && (
          <span
            className="absolute -left-5 -top-5 h-10 w-10 rounded-full border-2"
            style={{ borderColor: "var(--accent-2)", animation: "pulse-ring 0.5s ease-out forwards" }}
          />
        )}
        <MousePointer2
          size={22}
          style={{
            color: "var(--accent-2)",
            fill: "var(--accent-2)",
            filter: "drop-shadow(0 0 8px var(--accent-2)) drop-shadow(0 2px 3px rgba(0,0,0,.8))",
            transform: c.clicking ? "scale(0.82)" : "scale(1)",
            transition: "transform .1s",
          }}
        />
        {c.label && (
          <span
            className="absolute left-5 top-5 whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em]"
            style={{
              borderColor: "color-mix(in srgb, var(--accent-2) 50%, transparent)",
              background: "rgba(4,6,12,.92)",
              color: "var(--accent-2)",
            }}
          >
            {c.label}
          </span>
        )}
      </div>

      {running && (
        <div
          className="pointer-events-none fixed left-1/2 top-14 z-[9998] flex -translate-x-1/2 items-center gap-2.5 rounded-full border px-4 py-2"
          style={{
            borderColor: "color-mix(in srgb, var(--accent-2) 45%, transparent)",
            background: "rgba(4,6,12,.92)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent-2)" }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--accent-2)" }}>
            KALMIA is operating your screen
          </span>
          {narration && <span className="max-w-[280px] truncate text-[11px] text-dim">· {narration}</span>}
        </div>
      )}
    </>
  );
}

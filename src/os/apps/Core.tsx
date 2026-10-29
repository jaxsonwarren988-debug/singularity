import { useEffect, useRef, useState } from "react";
import { Zap, Bot, Factory, Orbit, Sparkles, Trophy, RotateCcw, Gauge, Lock } from "lucide-react";
import { useOS, useProfile, setClicker, perSecond, clickerMult, upgradeCost, type Clicker } from "@/state/store";
import { useUI, toast } from "@/state/ui";
import { useSettings } from "@/state/store";
import { fmt, short, cn, clamp } from "@/lib/utils";
import { spawnClickFx } from "@/gfx/Overlays";
import { clickSound, buzz, audio } from "@/lib/audio";
import { Btn, Meter, Slider, Toggle } from "@/ui/kit";

const ACHIEVEMENTS: { id: string; name: string; test: (c: Clicker) => boolean }[] = [
  { id: "first", name: "First Light", test: (c) => c.clicks >= 1 },
  { id: "kilo", name: "Kiloton", test: (c) => c.total >= 1000 },
  { id: "swarm", name: "Drone Swarm", test: (c) => c.drones >= 25 },
  { id: "mega", name: "Megaton", test: (c) => c.total >= 1e6 },
  { id: "industry", name: "Heavy Industry", test: (c) => c.reactors >= 10 },
  { id: "fold", name: "Space Folder", test: (c) => c.folds >= 1 },
  { id: "grind", name: "Carpal Tunnel", test: (c) => c.clicks >= 1000 },
  { id: "reborn", name: "Reborn", test: (c) => c.prestige >= 1 },
];

export default function CoreApp() {
  const c = useProfile().clicker;
  const s = useSettings();
  const firePulse = useUI((u) => u.firePulse);
  const [surgeUntil, setSurgeUntil] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [now, setNow] = useState(Date.now());
  const coreRef = useRef<HTMLButtonElement>(null);
  const surge = now < surgeUntil ? 5 : 1;

  /* passive income + offline catch-up */
  useEffect(() => {
    const os = useOS.getState();
    const cur = os.session ? os.db.profiles[os.session]?.clicker : null;
    if (cur) {
      const away = clamp((Date.now() - (cur.lastTick || Date.now())) / 1000, 0, 4 * 3600);
      const gain = perSecond(cur) * away;
      if (gain > 1) {
        setClicker({ count: cur.count + gain, total: cur.total + gain, lastTick: Date.now() });
        toast("Reactor ran while you were away", `+${short(gain)} mass collected over ${Math.round(away / 60)} min`, "ok");
      } else setClicker({ lastTick: Date.now() });
    }
    const tick = window.setInterval(() => {
      const st = useOS.getState();
      const cc = st.session ? st.db.profiles[st.session]?.clicker : null;
      if (!cc) return;
      const ps = perSecond(cc);
      const auto = cc.autoOn ? cc.power * clickerMult(cc) * (1000 / cc.autoRate) : 0;
      const gain = ps + auto;
      setNow(Date.now());
      setClicker({
        count: cc.count + gain, total: cc.total + gain, lastTick: Date.now(),
        clicks: cc.autoOn ? cc.clicks + Math.round(1000 / cc.autoRate) : cc.clicks,
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  /* achievements */
  useEffect(() => {
    const unlocked = ACHIEVEMENTS.filter((a) => a.test(c) && !c.achievements.includes(a.id));
    if (unlocked.length) {
      setClicker({ achievements: [...c.achievements, ...unlocked.map((a) => a.id)] });
      unlocked.forEach((a) => toast("Achievement unlocked", a.name, "ok"));
      audio.blip(1320, 0.16, 0.05);
    }
  }, [c]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  const doClick = (e?: React.MouseEvent) => {
    const gain = c.power * clickerMult(c) * surge;
    setClicker({ count: c.count + gain, total: c.total + gain, clicks: c.clicks + 1 });
    firePulse();
    clickSound(s); buzz(s.haptics);
    const rect = coreRef.current?.getBoundingClientRect();
    const x = e?.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const y = e?.clientY ?? (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);
    spawnClickFx(x, y, s.clickFx, "+" + short(gain));
  };

  const buy = (kind: "power" | "drones" | "reactors" | "folds", base: number) => {
    const cost = upgradeCost(base, c[kind]);
    if (c.count < cost) { toast("Not enough mass", `Need ${short(cost - c.count)} more`, "warn"); return; }
    setClicker({ count: c.count - cost, [kind]: c[kind] + 1 } as any);
    audio.blip(660, 0.09, 0.05, "square");
  };

  const prestige = () => {
    if (c.total < 250000) { toast("Prestige locked", "Reach 250K lifetime mass first", "warn"); return; }
    setClicker({ count: 0, power: 1, drones: 0, reactors: 0, folds: 0, prestige: c.prestige + 1 });
    toast("Singularity collapsed", `Prestige ${c.prestige + 1} · permanent +50% yield`, "ok");
    firePulse();
  };

  const upgrades = [
    { k: "power" as const, name: "Compression", icon: Zap, base: 25, desc: "+1 mass per click", level: c.power },
    { k: "drones" as const, name: "Harvester Drone", icon: Bot, base: 60, desc: "+1 mass / second", level: c.drones },
    { k: "reactors" as const, name: "Micro Reactor", icon: Factory, base: 900, desc: "+14 mass / second", level: c.reactors },
    { k: "folds" as const, name: "Space Fold", icon: Orbit, base: 12000, desc: "+10% global yield", level: c.folds },
  ];

  const size = 210;
  return (
    <div className="scroll-thin h-full overflow-y-auto p-4">
      <div className="flex flex-wrap gap-4">
        {/* reactor */}
        <div className="flex min-w-[260px] flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-line bg-gradient-to-b from-white/[0.04] to-transparent p-5">
          <div className="flex w-full items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
            <span>reactor · online</span>
            <span className={cn(surge > 1 && "text-accent")}>{surge > 1 ? `SURGE ×5 · ${Math.ceil((surgeUntil - now) / 1000)}s` : `×${clickerMult(c).toFixed(1)} yield`}</span>
          </div>

          <button
            ref={coreRef} onClick={doClick}
            className={cn("group relative grid shrink-0 place-items-center rounded-full border transition-transform duration-150 active:scale-[0.96]", s.coreFloat && "anim-float")}
            style={{
              width: size, height: size,
              borderColor: "var(--line-2)",
              background: "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.06), rgba(0,0,0,0.85) 70%)",
              boxShadow: `0 0 70px -20px var(--accent), inset 0 0 40px -18px var(--accent)`,
            }}
          >
            <span className="spin-slow pointer-events-none absolute -inset-2 rounded-full opacity-60"
              style={{ background: "conic-gradient(from 0deg, transparent, var(--accent), transparent 42%)", filter: "blur(6px)" }} />
            <span className="spin-rev pointer-events-none absolute -inset-5 rounded-full border border-dashed" style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)" }} />
            {s.kawaii && (
              <>
                <span className="pointer-events-none absolute -top-3 left-6 h-0 w-0 rotate-[-16deg]" style={{ borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderBottom: "22px solid #ffc9e2" }} />
                <span className="pointer-events-none absolute -top-3 right-6 h-0 w-0 rotate-[16deg]" style={{ borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderBottom: "22px solid #ffc9e2" }} />
              </>
            )}
            <span className="relative z-10 text-center">
              <span className="block font-display text-[38px] font-bold leading-none text-txt tabular text-glow">{short(c.count)}</span>
              <span className="mt-2 block font-mono text-[9px] uppercase tracking-[0.32em] text-dim">mass</span>
            </span>
            <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ boxShadow: "inset 0 0 60px -20px var(--accent)" }} />
          </button>

          <div className="grid w-full grid-cols-3 gap-2 text-center">
            {[["per click", short(c.power * clickerMult(c) * surge)], ["per second", short(perSecond(c))], ["clicks", short(c.clicks)]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-line bg-white/[0.03] py-2">
                <div className="font-display text-sm font-bold text-accent tabular">{v}</div>
                <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-faint">{l}</div>
              </div>
            ))}
          </div>

          <div className="flex w-full gap-2">
            <Btn variant={surge > 1 ? "primary" : "soft"} className="flex-1" icon={<Sparkles size={13} />}
              disabled={cooldown > 0 && surge === 1}
              onClick={() => { setSurgeUntil(Date.now() + 8000); setCooldown(35); toast("Surge engaged", "×5 yield for 8 seconds", "ok"); firePulse(); }}>
              {surge > 1 ? "SURGING" : cooldown > 0 ? `SURGE ${cooldown}s` : "SURGE ×5"}
            </Btn>
            <Btn variant="outline" icon={<RotateCcw size={13} />} onClick={prestige} title="Reset progress for a permanent multiplier">
              PRESTIGE {c.prestige > 0 && `· ${c.prestige}`}
            </Btn>
          </div>
          <div className="w-full">
            <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
              <span>lifetime {short(c.total)}</span><span>prestige at 250K</span>
            </div>
            <Meter value={Math.min(c.total, 250000)} max={250000} />
          </div>
        </div>

        {/* upgrades */}
        <div className="flex w-full min-w-[260px] flex-1 flex-col gap-3 sm:max-w-[320px]">
          <div className="rounded-2xl border border-line bg-white/[0.025] p-3">
            <div className="mb-2 flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-txt">
              <Gauge size={13} className="text-accent" /> Upgrades
            </div>
            <div className="flex flex-col gap-2">
              {upgrades.map((u) => {
                const cost = upgradeCost(u.base, u.level);
                const afford = c.count >= cost;
                const Icon = u.icon;
                return (
                  <button key={u.k} onClick={() => buy(u.k, u.base)}
                    className={cn("group flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98]",
                      afford ? "border-accent/40 bg-accent/[0.07] hover:bg-accent/[0.13]" : "border-line bg-white/[0.02] opacity-70")}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-txt">{u.name}</span>
                        <span className="font-mono text-[10px] text-dim">lv {u.level}</span>
                      </span>
                      <span className="block truncate text-[10px] text-faint">{u.desc}</span>
                      <span className={cn("mt-0.5 block font-mono text-[10px]", afford ? "text-accent" : "text-bad")}>{short(cost)} mass</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white/[0.025] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-txt"><Bot size={13} className="text-accent2" /> Auto-clicker</span>
              <Toggle on={c.autoOn} onChange={(v) => setClicker({ autoOn: v })} label="Auto clicker" />
            </div>
            <Slider label="Interval" value={c.autoRate} min={60} max={2000} step={20} unit=" ms" onChange={(v) => setClicker({ autoRate: v })} />
            <p className="text-[10px] leading-relaxed text-faint">Fires the reactor automatically. Runs only while this tab is open — passive drones keep earning offline.</p>
          </div>

          <div className="rounded-2xl border border-line bg-white/[0.025] p-3">
            <div className="mb-2 flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-txt"><Trophy size={13} className="text-warn" /> Achievements <span className="ml-auto font-mono text-[10px] text-faint">{c.achievements.length}/{ACHIEVEMENTS.length}</span></div>
            <div className="flex flex-wrap gap-1.5">
              {ACHIEVEMENTS.map((a) => {
                const got = c.achievements.includes(a.id);
                return (
                  <span key={a.id} title={a.name}
                    className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em]",
                      got ? "border-warn/50 bg-warn/10 text-warn" : "border-line text-faint")}>
                    {got ? <Trophy size={9} /> : <Lock size={9} />}{a.name}
                  </span>
                );
              })}
            </div>
          </div>
          <p className="px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">lifetime total {fmt(c.total)} · every value autosaves</p>
        </div>
      </div>
    </div>
  );
}

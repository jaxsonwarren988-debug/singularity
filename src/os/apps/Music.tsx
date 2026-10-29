import { useEffect, useRef, useState } from "react";
import {
  Play, Pause, Waves, CloudRain, Wind, Bell, Radio, Volume2, Sparkles, Flame,
  Coffee, Disc3, Droplets, CloudLightning, Mountain, Activity, Timer, Moon, Brain,
  Bird, HeartPulse, Stars,
} from "lucide-react";
import { audio, type LayerId } from "@/lib/audio";
import { useSettings, setS } from "@/state/store";
import { useUI, toast } from "@/state/ui";
import { Btn, Card, Slider, Section } from "@/ui/kit";
import { cn } from "@/lib/utils";

const LAYERS: { id: LayerId; name: string; desc: string; icon: typeof Waves; group: string }[] = [
  { id: "drone", name: "Deep drone", desc: "Detuned analogue pad", icon: Waves, group: "Tonal" },
  { id: "sub", name: "Event horizon", desc: "38 Hz sub rumble", icon: Mountain, group: "Tonal" },
  { id: "bowl", name: "Singing bowls", desc: "Tibetan partials, 9s cycle", icon: Bell, group: "Tonal" },
  { id: "bells", name: "Orbital bells", desc: "Random pentatonic strikes", icon: Sparkles, group: "Tonal" },
  { id: "rain", name: "Rainfall", desc: "Filtered white-noise band", icon: CloudRain, group: "Nature" },
  { id: "ocean", name: "Ocean swell", desc: "Slow breaking-wave LFO", icon: Droplets, group: "Nature" },
  { id: "stream", name: "Forest stream", desc: "Babbling dual-band water", icon: Droplets, group: "Nature" },
  { id: "birds", name: "Morning birds", desc: "Spatial chirps and calls", icon: Bird, group: "Nature" },
  { id: "crickets", name: "Night crickets", desc: "Soft rhythmic dusk chirps", icon: Activity, group: "Nature" },
  { id: "wind", name: "Solar wind", desc: "Brown-noise sweep", icon: Wind, group: "Nature" },
  { id: "thunder", name: "Thunderstorm", desc: "Random distant rumbles", icon: CloudLightning, group: "Nature" },
  { id: "fire", name: "Campfire", desc: "Crackle transients + warmth", icon: Flame, group: "Nature" },
  { id: "cafe", name: "Coffee shop", desc: "Murmur bed + formants", icon: Coffee, group: "Places" },
  { id: "vinyl", name: "Vinyl crackle", desc: "Surface noise + pops", icon: Disc3, group: "Places" },
  { id: "heartbeat", name: "Slow heartbeat", desc: "Soft double-beat pulse", icon: HeartPulse, group: "Focus" },
  { id: "shimmer", name: "Starlight shimmer", desc: "Slow high-harmonic pad", icon: Stars, group: "Tonal" },
  { id: "brown", name: "Brown noise", desc: "Deep, soft, masking", icon: Activity, group: "Noise" },
  { id: "pink", name: "Pink noise", desc: "Balanced spectrum", icon: Activity, group: "Noise" },
  { id: "binaural", name: "Theta 6.5 Hz", desc: "Binaural relaxation beat", icon: Brain, group: "Focus" },
  { id: "gamma", name: "Gamma 40 Hz", desc: "Amplitude-modulated focus", icon: Radio, group: "Focus" },
];

const PRESETS: { name: string; icon: typeof Waves; levels: Partial<Record<LayerId, number>> }[] = [
  { name: "Deep focus", icon: Brain, levels: { drone: 0.5, rain: 0.35, binaural: 0.25 } },
  { name: "Storm watch", icon: CloudLightning, levels: { rain: 0.75, thunder: 0.6, wind: 0.4 } },
  { name: "Cabin fire", icon: Flame, levels: { fire: 0.7, wind: 0.25, drone: 0.2 } },
  { name: "Night orbit", icon: Moon, levels: { drone: 0.4, bells: 0.5, sub: 0.2 } },
  { name: "Ocean sleep", icon: Droplets, levels: { ocean: 0.8, wind: 0.2, bowl: 0.25 } },
  { name: "Study café", icon: Coffee, levels: { cafe: 0.65, vinyl: 0.2, rain: 0.25 } },
  { name: "Zen bowls", icon: Bell, levels: { bowl: 0.7, stream: 0.35 } },
  { name: "Gamma lock-in", icon: Radio, levels: { gamma: 0.45, brown: 0.35 } },
  { name: "Forest creek", icon: Droplets, levels: { stream: 0.7, wind: 0.3, bells: 0.15 } },
  { name: "Morning garden", icon: Bird, levels: { birds: 0.65, stream: 0.3, shimmer: 0.22 } },
  { name: "Night meadow", icon: Moon, levels: { crickets: 0.5, wind: 0.25, fire: 0.2 } },
  { name: "Grounded pulse", icon: HeartPulse, levels: { heartbeat: 0.38, brown: 0.35, drone: 0.2 } },
  { name: "Starlit sleep", icon: Stars, levels: { shimmer: 0.45, ocean: 0.34, bells: 0.16 } },
  { name: "Void", icon: Mountain, levels: { sub: 0.7, wind: 0.25 } },
  { name: "Silence", icon: Pause, levels: {} },
];

const KEY = "sglr.ambience.v7";
const GROUPS = ["Tonal", "Nature", "Places", "Noise", "Focus"];

export default function MusicApp() {
  const s = useSettings();
  const pendingAudio = useUI((u) => u.pendingAudio);
  const [levels, setLevels] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
  });
  const [master, setMaster] = useState(0.8);
  const [running, setRunning] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const [group, setGroup] = useState("All");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appliedPreset = useRef<number>(0);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(levels)); } catch { /* blocked */ }
  }, [levels]);

  useEffect(() => () => { audio.stopAll(); }, []);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    const next: Record<string, number> = {};
    LAYERS.forEach((l) => {
      const v = p.levels[l.id] ?? 0;
      next[l.id] = v;
      audio.setLayer(l.id, v);
    });
    audio.setMaster(master);
    setLevels(next);
    setRunning(Object.values(next).some((v) => v > 0));
  };

  /* KALMIA agent can start a preset remotely */
  useEffect(() => {
    if (!pendingAudio || pendingAudio.nonce === appliedPreset.current) return;
    appliedPreset.current = pendingAudio.nonce;
    const p = PRESETS.find((x) => x.name.toLowerCase() === pendingAudio.preset.toLowerCase()) || PRESETS[0];
    applyPreset(p);
    toast("Ambience started", p.name, "ok");
  }, [pendingAudio]);

  /* sleep timer */
  useEffect(() => {
    if (sleepLeft <= 0) return;
    const t = window.setInterval(() => {
      setSleepLeft((v) => {
        if (v <= 1) {
          audio.stopAll();
          setRunning(false);
          setLevels({});
          toast("Sleep timer finished", "Ambience faded out", "ok");
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [sleepLeft]);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const data = audio.spectrum();
      const w = cv.width, h = cv.height;
      ctx.clearRect(0, 0, w, h);
      const cs = getComputedStyle(document.documentElement);
      const accent = cs.getPropertyValue("--accent").trim() || "#ff9f45";
      const accent2 = cs.getPropertyValue("--accent-2").trim() || "#6ee7ff";
      const bars = 48, bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = (data[i] || 0) / 255;
        const bh = Math.max(2, v * h * 0.92);
        const grad = ctx.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, accent + "cc");
        grad.addColorStop(1, accent2 + "cc");
        ctx.fillStyle = grad;
        ctx.fillRect(i * bw + 1.5, h - bh, bw - 3, bh);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setLevel = (id: LayerId, v: number) => {
    setLevels((l) => ({ ...l, [id]: v }));
    audio.setLayer(id, v);
    audio.setMaster(master);
    setRunning(Object.values({ ...levels, [id]: v }).some((x) => x > 0));
  };

  const toggleAll = () => {
    if (running) { LAYERS.forEach((l) => audio.setLayer(l.id, 0)); setRunning(false); }
    else if (Object.values(levels).some((v) => v > 0)) {
      LAYERS.forEach((l) => audio.setLayer(l.id, levels[l.id] || 0));
      audio.setMaster(master); setRunning(true);
    } else applyPreset(PRESETS[0]);
  };

  const activeCount = Object.values(levels).filter((v) => v > 0).length;
  const shown = group === "All" ? LAYERS : LAYERS.filter((l) => l.group === group);

  return (
    <div className="scroll-thin h-full overflow-y-auto p-4">
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={toggleAll}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-accent bg-accent/15 text-accent transition hover:bg-accent hover:text-[#0a0a0c]">
            {running ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold text-txt">Generative ambience</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              {running ? `${activeCount} layer${activeCount === 1 ? "" : "s"} synthesising live` : "paused"} · 16 layers · no audio files
            </div>
          </div>
          <div className="w-32">
            <Slider label="Master" value={Math.round(master * 100)} min={0} max={100} unit="%"
              onChange={(v) => { setMaster(v / 100); audio.setMaster(v / 100); }} />
          </div>
        </div>
        <canvas ref={canvasRef} width={640} height={84} className="mt-3 h-[84px] w-full rounded-lg bg-black/40" />
      </Card>

      <Section title="Presets" hint="One click blends a full scene">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const on = running && Object.entries(p.levels).every(([k, v]) => Math.abs((levels[k] || 0) - (v as number)) < 0.02);
            return (
              <button key={p.name} onClick={() => applyPreset(p)}
                className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all active:scale-95",
                  on ? "border-accent bg-accent/12 text-accent" : "border-line bg-white/[0.025] text-dim hover:border-accent/50 hover:text-txt")}>
                <Icon size={14} className="shrink-0" />
                <span className="truncate text-[11.5px] font-medium">{p.name}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Sleep timer" hint="Fades everything out and stops"
        right={sleepLeft > 0 ? <span className="font-mono text-[11px] text-accent">{Math.floor(sleepLeft / 60)}:{String(sleepLeft % 60).padStart(2, "0")}</span> : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <Timer size={14} className="text-faint" />
          {[0, 10, 20, 30, 45, 60, 90].map((m) => (
            <Btn key={m} size="xs" variant={sleepMin === m ? "soft" : "outline"}
              onClick={() => { setSleepMin(m); setSleepLeft(m * 60); if (m === 0) toast("Sleep timer off"); }}>
              {m === 0 ? "Off" : m + " min"}
            </Btn>
          ))}
        </div>
      </Section>

      <Section title="Layers" hint="Blend as many as you like — every layer is generated in real time"
        right={
          <div className="flex gap-1">
            {["All", ...GROUPS].map((g) => (
              <button key={g} onClick={() => setGroup(g)}
                className={cn("rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition",
                  group === g ? "bg-accent/15 text-accent" : "text-faint hover:text-dim")}>{g}</button>
            ))}
          </div>
        }>
        <div className="grid gap-2 sm:grid-cols-2">
          {shown.map((l) => {
            const Icon = l.icon;
            const v = levels[l.id] || 0;
            return (
              <div key={l.id} className={cn("rounded-xl border p-3 transition-colors", v > 0 ? "border-accent/40 bg-accent/[0.06]" : "border-line bg-white/[0.02]")}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon size={14} className={v > 0 ? "text-accent" : "text-faint"} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-txt">{l.name}</div>
                    <div className="truncate text-[10px] text-faint">{l.desc}</div>
                  </div>
                  <span className="font-mono text-[10px] text-accent">{Math.round(v * 100)}</span>
                </div>
                <input type="range" min={0} max={100} value={Math.round(v * 100)}
                  style={{ ["--pct" as any]: v * 100 + "%" }}
                  onChange={(e) => setLevel(l.id, Number(e.target.value) / 100)} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Interface click designer">
        <div className="grid gap-x-5 sm:grid-cols-2">
          <Slider label="Pitch" value={s.pitch} min={80} max={2400} unit=" Hz" onChange={(v) => setS({ pitch: v })} />
          <Slider label="Volume" value={s.volume} min={0} max={40} unit="%" onChange={(v) => setS({ volume: v })} />
          <Slider label="Variation" value={s.variation} min={0} max={100} unit="%" onChange={(v) => setS({ variation: v })} />
        </div>
        <Btn variant="soft" icon={<Volume2 size={13} />} onClick={() => audio.click(s)}>Preview reactor click</Btn>
      </Section>
    </div>
  );
}

import { useRef, useState } from "react";
import {
  Palette, Waves, Sparkles, LayoutGrid, Volume2, Bot, ShieldAlert, Database,
  Upload, Trash2, Download, RotateCcw, Eye, Lock, Check,
} from "lucide-react";
import { useOS, useProfile, setS, useSettings } from "@/state/store";
import { useUI, toast } from "@/state/ui";
import { THEMES, SHADERS, CLOAKS } from "@/lib/themes";
import { Btn, Chips, Row, Section, Slider, Toggle, TextInput, Card, Modal } from "@/ui/kit";
import { cn, compressImage, download, bytes } from "@/lib/utils";
import { audio } from "@/lib/audio";

const ACCENTS = ["#ff9f45", "#6ee7ff", "#9ef01a", "#ff8fc4", "#ffd166", "#c4b5fd", "#2dd4bf", "#ff4d6d", "#4d9fff", "#f4f4f5"];
const CATS = [
  { id: "look", name: "Appearance", icon: Palette },
  { id: "render", name: "Renderer", icon: Waves },
  { id: "fx", name: "Effects", icon: Sparkles },
  { id: "ui", name: "Interface", icon: LayoutGrid },
  { id: "sound", name: "Audio", icon: Volume2 },
  { id: "ai", name: "Assistant", icon: Bot },
  { id: "privacy", name: "Privacy", icon: ShieldAlert },
  { id: "data", name: "Data", icon: Database },
] as const;
type Cat = (typeof CATS)[number]["id"];

const shaderPreview: Record<string, string> = {
  blackhole: "radial-gradient(circle at 50% 50%, #000 22%, var(--accent) 30%, transparent 55%)",
  nebula: "radial-gradient(circle at 30% 40%, var(--accent), transparent 60%), radial-gradient(circle at 70% 60%, var(--accent-2), transparent 55%)",
  aurora: "linear-gradient(180deg, #04121f, var(--accent-2) 60%, var(--accent))",
  matrix: "repeating-linear-gradient(90deg, #000 0 4px, var(--accent) 4px 5px)",
  warp: "repeating-conic-gradient(from 0deg, var(--accent) 0deg 3deg, transparent 3deg 12deg)",
  plasma: "linear-gradient(120deg, var(--accent), var(--accent-2), var(--accent))",
  grid: "linear-gradient(180deg, #12002a 45%, var(--accent) 46%, #0a0018 47%), repeating-linear-gradient(90deg, transparent 0 8px, var(--accent-2) 8px 9px)",
  ocean: "linear-gradient(200deg, var(--accent-2), #02121f 70%)",
  cells: "radial-gradient(circle at 25% 30%, var(--accent) 8%, transparent 9%), radial-gradient(circle at 70% 65%, var(--accent-2) 10%, transparent 11%)",
  fractal: "conic-gradient(from 45deg, var(--accent), var(--accent-2), var(--accent))",
  ribbons: "repeating-linear-gradient(115deg, var(--accent) 0 2px, transparent 2px 10px)",
  storm: "linear-gradient(160deg, #05070f, var(--accent-2) 70%, #fff)",
  fireflies: "radial-gradient(circle at 20% 60%, var(--accent) 3%, transparent 6%), radial-gradient(circle at 65% 35%, var(--accent-2) 3%, transparent 6%), radial-gradient(circle at 82% 75%, var(--accent) 2%, transparent 5%), #060a10",
  hexfield: "repeating-conic-gradient(from 30deg, var(--accent) 0deg 2deg, transparent 2deg 60deg), #06080f",
  lava: "radial-gradient(circle at 40% 60%, #fff2c0 4%, var(--accent) 22%, #2a0b06 70%)",
  snowfall: "linear-gradient(180deg, #0a1524, var(--accent-2) 140%)",
  vortex: "conic-gradient(from 0deg at 50% 50%, transparent, var(--accent), transparent 40%, var(--accent-2), transparent 80%)",
  circuit: "repeating-linear-gradient(0deg, transparent 0 7px, var(--accent) 7px 8px), repeating-linear-gradient(90deg, transparent 0 11px, var(--accent-2) 11px 12px)",
};

export default function ModulesApp() {
  const s = useSettings();
  const prof = useProfile();
  const os = useOS();
  const ui = useUI();
  const [cat, setCat] = useState<Cat>("look");
  const [confirmReset, setConfirmReset] = useState<null | "settings" | "all">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const storageUsed = (() => { try { return new Blob([localStorage.getItem("singularity.db.v6") || ""]).size; } catch { return 0; } })();

  return (
    <div className="flex h-full">
      <nav className="scroll-thin flex w-[150px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-black/20 p-2">
        {CATS.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-all",
                cat === c.id ? "bg-accent/14 text-accent" : "text-dim hover:bg-white/[0.05] hover:text-txt")}>
              <Icon size={14} /> {c.name}
            </button>
          );
        })}
        <div className="mt-auto rounded-lg border border-line px-2 py-2 font-mono text-[8px] uppercase leading-relaxed tracking-[0.14em] text-faint">
          autosave on<br /><span className="text-ok">● live</span> {bytes(storageUsed)}
        </div>
      </nav>

      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto p-4">
        {cat === "look" && (
          <>
            <Section title="System theme" hint="Colour, contrast and mood of the entire OS">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2">
                {THEMES.map((t) => (
                  <button key={t.id} onClick={() => setS({ theme: t.id, accent: t.vars["--accent"], accent2: t.vars["--accent-2"] })}
                    className={cn("group overflow-hidden rounded-xl border p-2.5 text-left transition-all active:scale-[0.98]",
                      s.theme === t.id ? "border-accent bg-accent/10" : "border-line bg-white/[0.02] hover:border-line2")}>
                    <div className="mb-2 flex h-9 overflow-hidden rounded-md" style={{ background: t.vars["--bg"] }}>
                      <span className="h-full w-1/3" style={{ background: t.vars["--accent"] }} />
                      <span className="h-full w-1/3" style={{ background: t.vars["--accent-2"] }} />
                      <span className="h-full flex-1" style={{ background: t.vars["--panel-2"] }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-display text-[12px] font-semibold text-txt">{t.name}</span>
                      {s.theme === t.id && <Check size={12} className="text-accent" />}
                    </div>
                    <div className="text-[10px] text-faint">{t.blurb}</div>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Accent" hint="Drives glow, shaders, charts and focus rings">
              <div className="mb-3 flex flex-wrap gap-2">
                {ACCENTS.map((a) => (
                  <button key={a} onClick={() => setS({ accent: a })} title={a}
                    className={cn("h-8 w-8 rounded-full border-2 transition-transform hover:scale-110", s.accent.toLowerCase() === a ? "border-txt scale-110" : "border-transparent")}
                    style={{ background: a, boxShadow: `0 0 16px -3px ${a}` }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-[11px] text-dim">Primary
                  <input type="color" value={s.accent} onChange={(e) => setS({ accent: e.target.value })} className="h-9 w-16" />
                </label>
                <label className="flex items-center gap-2 text-[11px] text-dim">Secondary
                  <input type="color" value={s.accent2} onChange={(e) => setS({ accent2: e.target.value })} className="h-9 w-16" />
                </label>
              </div>
            </Section>

            <Section title="Wallpaper" hint="Layered above the shader, below the desktop">
              <div className="mb-3 h-24 overflow-hidden rounded-xl border border-dashed border-line bg-white/[0.02]"
                style={s.wallpaper ? { backgroundImage: `url("${s.wallpaper}")`, backgroundSize: "cover", backgroundPosition: "center", borderStyle: "solid" } : undefined}>
                {!s.wallpaper && <div className="grid h-full place-items-center font-mono text-[10px] uppercase tracking-[0.2em] text-faint">no image</div>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                toast("Processing image…");
                try { setS({ wallpaper: await compressImage(f, 1600, 0.72) }); toast("Wallpaper set", undefined, "ok"); }
                catch { toast("Could not read that image", undefined, "bad"); }
                e.target.value = "";
              }} />
              <div className="mb-3 flex flex-wrap gap-2">
                <Btn icon={<Upload size={13} />} onClick={() => fileRef.current?.click()}>Upload</Btn>
                <Btn variant="danger" icon={<Trash2 size={13} />} onClick={() => setS({ wallpaper: "" })}>Clear</Btn>
              </div>
              <TextInput placeholder="…or paste an image URL" onKeyDown={(e) => {
                if (e.key === "Enter") { setS({ wallpaper: (e.target as HTMLInputElement).value.trim() }); toast("Wallpaper URL applied", undefined, "ok"); }
              }} />
              <div className="mt-3 grid gap-x-5 sm:grid-cols-2">
                <Slider label="Opacity" value={s.wpOpacity} min={0} max={100} unit="%" onChange={(v) => setS({ wpOpacity: v })} />
                <Slider label="Blur" value={s.wpBlur} min={0} max={40} unit=" px" onChange={(v) => setS({ wpBlur: v })} />
                <Slider label="Scale" value={s.wpScale} min={100} max={300} unit="%" onChange={(v) => setS({ wpScale: v })} />
                <Slider label="Rotation" value={s.wpRotate} min={-180} max={180} unit="°" onChange={(v) => setS({ wpRotate: v })} />
                <Slider label="Position X" value={s.wpX} min={0} max={100} unit="%" onChange={(v) => setS({ wpX: v })} />
                <Slider label="Position Y" value={s.wpY} min={0} max={100} unit="%" onChange={(v) => setS({ wpY: v })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><div className="mb-1.5 text-[11px] text-dim">Fit</div>
                  <Chips options={[{ v: "cover", label: "Cover" }, { v: "contain", label: "Contain" }]} value={s.wpFit} onChange={(v) => setS({ wpFit: v })} cols={2} /></div>
                <div><div className="mb-1.5 text-[11px] text-dim">Blend mode</div>
                  <Chips options={["normal", "overlay", "screen", "multiply", "soft-light"].map((v) => ({ v, label: v.slice(0, 5) }))} value={s.wpBlend} onChange={(v) => setS({ wpBlend: v })} cols={5} /></div>
              </div>
            </Section>
          </>
        )}

        {cat === "render" && (
          <>
            <Section title="Background renderer" hint="GPU fragment shaders — switch live, no reload"
              right={<Toggle on={s.shaderOn} onChange={(v) => setS({ shaderOn: v })} label="Shader enabled" />}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                {SHADERS.map((sh) => (
                  <button key={sh.id} onClick={() => setS({ shader: sh.id, shaderOn: true })}
                    className={cn("overflow-hidden rounded-xl border text-left transition-all active:scale-[0.98]",
                      s.shader === sh.id ? "border-accent bg-accent/10" : "border-line bg-white/[0.02] hover:border-line2")}>
                    <div className="h-12 w-full opacity-80" style={{ background: shaderPreview[sh.id] }} />
                    <div className="p-2">
                      <div className="font-display text-[12px] font-semibold text-txt">{sh.name}</div>
                      <div className="text-[10px] leading-tight text-faint">{sh.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Parameters">
              <div className="grid gap-x-5 sm:grid-cols-2">
                <Slider label="Flow speed" value={s.shaderSpeed} min={0} max={300} unit="%" onChange={(v) => setS({ shaderSpeed: v })} />
                <Slider label="Emission" value={s.shaderIntensity} min={0} max={250} unit="%" onChange={(v) => setS({ shaderIntensity: v })} />
                <Slider label="Zoom" value={s.shaderScale} min={40} max={180} unit="%" onChange={(v) => setS({ shaderScale: v })} />
                <Slider label="Chromatic aberration" value={s.aberration} min={0} max={300} unit="%" onChange={(v) => setS({ aberration: v })} />
              </div>
              <div className="mb-3">
                <div className="mb-1.5 text-[11px] text-dim">Render quality (resolution scale)</div>
                <Chips options={[{ v: 0.5, label: "Low" }, { v: 0.7, label: "Medium" }, { v: 0.85, label: "High" }, { v: 1, label: "Ultra" }]} value={s.quality} onChange={(v) => setS({ quality: v })} cols={4} />
              </div>
              <Row label="Accretion disk" sub="event horizon shader"><Toggle on={s.disk} onChange={(v) => setS({ disk: v })} /></Row>
              <Row label="Gravitational lensing" sub="bends the starfield"><Toggle on={s.lens} onChange={(v) => setS({ lens: v })} /></Row>
              <Row label="Starfield" sub="procedural stars"><Toggle on={s.stars} onChange={(v) => setS({ stars: v })} /></Row>
              <Row label="Pointer parallax" sub="scene follows the cursor"><Toggle on={s.parallax} onChange={(v) => setS({ parallax: v })} /></Row>
            </Section>
          </>
        )}

        {cat === "fx" && (
          <>
            <Section title="Screen effects">
              <Row label="Vignette" sub="darkened edges"><Toggle on={s.fxVignette} onChange={(v) => setS({ fxVignette: v })} /></Row>
              <Row label="Scanlines" sub="CRT raster lines"><Toggle on={s.fxScan} onChange={(v) => setS({ fxScan: v })} /></Row>
              <Row label="Film grain" sub="animated sensor noise"><Toggle on={s.fxGrain} onChange={(v) => setS({ fxGrain: v })} /></Row>
              <Row label="CRT curvature glow" sub="tube monitor falloff"><Toggle on={s.fxCrt} onChange={(v) => setS({ fxCrt: v })} /></Row>
              <Row label="Snowfall" sub="drifting particles"><Toggle on={s.fxSnow} onChange={(v) => setS({ fxSnow: v, fxRain: false })} /></Row>
              <Row label="Rain" sub="streaking downpour"><Toggle on={s.fxRain} onChange={(v) => setS({ fxRain: v, fxSnow: false })} /></Row>
              <Row label="Cursor trail" sub="comet follow"><Toggle on={s.fxTrail} onChange={(v) => setS({ fxTrail: v })} /></Row>
            </Section>
            <Section title="Colour grade">
              <div className="grid gap-x-5 sm:grid-cols-2">
                <Slider label="Hue rotate" value={s.hue} min={0} max={360} unit="°" onChange={(v) => setS({ hue: v })} />
                <Slider label="Saturation" value={s.saturation} min={0} max={250} unit="%" onChange={(v) => setS({ saturation: v })} />
                <Slider label="Bloom" value={s.fxBloom} min={0} max={100} unit="%" onChange={(v) => setS({ fxBloom: v })} />
              </div>
              <Row label="Invert colours" sub="negative render"><Toggle on={s.invert} onChange={(v) => setS({ invert: v })} /></Row>
            </Section>
            <Section title="Click feedback">
              <Chips options={[{ v: "ripple", label: "Ripple" }, { v: "particles", label: "Particles" }, { v: "numbers", label: "Numbers" }, { v: "none", label: "None" }]} value={s.clickFx} onChange={(v) => setS({ clickFx: v })} cols={4} />
            </Section>
          </>
        )}

        {cat === "ui" && (
          <Section title="Interface">
            <div className="grid gap-x-5 sm:grid-cols-2">
              <Slider label="Desktop zoom" value={s.uiScale} min={70} max={130} unit="%" onChange={(v) => setS({ uiScale: v })} />
              <Slider label="Corner radius" value={s.radius} min={0} max={26} unit=" px" onChange={(v) => setS({ radius: v })} />
              <Slider label="Glass blur" value={s.blur} min={0} max={40} unit=" px" onChange={(v) => setS({ blur: v })} />
              <Slider label="Panel opacity" value={s.panelOpacity} min={40} max={100} unit="%" onChange={(v) => setS({ panelOpacity: v })} />
            </div>
            <Row label="Dock labels" sub="names under launcher icons"><Toggle on={s.dockLabels} onChange={(v) => setS({ dockLabels: v })} /></Row>
            <Row label="FPS readout" sub="top bar telemetry"><Toggle on={s.showFps} onChange={(v) => setS({ showFps: v })} /></Row>
            <Row label="24-hour clock"><Toggle on={s.clock24} onChange={(v) => setS({ clock24: v })} /></Row>
            <Row label="Reduce motion" sub="calm animations"><Toggle on={s.reduceMotion} onChange={(v) => setS({ reduceMotion: v })} /></Row>
            <Row label="Floating reactor" sub="gentle bob"><Toggle on={s.coreFloat} onChange={(v) => setS({ coreFloat: v })} /></Row>
            <Row label="Kawaii mode" sub="pastel ears on the core"><Toggle on={s.kawaii} onChange={(v) => setS({ kawaii: v, accent: v ? "#ff8fc4" : s.accent })} /></Row>
          </Section>
        )}

        {cat === "sound" && (
          <Section title="Audio" hint="Synthesised live with WebAudio — no files, no loading">
            <Row label="Interface sound"><Toggle on={s.sound} onChange={(v) => setS({ sound: v })} /></Row>
            <Row label="Haptics" sub="vibration on supported devices"><Toggle on={s.haptics} onChange={(v) => setS({ haptics: v })} /></Row>
            <div className="my-3">
              <div className="mb-1.5 text-[11px] text-dim">Click waveform</div>
              <Chips options={["sine", "square", "sawtooth", "triangle", "noise", "none"].map((v) => ({ v, label: v.slice(0, 6) }))} value={s.wave} onChange={(v) => setS({ wave: v })} cols={6} />
            </div>
            <div className="grid gap-x-5 sm:grid-cols-2">
              <Slider label="Pitch" value={s.pitch} min={80} max={2400} unit=" Hz" onChange={(v) => setS({ pitch: v })} />
              <Slider label="Volume" value={s.volume} min={0} max={40} unit="%" onChange={(v) => setS({ volume: v })} />
              <Slider label="Pitch variation" value={s.variation} min={0} max={100} unit="%" onChange={(v) => setS({ variation: v })} />
            </div>
            <Btn variant="soft" onClick={() => audio.click(s)}>Preview click</Btn>
          </Section>
        )}

        {cat === "ai" && (
          <Section title="KALMIA & NOVA Intelligence" hint="Autonomous vision & work agent + free keyless cloud endpoint">
            <div className="mb-3">
              <div className="mb-1 text-[11px] text-dim">Active AI Persona</div>
              <Chips
                options={[
                  { v: "kalmia", label: "KALMIA-4 (Vision & Work)" },
                  { v: "kalmia-code", label: "KALMIA-Code (App Builder)" },
                  { v: "nova", label: "NOVA-Kernel (OS Shell)" },
                ]}
                value={s.aiPersona || "kalmia"}
                onChange={(v) => setS({ aiPersona: v })}
                cols={3}
              />
            </div>
            <Row label="Cloud neural model" sub="uses free Pollinations AI by default or your own API key"><Toggle on={s.aiCloud} onChange={(v) => setS({ aiCloud: v })} /></Row>
            <div className="mt-3 flex flex-col gap-2.5">
              <div>
                <div className="mb-1 text-[11px] text-dim">Provider preset</div>
                <Chips options={[
                  { v: "https://text.pollinations.ai/openai", label: "Kalmia Cloud (Free)" },
                  { v: "https://api.openai.com/v1", label: "OpenAI" },
                  { v: "https://api.groq.com/openai/v1", label: "Groq" },
                  { v: "https://openrouter.ai/api/v1", label: "OpenRouter" },
                ]} value={s.aiBase} onChange={(v) => setS({ aiBase: v, aiModel: v.includes("pollinations") ? "openai" : v.includes("groq") ? "llama-3.3-70b-versatile" : v.includes("openrouter") ? "openai/gpt-4o-mini" : "gpt-4o-mini" })} cols={4} />
              </div>
              <label className="block"><span className="mb-1 block text-[11px] text-dim">Base URL</span>
                <TextInput value={s.aiBase} onChange={(e) => setS({ aiBase: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-[11px] text-dim">Model</span>
                <TextInput value={s.aiModel} onChange={(e) => setS({ aiModel: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-[11px] text-dim">API key</span>
                <TextInput type="password" placeholder="sk-…" value={s.aiKey} onChange={(e) => setS({ aiKey: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-[11px] text-dim">System prompt</span>
                <textarea className="field h-20 resize-none" value={s.aiSystem} onChange={(e) => setS({ aiSystem: e.target.value })} /></label>
              <p className="text-[10px] leading-relaxed text-faint">Keys are stored only in this browser's local storage and sent directly to the endpoint you choose. Never share a device with a key you care about.</p>
            </div>
          </Section>
        )}

        {cat === "privacy" && (
          <>
            <Section title="Tab cloak" hint="Rewrites the tab title and favicon">
              <Chips options={CLOAKS.map((c) => ({ v: c.id, label: c.name }))} value={s.cloak} onChange={(v) => setS({ cloak: v })} cols={3} />
            </Section>
            <Section title="Panic & lock">
              <Row label="Stealth screen" sub="Shift + S · hides everything instantly"><Toggle on={ui.stealth} onChange={(v) => ui.setStealth(v)} /></Row>
              <Row label="Auto-lock after inactivity" sub="0 = never">
                <div className="w-36"><Slider label="" value={s.autoLockMin} min={0} max={60} unit=" min" onChange={(v) => setS({ autoLockMin: v })} /></div>
              </Row>
              <div className="mt-3 flex gap-2">
                <Btn icon={<Eye size={13} />} onClick={() => ui.setStealth(true)}>Hide now</Btn>
                <Btn icon={<Lock size={13} />} onClick={() => ui.setLocked(true)}>Lock session</Btn>
              </div>
            </Section>
          </>
        )}

        {cat === "data" && (
          <>
            <Section title="Account">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg font-bold text-txt">{os.session}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                      role {os.session ? os.db.users[os.session]?.role : "?"} · joined {new Date(prof.created).toLocaleDateString()}
                    </div>
                  </div>
                  <Btn variant="danger" onClick={() => os.logout()}>Sign out</Btn>
                </div>
              </Card>
            </Section>
            <Section title="Storage" hint={`${bytes(storageUsed)} used of ~5 MB local quota`}>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-accent" style={{ width: Math.min(100, (storageUsed / 5242880) * 100) + "%" }} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn icon={<Download size={13} />} onClick={() => { download(`singularity-${os.session}.json`, os.exportDB(), "application/json"); toast("Backup downloaded", undefined, "ok"); }}>Export backup</Btn>
                <Btn icon={<Upload size={13} />} onClick={() => importRef.current?.click()}>Import backup</Btn>
                <input ref={importRef} type="file" accept="application/json" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const text = await f.text();
                  const ok = os.importDB(text);
                  toast(ok ? "Backup merged" : "Invalid backup file", undefined, ok ? "ok" : "bad");
                  e.target.value = "";
                }} />
              </div>
            </Section>
            <Section title="Danger zone">
              <div className="flex flex-wrap gap-2">
                <Btn variant="danger" icon={<RotateCcw size={13} />} onClick={() => setConfirmReset("settings")}>Reset modules</Btn>
                <Btn variant="danger" icon={<Trash2 size={13} />} onClick={() => setConfirmReset("all")}>Wipe my profile</Btn>
              </div>
            </Section>
          </>
        )}
      </div>

      <Modal open={confirmReset !== null} title="Confirm reset" onClose={() => setConfirmReset(null)}
        footer={<>
          <Btn variant="ghost" onClick={() => setConfirmReset(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => {
            if (confirmReset === "settings") { os.resetSettings(); toast("Modules restored to defaults", undefined, "ok"); }
            else { os.resetAll(); toast("Profile wiped clean", undefined, "ok"); }
            setConfirmReset(null);
          }}>Yes, reset</Btn>
        </>}>
        {confirmReset === "settings"
          ? "Every visual, audio and interface module returns to factory defaults. Your reactor progress, notes and links are kept."
          : "This erases your reactor progress, notes, tasks, links and chat history for this account. It cannot be undone."}
      </Modal>
    </div>
  );
}

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ExternalLink, RotateCw, Maximize, Star, Search, Gamepad2,
  Wifi, Cpu, Plus, Upload, Trash2, Sparkles, ShieldOff, Play,
} from "lucide-react";
import { useOS, useProfile } from "@/state/store";
import { openApp, toast } from "@/state/ui";
import { Btn, Chips, IconBtn, Empty, Card, TextInput } from "@/ui/kit";
import { cn, uid } from "@/lib/utils";
import { GSlope3D, GGeometryDash, GVoidSurvivors, GCyberDoom } from "@/os/apps/games-modern";
import { GTetrisEffect, GJetpack, GCyberSlash, G2048 } from "@/os/apps/games-native";
import { GNeonDrift, GStackTower, GMinesweeper, GWordCipher } from "@/os/apps/games-extra";
import { DIRECTORY } from "@/lib/web";

interface Entry {
  id: string;
  name: string;
  tag: string;
  status: "flagship" | "custom" | "trusted" | "working";
  accent: string;
  url?: string;
  html?: string;
  el?: React.ReactNode;
  blurb: string;
}

const FLAGSHIP: Entry[] = [
  {
    id: "g-slope3d",
    name: "Slope 3D: Hyper Run",
    tag: "3D Endless Runner",
    status: "flagship",
    accent: "#39ff88",
    el: <GSlope3D />,
    blurb: "Full 3D perspective neon downhill ball runner with jump ramps, hyper boosts, moving hazards & skins",
  },
  {
    id: "g-gdash",
    name: "Geometry Dash: Neon Pulse",
    tag: "Rhythm Platformer",
    status: "flagship",
    accent: "#00f2ff",
    el: <GGeometryDash />,
    blurb: "Cube + Ship portals, jump orbs, launch pads, practice checkpoints & 3 synth levels",
  },
  {
    id: "g-survivors",
    name: "Void Survivors",
    tag: "Bullet-Heaven Roguelite",
    status: "flagship",
    accent: "#ff8fc4",
    el: <GVoidSurvivors />,
    blurb: "Swarm survival roguelite — auto-firing plasma orbitals, Tesla chain lightning, XP gems & upgrade cards",
  },
  {
    id: "g-doom3d",
    name: "Cyber Doom 3D",
    tag: "3D First-Person Shooter",
    status: "flagship",
    accent: "#ff4d6d",
    el: <GCyberDoom />,
    blurb: "First-person 3D raycast shooter — hunt cyber-drones across sectors with a plasma rifle",
  },
  {
    id: "g-tetris",
    name: "Tetris Effect: Overdrive",
    tag: "Modern Block Puzzle",
    status: "flagship",
    accent: "#c4b5fd",
    el: <GTetrisEffect />,
    blurb: "7-bag guideline Tetris with ghost piece, Hold queue (C), Next preview & hard drop",
  },
  {
    id: "g-jetpack",
    name: "Jetpack Overdrive",
    tag: "Action Runner",
    status: "flagship",
    accent: "#ff9f45",
    el: <GJetpack />,
    blurb: "High-speed jetpack runner — dodge electric zappers, lock-on homing missiles & grab coins",
  },
  {
    id: "g-slash",
    name: "Cyber Slash",
    tag: "Blade Arcade",
    status: "flagship",
    accent: "#6ee7ff",
    el: <GCyberSlash />,
    blurb: "Swipe your glowing plasma blade to slice flying energy cores while dodging volatile mines",
  },
  {
    id: "g-2048",
    name: "2048: Quantum Edition",
    tag: "Strategy Puzzle",
    status: "flagship",
    accent: "#ffd166",
    el: <G2048 />,
    blurb: "Enhanced 2048 with move Undo, keyboard/button controls & persistent high score",
  },
  {
    id: "g-drift",
    name: "Neon Drift",
    tag: "Pseudo-3D Racer",
    status: "flagship",
    accent: "#ff2e88",
    el: <GNeonDrift />,
    blurb: "Synthwave highway racer — banking curves, traffic weaving and a rechargeable nitro bar",
  },
  {
    id: "g-stack",
    name: "Stack Tower",
    tag: "Precision Timing",
    status: "flagship",
    accent: "#2dd4bf",
    el: <GStackTower />,
    blurb: "Drop blocks dead-centre to keep the tower wide — perfect streaks speed it up",
  },
  {
    id: "g-mines",
    name: "Minesweeper Neo",
    tag: "Logic",
    status: "flagship",
    accent: "#8fa3b8",
    el: <GMinesweeper />,
    blurb: "12×12 grid, 22 mines, flood-fill reveal, flags and a live timer",
  },
  {
    id: "g-cipher",
    name: "Word Cipher",
    tag: "Word Deduction",
    status: "flagship",
    accent: "#9ef01a",
    el: <GWordCipher />,
    blurb: "Six tries to crack a five-letter word — colour-coded keyboard memory",
  },
];

const WEB: Entry[] = [
  ...DIRECTORY.filter((d) => d.cat === "Games" || d.cat === "GitHub").map((d, i) => ({
    id: "w-" + i + "-" + d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: d.name,
    tag: d.cat === "GitHub" ? "GitHub Source" : "Game Hub",
    status: (d.mode === "direct" ? "trusted" : "working") as "trusted" | "working",
    accent: ["#6ee7ff", "#ff4d6d", "#ff9f45", "#ff8fc4", "#c4b5fd", "#39ff88", "#ffd166", "#2dd4bf"][i % 8],
    url: d.url,
    blurb: d.note,
  })),
  { id: "w-poki", name: "Poki", tag: "Game Hub", status: "working", accent: "#ff9f45", url: "https://poki.com/", blurb: "Huge HTML5 catalogue — opens best in a cloaked tab" },
  { id: "w-crazy", name: "CrazyGames", tag: "Game Hub", status: "working", accent: "#c4b5fd", url: "https://www.crazygames.com/", blurb: "Modern browser titles" },
  { id: "w-webretro", name: "webretro (RetroArch)", tag: "Emulator", status: "trusted", accent: "#9ef01a", url: "https://binbashbanana.github.io/webretro/", blurb: "Multi-system emulator compiled to WASM" },
];

export default function GamesApp() {
  const [tab, setTab] = useState<"flagship" | "studio" | "web" | "fav">("flagship");
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<Entry | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [newName, setNewName] = useState("");
  const [newHtml, setNewHtml] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const prof = useProfile();
  const updateProfile = useOS((s) => s.updateProfile);
  const favs = prof.favGames;
  const customEntries: Entry[] = (prof.customGames || []).map((cg) => ({
    id: cg.id,
    name: cg.name,
    tag: cg.tag || "Custom HTML5",
    status: "custom",
    accent: "#9ef01a",
    html: cg.html,
    blurb: cg.blurb,
  }));

  const list = useMemo(() => {
    const base =
      tab === "flagship" ? FLAGSHIP
        : tab === "studio" ? customEntries
          : tab === "web" ? WEB
            : [...FLAGSHIP, ...customEntries, ...WEB].filter((e) => favs.includes(e.id));
    return base.filter((e) => (e.name + e.tag + e.blurb).toLowerCase().includes(q.toLowerCase()));
  }, [tab, q, favs, customEntries]);

  const toggleFav = (id: string) =>
    updateProfile((p) => ({
      ...p,
      favGames: p.favGames.includes(id) ? p.favGames.filter((f) => f !== id) : [...p.favGames, id],
    }));

  const openCloaked = (url: string, title: string) => {
    const w = window.open("about:blank", "_blank");
    if (!w) { toast("Popup blocked", "Allow popups for stealth about:blank launch", "bad"); return; }
    w.document.write(`<!doctype html><html><head><title>Home - Classroom</title>
      <link rel="icon" href="https://ssl.gstatic.com/classroom/favicon.png">
      <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%}</style>
      </head><body><iframe src="${url}" title="${title}" allowfullscreen></iframe></body></html>`);
    w.document.close();
  };

  const installHtmlGame = (name: string, html: string) => {
    if (!name.trim() || !html.trim()) { toast("Enter a game name and HTML code", undefined, "warn"); return; }
    updateProfile((p) => ({
      ...p,
      customGames: [{ id: "cg-" + uid(), name: name.trim(), tag: "Installed File", blurb: "Self-contained HTML5 game bundle", html, created: Date.now() }, ...(p.customGames || [])],
    }));
    setNewName("");
    setNewHtml("");
    toast("Game installed into Arcade", name.trim(), "ok");
  };

  if (playing) {
    return (
      <div className="flex h-full flex-col bg-[#06080f]">
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-black/40 px-3 py-2">
          <IconBtn label="Back to Arcade" onClick={() => setPlaying(null)}><ArrowLeft size={15} /></IconBtn>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[13px] font-bold text-txt">{playing.name}</div>
            <div className="truncate font-mono text-[9px] uppercase tracking-wider text-accent">
              {playing.status === "flagship" ? "⚡ Native 60fps Engine · Zero Network Needed" : playing.status === "custom" ? "⚡ Installed HTML5 Bundle" : playing.url}
            </div>
          </div>
          {(playing.url || playing.html) && (
            <>
              <IconBtn label="Reload" onClick={() => setReloadKey((k) => k + 1)}><RotateCw size={14} /></IconBtn>
              <IconBtn label="Fullscreen" onClick={() => document.getElementById("game-stage")?.requestFullscreen?.().catch(() => undefined)}><Maximize size={14} /></IconBtn>
            </>
          )}
          {playing.url && (
            <>
              <Btn size="xs" icon={<ShieldOff size={11} />} onClick={() => openCloaked(playing.url!, playing.name)}>
                about:blank Cloak
              </Btn>
              <Btn size="xs" icon={<ExternalLink size={11} />} onClick={() => window.open(playing.url, "_blank", "noopener")}>
                New Tab
              </Btn>
            </>
          )}
          <IconBtn label="Favourite" active={favs.includes(playing.id)} onClick={() => toggleFav(playing.id)}>
            <Star size={14} fill={favs.includes(playing.id) ? "currentColor" : "none"} />
          </IconBtn>
        </div>

        <div id="game-stage" className="relative min-h-0 flex-1 overflow-hidden bg-black/60">
          {playing.el ? (
            playing.el
          ) : playing.html ? (
            <iframe
              key={reloadKey}
              srcDoc={playing.html}
              title={playing.name}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-pointer-lock"
            />
          ) : (
            <iframe
              key={reloadKey}
              src={playing.url}
              title={playing.name}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-modals"
              allow="fullscreen; autoplay; gamepad"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-black/25 px-3 py-2">
        <div className="min-w-[340px] flex-1">
          <Chips
            options={[
              { v: "flagship", label: `⚡ Built-In Hits (${FLAGSHIP.length})` },
              { v: "studio", label: `🛠️ Custom Studio (${customEntries.length})` },
              { v: "web", label: `🌐 Mirrors (${WEB.length})` },
              { v: "fav", label: `★ Saved (${favs.length})` },
            ]}
            value={tab}
            onChange={setTab}
            cols={4}
          />
        </div>
        <div className="relative min-w-[160px] flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games…" className="field py-1.5 pl-8 text-[12px]" />
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3.5">
        {tab === "studio" && (
          <Card className="mb-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-display text-sm font-bold text-txt">Install Your Own Game Files (.html) or Ask KALMIA-Code</div>
                <div className="text-[11px] text-dim">
                  Upload any single-file HTML5 game or paste code below — it saves permanently inside your local Arcade and never gets blocked.
                </div>
              </div>
              <div className="flex gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".html,.htm"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const text = await f.text();
                    installHtmlGame(f.name.replace(/\.html?$/i, ""), text);
                    e.target.value = "";
                  }}
                />
                <Btn size="xs" variant="primary" icon={<Upload size={12} />} onClick={() => fileRef.current?.click()}>
                  Upload .html Game File
                </Btn>
                <Btn size="xs" variant="soft" icon={<Sparkles size={12} />} onClick={() => openApp("ai")}>
                  Ask KALMIA to Build a Game
                </Btn>
              </div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[200px_1fr_auto]">
              <TextInput placeholder="Game title" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <TextInput placeholder="Paste <!doctype html>... game source code" value={newHtml} onChange={(e) => setNewHtml(e.target.value)} />
              <Btn size="xs" icon={<Plus size={12} />} onClick={() => installHtmlGame(newName, newHtml)}>
                Install
              </Btn>
            </div>
          </Card>
        )}

        {!list.length ? (
          <Empty
            icon={<Gamepad2 size={28} />}
            title={tab === "fav" ? "No starred games yet" : tab === "studio" ? "No custom games installed yet" : "Nothing matches that search"}
            hint={tab === "studio" ? "Upload an .html game file above, or ask KALMIA AI to build you a playable game!" : "Tap the star on any game to pin it here."}
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(215px,1fr))] gap-3">
            {list.map((g) => (
              <div
                key={g.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-white/[0.025] transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:bg-white/[0.05]"
              >
                <button onClick={() => setPlaying(g)} className="block w-full text-left">
                  <div
                    className="relative grid h-24 place-items-center overflow-hidden border-b border-line/60"
                    style={{
                      background: `radial-gradient(circle at 50% 35%, ${g.accent}38, transparent 70%), linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.4))`,
                    }}
                  >
                    <div
                      className="grid h-11 w-11 place-items-center rounded-xl border transition-transform duration-200 group-hover:scale-110"
                      style={{ borderColor: g.accent + "66", background: g.accent + "20", color: g.accent }}
                    >
                      <Play size={18} fill="currentColor" />
                    </div>
                    <span
                      className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider"
                      style={{ borderColor: g.accent + "55", background: "rgba(0,0,0,0.65)", color: g.accent }}
                    >
                      {g.status === "flagship" || g.status === "custom" ? <Cpu size={8} /> : <Wifi size={8} />}
                      {g.status === "flagship" ? "native 60fps" : g.status}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="truncate font-display text-[14px] font-bold text-txt group-hover:text-accent">{g.name}</div>
                    <div className="mt-1 line-clamp-2 h-8 text-[11px] leading-snug text-dim">{g.blurb}</div>
                    <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider" style={{ color: g.accent }}>
                      <span>{g.tag}</span>
                      <span>PLAY →</span>
                    </div>
                  </div>
                </button>

                <div className="absolute right-2 top-2 flex gap-1">
                  {g.status === "custom" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateProfile((p) => ({ ...p, customGames: (p.customGames || []).filter((c) => c.id !== g.id) }));
                        toast("Removed custom game");
                      }}
                      title="Delete custom game"
                      className="grid h-6 w-6 place-items-center rounded-md bg-black/60 text-white/60 transition hover:text-bad"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFav(g.id); }}
                    title="Favourite"
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-md bg-black/60 transition",
                      favs.includes(g.id) ? "text-warn" : "text-white/50 hover:text-white"
                    )}
                  >
                    <Star size={12} fill={favs.includes(g.id) ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

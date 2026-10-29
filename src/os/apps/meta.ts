import {
  Atom, SlidersHorizontal, Wrench, Sparkles, MonitorUp, Gamepad2,
  SquareTerminal, ShieldHalf, StickyNote, AudioLines, Globe, CircleHelp,
} from "lucide-react";
import type { AppId } from "@/state/store";

export interface AppMeta {
  id: AppId; name: string; short: string; desc: string;
  icon: typeof Atom; tint: string; w: number; h: number; admin?: boolean;
  keywords: string;
}

export const APPS: AppMeta[] = [
  { id: "core", name: "Reactor Core", short: "Core", desc: "Idle singularity clicker with upgrades & prestige", icon: Atom, tint: "var(--accent)", w: 720, h: 560, keywords: "clicker counter idle upgrades prestige mass" },
  { id: "ai", name: "KALMIA & NOVA AI", short: "KALMIA", desc: "Screen-aware agent, chat and side-by-side KALMIA AI Battle Arena", icon: Sparkles, tint: "var(--accent-2)", w: 900, h: 680, keywords: "ai kalmia battle arena compare models nova chat assistant vision screen work" },
  { id: "games", name: "Singularity Arcade", short: "Arcade", desc: "12 native games: Slope 3D, Geometry Dash, Void Survivors, Cyber Doom 3D, Neon Drift & more", icon: Gamepad2, tint: "#ff8fc4", w: 960, h: 670, keywords: "games arcade play slope geometry dash survivors doom tetris jetpack 2048 drift stack minesweeper word" },
  { id: "browser", name: "Portal Proxy", short: "Portal", desc: "Multi-tab proxy, native YouTube/TikTok players, search, reader & 40-link directory", icon: Globe, tint: "#2dd4bf", w: 980, h: 670, keywords: "browser web portal links cloak proxy unblocker search" },
  { id: "tools", name: "Toolbox", short: "Tools", desc: "16 utilities: converters, generators, timers, encoders", icon: Wrench, tint: "#9ef01a", w: 880, h: 620, keywords: "tools calculator converter password qr timer color" },
  { id: "share", name: "Screen Link", short: "Screen", desc: "Share your screen to KALMIA AI & the mesh, record, snapshot, PiP", icon: MonitorUp, tint: "#6ee7ff", w: 900, h: 640, keywords: "screen share broadcast record stream monitor" },
  { id: "terminal", name: "Terminal", short: "Shell", desc: "Command line for the entire operating system", icon: SquareTerminal, tint: "#39ff88", w: 780, h: 500, keywords: "terminal shell console command cli" },
  { id: "notes", name: "Vault", short: "Vault", desc: "Notes, essays, tasks and snippets — autosaved", icon: StickyNote, tint: "#ffd166", w: 860, h: 600, keywords: "notes todo tasks vault write markdown" },
  { id: "music", name: "Ambience", short: "Audio", desc: "16 generative ambience layers, 11 presets, sleep timer & click designer", icon: AudioLines, tint: "#c4b5fd", w: 720, h: 560, keywords: "music audio ambient noise sound mixer focus" },
  { id: "modules", name: "Modules", short: "Modules", desc: "Every setting: shaders, themes, effects, privacy", icon: SlidersHorizontal, tint: "var(--accent)", w: 940, h: 660, keywords: "settings modules themes shader effects customize" },
  { id: "admin", name: "Overwatch", short: "Overwatch", desc: "Admin: live screens, remote control, users, telemetry", icon: ShieldHalf, tint: "#ff4d6d", w: 1000, h: 680, admin: true, keywords: "admin overwatch users control monitor remote" },
  { id: "help", name: "Field Manual", short: "Manual", desc: "Shortcuts, gestures and system documentation", icon: CircleHelp, tint: "var(--dim)", w: 720, h: 560, keywords: "help manual shortcuts docs about keys" },
];

export const appMeta = (id: AppId) => APPS.find((a) => a.id === id)!;

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Command, Eye, Lock, LogOut, Radio, Cpu, Zap, ChevronRight, X,
  ShieldHalf, Atom, CheckCircle2, Circle, Activity, Save, LayoutGrid, Sparkles, Gamepad2, Globe,
} from "lucide-react";
import { useOS, useSettings, useIsAdmin, setS, setClicker, perSecond, clickerMult, type AppId } from "@/state/store";
import { useUI, toast } from "@/state/ui";
import { useNet, startNet, stopNet, onCommand, sendPresence, type Cmd } from "@/lib/net";
import { APPS, appMeta } from "@/os/apps/meta";
import { THEMES, SHADERS, CLOAKS, themeById } from "@/lib/themes";
import { REGISTRY } from "@/os/registry";
import WindowFrame from "@/os/Window";
import AgentCursor from "@/os/AgentCursor";
import { cn, clockString, short, sha256, clamp } from "@/lib/utils";
import { spawnClickFx } from "@/gfx/Overlays";
import { clickSound, buzz, audio } from "@/lib/audio";

export default function Desktop() {
  const s = useSettings();
  const session = useOS((o) => o.session);
  const role = useOS((o) => (o.session ? o.db.users[o.session]?.role : "user"));
  const isAdmin = useIsAdmin();
  const ui = useUI();
  const [clock, setClock] = useState(clockString(new Date(), s.clock24));

  /* ---- theme tokens ---- */
  useEffect(() => {
    const root = document.documentElement;
    const t = themeById(s.theme);
    Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty("--accent", s.accent);
    root.style.setProperty("--accent-2", s.accent2);
    const hex = s.accent.replace("#", "");
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);
    root.style.setProperty("--accent-rgb", rgb.join(","));
    const hex2 = s.accent2.replace("#", "");
    root.style.setProperty("--accent2-rgb", [0, 2, 4].map((i) => parseInt(hex2.slice(i, i + 2), 16) || 0).join(","));
    root.style.setProperty("--radius", s.radius + "px");
    root.style.setProperty("--blur", s.blur + "px");
    root.style.setProperty("--panel-op", String(s.panelOpacity));
    root.style.colorScheme = t.light ? "light" : "dark";
    document.body.classList.toggle("reduce-motion", s.reduceMotion);
  }, [s.theme, s.accent, s.accent2, s.radius, s.blur, s.panelOpacity, s.reduceMotion]);

  /* ---- tab cloak ---- */
  useEffect(() => {
    const c = CLOAKS.find((x) => x.id === s.cloak) || CLOAKS[0];
    document.title = ui.stealth ? "Home - Classroom" : c.id === "none" ? "SINGULARITY OS" : c.title;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    if (ui.stealth) link.href = "https://ssl.gstatic.com/classroom/favicon.png";
    else if (c.id === "newtab") {
      // Blank new-tab icon: use a data URI that looks like default browser icon
      link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='5' fill='%23f1f3f4'/%3E%3C/svg%3E";
    }
    else if (c.icon) link.href = c.icon;
    else link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='9' fill='%23090a0f' stroke='%23ff9f45' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='14' fill='none' stroke='%236ee7ff' stroke-width='1' stroke-dasharray='3 5'/%3E%3C/svg%3E";
  }, [s.cloak, ui.stealth]);

  /* ---- mesh ---- */
  useEffect(() => {
    if (!session) return;
    startNet(session, role || "user");
    const touch = window.setInterval(() => useOS.getState().touch(), 30000);
    return () => { window.clearInterval(touch); stopNet(); };
  }, [session, role]);

  useEffect(() => { sendPresence(); }, [ui.focused, s.theme]);

  /* ---- remote commands ---- */
  useEffect(() => {
    onCommand((c: Cmd) => {
      const u = useUI.getState();
      const p = c.payload;
      switch (c.action) {
        case "open": if (APPS.some((a) => a.id === p)) { u.open(p as AppId); u.notify({ title: "Admin opened an app", desc: appMeta(p as AppId).name, tone: "warn" }); } break;
        case "close-all": u.closeAll(); break;
        case "theme": { const t = THEMES.find((x) => x.id === p); if (t) { setS({ theme: t.id, accent: t.vars["--accent"], accent2: t.vars["--accent-2"] }); u.notify({ title: "Theme changed by admin", desc: t.name, tone: "warn" }); } break; }
        case "shader": if (SHADERS.some((x) => x.id === p)) { setS({ shader: p, shaderOn: true }); u.notify({ title: "Renderer changed by admin", desc: String(p), tone: "warn" }); } break;
        case "accent": if (typeof p === "string") setS({ accent: p }); break;
        case "notify": u.notify({ title: p?.title || "Admin", desc: p?.desc, tone: "warn" }); break;
        case "cloak": if (CLOAKS.some((x) => x.id === p)) setS({ cloak: p }); break;
        case "lock": u.setLocked(true); break;
        case "unlock": u.setLocked(false); break;
        case "click": {
          const os = useOS.getState();
          const cur = os.session ? os.db.profiles[os.session]?.clicker : null;
          if (cur) { const n = clamp(Number(p) || 1, 1, 100000); const gain = cur.power * clickerMult(cur) * n; setClicker({ count: cur.count + gain, total: cur.total + gain, clicks: cur.clicks + n }); u.firePulse(); }
          break;
        }
        case "setcount": setClicker({ count: Math.max(0, Number(p) || 0) }); u.notify({ title: "Reactor overridden", desc: `mass set to ${short(Number(p) || 0)}`, tone: "warn" }); break;
        case "navigate": u.open("browser"); break;
        case "freeze": u.setFreeze(typeof p === "string" ? p : "Session frozen"); break;
        case "unfreeze": u.setFreeze(null); break;
        case "logout": useOS.getState().logout(); break;
        case "ask-share": u.open("share"); u.notify({ title: "Admin requests your screen", desc: "Start a capture and enable Broadcast to share.", tone: "warn" }); break;
        case "wallpaper-off": setS({ wallpaper: "" }); break;
        case "reset": useOS.getState().resetSettings(); break;
      }
    });
  }, []);

  /* ---- clock, save pulse, quota ---- */
  useEffect(() => {
    const t = window.setInterval(() => setClock(clockString(new Date(), s.clock24)), 1000);
    return () => window.clearInterval(t);
  }, [s.clock24]);

  useEffect(() => {
    const onSaved = () => useUI.getState().markSaved();
    const onQuota = () => toast("Storage full", "Wallpaper dropped from the backup to fit", "warn");
    window.addEventListener("sglr:saved", onSaved);
    window.addEventListener("sglr:quota", onQuota);
    return () => { window.removeEventListener("sglr:saved", onSaved); window.removeEventListener("sglr:quota", onQuota); };
  }, []);

  /* ---- responsive + shortcuts + idle lock ---- */
  useEffect(() => {
    const check = () => useUI.getState().setMobile(window.innerWidth < 820);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      const u = useUI.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); u.setPalette(!u.palette); return; }
      if (e.key === "Escape") { u.setPalette(false); return; }
      if (typing || !e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); u.setStealth(!u.stealth); }
      else if (k === "l") { e.preventDefault(); u.setLocked(true); }
      else if (k === "t") { e.preventDefault(); u.open("terminal"); }
      else if (k === "m") { e.preventDefault(); u.open("modules"); }
      else if (k === "a") { e.preventDefault(); u.open("ai"); }
      else if (k === "w") { e.preventDefault(); if (u.focused) u.close(u.focused); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!s.autoLockMin) return;
    let timer = window.setTimeout(() => useUI.getState().setLocked(true), s.autoLockMin * 60000);
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => useUI.getState().setLocked(true), s.autoLockMin * 60000); };
    ["pointerdown", "keydown", "wheel"].forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    return () => { window.clearTimeout(timer); ["pointerdown", "keydown", "wheel"].forEach((ev) => window.removeEventListener(ev, reset)); };
  }, [s.autoLockMin]);

  const visibleApps = APPS.filter((a) => !a.admin || isAdmin);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ zoom: s.uiScale / 100 } as any}>
      {/* desktop center menu when no windows are open */}
      {!ui.windows.length && <FirstRunHint />}

      {/* desktop widgets */}
      <Widgets />

      {/* windows container — pointer-events-none so empty areas never block desktop menu or widgets */}
      <div className="pointer-events-none absolute inset-0 z-20">
        {ui.windows.map((w) => {
          const App = REGISTRY[w.id];
          return <WindowFrame key={w.id} win={w}><App /></WindowFrame>;
        })}
      </div>

      <TopBar clock={clock} />
      <Dock apps={visibleApps} />
      <Taskbar />
      <Toasts />
      <AgentCursor />
      {ui.launcher && <AppLauncherMenu apps={visibleApps} />}
      {ui.palette && <Palette apps={visibleApps} />}
      {ui.freeze && <FreezeScreen message={ui.freeze} />}
      {ui.locked && <LockScreen />}
      {ui.stealth && <StealthScreen />}
    </div>
  );
}

/* ------------------------------------------------------------------ top bar */
function TopBar({ clock }: { clock: string }) {
  const s = useSettings();
  const ui = useUI();
  const os = useOS();
  const peers = useNet((n) => n.peers);
  const [menu, setMenu] = useState(false);
  const user = os.session ? os.db.users[os.session] : null;
  const savedAgo = Math.max(0, Math.round((Date.now() - ui.savedAt) / 1000));

  return (
    <header className="pointer-events-auto fixed inset-x-0 top-0 z-[70] flex h-11 items-center gap-3 border-b border-line px-3"
      style={{ background: "color-mix(in srgb, var(--panel) 86%, transparent)", backdropFilter: "blur(16px)" }}>
      <button
        type="button"
        onClick={() => ui.setLauncher(!ui.launcher)}
        className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 transition hover:border-accent/40 hover:bg-white/[0.06]"
        title="Open Singularity App Menu"
      >
        <span className="relative grid h-6 w-6 place-items-center">
          <span className="absolute inset-0 rounded-full border border-accent/60" />
          <span className="spin-slow absolute -inset-0.5 rounded-full border border-dashed border-accent2/40" />
          <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
        </span>
        <span className="font-display text-[13px] font-bold uppercase tracking-[0.22em] text-txt">Singularity</span>
        <LayoutGrid size={12} className="text-accent opacity-80" />
      </button>

      {ui.focused && (
        <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint sm:flex">
          <ChevronRight size={11} />{appMeta(ui.focused).name}
        </span>
      )}

      <button onClick={() => ui.setPalette(true)}
        className="ml-auto hidden items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-faint transition hover:border-accent/50 hover:text-dim md:flex">
        <Search size={12} /> Command deck
        <kbd className="rounded border border-line2 px-1 font-mono text-[9px]">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <span className="hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint lg:flex" title="Everything is written to local storage on change">
          <Save size={10} className={savedAgo < 3 ? "text-ok" : "text-faint"} />{savedAgo < 3 ? "saved" : `${savedAgo}s ago`}
        </span>
        <span className="hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint sm:flex" title="Sessions connected on the mesh">
          <Radio size={10} className={Object.keys(peers).length ? "text-ok" : "text-faint"} />{Object.keys(peers).length}
        </span>
        {s.showFps && (
          <span className="hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint sm:flex">
            <Cpu size={10} />{ui.fps} fps
          </span>
        )}
        <span className="font-mono text-[11px] text-dim tabular">{clock}</span>
        <button onClick={() => ui.setStealth(true)} title="Panic · Shift+S"
          className="grid h-7 w-7 place-items-center rounded-lg border border-line text-dim transition hover:border-bad hover:text-bad">
          <Eye size={13} />
        </button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-lg border border-line px-1.5 py-1 transition hover:border-accent">
            <span className="grid h-5 w-5 place-items-center rounded font-display text-[10px] font-bold" style={{ background: `${user?.color}22`, color: user?.color }}>
              {user?.name[0]?.toUpperCase()}
            </span>
            <span className="hidden max-w-[80px] truncate font-mono text-[10px] uppercase text-dim sm:block">{user?.name}</span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="surface anim-pop absolute right-0 top-9 z-20 w-52 rounded-xl p-1.5">
                <div className="border-b border-line px-2.5 py-2">
                  <div className="font-display text-[13px] font-semibold text-txt">{user?.name}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">{user?.role} · local account</div>
                </div>
                {[
                  { label: "Modules", icon: Activity, fn: () => ui.open("modules") },
                  { label: "Lock session", icon: Lock, fn: () => ui.setLocked(true) },
                  { label: "Field manual", icon: Search, fn: () => ui.open("help") },
                ].map((i) => (
                  <button key={i.label} onClick={() => { i.fn(); setMenu(false); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-dim transition hover:bg-white/[0.06] hover:text-txt">
                    <i.icon size={13} />{i.label}
                  </button>
                ))}
                <button onClick={() => { os.logout(); setMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-bad transition hover:bg-bad/10">
                  <LogOut size={13} />Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------------- dock */
function Dock({ apps }: { apps: typeof APPS }) {
  const ui = useUI();
  const s = useSettings();
  const mobile = ui.mobile;
  return (
    <nav className={cn("pointer-events-auto fixed z-[65] flex gap-1",
      mobile ? "inset-x-0 bottom-0 h-[64px] items-center overflow-x-auto border-t border-line px-2"
        : "left-2 top-1/2 max-h-[78vh] -translate-y-1/2 flex-col overflow-y-auto rounded-2xl border border-line p-1.5")}
      style={{ background: "color-mix(in srgb, var(--panel) 84%, transparent)", backdropFilter: "blur(16px)", scrollbarWidth: "none" }}>
      {apps.map((a) => {
        const Icon = a.icon;
        const open = ui.windows.some((w) => w.id === a.id);
        const active = ui.focused === a.id;
        return (
          <button key={a.id} onClick={() => ui.open(a.id)} title={`${a.name} — ${a.desc}`}
            data-agent={`dock-${a.id}`}
            className={cn("group relative flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-95",
              mobile ? "w-[58px]" : "w-[62px]",
              active ? "bg-white/[0.09]" : "hover:bg-white/[0.06]")}>
            <span className="grid h-8 w-8 place-items-center rounded-lg transition-transform group-hover:scale-110"
              style={{ background: `color-mix(in srgb, ${a.tint} ${active ? 26 : 14}%, transparent)`, color: a.tint }}>
              <Icon size={16} />
            </span>
            {s.dockLabels && <span className="w-full truncate text-center font-mono text-[8px] uppercase tracking-[0.08em] text-dim">{a.short}</span>}
            {open && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: a.tint, boxShadow: `0 0 6px ${a.tint}` }} />}
          </button>
        );
      })}
    </nav>
  );
}

/* ----------------------------------------------------------------- taskbar */
function Taskbar() {
  const ui = useUI();
  if (ui.mobile) return null;
  return (
    <div className="pointer-events-auto fixed bottom-2 left-1/2 z-[65] flex max-w-[76vw] -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-line px-2.5 py-1.5"
      style={{ background: "color-mix(in srgb, var(--panel) 84%, transparent)", backdropFilter: "blur(16px)" }}>
      <button
        type="button"
        data-agent="taskbar-menu"
        onClick={() => ui.setLauncher(!ui.launcher)}
        className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/12 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent transition hover:bg-accent hover:text-[#0a0a0c]"
      >
        <LayoutGrid size={11} /> menu
      </button>
      <button
        type="button"
        onClick={() => ui.setPalette(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-dim transition hover:bg-white/[0.06] hover:text-accent"
      >
        <Command size={11} /> deck
      </button>
      {ui.windows.length === 0 && <span className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">no windows open</span>}
      {ui.windows.map((w) => {
        const m = appMeta(w.id);
        const Icon = m.icon;
        return (
          <button key={w.id} onClick={() => (ui.focused === w.id && !w.min ? ui.minimize(w.id) : ui.focus(w.id))}
            className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-all",
              ui.focused === w.id && !w.min ? "border-accent/50 bg-accent/12 text-accent" : "border-transparent text-dim hover:bg-white/[0.06]",
              w.min && "opacity-50")}>
            <Icon size={11} />{m.short}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- widgets */
function Widgets() {
  const prof = useOS((o) => (o.session ? o.db.profiles[o.session] : null));
  const s = useSettings();
  const ui = useUI();
  const fps = useUI((u) => u.fps);
  const peers = useNet((n) => n.peers);
  const update = useOS((o) => o.updateProfile);
  const c = prof?.clicker;
  const tasks = (prof?.todos || []).filter((t) => !t.done).slice(0, 3);
  const [uptime, setUptime] = useState(0);
  useEffect(() => { const t = setInterval(() => setUptime((u) => u + 1), 1000); return () => clearInterval(t); }, []);

  return (
    <div className="pointer-events-none absolute right-3 top-14 z-[14] hidden w-[236px] flex-col gap-2.5 xl:flex">
      <div className="pointer-events-auto rounded-2xl border border-line p-3.5" style={{ background: "color-mix(in srgb, var(--panel) 70%, transparent)", backdropFilter: "blur(14px)" }}>
        <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-faint"><Atom size={10} /> reactor</div>
        <button
          onClick={(e) => {
            if (!c) return;
            const gain = c.power * clickerMult(c);
            setClicker({ count: c.count + gain, total: c.total + gain, clicks: c.clicks + 1 });
            ui.firePulse(); clickSound(s); buzz(s.haptics, 6);
            spawnClickFx(e.clientX, e.clientY, s.clickFx, "+" + short(gain));
          }}
          className="w-full text-left transition active:scale-[0.98]">
          <div className="font-display text-3xl font-bold leading-none text-txt tabular text-glow">{short(c?.count ?? 0)}</div>
          <div className="mt-1 font-mono text-[10px] text-dim">{short(perSecond(c ?? ({ drones: 0, reactors: 0, prestige: 0, folds: 0 } as any)))}/s · tap to harvest</div>
        </button>
        <button onClick={() => ui.open("core")} className="mt-2 flex w-full items-center justify-between rounded-lg border border-line px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint transition hover:border-accent hover:text-accent">
          open reactor <ChevronRight size={11} />
        </button>
      </div>

      <div className="pointer-events-auto rounded-2xl border border-line p-3.5" style={{ background: "color-mix(in srgb, var(--panel) 70%, transparent)", backdropFilter: "blur(14px)" }}>
        <div className="mb-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-faint"><Activity size={10} /> vitals</div>
        {[
          ["render", `${fps} fps`, fps > 45 ? "var(--ok)" : fps > 25 ? "var(--warn)" : "var(--bad)"],
          ["shader", s.shader, "var(--accent-2)"],
          ["mesh", `${Object.keys(peers).length} peer${Object.keys(peers).length === 1 ? "" : "s"}`, "var(--txt)"],
          ["uptime", `${Math.floor(uptime / 60)}m ${uptime % 60}s`, "var(--txt)"],
        ].map(([k, v, tone]) => (
          <div key={k} className="flex items-center justify-between border-b border-line/50 py-1 last:border-0">
            <span className="font-mono text-[10px] text-faint">{k}</span>
            <span className="font-mono text-[10px]" style={{ color: tone }}>{v}</span>
          </div>
        ))}
      </div>

      <div className="pointer-events-auto rounded-2xl border border-line p-3.5" style={{ background: "color-mix(in srgb, var(--panel) 70%, transparent)", backdropFilter: "blur(14px)" }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-faint"><CheckCircle2 size={10} /> next up</span>
          <button onClick={() => ui.open("notes")} className="font-mono text-[9px] text-accent">vault</button>
        </div>
        {tasks.length === 0 ? <div className="text-[11px] text-faint">Inbox zero. Nice.</div> : tasks.map((t) => (
          <button key={t.id} onClick={() => update((p) => ({ ...p, todos: p.todos.map((x) => x.id === t.id ? { ...x, done: true } : x) }))}
            className="mb-1 flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.05]">
            <Circle size={12} className="mt-0.5 shrink-0 text-faint" />
            <span className="line-clamp-2 text-[11px] leading-snug text-dim">{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ toasts */
function Toasts() {
  const { toasts, dismiss } = useUI();
  const tone: Record<string, string> = { info: "var(--accent-2)", ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)" };
  return (
    <div className="pointer-events-none fixed bottom-16 right-3 z-[90] flex w-[280px] flex-col gap-2">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => dismiss(t.id)}
          className="surface anim-slide pointer-events-auto rounded-xl border-l-2 p-3 text-left"
          style={{ borderLeftColor: tone[t.tone] }}>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone[t.tone], boxShadow: `0 0 8px ${tone[t.tone]}` }} />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-txt">{t.title}</div>
              {t.desc && <div className="mt-0.5 text-[11px] leading-snug text-dim">{t.desc}</div>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- palette */
function Palette({ apps }: { apps: typeof APPS }) {
  const ui = useUI();
  const os = useOS();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const items = useMemo(() => {
    const list: { id: string; label: string; hint: string; icon: any; run: () => void }[] = [
      ...apps.map((a) => ({ id: "app-" + a.id, label: a.name, hint: a.desc, icon: a.icon, run: () => ui.open(a.id) })),
      ...THEMES.map((t) => ({ id: "theme-" + t.id, label: "Theme · " + t.name, hint: t.blurb, icon: Zap, run: () => { setS({ theme: t.id, accent: t.vars["--accent"], accent2: t.vars["--accent-2"] }); toast("Theme · " + t.name, undefined, "ok"); } })),
      ...SHADERS.map((sh) => ({ id: "sh-" + sh.id, label: "Shader · " + sh.name, hint: sh.desc, icon: Activity, run: () => { setS({ shader: sh.id, shaderOn: true }); toast("Renderer · " + sh.name, undefined, "ok"); } })),
      { id: "a-panic", label: "Panic · stealth screen", hint: "Hide everything instantly", icon: Eye, run: () => ui.setStealth(true) },
      { id: "a-lock", label: "Lock session", hint: "Require the password again", icon: Lock, run: () => ui.setLocked(true) },
      { id: "a-new", label: "Open a second session", hint: "New tab for the mesh", icon: Radio, run: () => window.open(location.href, "_blank", "noopener") },
      { id: "a-close", label: "Close all windows", hint: "Clear the desktop", icon: X, run: () => ui.closeAll() },
      { id: "a-out", label: "Sign out", hint: "Return to the lock screen", icon: LogOut, run: () => os.logout() },
    ];
    const query = q.toLowerCase().trim();
    return query ? list.filter((x) => (x.label + x.hint).toLowerCase().includes(query)) : list;
  }, [q, apps, ui, os]);

  const run = (idx: number) => { const item = items[idx]; if (item) { item.run(); ui.setPalette(false); audio.blip(920, 0.04, 0.03); } };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => ui.setPalette(false)}>
      <div className="surface anim-pop w-full max-w-lg overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={15} className="text-accent" />
          <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(items.length - 1, v + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
              if (e.key === "Enter") { e.preventDefault(); run(i); }
            }}
            placeholder="Search apps, themes, shaders, actions…"
            className="flex-1 bg-transparent text-[14px] text-txt outline-none placeholder:text-faint" />
          <kbd className="rounded border border-line2 px-1.5 py-0.5 font-mono text-[9px] text-faint">esc</kbd>
        </div>
        <div className="scroll-thin max-h-[46vh] overflow-y-auto p-1.5">
          {items.length === 0 && <div className="p-4 text-center text-[12px] text-faint">Nothing matches “{q}”.</div>}
          {items.slice(0, 40).map((item, idx) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onMouseEnter={() => setI(idx)} onClick={() => run(idx)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition", idx === i ? "bg-accent/14" : "hover:bg-white/[0.05]")}>
                <Icon size={14} className={idx === i ? "text-accent" : "text-faint"} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13px]", idx === i ? "text-accent" : "text-txt")}>{item.label}</span>
                  <span className="block truncate text-[10px] text-faint">{item.hint}</span>
                </span>
                {idx === i && <span className="font-mono text-[9px] text-faint">↵</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ lock / freeze */
function LockScreen() {
  const os = useOS();
  const ui = useUI();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const user = os.session ? os.db.users[os.session] : null;
  const unlock = async () => {
    if (!user) { ui.setLocked(false); return; }
    if ((await sha256(pw)) === user.hash) { ui.setLocked(false); setPw(""); setErr(""); audio.blip(880, 0.08, 0.04); }
    else { setErr("Incorrect password"); audio.blip(180, 0.12, 0.05, "sawtooth"); }
  };
  return (
    <div className="fixed inset-0 z-[400] grid place-items-center bg-black/80 backdrop-blur-xl">
      <div className="surface anim-pop w-[320px] rounded-2xl p-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-line" style={{ background: `${user?.color}18` }}>
          <Lock size={22} style={{ color: user?.color }} />
        </div>
        <div className="font-display text-lg font-bold text-txt">{user?.name}</div>
        <div className="mb-4 font-mono text-[9px] uppercase tracking-[0.2em] text-faint">session locked</div>
        <input autoFocus type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && void unlock()} placeholder="Password" className="field mb-2 text-center" />
        {err && <div className="mb-2 font-mono text-[10px] text-bad">{err}</div>}
        <button onClick={() => void unlock()} className="w-full rounded-xl bg-accent py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.2em] text-[#0a0a0c]">Unlock</button>
        <button onClick={() => os.logout()} className="mt-2 w-full py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint transition hover:text-bad">sign out instead</button>
      </div>
    </div>
  );
}

function FreezeScreen({ message }: { message: string }) {
  const isAdmin = useIsAdmin();
  const ui = useUI();
  return (
    <div className="fixed inset-0 z-[450] grid place-items-center bg-black/92 backdrop-blur-md">
      <div className="text-center">
        <ShieldHalf size={40} className="mx-auto mb-4 text-bad" />
        <div className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-bad">Session frozen</div>
        <p className="mt-2 max-w-sm text-[13px] text-dim">{message}</p>
        {isAdmin && <button onClick={() => ui.setFreeze(null)} className="mt-5 rounded-xl border border-bad px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-bad transition hover:bg-bad hover:text-black">admin override</button>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ stealth */
function StealthScreen() {
  const ui = useUI();
  const classes = [
    { name: "Algebra II", teacher: "Mr. Alvarez", room: "Room 204", color: "#1967d2" },
    { name: "World History", teacher: "Ms. Okafor", room: "Room 118", color: "#0b8043" },
    { name: "Biology", teacher: "Dr. Chen", room: "Lab 3", color: "#e8710a" },
    { name: "English Lit", teacher: "Mrs. Doyle", room: "Room 9", color: "#8430ce" },
    { name: "Computer Science", teacher: "Mr. Patel", room: "Lab 1", color: "#00838f" },
    { name: "Study Hall", teacher: "Staff", room: "Library", color: "#5f6368" },
  ];
  return (
    <div className="fixed inset-0 z-[500] overflow-auto bg-[#f1f3f4]" style={{ fontFamily: "Roboto, Arial, sans-serif" }}>
      <div className="flex h-16 items-center gap-4 border-b border-[#dadce0] bg-white px-5">
        <div className="flex flex-col gap-1"><span className="block h-0.5 w-5 bg-[#5f6368]" /><span className="block h-0.5 w-5 bg-[#5f6368]" /><span className="block h-0.5 w-5 bg-[#5f6368]" /></div>
        <div className="text-[22px] text-[#5f6368]">Classroom</div>
        <div className="ml-auto flex items-center gap-4 text-[#5f6368]">
          <span className="text-2xl leading-none">+</span>
          <span className="grid grid-cols-3 gap-0.5">{Array.from({ length: 9 }, (_, i) => <span key={i} className="h-1 w-1 rounded-full bg-[#5f6368]" />)}</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1967d2] text-[13px] text-white">S</span>
        </div>
      </div>
      <div className="flex gap-6 border-b border-[#dadce0] bg-white px-6 text-[14px] text-[#5f6368]">
        <span className="border-b-2 border-[#1967d2] py-3 font-medium text-[#1967d2]">To do</span>
        <span className="py-3">Done</span>
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 p-6">
        {classes.map((c) => (
          <div key={c.name} className="overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-sm">
            <div className="relative h-24 p-4" style={{ background: c.color }}>
              <div className="text-[20px] font-medium text-white">{c.name}</div>
              <div className="text-[13px] text-white/85">{c.teacher}</div>
              <div className="absolute bottom-2 left-4 text-[12px] text-white/75">{c.room}</div>
              <div className="absolute -bottom-8 right-4 grid h-16 w-16 place-items-center rounded-full border-4 border-white text-[22px] font-medium text-white" style={{ background: c.color }}>
                {c.name[0]}
              </div>
            </div>
            <div className="h-28 p-4 pt-8 text-[13px] text-[#5f6368]">
              <div className="mb-1 font-medium text-[#3c4043]">Due tomorrow</div>
              Chapter review worksheet · 11:59 PM
            </div>
            <div className="flex justify-end gap-4 border-t border-[#dadce0] px-4 py-2 text-[12px] text-[#5f6368]">
              <span>Open assignments</span><span>Folder</span>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => ui.setStealth(false)} title="Return"
        className="fixed bottom-2 left-2 h-6 w-6 rounded-full opacity-[0.06] transition hover:opacity-60" style={{ background: "#000" }} />
      <div className="pb-10 text-center text-[11px] text-[#9aa0a6]">Shift + S returns to your desktop</div>
    </div>
  );
}

/* -------------------------------------------------------- app launcher menu */
function AppLauncherMenu({ apps }: { apps: typeof APPS }) {
  const ui = useUI();
  const os = useOS();
  return (
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-black/65 p-4 backdrop-blur-md"
      onClick={() => ui.setLauncher(false)}
    >
      <div
        className="surface anim-pop w-full max-w-3xl overflow-hidden rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.26em] text-accent">singularity os · system menu</div>
            <h2 className="font-display text-xl font-bold text-txt">All Applications & Modules</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { ui.setLauncher(false); ui.setPalette(true); }}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase text-dim transition hover:border-accent hover:text-accent"
            >
              <Search size={12} /> Search (⌘K)
            </button>
            <button
              type="button"
              onClick={() => ui.setLauncher(false)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line text-dim transition hover:border-bad hover:text-bad"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {apps.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => ui.open(a.id)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-line bg-white/[0.025] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 active:scale-95"
              >
                <span
                  className="grid h-9 w-9 place-items-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ background: `color-mix(in srgb, ${a.tint} 18%, transparent)`, color: a.tint }}
                >
                  <Icon size={18} />
                </span>
                <div>
                  <div className="font-display text-[13px] font-bold text-txt group-hover:text-accent">{a.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-faint">{a.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => { ui.setLauncher(false); ui.setStealth(true); }}
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase text-dim transition hover:border-accent hover:text-accent"
            >
              <Eye size={12} /> Panic Stealth (Shift+S)
            </button>
            <button
              type="button"
              onClick={() => { ui.setLauncher(false); ui.setLocked(true); }}
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase text-dim transition hover:border-accent hover:text-accent"
            >
              <Lock size={12} /> Lock Session
            </button>
          </div>
          <button
            type="button"
            onClick={() => { ui.setLauncher(false); os.logout(); }}
            className="flex items-center gap-1.5 rounded-lg border border-bad/40 bg-bad/10 px-3 py-1.5 font-mono text-[10px] uppercase text-bad transition hover:bg-bad hover:text-black"
          >
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- first run */
function FirstRunHint() {
  const ui = useUI();
  const session = useOS((o) => o.session);
  const quick: AppId[] = ["ai", "games", "browser", "core", "tools", "terminal", "modules"];
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 z-[12] flex items-center pl-[104px] pr-6 max-lg:pl-6">
      <div className="pointer-events-auto anim-rise max-w-xl border-l-2 pl-5" style={{ borderColor: "var(--accent)" }}>
        <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-faint">
          session <span className="text-accent">{session}</span> · kalmia 4.0 + proxy online
        </div>
        <h1 className="mt-2 font-display text-[clamp(38px,6.4vw,72px)] font-bold uppercase leading-[0.86] tracking-[-0.02em] text-txt">
          Singularity
          <span className="block text-[0.42em] font-medium tracking-[0.36em] text-dim">operating environment</span>
        </h1>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-dim">
          Meet **KALMIA** (agent AI that drives your screen), **Portal** (proxy + YouTube/TikTok players), and **12 built-in 60fps games** (*Slope 3D*, *Geometry Dash*, *Void Survivors*, *Cyber Doom 3D* & more).
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {quick.map((id) => {
            const m = appMeta(id);
            const Icon = m.icon;
            return (
              <button
                key={id}
                type="button"
                onClick={() => ui.open(id)}
                className="group flex items-center gap-2 rounded-xl border border-line2 bg-panel/80 px-3.5 py-2.5 text-[12px] font-medium text-txt shadow-lg backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent/15 hover:text-accent active:scale-95"
              >
                <Icon size={14} style={{ color: m.tint }} />
                {m.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => ui.setLauncher(true)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.14em] text-[#0a0a0c] shadow-lg transition hover:brightness-110 active:scale-95"
          >
            <LayoutGrid size={13} /> All Apps Menu
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
          <span className="inline-flex items-center gap-1 text-accent2"><Sparkles size={10} /> KALMIA Vision Ready</span>
          <span className="inline-flex items-center gap-1 text-ok"><Gamepad2 size={10} /> 12 Native Games</span>
          <span className="inline-flex items-center gap-1 text-accent"><Globe size={10} /> Smart Proxy Active</span>
        </div>
      </div>
    </div>
  );
}

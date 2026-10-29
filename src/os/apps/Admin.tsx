import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip,
} from "chart.js";
import {
  ShieldHalf, LayoutDashboard, MonitorPlay, Users, SlidersHorizontal, Activity, ScrollText,
  Lock, Unlock, Eye, Power, Send, Trash2, UserPlus, Zap, Snowflake, Sun, ExternalLink, Radio, X,
} from "lucide-react";
import { useOS, useIsAdmin, setClicker, useSettings } from "@/state/store";
import { useUI, toast, openApp } from "@/state/ui";
import { useNet, sendCmd, sendChat, type Peer, type CmdAction } from "@/lib/net";
import { APPS } from "@/os/apps/meta";
import { THEMES, SHADERS } from "@/lib/themes";
import { Btn, Card, Chips, IconBtn, Modal, Section, Stat, TextInput, Empty } from "@/ui/kit";
import { cn, fmt, relTime, short, bytes, download } from "@/lib/utils";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const TABS = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "live", name: "Live screens", icon: MonitorPlay },
  { id: "users", name: "Accounts", icon: Users },
  { id: "control", name: "Remote control", icon: SlidersHorizontal },
  { id: "telemetry", name: "Telemetry", icon: Activity },
  { id: "audit", name: "Audit log", icon: ScrollText },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AdminApp() {
  const isAdmin = useIsAdmin();
  const os = useOS();
  const ui = useUI();
  const s = useSettings();
  const net = useNet();
  const [tab, setTab] = useState<Tab>("overview");
  const [target, setTarget] = useState<string>("all");
  const [watch, setWatch] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [newUser, setNewUser] = useState({ name: "", pass: "", role: "user" as "user" | "admin" });
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwVal, setPwVal] = useState("");
  const [appArg, setAppArg] = useState("games");
  const [themeArg, setThemeArg] = useState("sakura");
  const [shaderArg, setShaderArg] = useState("storm");
  const [numArg, setNumArg] = useState("1000");

  const peers = Object.values(net.peers);
  const users = Object.values(os.db.users);
  const totalMass = Object.values(os.db.profiles).reduce((a, p) => a + (p?.clicker?.count || 0), 0);
  const storage = useMemo(() => { try { return new Blob([localStorage.getItem("singularity.db.v6") || ""]).size; } catch { return 0; } }, [os.db]);

  const act = (action: CmdAction, payload?: any, to = target) => {
    sendCmd(to, action, payload);
    toast("Command dispatched", `${action} → ${to === "all" ? "all sessions" : net.peers[to]?.user ?? to.slice(0, 6)}`, "ok");
  };

  if (!isAdmin) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-bad/40 bg-bad/10"><Lock size={26} className="text-bad" /></div>
          <h3 className="font-display text-xl font-bold text-txt">Restricted console</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-dim">
            Overwatch requires an administrator session. Sign out and use the <b className="text-bad">ADMIN</b> tab on the lock screen.
          </p>
          <Btn className="mt-4" variant="danger" onClick={() => os.logout()}>Switch account</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <nav className="scroll-thin flex w-[152px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-black/25 p-2">
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-bad/40 bg-bad/10 px-2 py-1.5">
          <ShieldHalf size={13} className="text-bad" />
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-bad">Overwatch</span>
        </div>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition-all",
                tab === t.id ? "bg-bad/15 text-bad" : "text-dim hover:bg-white/[0.05] hover:text-txt")}>
              <Icon size={13} /> {t.name}
            </button>
          );
        })}
        <div className="mt-auto rounded-lg border border-line px-2 py-2 font-mono text-[8px] uppercase leading-relaxed tracking-[0.14em] text-faint">
          mesh {net.online ? <span className="text-ok">online</span> : <span className="text-bad">offline</span>}<br />
          {peers.length} peer(s) · {users.length} account(s)
        </div>
      </nav>

      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto p-4">
        {tab === "overview" && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="accounts" value={users.length} />
              <Stat label="live sessions" value={peers.length + 1} tone="var(--ok)" sub="including you" />
              <Stat label="global mass" value={short(totalMass)} tone="var(--accent)" />
              <Stat label="db size" value={bytes(storage)} sub="of ~5 MB" />
            </div>
            <Section title="Fleet actions" hint="Broadcast to every connected session instantly">
              <div className="mb-3 flex flex-wrap gap-2">
                <Btn icon={<ExternalLink size={13} />} onClick={() => window.open(location.href, "_blank", "noopener")}>Open second session</Btn>
                <Btn icon={<Sun size={13} />} onClick={() => act("theme", "paper", "all")}>Force light theme</Btn>
                <Btn icon={<Snowflake size={13} />} onClick={() => act("freeze", "Frozen by administrator", "all")}>Freeze all</Btn>
                <Btn icon={<Sun size={13} />} onClick={() => act("unfreeze", undefined, "all")}>Unfreeze all</Btn>
                <Btn variant="danger" icon={<Eye size={13} />} onClick={() => act("cloak", "classroom", "all")}>Panic all</Btn>
                <Btn variant="danger" icon={<Power size={13} />} onClick={() => act("lock", undefined, "all")}>Lock all</Btn>
              </div>
              <div className="flex gap-2">
                <TextInput placeholder="Broadcast a message to every session…" value={msg} onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && msg.trim()) { sendChat(msg.trim()); setMsg(""); toast("Broadcast sent", undefined, "ok"); } }} />
                <Btn variant="primary" icon={<Send size={13} />} onClick={() => { if (msg.trim()) { sendChat(msg.trim()); setMsg(""); toast("Broadcast sent", undefined, "ok"); } }}>Send</Btn>
              </div>
            </Section>
            <Section title="Local overrides">
              <div className="flex flex-wrap gap-2">
                <Btn icon={<Zap size={13} />} onClick={() => { setClicker({ count: 9999999, total: 9999999 }); toast("God mode", "Reactor mass set to 9,999,999", "ok"); }}>God mode</Btn>
                <Btn onClick={() => { ui.setStealth(false); ui.setFreeze(null); ui.setLocked(false); toast("Local session restored", undefined, "ok"); }}>Clear my restrictions</Btn>
                <Btn variant="danger" icon={<Trash2 size={13} />} onClick={() => setConfirmWipe(true)}>Wipe other accounts</Btn>
              </div>
            </Section>
            <Section title="Sessions on the mesh">
              {peers.length === 0 ? (
                <Empty icon={<Radio size={24} />} title="No other sessions connected"
                  hint="Click “Open second session”, sign in with a different account, and it will appear here within two seconds. The mesh links every tab of this browser." />
              ) : (
                <div className="grid gap-2">
                  {peers.map((p) => <PeerRow key={p.id} p={p} onWatch={() => { setWatch(p.id); }} onControl={() => { setTarget(p.id); setTab("control"); }} />)}
                </div>
              )}
            </Section>
          </>
        )}

        {tab === "live" && (
          <Section title="Live screens" hint="Frames arrive from sessions that enabled Broadcast in Screen Link">
            {peers.length === 0 ? (
              <Empty icon={<MonitorPlay size={26} />} title="Nothing to watch yet" hint="Open a second session and start a screen capture there." />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {peers.map((p) => {
                  const f = net.frames[p.id];
                  return (
                    <Card key={p.id} className="p-0 overflow-hidden">
                      <button onClick={() => setWatch(p.id)} className="relative block aspect-video w-full bg-black/60">
                        {f ? <img src={f.data} alt="" className="h-full w-full object-cover" />
                          : <div className="grid h-full place-items-center px-3 text-center text-[10px] leading-relaxed text-faint">{p.sharing ? "waiting for frames…" : "not sharing — request a capture below"}</div>}
                        <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em]", p.sharing ? "bg-bad text-black" : "bg-black/70 text-faint")}>
                          {p.sharing ? "live" : "idle"}
                        </span>
                      </button>
                      <div className="flex items-center justify-between gap-2 p-2.5">
                        <div className="min-w-0">
                          <div className="truncate font-display text-[12px] font-semibold text-txt">{p.user}</div>
                          <div className="font-mono text-[9px] text-faint">{p.app} · {relTime(p.ts)}</div>
                        </div>
                        <div className="flex gap-1">
                          <IconBtn label="Ask to share" onClick={() => act("ask-share", undefined, p.id)}><Radio size={13} /></IconBtn>
                          <IconBtn label="Remote control" onClick={() => { setTarget(p.id); setTab("control"); }}><SlidersHorizontal size={13} /></IconBtn>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {tab === "users" && (
          <>
            <Section title="Create account">
              <div className="flex flex-wrap gap-2">
                <TextInput className="w-40" placeholder="handle" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                <TextInput className="w-40" placeholder="password" value={newUser.pass} onChange={(e) => setNewUser({ ...newUser, pass: e.target.value })} />
                <div className="w-40"><Chips options={[{ v: "user", label: "User" }, { v: "admin", label: "Admin" }]} value={newUser.role} onChange={(v) => setNewUser({ ...newUser, role: v })} cols={2} /></div>
                <Btn variant="primary" icon={<UserPlus size={13} />} onClick={async () => {
                  const err = await os.adminCreate(newUser.name, newUser.pass, newUser.role);
                  if (err) toast(err, undefined, "bad");
                  else { toast("Account created", newUser.name, "ok"); setNewUser({ name: "", pass: "", role: "user" }); }
                }}>Create</Btn>
              </div>
            </Section>
            <Section title={`Accounts (${users.length})`}>
              <div className="overflow-hidden rounded-xl border border-line">
                {users.map((u) => {
                  const online = peers.some((p) => p.user === u.name) || os.session === u.name;
                  const mass = os.db.profiles[u.name]?.clicker?.count ?? 0;
                  return (
                    <div key={u.name} className="flex flex-wrap items-center gap-2 border-b border-line/60 px-3 py-2.5 last:border-0">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-[13px] font-bold" style={{ background: `${u.color}22`, color: u.color }}>
                        {u.name[0].toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-txt">{u.name}</span>
                          <span className={cn("rounded-full border px-1.5 py-0.5 font-mono text-[8px] uppercase", u.role === "admin" ? "border-bad/50 text-bad" : "border-line text-faint")}>{u.role}</span>
                          {online && <span className="h-1.5 w-1.5 rounded-full bg-ok" title="online" />}
                        </div>
                        <div className="font-mono text-[9px] text-faint">mass {fmt(mass)} · seen {u.seen ? relTime(u.seen) : "never"} · joined {new Date(u.created).toLocaleDateString()}</div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Btn size="xs" onClick={() => os.adminRole(u.name, u.role === "admin" ? "user" : "admin")}>{u.role === "admin" ? "Demote" : "Promote"}</Btn>
                        <Btn size="xs" onClick={() => { setPwFor(u.name); setPwVal(""); }}>Password</Btn>
                        <Btn size="xs" variant="danger" onClick={() => { os.adminDelete(u.name); toast("Account removed", u.name, "warn"); }} disabled={u.name === "admin"}>Delete</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          </>
        )}

        {tab === "control" && (
          <>
            <Section title="Target session">
              <select className="field mb-3" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="all">◆ ALL SESSIONS ({peers.length})</option>
                {peers.map((p) => <option key={p.id} value={p.id}>{p.user} · {p.id.slice(0, 6)} · {p.app}</option>)}
              </select>
              {peers.length === 0 && <p className="text-[11px] text-faint">No peers yet — commands sent to “all” will reach sessions that join later? No: only currently connected tabs receive them.</p>}
            </Section>
            <Section title="Window & appearance">
              <div className="mb-2 flex flex-wrap items-end gap-2">
                <select className="field w-40" value={appArg} onChange={(e) => setAppArg(e.target.value)}>{APPS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                <Btn onClick={() => act("open", appArg)}>Open app</Btn>
                <Btn variant="danger" onClick={() => act("close-all")}>Close all windows</Btn>
              </div>
              <div className="mb-2 flex flex-wrap items-end gap-2">
                <select className="field w-40" value={themeArg} onChange={(e) => setThemeArg(e.target.value)}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <Btn onClick={() => act("theme", themeArg)}>Force theme</Btn>
                <select className="field w-40" value={shaderArg} onChange={(e) => setShaderArg(e.target.value)}>{SHADERS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                <Btn onClick={() => act("shader", shaderArg)}>Force shader</Btn>
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn onClick={() => act("accent", s.accent)}>Push my accent</Btn>
                <Btn onClick={() => act("wallpaper-off")}>Strip wallpaper</Btn>
                <Btn onClick={() => act("cloak", "classroom")}>Cloak tab</Btn>
                <Btn onClick={() => act("cloak", "none")}>Uncloak</Btn>
              </div>
            </Section>
            <Section title="Reactor">
              <div className="flex flex-wrap items-end gap-2">
                <TextInput className="w-32" type="number" value={numArg} onChange={(e) => setNumArg(e.target.value)} />
                <Btn onClick={() => act("click", Number(numArg) || 1)}>Fire clicks</Btn>
                <Btn onClick={() => act("setcount", Number(numArg) || 0)}>Set mass</Btn>
              </div>
            </Section>
            <Section title="Session control">
              <div className="flex flex-wrap gap-2">
                <Btn icon={<Radio size={13} />} onClick={() => act("ask-share")}>Request screen share</Btn>
                <Btn icon={<Lock size={13} />} onClick={() => act("lock")}>Lock</Btn>
                <Btn icon={<Unlock size={13} />} onClick={() => act("unlock")}>Unlock</Btn>
                <Btn variant="danger" icon={<Snowflake size={13} />} onClick={() => act("freeze", "Session frozen by administrator")}>Freeze</Btn>
                <Btn icon={<Sun size={13} />} onClick={() => act("unfreeze")}>Unfreeze</Btn>
                <Btn variant="danger" icon={<Power size={13} />} onClick={() => act("logout")}>Force sign out</Btn>
              </div>
              <div className="mt-3 flex gap-2">
                <TextInput placeholder="Direct message…" value={msg} onChange={(e) => setMsg(e.target.value)} />
                <Btn variant="primary" icon={<Send size={13} />} onClick={() => { if (msg.trim()) { act("notify", { title: "Message from admin", desc: msg.trim() }); setMsg(""); } }}>Send</Btn>
              </div>
            </Section>
          </>
        )}

        {tab === "telemetry" && <Telemetry />}

        {tab === "audit" && (
          <Section title="Audit log" hint="Every command and message crossing the mesh"
            right={<div className="flex gap-1">
              <Btn size="xs" onClick={() => download("mesh-log.json", JSON.stringify(net.log, null, 2), "application/json")}>Export</Btn>
              <Btn size="xs" variant="danger" onClick={() => net.clearLog()}>Clear</Btn>
            </div>}>
            {net.log.length === 0 ? <Empty title="No mesh traffic yet" /> : (
              <div className="overflow-hidden rounded-xl border border-line font-mono text-[11px]">
                {net.log.map((l) => (
                  <div key={l.id} className="flex gap-2 border-b border-line/60 px-3 py-1.5 last:border-0">
                    <span className="text-faint">{new Date(l.ts).toLocaleTimeString()}</span>
                    <span className={l.dir === "in" ? "text-accent2" : "text-accent"}>{l.dir === "in" ? "←" : "→"}</span>
                    <span className="text-txt">{l.kind}</span>
                    <span className="truncate text-dim">{l.text}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>

      {/* live viewer */}
      {watch && net.peers[watch] && (
        <div className="fixed inset-0 z-[180] flex flex-col bg-black/92 p-4" onClick={() => setWatch(null)}>
          <div className="flex items-center gap-2 pb-3" onClick={(e) => e.stopPropagation()}>
            <span className="font-display text-sm font-bold uppercase tracking-[0.18em] text-bad">{net.peers[watch].user}</span>
            <span className="font-mono text-[10px] text-faint">{net.peers[watch].app} · {net.peers[watch].sharing ? "live" : "idle"}</span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Btn size="xs" onClick={() => act("ask-share", undefined, watch)}>Request share</Btn>
              <Btn size="xs" onClick={() => act("notify", { title: "Admin is watching", desc: "Your screen is being viewed." }, watch)}>Notify</Btn>
              <Btn size="xs" onClick={() => { setTarget(watch); setWatch(null); setTab("control"); }}>Take control</Btn>
              <IconBtn label="Close viewer" onClick={() => setWatch(null)}><X size={15} /></IconBtn>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center" onClick={() => setWatch(null)}>
            {net.frames[watch]
              ? <img src={net.frames[watch].data} alt="remote screen" className="max-h-full max-w-full rounded-xl border border-line2" />
              : <div className="text-center text-[12px] text-faint">No frames yet. Screen capture must be started by that user — browsers never allow it silently.</div>}
          </div>
        </div>
      )}

      <Modal open={confirmWipe} title="Wipe other accounts" onClose={() => setConfirmWipe(false)}
        footer={<>
          <Btn variant="ghost" onClick={() => setConfirmWipe(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => { os.adminWipeOthers(); setConfirmWipe(false); toast("Other accounts removed", undefined, "warn"); }}>Wipe</Btn>
        </>}>
        Deletes every account except yours and the root admin, including their reactor progress, notes and settings.
      </Modal>

      <Modal open={pwFor !== null} title={`Reset password · ${pwFor}`} onClose={() => setPwFor(null)}
        footer={<>
          <Btn variant="ghost" onClick={() => setPwFor(null)}>Cancel</Btn>
          <Btn variant="primary" onClick={async () => { if (pwFor && pwVal.length >= 3) { await os.adminPass(pwFor, pwVal); toast("Password updated", pwFor, "ok"); setPwFor(null); } else toast("Minimum 3 characters", undefined, "warn"); }}>Update</Btn>
        </>}>
        <TextInput className="mt-2" type="text" placeholder="new password" value={pwVal} onChange={(e) => setPwVal(e.target.value)} />
      </Modal>
    </div>
  );
}

function PeerRow({ p, onWatch, onControl }: { p: Peer; onWatch: () => void; onControl: () => void }) {
  const frames = useNet((n) => n.frames);
  const f = frames[p.id];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.025] p-2.5">
      <button onClick={onWatch} className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-black/60">
        {f ? <img src={f.data} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[9px] text-faint">no feed</span>}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-txt">{p.user}</span>
          {p.role === "admin" && <span className="rounded-full border border-bad/50 px-1.5 font-mono text-[8px] uppercase text-bad">admin</span>}
          {p.sharing && <span className="rounded-full bg-bad px-1.5 font-mono text-[8px] uppercase text-black">live</span>}
        </div>
        <div className="font-mono text-[9px] text-faint">app {p.app} · mass {short(p.count)} · {p.theme} · {relTime(p.ts)}</div>
      </div>
      <div className="flex gap-1">
        <IconBtn label="Watch screen" onClick={onWatch}><Eye size={14} /></IconBtn>
        <IconBtn label="Control session" onClick={onControl}><SlidersHorizontal size={14} /></IconBtn>
      </div>
    </div>
  );
}

function Telemetry() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const fps = useUI((u) => u.fps);
  const net = useNet();
  const [samples, setSamples] = useState<number[]>(Array(40).fill(60));
  const mem = (performance as any).memory;

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff9f45";
    const chart = new Chart(cv, {
      type: "line",
      data: {
        labels: Array.from({ length: 40 }, (_, i) => String(i)),
        datasets: [{
          data: Array(40).fill(60), borderColor: accent, borderWidth: 2, pointRadius: 0, tension: 0.35,
          fill: true, backgroundColor: accent + "22",
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { tooltip: { enabled: true, mode: "index", intersect: false } },
        scales: {
          x: { display: false },
          y: { min: 0, max: 130, grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "rgba(255,255,255,0.4)", font: { size: 9, family: "JetBrains Mono" } } },
        },
      },
    });
    chartRef.current = chart;
    return () => { chart.destroy(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      setSamples((prev) => {
        const next = [...prev.slice(1), useUI.getState().fps];
        const chart = chartRef.current;
        if (chart) {
          chart.data.datasets[0].data = next;
          const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff9f45";
          chart.data.datasets[0].borderColor = accent;
          chart.data.datasets[0].backgroundColor = accent + "22";
          chart.update("none");
        }
        return next;
      });
    }, 800);
    return () => window.clearInterval(t);
  }, []);

  const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="current fps" value={fps} tone={fps > 45 ? "var(--ok)" : fps > 25 ? "var(--warn)" : "var(--bad)"} />
        <Stat label="average fps" value={avg} />
        <Stat label="heap" value={mem ? bytes(mem.usedJSHeapSize) : "n/a"} sub={mem ? `limit ${bytes(mem.jsHeapSizeLimit)}` : "chromium only"} />
        <Stat label="mesh frames" value={Object.keys(net.frames).length} tone="var(--accent-2)" sub="active feeds" />
      </div>
      <Section title="Frame rate" hint="Live render performance of this session">
        <div className="h-52 rounded-xl border border-line bg-black/30 p-2"><canvas ref={canvasRef} /></div>
      </Section>
      <Section title="Environment">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["platform", navigator.platform || "unknown"],
            ["logical cores", String((navigator as any).hardwareConcurrency ?? "?")],
            ["device memory", (navigator as any).deviceMemory ? (navigator as any).deviceMemory + " GB" : "not reported"],
            ["viewport", `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`],
            ["language", navigator.language],
            ["online", navigator.onLine ? "connected" : "offline"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between rounded-lg border border-line px-3 py-2 font-mono text-[11px]">
              <span className="text-faint">{k}</span><span className="text-dim">{v}</span>
            </div>
          ))}
        </div>
      </Section>
      <Btn onClick={() => openApp("modules")}>Tune render quality</Btn>
    </>
  );
}

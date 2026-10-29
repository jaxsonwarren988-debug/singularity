import { create } from "@/state/createStore";
import { uid } from "@/lib/utils";
import { useOS } from "@/state/store";
import { useUI } from "@/state/ui";

/**
 * Mesh link — a real cross-context network built on BroadcastChannel.
 * Every browser tab/window running Singularity OS on this machine joins the mesh,
 * so an admin tab can watch and drive other signed-in sessions live.
 */
export interface Peer {
  id: string; user: string; role: string; app: string; count: number;
  sharing: boolean; ts: number; theme: string;
}
export interface NetLog { id: string; ts: number; dir: "in" | "out"; kind: string; text: string }
export interface NetChat { id: string; from: string; text: string; ts: number }
export type CmdAction =
  | "open" | "close-all" | "theme" | "shader" | "accent" | "notify" | "cloak" | "lock"
  | "unlock" | "click" | "setcount" | "navigate" | "freeze" | "unfreeze" | "logout"
  | "ask-share" | "wallpaper-off" | "reset";

export interface Cmd { to: string; from: string; fromUser: string; action: CmdAction; payload?: any; id: string }

interface NetState {
  id: string; user: string | null; role: string; online: boolean;
  peers: Record<string, Peer>;
  frames: Record<string, { data: string; ts: number }>;
  chat: NetChat[]; log: NetLog[];
  pushLog: (dir: "in" | "out", kind: string, text: string) => void;
  clearLog: () => void;
}

export const useNet = create<NetState>((set) => ({
  id: uid(), user: null, role: "user", online: false,
  peers: {}, frames: {}, chat: [], log: [],
  pushLog: (dir, kind, text) =>
    set((s) => ({ log: [{ id: uid(), ts: Date.now(), dir, kind, text }, ...s.log].slice(0, 120) })),
  clearLog: () => set({ log: [] }),
}));

type Wire =
  | { t: "hello"; id: string }
  | { t: "presence"; p: Peer }
  | { t: "bye"; id: string }
  | { t: "frame"; id: string; data: string }
  | { t: "cmd"; c: Cmd }
  | { t: "chat"; m: NetChat };

let chan: BroadcastChannel | null = null;
let beat: number | undefined;
let cmdHandler: ((c: Cmd) => void) | null = null;
let sharing = false;

const post = (m: Wire) => {
  try {
    if (chan) chan.postMessage(m);
    else localStorage.setItem("sglr.bus", JSON.stringify({ m, n: Math.random() }));
  } catch { /* channel closed */ }
};

export const onCommand = (fn: (c: Cmd) => void) => { cmdHandler = fn; };
export const setSharing = (v: boolean) => { sharing = v; sendPresence(); };

export function sendPresence() {
  const st = useNet.getState();
  if (!st.user) return;
  const os = useOS.getState();
  const ui = useUI.getState();
  const prof = os.session ? os.db.profiles[os.session] : null;
  const p: Peer = {
    id: st.id, user: st.user, role: st.role,
    app: ui.focused ? String(ui.focused) : "desktop",
    count: prof?.clicker.count ?? 0,
    sharing, ts: Date.now(), theme: prof?.settings.theme ?? "ember",
  };
  post({ t: "presence", p });
}

export const sendFrame = (data: string) => post({ t: "frame", id: useNet.getState().id, data });
export const sendChat = (text: string) => {
  const st = useNet.getState();
  const m: NetChat = { id: uid(), from: st.user || "guest", text, ts: Date.now() };
  post({ t: "chat", m });
  useNet.setState((s) => ({ chat: [...s.chat, m].slice(-80) }));
  st.pushLog("out", "chat", text);
};
export const sendCmd = (to: string, action: CmdAction, payload?: any) => {
  const st = useNet.getState();
  const c: Cmd = { to, from: st.id, fromUser: st.user || "guest", action, payload, id: uid() };
  post({ t: "cmd", c });
  st.pushLog("out", action, `→ ${to === "all" ? "everyone" : to.slice(0, 6)} ${payload ? JSON.stringify(payload).slice(0, 60) : ""}`);
};

export function startNet(user: string, role: string) {
  stopNet();
  useNet.setState({ user, role, online: true, peers: {}, frames: {} });
  try { chan = new BroadcastChannel("singularity-mesh-v6"); } catch { chan = null; }

  const handle = (m: Wire) => {
    const st = useNet.getState();
    switch (m.t) {
      case "hello":
        if (m.id !== st.id) sendPresence();
        break;
      case "presence":
        if (m.p.id === st.id) return;
        useNet.setState((s) => ({ peers: { ...s.peers, [m.p.id]: m.p } }));
        break;
      case "bye":
        useNet.setState((s) => {
          const peers = { ...s.peers }; const frames = { ...s.frames };
          delete peers[m.id]; delete frames[m.id];
          return { peers, frames };
        });
        break;
      case "frame":
        if (m.id === st.id) return;
        useNet.setState((s) => ({ frames: { ...s.frames, [m.id]: { data: m.data, ts: Date.now() } } }));
        break;
      case "chat":
        useNet.setState((s) => ({ chat: [...s.chat, m.m].slice(-80) }));
        st.pushLog("in", "chat", `${m.m.from}: ${m.m.text}`);
        useUI.getState().notify({ title: `Message · ${m.m.from}`, desc: m.m.text, tone: "info" });
        break;
      case "cmd":
        if (m.c.to !== st.id && m.c.to !== "all") return;
        st.pushLog("in", m.c.action, `from ${m.c.fromUser}`);
        cmdHandler?.(m.c);
        break;
    }
  };

  if (chan) chan.onmessage = (e) => handle(e.data as Wire);
  else window.addEventListener("storage", (e) => {
    if (e.key !== "sglr.bus" || !e.newValue) return;
    try { handle(JSON.parse(e.newValue).m as Wire); } catch { /* ignore */ }
  });

  post({ t: "hello", id: useNet.getState().id });
  sendPresence();
  beat = window.setInterval(() => {
    sendPresence();
    const now = Date.now();
    useNet.setState((s) => {
      const peers: Record<string, Peer> = {}; const frames = { ...s.frames };
      Object.entries(s.peers).forEach(([k, v]) => { if (now - v.ts < 7000) peers[k] = v; else delete frames[k]; });
      return { peers, frames };
    });
  }, 2000);
}

export function stopNet() {
  if (beat) window.clearInterval(beat);
  beat = undefined;
  if (useNet.getState().user) post({ t: "bye", id: useNet.getState().id });
  try { chan?.close(); } catch { /* ignore */ }
  chan = null;
  sharing = false;
  useNet.setState({ online: false, user: null, peers: {}, frames: {} });
}

import { create } from "@/state/createStore";
import { uid, clamp } from "@/lib/utils";
import { useOS, type AppId, type Geom } from "@/state/store";
import { appMeta } from "@/os/apps/meta";

export interface Win extends Geom { id: AppId; z: number; min: boolean; max: boolean }
export interface Toast { id: string; title: string; desc?: string; tone: "info" | "ok" | "warn" | "bad"; ts: number }
export interface BrowserPageCtx { url: string; title: string; content: string; mode: string; ts: number }

interface UIState {
  windows: Win[]; zTop: number; focused: AppId | null;
  open: (id: AppId) => void;
  close: (id: AppId) => void;
  closeAll: () => void;
  focus: (id: AppId) => void;
  minimize: (id: AppId) => void;
  toggleMax: (id: AppId) => void;
  setGeom: (id: AppId, g: Partial<Geom>) => void;
  toasts: Toast[];
  notify: (t: { title: string; desc?: string; tone?: Toast["tone"] }) => void;
  dismiss: (id: string) => void;
  palette: boolean; setPalette: (v: boolean) => void;
  launcher: boolean; setLauncher: (v: boolean) => void;
  stealth: boolean; setStealth: (v: boolean) => void;
  locked: boolean; setLocked: (v: boolean) => void;
  freeze: string | null; setFreeze: (v: string | null) => void;
  fps: number; setFps: (n: number) => void;
  pulse: number; firePulse: () => void;
  savedAt: number; markSaved: () => void;
  mobile: boolean; setMobile: (v: boolean) => void;
  browserPage: BrowserPageCtx;
  setBrowserPage: (p: Partial<BrowserPageCtx>) => void;
  visionActive: boolean;
  visionFrame: string | null;
  visionRes: string;
  setVisionState: (p: { active?: boolean; frame?: string | null; res?: string }) => void;

  /* ---- agent screen control ---- */
  agentCursor: { x: number; y: number; visible: boolean; label: string; clicking: boolean };
  setAgentCursor: (p: Partial<{ x: number; y: number; visible: boolean; label: string; clicking: boolean }>) => void;
  agentRunning: boolean;
  setAgentRunning: (v: boolean) => void;
  agentNarration: string;
  setAgentNarration: (v: string) => void;
  pendingNav: { url: string; mode: string; nonce: number } | null;
  requestNav: (url: string, mode?: string) => void;
  pendingAudio: { preset: string; nonce: number } | null;
  requestAudio: (preset: string) => void;
}

const cascade = (i: number) => ({ x: 96 + (i % 5) * 34, y: 64 + (i % 5) * 28 });

let sharedStream: MediaStream | null = null;
let sharedVideo: HTMLVideoElement | null = null;

export function getVisionStream() { return sharedStream; }

export async function startVisionCapture(): Promise<boolean> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    toast("Screen capture unavailable", "This browser context blocks getDisplayMedia — using OS Workspace Vision instead", "warn");
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15 } },
      audio: false,
    });
    stopVisionCapture();
    sharedStream = stream;
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.srcObject = stream;
    await v.play().catch(() => undefined);
    sharedVideo = v;
    const track = stream.getVideoTracks()[0];
    const st = track?.getSettings?.() || {};
    const res = `${st.width ?? 1280}×${st.height ?? 720}`;
    track?.addEventListener("ended", () => stopVisionCapture());
    // Wait briefly for first frame
    await new Promise((r) => setTimeout(r, 180));
    const frame = grabVisionFrame();
    useUI.getState().setVisionState({ active: true, frame, res });
    return true;
  } catch {
    return false;
  }
}

export function stopVisionCapture() {
  sharedStream?.getTracks().forEach((t) => t.stop());
  sharedStream = null;
  if (sharedVideo) { sharedVideo.srcObject = null; sharedVideo = null; }
  useUI.getState().setVisionState({ active: false, res: "—" });
}

/** Grabs a JPEG dataURL from the active screen share OR synthesizes a visual snapshot of the Singularity OS workspace. */
export function grabVisionFrame(maxW = 720): string {
  if (sharedVideo && sharedVideo.videoWidth > 0) {
    const c = document.createElement("canvas");
    const scale = Math.min(1, maxW / sharedVideo.videoWidth);
    c.width = Math.round(sharedVideo.videoWidth * scale);
    c.height = Math.round(sharedVideo.videoHeight * scale);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.drawImage(sharedVideo, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", 0.72);
      useUI.getState().setVisionState({ frame: data });
      return data;
    }
  }
  // Synthesize a live visual diagram of the current Singularity OS workspace!
  const c = document.createElement("canvas");
  c.width = 640; c.height = 360;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const os = useOS.getState();
  const ui = useUI.getState();
  const prof = os.session ? os.db.profiles[os.session] : null;
  const accent = prof?.settings.accent || "#ff9f45";
  const accent2 = prof?.settings.accent2 || "#6ee7ff";

  // Background gradient
  const g = ctx.createLinearGradient(0, 0, 640, 360);
  g.addColorStop(0, "#080a12");
  g.addColorStop(1, "#121728");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 640, 360);

  // Shader glow orb
  const rg = ctx.createRadialGradient(320, 180, 10, 320, 180, 190);
  rg.addColorStop(0, accent + "66");
  rg.addColorStop(0.5, accent2 + "22");
  rg.addColorStop(1, "transparent");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, 640, 360);

  // Top bar
  ctx.fillStyle = "rgba(16,18,25,0.9)";
  ctx.fillRect(0, 0, 640, 22);
  ctx.fillStyle = accent;
  ctx.font = "bold 10px monospace";
  ctx.fillText(`SINGULARITY OS · USER: ${(os.session || "guest").toUpperCase()} · SHADER: ${(prof?.settings.shader || "blackhole").toUpperCase()}`, 10, 14);

  // Draw open windows scaled to 640x360
  const sx = 640 / Math.max(window.innerWidth, 800);
  const sy = 360 / Math.max(window.innerHeight, 500);
  ui.windows.filter((w) => !w.min).forEach((w) => {
    const wx = w.max ? 40 : Math.round(w.x * sx);
    const wy = w.max ? 26 : Math.round(w.y * sy);
    const ww = w.max ? 580 : Math.round(w.w * sx);
    const wh = w.max ? 310 : Math.round(w.h * sy);
    ctx.fillStyle = "rgba(18, 21, 32, 0.92)";
    ctx.strokeStyle = ui.focused === w.id ? accent : "rgba(255,255,255,0.2)";
    ctx.lineWidth = ui.focused === w.id ? 2 : 1;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(wx, wy, ww, 16);
    ctx.fillStyle = "#eef0f6";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText(appMeta(w.id).name.toUpperCase(), wx + 6, wy + 11);
  });

  // Overlay workspace telemetry summary
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(10, 318, 620, 34);
  ctx.fillStyle = accent2;
  ctx.font = "10px monospace";
  ctx.fillText(`OPEN: ${ui.windows.map((w) => w.id).join(", ") || "desktop"} | MASS: ${Math.floor(prof?.clicker.count || 0)} | NOTES: ${prof?.notes.length || 0} | PORTAL: ${ui.browserPage.title || "idle"}`, 16, 338);

  const data = c.toDataURL("image/jpeg", 0.78);
  useUI.getState().setVisionState({ frame: data });
  return data;
}

export const useUI = create<UIState>((set, get) => ({
  windows: [], zTop: 10, focused: null,

  open: (id) => {
    const { windows, zTop, mobile } = get();
    const meta = appMeta(id);
    const found = windows.find((w) => w.id === id);
    const z = zTop + 1;
    if (found) {
      set({
        windows: windows.map((w) => (w.id === id ? { ...w, min: false, z } : w)),
        zTop: z, focused: id, palette: false, launcher: false,
      });
      return;
    }
    const vw = window.innerWidth, vh = window.innerHeight;
    let saved: Geom | undefined;
    try {
      const os = useOS.getState();
      saved = os.session ? os.db.profiles[os.session]?.geom?.[id] : undefined;
    } catch { /* store not ready */ }
    const w = Math.min(saved?.w ?? meta.w, vw - 40), h = Math.min(saved?.h ?? meta.h, vh - 120);
    const pos = cascade(windows.length);
    const win: Win = {
      id, z, min: false, max: mobile || vw < 820,
      x: clamp(saved?.x ?? pos.x, 12, Math.max(12, vw - w - 12)),
      y: clamp(saved?.y ?? pos.y, 48, Math.max(48, vh - h - 64)),
      w, h,
    };
    set({ windows: [...windows, win], zTop: z, focused: id, palette: false, launcher: false });
  },

  close: (id) => set((s) => ({
    windows: s.windows.filter((w) => w.id !== id),
    focused: s.windows.filter((w) => w.id !== id).slice(-1)[0]?.id ?? null,
  })),
  closeAll: () => set({ windows: [], focused: null }),
  focus: (id) => {
    const z = get().zTop + 1;
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, z, min: false } : w)), zTop: z, focused: id }));
  },
  minimize: (id) => set((s) => ({
    windows: s.windows.map((w) => (w.id === id ? { ...w, min: !w.min } : w)),
    focused: null,
  })),
  toggleMax: (id) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, max: !w.max } : w)) })),
  setGeom: (id, g) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...g } : w)) })),

  toasts: [],
  notify: ({ title, desc, tone = "info" }) => {
    const t: Toast = { id: uid(), title, desc, tone, ts: Date.now() };
    set((s) => ({ toasts: [...s.toasts.slice(-3), t] }));
    window.setTimeout(() => get().dismiss(t.id), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  palette: false, setPalette: (v) => set({ palette: v, launcher: false }),
  launcher: false, setLauncher: (v) => set({ launcher: v, palette: false }),
  stealth: false, setStealth: (v) => set({ stealth: v }),
  locked: false, setLocked: (v) => set({ locked: v }),
  freeze: null, setFreeze: (v) => set({ freeze: v }),
  fps: 60, setFps: (n) => set({ fps: n }),
  pulse: 0, firePulse: () => set((s) => ({ pulse: s.pulse + 1 })),
  savedAt: Date.now(), markSaved: () => set({ savedAt: Date.now() }),
  mobile: false, setMobile: (v) => set({ mobile: v }),

  browserPage: { url: "", title: "Portal Start Page", content: "", mode: "instant", ts: Date.now() },
  setBrowserPage: (p) => set((s) => ({ browserPage: { ...s.browserPage, ...p, ts: Date.now() } })),

  visionActive: false,
  visionFrame: null,
  visionRes: "—",
  setVisionState: (p) => set((s) => ({
    visionActive: p.active ?? s.visionActive,
    visionFrame: p.frame !== undefined ? p.frame : s.visionFrame,
    visionRes: p.res ?? s.visionRes,
  })),

  agentCursor: { x: 0, y: 0, visible: false, label: "", clicking: false },
  setAgentCursor: (p) => set((s) => ({ agentCursor: { ...s.agentCursor, ...p } })),
  agentRunning: false,
  setAgentRunning: (v) => set({ agentRunning: v }),
  agentNarration: "",
  setAgentNarration: (v) => set({ agentNarration: v }),
  pendingNav: null,
  requestNav: (url, mode = "auto") => set({ pendingNav: { url, mode, nonce: Date.now() + Math.random() } }),
  pendingAudio: null,
  requestAudio: (preset) => set({ pendingAudio: { preset, nonce: Date.now() + Math.random() } }),
}));

export const toast = (title: string, desc?: string, tone: Toast["tone"] = "info") =>
  useUI.getState().notify({ title, desc, tone });
export const openApp = (id: AppId) => useUI.getState().open(id);

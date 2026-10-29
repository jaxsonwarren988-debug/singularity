import { create } from "@/state/createStore";
import { uid, sha256, clamp } from "@/lib/utils";
import type { ThemeId, ShaderId, CloakId } from "@/lib/themes";

/* ------------------------------------------------------------------ types */
export type AppId =
  | "core" | "modules" | "tools" | "ai" | "share" | "games"
  | "terminal" | "admin" | "notes" | "music" | "browser" | "help";

export type AIPersona = "kalmia" | "kalmia-code" | "nova";

export interface Settings {
  theme: ThemeId; accent: string; accent2: string;
  shader: ShaderId; shaderOn: boolean; shaderSpeed: number; shaderIntensity: number; shaderScale: number;
  quality: number; parallax: boolean; disk: boolean; lens: boolean; stars: boolean; ring: boolean; aberration: number;
  wallpaper: string; wpOpacity: number; wpBlur: number; wpScale: number; wpRotate: number; wpX: number; wpY: number;
  wpFit: "cover" | "contain"; wpBlend: string;
  fxScan: boolean; fxGrain: boolean; fxVignette: boolean; fxCrt: boolean; fxSnow: boolean; fxRain: boolean;
  fxTrail: boolean; fxBloom: number; hue: number; invert: boolean; saturation: number;
  clickFx: "ripple" | "particles" | "numbers" | "none";
  sound: boolean; volume: number; wave: string; pitch: number; variation: number; haptics: boolean;
  uiScale: number; radius: number; blur: number; panelOpacity: number; dockLabels: boolean;
  showFps: boolean; clock24: boolean; reduceMotion: boolean; coreFloat: boolean; kawaii: boolean;
  cloak: CloakId; autoLockMin: number;
  aiPersona: AIPersona;
  aiBase: string; aiKey: string; aiModel: string; aiSystem: string; aiCloud: boolean;
}

export interface Clicker {
  count: number; total: number; clicks: number;
  power: number; drones: number; reactors: number; folds: number;
  prestige: number; achievements: string[]; autoOn: boolean; autoRate: number; lastTick: number;
}
export interface Note { id: string; title: string; body: string; tag: string; pinned: boolean; ts: number }
export interface Todo { id: string; text: string; done: boolean; pri: 0 | 1 | 2; ts: number }
export interface Link { id: string; title: string; url: string; hits: number }
export interface Geom { x: number; y: number; w: number; h: number }

export interface CustomGame {
  id: string; name: string; tag: string; blurb: string; html: string; created: number;
}
export interface ChatMsg {
  id: string; role: "user" | "ai" | "system"; text: string; ts: number;
  model?: string;
  thought?: string;
  screenshot?: string;
  actions?: { label: string; app?: AppId; detail?: string }[];
  codePreview?: string;
}

export interface Profile {
  settings: Settings; clicker: Clicker; notes: Note[]; todos: Todo[]; links: Link[];
  chat: ChatMsg[]; history: string[]; favGames: string[]; customGames: CustomGame[];
  geom: Record<string, Geom>; created: number;
}
export interface UserRec { name: string; hash: string; role: "admin" | "user"; created: number; seen: number; color: string }
export interface DB { users: Record<string, UserRec>; profiles: Record<string, Profile>; v: number }

/* --------------------------------------------------------------- defaults */
export const defaultSettings = (): Settings => ({
  theme: "ember", accent: "#ff9f45", accent2: "#6ee7ff",
  shader: "blackhole", shaderOn: true, shaderSpeed: 100, shaderIntensity: 100, shaderScale: 100,
  quality: 0.85, parallax: true, disk: true, lens: true, stars: true, ring: true, aberration: 100,
  wallpaper: "", wpOpacity: 55, wpBlur: 0, wpScale: 100, wpRotate: 0, wpX: 50, wpY: 50, wpFit: "cover", wpBlend: "normal",
  fxScan: false, fxGrain: false, fxVignette: true, fxCrt: false, fxSnow: false, fxRain: false,
  fxTrail: false, fxBloom: 60, hue: 0, invert: false, saturation: 100,
  clickFx: "particles",
  sound: true, volume: 8, wave: "sine", pitch: 520, variation: 18, haptics: true,
  uiScale: 100, radius: 14, blur: 18, panelOpacity: 92, dockLabels: true,
  showFps: true, clock24: true, reduceMotion: false, coreFloat: true, kawaii: false,
  cloak: "none", autoLockMin: 0,
  aiPersona: "kalmia",
  aiBase: "https://text.pollinations.ai/openai", aiKey: "", aiModel: "openai", aiCloud: true,
  aiSystem: "You are KALMIA, the frontier autonomous vision and work intelligence inside Singularity OS. You can see the user's screen, write essays and notes into their Vault, solve math/science/coding problems step by step, build runnable mini-apps, and control every part of the OS.",
});

export const defaultClicker = (): Clicker => ({
  count: 0, total: 0, clicks: 0, power: 1, drones: 0, reactors: 0, folds: 0,
  prestige: 0, achievements: [], autoOn: false, autoRate: 250, lastTick: Date.now(),
});

export const defaultProfile = (): Profile => ({
  settings: defaultSettings(),
  clicker: defaultClicker(),
  notes: [{ id: uid(), title: "Welcome to Singularity", body: "# Scratchpad\nEverything here autosaves to this browser.\n\n- Drag windows by their title bar\n- ⌘/Ctrl + K opens the command deck\n- Shift + S is the panic key", tag: "system", pinned: true, ts: Date.now() }],
  todos: [{ id: uid(), text: "Explore the Modules panel", done: false, pri: 1, ts: Date.now() }],
  links: [
    { id: uid(), title: "Wikipedia", url: "https://en.wikipedia.org/wiki/Main_Page", hits: 0 },
    { id: uid(), title: "Desmos Graphing", url: "https://www.desmos.com/calculator", hits: 0 },
  ],
  chat: [], history: [], favGames: [], customGames: [], geom: {}, created: Date.now(),
});

const DB_KEY = "singularity.db.v6";
const SESSION_KEY = "singularity.session.v6";
const COLORS = ["#ff9f45", "#6ee7ff", "#9ef01a", "#ff8fc4", "#ffd166", "#c4b5fd", "#2dd4bf", "#ff6b6b"];

function readDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.users && parsed.profiles) return parsed;
    }
  } catch { /* corrupt -> fresh */ }
  return { users: {}, profiles: {}, v: 6 };
}

/* ------------------------------------------------------------------- store */
interface OSState {
  db: DB;
  session: string | null;
  ready: boolean;
  init: () => Promise<void>;
  signup: (name: string, pass: string) => Promise<string | null>;
  login: (name: string, pass: string) => Promise<string | null>;
  loginAdmin: (pass: string) => Promise<string | null>;
  logout: () => void;
  patchSettings: (p: Partial<Settings>) => void;
  patchClicker: (p: Partial<Clicker>) => void;
  updateProfile: (fn: (p: Profile) => Profile) => void;
  resetSettings: () => void;
  resetAll: () => void;
  adminCreate: (name: string, pass: string, role: "admin" | "user") => Promise<string | null>;
  adminDelete: (name: string) => void;
  adminRole: (name: string, role: "admin" | "user") => void;
  adminPass: (name: string, pass: string) => Promise<void>;
  adminWipeOthers: () => void;
  importDB: (json: string) => boolean;
  exportDB: () => string;
  touch: () => void;
}

let saveTimer: number | undefined;
let applyingRemote = false;

function persist(db: DB) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    try {
      const slim: DB = JSON.parse(JSON.stringify(db));
      Object.values(slim.profiles).forEach((p) => { p.settings.wallpaper = ""; });
      localStorage.setItem(DB_KEY, JSON.stringify(slim));
      window.dispatchEvent(new CustomEvent("sglr:quota"));
    } catch { /* storage disabled */ }
  }
  window.dispatchEvent(new CustomEvent("sglr:saved"));
}

function scheduleSave(db: DB) {
  if (applyingRemote) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => persist(db), 120);
}

export const useOS = create<OSState>((set, get) => ({
  db: readDB(),
  session: null,
  ready: false,

  init: async () => {
    const db = readDB();
    if (!db.users["admin"]) {
      db.users["admin"] = { name: "admin", hash: await sha256("Kioto"), role: "admin", created: Date.now(), seen: Date.now(), color: "#ff4d6d" };
      db.profiles["admin"] = defaultProfile();
      persist(db);
    }
    let session: string | null = null;
    try { session = sessionStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
    if (session && !db.users[session]) session = null;
    if (session) db.users[session].seen = Date.now();
    set({ db, session, ready: true });

    window.addEventListener("storage", (e) => {
      if (e.key !== DB_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as DB;
        applyingRemote = true;
        set({ db: next });
        applyingRemote = false;
      } catch { /* ignore */ }
    });
    const flush = () => { window.clearTimeout(saveTimer); persist(get().db); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  },

  signup: async (name, pass) => {
    const n = name.trim();
    if (n.length < 2) return "Username needs 2+ characters";
    if (!/^[a-zA-Z0-9_]+$/.test(n)) return "Letters, numbers and underscores only";
    if (pass.length < 3) return "Password needs 3+ characters";
    const db = get().db;
    if (db.users[n.toLowerCase()]) return "That handle is already registered";
    const key = n.toLowerCase();
    const users = { ...db.users, [key]: { name: key, hash: await sha256(pass), role: "user" as const, created: Date.now(), seen: Date.now(), color: COLORS[Object.keys(db.users).length % COLORS.length] } };
    const profiles = { ...db.profiles, [key]: defaultProfile() };
    const next = { ...db, users, profiles };
    set({ db: next, session: key });
    try { sessionStorage.setItem(SESSION_KEY, key); } catch { /* ignore */ }
    persist(next);
    return null;
  },

  login: async (name, pass) => {
    const key = name.trim().toLowerCase();
    const db = get().db;
    const u = db.users[key];
    if (!u) return "No account with that handle";
    if (u.hash !== (await sha256(pass))) return "Incorrect password";
    const next = { ...db, users: { ...db.users, [key]: { ...u, seen: Date.now() } } };
    if (!next.profiles[key]) next.profiles = { ...next.profiles, [key]: defaultProfile() };
    set({ db: next, session: key });
    try { sessionStorage.setItem(SESSION_KEY, key); } catch { /* ignore */ }
    persist(next);
    return null;
  },

  loginAdmin: async (pass) => {
    const db = get().db;
    const u = db.users["admin"];
    if (!u || u.hash !== (await sha256(pass))) return "Admin key rejected";
    const next = { ...db, users: { ...db.users, admin: { ...u, seen: Date.now() } } };
    set({ db: next, session: "admin" });
    try { sessionStorage.setItem(SESSION_KEY, "admin"); } catch { /* ignore */ }
    persist(next);
    return null;
  },

  logout: () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    window.clearTimeout(saveTimer);
    persist(get().db);
    set({ session: null });
  },

  patchSettings: (p) => {
    const { db, session } = get();
    if (!session || !db.profiles[session]) return;
    const prof = db.profiles[session];
    const next = { ...db, profiles: { ...db.profiles, [session]: { ...prof, settings: { ...prof.settings, ...p } } } };
    set({ db: next }); scheduleSave(next);
  },

  patchClicker: (p) => {
    const { db, session } = get();
    if (!session || !db.profiles[session]) return;
    const prof = db.profiles[session];
    const next = { ...db, profiles: { ...db.profiles, [session]: { ...prof, clicker: { ...prof.clicker, ...p } } } };
    set({ db: next }); scheduleSave(next);
  },

  updateProfile: (fn) => {
    const { db, session } = get();
    if (!session || !db.profiles[session]) return;
    const next = { ...db, profiles: { ...db.profiles, [session]: fn(db.profiles[session]) } };
    set({ db: next }); scheduleSave(next);
  },

  resetSettings: () => {
    const { db, session } = get();
    if (!session) return;
    const prof = db.profiles[session];
    const next = { ...db, profiles: { ...db.profiles, [session]: { ...prof, settings: defaultSettings() } } };
    set({ db: next }); persist(next);
  },

  resetAll: () => {
    const { db, session } = get();
    if (!session) return;
    const next = { ...db, profiles: { ...db.profiles, [session]: defaultProfile() } };
    set({ db: next }); persist(next);
  },

  adminCreate: async (name, pass, role) => {
    const key = name.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,}$/.test(key)) return "Invalid handle";
    if (pass.length < 3) return "Password too short";
    const db = get().db;
    if (db.users[key]) return "Handle exists";
    const next: DB = {
      ...db,
      users: { ...db.users, [key]: { name: key, hash: await sha256(pass), role, created: Date.now(), seen: 0, color: COLORS[Object.keys(db.users).length % COLORS.length] } },
      profiles: { ...db.profiles, [key]: defaultProfile() },
    };
    set({ db: next }); persist(next);
    return null;
  },

  adminDelete: (name) => {
    if (name === "admin") return;
    const db = get().db;
    const users = { ...db.users }; const profiles = { ...db.profiles };
    delete users[name]; delete profiles[name];
    const next = { ...db, users, profiles };
    set({ db: next }); persist(next);
  },

  adminRole: (name, role) => {
    const db = get().db;
    if (!db.users[name]) return;
    const next = { ...db, users: { ...db.users, [name]: { ...db.users[name], role } } };
    set({ db: next }); persist(next);
  },

  adminPass: async (name, pass) => {
    const db = get().db;
    if (!db.users[name]) return;
    const next = { ...db, users: { ...db.users, [name]: { ...db.users[name], hash: await sha256(pass) } } };
    set({ db: next }); persist(next);
  },

  adminWipeOthers: () => {
    const { db, session } = get();
    const users: Record<string, UserRec> = {}; const profiles: Record<string, Profile> = {};
    Object.keys(db.users).forEach((k) => {
      if (k === session || k === "admin") { users[k] = db.users[k]; profiles[k] = db.profiles[k]; }
    });
    const next = { ...db, users, profiles };
    set({ db: next }); persist(next);
  },

  importDB: (json) => {
    try {
      const parsed = JSON.parse(json) as DB;
      if (!parsed.users || !parsed.profiles) return false;
      const merged: DB = { v: 6, users: { ...get().db.users, ...parsed.users }, profiles: { ...get().db.profiles, ...parsed.profiles } };
      set({ db: merged }); persist(merged);
      return true;
    } catch { return false; }
  },

  exportDB: () => JSON.stringify(get().db, null, 2),

  touch: () => {
    const { db, session } = get();
    if (!session || !db.users[session]) return;
    const next = { ...db, users: { ...db.users, [session]: { ...db.users[session], seen: Date.now() } } };
    set({ db: next }); scheduleSave(next);
  },
}));

/* --------------------------------------------------------------- selectors */
const FALLBACK = defaultProfile();
export const useProfile = (): Profile => {
  useOS((s) => s.session);
  const prof = useOS((s) => (s.session ? s.db.profiles[s.session] : undefined));
  return prof || FALLBACK;
};
export const useSettings = (): Settings => useProfile().settings;
export const useIsAdmin = () => useOS((s) => (s.session ? s.db.users[s.session]?.role === "admin" : false));
export const setS = (p: Partial<Settings>) => useOS.getState().patchSettings(p);
export const setClicker = (p: Partial<Clicker>) => useOS.getState().patchClicker(p);
export const clickerMult = (c: Clicker) => 1 + c.prestige * 0.5 + c.folds * 0.1;
export const perSecond = (c: Clicker) => (c.drones * 1 + c.reactors * 14) * clickerMult(c);
export const upgradeCost = (base: number, level: number) => Math.floor(base * Math.pow(1.17, level));
export const clampSetting = clamp;

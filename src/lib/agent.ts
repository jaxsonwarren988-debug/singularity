import { useOS, setS, setClicker, clickerMult, upgradeCost, type AppId } from "@/state/store";
import { useUI, toast, grabVisionFrame } from "@/state/ui";
import { APPS, appMeta } from "@/os/apps/meta";
import { THEMES, SHADERS, CLOAKS } from "@/lib/themes";
import { uid, evalMath, short } from "@/lib/utils";
import { saveNoteToVault, addTodosToVault, saveCustomGame, novaRespond } from "@/lib/nova";
import { appByName } from "@/lib/commands";
import { audio } from "@/lib/audio";

/* ------------------------------------------------------------------ types */
export type StepStatus = "pending" | "active" | "done" | "failed";

export interface AgentStep {
  id: string;
  label: string;
  detail: string;
  action: string;
  payload?: any;
  status: StepStatus;
  result?: string;
  app?: AppId;
}

export interface AgentPlan {
  goal: string;
  summary: string;
  steps: AgentStep[];
}

/** Everything the agent can do — surfaced in the UI so nothing is hidden. */
export const CAPABILITIES: { group: string; icon: string; items: { say: string; does: string }[] }[] = [
  {
    group: "Control the screen",
    icon: "cursor",
    items: [
      { say: "open the arcade and play slope", does: "Moves the cursor to the dock, clicks Arcade, launches Slope 3D" },
      { say: "close everything", does: "Closes every open window" },
      { say: "make it look like a hacker terminal", does: "Switches theme to Phosphor + Digital Rain shader + scanlines" },
      { say: "turn on snow and film grain", does: "Enables ambient screen effects" },
    ],
  },
  {
    group: "Do your work",
    icon: "work",
    items: [
      { say: "write an essay about black holes", does: "Drafts a full essay and saves it into your Vault" },
      { say: "make flashcards for photosynthesis", does: "Builds a Q&A deck as a pinned Vault note" },
      { say: "study plan for my biology test", does: "Writes a study guide AND queues the tasks" },
      { say: "solve 2x^2 - 7x + 3 = 0", does: "Shows every algebra step and the roots" },
    ],
  },
  {
    group: "Browse & research",
    icon: "globe",
    items: [
      { say: "search youtube for lofi beats", does: "Opens Portal on YouTube results (embed-safe)" },
      { say: "open tiktok", does: "Opens the TikTok route with a working embed strategy" },
      { say: "research quantum computing and save notes", does: "Opens Portal, then writes a summary to the Vault" },
    ],
  },
  {
    group: "Build & play",
    icon: "code",
    items: [
      { say: "build me a pong game", does: "Writes a playable game, installs it in Arcade, opens it" },
      { say: "play study music", does: "Starts the Deep Focus ambience preset" },
      { say: "click the reactor 500 times", does: "Fires the reactor and buys the best upgrade you can afford" },
    ],
  },
];

/* --------------------------------------------------------- cursor mechanics */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const scale = (useOS.getState().session
    ? useOS.getState().db.profiles[useOS.getState().session!]?.settings.uiScale ?? 100
    : 100) / 100;
  return { x: (r.left + r.width / 2) / scale, y: (r.top + r.height / 2) / scale };
}

/** Smoothly glides the visible agent cursor to a point. */
async function glideTo(x: number, y: number, label: string) {
  const ui = useUI.getState();
  const from = ui.agentCursor;
  ui.setAgentCursor({ visible: true, label });
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = 1 - Math.pow(1 - t, 3);
    useUI.getState().setAgentCursor({
      x: from.x + (x - from.x) * e,
      y: from.y + (y - from.y) * e,
    });
    await wait(11);
  }
}

/** Finds a real on-screen control, moves the cursor onto it, and clicks it. */
async function clickTarget(selector: string, label: string): Promise<boolean> {
  let el = document.querySelector(selector) as HTMLElement | null;
  if (!el) {
    // Fall back to matching by visible text inside the dock / launcher.
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-agent]"));
    el = candidates.find((c) => (c.textContent || "").toLowerCase().includes(label.toLowerCase())) || null;
  }
  if (!el) return false;
  const { x, y } = centerOf(el);
  await glideTo(x, y, label);
  useUI.getState().setAgentCursor({ clicking: true });
  audio.blip(1180, 0.035, 0.03);
  await wait(130);
  el.click();
  await wait(170);
  useUI.getState().setAgentCursor({ clicking: false });
  return true;
}

/* -------------------------------------------------------------- planning */
const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

function step(action: string, label: string, detail: string, payload?: any, app?: AppId): AgentStep {
  return { id: uid(), action, label, detail, payload, app, status: "pending" };
}

/** Turns a plain-English request into an ordered, executable plan. */
export function planTask(raw: string): AgentPlan {
  const q = raw.trim();
  const t = q.toLowerCase();
  const steps: AgentStep[] = [];
  let summary = "";

  const mentionedApp =
    APPS.find((a) => t.includes(a.id) || t.includes(a.name.toLowerCase()) || t.includes(a.short.toLowerCase())) ||
    (has(t, "game", "arcade", "play") ? appMeta("games") : null);

  // --- vision first, when the request is about the screen ---
  if (has(t, "screen", "what am i looking", "see this", "look at", "my page", "this page")) {
    steps.push(step("vision", "Capture the screen", "Grab a frame from the linked display or the OS workspace"));
  }

  // --- research / browse ---
  const yt = t.match(/(?:youtube|yt)\s+(?:for\s+)?(.+)/);
  const tt = has(t, "tiktok", "tik tok");
  const searchMatch = t.match(/(?:search|google|look up|find)\s+(?:for\s+|up\s+)?(.+)/);
  if (yt) {
    steps.push(step("browse", "Open YouTube in Portal", `Results for “${yt[1]}”`, { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(yt[1])}`, mode: "youtube" }, "browser"));
    summary = `Searching YouTube for ${yt[1]}.`;
  } else if (tt) {
    steps.push(step("browse", "Open TikTok route", "Using the embed-safe TikTok player", { url: "https://www.tiktok.com/discover", mode: "tiktok" }, "browser"));
    summary = "Opening TikTok with the embed strategy that actually loads.";
  } else if (searchMatch && !has(t, "flashcard", "essay")) {
    const term = searchMatch[1].replace(/\s+and\s+save.*$/, "").trim();
    steps.push(step("browse", "Search the web", term, { url: term, mode: "search" }, "browser"));
    summary = `Researching “${term}”.`;
  } else if (has(t, "open ") && mentionedApp) {
    steps.push(step("open", `Open ${mentionedApp.name}`, mentionedApp.desc, { app: mentionedApp.id }, mentionedApp.id));
    summary = `Launching ${mentionedApp.name}.`;
  }

  // --- appearance ---
  const theme = THEMES.find((x) => t.includes(x.id) || t.includes(x.name.toLowerCase()));
  const shader = SHADERS.find((x) => t.includes(x.id) || t.includes(x.name.toLowerCase()));
  if (theme) steps.push(step("theme", `Apply ${theme.name} theme`, theme.blurb, { id: theme.id }, "modules"));
  if (shader) steps.push(step("shader", `Switch renderer to ${shader.name}`, shader.desc, { id: shader.id }, "modules"));
  if (has(t, "hacker", "terminal look", "matrix look")) {
    steps.push(step("theme", "Apply Phosphor theme", "CRT green monochrome", { id: "phosphor" }, "modules"));
    steps.push(step("shader", "Digital Rain renderer", "Falling glyph columns", { id: "matrix" }, "modules"));
    steps.push(step("fx", "Enable scanlines", "CRT raster overlay", { key: "fxScan", on: true }));
  }
  if (has(t, "snow")) steps.push(step("fx", "Snowfall on", "Drifting particles", { key: "fxSnow", on: true }));
  if (has(t, "rain effect", "make it rain")) steps.push(step("fx", "Rain on", "Streaking downpour", { key: "fxRain", on: true }));
  if (has(t, "grain")) steps.push(step("fx", "Film grain on", "Animated sensor noise", { key: "fxGrain", on: true }));
  if (has(t, "clean", "tidy", "declutter", "close everything", "close all")) {
    steps.push(step("closeall", "Clear the desktop", "Close every open window"));
  }

  // --- work products ---
  if (has(t, "flashcard", "quiz me", "quiz cards")) {
    steps.push(step("flashcards", "Write a flashcard deck", "Saved as a pinned Vault note", { topic: q }, "notes"));
    summary = summary || "Building your flashcard deck.";
  } else if (has(t, "essay", "paper", "paragraph", "write about", "write an", "write a report")) {
    steps.push(step("essay", "Draft the essay", "Structured multi-paragraph document", { topic: q }, "notes"));
    summary = summary || "Writing your essay.";
  } else if (has(t, "study plan", "study guide", "revise", "revision", "notes on", "notes for", "summar")) {
    steps.push(step("guide", "Write a study guide", "Overview, pillars, takeaways", { topic: q }, "notes"));
    summary = summary || "Preparing your study guide.";
  }

  if (has(t, "study plan", "study mode", "focus mode", "lock in", "homework", "get to work")) {
    steps.push(step("tasks", "Queue a work checklist", "Three actionable tasks in the Vault", { topic: q }, "notes"));
    steps.push(step("audio", "Start Deep Focus ambience", "Drone + rain + theta beat", { preset: "Deep focus" }, "music"));
    steps.push(step("theme", "Calm the interface", "Cryo theme, Aurora renderer", { id: "cryo" }, "modules"));
    summary = summary || "Setting up a focus workspace and a plan of attack.";
  }

  // --- build ---
  if (has(t, "build", "code me", "make me a game", "create a game", "program")) {
    steps.push(step("build", "Generate a playable build", "Self-contained HTML5 bundle", { prompt: q }, "games"));
    summary = summary || "Compiling a playable build.";
  }

  // --- reactor ---
  const clickN = t.match(/click(?:\s+the\s+reactor)?\s*(\d+)?/) || t.match(/(\d+)\s*clicks/);
  if (clickN && has(t, "click", "harvest", "mine", "grind")) {
    const n = Math.min(25000, parseInt(clickN[1] || "100", 10) || 100);
    steps.push(step("reactor", `Fire the reactor ${n}×`, "Adds mass at your current multiplier", { n }, "core"));
    steps.push(step("upgrade", "Buy the best affordable upgrade", "Spends the mass automatically", undefined, "core"));
    summary = summary || `Grinding ${n} reactor clicks and reinvesting.`;
  }

  // --- audio ---
  if (has(t, "music", "ambience", "lofi", "focus sound", "relax", "rain sound")) {
    const preset = has(t, "storm", "rain") ? "Storm watch" : has(t, "sleep", "night") ? "Night orbit" : "Deep focus";
    steps.push(step("audio", `Play ${preset}`, "Generative WebAudio layers", { preset }, "music"));
    summary = summary || `Starting ${preset}.`;
  }

  // --- privacy ---
  if (has(t, "panic", "hide", "stealth", "teacher coming")) {
    steps.push(step("stealth", "Engage stealth screen", "Shift+S returns", undefined));
  }
  if (has(t, "cloak")) {
    const c = CLOAKS.find((x) => x.id !== "none" && t.includes(x.id)) || CLOAKS[1];
    steps.push(step("cloak", `Disguise tab as ${c.name}`, "Rewrites title and favicon", { id: c.id }));
  }

  // --- maths ---
  if (/[0-9]\s*[x^+\-*/=]/.test(t) && has(t, "solve", "=", "calculate", "compute")) {
    steps.push(step("math", "Solve step by step", "Symbolic + numeric kernel", { expr: q }));
    summary = summary || "Solving your equation.";
  }

  // --- always finish by opening the produced artefact ---
  const produced = steps.find((s) => ["essay", "guide", "flashcards", "tasks"].includes(s.action));
  if (produced && !steps.some((s) => s.action === "open" && s.payload?.app === "notes")) {
    steps.push(step("open", "Open the Vault", "Show the work that was just created", { app: "notes" }, "notes"));
  }
  const built = steps.find((s) => s.action === "build");
  if (built) steps.push(step("open", "Open the Arcade", "Your build is installed under Custom Studio", { app: "games" }, "games"));

  if (!steps.length) {
    steps.push(step("vision", "Read the current screen", "Grounding the answer in what you're looking at"));
    steps.push(step("answer", "Answer the request", "KALMIA reasoning engine", { prompt: q }));
    summary = "Reading your workspace, then answering.";
  }

  return { goal: q, summary: summary || "Executing your request.", steps };
}

/* -------------------------------------------------------------- execution */
export async function runPlan(
  plan: AgentPlan,
  onUpdate: (steps: AgentStep[]) => void
): Promise<{ steps: AgentStep[]; notes: string[]; code?: string }> {
  const steps = plan.steps.map((s) => ({ ...s }));
  const notes: string[] = [];
  let code: string | undefined;
  const ui = useUI.getState();
  ui.setAgentRunning(true);
  ui.setAgentCursor({ visible: true, x: window.innerWidth * 0.5, y: window.innerHeight * 0.6 });

  const emit = () => onUpdate(steps.map((s) => ({ ...s })));

  for (const s of steps) {
    s.status = "active";
    useUI.getState().setAgentNarration(s.label);
    emit();
    await wait(230);
    try {
      switch (s.action) {
        case "vision": {
          const frame = grabVisionFrame();
          const u = useUI.getState();
          s.result = `Frame captured (${u.visionActive ? u.visionRes : "workspace 640×360"}) · ${(u.browserPage.title || "desktop").slice(0, 40)}`;
          s.status = "done";
          if (frame) notes.push("__VISION__" + frame);
          break;
        }
        case "open": {
          const app = s.payload.app as AppId;
          const ok = await clickTarget(`[data-agent="dock-${app}"]`, appMeta(app).short);
          if (!ok) useUI.getState().open(app);
          s.result = `${appMeta(app).name} focused`;
          s.status = "done";
          break;
        }
        case "closeall": {
          await clickTarget('[data-agent="taskbar-menu"]', "Menu");
          useUI.getState().closeAll();
          useUI.getState().setLauncher(false);
          s.result = "Desktop cleared";
          s.status = "done";
          break;
        }
        case "theme": {
          const th = THEMES.find((x) => x.id === s.payload.id);
          if (th) {
            setS({ theme: th.id, accent: th.vars["--accent"], accent2: th.vars["--accent-2"] });
            if (th.id === "cryo") setS({ shader: "aurora" });
            s.result = `${th.name} applied`;
          }
          s.status = "done";
          break;
        }
        case "shader": {
          setS({ shader: s.payload.id, shaderOn: true });
          s.result = `${s.payload.id} rendering`;
          s.status = "done";
          break;
        }
        case "fx": {
          setS({ [s.payload.key]: s.payload.on } as any);
          s.result = `${s.payload.key} → ${s.payload.on ? "on" : "off"}`;
          s.status = "done";
          break;
        }
        case "browse": {
          const ok = await clickTarget('[data-agent="dock-browser"]', "Portal");
          if (!ok) useUI.getState().open("browser");
          await wait(280);
          useUI.getState().requestNav(s.payload.url, s.payload.mode);
          s.result = `Portal → ${String(s.payload.url).slice(0, 48)}`;
          s.status = "done";
          break;
        }
        case "essay":
        case "guide":
        case "flashcards": {
          const kind = s.action === "essay" ? "essay" : s.action === "guide" ? "guide" : "flashcards";
          const topic = String(s.payload.topic || plan.goal);
          const verb = kind === "essay" ? "write an essay on " : kind === "guide" ? "make a study guide on " : "make flashcards on ";
          const r = novaRespond(verb + topic.replace(/^(write|make|create)\s+(an?\s+)?\w+\s+(on|about|for)\s+/i, ""));
          notes.push(r.text);
          s.result = r.actions?.[0]?.label || "Saved to Vault";
          s.status = "done";
          break;
        }
        case "tasks": {
          const topic = String(s.payload.topic || "your task").replace(/^(set up|make|create)\s+/i, "");
          const badge = addTodosToVault([
            `Break down: ${topic.slice(0, 60)}`,
            "Run one 25-minute focus block (Toolbox → Focus timer)",
            "Self-test with the KALMIA flashcards in your Vault",
          ]);
          s.result = badge.label;
          s.status = "done";
          break;
        }
        case "build": {
          const r = novaRespond(String(s.payload.prompt || "build a game"));
          if (r.codePreview) {
            code = r.codePreview;
            notes.push(r.text);
            s.result = r.actions?.[0]?.label || "Build installed";
          } else s.result = "Build generated";
          s.status = "done";
          break;
        }
        case "reactor": {
          const os = useOS.getState();
          const c = os.session ? os.db.profiles[os.session]?.clicker : null;
          if (c) {
            const n = s.payload.n as number;
            const gain = c.power * clickerMult(c) * n;
            setClicker({ count: c.count + gain, total: c.total + gain, clicks: c.clicks + n });
            useUI.getState().firePulse();
            s.result = `+${short(gain)} mass`;
          }
          s.status = "done";
          break;
        }
        case "upgrade": {
          const os = useOS.getState();
          const c = os.session ? os.db.profiles[os.session]?.clicker : null;
          if (c) {
            const options: { k: "power" | "drones" | "reactors" | "folds"; base: number; name: string }[] = [
              { k: "folds", base: 12000, name: "Space Fold" },
              { k: "reactors", base: 900, name: "Micro Reactor" },
              { k: "drones", base: 60, name: "Harvester Drone" },
              { k: "power", base: 25, name: "Compression" },
            ];
            let bought = "";
            let budget = c.count;
            const patch: any = {};
            for (const o of options) {
              const lvl = (c as any)[o.k] as number;
              const cost = upgradeCost(o.base, lvl);
              if (budget >= cost) {
                budget -= cost;
                patch[o.k] = lvl + 1;
                bought = o.name;
                break;
              }
            }
            if (bought) {
              setClicker({ ...patch, count: budget });
              s.result = `Purchased ${bought}`;
            } else s.result = "Not enough mass yet";
          }
          s.status = "done";
          break;
        }
        case "audio": {
          const ok = await clickTarget('[data-agent="dock-music"]', "Audio");
          if (!ok) useUI.getState().open("music");
          await wait(260);
          useUI.getState().requestAudio(s.payload.preset);
          s.result = `${s.payload.preset} playing`;
          s.status = "done";
          break;
        }
        case "cloak": {
          setS({ cloak: s.payload.id });
          s.result = "Tab disguised";
          s.status = "done";
          break;
        }
        case "stealth": {
          s.result = "Stealth engaged";
          s.status = "done";
          emit();
          await wait(300);
          useUI.getState().setStealth(true);
          break;
        }
        case "math": {
          const expr = String(s.payload.expr).replace(/^(solve|calculate|compute)\s*/i, "");
          const direct = evalMath(expr.replace(/=.*$/, ""));
          const r = novaRespond(expr);
          notes.push(r.text);
          s.result = direct !== null ? `= ${direct}` : "Solved step by step";
          s.status = "done";
          break;
        }
        case "answer":
        default: {
          const r = novaRespond(String(s.payload?.prompt || plan.goal));
          notes.push(r.text);
          s.result = "Answered";
          s.status = "done";
          break;
        }
      }
    } catch (err) {
      s.status = "failed";
      s.result = err instanceof Error ? err.message : "step failed";
    }
    emit();
    await wait(200);
  }

  useUI.getState().setAgentNarration("");
  useUI.getState().setAgentCursor({ visible: false });
  useUI.getState().setAgentRunning(false);
  audio.blip(1320, 0.1, 0.04);
  toast("Agent run complete", `${steps.filter((s) => s.status === "done").length}/${steps.length} steps executed`, "ok");
  return { steps, notes, code };
}

export { saveNoteToVault, saveCustomGame, appByName };

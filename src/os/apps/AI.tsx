import { useEffect, useRef, useState } from "react";
import {
  Send, Sparkles, Trash2, Settings2, Cloud, Cpu, Download, Square, Eye, MonitorUp,
  Camera, CheckCircle2, Code2, StickyNote, ExternalLink, BrainCircuit, Wand2,
  Bot, Play, ListChecks, MousePointer2, BookOpen, X, Loader2, AlertTriangle, CircleDot,
  Swords, Scale,
} from "lucide-react";
import { useOS, useProfile, setS, type AIPersona } from "@/state/store";
import { useUI, toast, openApp, startVisionCapture, stopVisionCapture, grabVisionFrame } from "@/state/ui";
import { kalmiaCompletion, newMsg, novaRespond, saveNoteToVault } from "@/lib/nova";
import { planTask, runPlan, CAPABILITIES, type AgentStep, type AgentPlan } from "@/lib/agent";
import { Btn, IconBtn, TextInput, Toggle, Chips } from "@/ui/kit";
import { cn, download } from "@/lib/utils";
import type { ChatMsg } from "@/state/store";

const PERSONAS: { id: AIPersona; name: string; badge: string; desc: string }[] = [
  { id: "kalmia", name: "KALMIA-4", badge: "Vision + Work", desc: "Sees your screen, writes to your Vault, solves homework, drives the OS" },
  { id: "kalmia-code", name: "KALMIA-Code", badge: "Builder", desc: "Writes playable games & widgets with a live sandbox" },
  { id: "nova", name: "NOVA-Kernel", badge: "OS Shell", desc: "Fast direct control of themes, shaders, reactor and audio" },
];

const STARTERS = [
  { icon: MousePointer2, label: "Set up my study workspace", prompt: "set up study mode for my biology homework" },
  { icon: BookOpen, label: "Write an essay to my Vault", prompt: "write an essay about black holes" },
  { icon: Eye, label: "Look at my screen", prompt: "look at my screen and tell me what to do next" },
  { icon: Code2, label: "Build a playable game", prompt: "build me a pong game" },
];

type BattleModel = "kalmia" | "nova" | "kalmia-cloud" | "kalmia-code";
interface BattleResult { model: BattleModel; name: string; text: string; elapsed: number; source: string }
const BATTLE_MODELS: { id: BattleModel; name: string; note: string }[] = [
  { id: "nova", name: "NOVA-Kernel", note: "Concise OS-native solver" },
  { id: "kalmia-cloud", name: "KALMIA Cloud", note: "Configured cloud endpoint" },
  { id: "kalmia-code", name: "KALMIA-Code", note: "Build-first engineering answer" },
];

function Rich({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g).filter(Boolean);
  const inline = (s: string, key: number) => (
    <span key={key}>
      {s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((p, i) =>
        p.startsWith("**") ? <b key={i} className="font-semibold text-txt">{p.slice(2, -2)}</b>
          : p.startsWith("`") ? <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px] text-accent">{p.slice(1, -1)}</code>
            : <span key={i}>{p}</span>)}
    </span>
  );
  return (
    <div className="flex flex-col gap-1.5">
      {parts.map((block, bi) => {
        if (block.startsWith("```")) {
          return (
            <pre key={bi} className="scroll-thin my-1 overflow-x-auto rounded-xl border border-line bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-accent2">
              {block.replace(/^```\w*\n?/, "").replace(/```$/, "")}
            </pre>
          );
        }
        return block.split("\n").map((line, li) => {
          const key = bi * 1000 + li;
          if (!line.trim()) return <span key={key} className="block h-1" />;
          if (line.startsWith("### ")) return <h4 key={key} className="mt-1 font-display text-[14px] font-bold text-txt">{line.slice(4)}</h4>;
          if (line.startsWith("## ")) return <h3 key={key} className="mt-1.5 font-display text-[15px] font-bold text-accent">{line.slice(3)}</h3>;
          if (line.startsWith("# ")) return <h2 key={key} className="mt-1.5 font-display text-[16px] font-bold text-txt">{line.slice(2)}</h2>;
          if (line.startsWith("> ")) return <div key={key} className="border-l-2 border-accent pl-2.5 text-[12px] text-accent">{inline(line.slice(2), key)}</div>;
          return <div key={key} className={cn((line.startsWith("•") || line.startsWith("- ")) && "pl-2")}>{inline(line, key)}</div>;
        });
      })}
    </div>
  );
}

function StepRow({ s, i }: { s: AgentStep; i: number }) {
  const tone =
    s.status === "done" ? "var(--ok)" : s.status === "active" ? "var(--accent-2)" : s.status === "failed" ? "var(--bad)" : "var(--faint)";
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-line bg-white/[0.02] px-2.5 py-2">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[9px]" style={{ borderColor: tone, color: tone }}>
        {s.status === "done" ? <CheckCircle2 size={11} /> : s.status === "active" ? <Loader2 size={11} className="animate-spin" /> : s.status === "failed" ? <AlertTriangle size={10} /> : i + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-txt">{s.label}</div>
        <div className="text-[10px] leading-snug text-faint">{s.result || s.detail}</div>
      </div>
      {s.app && s.status === "done" && (
        <button onClick={() => openApp(s.app!)} className="shrink-0 font-mono text-[9px] uppercase text-accent hover:underline">open</button>
      )}
    </div>
  );
}

export default function AIApp() {
  const prof = useProfile();
  const s = prof.settings;
  const updateProfile = useOS((o) => o.updateProfile);
  const visionActive = useUI((u) => u.visionActive);
  const visionFrame = useUI((u) => u.visionFrame);
  const visionRes = useUI((u) => u.visionRes);
  const browserPage = useUI((u) => u.browserPage);
  const agentRunning = useUI((u) => u.agentRunning);

  const [mode, setMode] = useState<"chat" | "agent" | "battle">("agent");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [battleOpponent, setBattleOpponent] = useState<BattleModel>("kalmia-cloud");
  const [battleResults, setBattleResults] = useState<BattleResult[]>([]);
  const [battleVision, setBattleVision] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [autoVision, setAutoVision] = useState(false);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const msgs = prof.chat;
  const persona = PERSONAS.find((p) => p.id === (s.aiPersona || "kalmia")) || PERSONAS[0];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, busy, steps.length]);

  const push = (m: ChatMsg) => updateProfile((p) => ({ ...p, chat: [...p.chat, m].slice(-120) }));

  /* ---------------- chat mode ---------------- */
  const sendChat = async (raw?: string, forceVision = false) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    const useVis = forceVision || autoVision || visionActive;
    const snap = useVis ? grabVisionFrame() : undefined;
    const userMsg = newMsg("user", text, { screenshot: snap });
    push(userMsg);
    setBusy(true);
    try {
      const ctl = new AbortController();
      abortRef.current = ctl;
      const reply = await kalmiaCompletion([...msgs, userMsg], s, { attachVision: useVis, signal: ctl.signal });
      push(newMsg("ai", reply.text, {
        model: persona.name, thought: reply.thought, screenshot: reply.screenshot,
        actions: reply.actions, codePreview: reply.codePreview,
      }));
    } catch (e: any) {
      push(newMsg("system", "Error: " + String(e?.message || e)));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const answerAs = async (model: BattleModel, prompt: string, signal: AbortSignal, vision: boolean) => {
    const started = performance.now();
    const localSettings = { ...s, aiCloud: false };
    if (model === "kalmia-cloud") {
      const result = await kalmiaCompletion([...msgs, newMsg("user", prompt)], { ...s, aiCloud: true, aiPersona: "kalmia" }, {
        attachVision: vision,
        signal,
      });
      return { model, name: "KALMIA Cloud", text: result.text, elapsed: performance.now() - started,
        source: s.aiBase.includes("pollinations") ? "Pollinations endpoint (may fall back locally)" : s.aiModel };
    }
    if (model === "nova") {
      const local = novaRespond(prompt);
      return { model, name: "NOVA-Kernel", text: local.text, elapsed: performance.now() - started, source: "Local OS reasoning" };
    }
    if (model === "kalmia-code") {
      const local = novaRespond(/build|game|code|app/i.test(prompt) ? prompt : `build a tool for this request: ${prompt}`);
      return { model, name: "KALMIA-Code", text: local.text, elapsed: performance.now() - started, source: local.codePreview ? "Local code generator" : "Local reasoning" };
    }
    const result = await kalmiaCompletion([...msgs, newMsg("user", prompt)], { ...localSettings, aiPersona: "kalmia" }, {
      attachVision: vision,
      signal,
    });
    return { model, name: "KALMIA-4", text: result.text, elapsed: performance.now() - started, source: "KALMIA work engine" };
  };

  const runBattle = async (raw?: string) => {
    const prompt = (raw ?? input).trim();
    if (!prompt || busy) return;
    setInput("");
    setBusy(true);
    setBattleResults([]);
    push(newMsg("user", prompt));
    const controller = new AbortController();
    abortRef.current = controller;
    const models: BattleModel[] = ["kalmia", battleOpponent];
    const vision = battleVision || autoVision || visionActive;
    if (vision) grabVisionFrame();
    try {
      const result = await Promise.all(models.map((m) => answerAs(m, prompt, controller.signal, vision)));
      setBattleResults(result);
      const summary = `**KALMIA AI Battle complete.** Compare both answers below. These are different prompting strategies/endpoints; the winner is yours to judge.`;
      push(newMsg("ai", summary, {
        model: "AI Arena",
        thought: `Parallel comparison: KALMIA-4 against ${result[1].name}. Input: ${prompt.slice(0, 100)}.`,
        screenshot: vision ? useUI.getState().visionFrame || undefined : undefined,
      }));
    } catch (e: any) {
      push(newMsg("system", `Battle stopped or failed: ${String(e?.message || e)}`));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  /* ---------------- agent mode ---------------- */
  const buildPlan = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text) return;
    const p = planTask(text);
    setPlan(p);
    setSteps(p.steps);
    setShowGuide(false);
  };

  const execute = async () => {
    if (!plan || agentRunning) return;
    push(newMsg("user", plan.goal));
    const res = await runPlan(plan, setSteps);
    const vision = res.notes.find((n) => n.startsWith("__VISION__"));
    const body = res.notes.filter((n) => !n.startsWith("__VISION__")).join("\n\n");
    push(newMsg("ai",
      body || `**Done.** ${res.steps.filter((x) => x.status === "done").length} actions executed on your desktop.\n\n` +
        res.steps.map((x) => `• ${x.label} — *${x.result || "ok"}*`).join("\n"),
      {
        model: "KALMIA Agent",
        thought: `Plan: ${plan.summary} Executed ${res.steps.length} steps with live cursor control.`,
        screenshot: vision ? vision.replace("__VISION__", "") : undefined,
        codePreview: res.code,
        actions: res.steps.filter((x) => x.app && x.status === "done").map((x) => ({ label: x.label, app: x.app })),
      }
    ));
    setPlan(null);
  };

  const submit = () => {
    if (mode === "agent") buildPlan();
    else if (mode === "battle") void runBattle();
    else void sendChat();
  };

  const toggleScreenLink = async () => {
    if (visionActive) { stopVisionCapture(); toast("Screen vision stopped"); return; }
    const ok = await startVisionCapture();
    if (ok) { setAutoVision(true); toast("Screen linked", "KALMIA can see your live display", "ok"); }
    else { grabVisionFrame(); setAutoVision(true); toast("Workspace vision on", "Reading your windows and Portal page", "ok"); }
  };

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-black/25 px-3 py-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl border border-accent2/40 bg-accent2/15 text-accent2">
          <BrainCircuit size={16} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-[13px] font-bold tracking-wide text-txt">{persona.name}</span>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">{persona.badge}</span>
          </div>
          <div className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
            {s.aiCloud ? "cloud + local engine" : "offline engine"} · {visionActive ? `display ${visionRes}` : "workspace vision"}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-xl border border-line bg-white/[0.03] p-0.5">
            {PERSONAS.map((p) => (
              <button key={p.id} onClick={() => setS({ aiPersona: p.id })} title={p.desc}
                className={cn("rounded-lg px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition-all",
                  (s.aiPersona || "kalmia") === p.id ? "bg-accent font-bold text-[#0a0a0c]" : "text-dim hover:text-txt")}>
                {p.name}
              </button>
            ))}
          </div>
          <Btn size="xs" variant={visionActive || autoVision ? "primary" : "soft"} icon={<MonitorUp size={12} />} onClick={toggleScreenLink}>
            {visionActive ? "Vision live" : autoVision ? "Workspace vision" : "Link screen"}
          </Btn>
          <IconBtn label="Analyse screen now" onClick={() => { setMode("chat"); void sendChat("Look at my screen and tell me exactly what to do next.", true); }}><Camera size={15} /></IconBtn>
          <IconBtn label="How to use KALMIA" active={showGuide} onClick={() => setShowGuide((v) => !v)}><BookOpen size={15} /></IconBtn>
          <IconBtn label="Model settings" active={showCfg} onClick={() => setShowCfg((v) => !v)}><Settings2 size={15} /></IconBtn>
          <IconBtn label="Export chat" onClick={() => download("kalmia-chat.md", msgs.map((m) => `### ${m.model || m.role}\n${m.text}`).join("\n\n"))}><Download size={15} /></IconBtn>
          <IconBtn label="Clear chat" onClick={() => { updateProfile((p) => ({ ...p, chat: [] })); setSteps([]); setPlan(null); toast("Conversation cleared"); }}><Trash2 size={15} /></IconBtn>
        </div>
      </header>

      {/* mode switch */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-black/15 px-3 py-1.5">
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-white/[0.03] p-0.5">
          <button onClick={() => setMode("agent")}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition",
              mode === "agent" ? "bg-accent2 font-bold text-[#0a0a0c]" : "text-dim hover:text-txt")}>
            <Bot size={11} /> Agent · does it for you
          </button>
          <button onClick={() => setMode("chat")}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition",
              mode === "chat" ? "bg-accent2 font-bold text-[#0a0a0c]" : "text-dim hover:text-txt")}>
            <Sparkles size={11} /> Chat · asks & answers
          </button>
          <button onClick={() => setMode("battle")}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition",
              mode === "battle" ? "bg-accent2 font-bold text-[#0a0a0c]" : "text-dim hover:text-txt")}>
            <Swords size={11} /> Battle · compare AIs
          </button>
        </div>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-faint sm:block">
          {mode === "agent" ? "builds a plan → you approve → cursor executes it live" : mode === "battle" ? "KALMIA vs an opponent · compare responses" : "answers questions, writes work, reads your screen"}
        </span>
        {browserPage.url && (
          <span className="ml-auto hidden max-w-[240px] items-center gap-1.5 truncate font-mono text-[9px] text-accent2 md:flex">
            <Eye size={10} /> reading: {browserPage.title}
          </span>
        )}
      </div>

      {/* vision strip */}
      {(visionActive || autoVision) && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-accent2/[0.06] px-3 py-1.5">
          <span className="flex min-w-0 items-center gap-2 font-mono text-[10px] text-dim">
            <CircleDot size={12} className="shrink-0 text-accent2 anim-blink" />
            <span className="truncate">{visionActive ? `Live display linked (${visionRes})` : "Workspace vision active"}</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {visionFrame && <img src={visionFrame} alt="vision preview" className="h-6 w-11 rounded border border-line object-cover" />}
            <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-dim">
              attach every message <Toggle on={autoVision} onChange={setAutoVision} />
            </label>
          </div>
        </div>
      )}

      {showCfg && (
        <div className="anim-rise shrink-0 border-b border-line bg-black/35 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-medium text-txt">
              {s.aiCloud ? <Cloud size={14} className="text-accent2" /> : <Cpu size={14} className="text-ok" />}
              Cloud model (optional — the built-in engine works with no key)
            </span>
            <Toggle on={s.aiCloud} onChange={(v) => setS({ aiCloud: v })} />
          </div>
          <Chips options={[
            { v: "https://text.pollinations.ai/openai", label: "Free cloud" },
            { v: "https://api.openai.com/v1", label: "OpenAI" },
            { v: "https://api.groq.com/openai/v1", label: "Groq" },
            { v: "https://openrouter.ai/api/v1", label: "OpenRouter" },
          ]} value={s.aiBase} onChange={(v) => setS({ aiBase: v, aiModel: v.includes("pollinations") ? "openai" : v.includes("groq") ? "llama-3.3-70b-versatile" : "gpt-4o-mini" })} cols={4} />
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <TextInput value={s.aiBase} onChange={(e) => setS({ aiBase: e.target.value })} placeholder="Base URL" />
            <TextInput value={s.aiModel} onChange={(e) => setS({ aiModel: e.target.value })} placeholder="Model id" />
            <TextInput type="password" value={s.aiKey} onChange={(e) => setS({ aiKey: e.target.value })} placeholder="API key (optional)" />
          </div>
        </div>
      )}

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        {mode === "battle" && (
          <div className="anim-rise mb-4 overflow-hidden rounded-2xl border border-accent2/35 bg-gradient-to-br from-accent2/[0.06] to-transparent">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <div className="flex items-center gap-2 font-display text-[14px] font-bold uppercase tracking-[0.14em] text-txt">
                  <Swords size={16} className="text-accent2" /> KALMIA AI Battle Arena
                </div>
                <div className="mt-0.5 text-[11px] text-dim">KALMIA is always one contestant. Ask one prompt, compare both answers.</div>
              </div>
              <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-dim">
                include screen context <Toggle on={battleVision} onChange={setBattleVision} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex min-w-[170px] flex-1 items-center gap-2 rounded-xl border border-accent/35 bg-accent/[0.07] p-3">
                <BrainCircuit size={17} className="text-accent" />
                <div><div className="font-display text-[13px] font-bold text-accent">KALMIA-4</div><div className="font-mono text-[9px] text-faint">{s.aiCloud ? "cloud + local fallback" : "local work engine"}</div></div>
              </div>
              <span className="font-display text-sm font-bold text-faint">VS</span>
              <div className="min-w-[190px] flex-1">
                <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-faint">Opponent</label>
                <select className="field py-2 text-[12px]" value={battleOpponent} onChange={(e) => setBattleOpponent(e.target.value as BattleModel)}>
                  {BATTLE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.note}</option>)}
                </select>
              </div>
              <div className="w-full text-[11px] leading-relaxed text-faint">
                Type a prompt below and press <b className="text-txt">Battle</b>. Results run in parallel. When cloud mode is off or blocked, KALMIA Cloud transparently uses the local engine.
              </div>
            </div>
            {busy && mode === "battle" && battleResults.length === 0 && (
              <div className="flex items-center gap-2 border-t border-line px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-accent2">
                <Loader2 size={12} className="animate-spin" /> KALMIA and opponent are thinking in parallel…
              </div>
            )}
            {battleResults.length > 0 && (
              <div className="grid gap-2 border-t border-line p-3 md:grid-cols-2">
                {battleResults.map((r, i) => (
                  <div key={`${r.model}-${i}`} className={cn("min-w-0 overflow-hidden rounded-xl border p-3", i === 0 ? "border-accent/40 bg-accent/[0.045]" : "border-accent2/35 bg-accent2/[0.035]")}>
                    <div className="mb-2 flex items-center justify-between gap-2 border-b border-line pb-2">
                      <div className="flex items-center gap-2">
                        {i === 0 ? <BrainCircuit size={14} className="text-accent" /> : <Cpu size={14} className="text-accent2" />}
                        <span className={cn("font-display text-[13px] font-bold", i === 0 ? "text-accent" : "text-accent2")}>{r.name}</span>
                      </div>
                      <span className="font-mono text-[9px] text-faint">{(r.elapsed / 1000).toFixed(1)}s · {r.source}</span>
                    </div>
                    <div className="scroll-thin max-h-80 overflow-y-auto text-[12px] leading-relaxed text-dim"><Rich text={r.text} /></div>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-1 font-mono text-[9px] uppercase tracking-wider text-faint md:col-span-2">
                  <Scale size={12} className="text-warn" /> Compare accuracy, clarity and usefulness — there is no automatic winner.
                </div>
              </div>
            )}
          </div>
        )}

        {/* INSTRUCTIONS */}
        {showGuide && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-accent2/30 bg-gradient-to-b from-accent2/[0.07] to-transparent">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-accent2">
                <BookOpen size={14} /> How to use KALMIA
              </span>
              <IconBtn label="Hide guide" onClick={() => setShowGuide(false)}><X size={14} /></IconBtn>
            </div>
            <div className="p-4">
              <ol className="mb-4 grid gap-2 sm:grid-cols-3">
                {[
                  { n: 1, t: "Pick a mode", d: "Agent = it performs the task on your desktop. Chat = it answers and writes." },
                  { n: 2, t: "Say it plainly", d: "“write an essay on volcanoes”, “open youtube lofi”, “set up study mode”." },
                  { n: 3, t: "Approve & watch", d: "Agent shows its plan first. Press Run and the cursor does the clicking." },
                ].map((x) => (
                  <li key={x.n} className="rounded-xl border border-line bg-black/25 p-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent2/20 font-mono text-[11px] font-bold text-accent2">{x.n}</span>
                    <div className="mt-1.5 text-[12px] font-semibold text-txt">{x.t}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-dim">{x.d}</div>
                  </li>
                ))}
              </ol>

              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-black/25 px-3 py-2">
                <MousePointer2 size={13} className="text-accent2" />
                <span className="text-[11px] text-dim">
                  <b className="text-txt">Screen control:</b> KALMIA drives this desktop — it moves a visible cursor and clicks real buttons.
                  Use <b className="text-txt">Link screen</b> to also let it <i>see</i> any tab or window you choose.
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {CAPABILITIES.map((g) => (
                  <div key={g.group} className="rounded-xl border border-line bg-black/20 p-3">
                    <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-accent">{g.group}</div>
                    <div className="flex flex-col gap-1">
                      {g.items.map((it) => (
                        <button key={it.say} onClick={() => { setInput(it.say); if (mode === "agent") buildPlan(it.say); }}
                          className="group rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]">
                          <div className="text-[11.5px] font-medium text-txt group-hover:text-accent">“{it.say}”</div>
                          <div className="text-[10px] leading-snug text-faint">{it.does}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* empty state */}
        {!msgs.length && !showGuide && !plan && (
          <div className="mx-auto max-w-xl py-6 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-accent2/40 bg-accent2/15 text-accent2"><Sparkles size={24} /></div>
            <h3 className="font-display text-2xl font-bold text-txt">Tell me what to do.</h3>
            <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-dim">
              I can operate this desktop, read your screen, write your work into the Vault and build playable games.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {STARTERS.map((x) => (
                <button key={x.label} onClick={() => { setInput(x.prompt); mode === "agent" ? buildPlan(x.prompt) : void sendChat(x.prompt); }}
                  className="flex items-center gap-1.5 rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-[11px] text-dim transition hover:border-accent hover:text-accent">
                  <x.icon size={12} /> {x.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowGuide(true)} className="mt-3 font-mono text-[10px] uppercase tracking-wider text-accent2 hover:underline">
              show full instructions
            </button>
          </div>
        )}

        {/* PLAN PREVIEW */}
        {plan && (
          <div className="anim-rise mb-4 overflow-hidden rounded-2xl border border-accent2/40 bg-black/30">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-accent2">
                <ListChecks size={14} /> Execution plan
              </span>
              <span className="font-mono text-[9px] uppercase text-faint">{steps.length} steps</span>
            </div>
            <div className="p-3">
              <p className="mb-2.5 px-1 text-[12px] text-dim">{plan.summary}</p>
              <div className="flex flex-col gap-1.5">{steps.map((x, i) => <StepRow key={x.id} s={x} i={i} />)}</div>
              {!agentRunning && steps.every((x) => x.status === "pending") && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn variant="primary" icon={<Play size={13} />} onClick={() => void execute()}>Run on my screen</Btn>
                  <Btn variant="ghost" onClick={() => { setPlan(null); setSteps([]); }}>Cancel</Btn>
                  <Btn variant="outline" onClick={() => { setMode("chat"); void sendChat(plan.goal); setPlan(null); }}>Just answer instead</Btn>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MESSAGES */}
        <div className="flex flex-col gap-3.5">
          {msgs.map((m) => (
            <div key={m.id} className={cn("anim-rise flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
              <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border font-mono text-[9px] font-bold",
                m.role === "user" ? "border-accent/40 bg-accent/12 text-accent" : m.role === "ai" ? "border-accent2/40 bg-accent2/12 text-accent2" : "border-bad/40 bg-bad/10 text-bad")}>
                {m.role === "user" ? "YOU" : (m.model || "KAL").slice(0, 3)}
              </span>
              <div className={cn("max-w-[86%] rounded-2xl border px-3.5 py-2.5 text-[13px] leading-relaxed",
                m.role === "user" ? "border-accent/25 bg-accent/[0.08] text-txt" : m.role === "system" ? "border-bad/30 bg-bad/[0.07] text-dim" : "border-line bg-white/[0.035] text-dim")}>
                {m.thought && (
                  <details className="mb-2 rounded-lg border border-line/70 bg-black/25 px-2.5 py-1.5">
                    <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-[0.14em] text-accent2">⚡ {m.model || "KALMIA"} reasoning</summary>
                    <div className="mt-1 font-mono text-[10px] leading-relaxed text-faint">{m.thought}</div>
                  </details>
                )}
                {m.screenshot && (
                  <div className="mb-2 overflow-hidden rounded-xl border border-line bg-black/40">
                    <img src={m.screenshot} alt="Captured screen" className="max-h-48 w-full object-contain" />
                    <div className="border-t border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-faint">screen frame analysed</div>
                  </div>
                )}
                <Rich text={m.text} />
                {m.codePreview && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-accent/40 bg-black/60">
                    <div className="flex items-center justify-between border-b border-line bg-white/[0.04] px-3 py-1.5">
                      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent"><Code2 size={12} /> Live sandbox</span>
                      <Btn size="xs" variant="soft" icon={<ExternalLink size={11} />} onClick={() => openApp("games")}>Open in Arcade</Btn>
                    </div>
                    <iframe srcDoc={m.codePreview} title="KALMIA sandbox" className="h-72 w-full border-0" sandbox="allow-scripts allow-pointer-lock" />
                  </div>
                )}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line/60 pt-2">
                    {m.actions.map((act, i) => (
                      <button key={i} onClick={() => act.app && openApp(act.app)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-ok/40 bg-ok/10 px-2.5 py-1 font-mono text-[10px] text-ok transition hover:bg-ok/20">
                        <CheckCircle2 size={11} />{act.label}{act.app && <ExternalLink size={10} />}
                      </button>
                    ))}
                  </div>
                )}
                {m.role === "ai" && (
                  <div className="mt-2 flex justify-end">
                    <button onClick={() => { saveNoteToVault(`KALMIA · ${new Date().toLocaleTimeString()}`, m.text, "kalmia"); toast("Saved to Vault", undefined, "ok"); }}
                      className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-faint transition hover:text-accent">
                      <StickyNote size={10} /> Save to Vault
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 pl-10 text-[12px] text-faint">
              <Loader2 size={12} className="animate-spin text-accent2" /> {persona.name} is thinking…
            </div>
          )}
        </div>
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-line bg-black/20 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={1}
            placeholder={mode === "agent" ? "Describe the task — e.g. “research volcanoes and write me a study guide”" : mode === "battle" ? "Give both models the same prompt…" : "Ask anything, or tell me what to write…"}
            className="field scroll-thin max-h-28 min-h-[42px] flex-1 resize-none py-2.5 text-[13px]"
          />
          {mode === "chat" && (
            <Btn variant="soft" size="md" icon={<Wand2 size={14} />} title="Send with a screen snapshot"
              onClick={() => void sendChat(input.trim() || "Look at my screen and help me.", true)}>+Vision</Btn>
          )}
          {busy ? (
            <Btn variant="danger" size="md" icon={<Square size={13} />} onClick={() => abortRef.current?.abort()}>Stop</Btn>
          ) : (
            <Btn variant="primary" size="md" disabled={!input.trim() || agentRunning}
              icon={mode === "agent" ? <ListChecks size={14} /> : mode === "battle" ? <Swords size={14} /> : <Send size={14} />} onClick={submit}>
              {mode === "agent" ? "Plan it" : mode === "battle" ? "Battle" : "Send"}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

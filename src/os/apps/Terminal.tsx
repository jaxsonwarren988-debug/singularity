import { useEffect, useRef, useState } from "react";
import { runCommand, COMMAND_HELP } from "@/lib/commands";
import { useOS, useProfile } from "@/state/store";
import { APPS } from "@/os/apps/meta";
import { THEMES, SHADERS } from "@/lib/themes";
import { uid, cn } from "@/lib/utils";
import { audio } from "@/lib/audio";

interface Line { id: string; kind: "in" | "out" | "sys"; text: string }

const BANNER = [
  "  ███████╗██╗███╗   ██╗ ██████╗ ██╗   ██╗██╗      █████╗ ██████╗ ",
  "  ██╔════╝██║████╗  ██║██╔════╝ ██║   ██║██║     ██╔══██╗██╔══██╗",
  "  ███████╗██║██╔██╗ ██║██║  ███╗██║   ██║██║     ███████║██████╔╝",
  "  ╚════██║██║██║╚██╗██║██║   ██║██║   ██║██║     ██╔══██║██╔══██╗",
  "  ███████║██║██║ ╚████║╚██████╝╚██████╔╝███████╗██║  ██║██║  ██║",
  "  ╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝═╝  ╚═╝",
];

export default function TerminalApp() {
  const os = useOS();
  const prof = useProfile();
  const [lines, setLines] = useState<Line[]>(() => [
    ...BANNER.map((t) => ({ id: uid(), kind: "sys" as const, text: t })),
    { id: uid(), kind: "sys", text: "" },
    { id: uid(), kind: "sys", text: `  SINGULARITY OS 6.0 · shell ready · signed in as ${os.session}` },
    { id: uid(), kind: "sys", text: '  type "help" for the command list, Tab to autocomplete' },
    { id: uid(), kind: "sys", text: "" },
  ]);
  const [input, setInput] = useState("");
  const [hIdx, setHIdx] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = prof.history;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const complete = (partial: string) => {
    const words = partial.split(/\s+/);
    const pool =
      words.length <= 1 ? COMMAND_HELP.map((c) => c.cmd)
        : words[0] === "open" || words[0] === "close" ? APPS.map((a) => a.id)
          : words[0] === "theme" ? THEMES.map((t) => t.id)
            : words[0] === "shader" ? SHADERS.map((s) => s.id)
              : [];
    const last = words[words.length - 1];
    const hits = pool.filter((p) => p.startsWith(last));
    return { hits, words };
  };

  const submit = () => {
    const cmd = input.trim();
    if (!cmd) return;
    setInput(""); setHIdx(-1);
    audio.blip(880, 0.02, 0.02);
    os.updateProfile((p) => ({ ...p, history: [cmd, ...p.history.filter((h) => h !== cmd)].slice(0, 60) }));
    if (cmd === "clear" || cmd === "cls") { setLines([]); return; }
    if (cmd === "history") {
      setLines((l) => [...l, { id: uid(), kind: "in", text: cmd }, ...history.map((h, i) => ({ id: uid(), kind: "out" as const, text: `  ${i + 1}  ${h}` }))]);
      return;
    }
    const out = runCommand(cmd);
    setLines((l) => [...l, { id: uid(), kind: "in", text: cmd }, ...out.map((t) => ({ id: uid(), kind: "out" as const, text: t }))]);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { submit(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); const n = Math.min(history.length - 1, hIdx + 1); if (n >= 0) { setHIdx(n); setInput(history[n]); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); const n = hIdx - 1; setHIdx(n); setInput(n >= 0 ? history[n] : ""); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      const { hits, words } = complete(input);
      if (hits.length === 1) { words[words.length - 1] = hits[0]; setInput(words.join(" ") + " "); }
      else if (hits.length > 1) setLines((l) => [...l, { id: uid(), kind: "out", text: "  " + hits.join("   ") }]);
      return;
    }
    if (e.key === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  const suggestions = ["help", "ls", "sysinfo", "theme sakura", "shader storm", "click 100", "peers", "fortune"];

  return (
    <div className="flex h-full flex-col bg-[#04060a]" onClick={() => inputRef.current?.focus()}>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-[1.45]">
        {lines.map((l) => (
          <div key={l.id} className={cn("whitespace-pre-wrap break-words",
            l.kind === "in" ? "text-txt" : l.kind === "sys" ? "text-accent" : "text-dim")}>
            {l.kind === "in" ? <><span className="text-ok">{os.session}@singularity</span><span className="text-faint">:~$ </span>{l.text}</> : l.text}
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="shrink-0 text-ok">{os.session}@singularity</span>
          <span className="shrink-0 text-faint">:~$</span>
          <input
            ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
            spellCheck={false} autoComplete="off" autoCapitalize="off"
            className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[12px] text-txt outline-none"
          />
        </div>
        <div ref={endRef} />
      </div>
      <div className="scroll-thin flex shrink-0 gap-1.5 overflow-x-auto border-t border-line bg-black/40 px-3 py-2">
        {suggestions.map((s) => (
          <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
            className="shrink-0 rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-dim transition hover:border-accent hover:text-accent">{s}</button>
        ))}
      </div>
    </div>
  );
}

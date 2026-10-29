import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Calculator, ArrowLeftRight, KeyRound, QrCode, Palette, FileCode2, Type, Timer,
  Dices, AlignLeft, Clock3, Image as ImageIcon, Regex, Fingerprint, Sigma, Radio, Search,
} from "lucide-react";
import { Btn, Card, Chips, CopyBtn, Meter, Slider, TextInput, Toggle } from "@/ui/kit";
import { cn, evalMath, download, copyText } from "@/lib/utils";
import { useSettings } from "@/state/store";
import { toast } from "@/state/ui";
import { audio } from "@/lib/audio";
import { RandomTool, LoremTool, EpochTool, ImageTool, RegexTool, UuidTool, StatsTool, MorseTool } from "@/os/apps/tools-extra";

const TOOLS = [
  { id: "calc", name: "Calculator", icon: Calculator, el: <CalcTool /> },
  { id: "convert", name: "Unit converter", icon: ArrowLeftRight, el: <ConvertTool /> },
  { id: "pass", name: "Password forge", icon: KeyRound, el: <PasswordTool /> },
  { id: "qr", name: "QR studio", icon: QrCode, el: <QrTool /> },
  { id: "color", name: "Colour lab", icon: Palette, el: <ColorTool /> },
  { id: "encode", name: "Encoder / hash", icon: FileCode2, el: <EncodeTool /> },
  { id: "text", name: "Text lab", icon: Type, el: <TextTool /> },
  { id: "timer", name: "Focus timer", icon: Timer, el: <TimerTool /> },
  { id: "random", name: "Randomiser", icon: Dices, el: <RandomTool /> },
  { id: "lorem", name: "Lorem ipsum", icon: AlignLeft, el: <LoremTool /> },
  { id: "epoch", name: "Epoch time", icon: Clock3, el: <EpochTool /> },
  { id: "image", name: "Image compressor", icon: ImageIcon, el: <ImageTool /> },
  { id: "regex", name: "Regex tester", icon: Regex, el: <RegexTool /> },
  { id: "uuid", name: "UUID forge", icon: Fingerprint, el: <UuidTool /> },
  { id: "stats", name: "Stats engine", icon: Sigma, el: <StatsTool /> },
  { id: "morse", name: "Morse code", icon: Radio, el: <MorseTool /> },
];

export default function ToolsApp() {
  const [active, setActive] = useState("calc");
  const [q, setQ] = useState("");
  const list = TOOLS.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  const tool = TOOLS.find((t) => t.id === active)!;
  return (
    <div className="flex h-full">
      <nav className="flex w-[178px] shrink-0 flex-col border-r border-line bg-black/20">
        <div className="relative border-b border-line p-2">
          <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tool" className="field py-1.5 pl-7 text-[12px]" />
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-1.5">
          {list.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={cn("mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition-all",
                  active === t.id ? "bg-accent/14 text-accent" : "text-dim hover:bg-white/[0.05] hover:text-txt")}>
                <Icon size={13} className="shrink-0" /> <span className="truncate">{t.name}</span>
              </button>
            );
          })}
          {!list.length && <div className="p-3 text-[11px] text-faint">Nothing matches “{q}”.</div>}
        </div>
      </nav>
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto p-4">
        <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-txt">{tool.name}</h2>
        {tool.el}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- calculator */
function CalcTool() {
  const [expr, setExpr] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const live = evalMath(expr);
  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "(", ")", "+", "^", "sqrt(", "sin(", "cos(", "PI", "C", "="];
  const press = (k: string) => {
    audio.blip(660, 0.03, 0.03, "square");
    if (k === "C") { setExpr(""); return; }
    if (k === "=") {
      const v = evalMath(expr);
      if (v !== null) { setHist((h) => [`${expr} = ${v}`, ...h].slice(0, 8)); setExpr(String(v)); }
      else toast("Cannot evaluate that expression", undefined, "warn");
      return;
    }
    setExpr((e) => e + k);
  };
  return (
    <div className="flex flex-wrap gap-4">
      <div className="min-w-[260px] flex-1">
        <input value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && press("=")}
          placeholder="type or tap — supports sqrt, sin, cos, PI, ^"
          className="field mb-2 h-14 text-right font-mono text-xl" />
        <div className="mb-3 text-right font-display text-2xl font-bold text-accent tabular">{live !== null ? live : "—"}</div>
        <div className="grid grid-cols-4 gap-1.5">
          {keys.map((k) => (
            <button key={k} onClick={() => press(k)}
              className={cn("rounded-lg border py-3 font-mono text-[13px] transition-all active:scale-95",
                k === "=" ? "border-accent bg-accent text-[#0a0a0c] font-bold" : k === "C" ? "border-bad/50 bg-bad/10 text-bad" : "border-line bg-white/[0.03] text-txt hover:border-accent hover:text-accent")}>
              {k}
            </button>
          ))}
        </div>
      </div>
      <Card className="w-full sm:w-56">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">history</div>
        {hist.length ? hist.map((h, i) => (
          <button key={i} onClick={() => setExpr(h.split(" = ")[0])} className="mb-1 block w-full truncate rounded px-1 py-1 text-left font-mono text-[11px] text-dim hover:bg-white/5 hover:text-accent">{h}</button>
        )) : <div className="text-[11px] text-faint">No calculations yet.</div>}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- converter */
const UNITS: Record<string, Record<string, number>> = {
  Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nmi: 1852 },
  Mass: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523, st: 6.35029318 },
  Data: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, bit: 0.125 },
  Speed: { "m/s": 1, "km/h": 0.277778, mph: 0.44704, knot: 0.514444, "ft/s": 0.3048 },
  Time: { s: 1, ms: 0.001, min: 60, h: 3600, day: 86400, week: 604800, year: 31557600 },
  Area: { "m²": 1, "km²": 1e6, "cm²": 1e-4, ha: 10000, acre: 4046.8564, "ft²": 0.092903 },
};
function ConvertTool() {
  const [cat, setCat] = useState("Length");
  const [temp, setTemp] = useState(false);
  const [from, setFrom] = useState("m"); const [to, setTo] = useState("ft");
  const [val, setVal] = useState("1");
  const cats = [...Object.keys(UNITS), "Temperature"];
  const units = temp ? ["C", "F", "K"] : Object.keys(UNITS[cat] || {});
  const result = useMemo(() => {
    const n = parseFloat(val); if (isNaN(n)) return "";
    if (temp) {
      const c = from === "C" ? n : from === "F" ? ((n - 32) * 5) / 9 : n - 273.15;
      const out = to === "C" ? c : to === "F" ? (c * 9) / 5 + 32 : c + 273.15;
      return out.toFixed(4).replace(/\.?0+$/, "");
    }
    const table = UNITS[cat]; if (!table?.[from] || !table?.[to]) return "";
    return ((n * table[from]) / table[to]).toPrecision(8).replace(/\.?0+$/, "");
  }, [val, from, to, cat, temp]);
  const setCategory = (c: string) => {
    setTemp(c === "Temperature"); setCat(c);
    const u = c === "Temperature" ? ["C", "F"] : Object.keys(UNITS[c]);
    setFrom(u[0]); setTo(u[1] ?? u[0]);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={cn("rounded-full border px-3 py-1.5 text-[11px] transition-all",
              (temp ? "Temperature" : cat) === c ? "border-accent bg-accent/12 text-accent" : "border-line text-dim hover:text-txt")}>{c}</button>
        ))}
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Card>
          <TextInput type="number" value={val} onChange={(e) => setVal(e.target.value)} className="mb-2 font-mono text-lg" />
          <select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</select>
        </Card>
        <Btn className="mb-4" onClick={() => { setFrom(to); setTo(from); }} icon={<ArrowLeftRight size={14} />}>Swap</Btn>
        <Card>
          <div className="mb-2 h-[42px] overflow-hidden text-ellipsis font-mono text-lg text-accent">{result || "—"}</div>
          <select className="field" value={to} onChange={(e) => setTo(e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</select>
        </Card>
      </div>
      <div className="flex gap-2"><CopyBtn text={result} label="Copy result" /></div>
    </div>
  );
}

/* ---------------------------------------------------------------- password */
function PasswordTool() {
  const [len, setLen] = useState(20);
  const [opts, setOpts] = useState({ upper: true, lower: true, num: true, sym: true, avoid: true });
  const [pw, setPw] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const gen = () => {
    let set = "";
    if (opts.lower) set += "abcdefghijklmnopqrstuvwxyz";
    if (opts.upper) set += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (opts.num) set += "0123456789";
    if (opts.sym) set += "!@#$%^&*()-_=+[]{}<>?";
    if (opts.avoid) set = set.replace(/[il1Lo0O]/g, "");
    if (!set) { toast("Enable at least one character set", undefined, "warn"); return; }
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    const next = Array.from(arr, (n) => set[n % set.length]).join("");
    setPw(next); setHistory((h) => [next, ...h].slice(0, 5));
  };
  useEffect(gen, []);
  const entropy = Math.round(len * Math.log2(Math.max(2, (opts.lower ? 26 : 0) + (opts.upper ? 26 : 0) + (opts.num ? 10 : 0) + (opts.sym ? 20 : 0))));
  const strength = Math.min(100, (entropy / 128) * 100);
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="break-all font-mono text-lg text-accent">{pw || "—"}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="primary" onClick={gen}>Generate</Btn>
          <CopyBtn text={pw} />
          <Btn onClick={() => download("password.txt", pw)}>Save .txt</Btn>
        </div>
      </Card>
      <Slider label="Length" value={len} min={6} max={64} onChange={setLen} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(Object.keys(opts) as (keyof typeof opts)[]).map((k) => (
          <label key={k} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2 text-[11px] capitalize text-dim">
            {k === "avoid" ? "no look-alikes" : k}<Toggle on={opts[k]} onChange={(v) => setOpts({ ...opts, [k]: v })} />
          </label>
        ))}
      </div>
      <div>
        <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          <span>entropy ~{entropy} bits</span><span>{strength > 80 ? "excellent" : strength > 55 ? "strong" : strength > 35 ? "fair" : "weak"}</span>
        </div>
        <Meter value={strength} tone={strength > 55 ? "var(--ok)" : strength > 35 ? "var(--warn)" : "var(--bad)"} />
      </div>
      {history.length > 1 && (
        <Card>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">recent</div>
          {history.slice(1).map((h, i) => <div key={i} className="truncate font-mono text-[11px] text-dim">{h}</div>)}
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- qr */
function QrTool() {
  const s = useSettings();
  const [text, setText] = useState("https://github.com/bns34/Unblocked-Sites");
  const [size, setSize] = useState(320);
  const [url, setUrl] = useState("");
  const [dark, setDark] = useState("#0a0a0c");
  const [light, setLight] = useState("#ffffff");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text || " ", { width: size, margin: 2, errorCorrectionLevel: "M", color: { dark, light } })
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(""); });
    return () => { alive = false; };
  }, [text, size, dark, light]);
  return (
    <div className="flex flex-wrap gap-4">
      <div className="min-w-[240px] flex-1">
        <textarea className="field mb-3 h-24 resize-none font-mono text-[12px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="URL, wifi string, text…" />
        <Slider label="Resolution" value={size} min={128} max={1024} step={32} unit=" px" onChange={setSize} />
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-[11px] text-dim">Foreground<input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="h-8 w-12" /></label>
          <label className="flex items-center gap-2 text-[11px] text-dim">Background<input type="color" value={light} onChange={(e) => setLight(e.target.value)} className="h-8 w-12" /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => url && download("qr.png", dataURLBlob(url))} disabled={!url}>Download PNG</Btn>
          <Btn onClick={() => { setDark(s.accent); setLight("#0a0a0c"); }}>Use accent</Btn>
        </div>
      </div>
      <div className="grid h-[260px] w-[260px] place-items-center rounded-xl border border-line bg-white/[0.03] p-3">
        {url ? <img src={url} alt="QR code" className="max-h-full max-w-full rounded" /> : <span className="text-[11px] text-faint">encoding…</span>}
      </div>
    </div>
  );
}
function dataURLBlob(d: string) {
  const [h, b] = d.split(","); const mime = h.match(/:(.*?);/)?.[1] || "image/png";
  const bin = atob(b); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: mime });
}

/* ------------------------------------------------------------------ colour */
function ColorTool() {
  const [hex, setHex] = useState("#ff9f45");
  const rgb = useMemo(() => {
    const h = hex.replace("#", "");
    return { r: parseInt(h.slice(0, 2), 16) || 0, g: parseInt(h.slice(2, 4), 16) || 0, b: parseInt(h.slice(4, 6), 16) || 0 };
  }, [hex]);
  const hsl = useMemo(() => {
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b); const l = (max + min) / 2;
    let h = 0, sat = 0;
    if (max !== min) {
      const d = max - min;
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(sat * 100), l: Math.round(l * 100) };
  }, [rgb]);
  const shift = (deg: number) => `hsl(${(hsl.h + deg) % 360} ${hsl.s}% ${hsl.l}%)`;
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  const rows: [string, string][] = [["HEX", hex], ["RGB", `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`], ["HSL", `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`], ["CSS var", `--accent: ${hex};`]];
  return (
    <div className="flex flex-wrap gap-4">
      <div className="min-w-[220px] flex-1">
        <div className="mb-3 h-24 rounded-xl border border-line" style={{ background: hex }} />
        <div className="flex gap-2">
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-10 w-16" />
          <TextInput value={hex} onChange={(e) => setHex(e.target.value)} className="font-mono" />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{k}</span>
              <span className="truncate font-mono text-[11px] text-dim">{v}</span>
              <CopyBtn text={v} label="" />
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-[220px] flex-1">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">harmony</div>
        <div className="mb-3 grid grid-cols-5 gap-1.5">
          {[0, 30, 150, 180, 210].map((d) => (
            <div key={d} className="h-12 rounded-lg border border-line" style={{ background: shift(d) }} title={`+${d}°`} />
          ))}
        </div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">tints & shades</div>
        <div className="mb-3 grid grid-cols-9 gap-1">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="h-8 rounded" style={{ background: `hsl(${hsl.h} ${hsl.s}% ${10 + i * 10}%)` }} />
          ))}
        </div>
        <Card>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">contrast</div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg py-3 text-center text-[12px] font-semibold" style={{ background: hex, color: "#fff" }}>white text</div>
            <div className="flex-1 rounded-lg py-3 text-center text-[12px] font-semibold" style={{ background: hex, color: "#000" }}>black text</div>
          </div>
          <div className="mt-2 text-[11px] text-dim">Best foreground: <b style={{ color: "var(--accent)" }}>{lum > 0.55 ? "black" : "white"}</b> (relative luminance {lum.toFixed(2)})</div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ encode */
function EncodeTool() {
  const [mode, setMode] = useState("b64");
  const [input, setInput] = useState("Singularity OS");
  const [out, setOut] = useState("");
  const modes = [
    { v: "b64", label: "Base64" }, { v: "b64d", label: "Decode64" }, { v: "url", label: "URL" },
    { v: "urld", label: "URL dec" }, { v: "json", label: "JSON" }, { v: "min", label: "Minify" },
    { v: "sha", label: "SHA-256" }, { v: "hex", label: "Hex" },
  ];
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        let r = "";
        if (mode === "b64") r = btoa(unescape(encodeURIComponent(input)));
        else if (mode === "b64d") r = decodeURIComponent(escape(atob(input.trim())));
        else if (mode === "url") r = encodeURIComponent(input);
        else if (mode === "urld") r = decodeURIComponent(input);
        else if (mode === "json") r = JSON.stringify(JSON.parse(input), null, 2);
        else if (mode === "min") r = JSON.stringify(JSON.parse(input));
        else if (mode === "hex") r = Array.from(new TextEncoder().encode(input)).map((b) => b.toString(16).padStart(2, "0")).join("");
        else if (mode === "sha") {
          const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
          r = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
        }
        if (alive) setOut(r);
      } catch (e: any) { if (alive) setOut("⚠ " + (e.message || "invalid input")); }
    };
    void run();
    return () => { alive = false; };
  }, [input, mode]);
  return (
    <div className="flex flex-col gap-3">
      <Chips options={modes} value={mode} onChange={setMode} cols={4} />
      <textarea className="field scroll-thin h-28 resize-none font-mono text-[12px]" value={input} onChange={(e) => setInput(e.target.value)} placeholder="input" />
      <div className="flex gap-2"><CopyBtn text={out} /><Btn onClick={() => { setInput(out); }}>Use as input</Btn></div>
      <textarea readOnly className="field scroll-thin h-32 resize-none font-mono text-[12px] text-accent" value={out} />
    </div>
  );
}

/* -------------------------------------------------------------------- text */
function TextTool() {
  const [text, setText] = useState("The quick brown fox jumps over the lazy dog.\nSingularity OS never sleeps.");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const stats = [
    ["words", words], ["characters", text.length], ["no spaces", text.replace(/\s/g, "").length],
    ["lines", text.split("\n").length], ["sentences", (text.match(/[.!?]+/g) || []).length],
    ["read time", Math.max(1, Math.round(words / 220)) + "m"],
  ] as const;
  const transforms: [string, (t: string) => string][] = [
    ["UPPER", (t) => t.toUpperCase()], ["lower", (t) => t.toLowerCase()],
    ["Title", (t) => t.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())],
    ["camel", (t) => t.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())],
    ["snake", (t) => t.trim().toLowerCase().replace(/\s+/g, "_")],
    ["kebab", (t) => t.trim().toLowerCase().replace(/\s+/g, "-")],
    ["reverse", (t) => t.split("").reverse().join("")],
    ["sort lines", (t) => t.split("\n").sort().join("\n")],
    ["dedupe", (t) => [...new Set(t.split("\n"))].join("\n")],
    ["trim", (t) => t.split("\n").map((l) => l.trim()).filter(Boolean).join("\n")],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-white/[0.03] px-2 py-2 text-center">
            <div className="font-display text-base font-bold text-accent tabular">{v}</div>
            <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-faint">{k}</div>
          </div>
        ))}
      </div>
      <textarea className="field scroll-thin h-40 resize-none text-[13px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-1.5">
        {transforms.map(([label, fn]) => <Btn key={label} size="xs" onClick={() => setText(fn(text))}>{label}</Btn>)}
        <CopyBtn text={text} />
        <Btn size="xs" variant="danger" onClick={() => setText("")}>Clear</Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- timer */
function TimerTool() {
  const [mode, setMode] = useState<"focus" | "stopwatch">("focus");
  const [total, setTotal] = useState(25 * 60);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [sessions, setSessions] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => {
      if (mode === "focus") {
        setLeft((l) => {
          if (l <= 1) {
            setRunning(false); setSessions((s) => s + 1);
            audio.blip(880, 0.4, 0.08); window.setTimeout(() => audio.blip(1320, 0.5, 0.08), 260);
            toast("Focus block complete", "Take five. You earned it.", "ok");
            return 0;
          }
          return l - 1;
        });
      } else setElapsed((e) => e + 0.1);
    }, mode === "focus" ? 1000 : 100);
    return () => window.clearInterval(ref.current);
  }, [running, mode]);

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-sm"><Chips options={[{ v: "focus", label: "Focus / Pomodoro" }, { v: "stopwatch", label: "Stopwatch" }]} value={mode} onChange={(v) => { setMode(v); setRunning(false); }} cols={2} /></div>
      {mode === "focus" ? (
        <>
          <div className="relative grid h-52 w-52 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--line)" strokeWidth="4" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={283} strokeDashoffset={283 * (1 - left / Math.max(1, total))} style={{ transition: "stroke-dashoffset 1s linear", filter: "drop-shadow(0 0 6px var(--accent))" }} />
            </svg>
            <div className="text-center">
              <div className="font-display text-4xl font-bold text-txt tabular">{mmss(left)}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-faint">{sessions} blocks done</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {[15, 25, 45, 60].map((m) => <Btn key={m} size="xs" onClick={() => { setTotal(m * 60); setLeft(m * 60); setRunning(false); }}>{m} min</Btn>)}
          </div>
          <div className="flex gap-2">
            <Btn variant="primary" size="md" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start"}</Btn>
            <Btn size="md" onClick={() => { setLeft(total); setRunning(false); }}>Reset</Btn>
          </div>
        </>
      ) : (
        <>
          <div className="font-display text-6xl font-bold text-accent tabular">{mmss(elapsed)}<span className="text-2xl text-dim">.{Math.floor((elapsed % 1) * 10)}</span></div>
          <div className="flex gap-2">
            <Btn variant="primary" size="md" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start"}</Btn>
            <Btn size="md" onClick={() => setLaps((l) => [elapsed, ...l])} disabled={!running}>Lap</Btn>
            <Btn size="md" onClick={() => { setRunning(false); setElapsed(0); setLaps([]); }}>Reset</Btn>
          </div>
          <div className="scroll-thin max-h-40 w-full max-w-sm overflow-y-auto">
            {laps.map((l, i) => (
              <div key={i} className="flex justify-between border-b border-line/60 py-1.5 font-mono text-[12px]">
                <span className="text-faint">lap {laps.length - i}</span><span className="text-dim">{mmss(l)}.{Math.floor((l % 1) * 10)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export { copyText };

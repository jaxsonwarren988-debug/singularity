import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Coins, RefreshCw, Download, Image as ImageIcon, Play, Wand2 } from "lucide-react";
import { Btn, Card, Chips, CopyBtn, Meter, Slider, TextInput, Toggle } from "@/ui/kit";
import { compressImage, download, bytes, pick, clamp, cn } from "@/lib/utils";
import { setS } from "@/state/store";
import { toast } from "@/state/ui";
import { audio } from "@/lib/audio";

const TA = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cn("field scroll-thin h-28 resize-none font-mono text-[12px] leading-relaxed", className)} />
);

/* ------------------------------------------------------------------ random */
export function RandomTool() {
  const [dice, setDice] = useState("2d6");
  const [rolls, setRolls] = useState<number[]>([]);
  const [coin, setCoin] = useState<string | null>(null);
  const [lo, setLo] = useState(1); const [hi, setHi] = useState(100);
  const [num, setNum] = useState<number | null>(null);
  const [list, setList] = useState("pizza\nsushi\ntacos\nramen");
  const [winner, setWinner] = useState<string | null>(null);

  const roll = () => {
    const m = dice.match(/^(\d{1,2})d(\d{1,3})$/i);
    if (!m) { toast("Use NdM format, e.g. 3d20", undefined, "warn"); return; }
    const n = clamp(parseInt(m[1]), 1, 12), sides = clamp(parseInt(m[2]), 2, 1000);
    setRolls(Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides)));
    audio.blip(520, 0.05, 0.04, "square");
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-txt"><Dices size={14} className="text-accent" /> Dice</div>
        <div className="flex gap-2"><TextInput value={dice} onChange={(e) => setDice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && roll()} /><Btn variant="primary" onClick={roll}>Roll</Btn></div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rolls.map((r, i) => <span key={i} className="anim-pop grid h-9 w-9 place-items-center rounded-lg border border-accent/40 bg-accent/10 font-display text-sm font-bold text-accent">{r}</span>)}
        </div>
        {rolls.length > 0 && <div className="mt-2 font-mono text-[11px] text-dim">total {rolls.reduce((a, b) => a + b, 0)}</div>}
      </Card>
      <Card>
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-txt"><Coins size={14} className="text-accent" /> Coin flip</div>
        <div className="grid h-20 place-items-center">
          <span className={cn("font-display text-2xl font-bold text-accent", coin && "anim-pop")}>{coin ?? "—"}</span>
        </div>
        <Btn className="w-full" onClick={() => { setCoin(pick(["HEADS", "TAILS"])); audio.blip(880, 0.06, 0.04); }}>Flip</Btn>
      </Card>
      <Card>
        <div className="mb-2 text-[12px] font-semibold text-txt">Random number</div>
        <div className="flex items-center gap-2">
          <TextInput type="number" value={lo} onChange={(e) => setLo(+e.target.value)} />
          <span className="text-faint">→</span>
          <TextInput type="number" value={hi} onChange={(e) => setHi(+e.target.value)} />
        </div>
        <div className="my-2 text-center font-display text-2xl font-bold text-accent tabular">{num ?? "—"}</div>
        <Btn className="w-full" onClick={() => setNum(Math.floor(Math.random() * (Math.max(lo, hi) - Math.min(lo, hi) + 1)) + Math.min(lo, hi))}>Generate</Btn>
      </Card>
      <Card>
        <div className="mb-2 text-[12px] font-semibold text-txt">Pick from a list</div>
        <TA value={list} onChange={(e) => setList(e.target.value)} className="h-20" />
        <div className="my-2 truncate text-center font-display text-lg font-bold text-accent">{winner ?? "—"}</div>
        <Btn className="w-full" onClick={() => setWinner(pick(list.split("\n").map((s) => s.trim()).filter(Boolean)) || "add some options")}>Choose</Btn>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- lorem */
const WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat".split(" ");
export function LoremTool() {
  const [count, setCount] = useState(3);
  const [unit, setUnit] = useState<"paragraphs" | "sentences" | "words">("paragraphs");
  const [out, setOut] = useState("");
  const gen = () => {
    const word = () => pick(WORDS);
    const sentence = () => { const n = 8 + Math.floor(Math.random() * 10); const s = Array.from({ length: n }, word).join(" "); return s[0].toUpperCase() + s.slice(1) + "."; };
    if (unit === "words") setOut(Array.from({ length: count }, word).join(" "));
    else if (unit === "sentences") setOut(Array.from({ length: count }, sentence).join(" "));
    else setOut(Array.from({ length: count }, () => Array.from({ length: 4 + Math.floor(Math.random() * 3) }, sentence).join(" ")).join("\n\n"));
  };
  useEffect(gen, []);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28"><Slider label="Count" value={count} min={1} max={20} onChange={setCount} /></div>
        <div className="min-w-[240px] flex-1"><Chips options={[{ v: "paragraphs", label: "Paragraphs" }, { v: "sentences", label: "Sentences" }, { v: "words", label: "Words" }]} value={unit} onChange={setUnit} cols={3} /></div>
        <Btn variant="primary" icon={<RefreshCw size={13} />} onClick={gen}>Generate</Btn>
        <CopyBtn text={out} />
      </div>
      <TA value={out} onChange={(e) => setOut(e.target.value)} className="h-64" />
    </div>
  );
}

/* ------------------------------------------------------------------- epoch */
export function EpochTool() {
  const [now, setNow] = useState(Date.now());
  const [epoch, setEpoch] = useState(String(Math.floor(Date.now() / 1000)));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const parsed = (() => { const n = Number(epoch); if (isNaN(n)) return null; const d = new Date(epoch.length > 11 ? n : n * 1000); return isNaN(d.getTime()) ? null : d; })();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="sm:col-span-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">current unix time</div>
        <div className="font-display text-3xl font-bold text-accent tabular">{Math.floor(now / 1000)}</div>
        <div className="mt-1 text-[11px] text-dim">{new Date(now).toString()}</div>
        <div className="mt-2"><CopyBtn text={String(Math.floor(now / 1000))} /></div>
      </Card>
      <Card>
        <div className="mb-2 text-[12px] font-semibold text-txt">Timestamp → date</div>
        <TextInput value={epoch} onChange={(e) => setEpoch(e.target.value)} />
        <div className="mt-2 text-[12px] text-dim">{parsed ? parsed.toLocaleString() : "invalid"}<br /><span className="text-faint">{parsed ? parsed.toUTCString() : ""}</span></div>
      </Card>
      <Card>
        <div className="mb-2 text-[12px] font-semibold text-txt">Date → timestamp</div>
        <TextInput type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="mt-2 font-mono text-[13px] text-accent">{Math.floor(new Date(date).getTime() / 1000) || "invalid"}</div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- image */
export function ImageTool() {
  const [src, setSrc] = useState(""); const [out, setOut] = useState("");
  const [q, setQ] = useState(72); const [dim, setDim] = useState(1600);
  const fileRef = useRef<File | null>(null);
  const run = async (file: File, quality = q, maxDim = dim) => {
    fileRef.current = file;
    const url = await compressImage(file, maxDim, quality / 100);
    setOut(url);
  };
  return (
    <div className="flex flex-col gap-3">
      <input type="file" accept="image/*" id="tool-img" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setSrc(URL.createObjectURL(f)); await run(f); e.target.value = "";
      }} />
      <div className="flex flex-wrap gap-2">
        <Btn variant="primary" icon={<ImageIcon size={13} />} onClick={() => document.getElementById("tool-img")?.click()}>Choose image</Btn>
        {out && <Btn icon={<Download size={13} />} onClick={() => download("compressed.jpg", dataURLtoBlob(out))}>Download</Btn>}
        {out && <Btn variant="soft" icon={<Wand2 size={13} />} onClick={() => { setS({ wallpaper: out }); toast("Applied as wallpaper", undefined, "ok"); }}>Use as wallpaper</Btn>}
      </div>
      <div className="grid gap-x-5 sm:grid-cols-2">
        <Slider label="Quality" value={q} min={10} max={100} unit="%" onChange={(v) => { setQ(v); if (fileRef.current) void run(fileRef.current, v, dim); }} />
        <Slider label="Max dimension" value={dim} min={320} max={3840} step={80} unit=" px" onChange={(v) => { setDim(v); if (fileRef.current) void run(fileRef.current, q, v); }} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[["original", src], ["compressed", out]].map(([label, url]) => (
          <Card key={label}>
            <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              <span>{label}</span><span>{url ? bytes(url.startsWith("data:") ? (url.length * 3) / 4 : 0) : "—"}</span>
            </div>
            <div className="grid h-40 place-items-center overflow-hidden rounded-lg border border-line bg-black/30">
              {url ? <img src={url} alt={label} className="max-h-40 w-full object-contain" /> : <span className="text-[11px] text-faint">no image</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
function dataURLtoBlob(d: string) {
  const [head, body] = d.split(",");
  const mime = head.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bin = atob(body); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/* ------------------------------------------------------------------- regex */
export function RegexTool() {
  const [pattern, setPattern] = useState("\\b\\w+@\\w+\\.\\w{2,}\\b");
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState("Ping ada@lovelace.io or grace@navy.mil before 5pm.");
  const result = useMemo(() => {
    try {
      const re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
      const matches = [...text.matchAll(re)];
      return { ok: true, matches, error: "" };
    } catch (e: any) { return { ok: false, matches: [] as RegExpMatchArray[], error: String(e.message || e) }; }
  }, [pattern, flags, text]);
  const highlighted = useMemo(() => {
    if (!result.ok || !result.matches.length) return [{ t: text, hit: false }];
    const out: { t: string; hit: boolean }[] = []; let last = 0;
    result.matches.forEach((m) => {
      const i = m.index ?? 0;
      if (i > last) out.push({ t: text.slice(last, i), hit: false });
      out.push({ t: m[0], hit: true }); last = i + m[0].length;
    });
    if (last < text.length) out.push({ t: text.slice(last), hit: false });
    return out;
  }, [result, text]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <TextInput className="font-mono" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="pattern" />
        <TextInput className="w-20 font-mono" value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="gi" />
      </div>
      {!result.ok && <div className="rounded-lg border border-bad/50 bg-bad/10 px-3 py-2 font-mono text-[11px] text-bad">{result.error}</div>}
      <TA value={text} onChange={(e) => setText(e.target.value)} />
      <Card>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{result.matches.length} match(es)</div>
        <div className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed">
          {highlighted.map((h, i) => h.hit ? <mark key={i} className="rounded bg-accent/30 px-0.5 text-txt">{h.t}</mark> : <span key={i}>{h.t}</span>)}
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------- uuid */
export function UuidTool() {
  const [n, setN] = useState(6);
  const [upper, setUpper] = useState(false);
  const [dashes, setDashes] = useState(true);
  const [list, setList] = useState<string[]>([]);
  const gen = () => {
    const make = () => {
      let id = crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });
      if (!dashes) id = id.replace(/-/g, "");
      return upper ? id.toUpperCase() : id;
    };
    setList(Array.from({ length: n }, make));
  };
  useEffect(gen, []);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-40"><Slider label="How many" value={n} min={1} max={50} onChange={setN} /></div>
        <label className="flex items-center gap-2 text-[12px] text-dim">Uppercase <Toggle on={upper} onChange={setUpper} /></label>
        <label className="flex items-center gap-2 text-[12px] text-dim">Dashes <Toggle on={dashes} onChange={setDashes} /></label>
        <Btn variant="primary" icon={<RefreshCw size={13} />} onClick={gen}>Generate</Btn>
        <CopyBtn text={list.join("\n")} label="Copy all" />
      </div>
      <div className="scroll-thin max-h-72 overflow-y-auto rounded-xl border border-line">
        {list.map((id, i) => (
          <div key={i} className="flex items-center justify-between gap-2 border-b border-line/60 px-3 py-2 font-mono text-[12px] last:border-0">
            <span className="truncate text-dim">{id}</span><CopyBtn text={id} label="Copy" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- stats */
export function StatsTool() {
  const [raw, setRaw] = useState("12, 18, 7, 22, 19, 31, 7, 14");
  const nums = raw.split(/[\s,;]+/).map(Number).filter((n) => !isNaN(n));
  const stats = useMemo(() => {
    if (!nums.length) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / nums.length;
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
    const freq = new Map<number, number>();
    nums.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
    const maxF = Math.max(...freq.values());
    const mode = [...freq.entries()].filter(([, f]) => f === maxF).map(([v]) => v);
    return { n: nums.length, sum, mean, median, mode: mode.length === nums.length ? "none" : mode.join(", "), min: sorted[0], max: sorted[sorted.length - 1], range: sorted[sorted.length - 1] - sorted[0], variance, sd: Math.sqrt(variance) };
  }, [raw]);
  return (
    <div className="flex flex-col gap-3">
      <TA value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Paste numbers separated by commas, spaces or new lines" />
      {stats && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line bg-white/[0.03] px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">{k}</div>
              <div className="font-display text-base font-bold text-accent tabular">{typeof v === "number" ? +v.toFixed(4) : v}</div>
            </div>
          ))}
        </div>
      )}
      {stats && <Meter value={stats.mean - stats.min} max={Math.max(1, stats.range)} />}
    </div>
  );
}

/* ------------------------------------------------------------------- morse */
const MORSE: Record<string, string> = { a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.", ".": ".-.-.-", ",": "--..--", "?": "..--..", "!": "-.-.--" };
export function MorseTool() {
  const [text, setText] = useState("singularity");
  const encoded = text.toLowerCase().split("").map((c) => (c === " " ? "/" : MORSE[c] || "")).filter(Boolean).join(" ");
  const decode = (m: string) => m.split(" ").map((code) => code === "/" ? " " : Object.keys(MORSE).find((k) => MORSE[k] === code) || "").join("");
  const [morseIn, setMorseIn] = useState("... --- ...");
  const play = () => {
    let t = 0;
    encoded.split("").forEach((c) => {
      if (c === ".") { window.setTimeout(() => audio.blip(700, 0.07, 0.06), t); t += 110; }
      else if (c === "-") { window.setTimeout(() => audio.blip(700, 0.2, 0.06), t); t += 250; }
      else t += 180;
    });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <div className="mb-2 text-[12px] font-semibold text-txt">Text → Morse</div>
        <TextInput value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-2 break-words font-mono text-[13px] leading-relaxed text-accent">{encoded || "—"}</div>
        <div className="mt-2 flex gap-2"><Btn icon={<Play size={12} />} onClick={play}>Play</Btn><CopyBtn text={encoded} /></div>
      </Card>
      <Card>
        <div className="mb-2 text-[12px] font-semibold text-txt">Morse → Text</div>
        <TA value={morseIn} onChange={(e) => setMorseIn(e.target.value)} className="h-20" />
        <div className="mt-2 font-mono text-[13px] text-accent">{decode(morseIn) || "—"}</div>
      </Card>
    </div>
  );
}

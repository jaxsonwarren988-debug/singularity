import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Trophy, Flag, Layers, Grid3x3, Type, Timer } from "lucide-react";
import { Btn } from "@/ui/kit";
import { cn, pick } from "@/lib/utils";
import { audio } from "@/lib/audio";
import { getBest, setBest } from "@/os/apps/games-modern";

/* ============================================================================
 * NEON DRIFT — pseudo-3D highway racer with traffic and nitro
 * ========================================================================== */
export function GNeonDrift() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ dist: 0, speed: 0, nitro: 100 });
  const [dead, setDead] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = cv.width, H = cv.height;
    const keys: Record<string, boolean> = {};
    let px = 0, speed = 5, dist = 0, nitro = 100, curve = 0, curveTarget = 0, alive = true;
    const traffic: { z: number; lane: number; c: string }[] = [];
    const palette = ["#ff4d6d", "#ffd166", "#c4b5fd", "#39ff88", "#6ee7ff"];

    for (let i = 0; i < 14; i++) traffic.push({ z: 40 + i * 26 + Math.random() * 14, lane: Math.floor(Math.random() * 3) - 1, c: pick(palette) });

    const kd = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    const steer = (e: PointerEvent) => {
      if (!e.buttons && e.pointerType === "mouse") return;
      const r = cv.getBoundingClientRect();
      px = (((e.clientX - r.left) / r.width) * 2 - 1) * 1.35;
    };
    cv.addEventListener("pointermove", steer);
    cv.addEventListener("pointerdown", steer);

    const project = (worldX: number, z: number) => {
      const scale = 260 / Math.max(z, 1);
      return { x: W / 2 + (worldX - curve * (z * 0.02)) * scale * 1.5, y: H * 0.46 + scale * 1.35, s: scale };
    };

    let raf = 0;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);

      const boosting = (keys[" "] || keys["shift"]) && nitro > 0;
      const target = boosting ? 15 : keys["arrowdown"] || keys["s"] ? 4 : 9;
      speed += (target - speed) * 0.035;
      nitro = Math.max(0, Math.min(100, nitro + (boosting ? -0.75 : 0.22)));
      if (keys["arrowleft"] || keys["a"]) px -= 0.045 * (speed / 8);
      if (keys["arrowright"] || keys["d"]) px += 0.045 * (speed / 8);
      px = Math.max(-1.5, Math.min(1.5, px));
      dist += speed * 0.1;

      if (Math.random() < 0.008) curveTarget = (Math.random() - 0.5) * 2.4;
      curve += (curveTarget - curve) * 0.012;
      px -= curve * 0.0055 * (speed / 8);

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.46);
      sky.addColorStop(0, "#0a0620");
      sky.addColorStop(1, "#2a1040");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.46);
      // sun
      ctx.fillStyle = "#ff6b9d";
      ctx.beginPath(); ctx.arc(W / 2 - curve * 30, H * 0.4, 46, 0, Math.PI * 2); ctx.fill();
      // ground
      ctx.fillStyle = "#0a0714"; ctx.fillRect(0, H * 0.46, W, H);

      // road segments
      for (let i = 60; i > 0; i--) {
        const z1 = i * 3, z2 = (i - 1) * 3;
        const p1 = project(0, z1), p2 = project(0, z2);
        const w1 = p1.s * 2.6, w2 = p2.s * 2.6;
        const band = Math.floor((dist * 3 + i) / 2) % 2 === 0;
        ctx.fillStyle = band ? "#15121f" : "#100e18";
        ctx.beginPath();
        ctx.moveTo(p1.x - w1, p1.y); ctx.lineTo(p1.x + w1, p1.y);
        ctx.lineTo(p2.x + w2, p2.y); ctx.lineTo(p2.x - w2, p2.y);
        ctx.closePath(); ctx.fill();
        // neon edges
        ctx.strokeStyle = band ? "#ff2e88" : "#00f2ff";
        ctx.lineWidth = Math.max(1, p1.s * 0.06);
        ctx.beginPath(); ctx.moveTo(p1.x - w1, p1.y); ctx.lineTo(p2.x - w2, p2.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p1.x + w1, p1.y); ctx.lineTo(p2.x + w2, p2.y); ctx.stroke();
        // lane dashes
        if (band) {
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = Math.max(0.6, p1.s * 0.03);
          [-0.85, 0.85].forEach((l) => {
            const a = project(l, z1), b = project(l, z2);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          });
        }
      }

      // traffic
      traffic.sort((a, b) => b.z - a.z);
      for (const t of traffic) {
        t.z -= speed * 0.1;
        if (t.z < 1) { t.z = 170 + Math.random() * 60; t.lane = Math.floor(Math.random() * 3) - 1; t.c = pick(palette); }
        const p = project(t.lane * 0.85, t.z);
        const cw = p.s * 0.55, ch = p.s * 0.4;
        if (p.y < H * 0.44) continue;
        ctx.fillStyle = t.c;
        ctx.fillRect(p.x - cw / 2, p.y - ch, cw, ch);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(p.x - cw / 2 + cw * 0.15, p.y - ch * 0.8, cw * 0.7, ch * 0.28);
        if (t.z < 7 && Math.abs(t.lane * 0.85 - px) < 0.5) {
          alive = false; setDead(true);
          setBest("drift", Math.floor(dist));
          audio.blip(130, 0.35, 0.07, "sawtooth");
          return;
        }
      }

      // player car
      const carY = H - 54;
      const carX = W / 2 + px * 95;
      ctx.save();
      ctx.translate(carX, carY);
      ctx.rotate((keys["arrowleft"] || keys["a"] ? -0.06 : 0) + (keys["arrowright"] || keys["d"] ? 0.06 : 0));
      if (boosting) {
        ctx.fillStyle = "#6ee7ff";
        ctx.beginPath(); ctx.moveTo(-11, 22); ctx.lineTo(0, 40 + Math.random() * 16); ctx.lineTo(11, 22); ctx.fill();
      }
      ctx.fillStyle = "#ff9f45";
      ctx.beginPath();
      ctx.moveTo(-19, 22); ctx.lineTo(-14, -18); ctx.lineTo(14, -18); ctx.lineTo(19, 22);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#0b0d16";
      ctx.fillRect(-11, -12, 22, 13);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(-17, 16, 7, 5); ctx.fillRect(10, 16, 7, 5);
      ctx.restore();

      setHud({ dist: Math.floor(dist), speed: Math.round(speed * 22), nitro: Math.round(nitro) });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      cv.removeEventListener("pointermove", steer);
      cv.removeEventListener("pointerdown", steer);
    };
  }, [runId]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <div className="flex w-full max-w-[660px] flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1"><Flag size={11} className="mr-1 inline text-accent" />{hud.dist} m</span>
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1">{hud.speed} km/h</span>
        <span className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1">
          NITRO
          <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full rounded-full bg-accent2" style={{ width: hud.nitro + "%" }} />
          </span>
        </span>
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1"><Trophy size={11} className="mr-1 inline text-warn" />{Math.max(getBest("drift"), hud.dist)}</span>
      </div>
      <div className="relative w-full max-w-[660px] overflow-hidden rounded-2xl border border-line bg-black">
        <canvas ref={cvRef} width={660} height={380} className="block h-auto w-full touch-none" />
        {dead && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-bad">WRECKED</div>
              <div className="mt-1 font-mono text-[12px] text-dim">{hud.dist} metres travelled</div>
              <Btn className="mt-3" variant="primary" icon={<RotateCcw size={13} />}
                onClick={() => { setDead(false); setRunId((r) => r + 1); }}>Race again</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">A / D steer · S brake · Space nitro · or drag the pointer</div>
    </div>
  );
}

/* ============================================================================
 * STACK TOWER — precision timing stacker
 * ========================================================================== */
export function GStackTower() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [perfect, setPerfect] = useState(0);
  const [dead, setDead] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = cv.width, H = cv.height;
    type Blk = { x: number; w: number; hue: number };
    const stack: Blk[] = [{ x: W / 2 - 90, w: 180, hue: 24 }];
    let cur: Blk = { x: 0, w: 180, hue: 40 };
    let dir = 1, speed = 2.6, alive = true, sc = 0, streak = 0, camY = 0;
    const BH = 26;

    const drop = () => {
      if (!alive) return;
      const top = stack[stack.length - 1];
      const left = Math.max(cur.x, top.x);
      const right = Math.min(cur.x + cur.w, top.x + top.w);
      const overlap = right - left;
      if (overlap <= 2) {
        alive = false; setDead(true); setBest("stack", sc);
        audio.blip(150, 0.3, 0.06, "sawtooth");
        return;
      }
      const off = Math.abs(cur.x - top.x);
      if (off < 4) {
        streak++; setPerfect(streak);
        cur = { x: top.x, w: top.w, hue: cur.hue };
        audio.blip(1200 + streak * 60, 0.07, 0.05);
      } else {
        streak = 0; setPerfect(0);
        cur = { x: left, w: overlap, hue: cur.hue };
        audio.blip(620, 0.05, 0.04);
      }
      stack.push(cur);
      sc++; setScore(sc);
      speed = Math.min(7.5, 2.6 + sc * 0.13);
      cur = { x: dir > 0 ? -cur.w : W, w: cur.w, hue: (cur.hue + 14) % 360 };
      dir *= -1;
      if (stack.length > 11) camY += BH;
    };

    const kd = (e: KeyboardEvent) => { if (e.key === " ") { e.preventDefault(); drop(); } };
    window.addEventListener("keydown", kd);
    cv.addEventListener("pointerdown", drop);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (alive) {
        cur.x += dir * speed;
        if (cur.x + cur.w > W) { cur.x = W - cur.w; dir = -1; }
        if (cur.x < 0) { cur.x = 0; dir = 1; }
      }
      ctx.fillStyle = "#070912"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.02 + (i % 3) * 0.01})`;
        ctx.fillRect((i * 97) % W, (i * 53 + camY * 0.2) % H, 2, 2);
      }
      const visible = stack.slice(-12);
      visible.forEach((b, i) => {
        const y = H - 40 - (visible.length - i) * BH + (camY % BH);
        ctx.fillStyle = `hsl(${b.hue} 85% ${45 + i * 1.5}%)`;
        ctx.fillRect(b.x, y, b.w, BH - 2);
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fillRect(b.x, y, b.w, 4);
      });
      const cy = H - 40 - (visible.length + 1) * BH + (camY % BH);
      ctx.fillStyle = `hsl(${cur.hue} 90% 60%)`;
      ctx.shadowColor = `hsl(${cur.hue} 90% 60%)`;
      ctx.shadowBlur = 14;
      ctx.fillRect(cur.x, cy, cur.w, BH - 2);
      ctx.shadowBlur = 0;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      cv.removeEventListener("pointerdown", drop);
    };
  }, [runId]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11px]">
        <span className="rounded-lg border border-line px-3 py-1"><Layers size={11} className="mr-1 inline text-accent" />{score} floors</span>
        <span className="rounded-lg border border-line px-3 py-1">perfect streak <b className="text-ok">{perfect}</b></span>
        <span className="rounded-lg border border-line px-3 py-1"><Trophy size={11} className="mr-1 inline text-warn" />{Math.max(getBest("stack"), score)}</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
        <canvas ref={cvRef} width={360} height={400} className="block touch-none" />
        {dead && (
          <div className="absolute inset-0 grid place-items-center bg-black/85">
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-bad">TOWER COLLAPSED</div>
              <div className="mt-1 font-mono text-[12px] text-dim">{score} floors stacked</div>
              <Btn className="mt-3" variant="primary" onClick={() => { setDead(false); setScore(0); setPerfect(0); setRunId((r) => r + 1); }}>Build again</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">Space or click to drop · line it up perfectly for a streak</div>
    </div>
  );
}

/* ============================================================================
 * MINESWEEPER NEO
 * ========================================================================== */
export function GMinesweeper() {
  const SIZE = 12, MINES = 22;
  type Cell = { mine: boolean; open: boolean; flag: boolean; n: number };
  const build = (): Cell[] => {
    const cells: Cell[] = Array.from({ length: SIZE * SIZE }, () => ({ mine: false, open: false, flag: false, n: 0 }));
    let placed = 0;
    while (placed < MINES) {
      const i = Math.floor(Math.random() * cells.length);
      if (!cells[i].mine) { cells[i].mine = true; placed++; }
    }
    const nb = (i: number) => {
      const x = i % SIZE, y = Math.floor(i / SIZE);
      const out: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) out.push(ny * SIZE + nx);
      }
      return out;
    };
    cells.forEach((c, i) => { c.n = nb(i).filter((j) => cells[j].mine).length; });
    return cells;
  };
  const [grid, setGrid] = useState<Cell[]>(build);
  const [state, setState] = useState<"play" | "won" | "lost">("play");
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (state !== "play") return;
    const t = setInterval(() => setTime((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  const neighbours = (i: number) => {
    const x = i % SIZE, y = Math.floor(i / SIZE);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) out.push(ny * SIZE + nx);
    }
    return out;
  };

  const open = (i: number) => {
    if (state !== "play" || grid[i].flag || grid[i].open) return;
    const next = grid.map((c) => ({ ...c }));
    if (next[i].mine) {
      next.forEach((c) => { if (c.mine) c.open = true; });
      setGrid(next); setState("lost");
      audio.blip(140, 0.3, 0.06, "sawtooth");
      return;
    }
    const stack = [i];
    while (stack.length) {
      const j = stack.pop()!;
      if (next[j].open || next[j].flag) continue;
      next[j].open = true;
      if (next[j].n === 0) neighbours(j).forEach((k) => { if (!next[k].open) stack.push(k); });
    }
    audio.blip(720, 0.03, 0.03);
    setGrid(next);
    if (next.every((c) => c.open || c.mine)) {
      setState("won");
      setBest("mines", Math.max(1, 999 - time));
      audio.blip(1180, 0.2, 0.06);
    }
  };

  const flag = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    if (state !== "play" || grid[i].open) return;
    setGrid((g) => g.map((c, j) => (j === i ? { ...c, flag: !c.flag } : c)));
    audio.blip(500, 0.03, 0.03, "square");
  };

  const colors = ["", "#6ee7ff", "#9ef01a", "#ffd166", "#ff9f45", "#ff4d6d", "#c4b5fd", "#ff8fc4", "#ffffff"];
  const flags = grid.filter((c) => c.flag).length;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11px]">
        <span className="rounded-lg border border-line px-3 py-1"><Grid3x3 size={11} className="mr-1 inline text-accent" />{MINES - flags} mines</span>
        <span className="rounded-lg border border-line px-3 py-1"><Timer size={11} className="mr-1 inline text-accent2" />{time}s</span>
        <Btn size="xs" icon={<RotateCcw size={12} />} onClick={() => { setGrid(build()); setState("play"); setTime(0); }}>New grid</Btn>
      </div>
      <div className="relative rounded-2xl border border-line bg-black/40 p-2">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0,1fr))`, width: "min(384px, 82vw)" }}>
          {grid.map((c, i) => (
            <button key={i} onClick={() => open(i)} onContextMenu={(e) => flag(e, i)}
              className={cn("grid aspect-square place-items-center rounded-[4px] font-mono text-[11px] font-bold transition-all",
                c.open ? (c.mine ? "bg-bad/70 text-black" : "bg-white/[0.07]") : "bg-white/[0.14] hover:bg-accent/30 active:scale-90")}
              style={{ color: c.open && !c.mine ? colors[c.n] : undefined }}>
              {c.open ? (c.mine ? "✱" : c.n || "") : c.flag ? "⚑" : ""}
            </button>
          ))}
        </div>
        {state !== "play" && (
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/85">
            <div className="text-center">
              <div className={cn("font-display text-2xl font-bold", state === "won" ? "text-ok" : "text-bad")}>
                {state === "won" ? "FIELD CLEARED" : "DETONATED"}
              </div>
              <div className="mt-1 font-mono text-[12px] text-dim">{time} seconds</div>
              <Btn className="mt-3" variant="primary" onClick={() => { setGrid(build()); setState("play"); setTime(0); }}>Play again</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">Left click reveal · right click flag</div>
    </div>
  );
}

/* ============================================================================
 * WORD CIPHER — daily-style five letter deduction
 * ========================================================================== */
const WORDS = ("react orbit laser pixel cyber quantum neon vector matrix plasma prism logic kernel shader photon cosmic nebula vertex render syntax binary cursor module system vertex crypto glitch stream pulse nova flux helix delta gamma sigma omega").split(" ");
const EXTRA = "crane slate trace audio raise arise stare irate adieu roast media ocean laser noble brave crisp flint glint prism plumb vivid zesty kayak joker quirkwaltz".split(" ");
const TARGET_WORDS = Array.from(new Set(WORDS.concat(EXTRA).filter((w) => w.length === 5)));

export function GWordCipher() {
  const [answer, setAnswer] = useState(() => pick(TARGET_WORDS).toUpperCase());
  const [rows, setRows] = useState<string[]>([]);
  const [cur, setCur] = useState("");
  const [state, setState] = useState<"play" | "won" | "lost">("play");
  const [msg, setMsg] = useState("");

  const grade = useCallback((guess: string) => {
    const out: ("hit" | "near" | "miss")[] = Array(5).fill("miss");
    const pool = answer.split("");
    guess.split("").forEach((c, i) => { if (c === answer[i]) { out[i] = "hit"; pool[i] = ""; } });
    guess.split("").forEach((c, i) => {
      if (out[i] === "hit") return;
      const j = pool.indexOf(c);
      if (j >= 0) { out[i] = "near"; pool[j] = ""; }
    });
    return out;
  }, [answer]);

  const submit = useCallback(() => {
    if (state !== "play") return;
    if (cur.length !== 5) { setMsg("Five letters needed"); return; }
    const next = [...rows, cur];
    setRows(next); setCur(""); setMsg("");
    if (cur === answer) { setState("won"); setBest("cipher", 7 - next.length); audio.blip(1180, 0.2, 0.06); }
    else if (next.length >= 6) { setState("lost"); audio.blip(150, 0.3, 0.06, "sawtooth"); }
    else audio.blip(660, 0.04, 0.03);
  }, [cur, rows, answer, state]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (state !== "play") return;
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      else if (e.key === "Backspace") setCur((c) => c.slice(0, -1));
      else if (/^[a-zA-Z]$/.test(e.key)) setCur((c) => (c.length < 5 ? c + e.key.toUpperCase() : c));
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [submit, state]);

  const keyState: Record<string, string> = {};
  rows.forEach((r) => grade(r).forEach((g, i) => {
    const c = r[i];
    if (g === "hit" || (g === "near" && keyState[c] !== "hit") || !keyState[c]) keyState[c] = g;
  }));

  const reset = () => { setAnswer(pick(TARGET_WORDS).toUpperCase()); setRows([]); setCur(""); setState("play"); setMsg(""); };
  const tone = (g: string) => g === "hit" ? "var(--ok)" : g === "near" ? "var(--warn)" : "rgba(255,255,255,0.10)";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className="rounded-lg border border-line px-3 py-1"><Type size={11} className="mr-1 inline text-accent" />Word Cipher</span>
        <span className="rounded-lg border border-line px-3 py-1">try {Math.min(rows.length + 1, 6)}/6</span>
        <Btn size="xs" icon={<RotateCcw size={12} />} onClick={reset}>New word</Btn>
      </div>
      <div className="grid gap-1.5">
        {Array.from({ length: 6 }).map((_, r) => {
          const word = rows[r] ?? (r === rows.length ? cur : "");
          const marks = rows[r] ? grade(rows[r]) : null;
          return (
            <div key={r} className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, c) => (
                <div key={c}
                  className={cn("grid h-11 w-11 place-items-center rounded-lg border font-display text-lg font-bold transition-all",
                    marks ? "border-transparent text-[#0a0a0c] anim-pop" : word[c] ? "border-accent/60 text-txt" : "border-line text-faint")}
                  style={{ background: marks ? tone(marks[c]) : undefined, color: marks && marks[c] === "miss" ? "var(--dim)" : undefined }}>
                  {word[c] || ""}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {msg && <div className="font-mono text-[10px] text-warn">{msg}</div>}
      {state !== "play" && (
        <div className="text-center">
          <div className={cn("font-display text-lg font-bold", state === "won" ? "text-ok" : "text-bad")}>
            {state === "won" ? `Cracked in ${rows.length}!` : `The word was ${answer}`}
          </div>
          <Btn className="mt-2" size="xs" variant="primary" onClick={reset}>Play again</Btn>
        </div>
      )}
      <div className="flex flex-col items-center gap-1">
        {["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map((row, i) => (
          <div key={i} className="flex gap-1">
            {i === 2 && (
              <button onClick={submit} className="rounded-md border border-accent/50 bg-accent/15 px-2 py-2 font-mono text-[9px] text-accent">ENTER</button>
            )}
            {row.split("").map((k) => (
              <button key={k} onClick={() => setCur((c) => (c.length < 5 ? c + k : c))}
                className="h-8 w-7 rounded-md border border-line font-mono text-[11px] text-txt transition active:scale-90"
                style={{ background: keyState[k] ? tone(keyState[k]) : "rgba(255,255,255,0.05)", color: keyState[k] && keyState[k] !== "miss" ? "#0a0a0c" : undefined }}>
                {k}
              </button>
            ))}
            {i === 2 && (
              <button onClick={() => setCur((c) => c.slice(0, -1))} className="rounded-md border border-line px-2 py-2 font-mono text-[9px] text-dim">DEL</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


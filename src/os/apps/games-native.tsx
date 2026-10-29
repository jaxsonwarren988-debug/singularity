import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trophy, Undo2 } from "lucide-react";
import { Btn } from "@/ui/kit";
import { cn, pick } from "@/lib/utils";
import { audio } from "@/lib/audio";
import { getBest, setBest } from "@/os/apps/games-modern";

function Bar({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-[12px] text-dim">{children}</div>;
}

/* ============================================================================
 * 5. TETRIS EFFECT: OVERDRIVE — Guideline Tetris with Ghost, Hold & Particles
 * ========================================================================== */
const SHAPES: { m: number[][]; c: string }[] = [
  { m: [[1, 1, 1, 1]], c: "#00f2ff" }, // I
  { m: [[1, 1], [1, 1]], c: "#ffd166" }, // O
  { m: [[0, 1, 0], [1, 1, 1]], c: "#c4b5fd" }, // T
  { m: [[0, 1, 1], [1, 1, 0]], c: "#39ff88" }, // S
  { m: [[1, 1, 0], [0, 1, 1]], c: "#ff4d6d" }, // Z
  { m: [[1, 0, 0], [1, 1, 1]], c: "#4d9fff" }, // J
  { m: [[0, 0, 1], [1, 1, 1]], c: "#ff9f45" }, // L
];

export function GTetrisEffect() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [over, setOver] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    const COLS = 10, ROWS = 20, SZ = 18;
    const grid: (string | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let bag: number[] = [];
    const nextIdx = () => {
      if (!bag.length) bag = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
      return bag.pop()!;
    };

    let curType = nextIdx();
    let nextType = nextIdx();
    let holdType: number | null = null;
    let canHold = true;
    let mat = SHAPES[curType].m.map((r) => [...r]);
    let col = SHAPES[curType].c;
    let px = 3, py = 0;
    let sc = 0, ln = 0;
    let alive = true;

    const collides = (m: number[][], tx: number, ty: number) => {
      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
          if (!m[y][x]) continue;
          const nx = tx + x, ny = ty + y;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && grid[ny][nx]) return true;
        }
      }
      return false;
    };

    const spawn = (typeIdx = nextIdx()) => {
      curType = typeIdx;
      mat = SHAPES[curType].m.map((r) => [...r]);
      col = SHAPES[curType].c;
      px = Math.floor((COLS - mat[0].length) / 2);
      py = 0;
      canHold = true;
      if (collides(mat, px, py)) {
        alive = false;
        setOver(true);
        setBest("tetris", sc);
      }
    };

    const lock = () => {
      for (let y = 0; y < mat.length; y++) {
        for (let x = 0; x < mat[y].length; x++) {
          if (mat[y][x] && py + y >= 0) grid[py + y][px + x] = col;
        }
      }
      let cleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (grid[y].every(Boolean)) {
          grid.splice(y, 1);
          grid.unshift(Array(COLS).fill(null));
          cleared++;
          y++;
        }
      }
      if (cleared > 0) {
        const pts = [0, 100, 300, 500, 800][cleared] || 1000;
        sc += pts;
        ln += cleared;
        setScore(sc);
        setLines(ln);
        audio.blip(880, 0.12, 0.06);
      } else {
        audio.blip(320, 0.03, 0.03);
      }
      const nxt = nextType;
      nextType = nextIdx();
      spawn(nxt);
    };

    const rotate = () => {
      const rot = mat[0].map((_, i) => mat.map((row) => row[i]).reverse());
      if (!collides(rot, px, py)) { mat = rot; audio.blip(560, 0.03, 0.03); }
      else if (!collides(rot, px - 1, py)) { px -= 1; mat = rot; }
      else if (!collides(rot, px + 1, py)) { px += 1; mat = rot; }
    };

    const kd = (e: KeyboardEvent) => {
      if (!alive) return;
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowdown", "arrowup", " ", "c"].includes(k)) e.preventDefault();
      if (k === "arrowleft" || k === "a") { if (!collides(mat, px - 1, py)) px--; }
      else if (k === "arrowright" || k === "d") { if (!collides(mat, px + 1, py)) px++; }
      else if (k === "arrowdown" || k === "s") { if (!collides(mat, px, py + 1)) { py++; sc += 1; setScore(sc); } else lock(); }
      else if (k === "arrowup" || k === "w") rotate();
      else if (k === " ") {
        while (!collides(mat, px, py + 1)) { py++; sc += 2; }
        setScore(sc);
        lock();
      } else if (k === "c" && canHold) {
        const prevHold = holdType;
        holdType = curType;
        if (prevHold === null) { const nxt = nextType; nextType = nextIdx(); spawn(nxt); }
        else spawn(prevHold);
        canHold = false;
      }
    };
    window.addEventListener("keydown", kd);

    const dropTimer = window.setInterval(() => {
      if (!alive) return;
      if (!collides(mat, px, py + 1)) py++;
      else lock();
    }, Math.max(140, 520 - Math.floor(ln / 5) * 35));

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.fillStyle = "#05070e";
      ctx.fillRect(0, 0, cv.width, cv.height);

      const ox = 20, oy = 12;
      // Playfield frame
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.strokeRect(ox - 1, oy - 1, COLS * SZ + 2, ROWS * SZ + 2);

      // Grid lines + locked blocks
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const c = grid[y][x];
          if (c) {
            ctx.fillStyle = c;
            ctx.fillRect(ox + x * SZ + 1, oy + y * SZ + 1, SZ - 2, SZ - 2);
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.02)";
            ctx.fillRect(ox + x * SZ + 1, oy + y * SZ + 1, SZ - 2, SZ - 2);
          }
        }
      }

      // Ghost piece
      let gy = py;
      while (!collides(mat, px, gy + 1)) gy++;
      ctx.strokeStyle = col + "66";
      for (let y = 0; y < mat.length; y++) {
        for (let x = 0; x < mat[y].length; x++) {
          if (mat[y][x]) ctx.strokeRect(ox + (px + x) * SZ + 2, oy + (gy + y) * SZ + 2, SZ - 4, SZ - 4);
        }
      }

      // Active piece
      ctx.fillStyle = col;
      for (let y = 0; y < mat.length; y++) {
        for (let x = 0; x < mat[y].length; x++) {
          if (mat[y][x]) ctx.fillRect(ox + (px + x) * SZ + 1, oy + (py + y) * SZ + 1, SZ - 2, SZ - 2);
        }
      }

      // Sidebar: Next & Hold
      const sx = ox + COLS * SZ + 20;
      ctx.fillStyle = "#eef0f6";
      ctx.font = "bold 10px monospace";
      ctx.fillText("NEXT", sx, oy + 14);
      const nm = SHAPES[nextType].m;
      ctx.fillStyle = SHAPES[nextType].c;
      for (let y = 0; y < nm.length; y++) {
        for (let x = 0; x < nm[y].length; x++) {
          if (nm[y][x]) ctx.fillRect(sx + x * 14, oy + 24 + y * 14, 12, 12);
        }
      }

      ctx.fillStyle = "#eef0f6";
      ctx.fillText("HOLD (C)", sx, oy + 96);
      if (holdType !== null) {
        const hm = SHAPES[holdType].m;
        ctx.fillStyle = SHAPES[holdType].c;
        for (let y = 0; y < hm.length; y++) {
          for (let x = 0; x < hm[y].length; x++) {
            if (hm[y][x]) ctx.fillRect(sx + x * 14, oy + 106 + y * 14, 12, 12);
          }
        }
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(dropTimer);
      window.removeEventListener("keydown", kd);
    };
  }, [runId]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <Bar>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">SCORE <b className="text-accent">{score}</b></span>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">LINES <b className="text-accent2">{lines}</b></span>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">BEST <b className="text-warn">{Math.max(getBest("tetris"), score)}</b></span>
      </Bar>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
        <canvas ref={cvRef} width={310} height={384} className="block" />
        {over && (
          <div className="absolute inset-0 grid place-items-center bg-black/85">
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-bad">MATRIX OVERFLOW</div>
              <div className="mt-1 font-mono text-[11px] text-dim">{score} pts · {lines} lines</div>
              <Btn className="mt-3" variant="primary" onClick={() => { setOver(false); setScore(0); setLines(0); setRunId((r) => r + 1); }}>Play Again</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
        Arrows / WASD to Move & Rotate · Space Hard Drop · C to Hold Piece
      </div>
    </div>
  );
}

/* ============================================================================
 * 6. JETPACK OVERDRIVE — High-Speed Endless Jetpack Action
 * ========================================================================== */
export function GJetpack() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [dist, setDist] = useState(0);
  const [coins, setCoins] = useState(0);
  const [dead, setDead] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    let py = 260, vy = 0, thrust = false;
    let ticks = 0, cCount = 0;
    let alive = true;
    const zappers: { x: number; y: number; h: number }[] = [];
    const missiles: { x: number; y: number; warn: number }[] = [];
    const tokens: { x: number; y: number }[] = [];

    const down = (e?: KeyboardEvent | PointerEvent) => {
      if (e && "key" in e && ![" ", "arrowup", "w"].includes(e.key.toLowerCase())) return;
      thrust = true;
    };
    const up = () => { thrust = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    cv.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);

    let raf = 0;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      ticks++;
      const spd = 4.6 + Math.min(3.8, ticks / 900);

      vy += thrust ? -0.58 : 0.42;
      vy = Math.max(-6.8, Math.min(6.8, vy));
      py = Math.max(24, Math.min(316, py + vy));

      if (ticks % 65 === 0) {
        zappers.push({ x: cv.width + 20, y: 30 + Math.random() * 210, h: 65 + Math.random() * 55 });
      }
      if (ticks % 160 === 0) {
        missiles.push({ x: cv.width + 180, y: py, warn: 45 });
      }
      if (ticks % 45 === 0) {
        const baseY = 50 + Math.random() * 230;
        for (let i = 0; i < 5; i++) tokens.push({ x: cv.width + i * 24, y: baseY });
      }

      ctx.fillStyle = "#060812";
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Floor & Ceiling rails
      ctx.fillStyle = "#141a29";
      ctx.fillRect(0, 0, cv.width, 18);
      ctx.fillRect(0, 336, cv.width, 24);

      // Coins
      ctx.fillStyle = "#ffd166";
      for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i];
        t.x -= spd;
        ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, Math.PI * 2); ctx.fill();
        if (Math.hypot(t.x - 100, t.y - py) < 20) {
          cCount++; setCoins(cCount); tokens.splice(i, 1); audio.blip(980, 0.04, 0.04); continue;
        }
        if (t.x < -20) tokens.splice(i, 1);
      }

      // Zappers
      for (let i = zappers.length - 1; i >= 0; i--) {
        const z = zappers[i];
        z.x -= spd;
        ctx.strokeStyle = "#ff9f45";
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x, z.y + z.h); ctx.stroke();
        if (Math.abs(100 - z.x) < 16 && py + 12 > z.y && py - 12 < z.y + z.h) {
          alive = false; setDead(true); setBest("jetpack", Math.floor(ticks / 3) + cCount * 10); return;
        }
        if (z.x < -30) zappers.splice(i, 1);
      }

      // Missiles
      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        if (m.warn > 0) {
          m.warn--;
          m.y += (py - m.y) * 0.08;
          ctx.fillStyle = "#ff4d6d";
          ctx.font = "bold 14px monospace";
          ctx.fillText("⚠!", cv.width - 28, m.y + 4);
        } else {
          m.x -= spd * 2.1;
          ctx.fillStyle = "#ff4d6d";
          ctx.fillRect(m.x - 14, m.y - 5, 28, 10);
          if (Math.hypot(m.x - 100, m.y - py) < 18) {
            alive = false; setDead(true); setBest("jetpack", Math.floor(ticks / 3) + cCount * 10); return;
          }
          if (m.x < -40) missiles.splice(i, 1);
        }
      }

      // Player + Jetpack Exhaust
      if (thrust) {
        ctx.fillStyle = "#ff9f45";
        ctx.beginPath();
        ctx.moveTo(92, py + 10);
        ctx.lineTo(84, py + 28 + Math.random() * 10);
        ctx.lineTo(100, py + 28);
        ctx.fill();
      }
      ctx.fillStyle = "#6ee7ff";
      ctx.fillRect(88, py - 14, 24, 28);

      if (ticks % 6 === 0) setDist(Math.floor(ticks / 3));
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      cv.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, [runId]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <Bar>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">DISTANCE <b className="text-accent">{dist}m</b></span>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">COINS <b className="text-warn">{coins}</b></span>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">BEST <b className="text-ok">{getBest("jetpack")}</b></span>
      </Bar>
      <div className="relative w-full max-w-[660px] overflow-hidden rounded-2xl border border-line bg-black">
        <canvas ref={cvRef} width={660} height={360} className="block h-auto w-full touch-none" />
        {dead && (
          <div className="absolute inset-0 grid place-items-center bg-black/80">
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-bad">JETPACK CRITICAL FAILURE</div>
              <div className="mt-1 font-mono text-[12px] text-dim">{dist}m flown · {coins} coins collected</div>
              <Btn className="mt-3" variant="primary" onClick={() => { setDead(false); setDist(0); setCoins(0); setRunId((r) => r + 1); }}>Fly Again</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">Hold Space / Up / Click to fire jetpack thrusters</div>
    </div>
  );
}

/* ============================================================================
 * 7. CYBER SLASH — Neon Blade Slicing Arcade (Fruit Ninja Style)
 * ========================================================================== */
export function GCyberSlash() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [dead, setDead] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    type Orb = { x: number; y: number; vx: number; vy: number; r: number; c: string; bomb?: boolean; sliced?: boolean };
    const orbs: Orb[] = [];
    const blade: { x: number; y: number; t: number }[] = [];
    const parts: { x: number; y: number; vx: number; vy: number; c: string; life: number }[] = [];
    let sc = 0, lv = 3, ticks = 0, alive = true;

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * cv.width;
      const y = ((e.clientY - r.top) / r.height) * cv.height;
      blade.push({ x, y, t: performance.now() });
      if (blade.length > 18) blade.shift();

      for (const o of orbs) {
        if (o.sliced) continue;
        if (Math.hypot(o.x - x, o.y - y) < o.r + 10) {
          o.sliced = true;
          if (o.bomb) {
            lv = 0; setLives(0); alive = false; setDead(true); setBest("slash", sc);
            audio.blip(120, 0.35, 0.08, "sawtooth");
            return;
          }
          sc += 15; setScore(sc);
          audio.blip(780 + Math.random() * 300, 0.05, 0.04);
          for (let i = 0; i < 14; i++) {
            parts.push({ x: o.x, y: o.y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, c: o.c, life: 1 });
          }
        }
      }
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerdown", onMove);

    let raf = 0;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      ticks++;

      if (ticks % 42 === 0) {
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const bomb = Math.random() < 0.16;
          orbs.push({
            x: 80 + Math.random() * (cv.width - 160),
            y: cv.height + 20,
            vx: (Math.random() - 0.5) * 4,
            vy: -(9.5 + Math.random() * 3.2),
            r: bomb ? 18 : 22,
            c: bomb ? "#ff3b5c" : pick(["#39ff88", "#00f2ff", "#ff9f45", "#ff8fc4", "#ffd166"]),
            bomb,
          });
        }
      }

      ctx.fillStyle = "#05070e";
      ctx.fillRect(0, 0, cv.width, cv.height);

      for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        o.x += o.vx; o.y += o.vy; o.vy += 0.22;
        if (!o.sliced) {
          ctx.fillStyle = o.c;
          ctx.shadowColor = o.c;
          ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          if (o.bomb) {
            ctx.fillStyle = "#000";
            ctx.font = "bold 12px monospace";
            ctx.fillText("✕", o.x - 5, o.y + 4);
          }
        }
        if (o.y > cv.height + 35) {
          if (!o.sliced && !o.bomb) {
            lv--; setLives(lv);
            if (lv <= 0) { alive = false; setDead(true); setBest("slash", sc); return; }
          }
          orbs.splice(i, 1);
        }
      }

      // Particles
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.04;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.fillStyle = p.c;
        ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Blade ribbon
      const now = performance.now();
      while (blade.length && now - blade[0].t > 180) blade.shift();
      if (blade.length > 1) {
        ctx.strokeStyle = "#6ee7ff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        blade.forEach((pt, idx) => { if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerdown", onMove);
    };
  }, [runId]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <Bar>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">SCORE <b className="text-accent">{score}</b></span>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">LIVES <b className="text-bad">{"♥".repeat(Math.max(0, lives))}</b></span>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">BEST <b className="text-warn">{Math.max(getBest("slash"), score)}</b></span>
      </Bar>
      <div className="relative w-full max-w-[660px] overflow-hidden rounded-2xl border border-line bg-black">
        <canvas ref={cvRef} width={660} height={360} className="block h-auto w-full touch-none cursor-crosshair" />
        {dead && (
          <div className="absolute inset-0 grid place-items-center bg-black/80">
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-bad">BLADE SHATTERED</div>
              <div className="mt-1 font-mono text-[12px] text-dim">Final score: {score}</div>
              <Btn className="mt-3" variant="primary" onClick={() => { setDead(false); setScore(0); setLives(3); setRunId((r) => r + 1); }}>Slice Again</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">Swipe cursor / finger across glowing cores · Avoid red ✕ mines</div>
    </div>
  );
}

/* ============================================================================
 * 8. 2048: QUANTUM EDITION (with Undo & Powerups)
 * ========================================================================== */
export function G2048() {
  const empty = () => Array(16).fill(0);
  const spawn = (b: number[]) => {
    const free = b.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    if (!free.length) return b;
    const n = [...b]; n[pick(free)] = Math.random() < 0.9 ? 2 : 4; return n;
  };
  const [board, setBoard] = useState<number[]>(() => spawn(spawn(empty())));
  const [prevBoard, setPrevBoard] = useState<number[] | null>(null);
  const [score, setScore] = useState(0);
  const [best, setB] = useState(() => getBest("2048"));
  const [over, setOver] = useState(false);

  const move = useCallback((dir: number) => {
    setBoard((prev) => {
      if (over) return prev;
      let gained = 0;
      const rot = (b: number[], times: number) => {
        let n = [...b];
        for (let t = 0; t < times; t++) {
          const r = Array(16).fill(0);
          for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) r[x * 4 + (3 - y)] = n[y * 4 + x];
          n = r;
        }
        return n;
      };
      const b = rot(prev, dir);
      for (let y = 0; y < 4; y++) {
        const row = b.slice(y * 4, y * 4 + 4).filter((v) => v);
        for (let i = 0; i < row.length - 1; i++) {
          if (row[i] === row[i + 1]) { row[i] *= 2; gained += row[i]; row.splice(i + 1, 1); }
        }
        while (row.length < 4) row.push(0);
        for (let x = 0; x < 4; x++) b[y * 4 + x] = row[x];
      }
      const out = rot(b, (4 - dir) % 4);
      if (out.every((v, i) => v === prev[i])) return prev;
      setPrevBoard(prev);
      if (gained) {
        setScore((s) => {
          const ns = s + gained;
          setBest("2048", ns);
          setB(Math.max(getBest("2048"), ns));
          return ns;
        });
        audio.blip(440 + Math.min(800, gained), 0.05, 0.03);
      }
      const next = spawn(out);
      const stuck = next.every((v, i) => v !== 0 && (i % 4 === 3 || next[i + 1] !== v) && (i > 11 || next[i + 4] !== v));
      if (stuck) setOver(true);
      return next;
    });
  }, [over]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const map: Record<string, number> = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3 };
      if (map[e.key] !== undefined) { e.preventDefault(); move(map[e.key]); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [move]);

  const colors: Record<number, string> = { 2: "#2a2f3d", 4: "#343b4d", 8: "#c9762f", 16: "#d9752a", 32: "#e2662c", 64: "#e94f24", 128: "#e8c15a", 256: "#edc850", 512: "#f2cf3f", 1024: "#f7d62b", 2048: "#ffdf00" };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-3">
      <Bar>
        <span className="rounded-lg border border-line px-3 py-1 font-mono">score <b className="text-accent">{score}</b></span>
        <span className="rounded-lg border border-line px-3 py-1 font-mono"><Trophy size={11} className="mr-1 inline text-warn" /> best <b className="text-accent">{Math.max(best, score)}</b></span>
        <Btn size="xs" icon={<Undo2 size={12} />} disabled={!prevBoard} onClick={() => { if (prevBoard) { setBoard(prevBoard); setPrevBoard(null); setOver(false); } }}>Undo</Btn>
        <Btn size="xs" icon={<RotateCcw size={12} />} onClick={() => { setBoard(spawn(spawn(empty()))); setScore(0); setOver(false); }}>New</Btn>
      </Bar>
      <div className="relative grid grid-cols-4 gap-2 rounded-xl border border-line bg-black/40 p-2" style={{ width: "min(330px, 78vw)" }}>
        {board.map((v, i) => (
          <div key={i} className={cn("grid aspect-square place-items-center rounded-lg font-display font-bold transition-all", v && "anim-pop")}
            style={{ background: v ? colors[v] || "#ffdf00" : "rgba(255,255,255,0.04)", color: v > 4 ? "#0d0d10" : "var(--txt)", fontSize: v > 999 ? 18 : 24 }}>
            {v || ""}
          </div>
        ))}
        {over && (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/80">
            <div className="text-center">
              <div className="font-display text-xl font-bold text-bad">Grid locked</div>
              <div className="mt-1 text-[12px] text-dim">final score {score}</div>
              <Btn className="mt-3" variant="primary" onClick={() => { setBoard(spawn(spawn(empty()))); setScore(0); setOver(false); }}>Play again</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <span /><Btn size="xs" onClick={() => move(1)} icon={<ArrowUp size={13} />} /><span />
        <Btn size="xs" onClick={() => move(0)} icon={<ArrowLeft size={13} />} />
        <Btn size="xs" onClick={() => move(3)} icon={<ArrowDown size={13} />} />
        <Btn size="xs" onClick={() => move(2)} icon={<ArrowRight size={13} />} />
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Trophy, Zap, Shield, Sparkles, Crosshair } from "lucide-react";
import { Btn } from "@/ui/kit";
import { cn } from "@/lib/utils";
import { audio } from "@/lib/audio";

const bestKey = (g: string) => "sglr.best." + g;
export const getBest = (g: string) => { try { return Number(localStorage.getItem(bestKey(g)) || 0); } catch { return 0; } };
export const setBest = (g: string, v: number) => { try { if (v > getBest(g)) localStorage.setItem(bestKey(g), String(v)); } catch { /* ignore */ } };

/* ============================================================================
 * 1. SLOPE 3D: HYPER RUN — 3D Perspective Endless Neon Downhill Runner
 * ========================================================================== */
const BALL_SKINS = [
  { id: "emerald", name: "Emerald", color: "#39ff88", glow: "#00f2ff" },
  { id: "ember", name: "Solar", color: "#ff9f45", glow: "#ff4d6d" },
  { id: "kalmia", name: "Kalmia", color: "#ff8fc4", glow: "#c4b5fd" },
  { id: "void", name: "Void", color: "#6ee7ff", glow: "#8b7bff" },
];

export function GSlope3D() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [skin, setSkin] = useState(BALL_SKINS[0]);
  const [score, setScore] = useState(0);
  const [best, setB] = useState(() => getBest("slope3d"));
  const [dead, setDead] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    let raf = 0;
    let alive = true;
    const keys: Record<string, boolean> = {};

    // Ball state in 3D world coordinates
    let bx = 0, by = 0, vyb = 0;
    let vx = 0;
    let zPos = 0;
    let speed = 0.42;
    let rollAngle = 0;

    type Tile = {
      z: number;
      xCenter: number;
      width: number;
      slopeY: number;
      obs?: { x: number; w: number; h: number; kind: "block" | "moving" | "boost" | "ramp"; phase: number };
    };

    const tiles: Tile[] = [];
    let curX = 0;
    let curY = 0;

    const spawnTile = (zIndex: number) => {
      if (zIndex > 12) {
        curX += (Math.random() - 0.5) * 1.1;
        curX = Math.max(-3.5, Math.min(3.5, curX));
      }
      curY -= 0.08;
      const width = zIndex < 15 ? 4.4 : Math.max(2.6, 4.3 - Math.min(1.4, zIndex * 0.004) + (Math.random() - 0.5) * 0.6);
      let obs: Tile["obs"] = undefined;
      if (zIndex > 10 && Math.random() < 0.42) {
        const r = Math.random();
        const kind = r < 0.14 ? "boost" : r < 0.25 ? "ramp" : r < 0.55 ? "moving" : "block";
        obs = {
          x: (Math.random() - 0.5) * (width - 1.0),
          w: kind === "boost" || kind === "ramp" ? 0.9 : 0.72 + Math.random() * 0.45,
          h: kind === "boost" || kind === "ramp" ? 0.18 : 0.85 + Math.random() * 0.45,
          kind,
          phase: Math.random() * Math.PI * 2,
        };
      }
      tiles.push({ z: zIndex * 2.0, xCenter: curX, width, slopeY: curY, obs });
    };

    for (let i = 0; i < 45; i++) spawnTile(i);
    let nextTileIndex = 45;

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (["arrowleft", "arrowright", "arrowup", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onPointer = (e: PointerEvent) => {
      if (!e.buttons && e.pointerType === "mouse") return;
      const r = cv.getBoundingClientRect();
      const norm = ((e.clientX - r.left) / r.width) * 2 - 1;
      vx = norm * 0.16;
    };
    cv.addEventListener("pointermove", onPointer);
    cv.addEventListener("pointerdown", onPointer);

    const trail: { x: number; y: number; z: number }[] = [];

    const project = (wx: number, wy: number, wz: number, camX: number, camY: number, camZ: number) => {
      const dz = wz - camZ;
      if (dz <= 0.2) return null;
      const fov = 310;
      const sx = cv.width / 2 + ((wx - camX) / dz) * fov;
      const sy = cv.height * 0.42 - ((wy - camY) / dz) * fov;
      const scale = fov / dz;
      return { sx, sy, scale, dz };
    };

    const die = (finalScore: number) => {
      alive = false;
      setDead(true);
      setBest("slope3d", finalScore);
      setB(Math.max(getBest("slope3d"), finalScore));
      audio.blip(140, 0.35, 0.07, "sawtooth");
    };

    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);

      const left = keys["arrowleft"] || keys["a"];
      const right = keys["arrowright"] || keys["d"];
      if (left) vx -= 0.014;
      if (right) vx += 0.014;
      vx *= 0.90;
      bx += vx;

      speed = Math.min(0.95, 0.42 + zPos * 0.00028);
      zPos += speed;
      rollAngle += speed * 0.4;

      // Spawn new tiles ahead
      while (tiles.length < 45) {
        spawnTile(nextTileIndex++);
      }
      while (tiles.length && tiles[0].z < zPos - 4) {
        tiles.shift();
      }

      // Find current tile under ball (ball is at z = zPos + 4)
      const ballZ = zPos + 4.0;
      const curTile = tiles.find((t) => Math.abs(t.z - ballZ) < 1.15);
      const trackY = curTile ? curTile.slopeY : by;

      // Jump / gravity physics
      by += vyb;
      if (by > trackY) {
        vyb -= 0.016;
      } else {
        by = trackY;
        vyb = 0;
      }

      if (curTile) {
        const halfW = curTile.width / 2;
        const relX = bx - curTile.xCenter;
        // Fell off edge if not airborne
        if (Math.abs(relX) > halfW + 0.28 && by <= trackY + 0.15) {
          die(Math.floor(zPos * 2));
          return;
        }
        // Check obstacle collision
        if (curTile.obs && Math.abs(curTile.z - ballZ) < 0.75) {
          const o = curTile.obs;
          const ox = curTile.xCenter + o.x + (o.kind === "moving" ? Math.sin(zPos * 0.08 + o.phase) * (halfW * 0.55) : 0);
          if (Math.abs(bx - ox) < o.w * 0.55 + 0.28 && by - trackY < o.h) {
            if (o.kind === "boost") {
              zPos += 3.5;
              audio.blip(980, 0.07, 0.05);
            } else if (o.kind === "ramp") {
              vyb = 0.28;
              audio.blip(740, 0.08, 0.05);
            } else {
              die(Math.floor(zPos * 2));
              return;
            }
          }
        }
      }

      const curScore = Math.floor(zPos * 2);
      setScore(curScore);

      // Camera follows ball
      const camX = bx * 0.65;
      const camY = by + 2.1;
      const camZ = zPos;

      // Render background
      ctx.fillStyle = "#04050a";
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Speed warp lines
      ctx.strokeStyle = skin.glow + "28";
      ctx.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + zPos * 0.01;
        const r1 = 60 + ((zPos * 12 + i * 35) % 180);
        const r2 = r1 + 45;
        ctx.beginPath();
        ctx.moveTo(cv.width / 2 + Math.cos(ang) * r1, cv.height * 0.38 + Math.sin(ang) * r1 * 0.6);
        ctx.lineTo(cv.width / 2 + Math.cos(ang) * r2, cv.height * 0.38 + Math.sin(ang) * r2 * 0.6);
        ctx.stroke();
      }

      // Draw tiles from back to front
      for (let i = tiles.length - 1; i >= 1; i--) {
        const t1 = tiles[i - 1];
        const t2 = tiles[i];
        const p1L = project(t1.xCenter - t1.width / 2, t1.slopeY, t1.z, camX, camY, camZ);
        const p1R = project(t1.xCenter + t1.width / 2, t1.slopeY, t1.z, camX, camY, camZ);
        const p2L = project(t2.xCenter - t2.width / 2, t2.slopeY, t2.z, camX, camY, camZ);
        const p2R = project(t2.xCenter + t2.width / 2, t2.slopeY, t2.z, camX, camY, camZ);
        if (!p1L || !p1R || !p2L || !p2R) continue;

        const alpha = Math.max(0.08, Math.min(1, 1 - (t2.z - camZ) / 85));
        ctx.fillStyle = i % 2 === 0 ? `rgba(12, 18, 30, ${alpha * 0.92})` : `rgba(8, 12, 22, ${alpha * 0.92})`;
        ctx.strokeStyle = skin.color + Math.round(alpha * 210).toString(16).padStart(2, "0");
        ctx.lineWidth = Math.max(1, 2.2 * alpha);

        ctx.beginPath();
        ctx.moveTo(p1L.sx, p1L.sy);
        ctx.lineTo(p1R.sx, p1R.sy);
        ctx.lineTo(p2R.sx, p2R.sy);
        ctx.lineTo(p2L.sx, p2L.sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw obstacle on t1
        if (t1.obs) {
          const o = t1.obs;
          const ox = t1.xCenter + o.x + (o.kind === "moving" ? Math.sin(zPos * 0.08 + o.phase) * (t1.width * 0.27) : 0);
          const bL = project(ox - o.w / 2, t1.slopeY, t1.z, camX, camY, camZ);
          const bR = project(ox + o.w / 2, t1.slopeY, t1.z, camX, camY, camZ);
          const tL = project(ox - o.w / 2, t1.slopeY + o.h, t1.z, camX, camY, camZ);
          const tR = project(ox + o.w / 2, t1.slopeY + o.h, t1.z, camX, camY, camZ);
          if (bL && bR && tL && tR) {
            const col = o.kind === "boost" ? "#39ff88" : o.kind === "ramp" ? "#6ee7ff" : "#ff3b5c";
            ctx.fillStyle = col + "cc";
            ctx.strokeStyle = "#ffffffaa";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(bL.sx, bL.sy);
            ctx.lineTo(bR.sx, bR.sy);
            ctx.lineTo(tR.sx, tR.sy);
            ctx.lineTo(tL.sx, tL.sy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      // Ball trail
      trail.push({ x: bx, y: by + 0.25, z: ballZ });
      if (trail.length > 14) trail.shift();
      trail.forEach((pt, idx) => {
        const pr = project(pt.x, pt.y, pt.z - (trail.length - idx) * 0.22, camX, camY, camZ);
        if (!pr) return;
        ctx.fillStyle = skin.color + Math.round((idx / trail.length) * 120).toString(16).padStart(2, "0");
        ctx.beginPath();
        ctx.arc(pr.sx, pr.sy, Math.max(2, pr.scale * 0.16 * (idx / trail.length)), 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Player Sphere
      const bp = project(bx, by + 0.32, ballZ, camX, camY, camZ);
      if (bp) {
        const rad = Math.max(10, bp.scale * 0.32);
        const grad = ctx.createRadialGradient(bp.sx - rad * 0.3, bp.sy - rad * 0.3, 2, bp.sx, bp.sy, rad * 1.3);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.45, skin.color);
        grad.addColorStop(1, "#05070e");
        ctx.shadowColor = skin.color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bp.sx, bp.sy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Wireframe meridian ring on ball
        ctx.strokeStyle = "#ffffff88";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(bp.sx, bp.sy, rad * 0.85, rad * Math.abs(Math.cos(rollAngle)) * 0.85 + 1, vx * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cv.removeEventListener("pointermove", onPointer);
      cv.removeEventListener("pointerdown", onPointer);
    };
  }, [runId, skin]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <div className="flex w-full max-w-[680px] flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-line bg-white/[0.03] px-3 py-1 font-mono">
            DISTANCE <b className="text-accent">{score}m</b>
          </span>
          <span className="rounded-lg border border-line bg-white/[0.03] px-3 py-1 font-mono">
            <Trophy size={11} className="mr-1 inline text-warn" /> BEST <b className="text-accent">{Math.max(best, score)}m</b>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {BALL_SKINS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSkin(s)}
              className={cn(
                "rounded-lg border px-2 py-1 font-mono text-[9px] uppercase transition",
                skin.id === s.id ? "border-white text-txt" : "border-line text-faint hover:text-dim"
              )}
              style={{ background: skin.id === s.id ? s.color + "33" : undefined }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-[680px] overflow-hidden rounded-2xl border border-line bg-black shadow-2xl">
        <canvas ref={cvRef} width={680} height={400} className="block h-auto w-full touch-none" />
        {dead && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-bad">signal lost · off track</div>
              <div className="mt-1 font-display text-3xl font-bold text-txt">{score} meters</div>
              <div className="mt-1 font-mono text-[11px] text-dim">Best run: {Math.max(best, score)}m</div>
              <Btn
                className="mt-4"
                variant="primary"
                size="md"
                icon={<RotateCcw size={14} />}
                onClick={() => { setDead(false); setScore(0); setRunId((r) => r + 1); }}
              >
                Launch Again
              </Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
        A / D or Left / Right Arrows (or drag pointer) to steer · Cyan = Jump Ramp · Green = Hyper Boost · Red = Lethal
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. GEOMETRY DASH: NEON PULSE — Rhythm Action Platformer (Cube + Ship + Orbs)
 * ========================================================================== */
const GD_LEVELS = [
  { id: 0, name: "Stereo Neon", speed: 5.2, color: "#00f2ff", bg: "#061024", length: 2800 },
  { id: 1, name: "Event Horizon", speed: 6.1, color: "#ff9f45", bg: "#1c0b12", length: 3400 },
  { id: 2, name: "Kalmia Overdrive", speed: 6.8, color: "#ff8fc4", bg: "#150722", length: 4000 },
];

export function GGeometryDash() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [lvlIdx, setLvlIdx] = useState(0);
  const [pct, setPct] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [practice, setPractice] = useState(false);
  const [won, setWon] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const lvl = GD_LEVELS[lvlIdx];

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    let raf = 0;
    const groundY = 320;
    let holding = false;
    let orbReady = false;

    type Obj = { x: number; y: number; w: number; h: number; kind: "spike" | "block" | "pad" | "orb" | "shipPortal" | "cubePortal" };
    const objs: Obj[] = [];

    // Deterministic procedural level layout per level index
    let cx = 420;
    let seed = (lvlIdx + 1) * 1337;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    while (cx < lvl.length - 300) {
      const pat = Math.floor(rand() * 6);
      if (pat === 0) {
        objs.push({ x: cx, y: groundY - 32, w: 30, h: 32, kind: "spike" });
        if (rand() > 0.45) objs.push({ x: cx + 30, y: groundY - 32, w: 30, h: 32, kind: "spike" });
        cx += 230;
      } else if (pat === 1) {
        objs.push({ x: cx, y: groundY - 40, w: 70, h: 40, kind: "block" });
        objs.push({ x: cx + 110, y: groundY - 80, w: 70, h: 80, kind: "block" });
        objs.push({ x: cx + 70, y: groundY - 32, w: 40, h: 32, kind: "spike" });
        cx += 270;
      } else if (pat === 2) {
        objs.push({ x: cx, y: groundY - 12, w: 34, h: 12, kind: "pad" });
        objs.push({ x: cx + 50, y: groundY - 32, w: 90, h: 32, kind: "spike" });
        objs.push({ x: cx + 150, y: groundY - 95, w: 80, h: 24, kind: "block" });
        cx += 300;
      } else if (pat === 3) {
        objs.push({ x: cx, y: groundY - 32, w: 60, h: 32, kind: "spike" });
        objs.push({ x: cx + 55, y: groundY - 82, w: 26, h: 26, kind: "orb" });
        objs.push({ x: cx + 95, y: groundY - 32, w: 60, h: 32, kind: "spike" });
        cx += 270;
      } else if (pat === 4) {
        // Ship section!
        objs.push({ x: cx, y: 80, w: 28, h: 240, kind: "shipPortal" });
        for (let s = 1; s <= 4; s++) {
          const gapY = 120 + rand() * 110;
          objs.push({ x: cx + s * 140, y: 0, w: 42, h: gapY - 58, kind: "block" });
          objs.push({ x: cx + s * 140, y: gapY + 58, w: 42, h: groundY - (gapY + 58), kind: "block" });
        }
        objs.push({ x: cx + 640, y: 80, w: 28, h: 240, kind: "cubePortal" });
        cx += 760;
      } else {
        objs.push({ x: cx, y: groundY - 36, w: 45, h: 36, kind: "block" });
        objs.push({ x: cx + 95, y: groundY - 72, w: 45, h: 72, kind: "block" });
        objs.push({ x: cx + 190, y: groundY - 108, w: 65, h: 108, kind: "block" });
        cx += 320;
      }
    }

    let px = 110, py = groundY - 30, vy = 0, rot = 0;
    let scrollX = 0;
    let shipMode = false;
    let checkpoint = { scrollX: 0, py: groundY - 30, shipMode: false };
    const particles: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];

    const respawn = () => {
      for (let i = 0; i < 22; i++) {
        particles.push({
          x: px + 15, y: py + 15,
          vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9,
          life: 1, c: lvl.color,
        });
      }
      audio.blip(150, 0.2, 0.06, "sawtooth");
      setAttempts((a) => a + 1);
      if (practice) {
        scrollX = checkpoint.scrollX;
        py = checkpoint.py;
        shipMode = checkpoint.shipMode;
      } else {
        scrollX = 0;
        py = groundY - 30;
        shipMode = false;
      }
      vy = 0;
      rot = 0;
    };

    const down = (e?: KeyboardEvent | PointerEvent) => {
      if (e && "key" in e) {
        if (e.key.toLowerCase() === "z" && practice) {
          checkpoint = { scrollX, py, shipMode };
          return;
        }
        if (![" ", "arrowup", "w"].includes(e.key.toLowerCase())) return;
        e.preventDefault();
      }
      holding = true;
      orbReady = true;
    };
    const up = () => { holding = false; orbReady = false; };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    cv.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      scrollX += lvl.speed;
      const curPct = Math.min(100, Math.floor((scrollX / lvl.length) * 100));
      setPct(curPct);
      if (scrollX >= lvl.length) {
        setWon(true);
        setBest("gd-" + lvlIdx, 100);
        audio.blip(1040, 0.35, 0.07);
        cancelAnimationFrame(raf);
        return;
      }

      if (practice && Math.floor(scrollX) % 350 === 0) {
        checkpoint = { scrollX, py, shipMode };
      }

      const pSize = 30;
      let onGround = false;

      if (shipMode) {
        vy += holding ? -0.52 : 0.42;
        vy = Math.max(-7.5, Math.min(7.5, vy));
        py += vy;
        rot = vy * 4;
        if (py < 16) { py = 16; vy = 0; }
        if (py + pSize >= groundY) { py = groundY - pSize; vy = 0; onGround = true; }
      } else {
        vy += 0.82;
        py += vy;
        if (py + pSize >= groundY) {
          py = groundY - pSize;
          vy = 0;
          onGround = true;
          rot = Math.round(rot / 90) * 90;
        } else {
          rot += 6.2;
        }
      }

      const wx = scrollX + px;

      for (const o of objs) {
        if (o.x + o.w < wx - 40 || o.x > wx + 80) continue;
        const overlapX = wx + pSize - 5 > o.x && wx + 5 < o.x + o.w;
        const overlapY = py + pSize - 4 > o.y && py + 4 < o.y + o.h;
        if (!overlapX || !overlapY) continue;

        if (o.kind === "shipPortal") { shipMode = true; audio.blip(860, 0.08, 0.05); }
        else if (o.kind === "cubePortal") { shipMode = false; audio.blip(640, 0.08, 0.05); }
        else if (o.kind === "pad") { vy = -15.2; onGround = false; audio.blip(920, 0.07, 0.05); }
        else if (o.kind === "orb") {
          if (orbReady) { vy = -13.2; orbReady = false; audio.blip(820, 0.06, 0.05); }
        } else if (o.kind === "spike") {
          respawn();
          break;
        } else if (o.kind === "block") {
          // Landed on top of block?
          if (vy >= 0 && py + pSize - vy <= o.y + 11) {
            py = o.y - pSize;
            vy = 0;
            onGround = true;
            rot = Math.round(rot / 90) * 90;
          } else {
            respawn();
            break;
          }
        }
      }

      if (!shipMode && holding && onGround) {
        vy = -12.6;
        audio.blip(540, 0.05, 0.04);
      }

      // Render background
      ctx.fillStyle = lvl.bg;
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Parallax background grid
      ctx.strokeStyle = lvl.color + "1e";
      ctx.lineWidth = 1;
      const gxOff = -(scrollX * 0.4) % 48;
      for (let x = gxOff; x < cv.width; x += 48) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, groundY); ctx.stroke();
      }
      for (let y = 32; y < groundY; y += 48) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
      }

      // Ground
      ctx.fillStyle = "#05070e";
      ctx.fillRect(0, groundY, cv.width, cv.height - groundY);
      ctx.strokeStyle = lvl.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(cv.width, groundY); ctx.stroke();

      // Objects
      for (const o of objs) {
        const sx = o.x - scrollX;
        if (sx < -120 || sx > cv.width + 60) continue;
        if (o.kind === "spike") {
          const count = Math.max(1, Math.round(o.w / 30));
          const sw = o.w / count;
          for (let k = 0; k < count; k++) {
            ctx.fillStyle = "#ff3b5c";
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx + k * sw, o.y + o.h);
            ctx.lineTo(sx + k * sw + sw / 2, o.y);
            ctx.lineTo(sx + (k + 1) * sw, o.y + o.h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        } else if (o.kind === "block") {
          ctx.fillStyle = "#0c1220";
          ctx.strokeStyle = lvl.color;
          ctx.lineWidth = 2;
          ctx.fillRect(sx, o.y, o.w, o.h);
          ctx.strokeRect(sx, o.y, o.w, o.h);
        } else if (o.kind === "pad") {
          ctx.fillStyle = "#ff5cf0";
          ctx.fillRect(sx, o.y, o.w, o.h);
        } else if (o.kind === "orb") {
          ctx.strokeStyle = "#ffd166";
          ctx.fillStyle = "#ffd16655";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sx + o.w / 2, o.y + o.h / 2, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (o.kind === "shipPortal" || o.kind === "cubePortal") {
          ctx.fillStyle = o.kind === "shipPortal" ? "#ff8fc444" : "#39ff8844";
          ctx.strokeStyle = o.kind === "shipPortal" ? "#ff8fc4" : "#39ff88";
          ctx.lineWidth = 3;
          ctx.strokeRect(sx, o.y, o.w, o.h);
          ctx.fillRect(sx, o.y, o.w, o.h);
        }
      }

      // Player
      ctx.save();
      ctx.translate(px + pSize / 2, py + pSize / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.shadowColor = lvl.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = lvl.color;
      ctx.fillRect(-pSize / 2, -pSize / 2, pSize, pSize);
      ctx.fillStyle = "#080b14";
      ctx.fillRect(-pSize / 4, -pSize / 4, pSize / 2, pSize / 2);
      if (shipMode) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-pSize / 2 - 4, 6, pSize + 8, 6);
      }
      ctx.restore();

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.04;
        if (pt.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = pt.c;
        ctx.globalAlpha = pt.life;
        ctx.fillRect(pt.x, pt.y, 4, 4);
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      cv.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, [lvlIdx, practice, runKey, lvl]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <div className="flex w-full max-w-[680px] flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-1.5">
          {GD_LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => { setLvlIdx(l.id); setWon(false); setAttempts(1); setRunKey((k) => k + 1); }}
              className={cn(
                "rounded-lg border px-2.5 py-1 font-mono text-[10px] uppercase transition",
                lvlIdx === l.id ? "border-accent bg-accent/15 text-accent font-bold" : "border-line text-dim hover:text-txt"
              )}
            >
              {l.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-dim">ATTEMPT <b className="text-accent">{attempts}</b></span>
          <Btn size="xs" variant={practice ? "primary" : "outline"} onClick={() => setPractice((p) => !p)}>
            {practice ? "Practice ON" : "Practice Mode"}
          </Btn>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex w-full max-w-[680px] items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all" style={{ width: pct + "%", background: lvl.color }} />
        </div>
        <span className="font-mono text-[11px] font-bold text-accent">{pct}%</span>
      </div>

      <div className="relative w-full max-w-[680px] overflow-hidden rounded-2xl border border-line bg-black">
        <canvas ref={cvRef} width={680} height={360} className="block h-auto w-full touch-none" />
        {won && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="font-display text-3xl font-bold text-ok">LEVEL COMPLETE! 🎉</div>
              <div className="mt-1 font-mono text-[12px] text-dim">{lvl.name} cleared in {attempts} attempts</div>
              <Btn className="mt-4" variant="primary" onClick={() => { setWon(false); setRunKey((k) => k + 1); }}>Replay Level</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
        Hold Space / Up / Click to Jump (or Fly in Ship Portals) · Tap mid-air on Yellow Orbs · Z sets practice checkpoint
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. VOID SURVIVORS — Modern Bullet-Heaven Horde Survival Roguelite
 * ========================================================================== */
interface UpgradeOpt { id: string; name: string; desc: string; apply: (s: any) => void }

const UPGRADE_POOL: UpgradeOpt[] = [
  { id: "orbit", name: "Plasma Orbitals +1", desc: "Adds a spinning plasma blade around your ship", apply: (s) => { s.orbitals += 1; } },
  { id: "rate", name: "Overclock Fire Rate", desc: "+30% faster auto-cannon fire rate", apply: (s) => { s.fireDelay = Math.max(8, Math.floor(s.fireDelay * 0.75)); } },
  { id: "multi", name: "Split Scatter Shot", desc: "Fires +1 extra projectile per volley", apply: (s) => { s.projectiles += 1; } },
  { id: "lightning", name: "Tesla Chain Arc", desc: "Strikes nearby enemies with high-voltage lightning", apply: (s) => { s.lightning += 1; } },
  { id: "speed", name: "Ion Thrusters", desc: "+25% movement speed + heals 35 HP", apply: (s) => { s.speed += 0.7; s.hp = Math.min(s.maxHp, s.hp + 35); } },
  { id: "nova", name: "Singularity Shockwave", desc: "Periodic expanding gravitational blast", apply: (s) => { s.nova += 1; } },
];

export function GVoidSurvivors() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ kills: 0, level: 1, hp: 100, xp: 0, xpNeed: 10, sec: 0 });
  const [choices, setChoices] = useState<UpgradeOpt[] | null>(null);
  const [dead, setDead] = useState(false);
  const [runId, setRunId] = useState(0);
  const simRef = useRef<any>(null);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    const sim = {
      px: 340, py: 190, hp: 100, maxHp: 100, speed: 3.1,
      level: 1, xp: 0, xpNeed: 8, kills: 0, ticks: 0,
      fireDelay: 22, projectiles: 1, orbitals: 1, lightning: 0, nova: 0,
      paused: false,
      enemies: [] as { x: number; y: number; hp: number; maxHp: number; r: number; spd: number; boss?: boolean }[],
      bullets: [] as { x: number; y: number; vx: number; vy: number; dmg: number }[],
      gems: [] as { x: number; y: number; v: number }[],
      arcs: [] as { x1: number; y1: number; x2: number; y2: number; life: number }[],
    };
    simRef.current = sim;

    const keys: Record<string, boolean> = {};
    const kd = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
    const ku = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (sim.paused) return;
      sim.ticks++;

      // Movement
      let dx = 0, dy = 0;
      if (keys["w"] || keys["arrowup"]) dy -= 1;
      if (keys["s"] || keys["arrowdown"]) dy += 1;
      if (keys["a"] || keys["arrowleft"]) dx -= 1;
      if (keys["d"] || keys["arrowright"]) dx += 1;
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        sim.px = Math.max(16, Math.min(cv.width - 16, sim.px + (dx / len) * sim.speed));
        sim.py = Math.max(16, Math.min(cv.height - 16, sim.py + (dy / len) * sim.speed));
      }

      // Spawn enemies
      const spawnRate = Math.max(14, 48 - Math.floor(sim.ticks / 180));
      if (sim.ticks % spawnRate === 0) {
        const edge = Math.floor(Math.random() * 4);
        const ex = edge === 0 ? -15 : edge === 1 ? cv.width + 15 : Math.random() * cv.width;
        const ey = edge === 2 ? -15 : edge === 3 ? cv.height + 15 : Math.random() * cv.height;
        const isBoss = sim.ticks % 600 === 0;
        const hp = isBoss ? 80 + sim.level * 25 : 10 + sim.level * 4;
        sim.enemies.push({
          x: ex, y: ey, hp, maxHp: hp,
          r: isBoss ? 18 : 9 + (sim.ticks % 5),
          spd: isBoss ? 0.9 : 1.1 + Math.min(1.4, sim.ticks / 2200),
          boss: isBoss,
        });
      }

      // Auto-fire nearest enemy
      if (sim.ticks % sim.fireDelay === 0 && sim.enemies.length > 0) {
        let nearest = sim.enemies[0];
        let bestD = 999999;
        for (const e of sim.enemies) {
          const d = Math.hypot(e.x - sim.px, e.y - sim.py);
          if (d < bestD) { bestD = d; nearest = e; }
        }
        const baseAng = Math.atan2(nearest.y - sim.py, nearest.x - sim.px);
        for (let i = 0; i < sim.projectiles; i++) {
          const spread = (i - (sim.projectiles - 1) / 2) * 0.16;
          const a = baseAng + spread;
          sim.bullets.push({ x: sim.px, y: sim.py, vx: Math.cos(a) * 7.5, vy: Math.sin(a) * 7.5, dmg: 12 + sim.level * 2 });
        }
        audio.blip(680, 0.02, 0.02);
      }

      // Tesla lightning
      if (sim.lightning > 0 && sim.ticks % Math.max(18, 55 - sim.lightning * 10) === 0 && sim.enemies.length > 0) {
        for (let k = 0; k < sim.lightning; k++) {
          const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
          if (target) {
            target.hp -= 22 + sim.lightning * 8;
            sim.arcs.push({ x1: sim.px, y1: sim.py, x2: target.x, y2: target.y, life: 1 });
          }
        }
      }

      // Nova shockwave
      if (sim.nova > 0 && sim.ticks % 130 === 0) {
        for (const e of sim.enemies) {
          if (Math.hypot(e.x - sim.px, e.y - sim.py) < 130 + sim.nova * 20) {
            e.hp -= 18 * sim.nova;
          }
        }
      }

      // Update bullets
      for (let i = sim.bullets.length - 1; i >= 0; i--) {
        const b = sim.bullets[i];
        b.x += b.vx; b.y += b.vy;
        if (b.x < -20 || b.x > cv.width + 20 || b.y < -20 || b.y > cv.height + 20) {
          sim.bullets.splice(i, 1);
          continue;
        }
        for (const e of sim.enemies) {
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) {
            e.hp -= b.dmg;
            sim.bullets.splice(i, 1);
            break;
          }
        }
      }

      // Orbitals coordinates
      const orbPts: { x: number; y: number }[] = [];
      for (let i = 0; i < sim.orbitals; i++) {
        const a = sim.ticks * 0.075 + (i * Math.PI * 2) / sim.orbitals;
        orbPts.push({ x: sim.px + Math.cos(a) * 52, y: sim.py + Math.sin(a) * 52 });
      }

      // Update enemies
      for (let i = sim.enemies.length - 1; i >= 0; i--) {
        const e = sim.enemies[i];
        const a = Math.atan2(sim.py - e.y, sim.px - e.x);
        e.x += Math.cos(a) * e.spd;
        e.y += Math.sin(a) * e.spd;

        // Orbital blade hit
        for (const op of orbPts) {
          if (Math.hypot(e.x - op.x, e.y - op.y) < e.r + 8) e.hp -= 1.8;
        }

        // Player contact
        if (Math.hypot(e.x - sim.px, e.y - sim.py) < e.r + 11) {
          sim.hp -= 0.45;
          if (sim.hp <= 0) {
            sim.paused = true;
            setDead(true);
            setBest("survivors", sim.kills);
            return;
          }
        }

        if (e.hp <= 0) {
          sim.kills++;
          sim.gems.push({ x: e.x, y: e.y, v: e.boss ? 8 : 2 });
          sim.enemies.splice(i, 1);
        }
      }

      // Collect XP Gems
      for (let i = sim.gems.length - 1; i >= 0; i--) {
        const g = sim.gems[i];
        const d = Math.hypot(g.x - sim.px, g.y - sim.py);
        if (d < 95) {
          g.x += ((sim.px - g.x) / d) * 6.5;
          g.y += ((sim.py - g.y) / d) * 6.5;
        }
        if (d < 16) {
          sim.xp += g.v;
          sim.gems.splice(i, 1);
          if (sim.xp >= sim.xpNeed) {
            sim.xp -= sim.xpNeed;
            sim.level++;
            sim.xpNeed = Math.floor(sim.xpNeed * 1.35 + 4);
            sim.paused = true;
            const pool = [...UPGRADE_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
            setChoices(pool);
            audio.blip(1120, 0.14, 0.06);
          }
        }
      }

      if (sim.ticks % 10 === 0) {
        setHud({ kills: sim.kills, level: sim.level, hp: Math.ceil(sim.hp), xp: sim.xp, xpNeed: sim.xpNeed, sec: Math.floor(sim.ticks / 60) });
      }

      // Render Arena
      ctx.fillStyle = "#060810";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      for (let x = 0; x < cv.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke(); }
      for (let y = 0; y < cv.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke(); }

      // Gems
      ctx.fillStyle = "#6ee7ff";
      for (const g of sim.gems) {
        ctx.beginPath(); ctx.arc(g.x, g.y, 4, 0, Math.PI * 2); ctx.fill();
      }

      // Enemies
      for (const e of sim.enemies) {
        ctx.fillStyle = e.boss ? "#ff8fc4" : "#ff4d6d";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      }

      // Bullets
      ctx.fillStyle = "#ffd166";
      for (const b of sim.bullets) {
        ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
      }

      // Orbitals
      ctx.fillStyle = "#9ef01a";
      for (const op of orbPts) {
        ctx.beginPath(); ctx.arc(op.x, op.y, 6.5, 0, Math.PI * 2); ctx.fill();
      }

      // Lightning arcs
      for (let i = sim.arcs.length - 1; i >= 0; i--) {
        const a = sim.arcs[i];
        a.life -= 0.1;
        if (a.life <= 0) { sim.arcs.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(110, 231, 255, ${a.life})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
      }

      // Player
      ctx.fillStyle = "#ff9f45";
      ctx.beginPath(); ctx.arc(sim.px, sim.py, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [runId]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <div className="flex w-full max-w-[680px] flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1">LVL <b className="text-accent">{hud.level}</b></span>
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1">KILLS <b className="text-ok">{hud.kills}</b></span>
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1">HP <b className="text-bad">{hud.hp}%</b></span>
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1">TIME <b className="text-accent2">{hud.sec}s</b></span>
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1">BEST <b className="text-warn">{Math.max(getBest("survivors"), hud.kills)}</b></span>
      </div>

      <div className="relative w-full max-w-[680px] overflow-hidden rounded-2xl border border-line bg-black">
        <canvas ref={cvRef} width={680} height={380} className="block h-auto w-full" />

        {/* Level-Up Upgrade Picker Modal */}
        {choices && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-accent/50 bg-panel p-4 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">level {hud.level} reached</div>
              <div className="mt-1 font-display text-xl font-bold text-txt">Choose a Weapon Augment</div>
              <div className="mt-3 flex flex-col gap-2">
                {choices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      c.apply(simRef.current);
                      simRef.current.paused = false;
                      setChoices(null);
                    }}
                    className="rounded-xl border border-line bg-white/[0.04] p-3 text-left transition hover:border-accent hover:bg-accent/15"
                  >
                    <div className="font-display text-sm font-bold text-accent">{c.name}</div>
                    <div className="text-[11px] text-dim">{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {dead && (
          <div className="absolute inset-0 grid place-items-center bg-black/85 backdrop-blur-sm">
            <div className="text-center">
              <div className="font-display text-3xl font-bold text-bad">OVERRUN BY THE SWARM</div>
              <div className="mt-1 font-mono text-[12px] text-dim">{hud.kills} kills · survived {hud.sec}s · level {hud.level}</div>
              <Btn className="mt-4" variant="primary" onClick={() => { setDead(false); setChoices(null); setRunId((r) => r + 1); }}>
                Deploy Again
              </Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
        WASD or Arrow Keys to move · Weapons fire automatically · Collect cyan XP crystals to evolve
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. CYBER DOOM 3D — First-Person 3D Raycaster Shooter
 * ========================================================================== */
const MAP_GRID = [
  "1111111111111111",
  "1000001000000001",
  "1011001001111001",
  "1010000000001001",
  "1000001100000001",
  "1010001100100101",
  "1011000000100101",
  "1000000000000001",
  "1001110001110001",
  "1001000000010001",
  "1000001100000001",
  "1111111111111111",
];

export function GCyberDoom() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({ hp: 100, kills: 0, wave: 1, ammo: 40 });
  const [dead, setDead] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    let px = 2.5, py = 2.5, pa = 0;
    let hp = 100, kills = 0, wave = 1, ammo = 40;
    let recoil = 0, flash = 0;
    const keys: Record<string, boolean> = {};

    type Bot = { x: number; y: number; hp: number; hit: number };
    const bots: Bot[] = [];
    const spawnWave = (count: number) => {
      for (let i = 0; i < count; i++) {
        let bx = 7.5, by = 7.5;
        for (let tries = 0; tries < 30; tries++) {
          const tx = 1.5 + Math.floor(Math.random() * 13);
          const ty = 1.5 + Math.floor(Math.random() * 9);
          if (MAP_GRID[Math.floor(ty)]?.[Math.floor(tx)] === "0" && Math.hypot(tx - px, ty - py) > 3.5) {
            bx = tx; by = ty; break;
          }
        }
        bots.push({ x: bx, y: by, hp: 30 + wave * 10, hit: 0 });
      }
    };
    spawnWave(5);

    const shoot = () => {
      if (ammo <= 0) { ammo = 25; audio.blip(320, 0.1, 0.04); return; }
      ammo--;
      recoil = 14;
      flash = 1;
      audio.blip(180, 0.08, 0.07, "sawtooth");

      // Hitscan check against bots near crosshair angle
      let bestBot: Bot | null = null;
      let bestDist = 99;
      for (const b of bots) {
        const dx = b.x - px, dy = b.y - py;
        const dist = Math.hypot(dx, dy);
        let diff = Math.atan2(dy, dx) - pa;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        if (Math.abs(diff) < 0.22 / Math.max(0.5, dist * 0.35) && dist < bestDist) {
          bestDist = dist;
          bestBot = b;
        }
      }
      if (bestBot) {
        bestBot.hp -= 22;
        bestBot.hit = 6;
        if (bestBot.hp <= 0) {
          kills++;
          ammo = Math.min(60, ammo + 6);
          const idx = bots.indexOf(bestBot);
          if (idx >= 0) bots.splice(idx, 1);
          if (bots.length === 0) {
            wave++;
            hp = Math.min(100, hp + 25);
            spawnWave(4 + wave * 2);
          }
        }
      }
    };

    const kd = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === " ") { e.preventDefault(); shoot(); }
    };
    const ku = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    cv.addEventListener("pointerdown", shoot);

    const isWall = (x: number, y: number) => MAP_GRID[Math.floor(y)]?.[Math.floor(x)] !== "0";

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);

      if (keys["arrowleft"] || keys["q"]) pa -= 0.048;
      if (keys["arrowright"] || keys["e"]) pa += 0.048;
      const moveSpd = 0.065;
      let mx = 0, my = 0;
      if (keys["w"] || keys["arrowup"]) { mx += Math.cos(pa) * moveSpd; my += Math.sin(pa) * moveSpd; }
      if (keys["s"] || keys["arrowdown"]) { mx -= Math.cos(pa) * moveSpd; my -= Math.sin(pa) * moveSpd; }
      if (keys["a"]) { mx += Math.cos(pa - Math.PI / 2) * moveSpd; my += Math.sin(pa - Math.PI / 2) * moveSpd; }
      if (keys["d"]) { mx += Math.cos(pa + Math.PI / 2) * moveSpd; my += Math.sin(pa + Math.PI / 2) * moveSpd; }
      if (!isWall(px + mx * 2.2, py)) px += mx;
      if (!isWall(px, py + my * 2.2)) py += my;

      // Update bots
      for (const b of bots) {
        if (b.hit > 0) b.hit--;
        const dx = px - b.x, dy = py - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.6) {
          const stepX = (dx / d) * 0.022;
          const stepY = (dy / d) * 0.022;
          if (!isWall(b.x + stepX, b.y)) b.x += stepX;
          if (!isWall(b.x, b.y + stepY)) b.y += stepY;
        } else {
          hp -= 0.35;
          if (hp <= 0) {
            setDead(true);
            setBest("doom3d", kills);
            cancelAnimationFrame(raf);
            return;
          }
        }
      }

      setStats({ hp: Math.ceil(hp), kills, wave, ammo });

      // Ceiling & Floor
      const w = cv.width, h = cv.height;
      const ceil = ctx.createLinearGradient(0, 0, 0, h / 2);
      ceil.addColorStop(0, "#050712");
      ceil.addColorStop(1, "#14091e");
      ctx.fillStyle = ceil;
      ctx.fillRect(0, 0, w, h / 2);

      const flr = ctx.createLinearGradient(0, h / 2, 0, h);
      flr.addColorStop(0, "#0b0d16");
      flr.addColorStop(1, "#1b2234");
      ctx.fillStyle = flr;
      ctx.fillRect(0, h / 2, w, h / 2);

      // Raycast walls
      const rays = 170;
      const fov = Math.PI / 3;
      const stripW = w / rays;
      const zBuf = new Float32Array(rays);

      for (let r = 0; r < rays; r++) {
        const ra = pa - fov / 2 + (r / rays) * fov;
        const cos = Math.cos(ra), sin = Math.sin(ra);
        let dist = 0;
        let hitSide = 0;
        while (dist < 18) {
          dist += 0.04;
          const tx = px + cos * dist;
          const ty = py + sin * dist;
          if (isWall(tx, ty)) {
            hitSide = Math.abs(tx - Math.round(tx)) < Math.abs(ty - Math.round(ty)) ? 1 : 0;
            break;
          }
        }
        const perp = dist * Math.cos(ra - pa);
        zBuf[r] = perp;
        const wallH = Math.min(h * 1.4, (h * 0.85) / Math.max(0.1, perp));
        const shade = Math.max(0.12, Math.min(1, 1.15 - perp / 11)) * (hitSide ? 0.78 : 1);
        ctx.fillStyle = `rgb(${Math.round(35 * shade)}, ${Math.round(190 * shade)}, ${Math.round(255 * shade)})`;
        ctx.fillRect(r * stripW, (h - wallH) / 2, stripW + 1, wallH);
      }

      // Render 3D enemy drone sprites sorted back-to-front
      const sorted = [...bots].sort((a, b) => Math.hypot(b.x - px, b.y - py) - Math.hypot(a.x - px, a.y - py));
      for (const b of sorted) {
        const dx = b.x - px, dy = b.y - py;
        const dist = Math.hypot(dx, dy);
        let ang = Math.atan2(dy, dx) - pa;
        while (ang < -Math.PI) ang += Math.PI * 2;
        while (ang > Math.PI) ang -= Math.PI * 2;
        if (Math.abs(ang) > fov * 0.75) continue;

        const sx = (0.5 + ang / fov) * w;
        const size = Math.min(h * 0.9, (h * 0.55) / Math.max(0.2, dist));
        const rayIdx = Math.floor((sx / w) * rays);
        if (rayIdx >= 0 && rayIdx < rays && zBuf[rayIdx] < dist) continue;

        // Cyber Drone Body
        ctx.fillStyle = b.hit > 0 ? "#ffffff" : "#ff3b5c";
        ctx.beginPath();
        ctx.arc(sx, h / 2, size * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.arc(sx, h / 2, size * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crosshair
      ctx.strokeStyle = "#9ef01a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Weapon & Muzzle Flash
      recoil *= 0.8;
      if (flash > 0.05) {
        ctx.fillStyle = `rgba(255, 190, 80, ${flash})`;
        ctx.beginPath();
        ctx.arc(w / 2, h - 75 + recoil, 28, 0, Math.PI * 2);
        ctx.fill();
        flash *= 0.65;
      }
      ctx.fillStyle = "#1c2230";
      ctx.strokeStyle = "#ff9f45";
      ctx.lineWidth = 2;
      ctx.fillRect(w / 2 - 22, h - 68 + recoil, 44, 72);
      ctx.strokeRect(w / 2 - 22, h - 68 + recoil, 44, 72);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      cv.removeEventListener("pointerdown", shoot);
    };
  }, [runId]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-3">
      <div className="flex w-full max-w-[680px] flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1"><Shield size={11} className="mr-1 inline text-ok" /> HP <b className="text-ok">{stats.hp}%</b></span>
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1"><Crosshair size={11} className="mr-1 inline text-bad" /> KILLS <b className="text-accent">{stats.kills}</b></span>
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1"><Sparkles size={11} className="mr-1 inline text-accent2" /> WAVE <b className="text-accent2">{stats.wave}</b></span>
        <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1"><Zap size={11} className="mr-1 inline text-warn" /> PLASMA <b className="text-warn">{stats.ammo}</b></span>
      </div>

      <div className="relative w-full max-w-[680px] overflow-hidden rounded-2xl border border-line bg-black">
        <canvas ref={cvRef} width={680} height={380} className="block h-auto w-full cursor-crosshair" />
        {dead && (
          <div className="absolute inset-0 grid place-items-center bg-black/85 backdrop-blur-sm">
            <div className="text-center">
              <div className="font-display text-3xl font-bold text-bad">SECTOR LOST</div>
              <div className="mt-1 font-mono text-[12px] text-dim">{stats.kills} drones neutralized · wave {stats.wave}</div>
              <Btn className="mt-4" variant="primary" onClick={() => { setDead(false); setRunId((r) => r + 1); }}>
                Respawn in Sector
              </Btn>
            </div>
          </div>
        )}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
        W/S to Move · Left/Right Arrows (or Q/E) to Turn · A/D to Strafe · Space or Click to Fire Plasma Rifle
      </div>
    </div>
  );
}

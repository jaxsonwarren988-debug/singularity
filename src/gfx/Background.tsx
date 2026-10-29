import { useEffect, useRef, useState } from "react";
import { shaderSource, VERTEX } from "@/gfx/shaders";
import { useSettings } from "@/state/store";
import { useUI } from "@/state/ui";
import { hexToRgb } from "@/lib/utils";

export default function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const s = useSettings();
  const stealth = useUI((u) => u.stealth);
  const [failed, setFailed] = useState(false);
  const cfg = useRef(s);
  cfg.current = s;
  const pulseAt = useRef(-9999);
  const pulse = useUI((u) => u.pulse);
  const hiddenRef = useRef(false);
  hiddenRef.current = stealth || !s.shaderOn;

  useEffect(() => { if (pulse > 0) pulseAt.current = performance.now(); }, [pulse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl: WebGLRenderingContext | null = null;
    const opts: WebGLContextAttributes = { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance", preserveDrawingBuffer: false };
    try {
      gl = (canvas.getContext("webgl2", opts) as WebGLRenderingContext) || canvas.getContext("webgl", opts);
    } catch { /* ignore */ }
    if (!gl) { setFailed(true); return; }
    const GL = gl;

    const compile = (type: number, src: string) => {
      const sh = GL.createShader(type)!;
      GL.shaderSource(sh, src); GL.compileShader(sh);
      if (!GL.getShaderParameter(sh, GL.COMPILE_STATUS)) {
        console.warn("shader:", GL.getShaderInfoLog(sh));
        GL.deleteShader(sh); return null;
      }
      return sh;
    };
    const vs = compile(GL.VERTEX_SHADER, VERTEX);
    if (!vs) { setFailed(true); return; }

    const programs = new Map<string, { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }>();
    const build = (id: string) => {
      const cached = programs.get(id);
      if (cached) return cached;
      const fs = compile(GL.FRAGMENT_SHADER, shaderSource(id));
      if (!fs) return null;
      const p = GL.createProgram()!;
      GL.attachShader(p, vs); GL.attachShader(p, fs); GL.linkProgram(p);
      GL.deleteShader(fs);
      if (!GL.getProgramParameter(p, GL.LINK_STATUS)) { console.warn("link:", GL.getProgramInfoLog(p)); return null; }
      const names = ["u_res", "u_time", "u_c1", "u_c2", "u_speed", "u_intensity", "u_scale", "u_aber", "u_pulse", "u_mouse", "u_flags"];
      const u: Record<string, WebGLUniformLocation | null> = {};
      names.forEach((n) => { u[n] = GL.getUniformLocation(p, n); });
      GL.useProgram(p);
      const loc = GL.getAttribLocation(p, "a_pos");
      GL.enableVertexAttribArray(loc);
      GL.vertexAttribPointer(loc, 2, GL.FLOAT, false, 0, 0);
      const entry = { p, u };
      programs.set(id, entry);
      return entry;
    };

    const buf = GL.createBuffer();
    GL.bindBuffer(GL.ARRAY_BUFFER, buf);
    GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), GL.STATIC_DRAW);

    let current = build(cfg.current.shader) || build("blackhole");
    let activeId = cfg.current.shader;
    if (!current) { setFailed(true); return; }

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0, frames = 0, lastFps = performance.now();
    const start = performance.now();
    let lastW = 0, lastH = 0;

    const resize = () => {
      const c = cfg.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * c.quality;
      const w = Math.max(2, Math.floor(window.innerWidth * dpr));
      const h = Math.max(2, Math.floor(window.innerHeight * dpr));
      if (w !== lastW || h !== lastH) {
        canvas.width = w; canvas.height = h; lastW = w; lastH = h;
        GL.viewport(0, 0, w, h);
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      if (document.hidden || hiddenRef.current) return;
      if (c.shader !== activeId) {
        const next = build(c.shader);
        if (next) { current = next; activeId = c.shader; }
        else { activeId = c.shader; }
      }
      if (!current) return;
      resize();
      GL.useProgram(current.p);
      GL.bindBuffer(GL.ARRAY_BUFFER, buf);
      const loc = GL.getAttribLocation(current.p, "a_pos");
      GL.enableVertexAttribArray(loc);
      GL.vertexAttribPointer(loc, 2, GL.FLOAT, false, 0, 0);

      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      const now = performance.now();
      const age = (now - pulseAt.current) / 900;
      const pw = age >= 0 && age <= 1 ? 1 - age : 0;
      const a = hexToRgb(c.accent), b = hexToRgb(c.accent2);
      const u = current.u;
      GL.uniform2f(u.u_res, canvas.width, canvas.height);
      GL.uniform1f(u.u_time, (now - start) / 1000);
      GL.uniform3f(u.u_c1, a.r / 255, a.g / 255, a.b / 255);
      GL.uniform3f(u.u_c2, b.r / 255, b.g / 255, b.b / 255);
      GL.uniform1f(u.u_speed, c.shaderSpeed / 100);
      GL.uniform1f(u.u_intensity, c.shaderIntensity / 100);
      GL.uniform1f(u.u_scale, c.shaderScale / 100);
      GL.uniform1f(u.u_aber, c.aberration / 100);
      GL.uniform1f(u.u_pulse, pw);
      GL.uniform2f(u.u_mouse, mouse.x, mouse.y);
      GL.uniform4f(u.u_flags, c.disk ? 1 : 0, c.lens ? 1 : 0, c.stars ? 1 : 0, c.parallax ? 1 : 0);
      GL.drawArrays(GL.TRIANGLES, 0, 6);

      frames++;
      if (now - lastFps > 700) {
        useUI.getState().setFps(Math.round((frames * 1000) / (now - lastFps)));
        frames = 0; lastFps = now;
      }
    };
    raf = requestAnimationFrame(loop);

    const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("webglcontextlost", onLost);
      programs.forEach(({ p }) => GL.deleteProgram(p));
      GL.deleteBuffer(buf); GL.deleteShader(vs);
      const ext = GL.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, []);

  const filter = `hue-rotate(${s.hue}deg) saturate(${s.saturation}%) ${s.invert ? "invert(1)" : ""}`;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: "var(--bg)" }}>
      {!failed ? (
        <canvas
          ref={canvasRef}
          className="h-full w-full transition-opacity duration-700"
          style={{ filter, opacity: s.shaderOn && !stealth ? 1 : 0 }}
        />
      ) : (
        <div
          className="h-full w-full"
          style={{ background: `radial-gradient(circle at 50% 45%, ${s.accent}22, transparent 55%), radial-gradient(circle at 80% 80%, ${s.accent2}18, transparent 50%), var(--bg)`, filter }}
        />
      )}
      {s.fxBloom > 0 && s.shaderOn && !stealth && (
        <div
          className="pointer-events-none absolute inset-0 mix-blend-screen"
          style={{ background: `radial-gradient(ellipse at 50% 50%, ${s.accent}${Math.round(s.fxBloom * 0.22).toString(16).padStart(2, "0")}, transparent 62%)` }}
        />
      )}
    </div>
  );
}

/** WebAudio engine: UI click synthesis + 16 generative ambience layers. */
export type LayerId =
  | "drone" | "rain" | "wind" | "bells" | "binaural" | "sub"
  | "brown" | "pink" | "ocean" | "thunder" | "fire" | "cafe"
  | "vinyl" | "bowl" | "gamma" | "stream" | "birds" | "crickets" | "heartbeat" | "shimmer";

type Voice = { gain: GainNode; nodes: AudioScheduledSourceNode[]; level: number; timers: number[] };

class Engine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  private noise: AudioBuffer | null = null;
  private brownBuf: AudioBuffer | null = null;
  private pinkBuf: AudioBuffer | null = null;
  private layers = new Map<LayerId, Voice>();

  ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.master.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      } catch { return null; }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private buf(kind: "white" | "brown" | "pink"): AudioBuffer | null {
    const ctx = this.ctx; if (!ctx) return null;
    if (kind === "white" && this.noise) return this.noise;
    if (kind === "brown" && this.brownBuf) return this.brownBuf;
    if (kind === "pink" && this.pinkBuf) return this.pinkBuf;
    const len = ctx.sampleRate * 3;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    if (kind === "brown") {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
      this.brownBuf = b;
    } else if (kind === "pink") {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      this.pinkBuf = b;
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    return b;
  }

  click(opts: { wave: string; pitch: number; volume: number; variation: number }) {
    if (opts.wave === "none" || opts.volume <= 0) return;
    const ctx = this.ensure(); if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const jitter = (Math.random() - 0.5) * 2 * (opts.variation / 100) * opts.pitch;
    const freq = Math.max(40, opts.pitch + jitter);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, opts.volume / 100), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    g.connect(this.master);
    if (opts.wave === "noise") {
      const src = ctx.createBufferSource();
      src.buffer = this.buf("white");
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 4;
      src.connect(bp).connect(g);
      src.start(now); src.stop(now + 0.1);
    } else {
      const osc = ctx.createOscillator();
      osc.type = (["sine", "square", "sawtooth", "triangle"].includes(opts.wave) ? opts.wave : "sine") as OscillatorType;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.7), now + 0.09);
      osc.connect(g);
      osc.start(now); osc.stop(now + 0.1);
    }
  }

  blip(freq = 880, dur = 0.06, vol = 0.05, type: OscillatorType = "triangle") {
    const ctx = this.ensure(); if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    g.connect(this.master);
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    o.connect(g); o.start(now); o.stop(now + dur + 0.02);
  }

  setMaster(v: number) { const ctx = this.ensure(); if (ctx && this.master) this.master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); }

  private noiseVoice(
    ctx: AudioContext, out: GainNode, kind: "white" | "brown" | "pink",
    filter: { type: BiquadFilterType; freq: number; q?: number },
    lfo?: { rate: number; depth: number }, gain = 1
  ): AudioScheduledSourceNode[] {
    const src = ctx.createBufferSource();
    src.buffer = this.buf(kind);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter.type; f.frequency.value = filter.freq; f.Q.value = filter.q ?? 0.8;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(out);
    src.start();
    const nodes: AudioScheduledSourceNode[] = [src];
    if (lfo) {
      const l = ctx.createOscillator(); const lg = ctx.createGain();
      l.frequency.value = lfo.rate; lg.gain.value = lfo.depth;
      l.connect(lg).connect(f.frequency); l.start();
      nodes.push(l);
    }
    return nodes;
  }

  setLayer(id: LayerId, level: number) {
    const ctx = this.ensure(); if (!ctx || !this.master) return;
    const existing = this.layers.get(id);
    if (existing) {
      existing.level = level;
      existing.gain.gain.setTargetAtTime(level * 0.5, ctx.currentTime, 0.4);
      if (level <= 0) {
        window.setTimeout(() => {
          const cur = this.layers.get(id);
          if (cur && cur.level <= 0) {
            cur.nodes.forEach((n) => { try { n.stop(); } catch { /* stopped */ } });
            cur.timers.forEach((t) => window.clearInterval(t));
            this.layers.delete(id);
          }
        }, 1200);
      }
      return;
    }
    if (level <= 0) return;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    gain.gain.setTargetAtTime(level * 0.5, ctx.currentTime, 0.6);
    let nodes: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];

    switch (id) {
      case "drone": {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 620; lp.Q.value = 2;
        lp.connect(gain);
        [55, 82.5, 110.3, 164.8].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = i % 2 ? "sine" : "triangle";
          o.frequency.value = f; o.detune.value = (i - 1.5) * 7;
          const g2 = ctx.createGain(); g2.gain.value = 0.22;
          o.connect(g2).connect(lp); o.start(); nodes.push(o);
        });
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.frequency.value = 0.06; lg.gain.value = 220;
        lfo.connect(lg).connect(lp.frequency); lfo.start(); nodes.push(lfo);
        break;
      }
      case "shimmer": {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 2200;
        lp.connect(gain);
        [392, 587.33, 784, 1174.66, 1568].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = f;
          o.detune.value = (Math.random() - 0.5) * 9;
          const g2 = ctx.createGain(); g2.gain.value = 0.13 / (i + 1);
          o.connect(g2).connect(lp); o.start(); nodes.push(o);
        });
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.frequency.value = 0.045; lg.gain.value = 1300;
        lfo.connect(lg).connect(lp.frequency); lfo.start(); nodes.push(lfo);
        break;
      }
      case "rain":
        nodes = this.noiseVoice(ctx, gain, "white", { type: "bandpass", freq: 2400, q: 0.6 }, { rate: 0.2, depth: 500 }, 0.9);
        break;
      case "wind":
        nodes = this.noiseVoice(ctx, gain, "brown", { type: "lowpass", freq: 420, q: 1.2 }, { rate: 0.08, depth: 240 }, 1.1);
        break;
      case "brown":
        nodes = this.noiseVoice(ctx, gain, "brown", { type: "lowpass", freq: 900 }, undefined, 1.2);
        break;
      case "pink":
        nodes = this.noiseVoice(ctx, gain, "pink", { type: "lowpass", freq: 6000 }, undefined, 1.0);
        break;
      case "stream":
        nodes = [
          ...this.noiseVoice(ctx, gain, "white", { type: "bandpass", freq: 1400, q: 1.4 }, { rate: 0.7, depth: 600 }, 0.5),
          ...this.noiseVoice(ctx, gain, "pink", { type: "highpass", freq: 800 }, { rate: 1.3, depth: 300 }, 0.4),
        ];
        break;
      case "ocean": {
        nodes = this.noiseVoice(ctx, gain, "brown", { type: "lowpass", freq: 700, q: 0.9 }, undefined, 1.3);
        const swell = ctx.createOscillator(); const sg = ctx.createGain();
        swell.frequency.value = 0.09; sg.gain.value = 0.42;
        const vca = ctx.createGain(); vca.gain.value = 0.55;
        swell.connect(sg).connect(vca.gain);
        vca.connect(gain); swell.start(); nodes.push(swell);
        break;
      }
      case "thunder": {
        nodes = this.noiseVoice(ctx, gain, "brown", { type: "lowpass", freq: 220 }, undefined, 0.35);
        const rumble = () => {
          const cur = this.layers.get("thunder");
          if (!cur || cur.level <= 0 || !this.ctx) return;
          const t = this.ctx.currentTime;
          const src = this.ctx.createBufferSource();
          src.buffer = this.buf("brown");
          const f = this.ctx.createBiquadFilter();
          f.type = "lowpass"; f.frequency.setValueAtTime(300, t);
          f.frequency.exponentialRampToValueAtTime(60, t + 2.6);
          const g2 = this.ctx.createGain();
          g2.gain.setValueAtTime(0.0001, t);
          g2.gain.exponentialRampToValueAtTime(cur.level * 0.9, t + 0.25);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
          src.connect(f).connect(g2).connect(gain);
          src.start(t); src.stop(t + 3.4);
        };
        timers.push(window.setInterval(() => { if (Math.random() > 0.45) rumble(); }, 6500));
        break;
      }
      case "fire": {
        nodes = this.noiseVoice(ctx, gain, "brown", { type: "lowpass", freq: 620 }, { rate: 0.4, depth: 180 }, 0.55);
        const crackle = () => {
          const cur = this.layers.get("fire");
          if (!cur || cur.level <= 0 || !this.ctx) return;
          const t = this.ctx.currentTime;
          const src = this.ctx.createBufferSource();
          src.buffer = this.buf("white");
          const f = this.ctx.createBiquadFilter();
          f.type = "bandpass"; f.frequency.value = 1400 + Math.random() * 2600; f.Q.value = 6;
          const g2 = this.ctx.createGain();
          g2.gain.setValueAtTime(cur.level * (0.12 + Math.random() * 0.3), t);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + Math.random() * 0.08);
          src.connect(f).connect(g2).connect(gain);
          src.start(t); src.stop(t + 0.2);
        };
        timers.push(window.setInterval(crackle, 130));
        break;
      }
      case "birds": {
        const chirp = () => {
          const cur = this.layers.get("birds");
          if (!cur || cur.level <= 0 || !this.ctx) return;
          if (Math.random() > 0.72) return;
          const t = this.ctx.currentTime;
          const o = this.ctx.createOscillator();
          const g2 = this.ctx.createGain();
          const pan = this.ctx.createStereoPanner();
          o.type = "sine";
          const base = 1500 + Math.random() * 1200;
          o.frequency.setValueAtTime(base, t);
          o.frequency.exponentialRampToValueAtTime(base * (1.12 + Math.random() * 0.2), t + 0.09);
          o.frequency.exponentialRampToValueAtTime(base * (0.84 + Math.random() * 0.1), t + 0.24);
          pan.pan.value = Math.random() * 1.6 - 0.8;
          g2.gain.setValueAtTime(0.0001, t);
          g2.gain.exponentialRampToValueAtTime(cur.level * 0.22, t + 0.035);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
          o.connect(g2).connect(pan).connect(gain);
          o.start(t); o.stop(t + 0.31);
        };
        timers.push(window.setInterval(chirp, 430));
        break;
      }
      case "crickets": {
        const chirp = () => {
          const cur = this.layers.get("crickets");
          if (!cur || cur.level <= 0 || !this.ctx || Math.random() > 0.8) return;
          const t = this.ctx.currentTime;
          const count = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count; i++) {
            const o = this.ctx.createOscillator();
            const g2 = this.ctx.createGain();
            const pan = this.ctx.createStereoPanner();
            const start = t + i * 0.055;
            o.type = "sine";
            o.frequency.value = 3600 + Math.random() * 500;
            pan.pan.value = Math.random() * 1.4 - 0.7;
            g2.gain.setValueAtTime(0.0001, start);
            g2.gain.exponentialRampToValueAtTime(cur.level * 0.07, start + 0.008);
            g2.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);
            o.connect(g2).connect(pan).connect(gain);
            o.start(start); o.stop(start + 0.06);
          }
        };
        timers.push(window.setInterval(chirp, 620));
        break;
      }
      case "heartbeat": {
        const thump = (at: number, freq: number, strength: number) => {
          const o = ctx.createOscillator();
          const f = ctx.createBiquadFilter();
          const g2 = ctx.createGain();
          o.type = "sine"; o.frequency.setValueAtTime(freq, at); o.frequency.exponentialRampToValueAtTime(34, at + 0.14);
          f.type = "lowpass"; f.frequency.value = 180;
          g2.gain.setValueAtTime(0.0001, at);
          g2.gain.exponentialRampToValueAtTime(strength, at + 0.018);
          g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.19);
          o.connect(f).connect(g2).connect(gain);
          o.start(at); o.stop(at + 0.21);
        };
        const beat = () => {
          const cur = this.layers.get("heartbeat");
          if (!cur || cur.level <= 0 || !this.ctx) return;
          const t = this.ctx.currentTime;
          thump(t, 74, cur.level * 0.46);
          thump(t + 0.18, 58, cur.level * 0.28);
        };
        beat();
        timers.push(window.setInterval(beat, 960));
        break;
      }
      case "cafe": {
        nodes = this.noiseVoice(ctx, gain, "pink", { type: "bandpass", freq: 700, q: 0.5 }, { rate: 0.15, depth: 200 }, 0.7);
        const murmur = () => {
          const cur = this.layers.get("cafe");
          if (!cur || cur.level <= 0 || !this.ctx) return;
          const t = this.ctx.currentTime;
          const o = this.ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = 110 + Math.random() * 160;
          const f = this.ctx.createBiquadFilter();
          f.type = "bandpass"; f.frequency.value = 500 + Math.random() * 900; f.Q.value = 5;
          const g2 = this.ctx.createGain();
          const dur = 0.18 + Math.random() * 0.4;
          g2.gain.setValueAtTime(0.0001, t);
          g2.gain.exponentialRampToValueAtTime(cur.level * 0.09, t + 0.06);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(f).connect(g2).connect(gain);
          o.start(t); o.stop(t + dur + 0.05);
        };
        timers.push(window.setInterval(murmur, 420));
        break;
      }
      case "vinyl": {
        nodes = this.noiseVoice(ctx, gain, "pink", { type: "highpass", freq: 1800 }, undefined, 0.12);
        const pop = () => {
          const cur = this.layers.get("vinyl");
          if (!cur || cur.level <= 0 || !this.ctx) return;
          const t = this.ctx.currentTime;
          const src = this.ctx.createBufferSource();
          src.buffer = this.buf("white");
          const g2 = this.ctx.createGain();
          g2.gain.setValueAtTime(cur.level * (0.1 + Math.random() * 0.25), t);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
          src.connect(g2).connect(gain);
          src.start(t); src.stop(t + 0.04);
        };
        timers.push(window.setInterval(() => { if (Math.random() > 0.55) pop(); }, 90));
        break;
      }
      case "bowl": {
        const partials = [174, 261.6, 392, 523.3];
        const strike = () => {
          const cur = this.layers.get("bowl");
          if (!cur || cur.level <= 0 || !this.ctx) return;
          const t = this.ctx.currentTime;
          partials.forEach((p, i) => {
            const o = this.ctx!.createOscillator();
            o.type = "sine";
            o.frequency.value = p * (1 + (Math.random() - 0.5) * 0.004);
            const g2 = this.ctx!.createGain();
            g2.gain.setValueAtTime(0.0001, t);
            g2.gain.exponentialRampToValueAtTime((cur.level * 0.3) / (i + 1), t + 0.05);
            g2.gain.exponentialRampToValueAtTime(0.0001, t + 6 - i);
            o.connect(g2).connect(gain);
            o.start(t); o.stop(t + 6.2);
          });
        };
        strike();
        timers.push(window.setInterval(strike, 9000));
        break;
      }
      case "bells": {
        const scale = [261.6, 311.1, 349.2, 392, 466.2, 523.3, 622.3];
        const strike = () => {
          const cur = this.layers.get("bells");
          if (!cur || cur.level <= 0 || !this.ctx) return;
          const t = this.ctx.currentTime;
          const o = this.ctx.createOscillator(); const g2 = this.ctx.createGain();
          o.type = "sine";
          o.frequency.value = scale[Math.floor(Math.random() * scale.length)] * (Math.random() > 0.6 ? 2 : 1);
          g2.gain.setValueAtTime(0.0001, t);
          g2.gain.exponentialRampToValueAtTime(cur.level * 0.35, t + 0.02);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
          o.connect(g2).connect(gain);
          o.start(t); o.stop(t + 3.4);
        };
        strike();
        timers.push(window.setInterval(strike, 3400));
        break;
      }
      case "binaural": {
        [200, 206.5].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
          const pan = ctx.createStereoPanner(); pan.pan.value = i ? 1 : -1;
          const g2 = ctx.createGain(); g2.gain.value = 0.3;
          o.connect(g2).connect(pan).connect(gain); o.start(); nodes.push(o);
        });
        break;
      }
      case "gamma": {
        const carrier = ctx.createOscillator(); carrier.type = "sine"; carrier.frequency.value = 320;
        const amp = ctx.createGain(); amp.gain.value = 0.18;
        const mod = ctx.createOscillator(); mod.type = "sine"; mod.frequency.value = 40;
        const mg = ctx.createGain(); mg.gain.value = 0.16;
        mod.connect(mg).connect(amp.gain);
        carrier.connect(amp).connect(gain);
        carrier.start(); mod.start();
        nodes.push(carrier, mod);
        break;
      }
      case "sub": {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 38;
        const trem = ctx.createOscillator(); const tg = ctx.createGain();
        trem.frequency.value = 0.15; tg.gain.value = 0.35;
        const vg = ctx.createGain(); vg.gain.value = 0.6;
        trem.connect(tg).connect(vg.gain);
        o.connect(vg).connect(gain); o.start(); trem.start();
        nodes.push(o, trem);
        break;
      }
    }
    this.layers.set(id, { gain, nodes, level, timers });
  }

  levels(): Record<string, number> {
    const out: Record<string, number> = {};
    this.layers.forEach((v, k) => { out[k] = v.level; });
    return out;
  }

  stopAll() {
    this.layers.forEach((l) => {
      l.nodes.forEach((n) => { try { n.stop(); } catch { /* stopped */ } });
      l.timers.forEach((t) => window.clearInterval(t));
    });
    this.layers.clear();
  }

  spectrum(): Uint8Array {
    if (!this.analyser) return new Uint8Array(64);
    const arr = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(arr as any);
    return arr;
  }
}

export const audio = new Engine();
export const clickSound = (s: { sound: boolean; wave: string; pitch: number; volume: number; variation: number }) => {
  if (!s.sound) return;
  audio.click(s);
};
export const buzz = (on: boolean, ms = 8) => {
  if (on && "vibrate" in navigator) { try { navigator.vibrate(ms); } catch { /* unsupported */ } }
};

// WebAudio-synthesised sound — no asset files. Everything is tiny oscillator
// envelopes plus noise bursts, with per-sound throttling so gunfire spam
// doesn't tear the mix apart.

type SfxName =
  | "lance" | "cryo" | "mortar" | "boom" | "arc" | "laser" | "kill" | "leak"
  | "place" | "sell" | "select" | "error" | "upgrade" | "wave"
  | "victory" | "defeat" | "click";

const MIN_GAP: Record<SfxName, number> = {
  lance: 70, cryo: 520, mortar: 130, boom: 80, arc: 90, laser: 400, kill: 45, leak: 120,
  place: 0, sell: 0, select: 0, error: 0, upgrade: 0, wave: 0,
  victory: 0, defeat: 0, click: 40,
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastAt = new Map<string, number>();
  muted = false;

  ensure(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  private startAmbient(): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = 47;
    const o2 = ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = 94.6;
    const o2g = ctx.createGain();
    o2g.gain.value = 0.4;
    o1.connect(lp);
    o2.connect(o2g);
    o2g.connect(lp);
    // slow breathing LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    g.connect(this.master!);
    o1.start();
    o2.start();
    lfo.start();
    void g; // kept alive by the running oscillators
  }

  sfx(name: SfxName): void {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    const last = this.lastAt.get(name) ?? -1e9;
    if (now - last < MIN_GAP[name]) return;
    this.lastAt.set(name, now);

    switch (name) {
      case "lance":
        this.tone(1150, 0.05, "square", 0.035, 780);
        break;
      case "cryo":
        this.tone(1750, 0.14, "sine", 0.05, 1200);
        this.tone(2350, 0.1, "sine", 0.03, 1800, 0.04);
        break;
      case "mortar":
        this.tone(190, 0.14, "sawtooth", 0.09, 70);
        break;
      case "boom":
        this.noise(0.24, 0.26, 340);
        this.tone(72, 0.22, "sine", 0.16, 42);
        break;
      case "arc":
        this.noise(0.07, 0.16, 2800);
        this.tone(1900 + Math.random() * 700, 0.06, "square", 0.03, 900);
        break;
      case "laser":
        this.tone(86, 0.5, "sawtooth", 0.07, 96);
        this.tone(91.5, 0.5, "sawtooth", 0.05, 84, 0.02);
        this.tone(2600, 0.35, "sine", 0.02, 2200, 0.05);
        break;
      case "kill":
        this.tone(330, 0.11, "triangle", 0.075, 90);
        break;
      case "leak":
        this.tone(150, 0.5, "sawtooth", 0.16, 52);
        this.noise(0.3, 0.14, 500);
        break;
      case "place":
        this.tone(660, 0.06, "square", 0.06);
        this.tone(990, 0.07, "square", 0.05, 1040, 0.06);
        break;
      case "sell":
        this.tone(520, 0.09, "square", 0.06, 320);
        break;
      case "select":
        this.tone(880, 0.035, "sine", 0.05);
        break;
      case "error":
        this.tone(150, 0.12, "square", 0.07, 120);
        break;
      case "upgrade":
        this.tone(700, 0.055, "square", 0.05);
        this.tone(1050, 0.055, "square", 0.05, 1080, 0.06);
        this.tone(1400, 0.08, "square", 0.05, 1450, 0.12);
        break;
      case "wave":
        this.tone(220, 0.4, "sawtooth", 0.07, 660);
        break;
      case "victory": {
        const notes = [523, 659, 784, 1046];
        notes.forEach((f, i) => this.tone(f, 0.5, "triangle", 0.07, f, i * 0.09));
        break;
      }
      case "defeat":
        this.tone(330, 0.8, "sawtooth", 0.12, 55);
        this.noise(0.6, 0.2, 220);
        break;
      case "click":
        this.tone(760, 0.03, "sine", 0.04);
        break;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, delay = 0): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, gain: number, filterFreq: number): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(t0);
  }
}

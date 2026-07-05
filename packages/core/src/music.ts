/**
 * Procedural music: a WebAudio step sequencer that synthesizes a looping
 * track from a 16-step pattern — no audio files to license or bundle.
 * Uses the standard lookahead-scheduling pattern so timing stays tight
 * even when the main thread hitches.
 */

export interface MusicPattern {
  bpm: number;
  /** 16 steps each; note frequencies in Hz or null for rests. */
  bass: ReadonlyArray<number | null>;
  lead: ReadonlyArray<number | null>;
  kick: ReadonlyArray<boolean>;
  hat: ReadonlyArray<boolean>;
}

const STEPS = 16;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private delay: DelayNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;

  constructor(
    private readonly pattern: MusicPattern,
    private readonly volume = 0.12,
  ) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null) return;
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      if (ctx.state === "suspended") void ctx.resume();

      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(ctx.destination);

      // Feedback delay gives the lead line space without extra voices.
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = (60 / this.pattern.bpm) * 0.75;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.3;
      this.delay.connect(feedback).connect(this.delay);
      this.delay.connect(this.master);

      if (!this.noiseBuffer) {
        const len = Math.floor(ctx.sampleRate * 0.1);
        this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }

      this.step = 0;
      this.nextTime = ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
    } catch {
      // No audio available — the game keeps working silently.
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.master?.disconnect();
    this.master = null;
    this.delay = null;
  }

  /** Returns true when music is playing after the toggle. */
  toggle(): boolean {
    if (this.playing) this.stop();
    else this.start();
    return this.playing;
  }

  private scheduler(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this.scheduleStep(this.step, this.nextTime);
      this.step = (this.step + 1) % STEPS;
      this.nextTime += 60 / this.pattern.bpm / 4; // 16th notes
    }
  }

  private scheduleStep(step: number, t: number): void {
    const p = this.pattern;
    if (p.kick[step]) this.playKick(t);
    if (p.hat[step]) this.playHat(t);
    const bass = p.bass[step];
    if (bass != null) this.playBass(bass, t);
    const lead = p.lead[step];
    if (lead != null) this.playLead(lead, t);
  }

  private env(t: number, peak: number, decaySec: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decaySec);
    return g;
  }

  private playKick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const g = this.env(t, 1.0, 0.14);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private playHat(t: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = this.env(t, 0.25, 0.04);
    src.connect(hp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.05);
  }

  private playBass(freq: number, t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    const g = this.env(t, 0.5, 0.12);
    osc.connect(lp).connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  private playLead(freq: number, t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const g = this.env(t, 0.16, 0.16);
    osc.connect(g);
    g.connect(this.master!);
    if (this.delay) g.connect(this.delay);
    osc.start(t);
    osc.stop(t + 0.17);
  }
}

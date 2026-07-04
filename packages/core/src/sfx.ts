/**
 * Tiny WebAudio synth so the game has feedback sounds with zero audio assets.
 * Lazily creates the AudioContext on first use (requires a user gesture on iOS).
 */
class Sfx {
  private ctx: AudioContext | null = null;

  private beep(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.08): void {
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Audio is a nice-to-have; never let it break the game.
    }
  }

  place(): void {
    this.beep(220, 80, "triangle");
  }

  clear(lines: number): void {
    this.beep(440 + lines * 110, 200, "square", 0.06);
  }

  gameOver(): void {
    this.beep(180, 350, "sawtooth", 0.05);
  }
}

export const sfx = new Sfx();

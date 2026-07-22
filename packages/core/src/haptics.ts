/**
 * Haptic feedback via the Vibration API: works on Android browsers and
 * Capacitor WebViews today, and silently no-ops where unsupported (iOS web,
 * desktop). Native Capacitor Haptics can later plug into the same calls.
 */
class Haptics {
  private enabled = true;

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  private buzz(pattern: number | number[]): void {
    if (!this.enabled) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Vibration is a nice-to-have; never let it break the game.
    }
  }

  /** Light tick — jumps, taps, pickups. */
  tap(): void {
    this.buzz(8);
  }

  /** Heavy thump — crashes. */
  thud(): void {
    this.buzz([0, 40, 30, 20]);
  }

  /** Celebration triple — level complete. */
  win(): void {
    this.buzz([0, 20, 40, 20, 40, 60]);
  }
}

export const haptics = new Haptics();

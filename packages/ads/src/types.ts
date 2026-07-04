export interface AdsConfig {
  /** AdMob ad unit IDs. Use Google's public test IDs until store launch. */
  interstitialAdUnitId: string;
  rewardedAdUnitId: string;
  /** Serve test ads and register test devices; must be true pre-launch. */
  testMode: boolean;
  /** Minimum seconds between interstitials (frequency cap). */
  interstitialCooldownSec?: number;
}

export interface AdsService {
  /**
   * Show an interstitial if one is loaded and the cooldown has elapsed.
   * Resolves once the ad is dismissed (or immediately if skipped).
   */
  maybeShowInterstitial(): Promise<void>;

  /** Whether a rewarded ad is loaded and ready to present. */
  isRewardedReady(): boolean;

  /**
   * Show a rewarded ad. Resolves true iff the user earned the reward.
   * Callers grant the in-game reward only on true.
   */
  showRewarded(): Promise<boolean>;
}

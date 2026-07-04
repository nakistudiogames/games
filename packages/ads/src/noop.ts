import type { AdsService } from "./types";

/** Web/dev implementation: no ads, rewarded always succeeds. */
export class NoopAds implements AdsService {
  async maybeShowInterstitial(): Promise<void> {}

  isRewardedReady(): boolean {
    return true;
  }

  async showRewarded(): Promise<boolean> {
    return true;
  }
}

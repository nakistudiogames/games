import { createAdsService, type AdsService } from "@mg/ads";

/**
 * Google's public test ad unit IDs — replaced with real units at store launch.
 * testMode must stay true until then (AdMob bans accounts for live self-clicks).
 */
export const adsReady: Promise<AdsService> = createAdsService({
  interstitialAdUnitId: "ca-app-pub-3940256099942544/1033173712",
  rewardedAdUnitId: "ca-app-pub-3940256099942544/5224354917",
  testMode: true,
  interstitialCooldownSec: 90,
});

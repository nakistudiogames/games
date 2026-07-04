import { Capacitor } from "@capacitor/core";
import { NoopAds } from "./noop";

export type { AdsService, AdsConfig } from "./types";
import type { AdsService, AdsConfig } from "./types";

/**
 * Returns the platform-appropriate ads implementation.
 * Web/dev builds get a no-op so games are fully playable in a browser;
 * native builds lazy-load the AdMob implementation.
 */
export async function createAdsService(config: AdsConfig): Promise<AdsService> {
  if (!Capacitor.isNativePlatform()) {
    return new NoopAds();
  }
  const { AdmobAds } = await import("./admob");
  const ads = new AdmobAds(config);
  await ads.initialize();
  return ads;
}

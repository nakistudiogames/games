import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from "@capacitor-community/admob";
import type { AdsConfig, AdsService } from "./types";

const DEFAULT_INTERSTITIAL_COOLDOWN_SEC = 90;

/**
 * Native AdMob implementation. Only loaded on iOS/Android via dynamic import.
 * NOTE: exercised for real once the Capacitor shells exist (Phase 3);
 * behavior must be validated on physical devices with test ad units.
 */
export class AdmobAds implements AdsService {
  private interstitialReady = false;
  private rewardedReady = false;
  private lastInterstitialAt = 0;

  constructor(private readonly config: AdsConfig) {}

  async initialize(): Promise<void> {
    await AdMob.initialize({});

    // Google UMP consent (required for GDPR regions and by App Store review).
    const consentInfo = await AdMob.requestConsentInfo();
    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === AdmobConsentStatus.REQUIRED
    ) {
      await AdMob.showConsentForm();
    }

    AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      this.interstitialReady = false;
      void this.preloadInterstitial();
    });
    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      this.rewardedReady = false;
      void this.preloadRewarded();
    });

    await Promise.allSettled([this.preloadInterstitial(), this.preloadRewarded()]);
  }

  private async preloadInterstitial(): Promise<void> {
    try {
      await AdMob.prepareInterstitial({
        adId: this.config.interstitialAdUnitId,
        isTesting: this.config.testMode,
      });
      this.interstitialReady = true;
    } catch {
      this.interstitialReady = false;
    }
  }

  private async preloadRewarded(): Promise<void> {
    try {
      await AdMob.prepareRewardVideoAd({
        adId: this.config.rewardedAdUnitId,
        isTesting: this.config.testMode,
      });
      this.rewardedReady = true;
    } catch {
      this.rewardedReady = false;
    }
  }

  async maybeShowInterstitial(): Promise<void> {
    const cooldownMs =
      (this.config.interstitialCooldownSec ?? DEFAULT_INTERSTITIAL_COOLDOWN_SEC) * 1000;
    if (!this.interstitialReady || Date.now() - this.lastInterstitialAt < cooldownMs) {
      return;
    }
    this.lastInterstitialAt = Date.now();
    try {
      await AdMob.showInterstitial();
    } catch {
      this.interstitialReady = false;
      void this.preloadInterstitial();
    }
  }

  isRewardedReady(): boolean {
    return this.rewardedReady;
  }

  async showRewarded(): Promise<boolean> {
    if (!this.rewardedReady) return false;
    return new Promise<boolean>((resolve) => {
      let earned = false;
      const rewardedListener = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        earned = true;
      });
      const dismissedListener = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        void rewardedListener.then((h) => h.remove());
        void dismissedListener.then((h) => h.remove());
        resolve(earned);
      });
      AdMob.showRewardVideoAd().catch(() => {
        void rewardedListener.then((h) => h.remove());
        void dismissedListener.then((h) => h.remove());
        this.rewardedReady = false;
        void this.preloadRewarded();
        resolve(false);
      });
    });
  }
}

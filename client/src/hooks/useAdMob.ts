import { useEffect, useRef, useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  AdOptions,
  BannerAdOptions,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  RewardAdOptions,
  RewardAdPluginEvents,
} from "@capacitor-community/admob";
import { AD_EARLY_DISMISS_SECONDS } from "@shared/predictionOdds";
import { getFullUrl } from "@/lib/queryClient";

const IS_TESTING = import.meta.env.DEV;

const FALLBACK_AD_ID_ANDROID =
  import.meta.env.VITE_ADMOB_AD_ID_ANDROID ||
  "ca-app-pub-3940256099942544/1033173712";
const FALLBACK_AD_ID_IOS =
  import.meta.env.VITE_ADMOB_AD_ID_IOS ||
  "ca-app-pub-3940256099942544/4411468910";

interface RuntimeAdConfig {
  androidInterstitialAdUnitId: string;
  iosInterstitialAdUnitId: string;
  androidRewardedAdUnitId?: string;
  iosRewardedAdUnitId?: string;
  androidBannerAdUnitId?: string;
  iosBannerAdUnitId?: string;
}

let runtimeAdConfig: RuntimeAdConfig | null = null;
let runtimeAdConfigPromise: Promise<void> | null = null;

async function loadRuntimeAdConfig(): Promise<void> {
  if (runtimeAdConfig) return;
  if (runtimeAdConfigPromise) {
    await runtimeAdConfigPromise;
    return;
  }
  runtimeAdConfigPromise = (async () => {
    try {
      const res = await fetch(getFullUrl("/api/config/admob"));
      if (res.ok) {
        runtimeAdConfig = await res.json();
      }
    } catch (error) {
      console.warn("[AdMob] Runtime config load failed:", error);
    }
  })();
  await runtimeAdConfigPromise;
}

function warnIfProductionAdIdsMissing() {
  if (import.meta.env.DEV || !Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform();
  const fromRuntime =
    platform === "ios"
      ? runtimeAdConfig?.iosInterstitialAdUnitId
      : runtimeAdConfig?.androidInterstitialAdUnitId;
  const fromEnv =
    platform === "ios"
      ? import.meta.env.VITE_ADMOB_AD_ID_IOS
      : import.meta.env.VITE_ADMOB_AD_ID_ANDROID;
  if (!fromRuntime?.trim() && !fromEnv) {
    console.warn(
      "[AdMob] 광고 단위 ID 미설정 — 테스트 ID 사용 중. 관리자 → 동영상 광고 수익 현황에서 앱 광고 단위를 선택하세요.",
    );
  }
}

function getAdId(): string {
  const platform = Capacitor.getPlatform();
  const fromRuntime =
    platform === "ios"
      ? runtimeAdConfig?.iosInterstitialAdUnitId?.trim()
      : runtimeAdConfig?.androidInterstitialAdUnitId?.trim();
  if (fromRuntime) return fromRuntime;

  if (platform === "ios") {
    return import.meta.env.VITE_ADMOB_AD_ID_IOS?.trim() || FALLBACK_AD_ID_IOS;
  }
  return import.meta.env.VITE_ADMOB_AD_ID_ANDROID?.trim() || FALLBACK_AD_ID_ANDROID;
}

function getRewardedAdId(): string {
  const platform = Capacitor.getPlatform();
  const fromRuntime =
    platform === "ios"
      ? runtimeAdConfig?.iosRewardedAdUnitId?.trim()
      : runtimeAdConfig?.androidRewardedAdUnitId?.trim();
  if (fromRuntime) return fromRuntime;
  return platform === "ios"
    ? "ca-app-pub-3940256099942544/1712485313"
    : "ca-app-pub-3940256099942544/5224354917";
}

function getBannerAdId(): string {
  const platform = Capacitor.getPlatform();
  const fromRuntime =
    platform === "ios"
      ? runtimeAdConfig?.iosBannerAdUnitId?.trim()
      : runtimeAdConfig?.androidBannerAdUnitId?.trim();
  if (fromRuntime) return fromRuntime;
  return platform === "ios"
    ? "ca-app-pub-3940256099942544/2934735716"
    : "ca-app-pub-3940256099942544/6300978111";
}

export type AdSessionState = "idle" | "preparing" | "showing" | "overlay";

interface UseAdMobResult {
  isAdReady: boolean;
  isAdShowing: boolean;
  adSessionState: AdSessionState;
  isBannerVisible: boolean;
  startAdSession: () => Promise<{ dismissedEarly: boolean }>;
  stopAdSession: () => void;
  preloadAd: () => Promise<void>;
  showBannerAd: () => Promise<void>;
  hideBannerAd: () => Promise<void>;
  showRewardedAd: () => Promise<boolean>;
  isNativePlatform: boolean;
}

export function useAdMob(): UseAdMobResult {
  const [isAdReady, setIsAdReady] = useState(false);
  const [isAdShowing, setIsAdShowing] = useState(false);
  const [adSessionState, setAdSessionState] = useState<AdSessionState>("idle");
  const [isBannerVisible, setIsBannerVisible] = useState(false);

  const isInitialized = useRef(false);
  const isNativePlatform = Capacitor.isNativePlatform();
  const shouldContinueAds = useRef(false);
  const isLoadingAd = useRef(false);
  const isAdReadyRef = useRef(false);
  const interstitialShowedAtRef = useRef<number | null>(null);
  const rewardedGrantedRef = useRef(false);
  // Set to true when FailedToLoad fires so waitForAdReady can return immediately
  const lastLoadFailedRef = useRef(false);

  // Pending resolvers for waitForAdReady()
  const adReadyResolversRef = useRef<Array<(ready: boolean) => void>>([]);

  const resolveAdReady = useCallback((ready: boolean) => {
    const resolvers = adReadyResolversRef.current;
    adReadyResolversRef.current = [];
    for (const resolve of resolvers) {
      resolve(ready);
    }
  }, []);

  const initializeAdMob = useCallback(async () => {
    if (!isNativePlatform || isInitialized.current) return;

    try {
      await loadRuntimeAdConfig();
      await AdMob.initialize({
        initializeForTesting: IS_TESTING,
      });
      isInitialized.current = true;
      warnIfProductionAdIdsMissing();
      console.log("[AdMob] Initialized successfully, adId:", getAdId().slice(0, 20) + "...");
    } catch (error) {
      console.error("[AdMob] Initialization error:", error);
    }
  }, [isNativePlatform]);

  const prepareInterstitialAd = useCallback(async () => {
    if (!isNativePlatform || isLoadingAd.current || isAdReadyRef.current) {
      return;
    }

    lastLoadFailedRef.current = false;

    try {
      isLoadingAd.current = true;
      const options: AdOptions = {
        adId: getAdId(),
        isTesting: IS_TESTING,
      };

      await AdMob.prepareInterstitial(options);
      console.log("[AdMob] prepareInterstitial called");
    } catch (error) {
      console.error("[AdMob] Error preparing interstitial:", error);
      isAdReadyRef.current = false;
      lastLoadFailedRef.current = true;
      setIsAdReady(false);
      isLoadingAd.current = false;
      resolveAdReady(false);
    }
  }, [isNativePlatform, resolveAdReady]);

  // Wait for Loaded (or FailedToLoad) event, with a timeout fallback
  const waitForAdReady = useCallback(
    (timeoutMs = 8000): Promise<boolean> => {
      if (isAdReadyRef.current) {
        return Promise.resolve(true);
      }
      // Already failed before we even registered — return immediately
      if (lastLoadFailedRef.current) {
        console.log("[AdMob] waitForAdReady: already failed, returning false immediately");
        return Promise.resolve(false);
      }
      return new Promise<boolean>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            adReadyResolversRef.current = adReadyResolversRef.current.filter(
              (r) => r !== wrappedResolve
            );
            console.log("[AdMob] waitForAdReady timed out");
            resolve(false);
          }
        }, timeoutMs);

        const wrappedResolve = (ready: boolean) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(ready);
          }
        };
        adReadyResolversRef.current.push(wrappedResolve);
      });
    },
    []
  );

  const showInterstitialAd = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform) {
      return false;
    }

    try {
      setIsAdShowing(true);
      await AdMob.showInterstitial();
      console.log("[AdMob] showInterstitial called");
      return true;
    } catch (error) {
      console.error("[AdMob] Error showing interstitial:", error);
      setIsAdShowing(false);
      return false;
    }
  }, [isNativePlatform]);

  const stopAdSession = useCallback(() => {
    console.log("[AdMob] Stopping ad session");
    shouldContinueAds.current = false;
    setAdSessionState("idle");
    setIsAdShowing(false);
    resolveAdReady(false);
  }, [resolveAdReady]);

  const startAdSession = useCallback(async (): Promise<{ dismissedEarly: boolean }> => {
    if (!isNativePlatform) {
      console.log("[AdMob] Not native platform, overlay mode");
      setAdSessionState("overlay");
      return { dismissedEarly: false };
    }

    console.log("[AdMob] Starting ad session");
    shouldContinueAds.current = true;
    setAdSessionState("preparing");
    interstitialShowedAtRef.current = null;

    if (!isInitialized.current) {
      await initializeAdMob();
    }

    if (!shouldContinueAds.current) {
      console.log("[AdMob] Session cancelled before prepare");
      return { dismissedEarly: true };
    }

    if (isAdReadyRef.current) {
      console.log("[AdMob] Ad already ready, showing immediately");
      setAdSessionState("showing");
      interstitialShowedAtRef.current = Date.now();
      const adShown = await showInterstitialAd();
      if (!adShown && shouldContinueAds.current) {
        console.log("[AdMob] Failed to show pre-loaded ad, switching to overlay");
        setAdSessionState("overlay");
      }
      return { dismissedEarly: false };
    }

    await prepareInterstitialAd();

    if (!shouldContinueAds.current) {
      console.log("[AdMob] Session cancelled during preparation");
      return { dismissedEarly: true };
    }

    console.log("[AdMob] Waiting for ad to load (max 8s)...");
    const ready = await waitForAdReady(8000);

    if (!shouldContinueAds.current) {
      console.log("[AdMob] Session cancelled while waiting for load");
      return { dismissedEarly: true };
    }

    if (!ready) {
      console.log("[AdMob] Ad not ready after timeout, switching to overlay");
      setAdSessionState("overlay");
      return { dismissedEarly: false };
    }

    setAdSessionState("showing");
    interstitialShowedAtRef.current = Date.now();
    const adShown = await showInterstitialAd();
    if (!adShown && shouldContinueAds.current) {
      console.log("[AdMob] Failed to show ad, switching to overlay");
      setAdSessionState("overlay");
    }
    return { dismissedEarly: false };
  }, [isNativePlatform, initializeAdMob, prepareInterstitialAd, showInterstitialAd, waitForAdReady]);

  const handleAdDismissed = useCallback(async () => {
    console.log("[AdMob] Interstitial ad dismissed");
    setIsAdShowing(false);
    isAdReadyRef.current = false;
    setIsAdReady(false);
    isLoadingAd.current = false;

    const showedAt = interstitialShowedAtRef.current;
    const dismissedEarly =
      showedAt !== null && Date.now() - showedAt < AD_EARLY_DISMISS_SECONDS * 1000;
    interstitialShowedAtRef.current = null;

    if (!shouldContinueAds.current) {
      setAdSessionState("idle");
      return;
    }

    setAdSessionState("overlay");
  }, []);

  useEffect(() => {
    if (!isNativePlatform) return;

    // Register listeners FIRST before any prepare call to avoid missing early events
    const loadedListener = AdMob.addListener(
      InterstitialAdPluginEvents.Loaded,
      () => {
        console.log("[AdMob] Interstitial ad loaded");
        isAdReadyRef.current = true;
        setIsAdReady(true);
        isLoadingAd.current = false;
        resolveAdReady(true);
      }
    );

    const failedToLoadListener = AdMob.addListener(
      InterstitialAdPluginEvents.FailedToLoad,
      (error) => {
        console.error("[AdMob] Failed to load interstitial:", error);
        isAdReadyRef.current = false;
        lastLoadFailedRef.current = true;
        setIsAdReady(false);
        isLoadingAd.current = false;
        resolveAdReady(false);
        if (shouldContinueAds.current) {
          setAdSessionState("overlay");
        }
      }
    );

    const showedListener = AdMob.addListener(
      InterstitialAdPluginEvents.Showed,
      () => {
        console.log("[AdMob] Interstitial ad showed");
        isAdReadyRef.current = false;
        setIsAdReady(false);
        setIsAdShowing(true);
        setAdSessionState("showing");
      }
    );

    const dismissedListener = AdMob.addListener(
      InterstitialAdPluginEvents.Dismissed,
      handleAdDismissed
    );

    const failedToShowListener = AdMob.addListener(
      InterstitialAdPluginEvents.FailedToShow,
      (error) => {
        console.error("[AdMob] Failed to show interstitial:", error);
        setIsAdShowing(false);
        if (shouldContinueAds.current) {
          setAdSessionState("overlay");
        }
      }
    );

    // Initialize and pre-load AFTER all listeners are registered to avoid missing early events
    initializeAdMob().then(() => {
      prepareInterstitialAd();
    });

    return () => {
      loadedListener.then((l) => l.remove());
      failedToLoadListener.then((l) => l.remove());
      showedListener.then((l) => l.remove());
      dismissedListener.then((l) => l.remove());
      failedToShowListener.then((l) => l.remove());
    };
  }, [prepareInterstitialAd, handleAdDismissed, resolveAdReady]);

  const showBannerAd = useCallback(async () => {
    if (!isNativePlatform) {
      setIsBannerVisible(true);
      return;
    }
    if (!isInitialized.current) await initializeAdMob();
    const options: BannerAdOptions = {
      adId: getBannerAdId(),
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      isTesting: IS_TESTING,
    };
    await AdMob.showBanner(options);
    setIsBannerVisible(true);
  }, [isNativePlatform, initializeAdMob]);

  const hideBannerAd = useCallback(async () => {
    if (isNativePlatform) {
      try {
        await AdMob.hideBanner();
      } catch (error) {
        console.warn("[AdMob] hideBanner failed:", error);
      }
    }
    setIsBannerVisible(false);
  }, [isNativePlatform]);

  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform) {
      return true;
    }
    if (!isInitialized.current) await initializeAdMob();

    rewardedGrantedRef.current = false;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const rewardListener = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewardedGrantedRef.current = true;
      });
      const dismissListener = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        rewardListener.then((l) => l.remove());
        dismissListener.then((l) => l.remove());
        finish(rewardedGrantedRef.current);
      });
      const failListener = AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
        rewardListener.then((l) => l.remove());
        dismissListener.then((l) => l.remove());
        failListener.then((l) => l.remove());
        finish(false);
      });

      const options: RewardAdOptions = {
        adId: getRewardedAdId(),
        isTesting: IS_TESTING,
      };
      AdMob.prepareRewardVideoAd(options)
        .then(() => AdMob.showRewardVideoAd())
        .catch((error) => {
          console.error("[AdMob] Rewarded ad error:", error);
          rewardListener.then((l) => l.remove());
          dismissListener.then((l) => l.remove());
          failListener.then((l) => l.remove());
          finish(false);
        });
    });
  }, [isNativePlatform, initializeAdMob]);

  return {
    isAdReady,
    isAdShowing,
    adSessionState,
    isBannerVisible,
    startAdSession,
    stopAdSession,
    preloadAd: prepareInterstitialAd,
    showBannerAd,
    hideBannerAd,
    showRewardedAd,
    isNativePlatform,
  };
}

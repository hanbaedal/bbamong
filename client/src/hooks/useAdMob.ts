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
import { isGoogleTestAdMobId } from "@shared/admobConstants";
import { getFullUrl } from "@/lib/queryClient";

/** 개발 빌드에서만 Google 테스트 광고 사용 */
const IS_TESTING = import.meta.env.DEV;

const DEV_FALLBACK_INTERSTITIAL_ANDROID =
  import.meta.env.VITE_ADMOB_AD_ID_ANDROID || "ca-app-pub-3940256099942544/1033173712";
const DEV_FALLBACK_INTERSTITIAL_IOS =
  import.meta.env.VITE_ADMOB_AD_ID_IOS || "ca-app-pub-3940256099942544/4411468910";
const DEV_FALLBACK_REWARDED_ANDROID = "ca-app-pub-3940256099942544/5224354917";
const DEV_FALLBACK_REWARDED_IOS = "ca-app-pub-3940256099942544/1712485313";
const DEV_FALLBACK_BANNER_ANDROID = "ca-app-pub-3940256099942544/6300978111";
const DEV_FALLBACK_BANNER_IOS = "ca-app-pub-3940256099942544/2934735716";

interface RuntimeAdConfig {
  androidAppId?: string;
  iosAppId?: string;
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

function resolveAdUnitId(
  runtimeId: string | undefined,
  envId: string | undefined,
  devFallback: string,
  label: string,
): string {
  const runtime = runtimeId?.trim();
  if (runtime) {
    if (!import.meta.env.DEV && isGoogleTestAdMobId(runtime)) {
      console.error(`[AdMob] 운영 빌드에 테스트 ${label} ID가 설정되어 있습니다. 관리자에서 실제 ID를 선택하세요.`);
      return "";
    }
    return runtime;
  }

  const env = envId?.trim();
  if (env) {
    if (!import.meta.env.DEV && isGoogleTestAdMobId(env)) {
      console.error(`[AdMob] 운영 빌드 VITE 환경변수에 테스트 ${label} ID가 있습니다.`);
      return "";
    }
    return env;
  }

  if (import.meta.env.DEV) {
    return devFallback;
  }

  console.error(
    `[AdMob] 운영 빌드 ${label} ID 미설정 — 관리자 → 동영상 광고 수익 현황에서 설정하세요.`,
  );
  return "";
}

function warnIfProductionAdIdsMissing() {
  if (import.meta.env.DEV || !Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform();
  const interstitial = getAdId();
  const rewarded = getRewardedAdId();
  if (!interstitial) {
    console.warn("[AdMob] 전면 광고 단위 ID 없음 — 광고 대신 오버레이로 대체됩니다.");
  }
  if (!rewarded) {
    console.warn("[AdMob] 리워드 광고 단위 ID 없음 — 500P 보상 광고가 표시되지 않습니다.");
  }
  if (platform === "android" && !runtimeAdConfig?.androidAppId?.trim()) {
    console.warn("[AdMob] Android App ID가 서버에 없습니다. APK 빌드 시 Manifest App ID를 확인하세요.");
  }
}

function getAdId(): string {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") {
    return resolveAdUnitId(
      runtimeAdConfig?.iosInterstitialAdUnitId,
      import.meta.env.VITE_ADMOB_AD_ID_IOS,
      DEV_FALLBACK_INTERSTITIAL_IOS,
      "전면",
    );
  }
  return resolveAdUnitId(
    runtimeAdConfig?.androidInterstitialAdUnitId,
    import.meta.env.VITE_ADMOB_AD_ID_ANDROID,
    DEV_FALLBACK_INTERSTITIAL_ANDROID,
    "전면",
  );
}

function getRewardedAdId(): string {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") {
    return resolveAdUnitId(
      runtimeAdConfig?.iosRewardedAdUnitId,
      import.meta.env.VITE_ADMOB_REWARDED_ID_IOS,
      DEV_FALLBACK_REWARDED_IOS,
      "리워드",
    );
  }
  return resolveAdUnitId(
    runtimeAdConfig?.androidRewardedAdUnitId,
    import.meta.env.VITE_ADMOB_REWARDED_ID_ANDROID,
    DEV_FALLBACK_REWARDED_ANDROID,
    "리워드",
  );
}

function getBannerAdId(): string {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") {
    return resolveAdUnitId(
      runtimeAdConfig?.iosBannerAdUnitId,
      import.meta.env.VITE_ADMOB_BANNER_ID_IOS,
      DEV_FALLBACK_BANNER_IOS,
      "배너",
    );
  }
  return resolveAdUnitId(
    runtimeAdConfig?.androidBannerAdUnitId,
    import.meta.env.VITE_ADMOB_BANNER_ID_ANDROID,
    DEV_FALLBACK_BANNER_ANDROID,
    "배너",
  );
}

export type AdSessionState = "idle" | "preparing" | "showing" | "overlay";

/** 배너 표시 후 자동 숨김 */
const BANNER_AUTO_HIDE_MS = 8_000;
/** 연속 banner_ad_show 무시 간격 */
const BANNER_SHOW_COOLDOWN_MS = 60_000;

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
  const bannerHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBannerShownAtRef = useRef(0);
  const isBannerVisibleRef = useRef(false);

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

    const adId = getAdId();
    if (!adId) {
      lastLoadFailedRef.current = true;
      setIsAdReady(false);
      resolveAdReady(false);
      return;
    }

    lastLoadFailedRef.current = false;

    try {
      isLoadingAd.current = true;
      const options: AdOptions = {
        adId,
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

    // 전면 광고 전 배너 제거 — 일부 기기에서 배너+전면 동시 시 WebView/AdMob 크래시
    clearBannerHideTimer();
    try {
      await AdMob.hideBanner();
    } catch {
      /* ignore */
    }
    try {
      await AdMob.removeBanner();
    } catch {
      /* ignore */
    }
    isBannerVisibleRef.current = false;
    setIsBannerVisible(false);

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
  }, [
    isNativePlatform,
    initializeAdMob,
    prepareInterstitialAd,
    showInterstitialAd,
    waitForAdReady,
    clearBannerHideTimer,
  ]);

  useEffect(() => {
    return () => {
      clearBannerHideTimer();
    };
  }, [clearBannerHideTimer]);

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

  const clearBannerHideTimer = useCallback(() => {
    if (bannerHideTimerRef.current) {
      clearTimeout(bannerHideTimerRef.current);
      bannerHideTimerRef.current = null;
    }
  }, []);

  const hideBannerAd = useCallback(async () => {
    clearBannerHideTimer();
    if (isNativePlatform) {
      try {
        await AdMob.hideBanner();
      } catch (error) {
        console.warn("[AdMob] hideBanner failed:", error);
      }
      try {
        await AdMob.removeBanner();
      } catch {
        /* ignore */
      }
    }
    isBannerVisibleRef.current = false;
    setIsBannerVisible(false);
  }, [isNativePlatform, clearBannerHideTimer]);

  const showBannerAd = useCallback(async () => {
    if (!isNativePlatform) {
      // 웹에는 실제 배너 없음 — 상태만 잠깐 표시하지 않음
      return;
    }
    // 전면·보상 광고 세션 중에는 배너 표시하지 않음
    if (adSessionState !== "idle" || isAdShowing) {
      console.log("[AdMob] skip banner — ad session active:", adSessionState);
      return;
    }
    // 이미 보이거나 쿨다운 중이면 재표시하지 않음 (연속 노출 방지)
    const now = Date.now();
    if (isBannerVisibleRef.current) {
      console.log("[AdMob] skip banner — already visible");
      return;
    }
    if (now - lastBannerShownAtRef.current < BANNER_SHOW_COOLDOWN_MS) {
      console.log("[AdMob] skip banner — cooldown");
      return;
    }

    const adId = getBannerAdId();
    if (!adId) {
      console.warn("[AdMob] 배너 ID 없음 — 배너를 표시하지 않습니다.");
      return;
    }
    if (!isInitialized.current) await initializeAdMob();

    try {
      try {
        await AdMob.hideBanner();
      } catch {
        /* ignore */
      }
      try {
        await AdMob.removeBanner();
      } catch {
        /* ignore */
      }

      const options: BannerAdOptions = {
        adId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        isTesting: IS_TESTING,
      };
      await AdMob.showBanner(options);
      lastBannerShownAtRef.current = Date.now();
      isBannerVisibleRef.current = true;
      setIsBannerVisible(true);

      clearBannerHideTimer();
      bannerHideTimerRef.current = setTimeout(() => {
        bannerHideTimerRef.current = null;
        void hideBannerAd();
      }, BANNER_AUTO_HIDE_MS);
    } catch (error) {
      console.warn("[AdMob] showBanner failed:", error);
      isBannerVisibleRef.current = false;
      setIsBannerVisible(false);
    }
  }, [
    isNativePlatform,
    initializeAdMob,
    adSessionState,
    isAdShowing,
    clearBannerHideTimer,
    hideBannerAd,
  ]);

  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform) {
      return true;
    }
    const adId = getRewardedAdId();
    if (!adId) {
      console.warn("[AdMob] 리워드 ID 없음 — 보상 광고를 건너뜁니다.");
      return false;
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
        adId,
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

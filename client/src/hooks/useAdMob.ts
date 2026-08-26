import { useEffect, useRef, useCallback, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  AdOptions,
  InterstitialAdPluginEvents,
  RewardAdOptions,
  RewardAdPluginEvents,
} from "@capacitor-community/admob";
import { AD_EARLY_DISMISS_SECONDS } from "@shared/predictionOdds";
import { AD_PLAY_MS } from "@shared/adBreakTiming";
import { isGoogleTestAdMobId } from "@shared/admobConstants";
import { getFullUrl } from "@/lib/queryClient";
import { clearPendingNativeAdDismiss, dismissNativeFullscreenAd } from "@/lib/systemUiPlugin";

/** 개발 빌드에서만 Google 테스트 광고 사용 */
const IS_TESTING = import.meta.env.DEV;

const DEV_FALLBACK_INTERSTITIAL_ANDROID =
  import.meta.env.VITE_ADMOB_AD_ID_ANDROID || "ca-app-pub-3940256099942544/1033173712";
const DEV_FALLBACK_INTERSTITIAL_IOS =
  import.meta.env.VITE_ADMOB_AD_ID_IOS || "ca-app-pub-3940256099942544/4411468910";
const DEV_FALLBACK_REWARDED_ANDROID = "ca-app-pub-3940256099942544/5224354917";
const DEV_FALLBACK_REWARDED_IOS = "ca-app-pub-3940256099942544/1712485313";

interface RuntimeAdConfig {
  androidAppId?: string;
  iosAppId?: string;
  androidInterstitialAdUnitId: string;
  iosInterstitialAdUnitId: string;
  androidRewardedAdUnitId?: string;
  iosRewardedAdUnitId?: string;
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

export type AdSessionState = "idle" | "preparing" | "showing" | "overlay";

/** 전면 광고 Dismiss 이벤트 누락 시 검정 화면 고착 방지 */
const INTERSTITIAL_DISMISS_TIMEOUT_MS = 75_000;
/** 보상형 광고 Dismiss 누락 방지 — 광고 50초보다 짧으면 게임이 안 돌아옴 */
const REWARDED_DISMISS_TIMEOUT_MS = AD_PLAY_MS + 15_000;
/** prepare/show SDK 호출이 응답 없을 때 */
const AD_SDK_CALL_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[AdMob] ${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type AdSessionResult = {
  dismissedEarly: boolean;
  /** rewarded: AdMob 리워드 동영상 / overlay: 웹·로드실패 폴백 */
  mode: "rewarded" | "overlay";
  /** 리워드 동영상을 끝까지 시청했는지 (overlay 모드는 false) */
  rewardEarned: boolean;
};

interface UseAdMobResult {
  isAdReady: boolean;
  isAdShowing: boolean;
  adSessionState: AdSessionState;
  startAdSession: (opts?: { maxMs?: number }) => Promise<AdSessionResult>;
  stopAdSession: () => void;
  preloadAd: () => Promise<void>;
  showRewardedAd: () => Promise<boolean>;
  isNativePlatform: boolean;
}

export function useAdMob(): UseAdMobResult {
  const [isAdReady, setIsAdReady] = useState(false);
  const [isAdShowing, setIsAdShowing] = useState(false);
  const [adSessionState, setAdSessionState] = useState<AdSessionState>("idle");
  const adSessionStateRef = useRef<AdSessionState>("idle");

  const assignAdSessionState = useCallback((next: AdSessionState) => {
    adSessionStateRef.current = next;
    setAdSessionState(next);
  }, []);

  const isInitialized = useRef(false);
  const isNativePlatform = Capacitor.isNativePlatform();
  const shouldContinueAds = useRef(false);
  const isLoadingAd = useRef(false);
  const isAdReadyRef = useRef(false);
  const interstitialShowedAtRef = useRef<number | null>(null);
  const rewardedGrantedRef = useRef(false);
  // Set to true when FailedToLoad fires so waitForAdReady can return immediately
  const lastLoadFailedRef = useRef(false);
  const interstitialDismissResolverRef = useRef<((result: { dismissedEarly: boolean }) => void) | null>(
    null,
  );
  const rewardedFinishRef = useRef<((value: boolean) => void) | null>(null);
  /** showInterstitial 이후 FailedToShow 등으로 오버레이 폴백이 된 경우 */
  const interstitialBecameOverlayRef = useRef(false);

  // Pending resolvers for waitForAdReady()
  const adReadyResolversRef = useRef<Array<(ready: boolean) => void>>([]);

  const resolveAdReady = useCallback((ready: boolean) => {
    const resolvers = adReadyResolversRef.current;
    adReadyResolversRef.current = [];
    for (const resolve of resolvers) {
      resolve(ready);
    }
  }, []);

  const resolveInterstitialDismiss = useCallback((result: { dismissedEarly: boolean }) => {
    const resolve = interstitialDismissResolverRef.current;
    interstitialDismissResolverRef.current = null;
    resolve?.(result);
  }, []);

  const waitForInterstitialDismiss = useCallback((): Promise<{ dismissedEarly: boolean }> => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: { dismissedEarly: boolean }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        interstitialDismissResolverRef.current = null;
        resolve(result);
      };

      const timer = setTimeout(() => {
        console.warn(
          `[AdMob] interstitial dismiss timed out after ${INTERSTITIAL_DISMISS_TIMEOUT_MS}ms — unblocking UI`,
        );
        setIsAdShowing(false);
        assignAdSessionState("idle");
        finish({ dismissedEarly: true });
      }, INTERSTITIAL_DISMISS_TIMEOUT_MS);

      interstitialDismissResolverRef.current = (result) => {
        finish(result);
      };
    });
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

      await withTimeout(
        AdMob.prepareInterstitial(options),
        AD_SDK_CALL_TIMEOUT_MS,
        "prepareInterstitial",
      );
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
      await withTimeout(AdMob.showInterstitial(), AD_SDK_CALL_TIMEOUT_MS, "showInterstitial");
      console.log("[AdMob] showInterstitial called");
      return true;
    } catch (error) {
      console.error("[AdMob] Error showing interstitial:", error);
      setIsAdShowing(false);
      return false;
    }
  }, [isNativePlatform]);

  const stopAdSession = useCallback(() => {
    const state = adSessionStateRef.current;
    shouldContinueAds.current = false;
    if (state !== "idle") {
      console.log("[AdMob] Stopping ad session");
    }
    assignAdSessionState("idle");
    setIsAdShowing(false);
    resolveAdReady(false);
    resolveInterstitialDismiss({ dismissedEarly: true });
    const finishRewarded = rewardedFinishRef.current;
    rewardedFinishRef.current = null;
    finishRewarded?.(rewardedGrantedRef.current);
    if (isNativePlatform) void dismissNativeFullscreenAd();
  }, [assignAdSessionState, isNativePlatform, resolveAdReady, resolveInterstitialDismiss]);

  const showRewardedAd = useCallback(async (maxMs?: number): Promise<boolean> => {
    if (!isNativePlatform) {
      return true;
    }
    const adId = getRewardedAdId();
    if (!adId) {
      console.warn("[AdMob] 리워드 ID 없음 — 보상 광고를 건너뜁니다.");
      return false;
    }
    if (!isInitialized.current) await initializeAdMob();
    if (!shouldContinueAds.current) {
      void dismissNativeFullscreenAd();
      return false;
    }

    rewardedGrantedRef.current = false;
    const waitMs = Math.max(1_000, Math.min(REWARDED_DISMISS_TIMEOUT_MS, maxMs ?? REWARDED_DISMISS_TIMEOUT_MS));

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        rewardListener.then((l) => l.remove());
        dismissListener.then((l) => l.remove());
        failListener.then((l) => l.remove());
      };
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        rewardedFinishRef.current = null;
        cleanup();
        resolve(value);
      };
      rewardedFinishRef.current = finish;

      const timer = setTimeout(() => {
        console.warn(
          `[AdMob] rewarded wait timed out after ${waitMs}ms — returning to prediction`,
        );
        void dismissNativeFullscreenAd();
        finish(rewardedGrantedRef.current);
      }, waitMs);

      const rewardListener = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewardedGrantedRef.current = true;
      });
      const dismissListener = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        finish(rewardedGrantedRef.current);
      });
      const failListener = AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
        finish(false);
      });

      const options: RewardAdOptions = {
        adId,
        isTesting: IS_TESTING,
      };
      withTimeout(AdMob.prepareRewardVideoAd(options), AD_SDK_CALL_TIMEOUT_MS, "prepareRewardVideoAd")
        .then(async () => {
          if (settled || !shouldContinueAds.current) {
            console.log("[AdMob] skip showRewardVideoAd — session aborted");
            void dismissNativeFullscreenAd();
            return;
          }
          // 이전 세션의 pending finish가 새 광고를 즉시 닫지 않게, show 직전에만 해제
          await clearPendingNativeAdDismiss();
          if (settled || !shouldContinueAds.current) {
            void dismissNativeFullscreenAd();
            return;
          }
          return withTimeout(AdMob.showRewardVideoAd(), AD_SDK_CALL_TIMEOUT_MS, "showRewardVideoAd");
        })
        .catch((error) => {
          console.error("[AdMob] Rewarded ad error:", error);
          finish(false);
        });
    });
  }, [isNativePlatform, initializeAdMob]);

  const startAdSession = useCallback(async (opts?: { maxMs?: number }): Promise<AdSessionResult> => {
    if (!isNativePlatform) {
      console.log("[AdMob] Not native platform, overlay mode");
      assignAdSessionState("overlay");
      return { dismissedEarly: false, mode: "overlay", rewardEarned: false };
    }

    console.log("[AdMob] Starting rewarded ad session");
    shouldContinueAds.current = true;
    assignAdSessionState("preparing");

    try {
      await AdMob.hideBanner();
    } catch {
      /* ignore leftover native banner */
    }
    try {
      await AdMob.removeBanner();
    } catch {
      /* ignore */
    }

    if (!isInitialized.current) {
      await initializeAdMob();
    }

    if (!shouldContinueAds.current) {
      console.log("[AdMob] Session cancelled before rewarded");
      return { dismissedEarly: true, mode: "rewarded", rewardEarned: false };
    }

    assignAdSessionState("showing");
    const rewardEarned = await showRewardedAd(opts?.maxMs);

    if (!shouldContinueAds.current) {
      return { dismissedEarly: true, mode: "rewarded", rewardEarned: false };
    }

    if (rewardEarned) {
      assignAdSessionState("idle");
      return { dismissedEarly: false, mode: "rewarded", rewardEarned: true };
    }

    console.log("[AdMob] Rewarded ad skipped or failed — overlay fallback");
    assignAdSessionState("overlay");
    return { dismissedEarly: false, mode: "overlay", rewardEarned: false };
  }, [isNativePlatform, initializeAdMob, showRewardedAd, assignAdSessionState]);

  const handleAdDismissed = useCallback(() => {
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
      assignAdSessionState("idle");
      resolveInterstitialDismiss({ dismissedEarly: true });
      return;
    }

    // 보상형 광고로 이어질 수 있으므로 오버레이로 붙잡지 않음
    assignAdSessionState("idle");
    resolveInterstitialDismiss({ dismissedEarly });
  }, [resolveInterstitialDismiss, assignAdSessionState]);

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
          assignAdSessionState("overlay");
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
        assignAdSessionState("showing");
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
        interstitialBecameOverlayRef.current = true;
        if (shouldContinueAds.current) {
          assignAdSessionState("overlay");
        }
        resolveInterstitialDismiss({ dismissedEarly: false });
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
  }, [prepareInterstitialAd, handleAdDismissed, resolveAdReady, resolveInterstitialDismiss]);

  /** 백그라운드 복귀 시 Dismiss 이벤트 누락으로 showing에 고착된 경우 해제 */
  useEffect(() => {
    if (!isNativePlatform) return;

    let resumeHandle: { remove: () => void } | null = null;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      if (!interstitialDismissResolverRef.current) return;
      const showedAt = interstitialShowedAtRef.current;
      const waitedMs = showedAt != null ? Date.now() - showedAt : INTERSTITIAL_DISMISS_TIMEOUT_MS;
      // 짧게 백그라운드 갔다 온 정상 시청은 건드리지 않음
      if (waitedMs < 20_000) return;
      console.warn(
        `[AdMob] resume while waiting dismiss (${waitedMs}ms) — force unblock`,
      );
      setIsAdShowing(false);
      assignAdSessionState("idle");
      resolveInterstitialDismiss({ dismissedEarly: true });
    }).then((handle) => {
      resumeHandle = handle;
    });

    return () => {
      resumeHandle?.remove();
    };
  }, [isNativePlatform, resolveInterstitialDismiss, assignAdSessionState]);

  return {
    isAdReady,
    isAdShowing,
    adSessionState,
    startAdSession,
    stopAdSession,
    preloadAd: prepareInterstitialAd,
    showRewardedAd,
    isNativePlatform,
  };
}

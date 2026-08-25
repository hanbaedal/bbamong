package com.ppamong.app;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.lang.ref.WeakReference;

/**
 * 최상단 Activity 추적 + AdMob AdActivity 강제 종료.
 *
 * JS에서 dismiss를 호출하는 순간 AdActivity가 아직 안 떠 있을 수 있다.
 * pending 플래그를 켜 두면, 광고 Activity가 create/start/resume 되는 즉시 finish 한다.
 * MainActivity는 절대 finish 하지 않는다.
 */
public final class ForegroundActivityTracker implements Application.ActivityLifecycleCallbacks {
    private static final String TAG = "PPAMONG-AdDismiss";
    private static final long PENDING_FINISH_TTL_MS = 8_000;
    private static final ForegroundActivityTracker INSTANCE = new ForegroundActivityTracker();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static boolean installed = false;
    private static WeakReference<Activity> top = new WeakReference<>(null);
    private static volatile boolean pendingFinishGoogleAds = false;

    private static final Runnable CLEAR_PENDING = () -> {
        pendingFinishGoogleAds = false;
        Log.i(TAG, "pendingFinishGoogleAds expired");
    };

    private ForegroundActivityTracker() {}

    public static void install(Application app) {
        if (app == null || installed) return;
        installed = true;
        app.registerActivityLifecycleCallbacks(INSTANCE);
    }

    public static Activity getTop() {
        return top.get();
    }

    public static void clearPendingFinish() {
        pendingFinishGoogleAds = false;
        MAIN.removeCallbacks(CLEAR_PENDING);
    }

    public static void requestFinishGoogleAds() {
        pendingFinishGoogleAds = true;
        MAIN.removeCallbacks(CLEAR_PENDING);
        MAIN.postDelayed(CLEAR_PENDING, PENDING_FINISH_TTL_MS);
        Activity current = top.get();
        if (current != null) {
            current.runOnUiThread(() -> considerFinish(current));
        }
    }

    static boolean isGoogleAdsActivity(Activity activity) {
        if (activity == null) return false;
        if (activity instanceof MainActivity) return false;
        return isGoogleAdsActivityName(activity.getClass().getName());
    }

    /** keep in sync with shared/googleAdsActivity.ts */
    static boolean isGoogleAdsActivityName(String name) {
        if (name == null || name.isEmpty()) return false;
        if (name.contains("MainActivity")) return false;
        return name.startsWith("com.google.android.gms.ads")
            || name.contains("AdActivity")
            || name.contains("ads.internal");
    }

    private static void considerFinish(Activity activity) {
        if (!pendingFinishGoogleAds) return;
        if (!isGoogleAdsActivity(activity)) return;
        if (activity.isFinishing() || activity.isDestroyed()) return;
        Log.i(TAG, "finish ads activity " + activity.getClass().getName());
        activity.finish();
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
        considerFinish(activity);
    }

    @Override
    public void onActivityStarted(Activity activity) {
        top = new WeakReference<>(activity);
        considerFinish(activity);
    }

    @Override
    public void onActivityResumed(Activity activity) {
        top = new WeakReference<>(activity);
        considerFinish(activity);
    }

    @Override
    public void onActivityPaused(Activity activity) {}

    @Override
    public void onActivityStopped(Activity activity) {}

    @Override
    public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}

    @Override
    public void onActivityDestroyed(Activity activity) {
        Activity current = top.get();
        if (current == activity) {
            top = new WeakReference<>(null);
        }
    }
}

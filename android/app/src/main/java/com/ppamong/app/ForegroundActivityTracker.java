package com.ppamong.app;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import java.lang.ref.WeakReference;

/** 최상단 Activity 추적 — AdMob AdActivity를 직접 finish 하기 위함 */
public final class ForegroundActivityTracker implements Application.ActivityLifecycleCallbacks {
    private static final ForegroundActivityTracker INSTANCE = new ForegroundActivityTracker();
    private static boolean installed = false;
    private static WeakReference<Activity> resumed = new WeakReference<>(null);

    private ForegroundActivityTracker() {}

    public static void install(Application app) {
        if (app == null || installed) return;
        installed = true;
        app.registerActivityLifecycleCallbacks(INSTANCE);
    }

    public static Activity getResumed() {
        return resumed.get();
    }

    @Override
    public void onActivityResumed(Activity activity) {
        resumed = new WeakReference<>(activity);
    }

    @Override
    public void onActivityPaused(Activity activity) {
        Activity current = resumed.get();
        if (current == activity) {
            resumed = new WeakReference<>(null);
        }
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle savedInstanceState) {}

    @Override
    public void onActivityStarted(Activity activity) {}

    @Override
    public void onActivityStopped(Activity activity) {}

    @Override
    public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}

    @Override
    public void onActivityDestroyed(Activity activity) {}
}

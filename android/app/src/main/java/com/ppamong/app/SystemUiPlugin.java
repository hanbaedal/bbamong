package com.ppamong.app;

import android.app.Activity;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemUi")
public class SystemUiPlugin extends Plugin {
    private static final String TAG = "PPAMONG-AdDismiss";

    @PluginMethod
    public void setImmersive(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("MainActivity not available");
            return;
        }
        MainActivity activity = (MainActivity) getActivity();
        activity.setImmersiveMode(Boolean.TRUE.equals(enabled));
        call.resolve();
    }

    @PluginMethod
    public void setKeepScreenOn(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("MainActivity not available");
            return;
        }
        MainActivity activity = (MainActivity) getActivity();
        activity.setKeepScreenOn(Boolean.TRUE.equals(enabled));
        call.resolve();
    }

    /**
     * AdMob 리워드/전면은 별도 AdActivity로 뜬다.
     * Capacitor getActivity()는 MainActivity라 BACK을 보내면 광고는 안 닫히고
     * 게임이 뒤로 갈 수 있다. 최상단이 구글 광고 Activity일 때만 finish() 한다.
     */
    @PluginMethod
    public void dismissFullscreenAd(PluginCall call) {
        Activity top = ForegroundActivityTracker.getResumed();
        if (top == null) {
            call.resolve();
            return;
        }
        top.runOnUiThread(() -> {
            if (!isGoogleAdsActivity(top)) {
                Log.i(TAG, "dismissFullscreenAd skip (not ads) " + top.getClass().getName());
                return;
            }
            if (top.isFinishing() || top.isDestroyed()) {
                return;
            }
            Log.i(TAG, "dismissFullscreenAd finish " + top.getClass().getName());
            top.finish();
        });
        call.resolve();
    }

    static boolean isGoogleAdsActivity(Activity activity) {
        if (activity == null) return false;
        if (activity instanceof MainActivity) return false;
        String name = activity.getClass().getName();
        if (name == null) return false;
        return name.startsWith("com.google.android.gms.ads")
            || name.contains("AdActivity")
            || name.contains("ads.internal");
    }
}

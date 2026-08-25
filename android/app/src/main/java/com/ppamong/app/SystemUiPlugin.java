package com.ppamong.app;

import android.app.Activity;
import android.view.KeyEvent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemUi")
public class SystemUiPlugin extends Plugin {

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

    /** 공수/투수 광고 40초 종료 시 AdMob 전체화면을 닫고 예측 화면으로 돌아간다 */
    @PluginMethod
    public void dismissFullscreenAd(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            activity.dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK));
            activity.dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_BACK));
        });
        call.resolve();
    }
}

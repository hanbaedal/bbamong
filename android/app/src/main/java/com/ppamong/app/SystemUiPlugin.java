package com.ppamong.app;

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

    /**
     * AdMob 리워드/전면은 별도 AdActivity로 뜬다.
     * Capacitor getActivity()는 MainActivity라 BACK을 보내면 광고는 안 닫히고
     * 게임이 뒤로 갈 수 있다. 최상단이 구글 광고 Activity일 때만 finish() 한다.
     * 아직 안 떠 있으면 pending을 걸어 등장 즉시 닫는다.
     */
    @PluginMethod
    public void dismissFullscreenAd(PluginCall call) {
        ForegroundActivityTracker.requestFinishGoogleAds();
        call.resolve();
    }

    /** 새 광고 세션 시작 시 pending finish를 해제해 다음 광고가 바로 닫히지 않게 한다. */
    @PluginMethod
    public void clearPendingAdDismiss(PluginCall call) {
        ForegroundActivityTracker.clearPendingFinish();
        call.resolve();
    }
}

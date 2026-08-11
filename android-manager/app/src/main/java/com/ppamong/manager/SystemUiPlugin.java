package com.ppamong.manager;

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
}

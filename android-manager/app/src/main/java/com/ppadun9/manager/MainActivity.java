package com.ppadun9.manager;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        fixTextZoom();
    }

    private void fixTextZoom() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setTextZoom(100);
            }
        } catch (Exception e) {
            // ignore
        }
    }
}

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bbanden.nine",
  appName: "빠던9",
  webDir: "dist/public",
  server: {
    url: "https://ppadun9.com/login",
    allowNavigation: [
      "https://ppadun9.com",
      "https://kauth.kakao.com",
      "https://kapi.kakao.com",
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
    ],
    cleartext: true,
  },
  plugins: {
    App: {},
    Keyboard: {
      resize: "none",
      style: "dark",
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#111111",
      showSpinner: false,
      launchFadeOutDuration: 0,
    },
  },
  // Android 딥링크 설정 (androidScheme)
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#111111",
  },
};

export default config;

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ppamong.manager",
  appName: "PPAMONG 매니저",
  webDir: "dist-manager/public",
  server: {
    url: "https://ppamong.com/manager",
    allowNavigation: [
      "https://ppamong.com",
      "https://kauth.kakao.com",
      "https://kapi.kakao.com",
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
    ],
    cleartext: true,
  },
  plugins: {
    App: {},
    SplashScreen: {
      launchShowDuration: 5000,
      launchAutoHide: true,
      backgroundColor: "#111111",
      showSpinner: false,
      launchFadeOutDuration: 300,
    },
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#111111",
  },
};

export default config;

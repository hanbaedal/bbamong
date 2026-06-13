import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ppadun9.manager",
  appName: "빠던9 매니저",
  webDir: "dist-manager/public",
  server: {
    url: "https://ppadun9.com/manager",
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
      style: "light",
    },
  },
  android: {
    allowMixedContent: true,
    path: "android-manager",
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#FFFFFF",
    path: "ios-manager-standalone",
  },
};

export default config;

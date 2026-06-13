import { Capacitor, registerPlugin } from '@capacitor/core';

export interface LogoutPlugin {
  performLogout(options: { logoutApiUrl: string; loginUrl: string }): Promise<void>;
}

const LogoutPluginNative = registerPlugin<LogoutPlugin>('LogoutPlugin', {
  web: () => Promise.resolve({
    performLogout: async () => {
      console.log('[LogoutPlugin] Web fallback - no native handler');
    }
  } as LogoutPlugin)
});

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function sendLogoutToNative(logoutApiUrl: string, loginUrl: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[LogoutPlugin] Not running on native platform');
    return false;
  }

  try {
    console.log('[LogoutPlugin] Sending logout signal to native');
    await LogoutPluginNative.performLogout({ logoutApiUrl, loginUrl });
    console.log('[LogoutPlugin] Native logout completed');
    return true;
  } catch (error) {
    console.error('[LogoutPlugin] Error calling native logout:', error);
    return false;
  }
}

export { LogoutPluginNative };

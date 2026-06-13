import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const MANAGER_ACCESS_TOKEN_KEY = 'managerAccessToken';
const MANAGER_REFRESH_TOKEN_KEY = 'managerRefreshToken';

let accessToken: string | null = null;

const isNative = Capacitor.isNativePlatform();

export function getManagerAccessToken(): string | null {
  return accessToken;
}

export function setManagerAccessToken(token: string | null): void {
  accessToken = token;
}

export async function saveManagerRefreshToken(token: string): Promise<void> {
  if (isNative) {
    await Preferences.set({
      key: MANAGER_REFRESH_TOKEN_KEY,
      value: token,
    });
  } else {
    localStorage.setItem(MANAGER_REFRESH_TOKEN_KEY, token);
  }
}

export async function getManagerRefreshToken(): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key: MANAGER_REFRESH_TOKEN_KEY });
    return value;
  } else {
    return localStorage.getItem(MANAGER_REFRESH_TOKEN_KEY);
  }
}

export async function clearManagerTokens(): Promise<void> {
  setManagerAccessToken(null);
  if (isNative) {
    await Preferences.remove({ key: MANAGER_REFRESH_TOKEN_KEY });
  } else {
    localStorage.removeItem(MANAGER_REFRESH_TOKEN_KEY);
  }
}

import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const ACCESS_TOKEN_KEY = "userAccessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

let accessToken: string | null = null;

const isNative = Capacitor.isNativePlatform();

function readStoredAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredAccessToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

/** iframe·새로고침 — localStorage / Preferences에서 access token 복원 */
export async function hydrateAccessToken(): Promise<string | null> {
  if (accessToken) return accessToken;

  const fromStorage = readStoredAccessToken();
  if (fromStorage) {
    accessToken = fromStorage;
    return fromStorage;
  }

  if (isNative) {
    const { value } = await Preferences.get({ key: ACCESS_TOKEN_KEY });
    if (value) {
      accessToken = value;
      writeStoredAccessToken(value);
      return value;
    }
  }

  return null;
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;

  const fromStorage = readStoredAccessToken();
  if (fromStorage) {
    accessToken = fromStorage;
    return fromStorage;
  }

  return null;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  writeStoredAccessToken(token);

  if (isNative) {
    if (token) {
      void Preferences.set({ key: ACCESS_TOKEN_KEY, value: token });
    } else {
      void Preferences.remove({ key: ACCESS_TOKEN_KEY });
    }
  }
}

export async function saveRefreshToken(token: string): Promise<void> {
  if (isNative) {
    await Preferences.set({
      key: REFRESH_TOKEN_KEY,
      value: token,
    });
  } else {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
    return value;
  }

  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  setAccessToken(null);
  if (isNative) {
    await Preferences.remove({ key: REFRESH_TOKEN_KEY });
    await Preferences.remove({ key: ACCESS_TOKEN_KEY });
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

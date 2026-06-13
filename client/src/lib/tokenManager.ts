import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

// 메모리에 Access Token 저장
let accessToken: string | null = null;

// 네이티브 앱 여부 확인
const isNative = Capacitor.isNativePlatform();

// Access Token 가져오기
export function getAccessToken(): string | null {
  return accessToken;
}

// Access Token 설정
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Refresh Token 저장 (네이티브: Preferences, 웹: localStorage)
export async function saveRefreshToken(token: string): Promise<void> {
  if (isNative) {
    await Preferences.set({
      key: 'refreshToken',
      value: token,
    });
  } else {
    localStorage.setItem('refreshToken', token);
  }
}

// Refresh Token 가져오기 (비동기)
export async function getRefreshToken(): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key: 'refreshToken' });
    return value;
  } else {
    return localStorage.getItem('refreshToken');
  }
}

// 모든 토큰 삭제 (로그아웃)
export async function clearTokens(): Promise<void> {
  setAccessToken(null);
  if (isNative) {
    await Preferences.remove({ key: 'refreshToken' });
  } else {
    localStorage.removeItem('refreshToken');
  }
}

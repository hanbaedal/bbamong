import type { User } from "@/contexts/UserContext";
import { completeLoginNavigation, DEFAULT_POST_LOGIN_FALLBACK } from "@/lib/appNavigation";
import { getFullUrl, getOrRefreshAccessToken, resetRefreshCooldown } from "@/lib/queryClient";
import { clearGuestSessionArtifacts } from "@/lib/shopRoutes";
import { clearTokens, getRefreshToken, saveRefreshToken, setAccessToken } from "@/lib/tokenManager";
import { clearUserSessionReplaced, notifyUserSessionExpiredSafe } from "@/lib/sessionGuard";

type NavigateFn = (to: string, options?: { replace?: boolean }) => void;

async function applyUserAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  clearGuestSessionArtifacts();
  resetRefreshCooldown();
  clearUserSessionReplaced();
  setAccessToken(accessToken);
  await saveRefreshToken(refreshToken);
}

async function fetchUserProfile(accessToken: string): Promise<User | null> {
  const meResponse = await fetch(getFullUrl("/api/users/me"), {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!meResponse.ok) return null;

  const meData = await meResponse.json();
  if (meData.success && meData.user) {
    return {
      ...meData.user,
      attendanceRecords: meData.attendanceRecords || [],
    };
  }

  if (meData.id) {
    return {
      ...meData,
      attendanceRecords: meData.attendanceRecords || [],
    };
  }

  return null;
}

/** 사용자(게임) 로그인 — 토큰 저장 + 프로필 조회 후 이동 */
export async function finalizeUserSessionLogin(
  accessToken: string,
  refreshToken: string,
  setUser: (user: User) => void,
  navigate: NavigateFn,
  fallbackUser?: User | null,
): Promise<boolean> {
  await applyUserAuthTokens(accessToken, refreshToken);

  const profile = await fetchUserProfile(accessToken);
  if (profile) {
    setUser(profile);
    await completeLoginNavigation(navigate, DEFAULT_POST_LOGIN_FALLBACK);
    return true;
  }

  if (fallbackUser) {
    setUser({
      ...fallbackUser,
      attendanceRecords: fallbackUser.attendanceRecords || [],
    });
    await completeLoginNavigation(navigate, DEFAULT_POST_LOGIN_FALLBACK);
    return true;
  }

  return false;
}

/** 저장된 refresh 토큰으로 세션 복원 — 성공 시 이동까지 처리 */
export async function tryRestoreUserSession(
  setUser: (user: User) => void,
  navigate: NavigateFn,
): Promise<boolean> {
  const accessToken = await getOrRefreshAccessToken();
  if (!accessToken) return false;

  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearTokens();
    return false;
  }

  const ok = await finalizeUserSessionLogin(accessToken, refreshToken, setUser, navigate);
  if (!ok) {
    await clearTokens();
  }
  return ok;
}

export function notifyUserSessionExpired(): void {
  notifyUserSessionExpiredSafe();
}

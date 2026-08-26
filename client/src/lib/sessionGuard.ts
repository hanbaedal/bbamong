/** 예측 게임(/prediction) 진행 중 — 세션 만료 팝업·토큰 삭제 지연 */

import { isUserAuthPublicPath } from "@/lib/loginSession";

let gameSessionProtected = false;
let pendingSessionExpired = false;
let pendingDuplicateLogin = false;
let pendingLoginAttempt = false;
let sessionReplaced = false;

export function markUserSessionReplaced(): void {
  sessionReplaced = true;
}

export function clearUserSessionReplaced(): void {
  sessionReplaced = false;
}

export function isUserSessionReplaced(): boolean {
  return sessionReplaced;
}

export function setGameSessionProtected(active: boolean): void {
  gameSessionProtected = active;
  if (!active) {
    flushDeferredSessionEvents();
  }
}

export function isGameSessionProtected(): boolean {
  return gameSessionProtected;
}

export function hasPendingSessionEvent(): boolean {
  return pendingSessionExpired || pendingDuplicateLogin || pendingLoginAttempt;
}

export function queueSessionExpiredWhileInGame(): void {
  if (!gameSessionProtected) return;
  pendingSessionExpired = true;
}

export function queueDuplicateLoginWhileInGame(): void {
  if (!gameSessionProtected) return;
  pendingDuplicateLogin = true;
}

function dispatchSessionExpired(): void {
  window.dispatchEvent(new CustomEvent("user-session-expired"));
}

function dispatchDuplicateLogin(): void {
  window.dispatchEvent(new CustomEvent("user-duplicate-login"));
}

function dispatchLoginAttempt(): void {
  window.dispatchEvent(new CustomEvent("user-login-attempt"));
}

/** 게임 화면 이탈 시 보류된 세션 알림 처리 */
export function flushDeferredSessionEvents(): void {
  if (gameSessionProtected) return;
  if (isUserAuthPublicPath()) {
    pendingDuplicateLogin = false;
    pendingSessionExpired = false;
    pendingLoginAttempt = false;
    return;
  }
  if (pendingDuplicateLogin) {
    pendingDuplicateLogin = false;
    dispatchDuplicateLogin();
    return;
  }
  if (pendingSessionExpired) {
    pendingSessionExpired = false;
    dispatchSessionExpired();
  }
  if (pendingLoginAttempt) {
    pendingLoginAttempt = false;
    dispatchLoginAttempt();
  }
}

export function notifyUserSessionExpiredSafe(): void {
  if (typeof window === "undefined") return;
  if (isUserAuthPublicPath()) return;
  if (gameSessionProtected) {
    queueSessionExpiredWhileInGame();
    return;
  }
  dispatchSessionExpired();
}

export function notifyUserDuplicateLoginSafe(): void {
  if (typeof window === "undefined") return;
  if (isUserAuthPublicPath()) return;
  if (gameSessionProtected) {
    queueDuplicateLoginWhileInGame();
    return;
  }
  dispatchDuplicateLogin();
}

/** 다른 기기에서 로그인 시도 — 게임 중에도 즉시 알림(세션은 유지) */
export function notifyUserLoginAttemptSafe(): void {
  if (typeof window === "undefined") return;
  if (isUserAuthPublicPath()) return;
  // 게임 보호 중이어도 플레이는 유지하고 알림만 즉시 표시
  dispatchLoginAttempt();
}

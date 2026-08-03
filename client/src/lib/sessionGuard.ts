/** 예측 게임(/prediction) 진행 중 — 세션 만료 팝업·토큰 삭제 지연 */

import { isUserAuthPublicPath } from "@/lib/loginSession";

let gameSessionProtected = false;
let pendingSessionExpired = false;
let pendingDuplicateLogin = false;

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
  return pendingSessionExpired || pendingDuplicateLogin;
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

/** 게임 화면 이탈 시 보류된 세션 알림 처리 */
export function flushDeferredSessionEvents(): void {
  if (gameSessionProtected) return;
  if (isUserAuthPublicPath()) {
    pendingDuplicateLogin = false;
    pendingSessionExpired = false;
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

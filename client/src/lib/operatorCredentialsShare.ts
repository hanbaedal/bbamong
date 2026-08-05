import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

export type ShareCredentialsResult = "shared" | "copied" | "failed" | "cancelled";

export interface OperatorSharePayload {
  title: string;
  text: string;
  url: string;
  fullText: string;
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|SamsungBrowser/i.test(navigator.userAgent);
}

function isAndroidBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** 스마트폰·태블릿 등 OS 공유 가능 여부 (PC QR 표시 판별에도 사용) */
export function canUseNativeShare(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return isMobileBrowser() && typeof navigator.share === "function";
}

function isShareCancelled(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message === "Share canceled";
  }
  return false;
}

async function tryWebShare(data: ShareData): Promise<"shared" | "cancelled" | "skip"> {
  if (typeof navigator.share !== "function") return "skip";
  try {
    if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
      return "skip";
    }
    await navigator.share(data);
    return "shared";
  } catch (error) {
    if (isShareCancelled(error)) return "cancelled";
    return "skip";
  }
}

/** Android Chrome — 카카오톡 앱으로 본문 직접 전달 */
function tryAndroidKakaoTalkIntent(fullText: string): boolean {
  if (!isAndroidBrowser() || Capacitor.isNativePlatform()) return false;
  try {
    const intentUrl =
      `intent://send#Intent;type=text/plain;` +
      `S.android.intent.extra.TEXT=${encodeURIComponent(fullText)};` +
      `package=com.kakao.talk;end`;
    window.location.href = intentUrl;
    return true;
  } catch {
    return false;
  }
}

export async function shareOperatorCredentials(
  payload: OperatorSharePayload,
): Promise<"shared" | "cancelled" | "failed"> {
  const { title, text, url, fullText } = payload;

  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title,
        text: fullText,
        url: url || undefined,
        dialogTitle: "카카오톡 등으로 보내기",
      });
      return "shared";
    } catch (error) {
      if (isShareCancelled(error)) return "cancelled";
    }
  }

  if (tryAndroidKakaoTalkIntent(fullText)) {
    return "shared";
  }

  // iOS·기타 모바일 — Web Share (카카오톡 선택)
  const attempts: ShareData[] = [
    { title, text: fullText },
    { title, text: `${text}\n\n${url}` },
    { title, text, url },
    { title, url },
  ];

  for (const data of attempts) {
    const result = await tryWebShare(data);
    if (result === "shared" || result === "cancelled") return result;
  }

  return "failed";
}

export async function copyOperatorCredentials(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** PC에서 폰 카톡 전송용 QR (로그인 링크 URL) */
export function buildLoginLinkQrImageUrl(loginLinkUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(loginLinkUrl)}`;
}

/**
 * 생성 직후: OS/브라우저 공유를 먼저 시도하고, 불가·실패 시 클립보드 복사.
 */
export async function deliverOperatorCredentials(
  payload: OperatorSharePayload,
): Promise<ShareCredentialsResult> {
  const shared = await shareOperatorCredentials(payload);
  if (shared === "shared") return "shared";
  if (shared === "cancelled") return "cancelled";
  const copied = await copyOperatorCredentials(payload.fullText);
  return copied ? "copied" : "failed";
}

/** 카카오톡 공유 — PC는 복사 우선, 모바일은 공유 시트·카카오 앱 */
export async function shareOperatorCredentialsForKakao(
  payload: OperatorSharePayload,
): Promise<ShareCredentialsResult> {
  if (!canUseNativeShare() && !isAndroidBrowser()) {
    const copied = await copyOperatorCredentials(payload.fullText);
    return copied ? "copied" : "failed";
  }

  const shared = await shareOperatorCredentials(payload);
  if (shared === "shared") return "shared";
  if (shared === "cancelled") return "cancelled";

  const copied = await copyOperatorCredentials(payload.fullText);
  return copied ? "copied" : "failed";
}

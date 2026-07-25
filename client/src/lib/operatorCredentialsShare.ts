import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

export type ShareCredentialsResult = "shared" | "copied" | "failed";

/** 스마트폰·태블릿 등 OS 공유(카톡 선택) 가능 여부 */
export function canUseNativeShare(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function shareOperatorCredentials(
  title: string,
  text: string,
): Promise<"shared" | "failed"> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title,
        text,
        dialogTitle: "카카오톡 등으로 보내기",
      });
      return "shared";
    } catch (error) {
      if ((error as Error).message === "Share canceled") {
        return "failed";
      }
    }
  } else if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return "failed";
      }
    }
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

/** 생성 직후: 공유 가능하면 공유, PC면 복사 */
export async function deliverOperatorCredentials(
  title: string,
  text: string,
): Promise<ShareCredentialsResult> {
  if (canUseNativeShare()) {
    const shared = await shareOperatorCredentials(title, text);
    return shared === "shared" ? "shared" : "failed";
  }
  const copied = await copyOperatorCredentials(text);
  return copied ? "copied" : "failed";
}

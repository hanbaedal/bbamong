import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

export type ShareCredentialsResult = "shared" | "copied" | "failed";

export async function shareOperatorCredentials(
  title: string,
  text: string,
): Promise<ShareCredentialsResult> {
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

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

import { useEffect } from "react";
import { getOrRefreshAccessToken } from "@/lib/queryClient";
import { isIframeEmbedMode, isGameEmbedAuthRequestMessage, respondToEmbedAuthRequest } from "@/lib/gameEmbed";

/** embed iframe의 토큰 요청 — 부모(게임·홈) 창에서 항상 응답 */
export default function GameEmbedAuthBridge() {
  useEffect(() => {
    if (isIframeEmbedMode()) return;

    const onMessage = (event: MessageEvent) => {
      if (!isGameEmbedAuthRequestMessage(event.data)) return;

      void getOrRefreshAccessToken().then((token) => {
        respondToEmbedAuthRequest(event, token);
      });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}

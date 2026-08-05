import { useEffect } from "react";
import {
  isGameEmbedMode,
  listenForEmbedAccessToken,
  requestEmbedAccessToken,
} from "@/lib/gameEmbed";
import { lockGameLandscape } from "@/lib/gameOrientation";
import { setAccessToken } from "@/lib/tokenManager";

/** ?embed=1 페이지 — 헤더·하단 네비 숨김 + 가로 유지 + 부모 토큰 수신 */
export default function GameEmbedBootstrap() {
  useEffect(() => {
    if (!isGameEmbedMode()) return;

    document.documentElement.classList.add("game-embed");
    void lockGameLandscape();

    const stopListen = listenForEmbedAccessToken((token) => {
      setAccessToken(token);
    });

    void requestEmbedAccessToken().then((token) => {
      if (token) setAccessToken(token);
    });

    return () => {
      document.documentElement.classList.remove("game-embed");
      stopListen();
    };
  }, []);

  return null;
}

import { useEffect } from "react";
import { isIframeEmbedMode } from "@/lib/gameEmbed";
import { lockGameLandscape } from "@/lib/gameOrientation";

/** ?embed=1 iframe URL — 헤더·하단 네비 숨김 + 가로 유지 (인라인 패널은 panel-embed CSS 사용) */
export default function GameEmbedBootstrap() {
  useEffect(() => {
    if (!isIframeEmbedMode()) return;

    document.documentElement.classList.add("game-embed");
    void lockGameLandscape();

    return () => {
      document.documentElement.classList.remove("game-embed");
    };
  }, []);

  return null;
}

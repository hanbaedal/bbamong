import { useEffect } from "react";
import { isGameEmbedMode } from "@/lib/gameEmbed";
import { lockGameLandscape } from "@/lib/gameOrientation";

/** ?embed=1 페이지 — 헤더·하단 네비 숨김 + 가로 유지 */
export default function GameEmbedBootstrap() {
  useEffect(() => {
    if (!isGameEmbedMode()) return;

    document.documentElement.classList.add("game-embed");
    void lockGameLandscape();

    return () => {
      document.documentElement.classList.remove("game-embed");
    };
  }, []);

  return null;
}

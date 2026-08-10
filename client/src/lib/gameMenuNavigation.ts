import type { GameMenuAction } from "@/components/game/GameLeftMenu";
import { navigateToHome, openMallFromApp } from "@/lib/appNavigation";
import { navigateUserApp } from "@/lib/landscapeSplitRoutes";
import {
  GAME_INFO_BASE,
  GAME_STORY_BASE,
  gameInfoPath,
  gameStoryPath,
} from "@/lib/gameSplitConfig";

/** 예측 게임 · 게임 split — 좌측 4아이콘 메뉴 공통 동작 */
export function handleGameMenuSelect(
  action: GameMenuAction,
  setLocation: (path: string) => void,
): void {
  if (action === "home") {
    navigateToHome();
    return;
  }
  if (action === "mall") {
    openMallFromApp();
    return;
  }
  if (action === "story") {
    navigateUserApp(gameStoryPath("victory"), setLocation);
    return;
  }
  if (action === "info") {
    navigateUserApp(gameInfoPath("profile"), setLocation);
  }
}

export function isGameSplitPath(pathname: string): boolean {
  const base = pathname.split("?")[0] || pathname;
  return base.startsWith(GAME_STORY_BASE) || base.startsWith(GAME_INFO_BASE);
}

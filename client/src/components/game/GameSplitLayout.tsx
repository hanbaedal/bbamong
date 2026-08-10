import type { ReactNode } from "react";
import { useCallback } from "react";
import { useLocation } from "wouter";
import GameLeftMenu, { type GameMenuAction } from "@/components/game/GameLeftMenu";
import LandscapeMasterDetailShell from "@/components/landscape/LandscapeMasterDetailShell";
import { handleGameMenuSelect } from "@/lib/gameMenuNavigation";
import type { LandscapeTheme } from "@/lib/landscapeTheme";
import "@/styles/landscape-split.css";

interface GameSplitLayoutProps {
  activeMenu: Extract<GameMenuAction, "story" | "info">;
  title: string;
  theme: LandscapeTheme;
  backTo?: string;
  left: ReactNode;
  right: ReactNode;
  leftHeader?: ReactNode;
  testId?: string;
}

/**
 * 게임 내이야기·내정보 split — 예측 화면과 동일한 좌측 4아이콘 + hub 서브메뉴·상세
 */
export default function GameSplitLayout({
  activeMenu,
  title,
  theme,
  backTo = "/prediction",
  left,
  right,
  leftHeader,
  testId,
}: GameSplitLayoutProps) {
  const [, setLocation] = useLocation();

  const onMenuSelect = useCallback(
    (action: GameMenuAction) => handleGameMenuSelect(action, setLocation),
    [setLocation],
  );

  return (
    <div className="game-split-layout user-landscape-page" data-testid={testId}>
      <GameLeftMenu activePanel={activeMenu} onSelect={onMenuSelect} />
      <div className="game-split-layout__main">
        <LandscapeMasterDetailShell
          title={title}
          theme={theme}
          backTo={backTo}
          left={left}
          right={right}
          leftHeader={leftHeader}
          nested
          testId={`${testId}-shell`}
        />
      </div>
    </div>
  );
}

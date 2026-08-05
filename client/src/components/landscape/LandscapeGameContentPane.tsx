import type { ComponentType } from "react";
import type { LandscapeTheme } from "@/lib/landscapeTheme";
import { LANDSCAPE_THEME_CLASS } from "@/lib/landscapeTheme";
import { cn } from "@/lib/utils";

/** 게임 메뉴 기존 페이지 — 컴팩트 embed */
export default function LandscapeGameContentPane({
  theme,
  component: Component,
}: {
  theme: LandscapeTheme;
  component: ComponentType;
}) {
  return (
    <div className={cn("lscape-pane lscape-pane--game", LANDSCAPE_THEME_CLASS[theme])}>
      <div className="lscape-pane__scroll panel-embed landscape-game-embed">
        <Component />
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import type { LandscapeTheme } from "@/lib/landscapeTheme";
import { LANDSCAPE_THEME_CLASS } from "@/lib/landscapeTheme";
import { cn } from "@/lib/utils";

interface LandscapeCompactPaneProps {
  theme: LandscapeTheme;
  children: ReactNode;
  className?: string;
}

/** 우측 상세·작성 영역 — 기능별 테마 + 컴팩트 스크롤 */
export default function LandscapeCompactPane({ theme, children, className }: LandscapeCompactPaneProps) {
  return (
    <div className={cn("lscape-pane", LANDSCAPE_THEME_CLASS[theme], className)}>
      <div className="lscape-pane__scroll">{children}</div>
    </div>
  );
}

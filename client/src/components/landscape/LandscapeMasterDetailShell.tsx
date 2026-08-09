import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import type { LandscapeTheme } from "@/lib/landscapeTheme";
import { LANDSCAPE_THEME_CLASS } from "@/lib/landscapeTheme";
import { useAndroidImmersiveMode } from "@/hooks/useAndroidImmersiveMode";
import { cn } from "@/lib/utils";
import "@/styles/landscape-split.css";

interface LandscapeMasterDetailShellProps {
  title: string;
  backTo: string;
  theme: LandscapeTheme;
  left: ReactNode;
  right: ReactNode;
  leftHeader?: ReactNode;
  testId?: string;
}

export function LandscapeEmptyPane({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="lscape-empty">
      <p className="lscape-empty__message">{message}</p>
      {hint ? <p className="lscape-empty__hint">{hint}</p> : null}
    </div>
  );
}

/** 가로 — 좌 리스트 · 우 상세 */
export default function LandscapeMasterDetailShell({
  title,
  backTo,
  theme,
  left,
  right,
  leftHeader,
  testId = "landscape-master-detail",
}: LandscapeMasterDetailShellProps) {
  const [, setLocation] = useLocation();
  const themeClass = LANDSCAPE_THEME_CLASS[theme];
  // 공지·문의·게시판 등 split 페이지 — 시스템 내비/상태바 숨김
  useAndroidImmersiveMode();

  return (
    <div
      className={cn("landscape-master-detail user-landscape-page", themeClass)}
      data-testid={testId}
    >
      <header className="landscape-master-detail__header">
        <button
          type="button"
          className="landscape-master-detail__back"
          onClick={() => setLocation(backTo)}
          data-testid="button-back"
          aria-label="뒤로"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="landscape-master-detail__title-wrap">
          <span className="landscape-master-detail__accent" aria-hidden />
          <h1 className="landscape-master-detail__title">{title}</h1>
        </div>
      </header>
      <div className="landscape-master-detail__body">
        <aside className="landscape-master-detail__left">
          {leftHeader ? (
            <div className="landscape-master-detail__left-header">{leftHeader}</div>
          ) : null}
          <div className="lscape-left-scroll">{left}</div>
        </aside>
        <main className="landscape-master-detail__right">{right}</main>
      </div>
    </div>
  );
}

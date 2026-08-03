import type { ReactNode } from "react";

interface LandscapeSplitShellProps {
  left: ReactNode;
  right: ReactNode;
  footer?: ReactNode;
  testId?: string;
  pageClassName?: string;
}

/** 사용자 앱 — 가로 2등분 한 페이지 shell (왼쪽 캐릭터 · 오른쪽 콘텐츠) */
export default function LandscapeSplitShell({
  left,
  right,
  footer,
  testId,
  pageClassName,
}: LandscapeSplitShellProps) {
  return (
    <div
      className={pageClassName ? `user-landscape-page ${pageClassName}` : "user-landscape-page"}
      data-testid={testId}
    >
      <div className="user-landscape-split">
        <div className="user-landscape-left">{left}</div>
        <div className="user-landscape-right">{right}</div>
      </div>
      {footer ? <div className="user-landscape-footer">{footer}</div> : null}
    </div>
  );
}

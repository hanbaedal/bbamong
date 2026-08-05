import type { ReactNode } from "react";
import {
  adminPageContentClass,
  adminPageShellClass,
  adminPageTitleClass,
} from "./adminPageStyles";

interface AdminPageShellProps {
  title: string;
  /** @deprecated 부가 설명은 표시하지 않습니다 */
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
}

/** 관리자 페이지 공통: 풀 너비 + 반응형 타이포 */
export default function AdminPageShell({
  title,
  icon,
  actions,
  headerExtra,
  children,
}: AdminPageShellProps) {
  return (
    <div className={adminPageShellClass}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3 lg:mb-4 shrink-0">
        <div className="min-w-0">
          <h1 className={adminPageTitleClass}>
            {icon}
            {title}
          </h1>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {headerExtra}
      <div className={adminPageContentClass}>{children}</div>
    </div>
  );
}

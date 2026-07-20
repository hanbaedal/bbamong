import type { ReactNode } from "react";
import {
  adminPageContentClass,
  adminPageDescClass,
  adminPageShellClass,
  adminPageTitleClass,
} from "./adminPageStyles";

interface AdminPageShellProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
}

/** 관리자 페이지 공통: 풀 너비 + 반응형 타이포 */
export default function AdminPageShell({
  title,
  description,
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
          {description ? <p className={adminPageDescClass}>{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {headerExtra}
      <div className={adminPageContentClass}>{children}</div>
    </div>
  );
}

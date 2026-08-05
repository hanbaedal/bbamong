import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OpsPlatformTabs, type OpsPlatform } from "../ops/opsLoginStatusUi";

export const adminCompactTableClass = "w-full text-xs border-collapse";

export const adminCompactTheadRowClass =
  "bg-[#F3F0FF] border-b border-[#E8E4F3] text-left text-[11px] text-[#6B5B95]";

export const adminCompactThClass = "px-2 py-2 font-semibold whitespace-nowrap";

export const adminCompactTdClass = "px-2 py-1.5 text-[#201E22] align-middle";

export const adminCompactTrClass =
  "border-b border-[#EDE9F6]/80 hover:bg-[#FAFAFA] transition-colors";

export function AdminCompactListPage({
  title,
  actions,
  platformTabs,
  tabs,
  children,
  footer,
}: {
  title: string;
  actions?: ReactNode;
  platformTabs?: {
    platform: OpsPlatform;
    counts: { ppamong: number; badminton9: number };
    onChange: (p: OpsPlatform) => void;
    ppamongSublabel: string;
    badminton9Sublabel: string;
    countLabel?: string;
  };
  tabs?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col h-full min-h-0 -mx-3 sm:-mx-4 md:-mx-5 lg:-mx-6 xl:-mx-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8">
        <p className="text-sm font-semibold text-[#201E22]" data-testid="page-title">
          {title}
        </p>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {platformTabs ? (
        <div className="px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 mb-3">
          <OpsPlatformTabs {...platformTabs} />
        </div>
      ) : null}

      {tabs ? (
        <div className="flex gap-4 md:gap-6 border-b border-[#E9E9E9] mb-3 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8">
          {tabs}
        </div>
      ) : null}

      {children}

      {footer ? (
        <div className="px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 mt-3 shrink-0">{footer}</div>
      ) : null}
    </div>
  );
}

export function AdminCompactTableShell({
  minWidth = 720,
  children,
  emptyMessage,
  isLoading,
  loadingRows = 8,
  loadingCols = 6,
}: {
  minWidth?: number;
  children?: ReactNode;
  emptyMessage?: string;
  isLoading?: boolean;
  loadingRows?: number;
  loadingCols?: number;
}) {
  const tableClass = cn(adminCompactTableClass, `min-w-[${minWidth}px]`);

  return (
    <div className="flex-1 overflow-auto min-h-0 mx-3 sm:mx-4 md:mx-5 lg:mx-6 xl:mx-8 border border-[#E8E4F3] rounded-lg overflow-x-auto">
      {isLoading ? (
        <table className={tableClass} style={{ minWidth }}>
          <tbody>
            {Array.from({ length: loadingRows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-[#F0F0F0] animate-pulse">
                {Array.from({ length: loadingCols }).map((__, colIdx) => (
                  <td key={colIdx} className="px-2 py-2">
                    <div className="h-3 bg-[#E9E9E9] rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : emptyMessage ? (
        <div className="py-12 text-center text-sm text-[#BFBFBF]">{emptyMessage}</div>
      ) : (
        children
      )}
    </div>
  );
}

export function AdminCompactTable({
  minWidth = 720,
  children,
}: {
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <table className={adminCompactTableClass} style={{ minWidth }}>
      {children}
    </table>
  );
}

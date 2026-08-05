import type { ReactNode } from "react";
import { adminTableWrapClass } from "../components/adminPageStyles";
import { OpsPlatformTabs, type OpsPlatform } from "../ops/opsLoginStatusUi";

export type MemberPlatform = OpsPlatform;

export interface MemberPlatformCounts {
  ppamong: number;
  badminton9: number;
}

export interface MemberPaginatedMeta {
  platform: MemberPlatform;
  counts: MemberPlatformCounts;
}

export const memberCompactTableClass = "w-full text-xs min-w-[480px]";

export const memberTheadRowClass =
  "bg-[#F3F0FF] border-b border-[#E8E4F3] text-left text-[11px] text-[#6B5B95]";

export function MemberPlatformTabsBar({
  platform,
  counts,
  onChange,
}: {
  platform: MemberPlatform;
  counts: MemberPlatformCounts;
  onChange: (platform: MemberPlatform) => void;
}) {
  return (
    <OpsPlatformTabs
      platform={platform}
      counts={counts}
      onChange={onChange}
      ppamongSublabel="빠몽 앱 가입 회원"
      badminton9Sublabel="PG 동기화 레거시"
    />
  );
}

export function MemberTableShell({ children }: { children: ReactNode }) {
  return <div className={adminTableWrapClass}>{children}</div>;
}

export function MemberTableLoading({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <MemberTableShell>
      <table className={memberCompactTableClass}>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-[#F0F0F0]">
              {Array.from({ length: cols }).map((__, colIdx) => (
                <td key={colIdx} className="px-2.5 py-2">
                  <div className="h-3 bg-[#E9E9E9] rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </MemberTableShell>
  );
}

export function MemberTableEmpty({ message }: { message: string }) {
  return (
    <MemberTableShell>
      <div className="py-10 text-center text-xs text-[#888]">{message}</div>
    </MemberTableShell>
  );
}

export function formatCompactDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function formatCompactDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${h}:${min}`;
}

export function truncateText(value: string | null | undefined, max = 14): string {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export const memberThClass = "px-2 py-2 font-semibold whitespace-nowrap text-[#6B5B95]";
export const memberTdClass = "px-2 py-1.5 text-[#201E22] align-middle";
export const memberRowClass =
  "border-b border-[#EDE9F6]/80 hover:bg-[#FAFAFA] transition-colors";

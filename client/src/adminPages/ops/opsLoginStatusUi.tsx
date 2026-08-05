import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type OpsPlatform = "ppamong" | "badminton9";

export interface OpsLoginStatusResponse {
  rows: OpsLoginStatusRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  platform: OpsPlatform;
  counts: { ppamong: number; badminton9: number };
}

export interface OpsLoginStatusRow {
  id: string;
  username: string;
  name: string;
  userType?: string;
  department?: string | null;
  position?: string | null;
  assignedMatchNumber?: string | null;
  platform: OpsPlatform;
  status: "온라인" | "오프라인";
  lastLogin: string | null;
  lastLogout: string | null;
  sessionDuration: string;
}

export function formatOpsDateTime(date: string | null) {
  if (!date) return "—";
  const d = new Date(date);
  return format(d, "yyyy.MM.dd aa h:mm:ss", { locale: ko });
}

export function PlatformTab({
  active,
  label,
  sublabel,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  sublabel: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-3 text-left transition-colors min-w-[140px]",
        active
          ? "border-[#E11936] bg-[#FFF5F6] ring-1 ring-[#E11936]/20"
          : "border-[#E9E9E9] bg-white hover:bg-[#FAFAFA]",
      )}
    >
      <p className={cn("text-sm font-semibold", active ? "text-[#E11936]" : "text-[#201E22]")}>
        {label}
      </p>
      <p className="text-[11px] text-[#888] mt-0.5">{sublabel}</p>
      <p className="text-lg font-bold tabular-nums text-[#201E22] mt-1">{count}명</p>
    </button>
  );
}

export function OnlineBadge({ status }: { status: "온라인" | "오프라인" }) {
  const online = status === "온라인";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        online ? "bg-[#E3F2FD] text-[#1565C0]" : "bg-[#F5F5F5] text-[#888]",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-[#4285F4]" : "bg-[#CCC]")} />
      {status}
    </span>
  );
}

export function OpsPlatformTabs({
  platform,
  counts,
  onChange,
  ppamongSublabel,
  badminton9Sublabel,
}: {
  platform: OpsPlatform;
  counts: { ppamong: number; badminton9: number };
  onChange: (p: OpsPlatform) => void;
  ppamongSublabel: string;
  badminton9Sublabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-3 mb-5">
      <PlatformTab
        active={platform === "ppamong"}
        label="빠몽"
        sublabel={ppamongSublabel}
        count={counts.ppamong}
        onClick={() => onChange("ppamong")}
      />
      <PlatformTab
        active={platform === "badminton9"}
        label="빠던9"
        sublabel={badminton9Sublabel}
        count={counts.badminton9}
        onClick={() => onChange("badminton9")}
      />
    </div>
  );
}

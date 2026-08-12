import { useEffect, useMemo, useState } from "react";
import { managerFetch } from "@/lib/managerQueryClient";
import { useToast } from "@/hooks/use-toast";

type BatterRow = {
  battingOrder: number;
  name: string;
  battingAverage: string;
  hits: string;
  homeRuns: string;
  rbi: string;
  ops: string;
};

export type LineupSide = "home" | "away";

export type ManagerLineupSnapshot = {
  home?: Array<{ battingOrder: number; name: string; playerId?: number }>;
  away?: Array<{ battingOrder: number; name: string; playerId?: number }>;
  source?: string;
};

export type ManagerPlayerStats = Record<
  string,
  {
    battingAverage?: string | null;
    hits?: number | null;
    homeRuns?: number | null;
    rbi?: number | null;
    ops?: string | null;
  }
>;

function emptyRows(): BatterRow[] {
  return Array.from({ length: 9 }, (_, i) => ({
    battingOrder: i + 1,
    name: "",
    battingAverage: "",
    hits: "",
    homeRuns: "",
    rbi: "",
    ops: "",
  }));
}

function rowsFromSnapshot(
  side: LineupSide,
  lineup: ManagerLineupSnapshot | null | undefined,
  stats: ManagerPlayerStats | null | undefined,
): BatterRow[] {
  const rows = emptyRows();
  const list = side === "home" ? lineup?.home : lineup?.away;
  if (!list?.length) return rows;

  for (const entry of list) {
    const order = entry.battingOrder;
    if (order < 1 || order > 9) continue;
    const playerId = entry.playerId ?? (side === "home" ? order : 10 + order);
    const st = stats?.[String(playerId)];
    rows[order - 1] = {
      battingOrder: order,
      name: entry.name ?? "",
      battingAverage: st?.battingAverage ?? "",
      hits: st?.hits != null ? String(st.hits) : "",
      homeRuns: st?.homeRuns != null ? String(st.homeRuns) : "",
      rbi: st?.rbi != null ? String(st.rbi) : "",
      ops: st?.ops ?? "",
    };
  }
  return rows;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function toPayload(rows: BatterRow[]) {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => ({
      battingOrder: r.battingOrder,
      name: r.name.trim(),
      battingAverage: r.battingAverage.trim() || null,
      hits: parseOptionalInt(r.hits),
      homeRuns: parseOptionalInt(r.homeRuns),
      rbi: parseOptionalInt(r.rbi),
      ops: r.ops.trim() || null,
    }));
}

interface ManagerLineupEditorProps {
  matchId: string;
  awayTeamLabel: string;
  homeTeamLabel: string;
  /** 팀명 클릭으로 열 때 해당 팀만 편집 */
  initialSide?: LineupSide;
  seasonYear?: number;
  initialLineup?: ManagerLineupSnapshot | null;
  initialStats?: ManagerPlayerStats | null;
  onSaved?: () => void;
  onClose: () => void;
}

export default function ManagerLineupEditor({
  matchId,
  awayTeamLabel,
  homeTeamLabel,
  initialSide = "away",
  seasonYear = new Date().getFullYear(),
  initialLineup,
  initialStats,
  onSaved,
  onClose,
}: ManagerLineupEditorProps) {
  const { toast } = useToast();
  const [homeRows, setHomeRows] = useState(() =>
    rowsFromSnapshot("home", initialLineup, initialStats),
  );
  const [awayRows, setAwayRows] = useState(() =>
    rowsFromSnapshot("away", initialLineup, initialStats),
  );
  const [saving, setSaving] = useState(false);
  const [activeSide, setActiveSide] = useState<LineupSide>(initialSide);

  useEffect(() => {
    setHomeRows(rowsFromSnapshot("home", initialLineup, initialStats));
    setAwayRows(rowsFromSnapshot("away", initialLineup, initialStats));
  }, [initialLineup, initialStats]);

  useEffect(() => {
    setActiveSide(initialSide);
  }, [initialSide]);

  const activeRows = activeSide === "home" ? homeRows : awayRows;
  const setActiveRows = activeSide === "home" ? setHomeRows : setAwayRows;
  const teamLabel =
    activeSide === "home" ? homeTeamLabel || "홈" : awayTeamLabel || "원정";

  const namedCount = useMemo(
    () => activeRows.filter((r) => r.name.trim()).length,
    [activeRows],
  );

  const updateRow = (order: number, patch: Partial<BatterRow>) => {
    setActiveRows((prev) =>
      prev.map((row) => (row.battingOrder === order ? { ...row, ...patch } : row)),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 편집 중인 팀만 갱신하고, 반대 팀은 기존 스냅샷을 유지
      const res = await managerFetch(`/api/manager/matches/${matchId}/lineup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: activeSide,
          home: activeSide === "home" ? toPayload(homeRows) : undefined,
          away: activeSide === "away" ? toPayload(awayRows) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.error === "string" ? err.error : "타순 저장에 실패했습니다.");
      }
      toast({ description: `${teamLabel} 주전 타순·${seasonYear} 전적을 저장했습니다.` });
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "타순 저장에 실패했습니다.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-3"
      data-testid="manager-lineup-editor"
    >
      <div className="w-full max-w-lg max-h-[90dvh] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col">
        <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {teamLabel} · 주전 타순
            </h2>
            <p className="text-[11px] text-gray-500">
              {seasonYear} 전적(타율·안타·홈런·타점·OPS) · 입력 {namedCount}/9 · API 덮어쓰기 없음
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 px-2 py-1"
            data-testid="button-lineup-close"
          >
            닫기
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          <p className="text-[11px] text-gray-500 px-0.5">
            1~9번 주전만 등록합니다. 예측 화면은 운영자 「다음 타자」 순서에 맞춰 표시됩니다.
          </p>
          {activeRows.map((row) => (
            <div
              key={row.battingOrder}
              className="grid grid-cols-[1.5rem_1fr] gap-x-2 gap-y-1 items-start border border-gray-100 rounded-lg p-2"
            >
              <span className="text-xs font-bold text-gray-500 pt-2">{row.battingOrder}</span>
              <div className="space-y-1">
                <input
                  value={row.name}
                  onChange={(e) => updateRow(row.battingOrder, { name: e.target.value })}
                  placeholder="타자 이름"
                  className="w-full h-8 rounded border border-gray-200 px-2 text-sm"
                  data-testid={`input-lineup-name-${activeSide}-${row.battingOrder}`}
                />
                <div className="grid grid-cols-5 gap-1">
                  {(
                    [
                      ["battingAverage", "타율"],
                      ["hits", "안타"],
                      ["homeRuns", "홈런"],
                      ["rbi", "타점"],
                      ["ops", "OPS"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="block text-[9px] text-gray-400 leading-none mb-0.5">{label}</span>
                      <input
                        value={row[key]}
                        onChange={(e) => updateRow(row.battingOrder, { [key]: e.target.value })}
                        className="w-full h-7 rounded border border-gray-200 px-1 text-[11px] tabular-nums"
                        data-testid={`input-lineup-${key}-${activeSide}-${row.battingOrder}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="flex gap-2 px-3 py-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-lg bg-gray-100 text-sm font-medium text-gray-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 h-10 rounded-lg bg-[#1A6DFF] text-sm font-semibold text-white disabled:opacity-50"
            data-testid="button-lineup-save"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </footer>
      </div>
    </div>
  );
}

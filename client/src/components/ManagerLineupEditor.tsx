import { useEffect, useMemo, useState } from "react";
import { managerFetch } from "@/lib/managerQueryClient";
import { useToast } from "@/hooks/use-toast";
import type { KboRosterPlayer } from "@shared/kboRoster";
import ManagerRosterPicker from "@/components/ManagerRosterPicker";

type BatterRow = {
  battingOrder: number;
  name: string;
  rosterPlayerId: string;
  position: string;
};

export type LineupSide = "home" | "away";

export type ManagerLineupSnapshot = {
  home?: Array<{ battingOrder: number; name: string; playerId?: number; rosterPlayerId?: string }>;
  away?: Array<{ battingOrder: number; name: string; playerId?: number; rosterPlayerId?: string }>;
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
    position?: string | null;
  }
>;

function emptyRows(): BatterRow[] {
  return Array.from({ length: 9 }, (_, i) => ({
    battingOrder: i + 1,
    name: "",
    rosterPlayerId: "",
    position: "",
  }));
}

function nextEmptyOrder(rows: BatterRow[], afterOrder: number): number | null {
  for (let step = 1; step <= 9; step++) {
    const order = ((afterOrder - 1 + step) % 9) + 1;
    if (!rows[order - 1]?.name.trim()) return order;
  }
  return null;
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
      rosterPlayerId: entry.rosterPlayerId ?? "",
      position: st?.position ?? "",
    };
  }
  return rows;
}

interface ManagerLineupEditorProps {
  matchId: string;
  awayTeamLabel: string;
  homeTeamLabel: string;
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
  const [pickerOrder, setPickerOrder] = useState<number | null>(() => {
    const rows = rowsFromSnapshot(initialSide, initialLineup, initialStats);
    return rows.every((row) => !row.name.trim()) ? 1 : null;
  });
  const [players, setPlayers] = useState<KboRosterPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setLoadingPlayers(true);
    void managerFetch(
      `/api/manager/matches/${matchId}/kbo-roster?side=${activeSide}&season=${seasonYear}`,
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("선수단을 불러오지 못했습니다.");
        const data = (await res.json()) as { players?: KboRosterPlayer[] };
        if (!cancelled) setPlayers(data.players ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlayers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlayers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, activeSide, seasonYear]);

  const namedCount = useMemo(
    () => activeRows.filter((r) => r.name.trim()).length,
    [activeRows],
  );

  const pickingRow = pickerOrder
    ? activeRows.find((row) => row.battingOrder === pickerOrder)
    : undefined;

  const takenOrders = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of activeRows) {
      if (row.rosterPlayerId && row.battingOrder !== pickerOrder) {
        map[row.rosterPlayerId] = row.battingOrder;
      }
    }
    return map;
  }, [activeRows, pickerOrder]);

  const handlePick = (player: KboRosterPlayer) => {
    if (pickerOrder == null) return;
    const taken = activeRows.find(
      (row) => row.rosterPlayerId === player.id && row.battingOrder !== pickerOrder,
    );
    if (taken) {
      toast({
        variant: "destructive",
        description: `${player.name}은(는) 이미 ${taken.battingOrder}번에 있습니다.`,
      });
      return;
    }
    const fillingEmpty = !pickingRow?.name.trim();
    const nextRows = activeRows.map((row) =>
      row.battingOrder === pickerOrder
        ? {
            ...row,
            name: player.name,
            rosterPlayerId: player.id,
            position: player.position,
          }
        : row,
    );
    setActiveRows(nextRows);
    setPickerOrder(fillingEmpty ? nextEmptyOrder(nextRows, pickerOrder) : null);
  };

  const clearRow = (order: number) => {
    setActiveRows((prev) =>
      prev.map((row) =>
        row.battingOrder === order
          ? { ...row, name: "", rosterPlayerId: "", position: "" }
          : row,
      ),
    );
  };

  const handleSave = async () => {
    const payload = activeRows
      .filter((r) => r.name.trim() || r.rosterPlayerId)
      .map((r) => ({
        battingOrder: r.battingOrder,
        name: r.name.trim(),
        rosterPlayerId: r.rosterPlayerId || undefined,
      }));
    if (payload.length === 0) {
      toast({ variant: "destructive", description: "선수를 한 명 이상 선택하세요." });
      return;
    }
    setSaving(true);
    try {
      const res = await managerFetch(`/api/manager/matches/${matchId}/lineup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: activeSide,
          home: activeSide === "home" ? payload : undefined,
          away: activeSide === "away" ? payload : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.error === "string" ? err.error : "타순 저장에 실패했습니다.");
      }
      toast({ description: `${teamLabel} 주전 타순을 저장했습니다.` });
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
      <div className="w-full max-w-md max-h-[90dvh] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col">
        <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">{teamLabel} · 주전 타순</h2>
            <p className="text-[11px] text-gray-500">
              선수를 고르면 다음 타순으로 이어집니다 · {namedCount}/9
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

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="grid grid-cols-[2.5rem_1fr] gap-x-2 gap-y-1.5 items-center">
            <span className="text-[10px] font-semibold text-gray-400">순번</span>
            <span className="text-[10px] font-semibold text-gray-400">이름</span>
            {activeRows.map((row) => (
              <div key={row.battingOrder} className="contents">
                <span className="text-sm font-bold text-gray-700 text-center">
                  {row.battingOrder}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPickerOrder(row.battingOrder)}
                    className="flex-1 min-w-0 h-10 rounded-lg border border-gray-200 px-2 text-left text-sm bg-white"
                    data-testid={`input-lineup-name-${activeSide}-${row.battingOrder}`}
                  >
                    {row.name ? (
                      <span className="block truncate">
                        <span className="font-semibold text-gray-900">{row.name}</span>
                        {row.position ? (
                          <span className="ml-1 text-xs text-[#1A6DFF]">{row.position}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-gray-400">선수 선택</span>
                    )}
                  </button>
                  {row.name ? (
                    <button
                      type="button"
                      onClick={() => clearRow(row.battingOrder)}
                      className="shrink-0 h-10 w-8 text-gray-400 text-lg"
                      aria-label={`${row.battingOrder}번 지우기`}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
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
            {saving ? "저장 중…" : namedCount === 9 ? "저장" : `저장 (${namedCount}/9)`}
          </button>
        </footer>
      </div>

      {pickerOrder != null ? (
        <ManagerRosterPicker
          key={pickerOrder}
          teamLabel={`${teamLabel} ${pickerOrder}번`}
          hint={`${namedCount}/9 · 고르면 다음 빈 타순으로 이어집니다`}
          players={players}
          loading={loadingPlayers}
          selectedId={pickingRow?.rosterPlayerId}
          takenOrders={takenOrders}
          onSelect={handlePick}
          onClose={() => setPickerOrder(null)}
        />
      ) : null}
    </div>
  );
}

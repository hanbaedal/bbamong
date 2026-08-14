import { useMemo, useState } from "react";
import type { KboRosterPlayer } from "@shared/kboRoster";

interface ManagerRosterPickerProps {
  teamLabel: string;
  hint?: string;
  players: KboRosterPlayer[];
  loading?: boolean;
  selectedId?: string;
  /** 다른 타순에 이미 들어간 선수 */
  takenOrders?: Record<string, number>;
  onSelect: (player: KboRosterPlayer) => void;
  onClose: () => void;
}

export default function ManagerRosterPicker({
  teamLabel,
  hint,
  players,
  loading = false,
  selectedId,
  takenOrders,
  onSelect,
  onClose,
}: ManagerRosterPickerProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q) ||
        p.jerseyNumber?.toLowerCase().includes(q) ||
        p.batsThrows?.toLowerCase().includes(q),
    );
  }, [players, query]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 p-3"
      data-testid="manager-roster-picker"
    >
      <div className="w-full max-w-md max-h-[85dvh] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col">
        <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">{teamLabel} 선수 선택</h3>
            {hint ? <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm text-gray-500 px-2 py-1"
            data-testid="button-roster-picker-close"
          >
            닫기
          </button>
        </header>
        <div className="px-3 py-2 border-b border-gray-100">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름·포지션 검색"
            className="w-full h-9 rounded border border-gray-200 px-2 text-sm"
            data-testid="input-roster-search"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">불러오는 중…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500 leading-relaxed">
              {players.length === 0
                ? "이 팀 선수가 없습니다. 관리자 「KBO 선수단」에서 먼저 불러오세요."
                : "검색 결과가 없습니다."}
            </p>
          ) : (
            <ul>
              {filtered.map((player) => {
                const takenOrder = takenOrders?.[player.id];
                const taken = takenOrder != null;
                return (
                <li key={player.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(player)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-50 ${
                      selectedId === player.id
                        ? "bg-[#EEF4FF]"
                        : taken
                          ? "bg-gray-50"
                          : "bg-white"
                    }`}
                    data-testid={`button-roster-player-${player.id}`}
                  >
                    <span className="block text-sm font-semibold text-gray-900">
                      {player.jerseyNumber ? (
                        <span className="mr-1.5 text-xs font-medium text-gray-500 tabular-nums">
                          {player.jerseyNumber}
                        </span>
                      ) : null}
                      {player.name}
                      <span className="ml-1.5 text-xs font-medium text-[#1A6DFF]">
                        {player.position}
                      </span>
                      {player.batsThrows ? (
                        <span className="ml-1.5 text-xs font-normal text-gray-500">
                          {player.batsThrows}
                        </span>
                      ) : null}
                      {taken ? (
                        <span className="ml-1.5 text-xs font-medium text-gray-400">
                          {takenOrder}번
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-[11px] text-gray-500 tabular-nums">
                      타율 {player.battingAverage || "—"} · 안타 {player.hits ?? "—"} · 홈런{" "}
                      {player.homeRuns ?? "—"} · 타점 {player.rbi ?? "—"} · OPS {player.ops || "—"}
                    </span>
                    {player.note ? (
                      <span className="block text-[11px] text-gray-400 truncate">{player.note}</span>
                    ) : null}
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

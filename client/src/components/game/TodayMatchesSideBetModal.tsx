import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatMatchTitle, type GameMatchItem } from "@/components/game/gameMatchUtils";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import {
  formatSideBetStatus,
  isSideBetActionEnabled,
  sideBetDisabledReason,
  type SideBetRecord,
} from "@/lib/sideBetMatchUtils";

interface TodaySideBetsResponse {
  betsByMatch: Record<string, SideBetRecord[]>;
}

export interface SideBetActionTarget {
  matchId: string;
  matchTitle: string;
  betType: "winner" | "score";
}

interface TodayMatchesSideBetModalProps {
  open: boolean;
  matches: GameMatchItem[];
  loading?: boolean;
  onAction: (target: SideBetActionTarget) => void;
  onClose: () => void;
}

function betResultLabel(bet: SideBetRecord): string {
  const base =
    bet.type === "winner"
      ? bet.winnerPick === "home"
        ? "홈팀"
        : "원정팀"
      : `${bet.homeScorePick}-${bet.awayScorePick}`;
  const status = formatSideBetStatus(bet.status);
  if (bet.status === "won" && (bet.wonAmount ?? 0) > 0) {
    return `${base} · ${status} (+${bet.wonAmount}P)`;
  }
  return `${base} · ${status}`;
}

export default function TodayMatchesSideBetModal({
  open,
  matches,
  loading,
  onAction,
  onClose,
}: TodayMatchesSideBetModalProps) {
  const { data: todayBets } = useQuery<TodaySideBetsResponse>({
    queryKey: ["/api/live-match/side-bets/me/today"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/live-match/side-bets/me/today");
      return res.json();
    },
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
      data-testid="today-matches-side-bet-modal"
    >
      <div
        className="w-[min(420px,94vw)] max-h-[min(520px,85dvh)] flex flex-col bg-[#1E1E1E] border border-[#444] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-[#333]">
          <h3 className="text-white text-lg font-bold text-center">오늘의 경기</h3>
          <p className="text-[#888] text-xs text-center mt-1 leading-relaxed">
            API 연동 중인 경기만 배팅 가능 · 1회 시작 시 마감
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="text-[#AAA] text-sm text-center py-8">경기 정보를 불러오는 중...</p>
          ) : matches.length === 0 ? (
            <p className="text-[#AAA] text-sm text-center py-8">오늘 진행 예정인 경기가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {matches.map((match) => {
                const title = formatMatchTitle(match.name);
                const stadium = getDisplayStadiumName(match.stadiumName);
                const bets = todayBets?.betsByMatch[match.id] ?? [];
                const winnerBet = bets.find((b) => b.type === "winner");
                const scoreBet = bets.find((b) => b.type === "score");
                const actionEnabled = isSideBetActionEnabled(match);
                const disabledHint = sideBetDisabledReason(match);
                const isCompleted = match.matchStatus === "completed";

                return (
                  <li
                    key={match.id}
                    className="rounded-lg border border-[#444] bg-[#2A2A2A] px-3 py-3"
                    data-testid={`today-match-row-${match.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="block text-sm font-bold text-white truncate">{title}</span>
                        {stadium && (
                          <span className="block text-xs text-[#AAA] mt-0.5 truncate">{stadium}</span>
                        )}
                        {isCompleted && (
                          <span className="block text-xs text-[#888] mt-0.5">경기 종료</span>
                        )}
                      </div>
                      {disabledHint && !isCompleted && (
                        <span className="shrink-0 text-[10px] text-[#888] border border-[#555] rounded px-1.5 py-0.5">
                          {disabledHint}
                        </span>
                      )}
                    </div>

                    {(winnerBet || scoreBet) && (
                      <div className="mb-2 space-y-0.5">
                        {winnerBet && (
                          <p className="text-[11px] text-[#CDFF00]">
                            우승팀: {betResultLabel(winnerBet)}
                          </p>
                        )}
                        {scoreBet && (
                          <p className="text-[11px] text-[#CDFF00]">
                            점수: {betResultLabel(scoreBet)}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!actionEnabled}
                        onClick={() =>
                          onAction({ matchId: match.id, matchTitle: title, betType: "winner" })
                        }
                        className="flex-1 h-9 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#CDFF00] text-black enabled:hover:bg-[#d8ff33]"
                        data-testid={`side-bet-winner-btn-${match.id}`}
                      >
                        {winnerBet ? "우승팀 수정" : "우승팀 맞추기"}
                      </button>
                      <button
                        type="button"
                        disabled={!actionEnabled}
                        onClick={() =>
                          onAction({ matchId: match.id, matchTitle: title, betType: "score" })
                        }
                        className="flex-1 h-9 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#CDFF00] text-black enabled:hover:bg-[#d8ff33]"
                        data-testid={`side-bet-score-btn-${match.id}`}
                      >
                        {scoreBet ? "점수 수정" : "점수 맞추기"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-[#333]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-lg bg-[#474747] text-white font-medium"
            data-testid="today-matches-modal-close"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

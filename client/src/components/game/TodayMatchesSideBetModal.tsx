import { useEffect, useRef, useState } from "react";
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
import SideBetActionPanel from "@/components/game/SideBetActionPanel";

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
  /** 하단 요약 클릭 등으로 오른쪽 패널을 바로 열 때 */
  initialAction?: SideBetActionTarget | null;
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

/** 가로 분할: 왼쪽 오늘의 경기 · 오른쪽 우승팀/점수 입력 */
export default function TodayMatchesSideBetModal({
  open,
  matches,
  loading,
  initialAction = null,
  onClose,
}: TodayMatchesSideBetModalProps) {
  const [activeAction, setActiveAction] = useState<SideBetActionTarget | null>(null);
  const appliedInitialKeyRef = useRef<string | null>(null);

  const { data: todayBets } = useQuery<TodaySideBetsResponse>({
    queryKey: ["/api/live-match/side-bets/me/today"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/live-match/side-bets/me/today");
      return res.json();
    },
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  useEffect(() => {
    if (!open) {
      setActiveAction(null);
      appliedInitialKeyRef.current = null;
      return;
    }
    if (!initialAction) return;
    const key = `${initialAction.matchId}:${initialAction.betType}`;
    if (appliedInitialKeyRef.current === key) return;
    appliedInitialKeyRef.current = key;
    setActiveAction(initialAction);
  }, [open, initialAction]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-3"
      onClick={onClose}
      data-testid="today-matches-side-bet-modal"
    >
      <div
        className="flex h-[min(92dvh,560px)] w-[min(96vw,900px)] overflow-hidden rounded-xl border border-[#444] bg-[#1E1E1E] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 왼쪽 — 경기 목록 */}
        <section className="flex w-1/2 min-w-0 flex-col border-r border-[#333]">
          <div className="shrink-0 border-b border-[#333] px-3 py-2.5">
            <h3 className="text-center text-base font-bold text-white">오늘의 경기</h3>
            <p className="mt-0.5 text-center text-[11px] leading-relaxed text-[#888]">
              API 연동 경기만 배팅 · 1회 시작 시 마감
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-[#AAA]">경기 정보를 불러오는 중...</p>
            ) : matches.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#AAA]">오늘 진행 예정인 경기가 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {matches.map((match) => {
                  const title = formatMatchTitle(match.name);
                  const stadium = getDisplayStadiumName(match.stadiumName);
                  const bets = todayBets?.betsByMatch[match.id] ?? [];
                  const winnerBet = bets.find((b) => b.type === "winner");
                  const scoreBet = bets.find((b) => b.type === "score");
                  const actionEnabled = isSideBetActionEnabled(match);
                  const disabledHint = sideBetDisabledReason(match);
                  const isCompleted = match.matchStatus === "completed";
                  const isWinnerActive =
                    activeAction?.matchId === match.id && activeAction.betType === "winner";
                  const isScoreActive =
                    activeAction?.matchId === match.id && activeAction.betType === "score";

                  return (
                    <li
                      key={match.id}
                      className="rounded-lg border border-[#444] bg-[#2A2A2A] px-2.5 py-2"
                      data-testid={`today-match-row-${match.id}`}
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-bold text-white">{title}</span>
                          {stadium && (
                            <span className="mt-0.5 block truncate text-[11px] text-[#AAA]">
                              {stadium}
                            </span>
                          )}
                          {isCompleted && (
                            <span className="mt-0.5 block text-[11px] text-[#888]">경기 종료</span>
                          )}
                        </div>
                        {disabledHint && !isCompleted && (
                          <span className="shrink-0 rounded border border-[#555] px-1.5 py-0.5 text-[10px] text-[#888]">
                            {disabledHint}
                          </span>
                        )}
                      </div>

                      {(winnerBet || scoreBet) && (
                        <div className="mb-1.5 space-y-0.5">
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

                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={!actionEnabled}
                          onClick={() =>
                            setActiveAction({
                              matchId: match.id,
                              matchTitle: title,
                              betType: "winner",
                            })
                          }
                          className={`h-8 flex-1 rounded-md text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            isWinnerActive
                              ? "bg-[#CDFF00] text-black ring-1 ring-[#CDFF00]"
                              : "bg-[#CDFF00]/90 text-black enabled:hover:bg-[#d8ff33]"
                          }`}
                          data-testid={`side-bet-winner-btn-${match.id}`}
                        >
                          {winnerBet ? "우승팀 수정" : "우승팀"}
                        </button>
                        <button
                          type="button"
                          disabled={!actionEnabled}
                          onClick={() =>
                            setActiveAction({
                              matchId: match.id,
                              matchTitle: title,
                              betType: "score",
                            })
                          }
                          className={`h-8 flex-1 rounded-md text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            isScoreActive
                              ? "bg-[#CDFF00] text-black ring-1 ring-[#CDFF00]"
                              : "bg-[#CDFF00]/90 text-black enabled:hover:bg-[#d8ff33]"
                          }`}
                          data-testid={`side-bet-score-btn-${match.id}`}
                        >
                          {scoreBet ? "점수 수정" : "점수"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-[#333] px-3 py-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-full rounded-lg bg-[#474747] text-sm font-medium text-white"
              data-testid="today-matches-modal-close"
            >
              닫기
            </button>
          </div>
        </section>

        {/* 오른쪽 — 입력 패널 */}
        <section className="flex w-1/2 min-w-0 flex-col bg-[#181818]">
          {activeAction ? (
            <SideBetActionPanel
              key={`${activeAction.matchId}-${activeAction.betType}`}
              matchId={activeAction.matchId}
              matchTitle={activeAction.matchTitle}
              betType={activeAction.betType}
              onCancel={() => setActiveAction(null)}
              onSubmitted={() => setActiveAction(null)}
            />
          ) : (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
              data-testid="side-bet-panel-placeholder"
            >
              <p className="text-sm font-semibold text-white/90">예측 입력</p>
              <p className="text-[12px] leading-relaxed text-[#888]">
                왼쪽에서 우승팀 또는 점수를 선택하면
                <br />
                이 영역에 입력 화면이 나타납니다.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

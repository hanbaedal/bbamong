import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatMatchTitle, formatGameMatchTeamLine, type GameMatchItem } from "@/components/game/gameMatchUtils";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import {
  formatSideBetPickSummary,
  isSideBetActionEnabled,
  sideBetDisabledReason,
  type SideBetRecord,
} from "@/lib/sideBetMatchUtils";
import SideBetCombinedPanel from "@/components/game/SideBetCombinedPanel";

interface TodaySideBetsResponse {
  betsByMatch: Record<string, SideBetRecord[]>;
}

export interface SideBetActionTarget {
  matchId: string;
  matchTitle: string;
  betType?: "winner" | "score";
}

interface TodayMatchesSideBetModalProps {
  open: boolean;
  matches: GameMatchItem[];
  loading?: boolean;
  initialAction?: SideBetActionTarget | null;
  onClose: () => void;
}

/** 경기 목록 + 우승팀·점수 동시 입력 (모달 크기 ≈ 기존 70%) */
export default function TodayMatchesSideBetModal({
  open,
  matches,
  loading,
  initialAction = null,
  onClose,
}: TodayMatchesSideBetModalProps) {
  const [selectedMatch, setSelectedMatch] = useState<SideBetActionTarget | null>(null);
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
      setSelectedMatch(null);
      appliedInitialKeyRef.current = null;
      return;
    }
    if (!initialAction) return;
    const key = `${initialAction.matchId}:${initialAction.betType ?? "all"}`;
    if (appliedInitialKeyRef.current === key) return;
    appliedInitialKeyRef.current = key;
    setSelectedMatch({
      matchId: initialAction.matchId,
      matchTitle: initialAction.matchTitle,
      betType: initialAction.betType,
    });
  }, [open, initialAction]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-2"
      onClick={onClose}
      data-testid="today-matches-side-bet-modal"
    >
      <div
        className="flex h-[min(92dvh,560px)] w-[min(96vw,630px)] flex-col overflow-hidden rounded-xl border border-[#444] bg-[#1E1E1E] shadow-2xl sm:h-[min(88dvh,392px)] sm:w-[min(92vw,630px)] sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 왼쪽 — 경기 목록 (모바일: 경기 선택 전 전체 / 선택 후 숨김) */}
        <section
          className={`min-w-0 flex-col border-[#333] ${
            selectedMatch ? "hidden sm:flex sm:w-[38%] sm:border-r" : "flex w-full sm:w-[38%] sm:border-r"
          }`}
        >
          <div className="shrink-0 border-b border-[#333] px-2.5 py-2">
            <h3 className="text-center text-sm font-bold text-white">오늘의 경기</h3>
            <p className="mt-0.5 text-center text-[10px] leading-relaxed text-[#888]">
              경기 선택 · 1회 시작 시 마감
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
            {loading ? (
              <p className="py-6 text-center text-xs text-[#AAA]">불러오는 중...</p>
            ) : matches.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#AAA]">오늘 경기가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {matches.map((match) => {
                  const title = formatMatchTitle(match.name);
                  const stadium = getDisplayStadiumName(match.stadiumName);
                  const teamLine = formatGameMatchTeamLine(match);
                  const bets = todayBets?.betsByMatch[match.id] ?? [];
                  const winnerBet = bets.find((b) => b.type === "winner");
                  const scoreBet = bets.find((b) => b.type === "score");
                  const actionEnabled = isSideBetActionEnabled(match);
                  const disabledHint = sideBetDisabledReason(match);
                  const isCompleted = match.matchStatus === "completed";
                  const isSelected = selectedMatch?.matchId === match.id;

                  return (
                    <li key={match.id}>
                      <button
                        type="button"
                        disabled={!actionEnabled && !isSelected}
                        onClick={() =>
                          setSelectedMatch({
                            matchId: match.id,
                            matchTitle: title,
                          })
                        }
                        className={`w-full rounded-lg border px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed ${
                          isSelected
                            ? "border-[#CDFF00] bg-[#CDFF00]/10"
                            : "border-[#444] bg-[#2A2A2A] enabled:hover:border-[#666]"
                        } ${!actionEnabled ? "opacity-50" : ""}`}
                        data-testid={`today-match-row-${match.id}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-bold text-white">{title}</span>
                            {stadium && (
                              <span className="mt-0.5 block truncate text-[10px] text-[#AAA]">
                                {stadium}
                              </span>
                            )}
                            <span className="mt-0.5 block truncate text-[10px] text-[#CCC]">
                              {teamLine}
                            </span>
                            {isCompleted && (
                              <span className="mt-0.5 block text-[10px] text-[#888]">종료</span>
                            )}
                          </div>
                          {disabledHint && !isCompleted && (
                            <span className="shrink-0 rounded border border-[#555] px-1 py-0.5 text-[9px] text-[#888]">
                              {disabledHint}
                            </span>
                          )}
                        </div>

                        {(winnerBet || scoreBet) && (
                          <div className="mt-1 space-y-0.5">
                            {winnerBet && (
                              <p className="truncate text-[10px] text-[#CDFF00]">
                                우승:{" "}
                                {formatSideBetPickSummary(
                                  winnerBet,
                                  match.homeTeamName ?? "홈팀",
                                  match.awayTeamName ?? "원정팀",
                                )}
                              </p>
                            )}
                            {scoreBet && (
                              <p className="truncate text-[10px] text-[#CDFF00]">
                                점수:{" "}
                                {formatSideBetPickSummary(
                                  scoreBet,
                                  match.homeTeamName ?? "홈팀",
                                  match.awayTeamName ?? "원정팀",
                                )}
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-[#333] px-2.5 py-1.5">
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-full rounded-lg bg-[#474747] text-xs font-medium text-white"
              data-testid="today-matches-modal-close"
            >
              닫기
            </button>
          </div>
        </section>

        {/* 오른쪽 — 우승팀 + 점수 (모바일: 경기 선택 시 전체 너비) */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#181818] sm:w-[62%]">
          {selectedMatch ? (
            <>
              <div className="shrink-0 border-b border-[#333] px-3 py-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedMatch(null)}
                  className="text-xs font-medium text-[#CDFF00]"
                  data-testid="side-bet-back-to-matches"
                >
                  ← 경기 목록
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <SideBetCombinedPanel
                  key={selectedMatch.matchId}
                  matchId={selectedMatch.matchId}
                  matchTitle={selectedMatch.matchTitle}
                  focusSection={selectedMatch.betType}
                />
              </div>
            </>
          ) : (
            <div
              className="hidden flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center sm:flex"
              data-testid="side-bet-panel-placeholder"
            >
              <p className="text-xs font-semibold text-white/90">예측 입력</p>
              <p className="text-[11px] leading-relaxed text-[#888]">
                왼쪽에서 경기를 선택하면
                <br />
                우승팀 · 점수를 함께 입력할 수 있습니다.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

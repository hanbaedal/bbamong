import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { formatKstDisplayDate } from "@/lib/kstDate";
import type { HeadToHeadDisplayParts } from "@shared/matchTeamDisplay";

export interface SideBetBottomSummary {
  winnerLabel: string | null;
  scoreLabel: string | null;
  canEdit: boolean;
}

interface GameBottomStatusBarProps {
  sideBetSummary?: SideBetBottomSummary | null;
  headToHead?: HeadToHeadDisplayParts | null;
  onWinnerClick?: () => void;
  onScoreClick?: () => void;
}

function greetingName(isGuest: boolean, name?: string | null): string {
  if (isGuest) return "게스트";
  const trimmed = name?.trim();
  return trimmed || "회원";
}

function HeadToHeadCenter({ parts }: { parts: HeadToHeadDisplayParts }) {
  if (parts.empty) {
    return (
      <p
        className="text-[10px] sm:text-xs text-white font-medium whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
        data-testid="game-bottom-head-to-head"
      >
        {parts.season} 상대전적 —
      </p>
    );
  }

  return (
    <p
      className="text-[10px] sm:text-xs text-white font-medium whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
      data-testid="game-bottom-head-to-head"
    >
      {parts.season} 상대전적 {parts.awayName} {parts.awayWins}승 : {parts.homeName} {parts.homeWins}승
    </p>
  );
}

/** 게임 화면 하단 — 날짜·사이드벳 · 상대전적 · 인사/포인트 */
export default function GameBottomStatusBar({
  sideBetSummary = null,
  headToHead = null,
  onWinnerClick,
  onScoreClick,
}: GameBottomStatusBarProps) {
  const { user, isGuest } = useUser();
  const [dateText, setDateText] = useState(() => formatKstDisplayDate());

  useEffect(() => {
    setDateText(formatKstDisplayDate());
    const id = setInterval(() => setDateText(formatKstDisplayDate()), 60_000);
    return () => clearInterval(id);
  }, []);

  const displayName = greetingName(isGuest, user?.name);
  const points = user?.points ?? 0;
  const pointsText = points.toLocaleString("ko-KR");
  const showSideBet = sideBetSummary != null;
  const canEdit = Boolean(sideBetSummary?.canEdit);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[50] flex items-end justify-between gap-2 px-2 sm:px-3 pb-1.5 sm:pb-2"
      data-testid="game-bottom-status-bar"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-2 gap-y-0.5">
        <p
          className="shrink-0 text-[10px] sm:text-xs text-white font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
          data-testid="game-bottom-date"
        >
          {dateText}
        </p>

        {showSideBet ? (
          <>
            <button
              type="button"
              disabled={!canEdit}
              onClick={onWinnerClick}
              className={`pointer-events-auto text-left text-[10px] sm:text-xs font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] ${
                canEdit
                  ? "text-[#CDFF00] underline-offset-2 hover:underline cursor-pointer"
                  : "text-white/90 cursor-default"
              } disabled:opacity-80`}
              data-testid="game-bottom-side-bet-winner"
            >
              예측 우승팀 : {sideBetSummary.winnerLabel ?? "—"}
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={onScoreClick}
              className={`pointer-events-auto text-left text-[10px] sm:text-xs font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] ${
                canEdit
                  ? "text-[#CDFF00] underline-offset-2 hover:underline cursor-pointer"
                  : "text-white/90 cursor-default"
              } disabled:opacity-80`}
              data-testid="game-bottom-side-bet-score"
            >
              예측 점수 : {sideBetSummary.scoreLabel ?? "—"}
            </button>
          </>
        ) : null}
      </div>

      {headToHead ? (
        <div className="pointer-events-none absolute left-1/2 bottom-1.5 sm:bottom-2 -translate-x-1/2">
          <HeadToHeadCenter parts={headToHead} />
        </div>
      ) : null}

      <div
        className="flex shrink-0 flex-col items-center text-[10px] sm:text-xs text-white font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
        data-testid="game-bottom-user-block"
      >
        <p data-testid="game-bottom-greeting">안녕하세요. {displayName}님</p>
        <p data-testid="game-bottom-points">보유포인트 : {pointsText}</p>
      </div>
    </div>
  );
}

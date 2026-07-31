import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { formatKstDisplayDate } from "@/lib/kstDate";

export interface SideBetBottomSummary {
  winnerLabel: string | null;
  scoreLabel: string | null;
  canEdit: boolean;
}

interface GameBottomStatusBarProps {
  sideBetSummary?: SideBetBottomSummary | null;
  onWinnerClick?: () => void;
  onScoreClick?: () => void;
}

function greetingName(isGuest: boolean, name?: string | null): string {
  if (isGuest) return "게스트";
  const trimmed = name?.trim();
  return trimmed || "회원";
}

/** 게임 화면 하단 — 날짜·사이드벳 요약·인사 */
export default function GameBottomStatusBar({
  sideBetSummary = null,
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

      <p
        className="shrink-0 text-[10px] sm:text-xs text-white font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
        data-testid="game-bottom-greeting"
      >
        안녕하세요. {displayName}님
      </p>
    </div>
  );
}

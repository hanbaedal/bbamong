import type { LiveScoreboard } from "@shared/apiSportsTypes";
import LineScoreTable from "@/components/LineScoreTable";

interface LineScoreTableLandscapeProps {
  scoreboard?: LiveScoreboard | null;
  className?: string;
  compact?: boolean;
}

/** 가로 게임 화면용 — 반투명 배경 + 흰 테두리 스코어보드 */
export default function LineScoreTableLandscape({
  scoreboard,
  className = "",
  compact = false,
}: LineScoreTableLandscapeProps) {
  return (
    <div
      className={`rounded-sm bg-black/40 backdrop-blur-[2px] px-0.5 py-0.5 ${className}`}
      data-testid="landscape-line-score"
    >
      <LineScoreTable
        scoreboard={scoreboard}
        fixedInningColumns
        className={compact ? "text-[10px] leading-tight" : "text-xs"}
      />
    </div>
  );
}

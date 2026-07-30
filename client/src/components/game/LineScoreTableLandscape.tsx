import type { LiveScoreboard } from "@shared/apiSportsTypes";
import LineScoreTable from "@/components/LineScoreTable";

interface LineScoreTableLandscapeProps {
  scoreboard?: LiveScoreboard | null;
  className?: string;
}

/** 가로 게임 화면용 — 반투명 배경 + 흰 테두리 스코어보드 */
export default function LineScoreTableLandscape({
  scoreboard,
  className = "",
}: LineScoreTableLandscapeProps) {
  return (
    <div
      className={`rounded-sm bg-black/35 backdrop-blur-[2px] px-1 py-1 ${className}`}
      data-testid="landscape-line-score"
    >
      <LineScoreTable scoreboard={scoreboard} fixedInningColumns className="text-xs" />
    </div>
  );
}

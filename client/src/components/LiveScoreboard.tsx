import type { LiveScoreboard } from "@shared/apiSportsTypes";
import LineScoreTable, { collectInningColumns } from "@/components/LineScoreTable";

interface LiveScoreboardProps {
  scoreboard: LiveScoreboard | null;
  compact?: boolean;
  /** false면 구단명 대신 홈팀/원정팀만 표시 (사용자 게임 화면용) */
  showTeamNames?: boolean;
}

export default function LiveScoreboardBar({
  scoreboard,
  compact = false,
  showTeamNames = true,
}: LiveScoreboardProps) {
  if (!scoreboard) {
    return (
      <div className="rounded-lg border border-[#373539] bg-[#141414] px-3 py-2 text-xs text-[#888]">
        API 스코어보드 연동 대기 중
      </div>
    );
  }

  const awayLabel = showTeamNames ? scoreboard.awayTeamName : "원정팀";
  const homeLabel = showTeamNames ? scoreboard.homeTeamName : "홈팀";
  const inningColumns = collectInningColumns(scoreboard.awayInnings, scoreboard.homeInnings);
  const showInningGrid = !compact && inningColumns.length > 0;

  return (
    <div
      className={`rounded-lg border border-[#373539] bg-[#141414] ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[#CDFF00] text-xs font-semibold">{scoreboard.inningLabel}</span>
        <span className="text-[#888] text-[10px]">{scoreboard.statusLong}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-white text-sm">
        <div className="truncate text-right">{awayLabel}</div>
        <div className="font-bold text-base whitespace-nowrap">
          {scoreboard.awayScore} : {scoreboard.homeScore}
        </div>
        <div className="truncate">{homeLabel}</div>
      </div>

      {showInningGrid && (
        <LineScoreTable
          scoreboard={scoreboard}
          className="mt-3 [&_table]:text-[10px] [&_th]:text-[#888] [&_td]:text-[#CCC] [&_th]:border-[#373539] [&_td]:border-[#373539] [&_th]:bg-transparent [&_td]:bg-transparent"
        />
      )}

      {!compact && !showInningGrid && (
        <div className="mt-2 text-[10px] text-[#888] flex justify-between">
          <span>
            H {scoreboard.awayHits}-{scoreboard.homeHits} / E {scoreboard.awayErrors}-
            {scoreboard.homeErrors}
          </span>
          <span>{new Date(scoreboard.syncedAt).toLocaleTimeString("ko-KR")} 갱신</span>
        </div>
      )}

      {!compact && showInningGrid && (
        <div className="mt-2 text-[10px] text-[#888] text-right">
          {new Date(scoreboard.syncedAt).toLocaleTimeString("ko-KR")} 갱신
        </div>
      )}
    </div>
  );
}

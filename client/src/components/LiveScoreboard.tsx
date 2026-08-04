import type { LiveScoreboard } from "@shared/apiSportsTypes";
import LineScoreTable, { collectInningColumns } from "@/components/LineScoreTable";
import { getScoreboardDisplayTeamLabels } from "@shared/matchTeamDisplay";

interface LiveScoreboardProps {
  scoreboard: LiveScoreboard | null;
  compact?: boolean;
  /** 운영자 경기 상세 — 최소 높이 */
  dense?: boolean;
  /** false면 구단명 대신 홈팀/원정팀만 표시 (사용자 게임 화면용) */
  showTeamNames?: boolean;
}

export default function LiveScoreboardBar({
  scoreboard,
  compact = false,
  dense = false,
  showTeamNames = true,
}: LiveScoreboardProps) {
  if (!scoreboard) {
    return (
      <div
        className={`rounded-lg border border-[#373539] bg-[#141414] text-[#888] ${
          dense ? "px-2 py-1 text-[10px] leading-tight" : "px-3 py-2 text-xs"
        }`}
      >
        스코어 연동 대기 중
      </div>
    );
  }

  const { awayLabel, homeLabel } = getScoreboardDisplayTeamLabels(scoreboard, {
    awayFallback: "원정팀",
    homeFallback: "홈팀",
  });
  const awayDisplay = showTeamNames ? awayLabel : "원정팀";
  const homeDisplay = showTeamNames ? homeLabel : "홈팀";
  const inningColumns = collectInningColumns(scoreboard.awayInnings, scoreboard.homeInnings);
  const showInningGrid = !compact && !dense && inningColumns.length > 0;

  if (dense) {
    return (
      <div className="rounded-md border border-[#373539] bg-[#141414] px-2 py-1.5">
        <div className="flex items-center justify-between gap-2 text-white leading-tight">
          <span className="truncate text-[10px] max-w-[28%] text-right">{awayDisplay}</span>
          <div className="text-center shrink-0">
            <div className="text-[#CDFF00] text-[10px] font-semibold">{scoreboard.inningLabel}</div>
            <div className="font-bold text-sm whitespace-nowrap">
              {scoreboard.awayScore} : {scoreboard.homeScore}
            </div>
          </div>
          <span className="truncate text-[10px] max-w-[28%]">{homeDisplay}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-[#373539] bg-[#141414] ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[#CDFF00] text-xs font-semibold">{scoreboard.inningLabel}</span>
        {!dense && (
          <span className="text-[#888] text-[10px]">{scoreboard.statusLong}</span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-white text-sm">
        <div className="truncate text-right">{awayDisplay}</div>
        <div className="font-bold text-base whitespace-nowrap">
          {scoreboard.awayScore} : {scoreboard.homeScore}
        </div>
        <div className="truncate">{homeDisplay}</div>
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

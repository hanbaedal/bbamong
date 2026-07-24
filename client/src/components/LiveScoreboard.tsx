import type { LiveScoreboard } from "@shared/apiSportsTypes";

interface LiveScoreboardProps {
  scoreboard: LiveScoreboard | null;
  compact?: boolean;
}

export default function LiveScoreboardBar({ scoreboard, compact = false }: LiveScoreboardProps) {
  if (!scoreboard) {
    return (
      <div className="rounded-lg border border-[#373539] bg-[#141414] px-3 py-2 text-xs text-[#888]">
        API 스코어보드 연동 대기 중
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
        <span className="text-[#888] text-[10px]">{scoreboard.statusLong}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-white text-sm">
        <div className="truncate text-right">{scoreboard.awayTeamName}</div>
        <div className="font-bold text-base whitespace-nowrap">
          {scoreboard.awayScore} : {scoreboard.homeScore}
        </div>
        <div className="truncate">{scoreboard.homeTeamName}</div>
      </div>
      {!compact && (
        <div className="mt-2 text-[10px] text-[#888] flex justify-between">
          <span>
            H {scoreboard.awayHits}-{scoreboard.homeHits} / E {scoreboard.awayErrors}-
            {scoreboard.homeErrors}
          </span>
          <span>{new Date(scoreboard.syncedAt).toLocaleTimeString("ko-KR")} 갱신</span>
        </div>
      )}
    </div>
  );
}

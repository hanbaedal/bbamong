import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { kboTeamPrimaryColor } from "@shared/kboTeamColors";
import { getScoreboardDisplayTeamLabels } from "@shared/matchTeamDisplay";

interface GameLiveSituationWidgetProps {
  scoreboard: LiveScoreboard | null;
  hidden?: boolean;
}

function BaseDiamond({
  occupied,
  className,
}: {
  occupied: boolean;
  className: string;
}) {
  return (
    <span
      className={`absolute h-[9px] w-[9px] rotate-45 border ${
        occupied ? "border-white bg-white" : "border-white/45 bg-transparent"
      } ${className}`}
    />
  );
}

export default function GameLiveSituationWidget({
  scoreboard,
  hidden = false,
}: GameLiveSituationWidgetProps) {
  if (hidden || !scoreboard) return null;

  const { awayLabel, homeLabel } = getScoreboardDisplayTeamLabels(scoreboard);
  const inning = scoreboard.inning;
  const half = scoreboard.inningHalf;
  const situation = scoreboard.situation;
  const topActive = half === "top";
  const bottomActive = half === "bottom";
  const balls = situation?.balls ?? 0;
  const strikes = situation?.strikes ?? 0;
  const outs = situation?.outs ?? 0;

  return (
    <div
      className="absolute top-2 left-[58px] z-[35] flex items-stretch overflow-hidden rounded-md border border-white/25 bg-black/70 text-white shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur-[2px] pointer-events-none sm:left-[62px]"
      data-testid="game-live-situation-widget"
    >
      <div className="flex w-[28px] flex-col items-center justify-center px-0.5 py-1 sm:w-[32px]">
        <span className={`text-[8px] leading-none ${topActive ? "text-white" : "text-white/30"}`}>▲</span>
        <span className="text-lg font-bold leading-none tabular-nums sm:text-xl">
          {inning != null ? inning : "-"}
        </span>
        <span className={`text-[8px] leading-none ${bottomActive ? "text-white" : "text-white/30"}`}>▼</span>
      </div>

      <div className="flex min-w-[88px] flex-col justify-center sm:min-w-[100px]">
        <TeamScoreRow
          name={awayLabel}
          score={scoreboard.awayScore}
          color={kboTeamPrimaryColor(awayLabel, "#E11936")}
        />
        <TeamScoreRow
          name={homeLabel}
          score={scoreboard.homeScore}
          color={kboTeamPrimaryColor(homeLabel, "#1A6DFF")}
        />
      </div>

      <div className="flex w-[58px] flex-col items-center justify-center px-1.5 py-1 sm:w-[64px]">
        <div className="relative h-[28px] w-[32px]">
          <BaseDiamond occupied={Boolean(situation?.second)} className="left-1/2 top-0 -translate-x-1/2" />
          <BaseDiamond occupied={Boolean(situation?.third)} className="left-0 top-[10px]" />
          <BaseDiamond occupied={Boolean(situation?.first)} className="right-0 top-[10px]" />
        </div>
        <p className="mt-0.5 text-[10px] font-semibold leading-none tabular-nums">
          {balls} - {strikes}
        </p>
        <p className="mt-0.5 text-[9px] font-bold leading-none tracking-wide">
          {outs} OUT
        </p>
      </div>
    </div>
  );
}

function TeamScoreRow({
  name,
  score,
  color,
}: {
  name: string;
  score: number;
  color: string;
}) {
  return (
    <div className="flex h-[18px] items-stretch text-[11px] font-bold leading-none sm:h-[20px] sm:text-xs">
      <span
        className="flex min-w-[44px] items-center justify-center px-1.5 text-white sm:min-w-[52px]"
        style={{
          backgroundColor: color,
          clipPath: "polygon(0 0, 100% 0, 86% 100%, 0 100%)",
        }}
      >
        {name}
      </span>
      <span className="-ml-2 flex min-w-[22px] items-center justify-center bg-white px-1.5 text-black tabular-nums">
        {score}
      </span>
    </div>
  );
}

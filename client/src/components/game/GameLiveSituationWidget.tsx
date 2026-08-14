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
        occupied ? "border-white bg-white" : "border-white/55 bg-transparent"
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
  const batterName = situation?.batterName?.trim() || "";
  const pitchLabel = situation?.pitchLabel?.trim() || "";
  const pitchDetail = situation?.pitchDetail?.trim() || "";
  const showBatter = Boolean(batterName || pitchLabel || pitchDetail);

  return (
    <div
      className="absolute top-2 left-[58px] z-[35] flex items-stretch text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] pointer-events-none sm:left-[62px]"
      data-testid="game-live-situation-widget"
    >
      <div className="flex w-[22px] flex-col items-center justify-center px-0.5 sm:w-[24px]">
        {topActive ? (
          <span className="text-[9px] leading-none text-white">▲</span>
        ) : (
          <span className="h-[9px]" />
        )}
        <span className="text-lg font-bold leading-none tabular-nums sm:text-xl">
          {inning != null ? inning : "-"}
        </span>
        {bottomActive ? (
          <span className="text-[9px] leading-none text-white">▼</span>
        ) : (
          <span className="h-[9px]" />
        )}
      </div>

      <div className="ml-0.5 flex min-w-[84px] flex-col justify-center gap-[2px] sm:min-w-[96px]">
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

      <div className="ml-1.5 flex flex-col items-center justify-center px-0.5">
        <div className="relative h-[26px] w-[30px]">
          <BaseDiamond occupied={Boolean(situation?.second)} className="left-1/2 top-0 -translate-x-1/2" />
          <BaseDiamond occupied={Boolean(situation?.third)} className="left-0 top-[9px]" />
          <BaseDiamond occupied={Boolean(situation?.first)} className="right-0 top-[9px]" />
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[10px] font-semibold leading-none tabular-nums">
            {balls} - {strikes}
          </span>
          <span className="text-[9px] font-bold leading-none tracking-wide">{outs} OUT</span>
        </div>
      </div>

      {showBatter ? (
        <div className="ml-2 flex min-w-0 max-w-[13rem] items-center gap-1.5">
          <span className="shrink-0 self-start mt-0.5 rounded-[2px] bg-white/90 px-1 py-px text-[9px] font-bold leading-none text-black">
            타자
          </span>
          {batterName ? (
            <p className="shrink-0 text-[13px] font-bold leading-tight sm:text-sm">{batterName}</p>
          ) : null}
          <div className="min-w-0 leading-tight">
            {pitchLabel ? (
              <p className="truncate text-[10px] font-semibold text-white/95">{pitchLabel}</p>
            ) : null}
            {pitchDetail ? (
              <p className="truncate text-[10px] text-white/90">{pitchDetail}</p>
            ) : null}
          </div>
        </div>
      ) : null}
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
    <div className="flex h-[17px] items-stretch text-[11px] font-bold leading-none sm:h-[19px] sm:text-xs">
      <span
        className="flex min-w-[42px] items-center justify-center px-1.5 text-white sm:min-w-[48px]"
        style={{
          backgroundColor: color,
          clipPath: "polygon(0 0, 100% 0, 84% 100%, 0 100%)",
        }}
      >
        {name}
      </span>
      <span className="-ml-2 flex min-w-[20px] items-center justify-center bg-white px-1.5 text-black tabular-nums">
        {score}
      </span>
    </div>
  );
}

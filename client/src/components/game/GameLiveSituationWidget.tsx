/** 예측 참고용 TV 위젯. 이닝·점수는 다음, 다이아몬드·카운트·타자는 네이버. */
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import { kboTeamPrimaryColor } from "@shared/kboTeamColors";
import { getScoreboardDisplayTeamLabels } from "@shared/matchTeamDisplay";

interface GameLiveSituationWidgetProps {
  scoreboard: LiveScoreboard | null;
  hidden?: boolean;
  stadiumName?: string | null;
  stadiumSelectEnabled?: boolean;
  onStadiumNameClick?: () => void;
  awayFallback?: string | null;
  homeFallback?: string | null;
  onAwayTeamClick?: () => void;
  onHomeTeamClick?: () => void;
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
  stadiumName,
  stadiumSelectEnabled = false,
  onStadiumNameClick,
  awayFallback,
  homeFallback,
  onAwayTeamClick,
  onHomeTeamClick,
}: GameLiveSituationWidgetProps) {
  const displayStadium = stadiumName?.trim() || null;
  if (hidden) return null;
  if (!scoreboard && !displayStadium && !awayFallback && !homeFallback) return null;

  const { awayLabel, homeLabel } = getScoreboardDisplayTeamLabels(scoreboard, {
    awayFallback: awayFallback?.trim() || "원정",
    homeFallback: homeFallback?.trim() || "홈",
  });
  const inning = scoreboard?.inning ?? null;
  const half = scoreboard?.inningHalf;
  const situation = scoreboard?.situation;
  const topActive = half === "top";
  const bottomActive = half === "bottom";
  const balls = situation?.balls ?? 0;
  const strikes = situation?.strikes ?? 0;
  const outs = situation?.outs ?? 0;
  const batterName = situation?.batterName?.trim() || "";
  const pitchLabel = situation?.pitchLabel?.trim() || "";
  const pitchDetail = situation?.pitchDetail?.trim() || "";
  const showBatter = Boolean(batterName || pitchLabel || pitchDetail);
  const showLiveBits = Boolean(scoreboard);

  return (
    <div
      className="absolute top-2 left-[58px] z-[35] flex items-start text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] pointer-events-none sm:left-[62px]"
      data-testid="game-live-situation-widget"
    >
      {showLiveBits ? (
        <div className="flex h-[36px] w-[22px] flex-col items-center justify-center px-0.5 sm:h-[40px] sm:w-[24px]">
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
      ) : null}

      <div className="ml-0.5 flex min-w-[84px] flex-col justify-center sm:min-w-[96px]">
        <div className="flex flex-col gap-[2px]">
          <TeamScoreRow
            name={awayLabel}
            score={scoreboard?.awayScore}
            color={kboTeamPrimaryColor(awayLabel, "#E11936")}
            onNameClick={onAwayTeamClick}
            nameTestId="game-team-away"
          />
          <TeamScoreRow
            name={homeLabel}
            score={scoreboard?.homeScore}
            color={kboTeamPrimaryColor(homeLabel, "#1A6DFF")}
            onNameClick={onHomeTeamClick}
            nameTestId="game-team-home"
          />
        </div>
        {displayStadium ? (
          stadiumSelectEnabled && onStadiumNameClick ? (
            <button
              type="button"
              onClick={onStadiumNameClick}
              className="pointer-events-auto mt-0.5 max-w-full truncate text-left text-[10px] leading-tight text-white/90 hover:text-[#CDFF00] sm:text-[11px]"
              data-testid="game-stadium-name"
            >
              {displayStadium}
            </button>
          ) : (
            <p
              className="mt-0.5 max-w-full truncate text-[10px] leading-tight text-white/90 sm:text-[11px]"
              data-testid="game-stadium-name"
            >
              {displayStadium}
            </p>
          )
        ) : null}
      </div>

      {showLiveBits && situation ? (
        <div className="ml-1.5 flex h-[36px] flex-col items-center justify-center px-0.5 sm:h-[40px]">
          <div className="relative h-[26px] w-[30px]">
            <BaseDiamond occupied={Boolean(situation.second)} className="left-1/2 top-0 -translate-x-1/2" />
            <BaseDiamond occupied={Boolean(situation.third)} className="left-0 top-[9px]" />
            <BaseDiamond occupied={Boolean(situation.first)} className="right-0 top-[9px]" />
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[10px] font-semibold leading-none tabular-nums">
              {balls} - {strikes}
            </span>
            <span className="text-[9px] font-bold leading-none tracking-wide">{outs} OUT</span>
          </div>
        </div>
      ) : null}

      {showBatter ? (
        <div className="ml-2 flex min-w-0 max-w-[13rem] items-center gap-1.5 pt-0.5">
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
  onNameClick,
  nameTestId,
}: {
  name: string;
  score?: number;
  color: string;
  onNameClick?: () => void;
  nameTestId: string;
}) {
  const nameClass =
    "relative z-[1] flex min-w-[42px] items-center justify-center rounded-r-full pl-1.5 pr-3 text-white sm:min-w-[48px]";
  const nameStyle = { backgroundColor: color } as const;

  return (
    <div className="flex h-[17px] items-stretch text-[11px] font-bold leading-none sm:h-[19px] sm:text-xs">
      {onNameClick ? (
        <button
          type="button"
          onClick={onNameClick}
          className={`pointer-events-auto ${nameClass} hover:brightness-110`}
          style={nameStyle}
          data-testid={nameTestId}
        >
          {name}
        </button>
      ) : (
        <span className={nameClass} style={nameStyle} data-testid={nameTestId}>
          {name}
        </span>
      )}
      <span className="-ml-[9px] flex min-w-[22px] items-center justify-center bg-white pl-3 pr-1.5 text-black tabular-nums sm:-ml-[10px]">
        {typeof score === "number" ? score : "-"}
      </span>
    </div>
  );
}

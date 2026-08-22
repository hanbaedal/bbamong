/** 예측 참고용 TV 위젯. 이닝·점수는 다음, 다이아몬드·카운트·타자·투수는 네이버. */
import { useEffect, useState } from "react";
import type { LiveBatterTodayStats, LivePitcherSummary, LiveScoreboard } from "@shared/apiSportsTypes";
import type { LiveAtBatResultDisplay } from "@shared/atBatResultDisplay";
import { formatStatCount } from "@shared/batterDisplay";
import { kboTeamPrimaryColor } from "@shared/kboTeamColors";
import { getScoreboardDisplayTeamLabels } from "@shared/matchTeamDisplay";

interface GameLiveSituationWidgetProps {
  scoreboard: LiveScoreboard | null;
  hidden?: boolean;
  awayFallback?: string | null;
  homeFallback?: string | null;
  onAwayTeamClick?: () => void;
  onHomeTeamClick?: () => void;
  onPitcherClick?: (pitcher: LivePitcherSummary) => void;
}

function formatBatterTodayLine(today: LiveBatterTodayStats | null | undefined): string | null {
  if (!today) return null;
  const ab = today.atBats;
  const h = today.hits;
  const hr = today.homeRuns;
  if (ab == null && h == null && hr == null) return null;
  return `${formatStatCount(ab ?? 0)}타수 ${formatStatCount(h ?? 0)}안타 ${formatStatCount(hr ?? 0)}홈런`;
}

export default function GameLiveSituationWidget({
  scoreboard,
  hidden = false,
  awayFallback,
  homeFallback,
  onAwayTeamClick,
  onHomeTeamClick,
  onPitcherClick,
}: GameLiveSituationWidgetProps) {
  if (hidden) return null;
  if (!scoreboard && !awayFallback && !homeFallback) return null;

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
  const pitcher = situation?.pitcher ?? null;
  const pitcherName = pitcher?.name?.trim() || situation?.pitcherName?.trim() || "";
  const pitchLabel = situation?.pitchLabel?.trim() || "";
  const pitchDetail = situation?.pitchDetail?.trim() || "";
  const showBatter = Boolean(batterName || pitchLabel || pitchDetail);
  const showPitcher = Boolean(pitcherName);
  const showLiveBits = Boolean(scoreboard);
  const batterTodayLine = formatBatterTodayLine(situation?.batterToday);
  const atBatResult = situation?.atBatResultDisplay ?? null;

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

      <div className="ml-0.5 flex min-w-[84px] flex-col justify-center sm:min-w-[110px]">
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
        {showPitcher ? (
          <div className="mt-0.5 flex min-w-0 flex-col gap-0.5" data-testid="game-live-pitcher-block">
            {onPitcherClick && pitcher ? (
              <button
                type="button"
                className="pointer-events-auto flex min-w-0 max-w-[8.5rem] items-center gap-1 text-left hover:brightness-110"
                onClick={() => onPitcherClick(pitcher)}
                data-testid="game-live-pitcher"
              >
                <span className="shrink-0 rounded-[2px] bg-white/90 px-1 py-px text-[9px] font-bold leading-none text-black">
                  투수
                </span>
                <p className="truncate text-[11px] font-semibold leading-tight sm:text-xs underline-offset-2 hover:underline">
                  {pitcherName}
                </p>
              </button>
            ) : (
              <div
                className="flex min-w-0 max-w-[8.5rem] items-center gap-1"
                data-testid="game-live-pitcher"
              >
                <span className="shrink-0 rounded-[2px] bg-white/90 px-1 py-px text-[9px] font-bold leading-none text-black">
                  투수
                </span>
                <p className="truncate text-[11px] font-semibold leading-tight sm:text-xs">
                  {pitcherName}
                </p>
              </div>
            )}
            {pitcher ? <PitcherTodayBlock pitcher={pitcher} /> : null}
          </div>
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
        <div className="ml-2 flex min-w-0 max-w-[15rem] flex-col gap-0.5 pt-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
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
          {batterTodayLine ? (
            <p
              className="ml-[1.9rem] truncate text-[9px] font-semibold text-white/90 sm:text-[10px]"
              data-testid="game-live-batter-today"
            >
              {batterTodayLine}
            </p>
          ) : null}
          <AtBatResultBanner
            batterName={batterName}
            result={atBatResult}
            hasTodayLine={Boolean(batterTodayLine)}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * 오늘 기록 아래 ~5줄 여백 후 큰 글씨로 타석 결과.
 * 서버 라벨이 잠깐 비어도 같은 타자면 유지, 타자 바뀌면 지움.
 */
function AtBatResultBanner({
  batterName,
  result,
  hasTodayLine,
}: {
  batterName: string;
  result: LiveAtBatResultDisplay | null;
  hasTodayLine: boolean;
}) {
  const [sticky, setSticky] = useState<{ batter: string; label: LiveAtBatResultDisplay } | null>(
    null,
  );

  useEffect(() => {
    if (result) {
      setSticky({ batter: batterName, label: result });
      return;
    }
    setSticky((prev) => {
      if (!prev) return null;
      if (prev.batter !== batterName) return null;
      return prev;
    });
  }, [result, batterName]);

  const label = result ?? (sticky?.batter === batterName ? sticky.label : null);
  if (!label) return null;

  return (
    <div
      className={`ml-[1.9rem] flex flex-col ${hasTodayLine ? "" : "mt-0.5"}`}
      data-testid="game-live-atbat-result"
    >
      {/* 오늘 기록 아래 약 5줄 간격 */}
      <div className="h-[5.625rem] shrink-0" aria-hidden />
      <p className="text-2xl font-black leading-none tracking-tight text-white sm:text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
        {label}
      </p>
    </div>
  );
}

function PitcherTodayBlock({ pitcher }: { pitcher: LivePitcherSummary }) {
  const inn = pitcher.innings != null && String(pitcher.innings).trim() ? String(pitcher.innings).trim() : "—";
  const pitches = formatStatCount(pitcher.pitchCount ?? 0);
  const s = formatStatCount(pitcher.strikes ?? 0);
  const b = formatStatCount(pitcher.balls ?? 0);
  const rows: Array<{ label: string; value: string }> = [
    { label: "탈삼진", value: formatStatCount(pitcher.strikeouts ?? 0) },
    { label: "실점", value: formatStatCount(pitcher.runsAllowed ?? 0) },
    { label: "피안타", value: formatStatCount(pitcher.hitsAllowed ?? 0) },
  ];
  return (
    <div
      className="ml-[1.9rem] min-w-[7.5rem] max-w-[10.5rem] leading-[1.25] text-white/90"
      data-testid="game-live-pitcher-today"
    >
      <div className="grid grid-cols-[max-content_max-content_max-content] items-baseline gap-x-0.5 text-[9px] font-semibold sm:text-[10px]">
        <span className="whitespace-nowrap">{inn} 이닝 (</span>
        <span className="min-w-[2.4em] text-center tabular-nums whitespace-nowrap">{pitches}구,</span>
        <span className="whitespace-nowrap">{` S ${s}, B ${b})`}</span>
      </div>
      <div className="mt-px grid grid-cols-[max-content_max-content_max-content] gap-x-0.5 text-[9px] sm:text-[10px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <span className="truncate">{row.label}</span>
            <span className="min-w-[2.4em] text-center tabular-nums font-semibold">{row.value}</span>
            <span aria-hidden className="invisible whitespace-nowrap">{` S ${s}, B ${b})`}</span>
          </div>
        ))}
      </div>
    </div>
  );
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
    "relative z-[1] flex min-w-[42px] items-center justify-center pl-1.5 pr-1 text-white sm:min-w-[48px]";
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
      <span
        aria-hidden
        className="relative z-[1] -ml-[8px] h-full w-[17px] shrink-0 rounded-full sm:-ml-[9px] sm:w-[19px]"
        style={nameStyle}
      />
      <span className="-ml-[8px] flex min-w-[22px] items-center justify-center bg-white pl-2.5 pr-1.5 text-black tabular-nums sm:-ml-[9px]">
        {typeof score === "number" ? score : "-"}
      </span>
    </div>
  );
}

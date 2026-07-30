import type { InningRunsMap, LiveScoreboard } from "@shared/apiSportsTypes";

const INNING_COLUMNS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function cellRuns(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

interface LineScoreTableProps {
  scoreboard?: LiveScoreboard | null;
  className?: string;
  /** 대기 화면 등 — 항상 1~9회 컬럼 표시 */
  fixedInningColumns?: boolean;
  /** 가로 게임 화면 — 투명 배경 + 흰 글씨 */
  variant?: "default" | "transparent";
}

export default function LineScoreTable({
  scoreboard,
  className = "",
  fixedInningColumns = false,
  variant = "default",
}: LineScoreTableProps) {
  const awayInnings = scoreboard?.awayInnings;
  const homeInnings = scoreboard?.homeInnings;

  const dynamicColumns = Array.from(
    new Set([
      ...Object.keys(awayInnings ?? {}),
      ...Object.keys(homeInnings ?? {}),
    ]),
  ).sort((a, b) => {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });

  const inningColumns = fixedInningColumns || dynamicColumns.length === 0
    ? INNING_COLUMNS
    : dynamicColumns;

  const awayScore = scoreboard?.awayScore ?? 0;
  const homeScore = scoreboard?.homeScore ?? 0;
  const awayHits = scoreboard?.awayHits ?? 0;
  const homeHits = scoreboard?.homeHits ?? 0;
  const awayErrors = scoreboard?.awayErrors ?? 0;
  const homeErrors = scoreboard?.homeErrors ?? 0;

  const transparent = variant === "transparent";
  const cellBorder = transparent ? "border border-white/40" : "border border-[#CCCCCC]";
  const cellBg = transparent ? "bg-transparent" : "bg-white";
  const cellText = transparent ? "text-white" : "text-black";
  const thBase = `${cellBorder} ${cellBg} ${cellText}`;
  const tdBase = `${cellBorder} ${cellBg} ${cellText}`;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className={`w-full min-w-[300px] text-sm border-collapse ${cellText}`}>
        <thead>
          <tr>
            <th className={`${thBase} px-2 py-1.5 font-normal text-left w-12`}>
              팀
            </th>
            {inningColumns.map((key) => (
              <th
                key={key}
                className={`${thBase} px-1 py-1.5 font-normal text-center min-w-[1.5rem]`}
              >
                {key}
              </th>
            ))}
            <th className={`${thBase} px-1 py-1.5 font-semibold text-center`}>
              R
            </th>
            <th className={`${thBase} px-1 py-1.5 font-semibold text-center`}>
              H
            </th>
            <th className={`${thBase} px-1 py-1.5 font-semibold text-center`}>
              E
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${tdBase} px-2 py-1.5`}>원정</td>
            {inningColumns.map((key) => (
              <td key={`away-${key}`} className={`${tdBase} px-1 py-1.5 text-center`}>
                {cellRuns(awayInnings?.[key])}
              </td>
            ))}
            <td className={`${tdBase} px-1 py-1.5 text-center font-semibold`}>
              {awayScore}
            </td>
            <td className={`${tdBase} px-1 py-1.5 text-center`}>{awayHits}</td>
            <td className={`${tdBase} px-1 py-1.5 text-center`}>{awayErrors}</td>
          </tr>
          <tr>
            <td className={`${tdBase} px-2 py-1.5`}>홈</td>
            {inningColumns.map((key) => (
              <td key={`home-${key}`} className={`${tdBase} px-1 py-1.5 text-center`}>
                {cellRuns(homeInnings?.[key])}
              </td>
            ))}
            <td className={`${tdBase} px-1 py-1.5 text-center font-semibold`}>
              {homeScore}
            </td>
            <td className={`${tdBase} px-1 py-1.5 text-center`}>{homeHits}</td>
            <td className={`${tdBase} px-1 py-1.5 text-center`}>{homeErrors}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function collectInningColumns(
  homeInnings?: InningRunsMap,
  awayInnings?: InningRunsMap,
): string[] {
  const keys = new Set<string>([
    ...Object.keys(homeInnings ?? {}),
    ...Object.keys(awayInnings ?? {}),
  ]);
  return Array.from(keys).sort((a, b) => {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

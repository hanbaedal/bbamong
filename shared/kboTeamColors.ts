import { isKboTeamShort, resolveKboTeamShortName } from "./kboHomeStadium";
import type { KboTeamShort } from "./kboHomeStadium";

/** 스코어버그·팀명 뱃지용 구단 대표색 */
export const KBO_TEAM_PRIMARY_COLORS: Record<KboTeamShort, string> = {
  두산: "#131230",
  LG: "#C30452",
  KIA: "#EA0029",
  롯데: "#041E42",
  삼성: "#074CA1",
  SSG: "#CE0E2D",
  NC: "#315288",
  KT: "#000000",
  키움: "#570514",
  한화: "#FF6600",
};

export function kboTeamPrimaryColor(teamName?: string | null, fallback = "#374151"): string {
  const short = resolveKboTeamShortName(teamName);
  if (!short || !isKboTeamShort(short)) return fallback;
  return KBO_TEAM_PRIMARY_COLORS[short] ?? fallback;
}

/** 야간 그라운드에서 안 보이는 어두운 대표색 → 테두리용으로 밝힌 색 */
const KBO_TEAM_OUTLINE_COLORS: Partial<Record<KboTeamShort, string>> = {
  KT: "#C4A35A",
  두산: "#3D5AFE",
  롯데: "#1E6BB8",
  키움: "#C41E3A",
};

export function kboTeamOutlineColor(teamName?: string | null, fallback = "#CCF501"): string {
  const short = resolveKboTeamShortName(teamName);
  if (short && isKboTeamShort(short) && KBO_TEAM_OUTLINE_COLORS[short]) {
    return KBO_TEAM_OUTLINE_COLORS[short] as string;
  }
  return kboTeamPrimaryColor(teamName, fallback);
}

/** 빠몽이 PNG 실루엣 테두리 (팀색) + 기본 그림자 */
export function kboTeamOutlineFilter(teamName?: string | null): string {
  const color = kboTeamOutlineColor(teamName);
  return [
    "drop-shadow(0 0 0.6px #fff)",
    `drop-shadow(1.6px 0 0 ${color})`,
    `drop-shadow(-1.6px 0 0 ${color})`,
    `drop-shadow(0 1.6px 0 ${color})`,
    `drop-shadow(0 -1.6px 0 ${color})`,
    `drop-shadow(1.2px 1.2px 0 ${color})`,
    `drop-shadow(-1.2px 1.2px 0 ${color})`,
    `drop-shadow(1.2px -1.2px 0 ${color})`,
    `drop-shadow(-1.2px -1.2px 0 ${color})`,
    "drop-shadow(0 4px 8px rgba(0,0,0,0.45))",
  ].join(" ");
}

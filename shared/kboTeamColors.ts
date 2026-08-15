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

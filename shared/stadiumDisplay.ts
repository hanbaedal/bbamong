import {
  API_PLACEHOLDER_STADIUM_NAME,
  resolveKboStadiumShortName,
} from "./kboHomeStadium";

/** API 동기화 시 venue 없을 때 DB에 들어가는 기본 구장명 */
export const PLACEHOLDER_STADIUM_NAMES = new Set([API_PLACEHOLDER_STADIUM_NAME, "API 자동"]);

/** 화면 표시용 구장 약칭 — placeholder면 홈팀으로 추정 */
export function getDisplayStadiumName(
  name: string | null | undefined,
  homeTeamName?: string | null,
): string | null {
  return resolveKboStadiumShortName({ stadiumName: name, homeTeamName });
}

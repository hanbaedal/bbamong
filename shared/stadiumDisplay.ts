/** API 동기화 시 venue 없을 때 DB에 들어가는 기본 구장명 */
export const PLACEHOLDER_STADIUM_NAMES = new Set(["API자동", "API 자동"]);

/** 화면 표시용 구장명 — placeholder면 null (숨김) */
export function getDisplayStadiumName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed || PLACEHOLDER_STADIUM_NAMES.has(trimmed)) return null;
  return trimmed;
}

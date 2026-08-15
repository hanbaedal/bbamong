/**
 * 사용자 화면 경기 상태 용어.
 * DB 값(scheduled/ongoing/completed/cancelled)과 운영자 내부 키는 바꾸지 않는다.
 *
 * - 경기 예정: 선발 타순이 아직 없음
 * - 경기 전: 선발 공개 후 ~ 경기 시작 전
 * - 경기 중: 시작 ~ 종료
 * - 경기 종료: 종료 이후
 */
export const MATCH_STATUS_LABEL = {
  scheduled: "경기 전",
  upcoming: "경기 예정",
  live: "경기 중",
  finished: "경기 종료",
  postponed: "경기 연기",
  cancelled: "경기 취소",
  suspended: "경기 중단",
  syncPending: "연동 대기",
  noMatchToday: "오늘 경기 없음",
} as const;

export type MatchStatusLabel = (typeof MATCH_STATUS_LABEL)[keyof typeof MATCH_STATUS_LABEL];

/**
 * 사용자·운영자 화면에 쓰는 경기 상태 용어.
 * DB 값(scheduled/ongoing/completed/cancelled)과 운영자 내부 키(경기전/경기중)는 바꾸지 않는다.
 *
 * - 경기 예정: 일정·선발명단처럼 “아직 시작 시각이 오지 않음”을 말할 때
 * - 경기 전: 예측/실황 상태. 시작 전(참여 가능 포함)
 * - 경기 중 / 경기 종료 / 경기 연기 / 경기 취소 / 경기 중단
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

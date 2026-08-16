/** 친구·동호회 방 — 공유 상수·면책 문구 */

export const FRIEND_ROOM_CAPACITY_MIN = 2;
export const FRIEND_ROOM_CAPACITY_DEFAULT = 20;
export const FRIEND_ROOM_CAPACITY_MAX = 50;
export const FRIEND_ROOM_MAX_MEMBERSHIPS = 5;
/** 감사 메타 보관일(면책·부정이용 대응) */
export const FRIEND_ROOM_AUDIT_RETENTION_DAYS = 180;

export const FRIEND_ROOM_DISCLAIMER_TITLE = "친구·동호회 방 이용·면책 안내";

export const FRIEND_ROOM_DISCLAIMER_BODY = `본 방은 회원 간 친목·자발적 모임이며, 서비스 제공자(관리자·운영자)는 방의 개설·운영·초대·강퇴·종료에 관여하지 않습니다.

방 안 분쟁·갈등·초대 오남용은 당사자 책임입니다.

방장이 방을 종료(취소)하면 방·멤버·초대 링크·방 순위 등 방 관련 데이터는 삭제되며 복구되지 않습니다. (면책 동의·개설/종료 시각 등 최소 감사 기록은 부정이용 대응을 위해 일정 기간만 보관 후 파기합니다.)

방 순위·태그·소개는 참고용이며 공식 성적·보상·보증이 아닙니다.

타석 예측·포인트 정산은 공개 예측과 동일한 서비스 규칙을 따르며, 방 소속과 무관합니다.

법령·이용약관 위반 시 서비스는 이용 제한 등 조치를 할 수 있습니다.`;

export const FRIEND_ROOM_DISCLAIMER_CHECK_LABEL =
  "위 면책·이용 조건에 동의합니다 (동의하지 않으면 방을 만들 수 없습니다)";

export const FRIEND_ROOM_AGE_OPTIONS = ["무관", "10대", "20대", "30대", "40대", "50대 이상"] as const;
export const FRIEND_ROOM_REGION_OPTIONS = [
  "무관",
  "서울",
  "경기/인천",
  "강원",
  "충청",
  "전라",
  "경상",
  "제주",
  "온라인",
] as const;
export const FRIEND_ROOM_TEAM_OPTIONS = [
  "무관",
  "LG",
  "두산",
  "키움",
  "SSG",
  "KT",
  "NC",
  "삼성",
  "롯데",
  "한화",
  "KIA",
] as const;

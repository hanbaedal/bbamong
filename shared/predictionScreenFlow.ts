/**
 * 회원 예측 화면 변화 (경기전 → 예측 성공).
 * 홈 사용설명서·게임 시뮬레이션·관리자 시스템 매뉴얼과 동일 기준.
 */
export const PREDICTION_SCREEN_FLOW_UPDATED = "2026-08-27";

export interface PredictionScreenFlowStep {
  order: number;
  phase: string;
  title: string;
  background: string;
  whatHappens: string;
}

export const PREDICTION_SCREEN_FLOW: PredictionScreenFlowStep[] = [
  {
    order: 1,
    phase: "경기전",
    title: "시작 대기",
    background: "쿠어스 필드 주간 전경",
    whatHappens: "경기 시작 카운트다운. 베이스 버튼 없음.",
  },
  {
    order: 2,
    phase: "대기",
    title: "다음 타자 대기",
    background: "시네마틱 빠몽이 (초=청 유니폼 / 말=흰 유니폼)",
    whatHappens: "「다음 타자 예측을 기다리고 있습니다」. 예측이 열리기 전.",
  },
  {
    order: 3,
    phase: "예측 선택",
    title: "타석 예측",
    background: "3D 빈 구장",
    whatHappens: "아웃·1루·2루·3루·홈런 버튼과 포인트. 선택 좌표는 이 구장만 사용.",
  },
  {
    order: 4,
    phase: "결과 대기",
    title: "결과 기다림",
    background: "시네마틱 투수 (초/말)",
    whatHappens: "「내 예측」 배지. 베이스 버튼은 없음.",
  },
  {
    order: 5,
    phase: "결과 글씨",
    title: "결과 확정",
    background: "결과 대기와 같음",
    whatHappens: "약 2.2초 큰 글씨. 적중이면 주루, 빗나가면 대기로 복귀.",
  },
  {
    order: 6,
    phase: "주루",
    title: "예측 성공",
    background: "필리스 실사 다이아몬드",
    whatHappens:
      "배트 토스 후 주루. 1루=홈→1루, 2루=홈→1→2, 3루=홈→1→2→3, 홈런=1·2·3루를 돌아 홈. 중견으로는 가지 않음.",
  },
  {
    order: 7,
    phase: "다음 타석",
    title: "반복",
    background: "대기 또는 예측 선택",
    whatHappens: "축하 점프는 생략. 바로 대기이거나, 이미 열려 있으면 선택 화면.",
  },
];

export const PREDICTION_SCREEN_FLOW_NOTES: string[] = [
  "실패·투수교체·공수교대는 3D 구장을 유지합니다. 주루 실사는 적중 연출에만 씁니다.",
  "좌상단은 경기 진행 위젯(이닝·점수=다음, 주자·B-S·OUT=네이버)입니다. 공지는 설정에서만 봅니다.",
  "예측 게임 중 하단 배너 광고는 없습니다. 공수교대·투수교체 때 리워드 동영상만 나옵니다.",
  "타석 예측은 경기 시작 5분 전부터 가능합니다. 예측 창은 열린 뒤 약 8초 후 자동 중지될 수 있습니다.",
];

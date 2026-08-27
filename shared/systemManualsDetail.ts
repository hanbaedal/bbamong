/**
 * 시스템 매뉴얼 상세 본문 (운영자·사용자 사용/기술).
 * 화면 렌더와 docs/*.md 생성이 같은 소스를 씁니다.
 */
import {
  AD_EARLY_DISMISS_SECONDS,
  AD_REWARD_POINTS,
  BET_AMOUNT_OPTIONS,
  EXACT_SCORE_ODDS,
  PREDICTION_ODDS,
  SIDE_BET_AMOUNT_OPTIONS,
  WINNER_ODDS,
} from "./predictionOdds";
import { AD_PLAY_SECONDS, PREDICTION_AUTO_STOP_MS } from "./adBreakTiming";
import { PREDICTION_SCREEN_FLOW } from "./predictionScreenFlow";

export const MANUAL_DETAIL_UPDATED = "2026-08-27";

export const FLOW_SWIMLANES = [
  {
    id: "admin",
    title: "관리자 /admin",
    color: "#1A6DFF",
    steps: [
      "오늘 경기 등록·저장 (다음 스포츠 일정)",
      "오늘의 선발명단 (다음으로 경기, 네이버 타순)",
      "운영자 리스트에서 실황 ON (기본 1경기)",
      "실시간 모니터링 · 필요 시 점수 수동",
      "종료 후 사이드벳 정산·문의·공지",
    ],
  },
  {
    id: "operator",
    title: "운영자 /manager",
    color: "#C05621",
    steps: [
      "당일 비밀번호로 배정 경기 입장",
      "하이브리드: 실황 힌트 + 버튼 우선",
      "예측 시작 → (8초 자동 중지) → 결과 확정",
      "다음 타자 / 운영자 3아웃 후 실황 3아웃이면 공수교대",
      "투수교체·공수 = 광고 80초. 예측 시작으로 광고 끔",
      "경기종료 10초 후 로그아웃",
    ],
  },
  {
    id: "user",
    title: "사용자 /login · /prediction",
    color: "#00897B",
    steps: [
      "인트로 24컷 → 홈 → 예측게임 하러가기",
      "제1~5 중 실황 ON 경기 선택 · 사이드벳",
      "대기(시네마틱) → 선택(3D) → 결과대기 → 글씨",
      "적중 시 주루 실사, 실패는 3D 유지",
      "공수·투수 때 리워드 광고. 배너 없음",
      "종료 10초 후 홈. 끝난 경기는 다시 고름",
    ],
  },
  {
    id: "mall",
    title: "쇼핑몰 /shop",
    color: "#6D28D9",
    steps: [
      "정회원만 주문 (게스트는 둘러보기)",
      "장바구니 → 현금 주문 접수",
      "게임 포인트로 직접 결제하지 않음",
      "관리자가 주문·재고·발주 처리",
      "운영자 앱에는 몰 관리 없음",
    ],
  },
] as const;

export const FLOW_CROSS_LINKS: string[] = [
  "실황: 점수·이닝·로고 = 다음 스포츠 / 주자·B-S·OUT·타자·구종 = 네이버. API-SPORTS 키 없음.",
  "연결: Express :5000 + MongoDB `ppamong` + Redis 세션 + WebSocket `/ws/match`.",
  "실황 ON(AdminUser.apiSyncEnabled)인 경기만 회원이 「경기 선택」에서 고를 수 있습니다.",
  "「예측 시작」은 predictionEnabled만 켭니다. matchStatus=ongoing은 다음 실황이 시작했을 때만.",
];

export const OPERATOR_USER_STEPS: {
  title: string;
  body: string;
}[] = [
  {
    title: "1. 입장",
    body: "카톡 로그인 링크 또는 아이디+당일 비밀번호. 배정된 제N경기만 다룹니다. 경기 시작 5분 전 이전에는 예측·진행 버튼이 비활성입니다.",
  },
  {
    title: "2. 화면",
    body: "왼쪽은 타순·아웃, 가운데는 다음 할 일(「지금」), 오른쪽은 예측 시작/중지/결과/다음타자/공수/투수교체입니다. 점수는 실황 보드가 우선입니다. 점수를 고치면 수동 모드가 됩니다.",
  },
  {
    title: "3. 정상(하이브리드)",
    body: "실황이 타자를 안정화하면 예측이 열리고, 약 8초 후 자동 중지될 수 있습니다. TV와 맞으면 결과는 실황 제안 + 1탭 확정입니다. 버튼을 먼저 누르면 그 입력이 우선입니다. 토글은 없습니다.",
  },
  {
    title: "4. 예외 루프",
    body: "가드에 걸리면 예측 시작 → 중지 → 결과(아웃/1루/2루/3루/홈런) → 다음 타자. 결과 전에는 다음타자·공수·광고·투수교체가 막힙니다.",
  },
  {
    title: "5. 3아웃·공수교대",
    body: "3아웃 카운트는 운영자 결과(outsInHalf)입니다. 병살·삼살은 실황이 2아웃이어도 예측을 끝냅니다. 공수교대(이닝 넘김·광고)는 네이버가 같은 초/말에서 3아웃이거나 초/말이 이미 바뀐 뒤에 엽니다. 실황 아웃이 없으면 막지 않습니다. 급하면 공수교대를 두 번 눌러 강제합니다.",
  },
  {
    title: "6. 투수교체",
    body: "같은 타석·대타를 유지합니다. 진행 중 예측은 환불되고 결과는 생략될 수 있습니다(skippedResult). 광고가 시작됩니다.",
  },
  {
    title: "7. 광고",
    body: `안내 5초 후 리워드 ${AD_PLAY_SECONDS}초. 「예측 시작」으로 끄면 보상 없음. 운영자 「광고 중지」 또는 ${AD_PLAY_SECONDS}초 워치독 종료면 회원 ${AD_REWARD_POINTS}P. 다음 타석 예측은 운영자가 「예측 시작」을 눌러야 열립니다.`,
  },
  {
    title: "8. 경기 종료",
    body: "약 10초 「경기종료」 후 로그아웃입니다. 세션 만료 팝업이 아닙니다.",
  },
];

export const OPERATOR_RULES: string[] = [
  "결과 확정 전 다음타자·공수교대·투수교체·광고 금지.",
  "자동 확정 힌트: 아웃수↑ → 아웃, 1~3루 진루, 홈런(아웃 유지+타자 교체), 희생/병살→아웃, 야수선택→1루.",
  "실황 타자 ≠ 선발 → 대타 표시. 투수교체는 대타 유지, 다음타자·공수는 대타 해제.",
  "예측 시작 시 광고 자동 중지(ad_stopped.reason=prediction_start, 보상 없음).",
  "스코어 PATCH → controlMode=manual. 「수동」을 끄면 다음 점수를 다시 받습니다.",
  "공수교대는 liveScoreboard 이닝을 덮어쓰지 않습니다.",
  "공수교대 타이밍: 운영자 3아웃 후 네이버 같은 초/말 3아웃(또는 초/말 변경). 급하면 공수교대 두 번.",
];

export const OPERATOR_TECH_STACK: { label: string; value: string }[] = [
  { label: "앱", value: "운영자 웹 /manager, 필요 시 Android WebView" },
  { label: "인증", value: "AdminUser + 당일 비밀번호(dailyPasswordPlain) / loginLinkToken" },
  { label: "실황 폴링", value: "기본 2초(최소 1.5초). 다음=점수, 네이버=주자·카운트" },
  { label: "타자 안정화", value: "타자명 약 2초, 투수명 기본 6초(최소 3초)" },
  { label: "예측 창", value: `열린 뒤 ${Math.round(PREDICTION_AUTO_STOP_MS / 1000)}초 자동 중지(schedulePredictionAutoStop 한 루틴)` },
  { label: "타석 단계", value: "idle → prediction_open → prediction_closed → result_confirmed" },
  { label: "WS", value: "/ws/match — at_bat_phase, prediction_started/stopped, round_result, round_next, ad_started/stopped, match_ended" },
  { label: "권위", value: "회원 화면 uiStage는 서버 at_bat_phase. 3아웃 카운트는 outsInHalf. 공수교대 타이밍은 네이버 3아웃(강제 두 번 탭 가능)" },
  { label: "API 예", value: "예측 시작/중지, 결과 전송, 다음타자, 공수교대, 투수교체, PATCH scoreboard" },
];

export const USER_USER_STEPS = PREDICTION_SCREEN_FLOW.map((s) => ({
  order: s.order,
  phase: s.phase,
  title: s.title,
  background: s.background,
  whatHappens: s.whatHappens,
}));

export const USER_USER_EXTRA: string[] = [
  `타석 금액: ${BET_AMOUNT_OPTIONS.join(" / ")}P. 배당 아웃 ${PREDICTION_ODDS["아웃"]} / 1루 ${PREDICTION_ODDS["1루"]} / 2루 ${PREDICTION_ODDS["2루"]} / 3루 ${PREDICTION_ODDS["3루"]} / 홈런 ${PREDICTION_ODDS["홈런"]}.`,
  `사이드벳: ${SIDE_BET_AMOUNT_OPTIONS.join(" / ")}P. 우승팀 ${WINNER_ODDS}배, 최종 스코어 ${EXACT_SCORE_ODDS}배. 1회 시작 전 마감, 경기 종료 후 실황 스코어로 정산.`,
  `광고: 공수·투수 때만 리워드. 웹 ${AD_EARLY_DISMISS_SECONDS}초 후 ×(보상 없음). 운영자 중지 시 ${AD_REWARD_POINTS}P. 게임 하단 배너 없음.`,
  "스마트폰은 화면을 한 번 탭해야 음성이 납니다. 자리비움 중 해당 타석 예측은 불가합니다.",
  "끝난 경기 마지막 화면이 남으면 제목을 눌러 오늘 실황 ON인 다른 경기를 고릅니다.",
];

export const USER_TECH_STACK: { label: string; value: string }[] = [
  { label: "진입", value: "/login 인트로 24컷 → /home → /prediction" },
  { label: "인증", value: "JWT access+refresh. 게임 중 4분 keepAlive, 만료 2분 전 refresh. WS 4005는 forceRefresh 후 재연결" },
  { label: "경기 선택", value: "localStorage ppamong.prediction.selectedMatch. 종료·취소면 삭제하고 모달" },
  { label: "화면 단계", value: "wait_start / picking / wait_result / result_flash / success_running / ad_playing / match_ended" },
  { label: "배경", value: "before / wait_home|away / field(3D) / pitch_home|away / running. 대기는 시네마틱만" },
  { label: "WS", value: "/ws/match. uiStage가 권위. prediction_started는 음성·광고 부수효과" },
  { label: "폴링", value: "목록·스코어·phase 8~10초 보조. 429·세션 오류 시 캐시를 null로 덮지 않음" },
  { label: "복귀", value: "visibilitychange·pageshow·appStateChange로 WS 재연결, /check로 타석 맞춤" },
];

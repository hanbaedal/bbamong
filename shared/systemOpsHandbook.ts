/**
 * 슈퍼어드민 「시스템 매뉴얼」 페이지와 사용 설명서 DOCX가 공유하는 운영 기준.
 * 숫자·단계는 코드 기본값(shared/adBreakTiming, predictionOdds, liveAutoOperator 기본 env).
 */
import {
  AD_INTRO_DELAY_MS,
  AD_PLAY_SECONDS,
  PREDICTION_AUTO_STOP_MS,
} from "./adBreakTiming";
import {
  AD_EARLY_DISMISS_SECONDS,
  AD_REWARD_POINTS,
  BET_AMOUNT_OPTIONS,
  EXACT_SCORE_ODDS,
  PREDICTION_ODDS,
  SIDE_BET_AMOUNT_OPTIONS,
  WINNER_ODDS,
  type PredictionResult,
} from "./predictionOdds";
import {
  PREDICTION_SCREEN_FLOW,
  PREDICTION_SCREEN_FLOW_NOTES,
  PREDICTION_SCREEN_FLOW_UPDATED,
} from "./predictionScreenFlow";

export {
  PREDICTION_SCREEN_FLOW,
  PREDICTION_SCREEN_FLOW_NOTES,
  PREDICTION_SCREEN_FLOW_UPDATED,
};

export const SYSTEM_OPS_HANDBOOK_UPDATED = PREDICTION_SCREEN_FLOW_UPDATED;

export interface HandbookRow {
  label: string;
  value: string;
}

export interface HandbookTable {
  headers: string[];
  rows: string[][];
}

/** 타자 2초 · 투수 기본 6초(최소 3초) — server/liveMatch/liveAutoOperator.ts 기본 env */
export const OPS_BATTER_STABLE_SECONDS = 2;
export const OPS_PITCHER_STABLE_SECONDS = 6;
export const OPS_LIVE_POLL_SECONDS = 2;
export const OPS_RESULT_FLASH_SECONDS = 2.2;
export const OPS_MATCH_ENDED_SECONDS = 10;
export const OPS_PREDICTION_OPEN_BEFORE_MINUTES = 5;

export const ROLE_SUMMARIES: { role: string; summary: string }[] = [
  {
    role: "관리자",
    summary:
      "오늘 경기 등록 → 운영자 리스트에서 실황 ON(기본 1경기) → 모니터링. 스코어 PATCH는 수동 모드. 「예측 시작」은 예측 창만 켭니다.",
  },
  {
    role: "운영자",
    summary:
      "하이브리드만(토글 없음). 실황이 타석을 돌리고, 버튼을 먼저 누르면 그게 우선. 애매하면 「실황 추정」 후 1탭 확정.",
  },
  {
    role: "회원",
    summary:
      "경기 시작 5분 전부터 타석 예측. 고정 배당. 게임 중 하단 배너 없음. 공수·투수교체 때만 리워드 동영상.",
  },
  {
    role: "실황",
    summary:
      "점수·이닝·로고=다음 스포츠. 주자·B-S·OUT·타자·구종=네이버. API-SPORTS 키는 쓰지 않습니다.",
  },
];

export const TIMING_FACTS: HandbookRow[] = [
  {
    label: "타석 참여",
    value: `경기 시작 ${OPS_PREDICTION_OPEN_BEFORE_MINUTES}분 전부터 종료 전까지`,
  },
  {
    label: "실황 폴링",
    value: `기본 ${OPS_LIVE_POLL_SECONDS}초 (최소 1.5초)`,
  },
  {
    label: "타자명 안정화",
    value: `약 ${OPS_BATTER_STABLE_SECONDS}초 (깜빡임 방지)`,
  },
  {
    label: "투수명 안정화",
    value: `기본 ${OPS_PITCHER_STABLE_SECONDS}초 (최소 3초)`,
  },
  {
    label: "예측 창 자동 중지",
    value: `열린 뒤 약 ${Math.round(PREDICTION_AUTO_STOP_MS / 1000)}초`,
  },
  {
    label: "결과 큰 글씨",
    value: `약 ${OPS_RESULT_FLASH_SECONDS}초 (자리비움 복귀는 더 짧음)`,
  },
  {
    label: "광고 인트로",
    value: `공수·투수교체 안내 ${Math.round(AD_INTRO_DELAY_MS / 1000)}초 후 광고`,
  },
  {
    label: "리워드 광고",
    value: `${AD_PLAY_SECONDS}초 재생. ${AD_EARLY_DISMISS_SECONDS}초 후 ×(보상 없음). 운영자 중지 시 ${AD_REWARD_POINTS}P`,
  },
  {
    label: "경기종료 연출",
    value: `약 ${OPS_MATCH_ENDED_SECONDS}초 후 회원은 홈, 운영자는 로그아웃`,
  },
];

export const LIVE_SOURCE_TABLE: HandbookTable = {
  headers: ["항목", "소스", "비고"],
  rows: [
    ["일정 자동 등록·팀 로고", "다음 스포츠", "관리자 경기 관리 원형 로고"],
    ["득점·안타·실책·볼넷·이닝표", "다음 스포츠", "liveScoreboard. controlMode=auto일 때 덮어씀"],
    ["주자·볼-스트라이크·아웃", "네이버 문자중계", "수동 점수여도 주자는 네이버 갱신"],
    ["타자·구종", "네이버 문자중계", "타석이 없으면 0-0 0 OUT을 가짜로 채우지 않음"],
    ["상대전적", "네이버 preview", "스코어보드 바로 아래"],
    ["선발명단 타순", "네이버 (경기는 다음으로 찾음)", "API-SPORTS 라인업 폴백 없음"],
    ["matchStatus=ongoing", "다음 스포츠만", "시작 전(BEFORE/READY)이면 scheduled로 되돌림"],
  ],
};

export const AT_BAT_MACHINE_STEPS: HandbookRow[] = [
  { label: "대기", value: "idle — 다음 타자 대기. 회원 화면은 시네마틱 빠몽이." },
  { label: "예측열림", value: "prediction_open — 회원 선택(3D 구장). 약 8초 후 자동 중지 가능." },
  { label: "예측닫힘", value: "prediction_closed — 결과 대기. 회원은 시네마틱 투수·내 예측 배지." },
  { label: "결과확정", value: "result_confirmed — 큰 글씨 후 적중 시 주루. 다음타자/공수교대." },
];

export const AT_BAT_GUARDS: string[] = [
  "결과 확정 전에는 다음타자·공수교대·광고·투수교체를 막습니다.",
  "자동 확정: 아웃(아웃수↑)·1~3루·홈런(아웃 유지+타자 교체). 희생/병살→아웃, 야수선택→1루.",
  "애매하면 제안만 하고 운영자가 「지금」 1탭으로 확정합니다.",
  "실황 타자 ≠ 선발이면 대타 표시·자동 pinch. 투수교체는 대타를 유지합니다.",
  "예측 시작 시 광고는 자동 중지됩니다(ad_stopped.reason=prediction_start, 보상 없음).",
  "예전 liveAutoEnabled=false 잔여값은 폴링 시 true로 복구됩니다. 운영자 UI에 실황 자동 토글은 없습니다.",
];

export const MATCH_STATUS_RULES: string[] = [
  "「예측 시작」은 predictionEnabled / sideBetsLocked만 켭니다. matchStatus를 ongoing으로 올리지 않습니다.",
  "matchStatus=ongoing은 다음 스포츠 실황 근거로만 올립니다. 시작 전이면 scheduled로 되돌립니다.",
  "관리자·운영자 스코어 PATCH는 controlMode=manual. 「수동」을 끄면 auto로 돌아가 다음 점수를 다시 받습니다.",
  "운영자 공수교대는 liveScoreboard 이닝을 덮어쓰지 않습니다. 화면의 N회 초/말·점수는 실황 보드를 우선합니다.",
];

export const ADMIN_DAILY_CHECKLIST: string[] = [
  "경기 관리에서 오늘 KBO 일정을 등록·저장합니다. 팀 로고는 다음 스포츠 imageUrl입니다.",
  "「오늘의 선발명단」으로 타순을 맞춥니다(다음으로 경기 찾기, 네이버로 타순).",
  "운영자 리스트에서 해당 경기 「실황 ON」(다음+네이버+회원 게임 연동). 기본은 1경기만 ON입니다.",
  "실시간 게임 모니터링에서 배팅 분포·사이드벳·스코어를 확인합니다.",
  "점수 이상이 있으면 수동 보정 후, 끝나면 수동을 끄고 실황에 맡깁니다.",
  "경기 종료 후 사이드벳 정산·문의·공지를 확인합니다.",
];

export const OPERATOR_EXCEPTION_STEPS: string[] = [
  "경기전(scheduled, 시작 5분 전 이전)에는 예측·진행 버튼이 비활성입니다.",
  "정상: 실황이 열고 닫고 결과를 확정합니다. TV를 보며 필요할 때만 누릅니다.",
  "가드에 걸리면: 예측시작 → 중지 → 결과 전송 → 다음 타자(3아웃이면 공수교대).",
  "투수교체: 같은 타석 유지(대타 유지). 진행 중 예측은 환불·결과 생략 가능. 광고 시작.",
  "공수교대: 3아웃 후. 광고 시작. 예측 시작으로 광고를 끄면 보상 없음.",
  "경기 종료: 약 10초 「경기종료」 후 로그아웃입니다. 「세션 만료」가 아닙니다.",
];

export const AD_RULE_ROWS: HandbookTable = {
  headers: ["상황", "동작", "보상"],
  rows: [
    ["투수교체·공수교대", "안내 5초 후 리워드 동영상 시작", `운영자 중지까지 보면 ${AD_REWARD_POINTS}P`],
    ["예측 시작", "광고 중지 (ad_stopped: prediction_start)", "없음"],
    ["운영자 광고 중지", "ad_stopped: operator_stop", `${AD_REWARD_POINTS}P`],
    ["라운드 진행만", "ad_stopped: round_advance — 광고만 닫기", "없음"],
    [`웹 × (${AD_EARLY_DISMISS_SECONDS}초 후)`, "같은 광고 세션은 재표시 안 함", "없음"],
    [
      `${AD_PLAY_SECONDS}초 경과`,
      "워치독이 광고 세션을 종료(reason=operator_stop). 예측 창은 운영자 「예측 시작」",
      `${AD_REWARD_POINTS}P`,
    ],
    ["예측 게임 하단 배너", "사용하지 않음", "—"],
  ],
};

export const PREDICTION_ODDS_TABLE: HandbookTable = {
  headers: ["예측", "배당", "100P 적중"],
  rows: (Object.entries(PREDICTION_ODDS) as [PredictionResult, number][]).map(([k, v]) => [
    k,
    `${v}배`,
    `${Math.floor(100 * v)}P`,
  ]),
};

export const BET_AMOUNT_FACT = `타석 ${BET_AMOUNT_OPTIONS.join(" / ")}P · 사이드벳 ${SIDE_BET_AMOUNT_OPTIONS.join(" / ")}P · 승리팀 ${WINNER_ODDS}배 · 최종스코어 ${EXACT_SCORE_ODDS}배`;

export const ADMIN_MENU_MAP: { section: string; items: string[] }[] = [
  {
    section: "기본",
    items: [
      "앱 홈 설정",
      "KBO 선수단",
      "오늘의 선발명단",
      "앱 파일 등록/다운로드",
    ],
  },
  {
    section: "쇼핑몰 · 판매",
    items: ["쇼핑몰 확인·관리", "주문·판매·재고·구매 관리"],
  },
  {
    section: "슈퍼바이저",
    items: [
      "관리자 등록·리스트",
      "시스템 매뉴얼",
      "디비 백업하기",
      "관리자·운영자 로그인 현황",
    ],
  },
  {
    section: "수익",
    items: ["동영상 광고 수익·관리", "배너 수익", "대기 화면 관리"],
  },
  {
    section: "경기 · 회원",
    items: [
      "경기 관리(달력)",
      "실시간 게임 모니터링",
      "운영자 등록·리스트·상태",
      "회원 리스트·랭킹·초대",
    ],
  },
  {
    section: "고객 지원",
    items: ["공지", "회원 문의", "게시판", "약관"],
  },
];

export const MALL_POLICY_BULLETS: string[] = [
  "운영 URL: https://ppamong.com/shop (회원가입은 사용자 앱만).",
  "정회원(게스트 아님)만 주문. 게스트·비로그인은 둘러보기·장바구니만.",
  "1차 결제는 현금 주문 접수. 게임 포인트로 직접 결제하지 않습니다.",
  "관리자 웹에서 상품·주문·재고·매입을 다룹니다. 운영자 앱에서는 몰 관리가 없습니다.",
];

export const DB_COLLECTION_TABLE: HandbookTable = {
  headers: ["영역", "모델", "설명"],
  rows: [
    ["회원", "User, AttendanceRecord, PointTransaction", "계정·출석·포인트"],
    ["경기", "Match, Stadium, KboPlayer", "일정·스코어보드·타순·대타"],
    ["예측", "Prediction, RoundStatistics, MatchSideBet", "타석·라운드·사이드벳"],
    ["운영", "AdminUser", "스태프·슈퍼바이저·운영자"],
    ["콘텐츠", "Notice, Inquiry, Post, Term, Faq", "공지·문의·게시판·약관"],
    ["광고", "Advertisement, AdViewHistory, WaitingScreen, AppAdmobConfig", "배너·영상·대기·AdMob"],
    ["몰", "GoodsProduct, MallOrder, MallStock…", "상품·주문·재고"],
    ["소셜", "FriendRoom, FriendRoomMember", "친구·동호회 방(공개 예측 함께 참여)"],
  ],
};

export const DB_MATCH_FIELD_NOTES: string[] = [
  "matchStatus: scheduled | ongoing | completed | cancelled — ongoing은 다음 실황 근거만.",
  "predictionEnabled / sideBetsLocked — 타석 예측 오픈·사이드벳 마감.",
  "liveScoreboard / controlMode(auto|manual) — 다음 점수판. manual이면 운영자 점수 유지.",
  "liveAutoEnabled — 기본 true. UI 토글 없음. false 잔여는 폴링 시 복구.",
  "atBatPhase — 타석 상태머신(WS at_bat_phase). 회원 uiStage의 권위.",
  "pinchHitter — 현재 타석 대타. 다음 타자·공수교대 시 해제, 투수교체 시 유지.",
  "daumGameId — 다음 스포츠 경기 ID. apiSportsGameId는 레거시 필드입니다.",
];

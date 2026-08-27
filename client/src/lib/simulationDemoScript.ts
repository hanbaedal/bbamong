import {
  PREDICTION_ODDS,
  calculateFixedOddsPayout,
  calculateSideBetPayout,
} from "@shared/predictionOdds";
import type { GameSceneKind } from "@/components/game/gameSceneBackground";

export type DemoStepId =
  | "screen"
  | "story"
  | "info"
  | "side"
  | "start"
  | "atbat"
  | "settle"
  | "outro";

export type DemoView =
  | "intro"
  | "game-ui"
  | "menu-hub"
  | "side-matches"
  | "side-winner"
  | "side-score"
  | "match-start"
  | "atbat"
  | "settle"
  | "outro";

export type DemoMenuKind = "story" | "info";

export interface DemoVisualState {
  view: DemoView;
  practicePoints: number;
  matchStatus: "pregame" | "live" | "ended";
  sideLocked: boolean;
  winnerBet: { side: "home" | "away"; amount: number } | null;
  scoreBet: { home: number; away: number; amount: number } | null;
  winnerSettle: string | null;
  scoreSettle: string | null;
  finalScore: { home: number; away: number } | null;
  betAmount: number | null;
  prediction: string | null;
  actualResult: string | null;
  atBatPhase: "idle" | "wait_batter" | "pick" | "wait" | "flash" | "running" | "result";
  atBatHit: boolean | null;
  /** 타석·경기전 장면 배경. 메뉴·사이드 화면은 null */
  sceneKind: GameSceneKind | null;
  highlightId: string | null;
  pulseId: string | null;
  /** 예측 화면 투어 포커스 */
  uiFocus: "overview" | "scoreboard" | "field" | "bottom" | "left-menu" | "ad" | null;
  menuKind: DemoMenuKind | null;
  menuFocusId: string | null;
}

export interface DemoScene {
  id: string;
  stepId: DemoStepId;
  caption: string;
  durationMs: number;
  state: DemoVisualState;
}

/** 좌측 단계 네비에 노출 (outro·start는 내부용) */
export const DEMO_STEPS: { id: DemoStepId; label: string }[] = [
  { id: "screen", label: "① 화면 안내" },
  { id: "story", label: "② 내이야기" },
  { id: "info", label: "③ 내정보" },
  { id: "side", label: "④ 오늘의 경기" },
  { id: "atbat", label: "⑤ 타석 예측" },
  { id: "settle", label: "⑥ 정산" },
];

export const DEMO_STORY_ITEMS: { id: string; label: string; blurb: string }[] = [
  { id: "victory", label: "승리현황", blurb: "적중·포인트 획득 기록을 확인합니다." },
  { id: "invite", label: "친구 초대", blurb: "초대 코드를 공유하고 보너스를 받을 수 있습니다." },
  { id: "attendance", label: "출석 체크", blurb: "매일 출석하면 포인트를 얻습니다." },
  { id: "ebook", label: "나의 콘텐츠", blurb: "전자책 등 내 콘텐츠를 봅니다." },
  { id: "donation", label: "사회공헌 참여현황", blurb: "기부·사회공헌 참여 내역을 봅니다." },
];

export const DEMO_INFO_ITEMS: { id: string; label: string; blurb: string }[] = [
  { id: "profile", label: "회원정보", blurb: "본인 확인 후 프로필을 확인하고 수정합니다." },
  { id: "point", label: "추가 참여", blurb: "보유 포인트와 참여·적립 내역을 봅니다." },
  { id: "faq", label: "Q&A", blurb: "자주 묻는 질문과 답변을 확인합니다." },
  { id: "terms", label: "서비스 이용약관", blurb: "서비스 이용약관을 열람합니다." },
  { id: "withdraw", label: "탈퇴하기", blurb: "회원 탈퇴를 진행합니다. 신중히 선택하세요." },
];

const MATCH_ROWS = [
  { id: "m1", title: "제 1경기", stadium: "잠실", active: true },
  { id: "m2", title: "제 2경기", stadium: "고척", active: false },
  { id: "m3", title: "제 3경기", stadium: "수원", active: false },
  { id: "m4", title: "제 4경기", stadium: "대구", active: false },
  { id: "m5", title: "제 5경기", stadium: "광주", active: false },
] as const;

export { MATCH_ROWS };

const AT_BAT_AMOUNT = 100;
const AT_BAT_PICK = "1루" as keyof typeof PREDICTION_ODDS;
const SIDE_AMOUNT = 100;
const FINAL = { home: 3, away: 2 };

const base: DemoVisualState = {
  view: "intro",
  practicePoints: 3000,
  matchStatus: "pregame",
  sideLocked: false,
  winnerBet: null,
  scoreBet: null,
  winnerSettle: null,
  scoreSettle: null,
  finalScore: null,
  betAmount: null,
  prediction: null,
  actualResult: null,
  atBatPhase: "idle",
  atBatHit: null,
  sceneKind: null,
  highlightId: null,
  pulseId: null,
  uiFocus: null,
  menuKind: null,
  menuFocusId: null,
};

function s(partial: Partial<DemoVisualState>): DemoVisualState {
  return { ...base, ...partial };
}

const winnerPayout = calculateSideBetPayout(SIDE_AMOUNT, "winner");
const scorePayout = calculateSideBetPayout(SIDE_AMOUNT, "score");
const atBatPayout = calculateFixedOddsPayout(AT_BAT_AMOUNT, AT_BAT_PICK);

const playPointsAfterAtBat = 2700 + atBatPayout;
const playPointsFinal = playPointsAfterAtBat + winnerPayout + scorePayout;

const liveSide = {
  practicePoints: 2800,
  winnerBet: { side: "home" as const, amount: SIDE_AMOUNT },
  scoreBet: { home: 3, away: 2, amount: SIDE_AMOUNT },
  sideLocked: true,
  matchStatus: "live" as const,
};

function storyScene(
  item: (typeof DEMO_STORY_ITEMS)[number],
  durationMs = 4800,
): DemoScene {
  return {
    id: `story-${item.id}`,
    stepId: "story",
    caption: `내이야기 · ${item.label} — ${item.blurb}`,
    durationMs,
    state: s({
      view: "menu-hub",
      matchStatus: "live",
      menuKind: "story",
      menuFocusId: item.id,
      highlightId: `demo-menu-${item.id}`,
      pulseId: `demo-menu-${item.id}`,
    }),
  };
}

function infoScene(
  item: (typeof DEMO_INFO_ITEMS)[number],
  durationMs = 4800,
): DemoScene {
  return {
    id: `info-${item.id}`,
    stepId: "info",
    caption: `내정보 · ${item.label} — ${item.blurb}`,
    durationMs,
    state: s({
      view: "menu-hub",
      matchStatus: "live",
      menuKind: "info",
      menuFocusId: item.id,
      highlightId: `demo-menu-${item.id}`,
      pulseId: `demo-menu-${item.id}`,
    }),
  };
}

/** 자동 데모 타임라인 — 화면·메뉴 안내 후 사이드·타석·정산 */
export const DEMO_SCENES: DemoScene[] = [
  {
    id: "intro",
    stepId: "screen",
    caption: "화면 구성과 메뉴를 본 뒤, 실제와 같은 배경으로 타석 흐름(경기전→주루)을 연습합니다.",
    durationMs: 6200,
    state: s({ view: "intro" }),
  },
  {
    id: "ui-overview",
    stepId: "screen",
    caption: "예측 화면은 가로 구성입니다. 왼쪽 메뉴 · 가운데 필드 · 상단 스코어 · 하단 요약이 있습니다.",
    durationMs: 7000,
    state: s({
      view: "game-ui",
      matchStatus: "live",
      uiFocus: "overview",
      highlightId: "demo-ui-shell",
    }),
  },
  {
    id: "ui-scoreboard",
    stepId: "screen",
    caption: "상단: 「제 N경기」와 경기장입니다. 좌상단 위젯은 이닝·점수(다음)와 주자·B-S(네이버)입니다.",
    durationMs: 6500,
    state: s({
      view: "game-ui",
      matchStatus: "live",
      uiFocus: "scoreboard",
      highlightId: "demo-ui-scoreboard",
      pulseId: "demo-ui-scoreboard",
    }),
  },
  {
    id: "ui-field",
    stepId: "screen",
    caption: "예측이 열리면 3D 구장에서 아웃·1루·2루·3루·홈런을 고릅니다. 선택 좌표는 이 구장만 씁니다.",
    durationMs: 7000,
    state: s({
      view: "game-ui",
      matchStatus: "live",
      uiFocus: "field",
      highlightId: "demo-ui-field",
      pulseId: "demo-ui-field",
    }),
  },
  {
    id: "ui-bottom",
    stepId: "screen",
    caption: "하단: 우승팀·최종 스코어 사이드 배팅 요약이 표시됩니다.",
    durationMs: 5800,
    state: s({
      view: "game-ui",
      matchStatus: "live",
      uiFocus: "bottom",
      highlightId: "demo-ui-bottom",
      pulseId: "demo-ui-bottom",
    }),
  },
  {
    id: "ui-left-menu",
    stepId: "screen",
    caption: "왼쪽 메뉴: 홈 · 내이야기 · 쇼핑센터 · 내정보입니다. 이어지는 장면에서 서브메뉴를 안내합니다.",
    durationMs: 6500,
    state: s({
      view: "game-ui",
      matchStatus: "live",
      uiFocus: "left-menu",
      highlightId: "demo-ui-left",
      pulseId: "demo-ui-left",
    }),
  },
  {
    id: "ui-ad",
    stepId: "screen",
      caption: "공수교대·투수교체 때 리워드 동영상만 나옵니다. 게임 중 하단 배너는 없습니다. 앱은 약 50초, 웹은 5초 후 ×(보상 없음). 운영자가 중지하면 500P입니다.",
    durationMs: 8000,
    state: s({
      view: "game-ui",
      matchStatus: "live",
      uiFocus: "ad",
      highlightId: "demo-ui-ad",
      pulseId: "demo-ui-ad",
    }),
  },

  {
    id: "story-intro",
    stepId: "story",
    caption: "「내이야기」에는 다섯 가지 서브메뉴가 있습니다.",
    durationMs: 4200,
    state: s({
      view: "menu-hub",
      matchStatus: "live",
      menuKind: "story",
      menuFocusId: null,
      highlightId: "demo-menu-hub",
    }),
  },
  ...DEMO_STORY_ITEMS.map((item) => storyScene(item)),

  {
    id: "info-intro",
    stepId: "info",
    caption: "「내정보」에는 회원·포인트·안내·탈퇴 메뉴가 있습니다.",
    durationMs: 4200,
    state: s({
      view: "menu-hub",
      matchStatus: "live",
      menuKind: "info",
      menuFocusId: null,
      highlightId: "demo-menu-hub",
    }),
  },
  ...DEMO_INFO_ITEMS.map((item) => infoScene(item)),

  {
    id: "side-list",
    stepId: "side",
    caption: "경기 전, 오늘의 경기에서 배팅할 경기를 고릅니다.",
    durationMs: 7000,
    state: s({ view: "side-matches", highlightId: "demo-match-list" }),
  },
  {
    id: "side-winner-open",
    stepId: "side",
    caption: "제 1경기 — 우승팀을 맞춥니다.",
    durationMs: 5200,
    state: s({
      view: "side-matches",
      highlightId: "demo-winner-btn",
      pulseId: "demo-winner-btn",
    }),
  },
  {
    id: "side-winner-pick",
    stepId: "side",
    caption: "제 1경기 — 우승팀을 맞춥니다.",
    durationMs: 6500,
    state: s({
      view: "side-winner",
      highlightId: "demo-pick-home",
      pulseId: "demo-pick-home",
    }),
  },
  {
    id: "side-winner-done",
    stepId: "side",
    caption: "제 1경기 — 우승팀을 맞춥니다.",
    durationMs: 4500,
    state: s({
      view: "side-matches",
      practicePoints: 3000 - SIDE_AMOUNT,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      highlightId: "demo-match-m1",
    }),
  },
  {
    id: "side-score-open",
    stepId: "side",
    caption: "같은 경기 — 최종 점수도 맞춥니다.",
    durationMs: 5200,
    state: s({
      view: "side-matches",
      practicePoints: 2900,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      highlightId: "demo-score-btn",
      pulseId: "demo-score-btn",
    }),
  },
  {
    id: "side-score-pick",
    stepId: "side",
    caption: "같은 경기 — 최종 점수도 맞춥니다.",
    durationMs: 6500,
    state: s({
      view: "side-score",
      practicePoints: 2900,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      highlightId: "demo-score-input",
      pulseId: "demo-score-input",
    }),
  },
  {
    id: "side-score-done",
    stepId: "side",
    caption: "같은 경기 — 최종 점수도 맞춥니다.",
    durationMs: 5200,
    state: s({
      view: "side-matches",
      practicePoints: 2800,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      scoreBet: { home: 3, away: 2, amount: SIDE_AMOUNT },
      highlightId: "demo-match-m1",
    }),
  },
  {
    id: "match-start",
    stepId: "atbat",
    caption: "경기전 화면은 쿠어스 필드 전경입니다. 1회가 시작되면 사이드 배팅이 마감됩니다.",
    durationMs: 5500,
    state: s({
      view: "match-start",
      ...liveSide,
      sceneKind: "before",
      highlightId: "demo-start-btn",
      pulseId: "demo-start-btn",
    }),
  },
  {
    id: "atbat-wait-batter",
    stepId: "atbat",
    caption: "다음 타자 대기. 시네마틱 빠몽이(초=청 / 말=흰)가 나옵니다. 베이스 버튼은 아직 없습니다.",
    durationMs: 5500,
    state: s({
      view: "atbat",
      ...liveSide,
      sceneKind: "wait_home",
      atBatPhase: "wait_batter",
      highlightId: "demo-atbat-wait-batter",
    }),
  },
  {
    id: "atbat-amount",
    stepId: "atbat",
    caption: "예측이 열리면 3D 구장이 됩니다. 먼저 배팅 금액을 고릅니다. (약 8초 후 자동 중지될 수 있음)",
    durationMs: 5200,
    state: s({
      view: "atbat",
      ...liveSide,
      sceneKind: "field",
      atBatPhase: "pick",
      betAmount: AT_BAT_AMOUNT,
      highlightId: "demo-bet-amount",
      pulseId: "demo-bet-amount",
    }),
  },
  {
    id: "atbat-pick",
    stepId: "atbat",
    caption: "3D 구장에서 아웃·1루·2루·3루·홈런을 고릅니다. 「1루」는 1루타·포볼·데드볼도 포함합니다.",
    durationMs: 7000,
    state: s({
      view: "atbat",
      ...liveSide,
      sceneKind: "field",
      atBatPhase: "pick",
      betAmount: AT_BAT_AMOUNT,
      prediction: AT_BAT_PICK,
      highlightId: "demo-pick-1루",
      pulseId: "demo-pick-1루",
    }),
  },
  {
    id: "atbat-wait",
    stepId: "atbat",
    caption: "결과 대기. 시네마틱 투수와 「내 예측」 배지가 나옵니다. 베이스 버튼은 없습니다.",
    durationMs: 5000,
    state: s({
      view: "atbat",
      ...liveSide,
      practicePoints: 2800 - AT_BAT_AMOUNT,
      sceneKind: "pitch_home",
      atBatPhase: "wait",
      betAmount: AT_BAT_AMOUNT,
      prediction: AT_BAT_PICK,
      highlightId: "demo-atbat-wait",
    }),
  },
  {
    id: "atbat-flash",
    stepId: "atbat",
    caption: "결과 큰 글씨(약 2.2초). 적중이면 주루, 빗나가면 대기로 돌아갑니다.",
    durationMs: 2800,
    state: s({
      view: "atbat",
      ...liveSide,
      practicePoints: 2800 - AT_BAT_AMOUNT,
      sceneKind: "pitch_home",
      atBatPhase: "flash",
      betAmount: AT_BAT_AMOUNT,
      prediction: AT_BAT_PICK,
      actualResult: AT_BAT_PICK,
      atBatHit: true,
      highlightId: "demo-atbat-flash",
    }),
  },
  {
    id: "atbat-running",
    stepId: "atbat",
    caption: "적중 주루는 필리스 실사입니다. 1루=홈→1루. 홈런은 1·2·3루를 돌아 홈(중견으로 가지 않음).",
    durationMs: 6500,
    state: s({
      view: "atbat",
      ...liveSide,
      practicePoints: playPointsAfterAtBat,
      sceneKind: "running",
      atBatPhase: "running",
      betAmount: AT_BAT_AMOUNT,
      prediction: AT_BAT_PICK,
      actualResult: AT_BAT_PICK,
      atBatHit: true,
      highlightId: "demo-atbat-running",
    }),
  },
  {
    id: "atbat-result",
    stepId: "atbat",
    caption: "1루 적중! 선택금액 × 배당이 지급됩니다. 축하 점프는 생략하고 바로 다음 타석입니다.",
    durationMs: 5000,
    state: s({
      view: "atbat",
      ...liveSide,
      practicePoints: playPointsAfterAtBat,
      sceneKind: "wait_home",
      atBatPhase: "result",
      betAmount: AT_BAT_AMOUNT,
      prediction: AT_BAT_PICK,
      actualResult: AT_BAT_PICK,
      atBatHit: true,
      highlightId: "demo-atbat-result",
    }),
  },
  {
    id: "match-end",
    stepId: "settle",
    caption: "경기 종료 후 사이드 배팅을 실황 최종 스코어로 정산합니다. (약 10초 「경기종료」 안내 후 홈으로 이동)",
    durationMs: 7000,
    state: s({
      view: "settle",
      practicePoints: playPointsAfterAtBat,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      scoreBet: { home: 3, away: 2, amount: SIDE_AMOUNT },
      sideLocked: true,
      matchStatus: "ended",
      finalScore: FINAL,
      betAmount: AT_BAT_AMOUNT,
      prediction: AT_BAT_PICK,
      actualResult: AT_BAT_PICK,
      atBatHit: true,
      highlightId: "demo-settle",
    }),
  },
  {
    id: "settle-detail",
    stepId: "settle",
    caption: "우승팀·최종 스코어 적중 시 각각 배당에 따라 포인트가 지급됩니다.",
    durationMs: 8500,
    state: s({
      view: "settle",
      practicePoints: playPointsFinal,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      scoreBet: { home: 3, away: 2, amount: SIDE_AMOUNT },
      sideLocked: true,
      matchStatus: "ended",
      finalScore: FINAL,
      winnerSettle: `적중 +${winnerPayout}P`,
      scoreSettle: `적중 +${scorePayout}P`,
      betAmount: AT_BAT_AMOUNT,
      prediction: AT_BAT_PICK,
      actualResult: AT_BAT_PICK,
      atBatHit: true,
      highlightId: "demo-settle-detail",
    }),
  },
  {
    id: "outro",
    stepId: "outro",
    caption: "연습은 여기까지입니다. 실제 경기에 참여하거나 사용설명서·게임 소개를 다시 볼 수 있습니다.",
    durationMs: 9000,
    state: s({
      view: "outro",
      practicePoints: playPointsFinal,
      matchStatus: "ended",
      finalScore: FINAL,
      winnerSettle: `적중 +${winnerPayout}P`,
      scoreSettle: `적중 +${scorePayout}P`,
    }),
  },
];

export const DEMO_TOTAL_MS = DEMO_SCENES.reduce((sum, scene) => sum + scene.durationMs, 0);

export function formatDemoTime(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 시작 화면용 재생 시간 (예: "약 2분 10초") */
export function formatDemoDurationLabel(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `약 ${s}초`;
  if (s <= 0) return `약 ${m}분`;
  return `약 ${m}분 ${s}초`;
}

export function getElapsedBeforeScene(sceneIndex: number): number {
  return DEMO_SCENES.slice(0, sceneIndex).reduce((sum, scene) => sum + scene.durationMs, 0);
}

export function getFirstSceneIndexForStep(stepId: DemoStepId): number {
  const idx = DEMO_SCENES.findIndex((scene) => scene.stepId === stepId);
  return idx >= 0 ? idx : 0;
}

/** 네비 표시용 — outro는 정산으로, start는 타석으로 묶음 */
export function resolveNavStepId(stepId: DemoStepId): DemoStepId {
  if (stepId === "outro") return "settle";
  if (stepId === "start") return "atbat";
  return stepId;
}

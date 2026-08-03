import {
  PREDICTION_ODDS,
  calculateFixedOddsPayout,
  calculateSideBetPayout,
} from "@shared/predictionOdds";

export type DemoStepId = "side" | "start" | "atbat" | "settle" | "outro";

export type DemoView =
  | "intro"
  | "side-matches"
  | "side-winner"
  | "side-score"
  | "match-start"
  | "atbat"
  | "settle"
  | "outro";

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
  atBatPhase: "idle" | "pick" | "wait" | "result";
  atBatHit: boolean | null;
  highlightId: string | null;
  pulseId: string | null;
}

export interface DemoScene {
  id: string;
  stepId: DemoStepId;
  caption: string;
  durationMs: number;
  state: DemoVisualState;
}

export const DEMO_STEPS: { id: DemoStepId; label: string }[] = [
  { id: "side", label: "① 오늘의 경기" },
  { id: "start", label: "② 경기 시작" },
  { id: "atbat", label: "③ 타석 예측" },
  { id: "settle", label: "④ 정산" },
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
  highlightId: null,
  pulseId: null,
};

function s(partial: Partial<DemoVisualState>): DemoVisualState {
  return { ...base, ...partial };
}

const winnerPayout = calculateSideBetPayout(SIDE_AMOUNT, "winner");
const scorePayout = calculateSideBetPayout(SIDE_AMOUNT, "score");
const atBatPayout = calculateFixedOddsPayout(AT_BAT_AMOUNT, AT_BAT_PICK);

/** 자동 데모 타임라인 (2분 10초 @ 1x, 50·60대 여유 시청) */
export const DEMO_SCENES: DemoScene[] = [
  {
    id: "intro",
    stepId: "side",
    caption: "예측 게임 흐름을 연습으로 보여 드립니다.",
    durationMs: 7050,
    state: s({ view: "intro" }),
  },
  {
    id: "side-list",
    stepId: "side",
    caption: "경기 전, 오늘의 경기에서 배팅할 경기를 고릅니다.",
    durationMs: 8350,
    state: s({ view: "side-matches", highlightId: "demo-match-list" }),
  },
  {
    id: "side-winner-open",
    stepId: "side",
    caption: "제 1경기 — 우승팀을 맞춥니다.",
    durationMs: 6150,
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
    durationMs: 7900,
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
    durationMs: 5250,
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
    durationMs: 6150,
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
    durationMs: 8350,
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
    durationMs: 6600,
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
    stepId: "start",
    caption: "경기 시작. 사이드 배팅이 마감됩니다.",
    durationMs: 7900,
    state: s({
      view: "match-start",
      practicePoints: 2800,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      scoreBet: { home: 3, away: 2, amount: SIDE_AMOUNT },
      sideLocked: true,
      matchStatus: "live",
      highlightId: "demo-start-btn",
      pulseId: "demo-start-btn",
    }),
  },
  {
    id: "atbat-amount",
    stepId: "atbat",
    caption: "타석마다 결과를 예측합니다.",
    durationMs: 7050,
    state: s({
      view: "atbat",
      practicePoints: 2800,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      scoreBet: { home: 3, away: 2, amount: SIDE_AMOUNT },
      sideLocked: true,
      matchStatus: "live",
      atBatPhase: "pick",
      betAmount: AT_BAT_AMOUNT,
      highlightId: "demo-bet-amount",
      pulseId: "demo-bet-amount",
    }),
  },
  {
    id: "atbat-pick",
    stepId: "atbat",
    caption: "타석마다 결과를 예측합니다.",
    durationMs: 7900,
    state: s({
      view: "atbat",
      practicePoints: 2800,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      scoreBet: { home: 3, away: 2, amount: SIDE_AMOUNT },
      sideLocked: true,
      matchStatus: "live",
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
    caption: "결과를 기다립니다.",
    durationMs: 6150,
    state: s({
      view: "atbat",
      practicePoints: 2800 - AT_BAT_AMOUNT,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      scoreBet: { home: 3, away: 2, amount: SIDE_AMOUNT },
      sideLocked: true,
      matchStatus: "live",
      atBatPhase: "wait",
      betAmount: AT_BAT_AMOUNT,
      prediction: AT_BAT_PICK,
      highlightId: "demo-atbat-wait",
    }),
  },
  {
    id: "atbat-result",
    stepId: "atbat",
    caption: "1루 적중!",
    durationMs: 9200,
    state: s({
      view: "atbat",
      practicePoints: 2700 + atBatPayout,
      winnerBet: { side: "home", amount: SIDE_AMOUNT },
      scoreBet: { home: 3, away: 2, amount: SIDE_AMOUNT },
      sideLocked: true,
      matchStatus: "live",
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
    caption: "경기 종료 후 정산합니다.",
    durationMs: 7900,
    state: s({
      view: "settle",
      practicePoints: 2700 + atBatPayout,
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
    caption: "경기 종료 후 정산합니다.",
    durationMs: 10550,
    state: s({
      view: "settle",
      practicePoints: 2700 + atBatPayout + winnerPayout + scorePayout,
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
    caption: "다른 메뉴는 사용 설명서를 참고하세요.",
    durationMs: 17550,
    state: s({
      view: "outro",
      practicePoints: 2700 + atBatPayout + winnerPayout + scorePayout,
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

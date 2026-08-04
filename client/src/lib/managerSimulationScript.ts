export type ManagerSimPhase =
  | "idle"
  | "predicting"
  | "stopped"
  | "result_sent"
  | "next_batter"
  | "pitcher_change"
  | "side_change"
  | "ad_playing";

export type ManagerSimHighlight =
  | "start"
  | "stop"
  | "result"
  | "confirm"
  | "next_batter"
  | "pitcher"
  | "side_change"
  | "ad_stop"
  | null;

export interface ManagerSimVisualState {
  phase: ManagerSimPhase;
  inning: number;
  round: number;
  homeScore: number;
  awayScore: number;
  selectedResult: string | null;
  highlightId: ManagerSimHighlight;
  pulseId: ManagerSimHighlight;
  showThreeOuts: boolean;
  adPlaying: boolean;
}

export interface ManagerSimScene {
  id: string;
  caption: string;
  durationMs: number;
  state: ManagerSimVisualState;
}

const base: ManagerSimVisualState = {
  phase: "idle",
  inning: 1,
  round: 1,
  homeScore: 0,
  awayScore: 0,
  selectedResult: null,
  highlightId: null,
  pulseId: null,
  showThreeOuts: false,
  adPlaying: false,
};

function s(partial: Partial<ManagerSimVisualState>): ManagerSimVisualState {
  return { ...base, ...partial };
}

export const MANAGER_SIM_SCENES: ManagerSimScene[] = [
  {
    id: "intro",
    caption: "연습 모드입니다. 실제 경기·유저 데이터에 반영되지 않습니다.",
    durationMs: 4500,
    state: s({ phase: "idle" }),
  },
  {
    id: "scoreboard",
    caption: "상단 스코어보드와 이닝을 중계와 맞춰 확인합니다.",
    durationMs: 5000,
    state: s({ phase: "idle", highlightId: null }),
  },
  {
    id: "start-prompt",
    caption: "타자가 타석에 들어가기 전 「예측 시작」을 누릅니다.",
    durationMs: 4500,
    state: s({ phase: "idle", highlightId: "start", pulseId: "start" }),
  },
  {
    id: "start",
    caption: "예측 시작 — 회원 앱에 타석 예측 화면이 열립니다.",
    durationMs: 5500,
    state: s({ phase: "predicting", highlightId: "start" }),
  },
  {
    id: "predicting",
    caption: "회원이 타석 결과를 예측하는 동안 대기합니다.",
    durationMs: 5000,
    state: s({ phase: "predicting" }),
  },
  {
    id: "stop-prompt",
    caption: "타석 결과 직전 「예측 중지」로 배팅을 마감합니다.",
    durationMs: 4500,
    state: s({ phase: "predicting", highlightId: "stop", pulseId: "stop" }),
  },
  {
    id: "stop",
    caption: "예측 중지 — 이제 결과를 입력할 수 있습니다.",
    durationMs: 4500,
    state: s({ phase: "stopped", highlightId: "stop" }),
  },
  {
    id: "pick-result",
    caption: "실제 타석 결과(예: 1루)를 선택합니다.",
    durationMs: 5000,
    state: s({
      phase: "stopped",
      highlightId: "result",
      pulseId: "result",
      selectedResult: "1루",
    }),
  },
  {
    id: "confirm-result",
    caption: "「결과 전송 확인」으로 정산합니다.",
    durationMs: 5000,
    state: s({
      phase: "stopped",
      highlightId: "confirm",
      pulseId: "confirm",
      selectedResult: "1루",
    }),
  },
  {
    id: "result-sent",
    caption: "결과 반영 — 적중 회원에게 배당이 지급됩니다(가상).",
    durationMs: 5500,
    state: s({ phase: "result_sent", selectedResult: "1루", round: 2 }),
  },
  {
    id: "next-batter",
    caption: "「다음 타자」로 다음 라운드를 진행합니다.",
    durationMs: 5000,
    state: s({
      phase: "next_batter",
      round: 2,
      highlightId: "next_batter",
      pulseId: "next_batter",
    }),
  },
  {
    id: "three-outs",
    caption: "3아웃 — 「공수 교대」를 눌러 이닝을 넘깁니다.",
    durationMs: 5000,
    state: s({
      phase: "idle",
      round: 3,
      showThreeOuts: true,
      highlightId: "side_change",
      pulseId: "side_change",
    }),
  },
  {
    id: "side-ad",
    caption: "공수교대 — 광고가 재생됩니다(연습).",
    durationMs: 5500,
    state: s({
      phase: "ad_playing",
      inning: 2,
      adPlaying: true,
      showThreeOuts: false,
      highlightId: "ad_stop",
    }),
  },
  {
    id: "ad-stop",
    caption: "광고 종료 후 경기를 이어갑니다.",
    durationMs: 4500,
    state: s({
      phase: "idle",
      inning: 2,
      adPlaying: false,
      highlightId: "ad_stop",
      pulseId: "ad_stop",
    }),
  },
  {
    id: "outro",
    caption: "실제 경기 전에 시뮬레이션으로 충분히 연습하세요.",
    durationMs: 6000,
    state: s({ phase: "idle", inning: 2, round: 1 }),
  },
];

export const MANAGER_SIM_TOTAL_MS = MANAGER_SIM_SCENES.reduce(
  (sum, scene) => sum + scene.durationMs,
  0,
);

export function getElapsedBeforeManagerScene(sceneIndex: number): number {
  let elapsed = 0;
  for (let i = 0; i < sceneIndex; i++) {
    elapsed += MANAGER_SIM_SCENES[i]?.durationMs ?? 0;
  }
  return elapsed;
}

export function formatManagerSimTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export const MANAGER_RESULT_OPTIONS = ["아웃", "1루", "2루", "3루", "홈런"] as const;

export function managerPhaseLabel(phase: ManagerSimPhase): string {
  switch (phase) {
    case "idle":
      return "대기";
    case "predicting":
      return "예측 진행 중";
    case "stopped":
      return "예측 중지 · 결과 입력";
    case "result_sent":
      return "결과 반영됨";
    case "next_batter":
      return "다음 타자";
    case "pitcher_change":
      return "투수 교체";
    case "side_change":
      return "공수 교대";
    case "ad_playing":
      return "광고 재생 중";
    default:
      return phase;
  }
}

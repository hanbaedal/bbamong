import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Pause, Play, SkipForward } from "lucide-react";
import {
  DEMO_SCENES,
  DEMO_STEPS,
  DEMO_STORY_ITEMS,
  DEMO_INFO_ITEMS,
  DEMO_TOTAL_MS,
  MATCH_ROWS,
  formatDemoTime,
  formatDemoDurationLabel,
  getElapsedBeforeScene,
  getFirstSceneIndexForStep,
  resolveNavStepId,
  type DemoStepId,
  type DemoVisualState,
} from "@/lib/simulationDemoScript";
import { PREDICTION_ODDS as ODDS_MAP } from "@shared/predictionOdds";
import { USER_GUIDE_OPEN_KEY } from "@/pages/home/user-guide";

const AT_BAT_OPTIONS = Object.keys(ODDS_MAP);
const LEFT_MENU = [
  { id: "home", label: "홈" },
  { id: "story", label: "내이야기" },
  { id: "mall", label: "쇼핑센터" },
  { id: "info", label: "내정보" },
] as const;
const FIELD_OPTS = ["아웃", "1루", "2루", "3루", "홈런"] as const;

function highlightClass(id: string | null, target: string, pulse?: string | null): string {
  if (id !== target) return "user-sim-demo-block";
  return pulse === target ? "user-sim-demo-block user-sim-demo-block--pulse" : "user-sim-demo-block user-sim-demo-block--hot";
}

function DemoChrome({ state }: { state: DemoVisualState }) {
  const showScore =
    state.matchStatus === "live" || state.matchStatus === "ended" || state.view === "settle";
  const scoreHome = state.finalScore?.home ?? 0;
  const scoreAway = state.finalScore?.away ?? 0;

  return (
    <div className="user-sim-demo-chrome">
      <div className="user-sim-demo-statusbar">
        <span className="user-sim-demo-badge">연습 {state.practicePoints}P</span>
        <span className="user-sim-demo-badge user-sim-demo-badge--muted">
          {state.matchStatus === "pregame"
            ? "경기 전"
            : state.matchStatus === "live"
              ? "경기 중 · 1회"
              : "경기 종료"}
        </span>
        {state.sideLocked && state.matchStatus !== "ended" && (
          <span className="user-sim-demo-badge user-sim-demo-badge--warn">사이드 마감</span>
        )}
      </div>
      {showScore && state.view !== "game-ui" && (
        <div className="user-sim-demo-scoreboard user-sim-demo-scoreboard--compact">
          <div>
            <span className="user-sim-demo-score-label">홈</span>
            <span className="user-sim-demo-score-num">{scoreHome}</span>
          </div>
          <span className="user-sim-demo-score-colon">:</span>
          <div>
            <span className="user-sim-demo-score-label">원정</span>
            <span className="user-sim-demo-score-num">{scoreAway}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoStepsNav({
  activeStep,
  onSelectStep,
  started,
}: {
  activeStep: DemoStepId;
  onSelectStep?: (stepId: DemoStepId) => void;
  started: boolean;
}) {
  const activeIdx = DEMO_STEPS.findIndex((s) => s.id === activeStep);
  return (
    <nav className="user-sim-demo-steps user-sim-demo-steps--stack" aria-label="데모 단계">
      {DEMO_STEPS.map((step, idx) => {
        const isActive = activeStep === step.id;
        const isDone = idx < activeIdx;
        const className = `user-sim-demo-step ${isActive ? "user-sim-demo-step--active" : ""} ${
          isDone ? "user-sim-demo-step--done" : ""
        } ${started && onSelectStep ? "user-sim-demo-step--clickable" : ""}`;
        if (started && onSelectStep) {
          return (
            <button
              key={step.id}
              type="button"
              className={className}
              onClick={() => onSelectStep(step.id)}
            >
              {step.label}
            </button>
          );
        }
        return (
          <span key={step.id} className={className}>
            {step.label}
          </span>
        );
      })}
    </nav>
  );
}

function DemoGuidePanel({
  activeStep,
  state,
  caption,
  started,
  onStart,
  onSelectStep,
  showOutroActions,
  outroActions,
}: {
  activeStep: DemoStepId;
  state: DemoVisualState;
  caption: string;
  started: boolean;
  onStart: () => void;
  onSelectStep: (stepId: DemoStepId) => void;
  showOutroActions: boolean;
  outroActions: ReactNode;
}) {
  return (
    <div className="user-sim-demo-guide">
      <DemoStepsNav activeStep={activeStep} onSelectStep={onSelectStep} started={started} />
      {started ? <DemoChrome state={state} /> : null}
      {!started ? (
        <div className="user-sim-demo-guide-intro">
          <p className="user-sim-demo-stage-kicker">{formatDemoDurationLabel(DEMO_TOTAL_MS)} · 자동 재생</p>
          <p className="user-sim-demo-stage-lead">
            화면·메뉴 안내 후
            <br />
            사이드·타석·정산을 연습합니다.
            <br />
            <span className="user-sim-demo-stage-hint">왼쪽 단계 탭으로 건너뛸 수 있습니다.</span>
          </p>
          <button type="button" className="user-sim-demo-start-btn" onClick={onStart}>
            데모 시작
          </button>
        </div>
      ) : (
        <p className="user-sim-demo-caption" data-testid="sim-demo-caption">
          {caption}
        </p>
      )}
      {showOutroActions ? <div className="user-sim-demo-outro-actions user-sim-demo-outro-actions--stack">{outroActions}</div> : null}
    </div>
  );
}

function DemoGameUi({ state }: { state: DemoVisualState }) {
  const { uiFocus, highlightId, pulseId } = state;
  const hot = (zone: NonNullable<DemoVisualState["uiFocus"]>) =>
    uiFocus === zone || uiFocus === "overview"
      ? highlightClass(highlightId, `demo-ui-${zone === "overview" ? "shell" : zone}`, pulseId)
      : "user-sim-demo-block";

  return (
    <div
      id="demo-ui-shell"
      className={`user-sim-demo-game-ui ${highlightClass(highlightId, "demo-ui-shell", pulseId)}`}
    >
      <aside
        id="demo-ui-left"
        className={`user-sim-demo-game-ui__left ${hot("left-menu")}`}
      >
        {LEFT_MENU.map((item) => (
          <span
            key={item.id}
            className={`user-sim-demo-game-ui__nav ${
              uiFocus === "left-menu" && (item.id === "story" || item.id === "info")
                ? "user-sim-demo-game-ui__nav--on"
                : ""
            }`}
          >
            {item.label}
          </span>
        ))}
      </aside>
      <div className="user-sim-demo-game-ui__main">
        <div
          id="demo-ui-scoreboard"
          className={`user-sim-demo-game-ui__top ${hot("scoreboard")}`}
        >
          <span className="user-sim-demo-game-ui__match">제 1경기 · 잠실</span>
          <span className="user-sim-demo-game-ui__score">홈 0 : 0 원정</span>
        </div>
        <div id="demo-ui-field" className={`user-sim-demo-game-ui__field ${hot("field")}`}>
          <div className="user-sim-demo-game-ui__diamond">
            {FIELD_OPTS.map((opt) => (
              <span key={opt} className="user-sim-demo-game-ui__base">
                {opt}
              </span>
            ))}
          </div>
        </div>
        <div id="demo-ui-bottom" className={`user-sim-demo-game-ui__bottom ${hot("bottom")}`}>
          <span>우승팀 배팅 —</span>
          <span>스코어 배팅 —</span>
        </div>
      </div>
      {uiFocus === "ad" && (
        <div id="demo-ui-ad" className={`user-sim-demo-game-ui__ad ${hot("ad")}`}>
          <span className="user-sim-demo-game-ui__ad-x">×</span>
          <p>광고 재생 중…</p>
          <p className="user-sim-demo-panel-sub">5초 후 끄기 · 끝까지 보면 보상</p>
        </div>
      )}
    </div>
  );
}

function DemoMenuHub({ state }: { state: DemoVisualState }) {
  const items = state.menuKind === "info" ? DEMO_INFO_ITEMS : DEMO_STORY_ITEMS;
  const title = state.menuKind === "info" ? "내정보" : "내이야기";
  const { highlightId, pulseId, menuFocusId } = state;
  const focused = items.find((item) => item.id === menuFocusId);

  return (
    <div id="demo-menu-hub" className={highlightClass(highlightId, "demo-menu-hub", pulseId)}>
      <p className="user-sim-demo-panel-title">{title}</p>
      <p className="user-sim-demo-panel-sub">왼쪽 메뉴에서 여는 서브메뉴</p>
      <ul className="user-sim-demo-menu-list">
        {items.map((item) => (
          <li
            key={item.id}
            id={`demo-menu-${item.id}`}
            className={`user-sim-demo-menu-row ${highlightClass(
              highlightId,
              `demo-menu-${item.id}`,
              pulseId,
            )} ${menuFocusId === item.id ? "user-sim-demo-menu-row--on" : ""}`}
          >
            <span className="user-sim-demo-menu-row__label">{item.label}</span>
          </li>
        ))}
      </ul>
      {focused ? <p className="user-sim-demo-menu-blurb">{focused.blurb}</p> : null}
    </div>
  );
}

function DemoScreen({ state, sceneId }: { state: DemoVisualState; sceneId: string }) {
  const { view, highlightId, pulseId } = state;

  if (view === "intro") {
    return (
      <div className="user-sim-demo-screen user-sim-demo-screen--center">
        <p className="user-sim-demo-stage-kicker">자동 데모</p>
        <p className="user-sim-demo-stage-lead">
          화면 안내 → 내이야기 → 내정보
          <br />
          → 오늘의 경기 → 타석 → 정산
        </p>
      </div>
    );
  }

  if (view === "outro") {
    return (
      <div className="user-sim-demo-screen user-sim-demo-screen--center">
        <p className="user-sim-demo-stage-kicker">데모 종료</p>
        {state.finalScore && (
          <p className="user-sim-demo-result-main">
            {state.finalScore.home} : {state.finalScore.away}
          </p>
        )}
        <p className="user-sim-demo-outro-score">연습 {state.practicePoints}P</p>
      </div>
    );
  }

  if (view === "game-ui") {
    return (
      <div key={sceneId} className="user-sim-demo-screen user-sim-demo-screen--fill">
        <DemoGameUi state={state} />
      </div>
    );
  }

  if (view === "menu-hub") {
    return (
      <div key={sceneId} className="user-sim-demo-screen">
        <DemoMenuHub state={state} />
      </div>
    );
  }

  const activeMatch = MATCH_ROWS.find((row) => row.active)!;
  const showFullMatchList = view === "side-matches" && sceneId === "side-list";

  let screen: ReactNode = null;

  if (view === "side-matches") {
    if (showFullMatchList) {
      screen = (
        <div className={highlightClass(highlightId, "demo-match-list", pulseId)}>
          <p className="user-sim-demo-panel-title">오늘의 경기</p>
          <p className="user-sim-demo-panel-sub">5경기</p>
          <ul className="user-sim-demo-match-list user-sim-demo-match-list--compact">
            {MATCH_ROWS.map((row) => (
              <li
                key={row.id}
                className={`user-sim-demo-match-row user-sim-demo-match-row--compact ${row.active ? "user-sim-demo-match-row--active" : ""}`}
              >
                <span>{row.title}</span>
                <span className="user-sim-demo-match-stadium">{row.stadium}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    } else {
      screen = (
        <div
          id="demo-match-m1"
          className={`user-sim-demo-match-card ${highlightClass(highlightId, "demo-match-m1", pulseId)}`}
        >
          <p className="user-sim-demo-panel-title">{activeMatch.title}</p>
          <p className="user-sim-demo-panel-sub">{activeMatch.stadium}</p>
          {state.winnerBet && (
            <p className="user-sim-demo-match-bet">
              우승팀: {state.winnerBet.side === "home" ? "홈팀" : "원정팀"} · {state.winnerBet.amount}P
            </p>
          )}
          {state.scoreBet && (
            <p className="user-sim-demo-match-bet">
              스코어: {state.scoreBet.home}-{state.scoreBet.away} · {state.scoreBet.amount}P
            </p>
          )}
          {!state.sideLocked && !state.scoreBet && (
            <div className="user-sim-demo-match-actions">
              <span
                id="demo-winner-btn"
                className={highlightClass(highlightId, "demo-winner-btn", pulseId)}
              >
                우승팀 맞추기
              </span>
              <span
                id="demo-score-btn"
                className={highlightClass(highlightId, "demo-score-btn", pulseId)}
              >
                점수 맞추기
              </span>
            </div>
          )}
          {!state.sideLocked && state.winnerBet && !state.scoreBet && (
            <div className="user-sim-demo-match-actions">
              <span
                id="demo-score-btn"
                className={highlightClass(highlightId, "demo-score-btn", pulseId)}
              >
                점수 맞추기
              </span>
            </div>
          )}
        </div>
      );
    }
  }

  if (view === "side-winner") {
    screen = (
      <div className={highlightClass(highlightId, "demo-pick-home", pulseId)}>
        <p className="user-sim-demo-panel-title">우승팀 맞추기</p>
        <p className="user-sim-demo-panel-sub">{activeMatch.title} · 100P</p>
        <div className="user-sim-demo-pick-row">
          <span id="demo-pick-home" className="user-sim-demo-pick user-sim-demo-pick--on">
            홈팀
          </span>
          <span className="user-sim-demo-pick">원정팀</span>
        </div>
      </div>
    );
  }

  if (view === "side-score") {
    screen = (
      <div id="demo-score-input" className={highlightClass(highlightId, "demo-score-input", pulseId)}>
        <p className="user-sim-demo-panel-title">점수 맞추기</p>
        <p className="user-sim-demo-panel-sub">{activeMatch.title} · 100P</p>
        <div className="user-sim-demo-score-form">
          <span className="user-sim-demo-score-box">3</span>
          <span className="user-sim-demo-score-colon">-</span>
          <span className="user-sim-demo-score-box">2</span>
        </div>
      </div>
    );
  }

  if (view === "match-start") {
    screen = (
      <div className="user-sim-demo-center-block">
        <p className="user-sim-demo-panel-title">
          {activeMatch.title} · {activeMatch.stadium}
        </p>
        <p className="user-sim-demo-panel-sub">사이드 배팅 접수 완료</p>
        <span id="demo-start-btn" className={`user-sim-demo-cta ${highlightClass(highlightId, "demo-start-btn", pulseId)}`}>
          경기 시작
        </span>
        <p className="user-sim-demo-panel-sub">1회 시작 · 사이드 마감</p>
      </div>
    );
  }

  if (view === "atbat") {
    if (state.atBatPhase === "pick" && highlightId === "demo-bet-amount") {
      screen = (
        <div id="demo-bet-amount" className={highlightClass(highlightId, "demo-bet-amount", pulseId)}>
          <p className="user-sim-demo-panel-title">타석 예측</p>
          <p className="user-sim-demo-panel-sub">배팅 금액 선택</p>
          <div className="user-sim-demo-chips">
            {[50, 100, 200, 500, 1000].map((n) => (
              <span
                key={n}
                className={`user-sim-demo-chip ${state.betAmount === n ? "user-sim-demo-chip--on" : ""}`}
              >
                {n}P
              </span>
            ))}
          </div>
        </div>
      );
    } else if (state.atBatPhase === "pick") {
      screen = (
        <div className={highlightClass(highlightId, "demo-pick-1루", pulseId)}>
          <p className="user-sim-demo-panel-title">타석 예측</p>
          <p className="user-sim-demo-panel-sub">{state.betAmount}P · 결과 선택</p>
          <div className="user-sim-demo-pick-grid">
            {AT_BAT_OPTIONS.map((opt) => (
              <span
                key={opt}
                id={opt === "1루" ? "demo-pick-1루" : undefined}
                className={`user-sim-demo-pick user-sim-demo-pick--odds ${
                  state.prediction === opt ? "user-sim-demo-pick--on" : ""
                }`}
              >
                <span>{opt}</span>
                <span className="user-sim-demo-odds">{ODDS_MAP[opt as keyof typeof ODDS_MAP]}배</span>
              </span>
            ))}
          </div>
        </div>
      );
    } else if (state.atBatPhase === "wait") {
      screen = (
        <div id="demo-atbat-wait" className={`user-sim-demo-wait ${highlightClass(highlightId, "demo-atbat-wait", pulseId)}`}>
          <p className="user-sim-demo-panel-title">타석 예측</p>
          <p className="user-sim-demo-wait-msg">결과 대기…</p>
          <p className="user-sim-demo-panel-sub">
            {state.prediction} · {state.betAmount}P
          </p>
        </div>
      );
    } else if (state.atBatPhase === "result") {
      screen = (
        <div id="demo-atbat-result" className={highlightClass(highlightId, "demo-atbat-result", pulseId)}>
          <p className="user-sim-demo-panel-title">타석 결과</p>
          <p className="user-sim-demo-result-main">{state.actualResult}</p>
          <p className={state.atBatHit ? "user-sim-demo-hit" : "user-sim-demo-miss"}>
            {state.atBatHit ? "적중!" : "미적중"}
          </p>
        </div>
      );
    }
  }

  if (view === "settle") {
    const scoreHome = state.finalScore?.home ?? 0;
    const scoreAway = state.finalScore?.away ?? 0;
    screen = (
      <div id="demo-settle" className={highlightClass(highlightId, "demo-settle", pulseId)}>
        <p className="user-sim-demo-panel-title">경기 종료 · 정산</p>
        <p className="user-sim-demo-result-main">
          {scoreHome} : {scoreAway}
        </p>
        <div id="demo-settle-detail" className={highlightClass(highlightId, "demo-settle-detail", pulseId)}>
          {state.winnerSettle && <p className="user-sim-demo-settle-line">승리팀 — {state.winnerSettle}</p>}
          {state.scoreSettle && <p className="user-sim-demo-settle-line">스코어 — {state.scoreSettle}</p>}
          {!state.winnerSettle && !state.scoreSettle && (
            <p className="user-sim-demo-panel-sub">최종 스코어 확인 중…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div key={sceneId} className="user-sim-demo-screen">
      {screen}
    </div>
  );
}

function DemoPreStartVisual() {
  return (
    <div className="user-sim-demo-screen user-sim-demo-screen--center">
      <p className="user-sim-demo-stage-kicker">게임 화면</p>
      <p className="user-sim-demo-stage-lead">
        화면·메뉴 안내
        <br />
        ↓
        <br />
        오늘의 경기 → 타석 예측
        <br />
        ↓
        <br />
        정산
      </p>
    </div>
  );
}

export default function SimulationDemoPlayer() {
  const [, setLocation] = useLocation();
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [sceneElapsed, setSceneElapsed] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5>(1);
  const tickRef = useRef<number | null>(null);

  const scene = DEMO_SCENES[sceneIndex] ?? DEMO_SCENES[DEMO_SCENES.length - 1]!;
  const visualState = scene.state;
  const totalElapsed = getElapsedBeforeScene(sceneIndex) + sceneElapsed;
  const progress = Math.min(100, (totalElapsed / DEMO_TOTAL_MS) * 100);

  const advanceScene = useCallback(() => {
    setSceneIndex((idx) => {
      if (idx >= DEMO_SCENES.length - 1) {
        setPlaying(false);
        return idx;
      }
      return idx + 1;
    });
    setSceneElapsed(0);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }

    tickRef.current = window.setInterval(() => {
      setSceneElapsed((ms) => {
        const step = 100 * speed;
        const next = ms + step;
        const duration = DEMO_SCENES[sceneIndex]?.durationMs ?? 0;
        if (next >= duration) {
          advanceScene();
          return 0;
        }
        return next;
      });
    }, 100);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [playing, sceneIndex, speed, advanceScene]);

  const handleStart = () => {
    setStarted(true);
    setPlaying(true);
    setSceneIndex(0);
    setSceneElapsed(0);
  };

  const handleRestart = () => {
    setSceneIndex(0);
    setSceneElapsed(0);
    setPlaying(true);
  };

  const handleSkip = () => {
    if (sceneIndex >= DEMO_SCENES.length - 1) {
      setPlaying(false);
      return;
    }
    advanceScene();
  };

  const handleSelectStep = (stepId: DemoStepId) => {
    const idx = getFirstSceneIndexForStep(stepId);
    setSceneIndex(idx);
    setSceneElapsed(0);
    setPlaying(true);
  };

  const openUserGuide = () => {
    sessionStorage.setItem(USER_GUIDE_OPEN_KEY, "1");
    setLocation("/home");
  };

  const activeStep = resolveNavStepId(scene.stepId);
  const showOutroActions = started && scene.stepId === "outro" && !playing;

  const outroActions = (
    <>
      <button
        type="button"
        className="user-sim-demo-outro-btn user-sim-demo-outro-btn--primary"
        onClick={() => setLocation("/prediction")}
      >
        예측 게임 하러가기
      </button>
      <button type="button" className="user-sim-demo-outro-btn" onClick={openUserGuide}>
        사용설명서
      </button>
      <button type="button" className="user-sim-demo-outro-btn" onClick={() => setLocation("/home")}>
        홈
      </button>
    </>
  );

  return (
    <div className="user-landscape-page user-sim-demo-page" data-testid="simulation-demo-page">
      <header className="user-sim-demo-header">
        <button
          type="button"
          onClick={() => setLocation("/home")}
          className="user-sim-demo-back"
          aria-label="홈으로"
          data-testid="button-sim-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="user-sim-demo-title">게임 시뮬레이션</h1>
        <span className="user-sim-demo-tag">자동 데모</span>
      </header>

      <div className="user-landscape-split user-sim-demo-split">
        <div className="user-landscape-left user-sim-demo-guide-wrap">
          <DemoGuidePanel
            activeStep={activeStep}
            state={visualState}
            caption={started ? scene.caption : "재생을 시작하면 자막이 표시됩니다."}
            started={started}
            onStart={handleStart}
            onSelectStep={handleSelectStep}
            showOutroActions={showOutroActions}
            outroActions={outroActions}
          />
        </div>
        <div className="user-landscape-right user-sim-demo-stage-wrap">
          <div className="user-sim-demo-stage">
            {started ? <DemoScreen state={visualState} sceneId={scene.id} /> : <DemoPreStartVisual />}
          </div>
        </div>
      </div>

      {started ? (
        <footer className="user-landscape-footer user-sim-demo-footer">
          <div className="user-sim-demo-controls">
            <button
              type="button"
              className="user-sim-demo-ctrl"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "일시정지" : "재생"}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <div className="user-sim-demo-progress-wrap">
              <div className="user-sim-demo-progress-track">
                <div className="user-sim-demo-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="user-sim-demo-time">
                {formatDemoTime(totalElapsed)} / {formatDemoTime(DEMO_TOTAL_MS)}
              </span>
            </div>
            <button type="button" className="user-sim-demo-ctrl" onClick={handleSkip} aria-label="다음 장면">
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="user-sim-demo-speed"
              onClick={() => setSpeed((s) => (s === 1 ? 1.5 : 1))}
            >
              {speed}x
            </button>
            <button type="button" className="user-sim-demo-ctrl-text" onClick={handleRestart}>
              처음
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

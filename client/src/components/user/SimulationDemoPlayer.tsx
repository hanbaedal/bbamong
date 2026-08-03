import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Pause, Play, SkipForward } from "lucide-react";
import {
  DEMO_SCENES,
  DEMO_STEPS,
  DEMO_TOTAL_MS,
  MATCH_ROWS,
  formatDemoTime,
  formatDemoDurationLabel,
  getElapsedBeforeScene,
  type DemoVisualState,
} from "@/lib/simulationDemoScript";
import { PREDICTION_ODDS as ODDS_MAP } from "@shared/predictionOdds";
import { USER_GUIDE_OPEN_KEY } from "@/pages/home/user-guide";

const AT_BAT_OPTIONS = Object.keys(ODDS_MAP);

function highlightClass(id: string | null, target: string, pulse?: string | null): string {
  if (id !== target) return "user-sim-demo-block";
  return pulse === target ? "user-sim-demo-block user-sim-demo-block--pulse" : "user-sim-demo-block user-sim-demo-block--hot";
}

function DemoStage({ state }: { state: DemoVisualState }) {
  const { view, highlightId, pulseId } = state;

  if (view === "intro") {
    return (
      <div className="user-sim-demo-stage-inner user-sim-demo-stage-inner--center">
        <p className="user-sim-demo-stage-kicker">자동 데모</p>
        <p className="user-sim-demo-stage-lead">
          오늘의 경기 → 경기 시작 → 타석 예측 → 정산
          <br />
          순서대로 재생됩니다
        </p>
      </div>
    );
  }

  if (view === "outro") {
    return (
      <div className="user-sim-demo-stage-inner user-sim-demo-stage-inner--center">
        <p className="user-sim-demo-stage-kicker">데모 종료</p>
        <p className="user-sim-demo-stage-lead">
          실제 경기는 「예측게임 하러가기」에서
          <br />
          참여할 수 있습니다
        </p>
        {state.finalScore && (
          <p className="user-sim-demo-outro-score">
            연습 최종 {state.finalScore.home} : {state.finalScore.away} · {state.practicePoints}P
          </p>
        )}
      </div>
    );
  }

  const scoreHome = state.finalScore?.home ?? 0;
  const scoreAway = state.finalScore?.away ?? 0;

  return (
    <div className="user-sim-demo-stage-inner">
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

      <div className="user-sim-demo-scoreboard">
        <div>
          <span className="user-sim-demo-score-label">홈팀</span>
          <span className="user-sim-demo-score-num">{scoreHome}</span>
        </div>
        <span className="user-sim-demo-score-colon">:</span>
        <div>
          <span className="user-sim-demo-score-label">원정팀</span>
          <span className="user-sim-demo-score-num">{scoreAway}</span>
        </div>
      </div>

      {(view === "side-matches" || view === "side-winner" || view === "side-score") && (
        <div className={highlightClass(highlightId, "demo-match-list", pulseId)}>
          <p className="user-sim-demo-panel-title">오늘의 경기</p>
          <ul className="user-sim-demo-match-list">
            {MATCH_ROWS.map((row) => (
              <li
                key={row.id}
                id={row.active ? "demo-match-m1" : undefined}
                className={`user-sim-demo-match-row ${row.active ? highlightClass(highlightId, "demo-match-m1", pulseId) : ""}`}
              >
                <div className="user-sim-demo-match-row-top">
                  <span>{row.title}</span>
                  <span className="user-sim-demo-match-stadium">{row.stadium}</span>
                </div>
                {row.active && state.winnerBet && (
                  <span className="user-sim-demo-match-bet">
                    우승팀: {state.winnerBet.side === "home" ? "홈팀" : "원정팀"} · {state.winnerBet.amount}P
                  </span>
                )}
                {row.active && state.scoreBet && (
                  <span className="user-sim-demo-match-bet">
                    스코어: {state.scoreBet.home}-{state.scoreBet.away} · {state.scoreBet.amount}P
                  </span>
                )}
                {row.active && view === "side-matches" && !state.sideLocked && (
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
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "side-winner" && (
        <div className={highlightClass(highlightId, "demo-pick-home", pulseId)}>
          <p className="user-sim-demo-panel-title">우승팀 맞추기 · 제 1경기</p>
          <p className="user-sim-demo-panel-sub">100P</p>
          <div className="user-sim-demo-pick-row">
            <span id="demo-pick-home" className="user-sim-demo-pick user-sim-demo-pick--on">
              홈팀
            </span>
            <span className="user-sim-demo-pick">원정팀</span>
          </div>
        </div>
      )}

      {view === "side-score" && (
        <div id="demo-score-input" className={highlightClass(highlightId, "demo-score-input", pulseId)}>
          <p className="user-sim-demo-panel-title">점수 맞추기 · 제 1경기</p>
          <p className="user-sim-demo-panel-sub">100P</p>
          <div className="user-sim-demo-score-form">
            <span className="user-sim-demo-score-box">3</span>
            <span className="user-sim-demo-score-colon">-</span>
            <span className="user-sim-demo-score-box">2</span>
          </div>
        </div>
      )}

      {view === "match-start" && (
        <div className="user-sim-demo-center-block">
          <p className="user-sim-demo-panel-title">제 1경기 · 잠실</p>
          <p className="user-sim-demo-panel-sub">사이드 배팅 접수 완료</p>
          <span id="demo-start-btn" className={`user-sim-demo-cta ${highlightClass(highlightId, "demo-start-btn", pulseId)}`}>
            경기 시작 (1회 · 사이드 마감)
          </span>
        </div>
      )}

      {view === "atbat" && (
        <div id="demo-atbat-wait" className={highlightClass(highlightId, "demo-atbat-wait", pulseId)}>
          <p className="user-sim-demo-panel-title">타석 예측 · 제 1경기</p>
          {state.atBatPhase === "pick" && (
            <>
              <p className="user-sim-demo-panel-sub">배팅 금액</p>
              <div id="demo-bet-amount" className={`user-sim-demo-chips ${highlightClass(highlightId, "demo-bet-amount", pulseId)}`}>
                {[50, 100, 200, 500, 1000].map((n) => (
                  <span
                    key={n}
                    className={`user-sim-demo-chip ${state.betAmount === n ? "user-sim-demo-chip--on" : ""}`}
                  >
                    {n}
                  </span>
                ))}
              </div>
              <p className="user-sim-demo-panel-sub">예측 선택</p>
              <div className="user-sim-demo-pick-grid">
                {AT_BAT_OPTIONS.map((opt) => (
                  <span
                    key={opt}
                    id={opt === "1루" ? "demo-pick-1루" : undefined}
                    className={`user-sim-demo-pick user-sim-demo-pick--odds ${
                      state.prediction === opt ? "user-sim-demo-pick--on" : ""
                    } ${opt === "1루" ? highlightClass(highlightId, "demo-pick-1루", pulseId) : ""}`}
                  >
                    <span>{opt}</span>
                    <span className="user-sim-demo-odds">{ODDS_MAP[opt as keyof typeof ODDS_MAP]}배</span>
                  </span>
                ))}
              </div>
            </>
          )}
          {state.atBatPhase === "wait" && (
            <div className="user-sim-demo-wait">
              <p>결과 대기…</p>
              <p className="user-sim-demo-panel-sub">
                {state.prediction} · {state.betAmount}P
              </p>
            </div>
          )}
          {state.atBatPhase === "result" && state.actualResult && (
            <div id="demo-atbat-result" className={highlightClass(highlightId, "demo-atbat-result", pulseId)}>
              <p className="user-sim-demo-result-main">{state.actualResult}</p>
              <p className={state.atBatHit ? "user-sim-demo-hit" : "user-sim-demo-miss"}>
                {state.atBatHit ? "적중!" : "미적중"}
              </p>
            </div>
          )}
        </div>
      )}

      {view === "settle" && (
        <div id="demo-settle" className={highlightClass(highlightId, "demo-settle", pulseId)}>
          <p className="user-sim-demo-panel-title">경기 종료 · 정산</p>
          <p className="user-sim-demo-result-main">
            {scoreHome} : {scoreAway}
          </p>
          <div id="demo-settle-detail" className={highlightClass(highlightId, "demo-settle-detail", pulseId)}>
            {state.winnerSettle && <p className="user-sim-demo-settle-line">승리팀 — {state.winnerSettle}</p>}
            {state.scoreSettle && <p className="user-sim-demo-settle-line">스코어 — {state.scoreSettle}</p>}
          </div>
        </div>
      )}
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

  const openUserGuide = () => {
    sessionStorage.setItem(USER_GUIDE_OPEN_KEY, "1");
    setLocation("/home");
  };

  const activeStep = scene.stepId === "outro" ? "settle" : scene.stepId;

  return (
    <div className="user-landscape-page user-sim-demo-page" data-testid="simulation-demo-page">
      <div className="user-sim-demo-shell">
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

        <nav className="user-sim-demo-steps" aria-label="데모 단계">
          {DEMO_STEPS.map((step) => (
            <span
              key={step.id}
              className={`user-sim-demo-step ${activeStep === step.id ? "user-sim-demo-step--active" : ""} ${
                DEMO_STEPS.findIndex((s) => s.id === step.id) <
                DEMO_STEPS.findIndex((s) => s.id === activeStep)
                  ? "user-sim-demo-step--done"
                  : ""
              }`}
            >
              {step.label}
            </span>
          ))}
        </nav>

        <div className="user-sim-demo-stage">
          {!started ? (
            <div className="user-sim-demo-stage-inner user-sim-demo-stage-inner--center">
              <p className="user-sim-demo-stage-kicker">{formatDemoDurationLabel(DEMO_TOTAL_MS)} · 자동 재생</p>
              <p className="user-sim-demo-stage-lead">
                예측 게임 흐름을
                <br />
                동영상처럼 보여 드립니다
              </p>
              <button type="button" className="user-sim-demo-start-btn" onClick={handleStart}>
                데모 시작
              </button>
            </div>
          ) : (
            <DemoStage state={visualState} />
          )}
        </div>

        <p className="user-sim-demo-caption" data-testid="sim-demo-caption">
          {started ? scene.caption : "재생을 시작하면 자막이 표시됩니다."}
        </p>

        {started && (
          <footer className="user-sim-demo-controls">
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
          </footer>
        )}

        {started && scene.stepId === "outro" && !playing && (
          <div className="user-sim-demo-outro-actions">
            <button
              type="button"
              className="user-sim-demo-outro-btn user-sim-demo-outro-btn--primary"
              onClick={() => setLocation("/prediction")}
            >
              예측 게임 하러가기
            </button>
            <button type="button" className="user-sim-demo-outro-btn" onClick={openUserGuide}>
              사용 설명서
            </button>
            <button type="button" className="user-sim-demo-outro-btn" onClick={() => setLocation("/home")}>
              홈
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

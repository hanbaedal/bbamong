import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Pause, Play, SkipForward } from "lucide-react";
import {
  MANAGER_RESULT_OPTIONS,
  MANAGER_SIM_SCENES,
  MANAGER_SIM_TOTAL_MS,
  formatManagerSimTime,
  getElapsedBeforeManagerScene,
  managerPhaseLabel,
  type ManagerSimHighlight,
  type ManagerSimVisualState,
} from "@/lib/managerSimulationScript";
import "./managerSimulation.css";

function btnClass(
  id: ManagerSimHighlight,
  base: string,
  state: ManagerSimVisualState,
  extra?: string,
): string {
  const hot = state.highlightId === id;
  const pulse = state.pulseId === id;
  return [
    "manager-sim-btn",
    base,
    extra ?? "",
    hot ? "manager-sim-btn--hot" : "",
    pulse ? "manager-sim-btn--pulse" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function ManagerSimStage({ state }: { state: ManagerSimVisualState }) {
  const canStart = state.phase === "idle" && !state.adPlaying;
  const canStop = state.phase === "predicting";
  const canResult = state.phase === "stopped";
  const canConfirm = state.phase === "stopped" && Boolean(state.selectedResult);
  const canNext = state.phase === "result_sent" || state.phase === "next_batter";
  const canSide = state.showThreeOuts || state.phase === "idle";
  const adActive = state.adPlaying;

  return (
    <div className="manager-sim-stage-inner" data-testid="manager-sim-stage">
      <p className="manager-sim-notice">연습 전용 · 실제 경기·유저에 반영되지 않음</p>

      <div className="manager-sim-score">
        <div className="manager-sim-score-row">
          <div>
            <p className="manager-sim-score-label">원정</p>
            <p className="manager-sim-score-num">{state.awayScore}</p>
          </div>
          <span className="manager-sim-score-label">:</span>
          <div>
            <p className="manager-sim-score-label">홈</p>
            <p className="manager-sim-score-num">{state.homeScore}</p>
          </div>
        </div>
        <div className="manager-sim-meta">
          <span>{state.inning}회</span>
          <span>R{state.round}</span>
        </div>
      </div>

      <p className="manager-sim-status">상태: {managerPhaseLabel(state.phase)}</p>

      {state.showThreeOuts ? (
        <p className="manager-sim-three-outs" data-testid="text-three-outs-hint">
          3아웃 — 공수교대를 눌러주세요
        </p>
      ) : null}

      <div className="manager-sim-controls-grid">
        <button
          type="button"
          disabled={!canStart && state.highlightId !== "start"}
          className={btnClass("start", "manager-sim-btn--start", state)}
          data-testid="button-sim-start"
        >
          ▶ 예측 시작
        </button>
        <button
          type="button"
          disabled={!canStop && state.highlightId !== "stop"}
          className={btnClass("stop", "manager-sim-btn--stop", state)}
          data-testid="button-sim-stop"
        >
          ■ 예측 중지
        </button>
      </div>

      <div className="manager-sim-results">
        {MANAGER_RESULT_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={!canResult && state.highlightId !== "result"}
            className={btnClass(
              "result",
              state.selectedResult === r
                ? "manager-sim-btn--result-selected"
                : "manager-sim-btn--result",
              state,
            )}
            data-testid={`button-sim-result-${r}`}
          >
            {r}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!canConfirm && state.highlightId !== "confirm"}
        className={btnClass("confirm", "manager-sim-btn--confirm", state)}
        data-testid="button-sim-result"
      >
        {state.selectedResult ? `「${state.selectedResult}」 결과 전송 확인` : "결과 전송 확인"}
      </button>

      <div className="manager-sim-controls-grid">
        <button
          type="button"
          disabled={!canNext && state.highlightId !== "next_batter"}
          className={btnClass("next_batter", "manager-sim-btn--bottom", state)}
          data-testid="button-sim-next-batter"
        >
          다음 타자
        </button>
        <button
          type="button"
          disabled={state.highlightId !== "pitcher"}
          className={btnClass("pitcher", "manager-sim-btn--pitcher", state)}
          data-testid="button-sim-pitcher"
        >
          투수 교체
        </button>
        <button
          type="button"
          disabled={!canSide && state.highlightId !== "side_change"}
          className={btnClass("side_change", "manager-sim-btn--side", state)}
          data-testid="button-sim-side-change"
        >
          공수 교대
        </button>
        <button
          type="button"
          disabled={!adActive && state.highlightId !== "ad_stop"}
          className={btnClass("ad_stop", "manager-sim-btn--ad", state)}
          data-testid="button-sim-ad-stop"
        >
          {adActive ? "광고 종료" : "광고 중지"}
        </button>
      </div>
    </div>
  );
}

export default function ManagerSimulationPage() {
  const [, setLocation] = useLocation();
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [sceneElapsed, setSceneElapsed] = useState(0);
  const tickRef = useRef<number | null>(null);

  const scene = MANAGER_SIM_SCENES[sceneIndex] ?? MANAGER_SIM_SCENES[0]!;
  const visualState = scene.state;

  const totalElapsed = useMemo(
    () => getElapsedBeforeManagerScene(sceneIndex) + sceneElapsed,
    [sceneIndex, sceneElapsed],
  );

  const progress = MANAGER_SIM_TOTAL_MS > 0 ? (totalElapsed / MANAGER_SIM_TOTAL_MS) * 100 : 0;
  const isOutro = scene.id === "outro";

  const advanceScene = useCallback(() => {
    setSceneIndex((idx) => {
      if (idx >= MANAGER_SIM_SCENES.length - 1) {
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
        const next = ms + 100;
        const duration = MANAGER_SIM_SCENES[sceneIndex]?.durationMs ?? 0;
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
  }, [playing, sceneIndex, advanceScene]);

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
    if (sceneIndex >= MANAGER_SIM_SCENES.length - 1) {
      setPlaying(false);
      return;
    }
    advanceScene();
  };

  return (
    <div className="manager-sim-page" data-testid="manager-simulation-page">
      <header className="manager-sim-header">
        <button
          type="button"
          onClick={() => setLocation("/manager/home")}
          className="manager-sim-back"
          aria-label="홈으로"
          data-testid="button-sim-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="manager-sim-title">운영자 시뮬레이션</h1>
        <span className="manager-sim-tag">자동 데모</span>
        <button
          type="button"
          onClick={() => setLocation("/manager/guide")}
          className="text-xs font-medium text-[#1A6DFF] min-h-[36px] px-2"
        >
          설명
        </button>
      </header>

      <div className="manager-sim-body">
        <div className="manager-sim-stage">
          {started ? (
            <ManagerSimStage state={visualState} />
          ) : (
            <div className="manager-sim-prestart">
              <p className="manager-sim-prestart-title">경기 운영 연습</p>
              <p className="manager-sim-prestart-desc">
                재생하면 예측 시작 → 중지 → 결과 → 공수교대까지
                <br />
                실제 경기 화면과 같은 순서로 자동 진행됩니다.
              </p>
              <button
                type="button"
                className="manager-sim-play-btn"
                onClick={handleStart}
                data-testid="button-sim-play"
              >
                재생 시작
              </button>
            </div>
          )}
        </div>

        <div className="manager-sim-caption-wrap">
          <p className="manager-sim-caption">
            {started ? scene.caption : "재생을 시작하면 자막이 표시됩니다."}
          </p>
          {started && isOutro && !playing ? (
            <div className="manager-sim-outro-actions">
              <button
                type="button"
                className="manager-sim-outro-btn manager-sim-outro-btn--primary"
                onClick={() => setLocation("/manager/home")}
              >
                오늘의 경기로
              </button>
              <button
                type="button"
                className="manager-sim-outro-btn"
                onClick={handleRestart}
              >
                다시 보기
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {started ? (
        <footer className="manager-sim-footer">
          <div className="manager-sim-controls">
            <button
              type="button"
              className="manager-sim-ctrl"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "일시정지" : "재생"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <div className="manager-sim-progress-wrap">
              <div className="manager-sim-progress-track">
                <div
                  className="manager-sim-progress-fill"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
              <span className="manager-sim-time">
                {formatManagerSimTime(totalElapsed)} / {formatManagerSimTime(MANAGER_SIM_TOTAL_MS)}
              </span>
            </div>
            <button
              type="button"
              className="manager-sim-ctrl"
              onClick={handleSkip}
              aria-label="다음 장면"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button type="button" className="manager-sim-ctrl-text" onClick={handleRestart}>
              처음
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

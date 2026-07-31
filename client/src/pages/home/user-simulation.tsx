import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import LandscapeSplitShell from "@/components/user/LandscapeSplitShell";
import BetAmountSelector from "@/components/BetAmountSelector";
import SideBetAmountSelector from "@/components/SideBetAmountSelector";
import {
  DEFAULT_BET_AMOUNT,
  DEFAULT_SIDE_BET_AMOUNT,
  PREDICTION_ODDS,
  WINNER_ODDS,
  EXACT_SCORE_ODDS,
  calculateFixedOddsPayout,
  calculateSideBetPayout,
  type BetAmountOption,
  type PredictionResult,
  type SideBetAmountOption,
  type WinnerSide,
} from "@shared/predictionOdds";
import { useToast } from "@/hooks/use-toast";
import "@/styles/user-landscape.css";

type AtBatPhase = "pick" | "waiting" | "result";
type MatchStatus = "pregame" | "live" | "ended";
type SimTab = "atBat" | "side";

const AT_BAT_OPTIONS = Object.keys(PREDICTION_ODDS) as PredictionResult[];

interface WinnerBet {
  pick: WinnerSide;
  amount: SideBetAmountOption;
}

interface ScoreBet {
  home: number;
  away: number;
  amount: SideBetAmountOption;
}

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  pregame: "경기 전 (사이드 배팅 가능)",
  live: "경기 진행 중 (1회 시작 — 사이드 마감)",
  ended: "경기 종료",
};

function randomFinalScore(): { home: number; away: number } {
  return {
    home: Math.floor(Math.random() * 11),
    away: Math.floor(Math.random() * 11),
  };
}

export default function UserSimulationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tab, setTab] = useState<SimTab>("side");
  const [matchStatus, setMatchStatus] = useState<MatchStatus>("pregame");
  const [finalScore, setFinalScore] = useState<{ home: number; away: number } | null>(null);

  const [practicePoints, setPracticePoints] = useState(3000);
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<string[]>([
    "연습 모드 — 실제 포인트와 무관합니다.",
    "「승리팀·스코어」 배팅 후 「경기 시작」→ 「타석」 연습 → 「경기 종료」로 정산해 보세요.",
  ]);

  const [amount, setAmount] = useState<BetAmountOption>(DEFAULT_BET_AMOUNT);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [atBatPhase, setAtBatPhase] = useState<AtBatPhase>("pick");
  const [actualResult, setActualResult] = useState<PredictionResult | null>(null);
  const [lastPayout, setLastPayout] = useState(0);

  const [winnerAmount, setWinnerAmount] = useState<SideBetAmountOption>(DEFAULT_SIDE_BET_AMOUNT);
  const [winnerPick, setWinnerPick] = useState<WinnerSide | null>(null);
  const [winnerBet, setWinnerBet] = useState<WinnerBet | null>(null);
  const [winnerSettleMsg, setWinnerSettleMsg] = useState<string | null>(null);

  const [scoreAmount, setScoreAmount] = useState<SideBetAmountOption>(DEFAULT_SIDE_BET_AMOUNT);
  const [homeScoreInput, setHomeScoreInput] = useState("");
  const [awayScoreInput, setAwayScoreInput] = useState("");
  const [scoreBet, setScoreBet] = useState<ScoreBet | null>(null);
  const [scoreSettleMsg, setScoreSettleMsg] = useState<string | null>(null);

  const sideBetsLocked = matchStatus !== "pregame";
  const atBatLocked = matchStatus !== "live" || atBatPhase !== "pick";

  const expectedPayout = useMemo(() => {
    if (!prediction) return 0;
    return calculateFixedOddsPayout(amount, prediction);
  }, [amount, prediction]);

  const displayHomeScore = finalScore?.home ?? 0;
  const displayAwayScore = finalScore?.away ?? 0;

  const pushLog = (msg: string) => {
    setLog((prev) => [msg, ...prev].slice(0, 12));
  };

  const handleSubmitWinner = () => {
    if (sideBetsLocked) return;
    if (!winnerPick) {
      toast({ variant: "destructive", description: "승리팀을 선택해주세요." });
      return;
    }
    if (practicePoints < winnerAmount) {
      toast({ variant: "destructive", description: "연습 포인트가 부족합니다." });
      return;
    }
    setPracticePoints((p) => p - winnerAmount);
    setWinnerBet({ pick: winnerPick, amount: winnerAmount });
    setWinnerSettleMsg(null);
    pushLog(`승리팀 배팅: ${winnerPick === "home" ? "홈팀" : "원정팀"} · ${winnerAmount}P`);
    toast({ description: "연습: 승리팀 배팅 접수" });
  };

  const handleSubmitScore = () => {
    if (sideBetsLocked) return;
    const home = parseInt(homeScoreInput, 10);
    const away = parseInt(awayScoreInput, 10);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || home > 99 || away < 0 || away > 99) {
      toast({ variant: "destructive", description: "홈·원정 점수를 입력해주세요." });
      return;
    }
    if (practicePoints < scoreAmount) {
      toast({ variant: "destructive", description: "연습 포인트가 부족합니다." });
      return;
    }
    setPracticePoints((p) => p - scoreAmount);
    setScoreBet({ home, away, amount: scoreAmount });
    setScoreSettleMsg(null);
    pushLog(`스코어 배팅: ${home}-${away} · ${scoreAmount}P`);
    toast({ description: "연습: 최종 스코어 배팅 접수" });
  };

  const handleStartMatch = () => {
    if (matchStatus !== "pregame") return;
    setMatchStatus("live");
    setFinalScore(null);
    setWinnerSettleMsg(null);
    setScoreSettleMsg(null);
    pushLog("경기 시작 — 승리팀·스코어 배팅 마감 (1회 시작)");
    toast({ description: "연습: 1회 시작 — 사이드 배팅 마감" });
    setTab("atBat");
  };

  const settleSideBets = (home: number, away: number) => {
    if (home === away) {
      if (winnerBet) {
        setPracticePoints((p) => p + winnerBet.amount);
        setWinnerSettleMsg(`무승부 — ${winnerBet.amount}P 환불`);
        pushLog(`승리팀: 무승부 환불 +${winnerBet.amount}P`);
      }
      if (scoreBet) {
        setPracticePoints((p) => p + scoreBet.amount);
        setScoreSettleMsg(`무승부 — ${scoreBet.amount}P 환불`);
        pushLog(`스코어: 무승부 환불 +${scoreBet.amount}P`);
      }
      return;
    }

    const winningSide: WinnerSide = home > away ? "home" : "away";

    if (winnerBet) {
      if (winnerBet.pick === winningSide) {
        const payout = calculateSideBetPayout(winnerBet.amount, "winner");
        setPracticePoints((p) => p + payout);
        setWinnerSettleMsg(`적중! +${payout}P (${WINNER_ODDS}배)`);
        pushLog(`승리팀 적중 +${payout}P`);
      } else {
        setWinnerSettleMsg(`미적중 (결과: ${winningSide === "home" ? "홈팀" : "원정팀"})`);
        pushLog("승리팀 미적중");
      }
    }

    if (scoreBet) {
      if (scoreBet.home === home && scoreBet.away === away) {
        const payout = calculateSideBetPayout(scoreBet.amount, "score");
        setPracticePoints((p) => p + payout);
        setScoreSettleMsg(`적중! +${payout}P (${EXACT_SCORE_ODDS}배)`);
        pushLog(`스코어 적중 +${payout}P`);
      } else {
        setScoreSettleMsg(`미적중 (최종 ${home}:${away})`);
        pushLog(`스코어 미적중 (최종 ${home}:${away})`);
      }
    }
  };

  const handleEndMatch = () => {
    if (matchStatus !== "live") return;
    const score = randomFinalScore();
    setFinalScore(score);
    setMatchStatus("ended");
    settleSideBets(score.home, score.away);
    pushLog(`경기 종료 — 최종 ${score.home}:${score.away}`);
    toast({ description: "연습: 경기 종료 · 사이드 배팅 정산" });
    setTab("side");
  };

  const handleSubmitAtBat = () => {
    if (matchStatus !== "live" || atBatPhase !== "pick") return;
    if (!prediction) {
      toast({ variant: "destructive", description: "예측을 선택해주세요." });
      return;
    }
    if (practicePoints < amount) {
      toast({ variant: "destructive", description: "연습 포인트가 부족합니다." });
      return;
    }
    setPracticePoints((p) => p - amount);
    setAtBatPhase("waiting");
    pushLog(`R${round} 타석: ${prediction} · ${amount}P`);
    toast({ description: "연습: 타석 예측 접수" });
  };

  const handleRevealAtBat = () => {
    if (atBatPhase !== "waiting" || !prediction) return;
    const result = AT_BAT_OPTIONS[Math.floor(Math.random() * AT_BAT_OPTIONS.length)];
    setActualResult(result);
    const hit = result === prediction;
    const payout = hit ? calculateFixedOddsPayout(amount, result) : 0;
    setLastPayout(payout);
    if (hit) {
      setPracticePoints((p) => p + payout);
      pushLog(`R${round} 결과 ${result} — 적중 +${payout}P`);
    } else {
      pushLog(`R${round} 결과 ${result} — 미적중`);
    }
    setAtBatPhase("result");
  };

  const handleNextAtBatRound = () => {
    if (matchStatus !== "live") return;
    setRound((r) => r + 1);
    setPrediction(null);
    setActualResult(null);
    setLastPayout(0);
    setAtBatPhase("pick");
  };

  const resetMatchState = () => {
    setMatchStatus("pregame");
    setFinalScore(null);
    setWinnerBet(null);
    setScoreBet(null);
    setWinnerPick(null);
    setWinnerSettleMsg(null);
    setScoreSettleMsg(null);
    setHomeScoreInput("");
    setAwayScoreInput("");
    setPrediction(null);
    setActualResult(null);
    setAtBatPhase("pick");
    setLastPayout(0);
    setRound(1);
    setTab("side");
  };

  const handleNewMatch = () => {
    resetMatchState();
    pushLog("새 경기 — 사이드 배팅 다시 가능");
  };

  const handleResetAll = () => {
    setPracticePoints(3000);
    setAmount(DEFAULT_BET_AMOUNT);
    setWinnerAmount(DEFAULT_SIDE_BET_AMOUNT);
    setScoreAmount(DEFAULT_SIDE_BET_AMOUNT);
    resetMatchState();
    setLog(["연습 초기화 — 포인트 3000P"]);
  };

  const leftPanel = (
    <div className="user-sim-left">
      <div className="user-sim-topbar">
        <button
          type="button"
          onClick={() => setLocation("/home")}
          className="user-sim-back"
          data-testid="button-sim-back"
          aria-label="홈으로"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="user-sim-title">게임 시뮬레이션</h1>
      </div>

      <p className="user-sim-notice">연습 전용 · 서버·실제 포인트와 무관</p>

      <div className="user-sim-scoreboard">
        <div className="user-sim-scoreboard-team">
          <span className="user-sim-scoreboard-label">홈팀</span>
          <span className="user-sim-scoreboard-num">{displayHomeScore}</span>
        </div>
        <span className="user-sim-scoreboard-colon">:</span>
        <div className="user-sim-scoreboard-team">
          <span className="user-sim-scoreboard-label">원정팀</span>
          <span className="user-sim-scoreboard-num">{displayAwayScore}</span>
        </div>
      </div>

      <p className="user-sim-status">{MATCH_STATUS_LABEL[matchStatus]}</p>

      <div className="user-sim-stats">
        <div>
          <span className="user-sim-stat-label">연습 포인트</span>
          <span className="user-sim-stat-value user-sim-stat-value--points">{practicePoints}P</span>
        </div>
        <div>
          <span className="user-sim-stat-label">타석 라운드</span>
          <span className="user-sim-stat-value">{round}</span>
        </div>
      </div>

      {atBatPhase === "result" && actualResult && matchStatus === "live" && (
        <div className="user-sim-highlight">
          <p className="user-sim-highlight-label">타석 결과</p>
          <p className="user-sim-highlight-main">{actualResult}</p>
          <p className={prediction === actualResult ? "user-sim-hit" : "user-sim-miss"}>
            {prediction === actualResult ? `적중 +${lastPayout}P` : `미적중 (선택: ${prediction})`}
          </p>
        </div>
      )}

      {matchStatus === "ended" && finalScore && (
        <div className="user-sim-highlight">
          <p className="user-sim-highlight-label">최종 스코어</p>
          <p className="user-sim-highlight-main">
            {finalScore.home} : {finalScore.away}
          </p>
          {winnerSettleMsg && <p className="user-sim-settle">승리팀 — {winnerSettleMsg}</p>}
          {scoreSettleMsg && <p className="user-sim-settle">스코어 — {scoreSettleMsg}</p>}
        </div>
      )}

      <div className="user-sim-match-actions">
        {matchStatus === "pregame" && (
          <button type="button" className="user-sim-btn user-sim-btn--primary" onClick={handleStartMatch}>
            경기 시작 (1회 · 사이드 마감)
          </button>
        )}
        {matchStatus === "live" && (
          <button type="button" className="user-sim-btn user-sim-btn--outline" onClick={handleEndMatch}>
            경기 종료 · 정산
          </button>
        )}
        {matchStatus === "ended" && (
          <button type="button" className="user-sim-btn user-sim-btn--primary" onClick={handleNewMatch}>
            새 경기
          </button>
        )}
      </div>

      <div className="user-sim-log">
        <h3 className="user-sim-log-title">연습 로그</h3>
        <ul className="user-sim-log-list">
          {log.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>

      <button type="button" className="user-sim-link" onClick={() => setLocation("/home/guide")}>
        사용 설명서
      </button>
    </div>
  );

  const rightPanel = (
    <div className="user-sim-right">
      <div className="user-sim-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "side"}
          className={`user-sim-tab ${tab === "side" ? "user-sim-tab--active" : ""}`}
          onClick={() => setTab("side")}
        >
          승리팀 · 스코어
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "atBat"}
          className={`user-sim-tab ${tab === "atBat" ? "user-sim-tab--active" : ""}`}
          onClick={() => setTab("atBat")}
        >
          타석 예측
        </button>
      </div>

      <div className="user-sim-panel">
        {tab === "side" && (
          <div className="user-sim-panel-scroll">
            <h2 className="user-sim-section-title">승리팀 · 최종 스코어</h2>
            <p className="user-sim-section-desc">
              1회 시작 시 자동 마감 · 경기 종료 후 정산 · 100P 단위
            </p>
            {sideBetsLocked && matchStatus === "live" && (
              <p className="user-sim-locked">1회 시작으로 배팅이 마감되었습니다.</p>
            )}

            <div className="user-sim-card">
              <h3 className="user-sim-card-title">승리팀 맞추기 ({WINNER_ODDS}배)</h3>
              {winnerBet && (
                <p className="user-sim-my-bet">
                  내 선택: {winnerBet.pick === "home" ? "홈팀" : "원정팀"} · {winnerBet.amount}P
                </p>
              )}
              {!winnerBet && (
                <>
                  <SideBetAmountSelector
                    value={winnerAmount}
                    onChange={setWinnerAmount}
                    betType="winner"
                    disabled={sideBetsLocked}
                  />
                  <div className="user-sim-pick-grid user-sim-pick-grid--2">
                    {(["home", "away"] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        disabled={sideBetsLocked}
                        onClick={() => setWinnerPick(side)}
                        className={`user-sim-pick ${winnerPick === side ? "user-sim-pick--active" : ""}`}
                      >
                        {side === "home" ? "홈팀" : "원정팀"}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={sideBetsLocked || !winnerPick}
                    onClick={handleSubmitWinner}
                    className="user-sim-btn user-sim-btn--primary user-sim-btn--full"
                    data-testid="button-sim-winner"
                  >
                    승리팀 배팅
                  </button>
                </>
              )}
              {winnerSettleMsg && <p className="user-sim-settle-inline">{winnerSettleMsg}</p>}
            </div>

            <div className="user-sim-card">
              <h3 className="user-sim-card-title">최종 스코어 맞추기 ({EXACT_SCORE_ODDS}배)</h3>
              {scoreBet && (
                <p className="user-sim-my-bet">
                  내 선택: {scoreBet.home}-{scoreBet.away} · {scoreBet.amount}P
                </p>
              )}
              {!scoreBet && (
                <>
                  <SideBetAmountSelector
                    value={scoreAmount}
                    onChange={setScoreAmount}
                    betType="score"
                    disabled={sideBetsLocked}
                  />
                  <div className="user-sim-score-inputs">
                    <label className="user-sim-score-field">
                      <span>홈</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={homeScoreInput}
                        disabled={sideBetsLocked}
                        onChange={(e) => setHomeScoreInput(e.target.value)}
                        className="user-sim-score-box"
                      />
                    </label>
                    <span className="user-sim-score-dash">-</span>
                    <label className="user-sim-score-field">
                      <span>원정</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={awayScoreInput}
                        disabled={sideBetsLocked}
                        onChange={(e) => setAwayScoreInput(e.target.value)}
                        className="user-sim-score-box"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={sideBetsLocked}
                    onClick={handleSubmitScore}
                    className="user-sim-btn user-sim-btn--primary user-sim-btn--full"
                    data-testid="button-sim-score"
                  >
                    최종 스코어 배팅
                  </button>
                </>
              )}
              {scoreSettleMsg && <p className="user-sim-settle-inline">{scoreSettleMsg}</p>}
            </div>
          </div>
        )}

        {tab === "atBat" && (
          <div className="user-sim-panel-scroll">
            <h2 className="user-sim-section-title">예측 게임 (타석)</h2>
            {matchStatus === "pregame" && (
              <p className="user-sim-section-desc">「경기 시작」 후 타석 예측을 연습할 수 있습니다.</p>
            )}
            {matchStatus === "ended" && (
              <p className="user-sim-section-desc">「새 경기」를 시작하면 타석 연습을 이어갈 수 있습니다.</p>
            )}

            {matchStatus === "live" && atBatPhase === "pick" && (
              <>
                <div className="user-sim-compact-bet">
                  <BetAmountSelector
                    value={amount}
                    onChange={setAmount}
                    selectedPrediction={prediction}
                  />
                </div>
                <p className="user-sim-section-desc">예측 선택</p>
                <div className="user-sim-pick-grid user-sim-pick-grid--2">
                  {AT_BAT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPrediction(opt)}
                      className={`user-sim-pick user-sim-pick--odds ${prediction === opt ? "user-sim-pick--active" : ""}`}
                    >
                      <span>{opt}</span>
                      <span className="user-sim-odds">{PREDICTION_ODDS[opt]}배</span>
                    </button>
                  ))}
                </div>
                {prediction && (
                  <p className="user-sim-expected">적중 시 예상: {expectedPayout}P</p>
                )}
                <button
                  type="button"
                  onClick={handleSubmitAtBat}
                  disabled={atBatLocked}
                  className="user-sim-btn user-sim-btn--primary user-sim-btn--full"
                  data-testid="button-sim-submit"
                >
                  연습 배팅하기
                </button>
              </>
            )}

            {matchStatus === "live" && atBatPhase === "waiting" && (
              <div className="user-sim-card user-sim-card--center">
                <p className="user-sim-wait-title">결과 대기 (연습)</p>
                <p className="user-sim-wait-sub">
                  {prediction} · {amount}P
                </p>
                <button
                  type="button"
                  onClick={handleRevealAtBat}
                  className="user-sim-btn user-sim-btn--primary user-sim-btn--full"
                  data-testid="button-sim-reveal"
                >
                  결과 발표 (랜덤)
                </button>
              </div>
            )}

            {matchStatus === "live" && atBatPhase === "result" && (
              <div className="user-sim-card user-sim-card--center">
                <button
                  type="button"
                  onClick={handleNextAtBatRound}
                  className="user-sim-btn user-sim-btn--primary user-sim-btn--full"
                >
                  다음 타석 라운드
                </button>
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={handleResetAll} className="user-sim-reset">
          전체 초기화
        </button>
      </div>
    </div>
  );

  return (
    <LandscapeSplitShell testId="simulation-page" left={leftPanel} right={rightPanel} />
  );
}

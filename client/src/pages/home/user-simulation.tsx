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
type SideBetActionType = "winner" | "score";

interface SimMatch {
  id: string;
  name: string;
  stadiumName: string;
  status: MatchStatus;
  sideBetsLocked: boolean;
  finalScore: { home: number; away: number } | null;
}

interface WinnerBet {
  pick: WinnerSide;
  amount: SideBetAmountOption;
}

interface ScoreBet {
  home: number;
  away: number;
  amount: SideBetAmountOption;
}

interface MatchSideBets {
  winnerBet: WinnerBet | null;
  scoreBet: ScoreBet | null;
  winnerSettleMsg: string | null;
  scoreSettleMsg: string | null;
}

interface SideBetAction {
  matchId: string;
  matchTitle: string;
  betType: SideBetActionType;
}

const AT_BAT_OPTIONS = Object.keys(PREDICTION_ODDS) as PredictionResult[];

const INITIAL_MATCHES: SimMatch[] = [
  { id: "m1", name: "1경기", stadiumName: "잠실", status: "pregame", sideBetsLocked: false, finalScore: null },
  { id: "m2", name: "2경기", stadiumName: "고척", status: "pregame", sideBetsLocked: false, finalScore: null },
  { id: "m3", name: "3경기", stadiumName: "수원", status: "pregame", sideBetsLocked: false, finalScore: null },
  { id: "m4", name: "4경기", stadiumName: "대구", status: "pregame", sideBetsLocked: false, finalScore: null },
  { id: "m5", name: "5경기", stadiumName: "광주", status: "pregame", sideBetsLocked: false, finalScore: null },
];

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  pregame: "경기 전 (사이드 배팅 가능)",
  live: "경기 진행 중 (1회 시작 — 사이드 마감)",
  ended: "경기 종료",
};

function formatSimMatchTitle(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith("제 ") ? trimmed : `제 ${trimmed}`;
}

function emptySideBets(): MatchSideBets {
  return { winnerBet: null, scoreBet: null, winnerSettleMsg: null, scoreSettleMsg: null };
}

function isSideBetButtonEnabled(match: SimMatch): boolean {
  if (match.sideBetsLocked) return false;
  if (match.status === "ended") return false;
  return true;
}

function sideBetDisabledHint(match: SimMatch): string | null {
  if (match.status === "ended") return null;
  if (match.sideBetsLocked) return "마감";
  return null;
}

function randomFinalScore(): { home: number; away: number } {
  return {
    home: Math.floor(Math.random() * 11),
    away: Math.floor(Math.random() * 11),
  };
}

function createInitialBetsMap(): Record<string, MatchSideBets> {
  return Object.fromEntries(INITIAL_MATCHES.map((m) => [m.id, emptySideBets()]));
}

export default function UserSimulationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tab, setTab] = useState<SimTab>("side");
  const [matches, setMatches] = useState<SimMatch[]>(INITIAL_MATCHES);
  const [activeMatchId, setActiveMatchId] = useState("m1");
  const [betsByMatch, setBetsByMatch] = useState<Record<string, MatchSideBets>>(createInitialBetsMap);
  const [sideBetAction, setSideBetAction] = useState<SideBetAction | null>(null);

  const [practicePoints, setPracticePoints] = useState(3000);
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<string[]>([
    "연습 모드 — 실제 포인트와 무관합니다.",
    "「오늘의 경기」에서 배팅 → 「경기 시작」→ 타석 → 「경기 종료」로 정산 흐름을 연습해 보세요.",
  ]);

  const [amount, setAmount] = useState<BetAmountOption>(DEFAULT_BET_AMOUNT);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [atBatPhase, setAtBatPhase] = useState<AtBatPhase>("pick");
  const [actualResult, setActualResult] = useState<PredictionResult | null>(null);
  const [lastPayout, setLastPayout] = useState(0);

  const [winnerAmount, setWinnerAmount] = useState<SideBetAmountOption>(DEFAULT_SIDE_BET_AMOUNT);
  const [winnerPick, setWinnerPick] = useState<WinnerSide | null>(null);
  const [scoreAmount, setScoreAmount] = useState<SideBetAmountOption>(DEFAULT_SIDE_BET_AMOUNT);
  const [homeScoreInput, setHomeScoreInput] = useState("");
  const [awayScoreInput, setAwayScoreInput] = useState("");

  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? matches[0]!;
  const activeBets = betsByMatch[activeMatchId] ?? emptySideBets();

  const atBatLocked = activeMatch.status !== "live" || atBatPhase !== "pick";

  const expectedPayout = useMemo(() => {
    if (!prediction) return 0;
    return calculateFixedOddsPayout(amount, prediction);
  }, [amount, prediction]);

  const displayHomeScore = activeMatch.finalScore?.home ?? 0;
  const displayAwayScore = activeMatch.finalScore?.away ?? 0;

  const pushLog = (msg: string) => {
    setLog((prev) => [msg, ...prev].slice(0, 14));
  };

  const updateMatch = (matchId: string, patch: Partial<SimMatch>) => {
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...patch } : m)));
  };

  const updateBets = (matchId: string, patch: Partial<MatchSideBets>) => {
    setBetsByMatch((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] ?? emptySideBets()), ...patch },
    }));
  };

  const openSideBetAction = (match: SimMatch, betType: SideBetActionType) => {
    if (!isSideBetButtonEnabled(match)) return;
    setWinnerPick(null);
    setHomeScoreInput("");
    setAwayScoreInput("");
    setWinnerAmount(DEFAULT_SIDE_BET_AMOUNT);
    setScoreAmount(DEFAULT_SIDE_BET_AMOUNT);
    setSideBetAction({
      matchId: match.id,
      matchTitle: formatSimMatchTitle(match.name),
      betType,
    });
  };

  const handleSubmitWinner = () => {
    if (!sideBetAction) return;
    const match = matches.find((m) => m.id === sideBetAction.matchId);
    if (!match || !isSideBetButtonEnabled(match)) return;
    if (!winnerPick) {
      toast({ variant: "destructive", description: "승리팀을 선택해주세요." });
      return;
    }
    if (practicePoints < winnerAmount) {
      toast({ variant: "destructive", description: "연습 포인트가 부족합니다." });
      return;
    }
    setPracticePoints((p) => p - winnerAmount);
    updateBets(sideBetAction.matchId, { winnerBet: { pick: winnerPick, amount: winnerAmount } });
    pushLog(`${sideBetAction.matchTitle} 승리팀: ${winnerPick === "home" ? "홈팀" : "원정팀"} · ${winnerAmount}P`);
    toast({ description: "연습: 승리팀 배팅 접수" });
    setSideBetAction(null);
  };

  const handleSubmitScore = () => {
    if (!sideBetAction) return;
    const match = matches.find((m) => m.id === sideBetAction.matchId);
    if (!match || !isSideBetButtonEnabled(match)) return;
    const home = parseInt(homeScoreInput, 10);
    const away = parseInt(awayScoreInput, 10);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || home > 30 || away < 0 || away > 30) {
      toast({ variant: "destructive", description: "홈·원정 점수를 입력해주세요." });
      return;
    }
    if (practicePoints < scoreAmount) {
      toast({ variant: "destructive", description: "연습 포인트가 부족합니다." });
      return;
    }
    setPracticePoints((p) => p - scoreAmount);
    updateBets(sideBetAction.matchId, { scoreBet: { home, away, amount: scoreAmount } });
    pushLog(`${sideBetAction.matchTitle} 스코어: ${home}-${away} · ${scoreAmount}P`);
    toast({ description: "연습: 최종 스코어 배팅 접수" });
    setSideBetAction(null);
  };

  const settleSideBets = (matchId: string, home: number, away: number) => {
    const bets = betsByMatch[matchId] ?? emptySideBets();
    let winnerSettleMsg: string | null = null;
    let scoreSettleMsg: string | null = null;

    if (home === away) {
      if (bets.winnerBet) {
        setPracticePoints((p) => p + bets.winnerBet!.amount);
        winnerSettleMsg = `무승부 — ${bets.winnerBet.amount}P 환불`;
        pushLog(`${matchId} 승리팀: 무승부 환불 +${bets.winnerBet.amount}P`);
      }
      if (bets.scoreBet) {
        setPracticePoints((p) => p + bets.scoreBet!.amount);
        scoreSettleMsg = `무승부 — ${bets.scoreBet.amount}P 환불`;
        pushLog(`${matchId} 스코어: 무승부 환불 +${bets.scoreBet.amount}P`);
      }
      updateBets(matchId, { winnerSettleMsg, scoreSettleMsg });
      return;
    }

    const winningSide: WinnerSide = home > away ? "home" : "away";

    if (bets.winnerBet) {
      if (bets.winnerBet.pick === winningSide) {
        const payout = calculateSideBetPayout(bets.winnerBet.amount, "winner");
        setPracticePoints((p) => p + payout);
        winnerSettleMsg = `적중! +${payout}P (${WINNER_ODDS}배)`;
        pushLog(`${matchId} 승리팀 적중 +${payout}P`);
      } else {
        winnerSettleMsg = `미적중 (결과: ${winningSide === "home" ? "홈팀" : "원정팀"})`;
        pushLog(`${matchId} 승리팀 미적중`);
      }
    }

    if (bets.scoreBet) {
      if (bets.scoreBet.home === home && bets.scoreBet.away === away) {
        const payout = calculateSideBetPayout(bets.scoreBet.amount, "score");
        setPracticePoints((p) => p + payout);
        scoreSettleMsg = `적중! +${payout}P (${EXACT_SCORE_ODDS}배)`;
        pushLog(`${matchId} 스코어 적중 +${payout}P`);
      } else {
        scoreSettleMsg = `미적중 (최종 ${home}:${away})`;
        pushLog(`${matchId} 스코어 미적중 (최종 ${home}:${away})`);
      }
    }

    updateBets(matchId, { winnerSettleMsg, scoreSettleMsg });
  };

  const handleStartMatch = () => {
    if (activeMatch.status !== "pregame") {
      toast({ variant: "destructive", description: "경기 전 상태에서만 시작할 수 있습니다." });
      return;
    }
    updateMatch(activeMatchId, { status: "live", sideBetsLocked: true });
    setSideBetAction(null);
    pushLog(`${formatSimMatchTitle(activeMatch.name)} 시작 — 사이드 배팅 마감 (1회)`);
    toast({ description: "연습: 1회 시작 — 사이드 배팅 마감" });
    setTab("atBat");
  };

  const handleEndMatch = () => {
    if (activeMatch.status !== "live") return;
    const score = randomFinalScore();
    updateMatch(activeMatchId, { status: "ended", finalScore: score });
    settleSideBets(activeMatchId, score.home, score.away);
    pushLog(`${formatSimMatchTitle(activeMatch.name)} 종료 — 최종 ${score.home}:${score.away}`);
    toast({ description: "연습: 경기 종료 · 사이드 배팅 정산" });
    setTab("side");
  };

  const handleSubmitAtBat = () => {
    if (activeMatch.status !== "live" || atBatPhase !== "pick") return;
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
    pushLog(`R${round} 타석(${formatSimMatchTitle(activeMatch.name)}): ${prediction} · ${amount}P`);
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
    if (activeMatch.status !== "live") return;
    setRound((r) => r + 1);
    setPrediction(null);
    setActualResult(null);
    setLastPayout(0);
    setAtBatPhase("pick");
  };

  const resetAtBatState = () => {
    setPrediction(null);
    setActualResult(null);
    setAtBatPhase("pick");
    setLastPayout(0);
    setRound(1);
  };

  const handleNewMatch = () => {
    updateMatch(activeMatchId, {
      status: "pregame",
      sideBetsLocked: false,
      finalScore: null,
    });
    updateBets(activeMatchId, emptySideBets());
    resetAtBatState();
    setSideBetAction(null);
    setTab("side");
    pushLog(`${formatSimMatchTitle(activeMatch.name)} 새 경기 — 사이드 배팅 다시 가능`);
  };

  const handleResetAll = () => {
    setPracticePoints(3000);
    setAmount(DEFAULT_BET_AMOUNT);
    setMatches(INITIAL_MATCHES.map((m) => ({ ...m })));
    setActiveMatchId("m1");
    setBetsByMatch(createInitialBetsMap());
    setSideBetAction(null);
    resetAtBatState();
    setTab("side");
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

      <p className="user-sim-active-match">
        타석 연습 경기: <strong>{formatSimMatchTitle(activeMatch.name)}</strong>
      </p>

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

      <p className="user-sim-status">{MATCH_STATUS_LABEL[activeMatch.status]}</p>

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

      <div className="user-sim-atbat-pick">
        <p className="user-sim-atbat-pick-title">타석 연습 경기</p>
        <div className="user-sim-atbat-pick-row">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`user-sim-atbat-pick-btn ${activeMatchId === m.id ? "user-sim-atbat-pick-btn--active" : ""}`}
              onClick={() => setActiveMatchId(m.id)}
            >
              {formatSimMatchTitle(m.name)}
            </button>
          ))}
        </div>
      </div>

      {atBatPhase === "result" && actualResult && activeMatch.status === "live" && (
        <div className="user-sim-highlight">
          <p className="user-sim-highlight-label">타석 결과</p>
          <p className="user-sim-highlight-main">{actualResult}</p>
          <p className={prediction === actualResult ? "user-sim-hit" : "user-sim-miss"}>
            {prediction === actualResult ? `적중 +${lastPayout}P` : `미적중 (선택: ${prediction})`}
          </p>
        </div>
      )}

      {activeMatch.status === "ended" && activeMatch.finalScore && (
        <div className="user-sim-highlight">
          <p className="user-sim-highlight-label">최종 스코어</p>
          <p className="user-sim-highlight-main">
            {activeMatch.finalScore.home} : {activeMatch.finalScore.away}
          </p>
          {activeBets.winnerSettleMsg && (
            <p className="user-sim-settle">승리팀 — {activeBets.winnerSettleMsg}</p>
          )}
          {activeBets.scoreSettleMsg && (
            <p className="user-sim-settle">스코어 — {activeBets.scoreSettleMsg}</p>
          )}
        </div>
      )}

      <div className="user-sim-match-actions">
        {activeMatch.status === "pregame" && (
          <button
            type="button"
            className="user-sim-btn user-sim-btn--primary"
            onClick={handleStartMatch}
          >
            경기 시작 (1회 · 사이드 마감)
          </button>
        )}
        {activeMatch.status === "live" && (
          <button type="button" className="user-sim-btn user-sim-btn--outline" onClick={handleEndMatch}>
            경기 종료 · 정산
          </button>
        )}
        {activeMatch.status === "ended" && (
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

  const actionMatch = sideBetAction ? matches.find((m) => m.id === sideBetAction.matchId) : null;
  const actionBets = sideBetAction ? betsByMatch[sideBetAction.matchId] ?? emptySideBets() : null;

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
          오늘의 경기
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
            {sideBetAction && actionMatch ? (
              <div className="user-sim-action-sheet">
                <button
                  type="button"
                  className="user-sim-action-back"
                  onClick={() => setSideBetAction(null)}
                >
                  ← 오늘의 경기 목록
                </button>
                <h2 className="user-sim-section-title">
                  {sideBetAction.betType === "winner" ? "우승팀 맞추기" : "점수 맞추기"}
                </h2>
                <p className="user-sim-section-desc">{sideBetAction.matchTitle}</p>

                {sideBetAction.betType === "winner" ? (
                  <>
                    {actionBets?.winnerBet ? (
                      <p className="user-sim-my-bet">
                        이미 배팅: {actionBets.winnerBet.pick === "home" ? "홈팀" : "원정팀"} ·{" "}
                        {actionBets.winnerBet.amount}P
                      </p>
                    ) : (
                      <>
                        <SideBetAmountSelector
                          value={winnerAmount}
                          onChange={setWinnerAmount}
                          betType="winner"
                          disabled={!isSideBetButtonEnabled(actionMatch)}
                        />
                        <div className="user-sim-pick-grid user-sim-pick-grid--2">
                          {(["home", "away"] as const).map((side) => (
                            <button
                              key={side}
                              type="button"
                              disabled={!isSideBetButtonEnabled(actionMatch)}
                              onClick={() => setWinnerPick(side)}
                              className={`user-sim-pick ${winnerPick === side ? "user-sim-pick--active" : ""}`}
                            >
                              {side === "home" ? "홈팀" : "원정팀"}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={!isSideBetButtonEnabled(actionMatch) || !winnerPick}
                          onClick={handleSubmitWinner}
                          className="user-sim-btn user-sim-btn--primary user-sim-btn--full"
                          data-testid="button-sim-winner"
                        >
                          승리팀 배팅
                        </button>
                      </>
                    )}
                    {actionBets?.winnerSettleMsg && (
                      <p className="user-sim-settle-inline">{actionBets.winnerSettleMsg}</p>
                    )}
                  </>
                ) : (
                  <>
                    {actionBets?.scoreBet ? (
                      <p className="user-sim-my-bet">
                        이미 배팅: {actionBets.scoreBet.home}-{actionBets.scoreBet.away} ·{" "}
                        {actionBets.scoreBet.amount}P
                      </p>
                    ) : (
                      <>
                        <SideBetAmountSelector
                          value={scoreAmount}
                          onChange={setScoreAmount}
                          betType="score"
                          disabled={!isSideBetButtonEnabled(actionMatch)}
                        />
                        <div className="user-sim-score-inputs">
                          <label className="user-sim-score-field">
                            <span>홈</span>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              value={homeScoreInput}
                              disabled={!isSideBetButtonEnabled(actionMatch)}
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
                              max={30}
                              value={awayScoreInput}
                              disabled={!isSideBetButtonEnabled(actionMatch)}
                              onChange={(e) => setAwayScoreInput(e.target.value)}
                              className="user-sim-score-box"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          disabled={!isSideBetButtonEnabled(actionMatch)}
                          onClick={handleSubmitScore}
                          className="user-sim-btn user-sim-btn--primary user-sim-btn--full"
                          data-testid="button-sim-score"
                        >
                          최종 스코어 배팅
                        </button>
                      </>
                    )}
                    {actionBets?.scoreSettleMsg && (
                      <p className="user-sim-settle-inline">{actionBets.scoreSettleMsg}</p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                <h2 className="user-sim-section-title">오늘의 경기</h2>
                <p className="user-sim-section-desc">
                  1회 시작 시 마감 · 경기 종료 후 정산 · 100P 단위 (연습은 5경기 모두 배팅 가능)
                </p>
                <ul className="user-sim-match-list">
                  {matches.map((match) => {
                    const bets = betsByMatch[match.id] ?? emptySideBets();
                    const enabled = isSideBetButtonEnabled(match);
                    const hint = sideBetDisabledHint(match);
                    const title = formatSimMatchTitle(match.name);

                    return (
                      <li key={match.id} className="user-sim-match-row">
                        <div className="user-sim-match-row-head">
                          <div>
                            <span className="user-sim-match-row-title">{title}</span>
                            <span className="user-sim-match-row-sub">{match.stadiumName}</span>
                            {match.status === "ended" && (
                              <span className="user-sim-match-row-sub"> · 경기 종료</span>
                            )}
                          </div>
                          {hint && match.status !== "ended" && (
                            <span className="user-sim-match-row-badge">{hint}</span>
                          )}
                        </div>

                        {(bets.winnerBet || bets.scoreBet) && (
                          <div className="user-sim-match-row-bets">
                            {bets.winnerBet && (
                              <span>
                                우승팀: {bets.winnerBet.pick === "home" ? "홈팀" : "원정팀"} ·{" "}
                                {bets.winnerBet.amount}P
                                {bets.winnerSettleMsg ? ` · ${bets.winnerSettleMsg}` : ""}
                              </span>
                            )}
                            {bets.scoreBet && (
                              <span>
                                점수: {bets.scoreBet.home}-{bets.scoreBet.away} · {bets.scoreBet.amount}P
                                {bets.scoreSettleMsg ? ` · ${bets.scoreSettleMsg}` : ""}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="user-sim-match-row-actions">
                          <button
                            type="button"
                            disabled={!enabled}
                            onClick={() => openSideBetAction(match, "winner")}
                            className="user-sim-match-action-btn"
                            data-testid={`sim-winner-${match.id}`}
                          >
                            우승팀 맞추기
                          </button>
                          <button
                            type="button"
                            disabled={!enabled}
                            onClick={() => openSideBetAction(match, "score")}
                            className="user-sim-match-action-btn"
                            data-testid={`sim-score-${match.id}`}
                          >
                            점수 맞추기
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {tab === "atBat" && (
          <div className="user-sim-panel-scroll">
            <h2 className="user-sim-section-title">예측 게임 (타석)</h2>
            <p className="user-sim-section-desc">
              타석 연습: {formatSimMatchTitle(activeMatch.name)} · 왼쪽에서 경기 선택
            </p>
            {activeMatch.status === "pregame" && (
              <p className="user-sim-section-desc">「경기 시작」 후 타석 예측을 연습할 수 있습니다.</p>
            )}
            {activeMatch.status === "ended" && (
              <p className="user-sim-section-desc">「새 경기」를 시작하면 타석 연습을 이어갈 수 있습니다.</p>
            )}

            {activeMatch.status === "live" && atBatPhase === "pick" && (
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

            {activeMatch.status === "live" && atBatPhase === "waiting" && (
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

            {activeMatch.status === "live" && atBatPhase === "result" && (
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

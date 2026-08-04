import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import SideBetAmountSelector from "@/components/SideBetAmountSelector";
import ScorePicker from "@/components/game/ScorePicker";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_SIDE_BET_AMOUNT,
  calculateSideBetPayout,
  WINNER_ODDS,
  EXACT_SCORE_ODDS,
  type SideBetAmountOption,
  type WinnerSide,
} from "@shared/predictionOdds";

interface SideBetRecord {
  id: number;
  type: "winner" | "score";
  winnerPick: WinnerSide | null;
  homeScorePick: number | null;
  awayScorePick: number | null;
  amount: number;
  status: string;
}

interface SideBetsMeResponse {
  sideBetsLocked: boolean;
  homeTeamName: string | null;
  awayTeamName: string | null;
  bets: SideBetRecord[];
}

export interface SideBetCombinedPanelProps {
  matchId: string;
  matchTitle: string;
  /** 하단 바 등에서 점수/우승팀 수정으로 열었을 때 해당 영역 강조 */
  focusSection?: "winner" | "score";
}

const CLOSE_BTN_SIZE = "h-8 w-full rounded-lg text-xs font-medium";
const FEEDBACK_MS = 2200;

/** 우승팀(좌) · 점수(우) 한 화면 */
export default function SideBetCombinedPanel({
  matchId,
  matchTitle,
  focusSection,
}: SideBetCombinedPanelProps) {
  const scoreSectionRef = useRef<HTMLElement | null>(null);
  const winnerSectionRef = useRef<HTMLElement | null>(null);
  const winnerFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [winnerAmount, setWinnerAmount] = useState<SideBetAmountOption>(DEFAULT_SIDE_BET_AMOUNT);
  const [scoreAmount, setScoreAmount] = useState<SideBetAmountOption>(DEFAULT_SIDE_BET_AMOUNT);
  const [winnerPick, setWinnerPick] = useState<WinnerSide | null>(null);
  const [homeScore, setHomeScore] = useState<number | null>(null);
  const [awayScore, setAwayScore] = useState<number | null>(null);
  const [submittingWinner, setSubmittingWinner] = useState(false);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [winnerFeedback, setWinnerFeedback] = useState<string | null>(null);
  const [scoreFeedback, setScoreFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery<SideBetsMeResponse>({
    queryKey: ["/api/live-match/matches", matchId, "side-bets/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/live-match/matches/${matchId}/side-bets/me`);
      return res.json();
    },
    enabled: Boolean(matchId),
  });

  const locked = data?.sideBetsLocked ?? false;
  const homeName = data?.homeTeamName?.trim() || "홈팀";
  const awayName = data?.awayTeamName?.trim() || "원정팀";
  const winnerBet = data?.bets.find((b) => b.type === "winner");
  const scoreBet = data?.bets.find((b) => b.type === "score");
  const winnerEdit = Boolean(winnerBet && winnerBet.status === "pending" && !locked);
  const scoreEdit = Boolean(scoreBet && scoreBet.status === "pending" && !locked);
  const winnerDisabled =
    locked || isLoading || submittingWinner || (Boolean(winnerBet) && !winnerEdit);
  const scoreDisabled = locked || isLoading || submittingScore || (Boolean(scoreBet) && !scoreEdit);

  const showWinnerFeedback = (message: string) => {
    if (winnerFeedbackTimerRef.current) clearTimeout(winnerFeedbackTimerRef.current);
    setWinnerFeedback(message);
    winnerFeedbackTimerRef.current = setTimeout(() => {
      setWinnerFeedback(null);
      winnerFeedbackTimerRef.current = null;
    }, FEEDBACK_MS);
  };

  const showScoreFeedback = (message: string) => {
    if (scoreFeedbackTimerRef.current) clearTimeout(scoreFeedbackTimerRef.current);
    setScoreFeedback(message);
    scoreFeedbackTimerRef.current = setTimeout(() => {
      setScoreFeedback(null);
      scoreFeedbackTimerRef.current = null;
    }, FEEDBACK_MS);
  };

  useEffect(() => {
    setWinnerPick(null);
    setHomeScore(null);
    setAwayScore(null);
    setWinnerAmount(DEFAULT_SIDE_BET_AMOUNT);
    setScoreAmount(DEFAULT_SIDE_BET_AMOUNT);
    setWinnerFeedback(null);
    setScoreFeedback(null);
    if (winnerFeedbackTimerRef.current) clearTimeout(winnerFeedbackTimerRef.current);
    if (scoreFeedbackTimerRef.current) clearTimeout(scoreFeedbackTimerRef.current);
  }, [matchId]);

  useEffect(() => {
    return () => {
      if (winnerFeedbackTimerRef.current) clearTimeout(winnerFeedbackTimerRef.current);
      if (scoreFeedbackTimerRef.current) clearTimeout(scoreFeedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (winnerBet?.winnerPick) setWinnerPick(winnerBet.winnerPick);
    if (scoreBet) {
      if (scoreBet.homeScorePick != null) setHomeScore(scoreBet.homeScorePick);
      if (scoreBet.awayScorePick != null) setAwayScore(scoreBet.awayScorePick);
    }
    if (winnerBet?.amount) setWinnerAmount(winnerBet.amount as SideBetAmountOption);
    if (scoreBet?.amount) setScoreAmount(scoreBet.amount as SideBetAmountOption);
  }, [winnerBet, scoreBet]);

  useEffect(() => {
    if (!focusSection) return;
    const target = focusSection === "score" ? scoreSectionRef.current : winnerSectionRef.current;
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusSection, matchId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/live-match/matches", matchId, "side-bets/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/live-match/side-bets/me/today"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
  };

  const submitWinner = async () => {
    const pick = winnerPick ?? winnerBet?.winnerPick ?? null;
    if (!pick) {
      toast({ variant: "destructive", description: "승리팀을 선택해주세요." });
      return;
    }
    setSubmittingWinner(true);
    try {
      const wasEdit = winnerEdit;
      await apiRequest("POST", "/api/live-match/side-bets", {
        matchId,
        type: "winner",
        amount: winnerAmount,
        winnerPick: pick,
      });
      showWinnerFeedback(wasEdit ? "수정되었습니다" : "배팅되었습니다");
      invalidate();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "배팅 접수에 실패했습니다.",
      });
    } finally {
      setSubmittingWinner(false);
    }
  };

  const submitScore = async () => {
    if (homeScore == null || awayScore == null) {
      toast({ variant: "destructive", description: "원정·홈 점수를 선택해주세요." });
      return;
    }
    setSubmittingScore(true);
    try {
      const wasEdit = scoreEdit;
      await apiRequest("POST", "/api/live-match/side-bets", {
        matchId,
        type: "score",
        amount: scoreAmount,
        homeScorePick: homeScore,
        awayScorePick: awayScore,
      });
      showScoreFeedback(wasEdit ? "수정되었습니다" : "배팅되었습니다");
      invalidate();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "배팅 접수에 실패했습니다.",
      });
    } finally {
      setSubmittingScore(false);
    }
  };

  const actionBtnClass = (isEdit: boolean) =>
    `${CLOSE_BTN_SIZE} mt-auto disabled:opacity-50 ${
      isEdit
        ? "bg-[#474747] text-white"
        : "bg-[#CDFF00] font-bold text-black"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="side-bet-combined-panel">
      <div className="shrink-0 border-b border-[#333] px-2.5 py-2">
        <h3 className="truncate text-center text-sm font-bold text-white">{matchTitle}</h3>
        <p className="mt-0.5 text-center text-[10px] text-[#888]">
          우승팀 {WINNER_ODDS}배 · 점수 {EXACT_SCORE_ODDS}배 · 1회 시작 시 마감
        </p>
        {locked && (
          <p className="mt-0.5 text-center text-[10px] text-amber-400">배팅이 마감되었습니다.</p>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-[#333] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* 좌 — 우승팀 */}
        <section ref={winnerSectionRef} className="relative flex min-h-0 min-w-0 flex-col px-2 py-2 sm:px-2">
          <h4 className="mb-1.5 text-center text-xs font-bold text-white">우승팀 맞추기</h4>
          {winnerBet && (
            <p className="mb-1.5 text-center text-[10px] text-[#CDFF00]">
              {winnerEdit ? "수정 가능 · " : "배팅함 · "}
              {winnerBet.winnerPick === "home" ? homeName : awayName} · {winnerBet.amount}P
            </p>
          )}
          {(!winnerBet || winnerEdit) && (
            <SideBetAmountSelector
              value={winnerAmount}
              onChange={setWinnerAmount}
              betType="winner"
              disabled={winnerDisabled}
              compact
            />
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={winnerDisabled}
              onClick={() => setWinnerPick("away")}
              className={`rounded-md border px-1 py-2 text-[11px] font-semibold ${
                winnerPick === "away"
                  ? "border-[#CDFF00] bg-[#CDFF00]/10 text-[#CDFF00]"
                  : "border-[#373539] text-white"
              } ${winnerDisabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span className="block text-[9px] font-normal text-[#888]">원정</span>
              <span className="line-clamp-2 leading-tight">{awayName}</span>
            </button>
            <button
              type="button"
              disabled={winnerDisabled}
              onClick={() => setWinnerPick("home")}
              className={`rounded-md border px-1 py-2 text-[11px] font-semibold ${
                winnerPick === "home"
                  ? "border-[#CDFF00] bg-[#CDFF00]/10 text-[#CDFF00]"
                  : "border-[#373539] text-white"
              } ${winnerDisabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span className="block text-[9px] font-normal text-[#888]">홈</span>
              <span className="line-clamp-2 leading-tight">{homeName}</span>
            </button>
          </div>
          {!locked && (!winnerBet || winnerEdit) && winnerPick && (
            <p className="mt-1.5 text-center text-[10px] text-[#888]">
              적중 {calculateSideBetPayout(winnerAmount, "winner")}P
            </p>
          )}
          {winnerFeedback && (
            <p
              className="mt-1.5 rounded-md bg-[#CDFF00]/15 px-2 py-1 text-center text-[11px] font-semibold text-[#CDFF00]"
              data-testid="side-bet-winner-feedback"
            >
              {winnerFeedback}
            </p>
          )}
          {!locked && (!winnerBet || winnerEdit) && (
            <button
              type="button"
              disabled={winnerDisabled || !winnerPick}
              onClick={() => void submitWinner()}
              className={actionBtnClass(winnerEdit)}
              data-testid="button-side-bet-winner"
            >
              {submittingWinner ? "처리 중..." : winnerEdit ? "수정" : "배팅"}
            </button>
          )}
        </section>

        {/* 우 — 점수 */}
        <section ref={scoreSectionRef} className="relative flex min-h-0 min-w-0 flex-col px-2 py-2">
          <h4 className="mb-1.5 text-center text-xs font-bold text-white">점수 맞추기</h4>
          {scoreBet && (
            <p className="mb-1.5 text-center text-[10px] text-[#CDFF00]">
              {scoreEdit ? "수정 가능 · " : "배팅함 · "}
              원정 {scoreBet.awayScorePick} : 홈 {scoreBet.homeScorePick} · {scoreBet.amount}P
            </p>
          )}
          {(!scoreBet || scoreEdit) && (
            <SideBetAmountSelector
              value={scoreAmount}
              onChange={setScoreAmount}
              betType="score"
              disabled={scoreDisabled}
              compact
            />
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <ScorePicker
              label="원정"
              value={awayScore}
              onChange={setAwayScore}
              disabled={scoreDisabled}
              compact
              layout="horizontal"
              testId="side-bet-away-score-picker"
            />
            <ScorePicker
              label="홈"
              value={homeScore}
              onChange={setHomeScore}
              disabled={scoreDisabled}
              compact
              layout="horizontal"
              testId="side-bet-home-score-picker"
            />
          </div>
          {!locked && (!scoreBet || scoreEdit) && homeScore != null && awayScore != null && (
            <p className="mt-1.5 text-center text-[10px] text-[#888]">
              적중 {calculateSideBetPayout(scoreAmount, "score")}P
            </p>
          )}
          {scoreFeedback && (
            <p
              className="mt-1.5 rounded-md bg-[#CDFF00]/15 px-2 py-1 text-center text-[11px] font-semibold text-[#CDFF00]"
              data-testid="side-bet-score-feedback"
            >
              {scoreFeedback}
            </p>
          )}
          {!locked && (!scoreBet || scoreEdit) && (
            <button
              type="button"
              disabled={scoreDisabled || homeScore == null || awayScore == null}
              onClick={() => void submitScore()}
              className={actionBtnClass(scoreEdit)}
              data-testid="button-side-bet-score"
            >
              {submittingScore ? "처리 중..." : scoreEdit ? "수정" : "배팅"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

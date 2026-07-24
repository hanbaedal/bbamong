import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import SideBetAmountSelector from "@/components/SideBetAmountSelector";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_SIDE_BET_AMOUNT,
  calculateSideBetPayout,
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
  odds: number;
  status: string;
  wonAmount: number;
}

interface SideBetsMeResponse {
  sideBetsLocked: boolean;
  homeTeamName: string | null;
  awayTeamName: string | null;
  matchStatus: string;
  bets: SideBetRecord[];
}

interface MatchSideBetsPanelProps {
  matchId: string;
  onSubmitted?: () => void;
}

export default function MatchSideBetsPanel({ matchId, onSubmitted }: MatchSideBetsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [winnerAmount, setWinnerAmount] = useState<SideBetAmountOption>(DEFAULT_SIDE_BET_AMOUNT);
  const [scoreAmount, setScoreAmount] = useState<SideBetAmountOption>(DEFAULT_SIDE_BET_AMOUNT);
  const [winnerPick, setWinnerPick] = useState<WinnerSide | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [submitting, setSubmitting] = useState<"winner" | "score" | null>(null);

  const { data, isLoading } = useQuery<SideBetsMeResponse>({
    queryKey: ["/api/live-match/matches", matchId, "side-bets/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/live-match/matches/${matchId}/side-bets/me`);
      return res.json();
    },
    enabled: Boolean(matchId),
    refetchInterval: 5000,
  });

  const locked = data?.sideBetsLocked ?? false;
  // 사용자 화면에는 구단명 대신 홈팀/원정팀만 표시 (관리자 모니터링은 별도)
  const homeName = "홈팀";
  const awayName = "원정팀";
  const winnerBet = data?.bets.find((b) => b.type === "winner");
  const scoreBet = data?.bets.find((b) => b.type === "score");
  const formDisabled = locked || isLoading || submitting !== null;

  useEffect(() => {
    if (winnerBet?.winnerPick) setWinnerPick(winnerBet.winnerPick);
    if (scoreBet?.homeScorePick != null) setHomeScore(String(scoreBet.homeScorePick));
    if (scoreBet?.awayScorePick != null) setAwayScore(String(scoreBet.awayScorePick));
  }, [winnerBet?.winnerPick, scoreBet?.homeScorePick, scoreBet?.awayScorePick]);

  const submitWinner = async () => {
    const pick = winnerPick ?? winnerBet?.winnerPick ?? null;
    if (!pick) {
      toast({ variant: "destructive", description: "승리팀을 선택해주세요." });
      return;
    }
    setSubmitting("winner");
    try {
      await apiRequest("POST", "/api/live-match/side-bets", {
        matchId,
        type: "winner",
        amount: winnerAmount,
        winnerPick: pick,
      });
      toast({ description: "승리팀 배팅이 접수되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/live-match/matches", matchId, "side-bets/me"] });
      onSubmitted?.();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "배팅 접수에 실패했습니다.",
      });
    } finally {
      setSubmitting(null);
    }
  };

  const submitScore = async () => {
    const home = parseInt(homeScore, 10);
    const away = parseInt(awayScore, 10);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
      toast({ variant: "destructive", description: "홈·원정 점수를 입력해주세요." });
      return;
    }
    setSubmitting("score");
    try {
      await apiRequest("POST", "/api/live-match/side-bets", {
        matchId,
        type: "score",
        amount: scoreAmount,
        homeScorePick: home,
        awayScorePick: away,
      });
      toast({ description: "최종 스코어 배팅이 접수되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/live-match/matches", matchId, "side-bets/me"] });
      onSubmitted?.();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "배팅 접수에 실패했습니다.",
      });
    } finally {
      setSubmitting(null);
    }
  };

  const activeWinnerPick = winnerPick ?? winnerBet?.winnerPick ?? null;

  return (
    <section className="mb-6 space-y-4">
      <div>
        <h2 className="text-white text-base font-bold mb-1">승리팀 · 최종 스코어</h2>
        <p className="text-[#888] text-xs leading-relaxed">
          1회 시작 시 자동 마감 · 경기 종료 후 자동 정산 · 배팅 100P 단위
        </p>
        {locked && (
          <p className="text-amber-400 text-xs mt-2">1회 시작으로 배팅이 마감되었습니다.</p>
        )}
      </div>

      <div className="rounded-lg border border-[#333] bg-[#1A1A1A] p-4 space-y-3">
        <h3 className="text-white text-sm font-semibold">승리팀 맞추기 (2배)</h3>
        {winnerBet && (
          <p className="text-[#CDFF00] text-xs">
            내 선택: {winnerBet.winnerPick === "home" ? homeName : awayName} · {winnerBet.amount}P
            {winnerBet.status !== "pending" && ` · ${winnerBet.status}`}
          </p>
        )}
        <SideBetAmountSelector
          value={winnerAmount}
          onChange={setWinnerAmount}
          betType="winner"
          disabled={formDisabled || Boolean(winnerBet)}
        />
        <div className="grid grid-cols-2 gap-2">
          {(["home", "away"] as const).map((side) => (
            <button
              key={side}
              type="button"
              disabled={formDisabled}
              onClick={() => setWinnerPick(side)}
              className={`rounded-lg border p-3 text-sm font-medium ${
                winnerPick === side || winnerBet?.winnerPick === side
                  ? "border-[#CDFF00] bg-[#CDFF00]/10 text-[#CDFF00]"
                  : "border-[#373539] text-white"
              } ${formDisabled ? "opacity-50" : ""}`}
            >
              {side === "home" ? homeName : awayName}
            </button>
          ))}
        </div>
        {activeWinnerPick && !locked && (
          <p className="text-[#888] text-xs">
            적중 시 {calculateSideBetPayout(winnerBet?.amount ?? winnerAmount, "winner")}P
          </p>
        )}
        <button
          type="button"
          disabled={formDisabled || !activeWinnerPick}
          onClick={submitWinner}
          className="w-full py-2.5 bg-[#CDFF00] text-black font-bold rounded-lg disabled:opacity-50"
          data-testid="button-side-bet-winner"
        >
          {submitting === "winner" ? "접수 중..." : winnerBet ? "선택 변경" : "승리팀 배팅"}
        </button>
      </div>

      <div className="rounded-lg border border-[#333] bg-[#1A1A1A] p-4 space-y-3">
        <h3 className="text-white text-sm font-semibold">최종 스코어 맞추기 (20배)</h3>
        {scoreBet && (
          <p className="text-[#CDFF00] text-xs">
            내 선택: {scoreBet.homeScorePick}-{scoreBet.awayScorePick} · {scoreBet.amount}P
            {scoreBet.status !== "pending" && ` · ${scoreBet.status}`}
          </p>
        )}
        <SideBetAmountSelector
          value={scoreAmount}
          onChange={setScoreAmount}
          betType="score"
          disabled={formDisabled || Boolean(scoreBet)}
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={30}
            value={homeScore}
            disabled={formDisabled}
            onChange={(e) => setHomeScore(e.target.value)}
            placeholder={homeName}
            className="flex-1 h-11 rounded-lg border border-[#373539] bg-[#141414] text-white text-center text-sm"
          />
          <span className="text-[#888]">:</span>
          <input
            type="number"
            min={0}
            max={30}
            value={awayScore}
            disabled={formDisabled}
            onChange={(e) => setAwayScore(e.target.value)}
            placeholder={awayName}
            className="flex-1 h-11 rounded-lg border border-[#373539] bg-[#141414] text-white text-center text-sm"
          />
        </div>
        {homeScore !== "" && awayScore !== "" && !locked && (
          <p className="text-[#888] text-xs">
            적중 시 {calculateSideBetPayout(scoreBet?.amount ?? scoreAmount, "score")}P
          </p>
        )}
        <button
          type="button"
          disabled={formDisabled || homeScore === "" || awayScore === ""}
          onClick={submitScore}
          className="w-full py-2.5 bg-[#CDFF00] text-black font-bold rounded-lg disabled:opacity-50"
          data-testid="button-side-bet-score"
        >
          {submitting === "score" ? "접수 중..." : scoreBet ? "스코어 변경" : "스코어 배팅"}
        </button>
      </div>
    </section>
  );
}
